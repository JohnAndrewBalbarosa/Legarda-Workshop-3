import { spawn } from 'node:child_process';
import path from 'node:path';
import { expectedUrlMatcher, getHighlightsForUrl } from './highlight-engine.mjs';

const host = process.env.USER_HOST || process.env.HOST || '192.168.1.244';
const presenterWs = process.env.PRESENTER_WS || 'ws://192.168.1.244:5050';
const userId = process.env.USER_ID || 'user-1';

let browser = null;
let websocket = null;
let awsPage = null;
let latestState = null;
let lastReportedUrl = '';
let lastUrlStatus = '';
let isMinimized = false;
let aiLanguage = 'No Thanks';
// signinChoice gates the highlight engine on the AWS sign-in landing page.
// null = user has not picked yet (no inner-form blinking)
// 'existing' = highlight existing-account fields
// 'new'      = highlight create-new-account fields
let signinChoice = null;

function isAggressivePage(url) {
  const low = url.toLowerCase();
  // Render overlay on signin/signup pages too — that is exactly where the
  // sign-in vs sign-up picker lives.
  return (
    low.includes('aws.amazon.com/console') ||
    low.includes('console.aws.amazon.com') ||
    low.includes('signin.aws.amazon.com') ||
    low.includes('signup.aws.amazon.com') ||
    low.includes('portal.aws.amazon.com')
  );
}

function reportUrlIfChanged(url, urlStatus, profileId) {
  if (websocket?.readyState !== 1) return;
  if (url === lastReportedUrl && urlStatus === lastUrlStatus) return;
  lastReportedUrl = url;
  lastUrlStatus = urlStatus;
  websocket.send(JSON.stringify({
    type: 'user.url_report',
    url,
    urlStatus,
    profileId,
  }));
}

async function renderGuideOverlay(page, state) {
  if (!page || page.isClosed()) return;
  const currentUrl = page.url();

  if (!isAggressivePage(currentUrl)) {
    try { await page.evaluate(() => { const h = document.getElementById('workshop-host'); if (h) h.remove(); }); } catch (e) {}
    return;
  }

  const isLaunchPage = currentUrl.includes('#LaunchInstances:');
  const currentStep = state?.currentStep || state?.steps?.[state?.currentStepIndex] || null;
  const expectedProfile = currentStep?.expectedProfile || '';
  const urlStatus = expectedUrlMatcher(expectedProfile, currentUrl);
  const computedHighlights = getHighlightsForUrl(currentUrl, { signinChoice });
  // Only blink when the participant is actually at the correct link. If they
  // wandered off, the wrong-link banner takes over and we suppress highlights.
  const highlightsToApply = urlStatus === 'wrong' ? [] : computedHighlights.selectors.map((sel) => ({ selector: sel }));
  const showSigninPicker = computedHighlights.id === 'signin-choice' && signinChoice === null;

  reportUrlIfChanged(currentUrl, urlStatus, computedHighlights.id);

  try {
    await page.evaluate((payload) => {
      const {
        stepTitle,
        stepDesc,
        isLaunchPage,
        isMinimized,
        aiLanguage,
        highlights,
        urlStatus,
        showSigninPicker,
        signinChoice,
      } = payload;

      // STYLES
      if (!document.getElementById('w-style')) {
        const s = document.createElement('style');
        s.id = 'w-style';
        s.textContent = `
          @keyframes blink { 0%, 100% { box-shadow: 0 0 0 2px #0ea5e9, 0 0 0 0 rgba(14,165,233,0.7); } 50% { box-shadow: 0 0 0 2px #0ea5e9, 0 0 0 12px rgba(14,165,233,0); } }
          [data-w-hl] { outline: 3px solid #0ea5e9 !important; animation: blink 1.5s infinite !important; border-radius: 4px !important; }
        `;
        document.head.appendChild(s);
      }

      // HIGHLIGHTS — clear, then apply only if list is non-empty
      document.querySelectorAll('[data-w-hl]').forEach(el => el.removeAttribute('data-w-hl'));
      if (Array.isArray(highlights) && highlights.length > 0) {
        highlights.forEach(h => { try { document.querySelectorAll(h.selector).forEach(el => el.setAttribute('data-w-hl', 'true')); } catch(e) {} });
      }

      // OVERLAY
      let host = document.getElementById('workshop-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'workshop-host';
        document.body.appendChild(host);
        host.attachShadow({ mode: 'open' });
      }

      const isWrong = urlStatus === 'wrong';
      const isCorrect = urlStatus === 'correct';
      const banner = isWrong
        ? { color: '#b91c1c', bg: '#fee2e2', text: 'Wrong link — go back' }
        : isCorrect
          ? { color: '#166534', bg: '#dcfce7', text: 'You are at the correct link' }
          : { color: '#475569', bg: '#e2e8f0', text: 'Checking your location…' };

      // Oblong button:
      //   wrong  → clickable Go back
      //   correct/unknown → clickable Ask for help
      const oblong = isWrong
        ? { id: 'go-back', label: 'Go back', bg: '#b91c1c' }
        : { id: 'ask-help', label: 'Ask for help', bg: '#ea580c' };

      const shadow = host.shadowRoot;
      shadow.innerHTML = `
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
          <h4 style="margin:0;">${stepTitle || 'AWS Guide'}</h4>
          <p style="font-size:0.75rem; color:#475569; margin:6px 0;">${stepDesc || 'Connecting...'}</p>

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
          <button class="btn primary" id="${oblong.id}" style="background:${oblong.bg};">${oblong.label}</button>
        </div>
      `;

      shadow.querySelector('#min').onclick = () => window.__toggleMin();
      shadow.querySelector('#expand').onclick = () => window.__toggleMin();

      const askHelp = shadow.querySelector('#ask-help');
      if (askHelp) askHelp.onclick = () => window.__askHelp();
      const goBack = shadow.querySelector('#go-back');
      if (goBack) goBack.onclick = () => window.__goBack();

      shadow.querySelectorAll('.btn[data-l]').forEach(b => b.onclick = () => window.__setLang(b.dataset.l));
      shadow.querySelectorAll('.opt[data-choice]').forEach(b => b.onclick = () => window.__setSigninChoice(b.dataset.choice));
      const aiEx = shadow.querySelector('#ai-ex');
      if (aiEx) aiEx.onclick = () => window.__requestAi('explain');
      const aiTr = shadow.querySelector('#ai-tr');
      if (aiTr) aiTr.onclick = () => window.__requestAi('translate');
    }, {
      stepTitle: currentStep?.title,
      stepDesc: currentStep?.description,
      isLaunchPage,
      isMinimized,
      aiLanguage,
      highlights: highlightsToApply,
      urlStatus,
      showSigninPicker,
      signinChoice,
    });
  } catch (e) {}
}

