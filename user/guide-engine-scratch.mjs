import { chromium } from 'playwright';
import WebSocket from 'ws';

const PRESENTER_WS = process.env.PRESENTER_WS || 'ws://127.0.0.1:5050';
let ws;
let browser;
let awsPage;
let currentStep = null;
let allSteps = [];

async function start() {
  console.log('--- STARTING SMART URL-DRIVEN ENGINE ---');
  
  try {
    console.log('Launching browser...');
    browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
    const context = await browser.newContext({ viewport: null });
    awsPage = await context.newPage();
    console.log('Browser ready.');
  } catch (err) {
    console.error('CRITICAL: Failed to launch browser:', err);
    process.exit(1);
  }

  console.log(`Connecting to Presenter WebSocket: ${PRESENTER_WS}`);
  ws = new WebSocket(PRESENTER_WS);

  ws.on('open', () => {
    console.log('Connected to Presenter server.');
    ws.send(JSON.stringify({ type: 'hello', role: 'user', participantId: 'user-1' }));
    ws.send(JSON.stringify({ type: 'request_state' }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'workshop_state') {
          allSteps = msg.state.steps || [];
          currentStep = msg.state.currentStep;
          console.log(`[STATE] Step: ${currentStep?.id || 'none'}`);
      }
    } catch (e) {}
  });

  // URL MONITOR & AUTO-ADVANCE
  setInterval(async () => {
    if (!awsPage || !ws || ws.readyState !== 1) return;
    try {
        const url = awsPage.url();
        
        const matchingStep = allSteps.find(s => url.includes(s.urlPattern));
        if (matchingStep && (!currentStep || currentStep.id !== matchingStep.id)) {
            console.log(`[AUTO-ADVANCE] Match: ${matchingStep.id}`);
            ws.send(JSON.stringify({ type: 'user.request_step', stepId: matchingStep.id }));
        }

        const shouldHighlight = currentStep && url.includes(currentStep.urlPattern);
        await awsPage.evaluate(({ active, selectors }) => {
            window.__highlights = active ? selectors : [];
        }, { active: shouldHighlight, selectors: currentStep?.highlightSelectors || [] });
    } catch (e) {}
  }, 1000);

  // INJECT HIGHLIGHTER
  await awsPage.addInitScript(() => {
    setInterval(() => {
      const selectors = window.__highlights || [];
      document.querySelectorAll('[data-w-hl]').forEach(el => el.removeAttribute('data-w-hl'));
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (el.getBoundingClientRect().width > 0) el.setAttribute('data-w-hl', 'true');
        });
      });
      if (!document.getElementById('w-style')) {
        const s = document.createElement('style');
        s.id = 'w-style';
        s.innerHTML = `
          @keyframes w-blink { 
            0% { outline: 4px solid #f97316; outline-offset: 2px; } 
            50% { outline: 4px solid transparent; } 
            100% { outline: 4px solid #f97316; } 
          }
          [data-w-hl="true"] { 
            animation: w-blink 1.2s infinite !important; 
            z-index: 10000000 !important; 
            position: relative !important; 
          }
        `;
        document.head.appendChild(s);
      }
    }, 500);
  });

  console.log('Navigating to AWS Console...');
  try {
    // We use a looser navigation wait because of the sign-in redirect
    await awsPage.goto('https://us-east-1.console.aws.amazon.com/console/home', { waitUntil: 'commit' });
  } catch (e) {
    console.log('Navigation redirected/aborted - normal for Sign-in flow.');
  }
}

start();
