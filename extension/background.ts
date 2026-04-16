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
// Types (mirroring src/orchestrator/types.ts — kept inline to avoid imports)
// ---------------------------------------------------------------------------

interface ExtensionCommand {
  type:
    | 'navigate'
    | 'scrape-listings'
    | 'click-next-page'
    | 'apply-to-listing'
    | 'check-result'
    | 'stop';
  [key: string]: unknown;
}

interface ExtensionEvent {
  type: string;
  [key: string]: unknown;
}

type ConnectionState = 'disconnected' | 'connected' | 'error';

interface Stats {
  applied: number;
  failed: number;
  skipped: number;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const BK_DEFAULT_WS_URL =
  'wss://berlinkeys-api-production.up.railway.app/ws?role=extension&token=dev-token&userId=00000000-0000-0000-0000-000000000001';
const RECONNECT_DELAY_MS = 5000;
const EXTENSION_VERSION = '0.1.0';

let ws: WebSocket | null = null;
let state: ConnectionState = 'disconnected';
let stats: Stats = { applied: 0, failed: 0, skipped: 0 };
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let activeTabId: number | null = null;

// ---------------------------------------------------------------------------
// Keep-alive: prevent MV3 service worker from going idle and killing the WS
// ---------------------------------------------------------------------------

const KEEPALIVE_ALARM = 'bk-keepalive';
const KEEPALIVE_INTERVAL_MIN = 0.4; // ~24 seconds (minimum Chrome allows is 0.5 in production, but we set it low and Chrome clamps it)

function startKeepAlive(): void {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_INTERVAL_MIN });
}

function stopKeepAlive(): void {
  chrome.alarms.clear(KEEPALIVE_ALARM);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    // Send a ping to keep the WebSocket alive
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    } else if (!ws || ws.readyState === WebSocket.CLOSED) {
      // WebSocket died — reconnect immediately
      connect();
    }
  }
});

// ---------------------------------------------------------------------------
// WebSocket lifecycle
// ---------------------------------------------------------------------------

function getWsUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['wsUrl'], (result) => {
      resolve((result.wsUrl as string) || BK_DEFAULT_WS_URL);
    });
  });
}

async function connect(): Promise<void> {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const url = await getWsUrl();
  console.log('[BerlinKeys] Connecting to', url);

  try {
    ws = new WebSocket(url);
  } catch (err) {
    console.error('[BerlinKeys] WebSocket constructor error:', err);
    setState('error');
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[BerlinKeys] WebSocket connected');
    setState('connected');
    startKeepAlive();

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

  ws.onmessage = (event: MessageEvent) => {
    let command: ExtensionCommand;
    try {
      command = JSON.parse(event.data as string);
    } catch (err) {
      console.error('[BerlinKeys] Failed to parse command:', err);
      return;
    }
    console.log('[BerlinKeys] Received command:', command.type);
    handleCommand(command);
  };

  ws.onerror = (event: Event) => {
    console.error('[BerlinKeys] WebSocket error:', event);
    setState('error');
  };

  ws.onclose = () => {
    console.log('[BerlinKeys] WebSocket closed');
    ws = null;
    setState('disconnected');
    stopKeepAlive();
    scheduleReconnect();
  };
}

function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopKeepAlive();
  if (ws) {
    ws.onclose = null; // prevent auto-reconnect
    ws.close();
    ws = null;
  }
  setState('disconnected');
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  console.log(`[BerlinKeys] Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_DELAY_MS);
}

function setState(newState: ConnectionState): void {
  state = newState;
  broadcastToPopup();
}

function broadcastToPopup(): void {
  chrome.runtime.sendMessage({ type: 'state-update', state, stats }).catch(() => {
    // Popup not open — ignore
  });
}

// ---------------------------------------------------------------------------
// Command handling — forward to content script
// ---------------------------------------------------------------------------

function handleCommand(command: ExtensionCommand): void {
  // For navigate commands, actually navigate the tab
  if (command.type === 'navigate') {
    const url = command.url as string;
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

function navigateTab(url: string): void {
  const doNavigate = (tabId: number) => {
    chrome.tabs.update(tabId, { url, active: true }, () => {
      activeTabId = tabId;
      // Wait for page to load before reporting
      const listener = (
        updatedTabId: number,
        changeInfo: chrome.tabs.OnUpdatedInfo
      ) => {
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
  } else {
    // Find or create an immoscout tab
    chrome.tabs.query({ url: '*://www.immobilienscout24.de/*' }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id != null) {
        doNavigate(tabs[0].id);
      } else {
        chrome.tabs.create({ url, active: true }, (tab) => {
          if (tab.id != null) {
            activeTabId = tab.id;
            // The tab will fire onUpdated when loaded
            const listener = (
              updatedTabId: number,
              changeInfo: chrome.tabs.OnUpdatedInfo
            ) => {
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

function forwardToContentScript(command: ExtensionCommand): void {
  const tabId = activeTabId;
  if (tabId == null) {
    sendToBackend({
      type: 'error',
      message: 'No active Immoscout tab found. Navigate first.',
    });
    return;
  }

  chrome.tabs.sendMessage(
    tabId,
    { action: command.type, data: command },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          '[BerlinKeys] Content script communication error:',
          chrome.runtime.lastError.message
        );
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
    }
  );
}

function handleContentScriptResponse(
  command: ExtensionCommand,
  response: { success: boolean; data?: unknown; error?: string }
): void {
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
      const listingId = (command as { listingId?: string }).listingId ?? 'unknown';
      stats.failed++;
      broadcastToPopup();
      sendToBackend({
        type: 'apply-failed',
        listingId,
        reason: response.error ?? 'Unknown error',
      });
    } else {
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
      const data = response.data as {
        listings: unknown[];
        hasNextPage: boolean;
      };
      sendToBackend({
        type: 'listings-scraped',
        pageNum: (command as { pageNum?: number }).pageNum ?? 1,
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
      const listingId = (command as { listingId?: string }).listingId ?? 'unknown';
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
        ...(response.data as Record<string, unknown>),
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

function sendToBackend(event: ExtensionEvent): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
    console.log('[BerlinKeys] Sent event:', event.type);
  } else {
    console.warn('[BerlinKeys] Cannot send — WebSocket not connected. Event:', event.type);
  }
}

// ---------------------------------------------------------------------------
// Message handler — popup and content script communication
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; [key: string]: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
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
        chrome.storage.local.set({ wsUrl: message.url as string }, () => {
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
  }
);

// ---------------------------------------------------------------------------
// Auto-connect on service worker startup
// ---------------------------------------------------------------------------

connect();

console.log('[BerlinKeys] Background service worker started');
