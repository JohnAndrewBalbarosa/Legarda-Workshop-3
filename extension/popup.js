const DEFAULT_WS = 'ws://workshop.local:5050';

(async () => {
  const { userId = '', presenterWs = DEFAULT_WS } = await chrome.storage.sync.get(['userId', 'presenterWs']);
  document.getElementById('userId').value = userId;
  document.getElementById('presenterWs').value = presenterWs;

  document.getElementById('save').addEventListener('click', async () => {
    const newUserId = document.getElementById('userId').value.trim() || `user-${Math.random().toString(36).slice(2, 8)}`;
    const newWs = document.getElementById('presenterWs').value.trim() || DEFAULT_WS;
    await chrome.storage.sync.set({ userId: newUserId, presenterWs: newWs });
    chrome.runtime.sendMessage({ kind: 'set_user_id', userId: newUserId });
    chrome.runtime.sendMessage({ kind: 'set_presenter_ws', url: newWs });
    document.getElementById('status').textContent = 'Saved. Reconnecting…';
    setTimeout(() => { document.getElementById('status').textContent = ''; }, 1500);
  });
})();
