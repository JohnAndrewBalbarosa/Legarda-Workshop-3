// Workshop Guide — Background service worker.
// Owns a single WebSocket to the presenter, broadcasts state to all matching
// content scripts via chrome.tabs.sendMessage, relays user-originated events
// (help requests, signin choice, AI requests) back to the server.
//
// MV3 service workers can be terminated when idle — we lazily reconnect on any
// incoming message and on every tabs/onUpdated event for AWS hosts.

const DEFAULT_WS = 'ws://127.0.0.1:5050';
const HOST_REGEX = /^https:\/\/([a-z0-9-]+\.)*aws\.amazon\.com\//i;

let socket = null;
let socketUrl = '';
let reconnectTimer = null;
let latestState = null;
let userId = '';
let signinChoice = null;
let aiLanguage = 'No Thanks';
let failureCount = 0;
let waitingForIp = false;
const FAILURE_THRESHOLD = 5;

async function loadSettings() {
  const stored = await chrome.storage.sync.get(['presenterWs', 'userId']);
  socketUrl = stored.presenterWs || DEFAULT_WS;
  userId = stored.userId || `user-${Math.random().toString(36).slice(2, 8)}`;
  if (!stored.userId) await chrome.storage.sync.set({ userId });
  if (!stored.presenterWs) await chrome.storage.sync.set({ presenterWs: socketUrl });
}

async function broadcastToTabs(message) {
  try {
    const tabs = await chrome.tabs.query({ url: ['*://*.aws.amazon.com/*', '*://aws.amazon.com/*'] });
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    }
  } catch {}
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  if (!socketUrl) return;

  try {
    socket = new WebSocket(socketUrl);
  } catch (e) {
    scheduleReconnect();
    return;
  }

  socket.addEventListener('open', () => {
    failureCount = 0;
    waitingForIp = false;
    broadcastToTabs({ kind: 'presenter_connected' });
    try {
      socket.send(JSON.stringify({ type: 'hello', role: 'user', participantId: userId }));
    } catch {}
  });
  socket.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'workshop_state') {
        latestState = msg.state;
        broadcastToTabs({ kind: 'workshop_state', state: latestState, signinChoice, aiLanguage, userId });
      } else if (msg.type === 'ai_response') {
        broadcastToTabs({ kind: 'ai_response', payload: msg });
      }
    } catch {}
  });
  socket.addEventListener('close', () => {
    failureCount++;
    if (failureCount >= FAILURE_THRESHOLD && !waitingForIp) {
      waitingForIp = true;
      broadcastToTabs({ kind: 'request_presenter_ip', currentUrl: socketUrl });
    } else if (!waitingForIp) {
      scheduleReconnect();
    }
  });
  socket.addEventListener('error', () => { try { socket.close(); } catch {} });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 2000);
}

function sendToPresenter(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  try { socket.send(JSON.stringify(payload)); return true; } catch { return false; }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  if (message.kind === 'request_state') {
    sendResponse({ state: latestState, signinChoice, aiLanguage, userId, socketUrl });
    return true;
  }
  if (message.kind === 'set_signin_choice') {
    if (['iam', 'root', 'new'].includes(message.choice)) {
      signinChoice = message.choice;
      sendToPresenter({ type: 'user.signin_choice', choice: signinChoice });
      broadcastToTabs({ kind: 'workshop_state', state: latestState, signinChoice, aiLanguage, userId });
    }
    return;
  }
  if (message.kind === 'reset_signin_choice') {
    signinChoice = null;
    broadcastToTabs({ kind: 'workshop_state', state: latestState, signinChoice, aiLanguage, userId });
    return;
  }
  if (message.kind === 'set_language') {
    aiLanguage = message.language || 'No Thanks';
    sendToPresenter({ type: 'user.translation_lang', language: aiLanguage });
    return;
  }
  if (message.kind === 'ask_help') {
    const currentStep = latestState?.currentStep || null;
    sendToPresenter({
      type: 'user.help_request',
      requestId: `help-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      participantId: userId,
      stepId: currentStep?.id ?? null,
      stepTitle: currentStep?.title ?? '',
    });
    return;
  }
  if (message.kind === 'url_report') {
    sendToPresenter({
      type: 'user.url_report',
      url: message.url,
      urlStatus: message.urlStatus,
      profileId: message.profileId,
    });
    return;
  }
  if (message.kind === 'ai_request') {
    sendToPresenter({
      type: 'user.ai_request',
      mode: message.mode,
      language: aiLanguage,
      content: message.content,
    });
    return;
  }
  if (message.kind === 'set_presenter_ws') {
    socketUrl = message.url || DEFAULT_WS;
    failureCount = 0;
    waitingForIp = false;
    chrome.storage.sync.set({ presenterWs: socketUrl });
    try { socket?.close(); } catch {}
    connect();
    return;
  }
  if (message.kind === 'set_user_id') {
    userId = message.userId || userId;
    chrome.storage.sync.set({ userId });
    try { socket?.close(); } catch {}
    connect();
    return;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  if (!HOST_REGEX.test(tab.url)) return;
  // SPA-leaving signin domain → reset local choice gate.
  if (!tab.url.includes('signin.aws.amazon.com') && !tab.url.includes('signup.aws.amazon.com')) {
    if (signinChoice !== null) {
      signinChoice = null;
      broadcastToTabs({ kind: 'workshop_state', state: latestState, signinChoice, aiLanguage, userId });
    }
  }
  connect();
});

(async () => {
  await loadSettings();
  connect();
})();
