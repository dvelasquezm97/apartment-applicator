/**
 * BerlinKeys — Popup Script
 *
 * Controls the extension popup UI. Communicates with the background service
 * worker to show connection status and stats, and to connect/disconnect.
 *
 * Build: compile to popup.js (plain JS, no ESM) before loading in Chrome.
 *   tsc popup.ts --outDir . --target ES2020 --lib ES2020,DOM
 *   (or use the project build step)
 */

// ---------------------------------------------------------------------------
// DOM elements
// ---------------------------------------------------------------------------

const statusDot = document.getElementById('statusDot') as HTMLDivElement;
const statusText = document.getElementById('statusText') as HTMLSpanElement;
const wsUrlInput = document.getElementById('wsUrl') as HTMLInputElement;
const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnectBtn') as HTMLButtonElement;
const appliedCount = document.getElementById('appliedCount') as HTMLDivElement;
const failedCount = document.getElementById('failedCount') as HTMLDivElement;
const skippedCount = document.getElementById('skippedCount') as HTMLDivElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;

const POPUP_DEFAULT_WS_URL =
  'ws://localhost:3000/ws?role=extension&token=dev-token&userId=00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// State display
// ---------------------------------------------------------------------------

interface PopupState {
  state: 'disconnected' | 'connected' | 'error';
  stats: { applied: number; failed: number; skipped: number };
}

function updateUI(data: PopupState): void {
  const { state, stats } = data;

  // Status dot and text
  statusDot.className = 'status-dot';
  statusDot.classList.add(state);

  const labels: Record<string, string> = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Connection Error',
  };
  statusText.textContent = labels[state] || 'Unknown';

  // Buttons
  connectBtn.disabled = state === 'connected';
  disconnectBtn.disabled = state === 'disconnected';

  // Stats
  appliedCount.textContent = String(stats.applied);
  failedCount.textContent = String(stats.failed);
  skippedCount.textContent = String(stats.skipped);
}

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

function init(): void {
  // Load saved URL
  chrome.storage.local.get(['wsUrl'], (result) => {
    wsUrlInput.value = (result.wsUrl as string) || POPUP_DEFAULT_WS_URL;
  });

  // Get current state from background
  chrome.runtime.sendMessage({ type: 'get-state' }, (response) => {
    if (response) {
      updateUI(response as PopupState);
    }
  });
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

connectBtn.addEventListener('click', () => {
  // Save the URL first, then connect
  const url = wsUrlInput.value.trim();
  if (!url) return;

  chrome.runtime.sendMessage({ type: 'set-ws-url', url }, () => {
    chrome.runtime.sendMessage({ type: 'connect' }, () => {
      // Briefly show connecting state
      statusDot.className = 'status-dot error'; // yellow-ish while connecting
      statusText.textContent = 'Connecting...';
      connectBtn.disabled = true;
    });
  });
});

disconnectBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'disconnect' }, () => {
    updateUI({
      state: 'disconnected',
      stats: {
        applied: parseInt(appliedCount.textContent || '0'),
        failed: parseInt(failedCount.textContent || '0'),
        skipped: parseInt(skippedCount.textContent || '0'),
      },
    });
  });
});

resetBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'reset-stats' }, (response) => {
    if (response?.stats) {
      appliedCount.textContent = String(response.stats.applied);
      failedCount.textContent = String(response.stats.failed);
      skippedCount.textContent = String(response.stats.skipped);
    }
  });
});

// Save URL on change (debounced)
let saveTimer: ReturnType<typeof setTimeout> | null = null;
wsUrlInput.addEventListener('input', () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'set-ws-url', url: wsUrlInput.value.trim() });
  }, 500);
});

// ---------------------------------------------------------------------------
// Listen for state updates from background (live updates while popup is open)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; state?: string; stats?: { applied: number; failed: number; skipped: number } },
    _sender: chrome.runtime.MessageSender,
    _sendResponse: (response: unknown) => void
  ) => {
    if (message.type === 'state-update') {
      updateUI({
        state: (message.state as PopupState['state']) || 'disconnected',
        stats: message.stats || { applied: 0, failed: 0, skipped: 0 },
      });
    }
    return false;
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

init();
