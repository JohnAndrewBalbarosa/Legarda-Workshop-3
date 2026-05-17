// Workshop Guide — Content script.
// Runs in every AWS tab/frame. Receives state from the background service
// worker and drives:
//   1) red ripple highlighting via WorkshopHighlightEngine (loaded first)
//   2) a small shadow-DOM overlay with step text + "Ask for help" + signin
//      picker + AI assistant
// Reports URL changes back to the background so the presenter sees current page.

(function () {
  if (window.__workshopContentLoaded) return;
  window.__workshopContentLoaded = true;

  const engine = window.WorkshopHighlightEngine;
  if (!engine) return;

  // Only the top frame renders the overlay UI. All frames participate in
  // highlighting because the click target may be inside an iframe.
  const isTopFrame = (() => { try { return window.top === window.self; } catch { return false; } })();

  let latestState = null;
  let signinChoice = null;
  let aiLanguage = 'No Thanks';
  let userId = '';
  let isMinimized = false;
  let lastReportedUrl = '';
  let lastUrlStatus = '';

  function findParticipant(state) {
    if (!state || !Array.isArray(state.participants) || !userId) return null;
    return state.participants.find((p) => p.participantId === userId) || null;
  }

  function pickCurrentStep(state) {
    if (!state) return null;
    const me = findParticipant(state);
    const personalIndex = Number.isInteger(me?.personalStepIndex) ? me.personalStepIndex : state.currentStepIndex;
    const personal = state.steps?.[personalIndex] || null;
    return personal || state.currentStep || state.steps?.[state.currentStepIndex] || null;
  }

  function renderOverlay() {
    if (!isTopFrame) return;
    const url = location.href;
    const currentStep = pickCurrentStep(latestState);
    const expectedProfile = currentStep?.expectedProfile || '';
    const rawUrlStatus = engine.expectedUrlMatcher(expectedProfile, url);
    const urlStatus = rawUrlStatus === 'wrong' ? 'unknown' : rawUrlStatus;
    const computed = engine.getHighlightsForUrl(url, { signinChoice });
    // Surface the sign-in type picker as early as the AWS home page so the
    // choice is logged BEFORE the user clicks "Sign in". The usher can then
    // see whether the participant is using root, IAM, or signing up new.
    // The picker is passive — no red ripple on the page while it is shown.
    const showSigninPicker =
      signinChoice === null && (computed.id === 'signin-choice' || computed.id === 'aws-home');
    const isLaunchPage = url.includes('#LaunchInstances:');

    if (url !== lastReportedUrl || urlStatus !== lastUrlStatus) {
      lastReportedUrl = url;
      lastUrlStatus = urlStatus;
      try {
        chrome.runtime.sendMessage({ kind: 'url_report', url, urlStatus, profileId: computed.id });
      } catch {}
    }

    // No blinking while the sign-in picker is asking the user for their choice
    // — keep the page calm until they pick root / IAM / new.
    engine.setSelectors(showSigninPicker ? [] : computed.selectors);

    let host = document.getElementById('workshop-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'workshop-host';
      (document.body || document.documentElement).appendChild(host);
      host.attachShadow({ mode: 'open' });
    }

    const banner = urlStatus === 'correct'
      ? { color: '#166534', bg: '#dcfce7', text: 'You are at the correct link' }
      : { color: '#475569', bg: '#e2e8f0', text: 'Continue at your own pace' };

    const stepTitle = currentStep?.title || 'AWS Guide';
    const stepDesc = currentStep?.description || 'Connecting to the presenter…';

    host.shadowRoot.innerHTML = `
      <style>
        :host { position: fixed; top: 12px; right: 12px; z-index: 2147483647; font-family: sans-serif; }
        .circle { width: 50px; height: 50px; background: #0284c7; border-radius: 50%; display: ${isMinimized ? 'flex' : 'none'}; align-items: center; justify-content: center; color: white; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid white; font-weight: bold; }
        .panel { width: 330px; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); border: 1px solid #bae6fd; padding: 14px; display: ${isMinimized ? 'none' : 'block'}; color: #1e293b; }
        .btn { padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 0.75rem; font-weight: bold; cursor: pointer; background: white; }
        .btn.active { background: #0284c7; color: white; }
        .btn.primary { color: white; border: none; width: 100%; margin-top: 10px; padding: 10px; border-radius: 999px; font-weight: 800; }
        .badge { padding: 4px 10px; border-radius: 999px; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.4px; }
        .picker { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 10px 0; }
        .picker .opt { padding: 10px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; font-weight: 700; text-align: center; }
        .picker .opt.active { background: #0284c7; color: white; border-color: #0284c7; }
      </style>
      <div class="circle" id="expand">AWS</div>
      <div class="panel">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:0.6rem; color:#0284c7; font-weight:bold;">WORKSHOP ACTIVE</span>
          <button id="min" style="background:none; border:none; text-decoration:underline; font-size:0.6rem; color:#64748b; cursor:pointer;">Minimize</button>
        </div>
        <div class="badge" style="background:${banner.bg}; color:${banner.color}; display:inline-block; margin-bottom:8px;">${banner.text}</div>
        <h4 style="margin:0;">${escapeHtml(stepTitle)}</h4>
        <p style="font-size:0.75rem; color:#475569; margin:6px 0;">${escapeHtml(stepDesc)}</p>

        ${showSigninPicker ? `
          <div style="font-size:0.7rem; color:#64748b; margin-top:8px;">Pick one to start. Highlights will only begin after you choose.</div>
          <div class="picker">
            <div class="opt ${signinChoice === 'iam'  ? 'active' : ''}" data-choice="iam">Sign in — IAM user</div>
            <div class="opt ${signinChoice === 'root' ? 'active' : ''}" data-choice="root">Sign in — Root email</div>
            <div class="opt ${signinChoice === 'new'  ? 'active' : ''}" data-choice="new">Create new account</div>
          </div>
        ` : ''}

        <div style="display: ${isLaunchPage ? 'block' : 'none'}; margin: 10px 0; border: 1px dashed #cbd5e1; padding: 8px; border-radius: 8px; background: #f8fafc;">
          <div style="font-size:0.7rem; font-weight:bold; margin-bottom:6px;">AI ASSISTANT</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">
            <div class="btn ${aiLanguage === 'Tagalog' ? 'active' : ''}" data-l="Tagalog">Tagalog</div>
            <div class="btn ${aiLanguage === 'Taglish' ? 'active' : ''}" data-l="Taglish">Taglish</div>
            <button class="btn" id="ai-ex">Explain</button>
            <button class="btn" id="ai-tr">Translate</button>
          </div>
        </div>
        <button class="btn primary" id="ask-help" style="background:#ea580c;">Ask for help</button>
      </div>
    `;

    const sr = host.shadowRoot;
    sr.querySelector('#min').onclick = () => { isMinimized = !isMinimized; renderOverlay(); };
    sr.querySelector('#expand').onclick = () => { isMinimized = !isMinimized; renderOverlay(); };
    const askBtn = sr.querySelector('#ask-help');
    if (askBtn) askBtn.onclick = () => chrome.runtime.sendMessage({ kind: 'ask_help' });
    sr.querySelectorAll('.btn[data-l]').forEach((b) => {
      b.onclick = () => { aiLanguage = b.dataset.l; chrome.runtime.sendMessage({ kind: 'set_language', language: aiLanguage }); renderOverlay(); };
    });
    sr.querySelectorAll('.opt[data-choice]').forEach((b) => {
      b.onclick = () => { signinChoice = b.dataset.choice; chrome.runtime.sendMessage({ kind: 'set_signin_choice', choice: signinChoice }); renderOverlay(); };
    });
    const aiEx = sr.querySelector('#ai-ex');
    if (aiEx) aiEx.onclick = () => chrome.runtime.sendMessage({ kind: 'ai_request', mode: 'explain', content: document.body.innerText.slice(0, 3000) });
    const aiTr = sr.querySelector('#ai-tr');
    if (aiTr) aiTr.onclick = () => chrome.runtime.sendMessage({ kind: 'ai_request', mode: 'translate', content: document.body.innerText.slice(0, 3000) });
  }

  function applyForCurrentUrl() {
    const url = location.href;
    const computed = engine.getHighlightsForUrl(url, { signinChoice });
    engine.setSelectors(computed.selectors);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderIpPrompt(currentWsUrl) {
    if (!isTopFrame) return;
    const existing = document.getElementById('workshop-ip-prompt');
    if (existing) return;

    const host = document.createElement('div');
    host.id = 'workshop-ip-prompt';
    (document.body || document.documentElement).appendChild(host);
    host.attachShadow({ mode: 'open' });

    const currentIp = (() => {
      try { return new URL(currentWsUrl).hostname; } catch { return '192.168.1.x'; }
    })();

    host.shadowRoot.innerHTML = `
      <style>
        :host { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.45); font-family: sans-serif; }
        .card { background: white; border-radius: 14px; padding: 24px; width: 320px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
        h2 { margin: 0 0 6px; font-size: 1rem; color: #1e293b; }
        p { margin: 0 0 14px; font-size: 0.75rem; color: #64748b; }
        label { display: block; font-size: 0.65rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
        input { width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; box-sizing: border-box; }
        input:focus { outline: 2px solid #dc2626; border-color: transparent; }
        button { margin-top: 12px; width: 100%; padding: 10px; background: #dc2626; color: white; border: none; border-radius: 999px; font-weight: 800; font-size: 0.8rem; cursor: pointer; }
        .hint { margin-top: 8px; font-size: 0.65rem; color: #94a3b8; text-align: center; }
      </style>
      <div class="card">
        <h2>Presenter not found</h2>
        <p>The workshop guide lost connection. Enter the presenter's private IP address to reconnect.</p>
        <label for="ip">Presenter IP</label>
        <input id="ip" type="text" placeholder="192.168.1.x" value="${escapeHtml(currentIp)}" />
        <button id="connect">Reconnect</button>
        <div class="hint">Port 5050 is used automatically.</div>
      </div>
    `;

    const sr = host.shadowRoot;
    const input = sr.querySelector('#ip');
    input.select();

    const doConnect = () => {
      const ip = input.value.trim();
      if (!ip) return;
      const wsUrl = `ws://${ip}:5050`;
      chrome.runtime.sendMessage({ kind: 'set_presenter_ws', url: wsUrl });
      host.remove();
    };

    sr.querySelector('#connect').onclick = doConnect;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doConnect(); });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object') return;
    if (message.kind === 'workshop_state') {
      latestState = message.state || latestState;
      signinChoice = message.signinChoice ?? signinChoice;
      aiLanguage = message.aiLanguage ?? aiLanguage;
      userId = message.userId || userId;
      if (isTopFrame) renderOverlay(); else applyForCurrentUrl();
    }
    if (message.kind === 'request_presenter_ip' && isTopFrame) {
      renderIpPrompt(message.currentUrl || '');
    }
    if (message.kind === 'presenter_connected' && isTopFrame) {
      document.getElementById('workshop-ip-prompt')?.remove();
    }
  });

  chrome.runtime.sendMessage({ kind: 'request_state' }, (resp) => {
    if (!resp) return;
    latestState = resp.state || null;
    signinChoice = resp.signinChoice ?? null;
    aiLanguage = resp.aiLanguage ?? 'No Thanks';
    userId = resp.userId || '';
    if (isTopFrame) renderOverlay(); else applyForCurrentUrl();
  });

  // SPA URL changes: poll the location every 750ms (cheap; AWS console pushes
  // history changes without firing 'load'). On change, re-render + re-apply.
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (isTopFrame) renderOverlay(); else applyForCurrentUrl();
    } else if (isTopFrame) {
      // Ensure the overlay survives full-page re-renders (host removed).
      if (!document.getElementById('workshop-host')) renderOverlay();
    }
  }, 750);
})();
