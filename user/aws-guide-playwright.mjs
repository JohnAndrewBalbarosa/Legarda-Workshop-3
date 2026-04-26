import { spawn } from 'node:child_process';
import path from 'node:path';

const host = process.env.USER_HOST || process.env.HOST || '192.168.1.244';
const presenterWs = process.env.PRESENTER_WS || 'ws://192.168.1.244:5050';
const userId = process.env.USER_ID || 'user-1';

let browser = null;
let websocket = null;
let awsPage = null;
let latestState = null;
let lastLoggedUrl = '';
let isMinimized = false;
let aiLanguage = 'No Thanks';

function isAggressivePage(url) {
  const low = url.toLowerCase();
  if (low.includes('signin') || low.includes('signup') || low.includes('/auth')) return false;
  return low.includes('aws.amazon.com/console') || low.includes('console.aws.amazon.com');
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
  const highlights = state?.highlights || [];

  try {
    await page.evaluate((payload) => {
      const { stepTitle, stepDesc, isLaunchPage, isMinimized, aiLanguage, highlights } = payload;
      
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

      // HIGHLIGHTS
      document.querySelectorAll('[data-w-hl]').forEach(el => el.removeAttribute('data-w-hl'));
      if (highlights) highlights.forEach(h => { try { document.querySelectorAll(h.selector).forEach(el => el.setAttribute('data-w-hl', 'true')); } catch(e) {} });

      // OVERLAY
      let host = document.getElementById('workshop-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'workshop-host';
        document.body.appendChild(host);
        host.attachShadow({ mode: 'open' });
      }

      const shadow = host.shadowRoot;
      shadow.innerHTML = `
        <style>
          :host { position: fixed; top: 12px; right: 12px; z-index: 2147483647; font-family: sans-serif; }
          .circle { width: 50px; height: 50px; background: #0284c7; border-radius: 50%; display: ${isMinimized ? 'flex' : 'none'}; align-items: center; justify-content: center; color: white; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid white; font-weight: bold; }
          .panel { width: 330px; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); border: 1px solid #bae6fd; padding: 14px; display: ${isMinimized ? 'none' : 'block'}; color: #1e293b; }
          .btn { padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 0.75rem; font-weight: bold; cursor: pointer; background: white; }
          .btn.active { background: #0284c7; color: white; }
          .btn.primary { background: #0284c7; color: white; border: none; width: 100%; margin-top: 10px; }
        </style>
        <div class="circle" id="expand">AWS</div>
        <div class="panel">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="font-size:0.6rem; color:#0284c7; font-weight:bold;">WORKSHOP ACTIVE</span>
            <button id="min" style="background:none; border:none; text-decoration:underline; font-size:0.6rem; color:#64748b; cursor:pointer;">Minimize</button>
          </div>
          <h4 style="margin:0;">${stepTitle || 'AWS Guide'}</h4>
          <p style="font-size:0.75rem; color:#475569; margin:6px 0;">${stepDesc || 'Connecting...'}</p>
          
          <div style="display: ${isLaunchPage ? 'block' : 'none'}; margin: 10px 0; border: 1px dashed #cbd5e1; padding: 8px; border-radius: 8px; background: #f8fafc;">
            <div style="font-size:0.7rem; font-weight:bold; margin-bottom:6px;">AI ASSISTANT</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">
              <div class="btn ${aiLanguage === 'Tagalog' ? 'active' : ''}" data-l="Tagalog">Tagalog</div>
              <div class="btn ${aiLanguage === 'Taglish' ? 'active' : ''}" data-l="Taglish">Taglish</div>
              <button class="btn" id="ai-ex">Explain</button>
              <button class="btn" id="ai-tr">Translate</button>
            </div>
          </div>
          <button class="btn primary" id="done">Done</button>
        </div>
      `;

      shadow.querySelector('#min').onclick = () => window.__toggleMin();
      shadow.querySelector('#expand').onclick = () => window.__toggleMin();
      shadow.querySelector('#done').onclick = () => window.__sendComplete();
      shadow.querySelectorAll('.btn[data-l]').forEach(b => b.onclick = () => window.__setLang(b.dataset.l));
      shadow.querySelector('#ai-ex').onclick = () => window.__requestAi('explain');
      shadow.querySelector('#ai-tr').onclick = () => window.__requestAi('translate');
    }, {
      stepTitle: currentStep?.title, stepDesc: currentStep?.description, isLaunchPage,
      isMinimized, aiLanguage, highlights
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
  await awsPage.exposeFunction('__sendComplete', () => { if (websocket?.readyState === 1) websocket.send(JSON.stringify({ type: 'user.step_complete' })); });
  await awsPage.exposeFunction('__setLang', (l) => { aiLanguage = l; });
  await awsPage.exposeFunction('__requestAi', async (mode) => {
    try {
      const content = await awsPage.evaluate(() => document.body.innerText.slice(0, 3000));
      if (websocket?.readyState === 1) websocket.send(JSON.stringify({ type: 'user.ai_request', mode, language: aiLanguage, content }));
    } catch (e) {}
  });

  await awsPage.exposeFunction('__logStatus', (info) => {
    if (info.type === 'HB' && info.url !== lastLoggedUrl) { console.log(`[NAV] ${info.url}`); lastLoggedUrl = info.url; }
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
