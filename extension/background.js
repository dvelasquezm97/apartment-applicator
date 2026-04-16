"use strict";
/**
 * BerlinKeys — Background Service Worker
 *
 * Connects to the BerlinKeys backend via WebSocket.
 * Receives commands from the backend orchestrator, forwards them to the
 * content script running on immobilienscout24.de pages.
 * Receives results from the content script, forwards them back to the backend.
 *
 * Build: compile to background.js (plain JS, no ESM) before loading in Chrome.
 *   tsc background.ts --outDir . --target ES2020 --lib ES2020
 *   (or use the project build step)
 */
// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const BK_DEFAULT_WS_URL = 'ws://localhost:3000/ws?role=extension&token=dev-token&userId=00000000-0000-0000-0000-000000000001';
const RECONNECT_DELAY_MS = 5000;
const EXTENSION_VERSION = '0.1.0';
let ws = null;
let state = 'disconnected';
let stats = { applied: 0, failed: 0, skipped: 0 };
let reconnectTimer = null;
let activeTabId = null;
// ---------------------------------------------------------------------------
// WebSocket lifecycle
// ---------------------------------------------------------------------------
function getWsUrl() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['wsUrl'], (result) => {
            resolve(result.wsUrl || BK_DEFAULT_WS_URL);
        });
    });
}
async function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }
    const url = await getWsUrl();
    console.log('[BerlinKeys] Connecting to', url);
    try {
        ws = new WebSocket(url);
    }
    catch (err) {
        console.error('[BerlinKeys] WebSocket constructor error:', err);
        setState('error');
        scheduleReconnect();
        return;
    }
    ws.onopen = () => {
        console.log('[BerlinKeys] WebSocket connected');
        setState('connected');
        // Find an active immoscout tab to report tabId
        chrome.tabs.query({ url: '*://www.immobilienscout24.de/*' }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id != null) {
                activeTabId = tabs[0].id;
            }
            sendToBackend({
                type: 'connected',
                extensionVersion: EXTENSION_VERSION,
                tabId: activeTabId ?? -1,
            });
        });
    };
    ws.onmessage = (event) => {
        let command;
        try {
            command = JSON.parse(event.data);
        }
        catch (err) {
            console.error('[BerlinKeys] Failed to parse command:', err);
            return;
        }
        console.log('[BerlinKeys] Received command:', command.type);
        handleCommand(command);
    };
    ws.onerror = (event) => {
        console.error('[BerlinKeys] WebSocket error:', event);
        setState('error');
    };
    ws.onclose = () => {
        console.log('[BerlinKeys] WebSocket closed');
        ws = null;
        setState('disconnected');
        scheduleReconnect();
    };
}
function disconnect() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (ws) {
        ws.onclose = null; // prevent auto-reconnect
        ws.close();
        ws = null;
    }
    setState('disconnected');
}
function scheduleReconnect() {
    if (reconnectTimer)
        return;
    console.log(`[BerlinKeys] Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, RECONNECT_DELAY_MS);
}
function setState(newState) {
    state = newState;
    broadcastToPopup();
}
function broadcastToPopup() {
    chrome.runtime.sendMessage({ type: 'state-update', state, stats }).catch(() => {
        // Popup not open — ignore
    });
}
// ---------------------------------------------------------------------------
// Command handling — forward to content script
// ---------------------------------------------------------------------------
function handleCommand(command) {
    // For navigate commands, actually navigate the tab
    if (command.type === 'navigate') {
        const url = command.url;
        navigateTab(url);
        return;
    }
    // For stop, just acknowledge
    if (command.type === 'stop') {
        console.log('[BerlinKeys] Stop command received');
        sendToBackend({ type: 'stopped' });
        return;
    }
    // Forward everything else to the content script
    forwardToContentScript(command);
}
function navigateTab(url) {
    const doNavigate = (tabId) => {
        chrome.tabs.update(tabId, { url, active: true }, () => {
            activeTabId = tabId;
            // Wait for page to load before reporting
            const listener = (updatedTabId, changeInfo) => {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    sendToBackend({ type: 'navigated', url });
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
            // Timeout safety — report navigated after 15s regardless
            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
            }, 15000);
        });
    };
    if (activeTabId != null) {
        doNavigate(activeTabId);
    }
    else {
        // Find or create an immoscout tab
        chrome.tabs.query({ url: '*://www.immobilienscout24.de/*' }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id != null) {
                doNavigate(tabs[0].id);
            }
            else {
                chrome.tabs.create({ url, active: true }, (tab) => {
                    if (tab.id != null) {
                        activeTabId = tab.id;
                        // The tab will fire onUpdated when loaded
                        const listener = (updatedTabId, changeInfo) => {
                            if (updatedTabId === tab.id && changeInfo.status === 'complete') {
                                chrome.tabs.onUpdated.removeListener(listener);
                                sendToBackend({ type: 'navigated', url });
                            }
                        };
                        chrome.tabs.onUpdated.addListener(listener);
                        setTimeout(() => {
                            chrome.tabs.onUpdated.removeListener(listener);
                        }, 15000);
                    }
                });
            }
        });
    }
}
function forwardToContentScript(command) {
    const tabId = activeTabId;
    if (tabId == null) {
        sendToBackend({
            type: 'error',
            message: 'No active Immoscout tab found. Navigate first.',
        });
        return;
    }
    chrome.tabs.sendMessage(tabId, { action: command.type, data: command }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('[BerlinKeys] Content script communication error:', chrome.runtime.lastError.message);
            sendToBackend({
                type: 'error',
                message: `Content script error: ${chrome.runtime.lastError.message}`,
            });
            return;
        }
        if (!response) {
            sendToBackend({
                type: 'error',
                message: 'No response from content script',
            });
            return;
        }
        // Content script returns { success, data?, error? }
        // Transform into the appropriate event and forward to backend
        handleContentScriptResponse(command, response);
    });
}
function handleContentScriptResponse(command, response) {
    if (!response.success) {
        // Check if it's a captcha situation
        if (response.error && response.error.toLowerCase().includes('captcha')) {
            sendToBackend({ type: 'captcha-detected' });
            // Show browser notification so user knows to solve it
            chrome.notifications.create('captcha-alert', {
                type: 'basic',
                iconUrl: 'icons/icon-128.png',
                title: 'BerlinKeys — CAPTCHA detected',
                message: 'Immoscout is showing a CAPTCHA. Please switch to the browser tab and solve it.',
                priority: 2,
                requireInteraction: true,
            });
            return;
        }
        if (command.type === 'apply-to-listing') {
            const listingId = command.listingId ?? 'unknown';
            stats.failed++;
            broadcastToPopup();
            sendToBackend({
                type: 'apply-failed',
                listingId,
                reason: response.error ?? 'Unknown error',
            });
        }
        else {
            sendToBackend({
                type: 'error',
                message: response.error ?? `Command ${command.type} failed`,
            });
        }
        return;
    }
    // Route successful responses to the correct event type
    switch (command.type) {
        case 'scrape-listings': {
            const data = response.data;
            sendToBackend({
                type: 'listings-scraped',
                pageNum: command.pageNum ?? 1,
                listings: data.listings,
                hasNextPage: data.hasNextPage,
            });
            break;
        }
        case 'click-next-page': {
            sendToBackend({
                type: 'navigated',
                url: 'next-page',
            });
            break;
        }
        case 'apply-to-listing': {
            const listingId = command.listingId ?? 'unknown';
            stats.applied++;
            broadcastToPopup();
            sendToBackend({
                type: 'apply-success',
                listingId,
            });
            break;
        }
        case 'check-result': {
            // Forward the raw data
            sendToBackend({
                type: 'check-result-response',
                ...response.data,
            });
            break;
        }
        default:
            console.log('[BerlinKeys] Unhandled command response for:', command.type);
    }
}
// ---------------------------------------------------------------------------
// Send to backend
// ---------------------------------------------------------------------------
function sendToBackend(event) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
        console.log('[BerlinKeys] Sent event:', event.type);
    }
    else {
        console.warn('[BerlinKeys] Cannot send — WebSocket not connected. Event:', event.type);
    }
}
// ---------------------------------------------------------------------------
// Message handler — popup and content script communication
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
        case 'get-state':
            sendResponse({ state, stats });
            break;
        case 'connect':
            connect();
            sendResponse({ ok: true });
            break;
        case 'disconnect':
            disconnect();
            sendResponse({ ok: true });
            break;
        case 'set-ws-url':
            chrome.storage.local.set({ wsUrl: message.url }, () => {
                sendResponse({ ok: true });
            });
            return true; // async response
        case 'reset-stats':
            stats = { applied: 0, failed: 0, skipped: 0 };
            sendResponse({ ok: true, stats });
            break;
        default:
            // Unknown message — might be from content script bubbling up
            break;
    }
    return false;
});
// ---------------------------------------------------------------------------
// Auto-connect on service worker startup
// ---------------------------------------------------------------------------
connect();
console.log('[BerlinKeys] Background service worker started');