async function run() {
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  awsPage = await context.newPage();

  // EXPOSE
  await awsPage.exposeFunction('__toggleMin', () => { isMinimized = !isMinimized; });
  await awsPage.exposeFunction('__askHelp', () => {
    if (websocket?.readyState !== 1) return;
    const currentStep = latestState?.currentStep || null;
    websocket.send(JSON.stringify({
      type: 'user.help_request',
      requestId: `help-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      participantId: userId,
      stepId: currentStep?.id ?? null,
      stepTitle: currentStep?.title ?? '',
    }));
  });
  await awsPage.exposeFunction('__goBack', async () => {
    try { if (awsPage && !awsPage.isClosed()) await awsPage.goBack(); } catch (e) {}
  });
  await awsPage.exposeFunction('__setLang', (l) => {
    aiLanguage = l;
    if (websocket?.readyState === 1) {
      websocket.send(JSON.stringify({ type: 'user.translation_lang', language: l }));
    }
  });
  await awsPage.exposeFunction('__setSigninChoice', (choice) => {
    if (choice !== 'iam' && choice !== 'root' && choice !== 'new') return;
    signinChoice = choice;
    if (websocket?.readyState === 1) {
      websocket.send(JSON.stringify({ type: 'user.signin_choice', choice }));
    }
  });
  await awsPage.exposeFunction('__requestAi', async (mode) => {
    try {
      const content = await awsPage.evaluate(() => document.body.innerText.slice(0, 3000));
      if (websocket?.readyState === 1) websocket.send(JSON.stringify({ type: 'user.ai_request', mode, language: aiLanguage, content }));
    } catch (e) {}
  });

  await awsPage.exposeFunction('__logStatus', (info) => {
    if (info.type === 'HB' && info.url !== lastReportedUrl) { console.log(`[NAV] ${info.url}`); }
  });

  // Reset signinChoice whenever the user actually leaves the sign-in landing.
  awsPage.on('framenavigated', (frame) => {
    if (frame !== awsPage.mainFrame()) return;
    const url = frame.url();
    if (!url.includes('signin.aws.amazon.com') && !url.includes('signup.aws.amazon.com')) {
      signinChoice = null;
    }
  });

  // RELENTLESS LOOP
  setInterval(async () => {
    try {
      if (awsPage && !awsPage.isClosed()) {
        await awsPage.evaluate((u) => { if (typeof window.__logStatus === 'function') window.__logStatus({ type: 'HB', url: u }); }, awsPage.url());
        await renderGuideOverlay(awsPage, latestState);
      }
    } catch (e) {}
  }, 1000);

  // WEBSOCKET
  const connectWS = () => {
    websocket = new WebSocket(presenterWs);
    websocket.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type === 'workshop_state') latestState = m.state; } catch(err) {} };
    websocket.onopen = () => websocket.send(JSON.stringify({ type: 'hello', role: 'user', participantId: userId }));
    websocket.onclose = () => setTimeout(connectWS, 2000);
  };
  connectWS();

  await awsPage.goto('https://aws.amazon.com/console/', { waitUntil: 'domcontentloaded' });
}

run().catch(e => process.exit(1));
