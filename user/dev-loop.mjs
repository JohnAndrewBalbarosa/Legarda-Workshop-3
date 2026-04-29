import { chromium } from 'playwright';
import WebSocket from 'ws';

const PRESENTER_WS = 'ws://127.0.0.1:5050';
let ws, browser, page, currentStep, allSteps;

async function start() {
  console.log('--- STARTING AGGRESSIVE DEV LOOP ---');
  try {
    browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
    const context = await browser.newContext({ viewport: null });
    page = await context.newPage();

    await page.exposeFunction('__devLog', (data) => {
      console.log('\n[USER CLICKED]', JSON.stringify(data, null, 2));
    });

    await page.exposeFunction('__sendComplete', () => {
      if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'user.step_complete' }));
    });

    await page.addInitScript(() => {
      setInterval(() => {
        const step = window.__currentStep;
        if (!step) return;

        if (!document.getElementById('w-style')) {
          const s = document.createElement('style');
          s.id = 'w-style';
          s.innerHTML = `
            @keyframes w-blink { 0% { outline: 4px solid #f97316; outline-offset: 2px; } 50% { outline: 4px solid transparent; } 100% { outline: 4px solid #f97316; } }
            [data-w-hl="true"] { animation: w-blink 1.2s infinite !important; z-index: 1000000 !important; position: relative !important; }
            #w-overlay { position: fixed; top: 20px; right: 20px; z-index: 2147483647; background: white; padding: 15px; border-radius: 10px; box-shadow: 0 5px 25px rgba(0,0,0,0.3); border: 2px solid #f97316; width: 250px; font-family: sans-serif; }
            .w-btn { background: #f97316; color: white; border: none; padding: 8px; width: 100%; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 10px; }
          `;
          document.head.appendChild(s);
        }

        document.querySelectorAll('[data-w-hl]').forEach(el => el.removeAttribute('data-w-hl'));
        (step.highlightSelectors || []).forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            if (el.getBoundingClientRect().width > 0) el.setAttribute('data-w-hl', 'true');
          });
        });

        let overlay = document.getElementById('w-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'w-overlay';
          document.body.appendChild(overlay);
        }
        overlay.innerHTML = `
          <div style="font-size: 10px; color: #f97316; font-weight: bold;">WORKSHOP ACTIVE</div>
          <div style="font-size: 16px; margin: 5px 0; font-weight: bold;">${step.title}</div>
          <div style="font-size: 12px; color: #4b5563;">${step.description}</div>
          <button class="w-btn" onclick="window.__sendComplete()">Done</button>
        `;
      }, 500);

      window.addEventListener('mousedown', (e) => {
        const el = e.target.closest('a, button, input') || e.target;
        window.__devLog({ tag: el.tagName, text: el.innerText?.slice(0, 30), href: el.href });
      }, true);
    });

    const connectWS = () => {
      ws = new WebSocket(PRESENTER_WS);
      ws.on('open', () => {
        console.log('Connected to Presenter.');
        ws.send(JSON.stringify({ type: 'hello', role: 'user', participantId: 'dev-user' }));
        ws.send(JSON.stringify({ type: 'request_state' }));
      });
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'workshop_state' || msg.type === 'hello_ack') {
          const state = msg.state || msg.state;
          currentStep = state.currentStep;
          page.evaluate((s) => { window.__currentStep = s; }, currentStep).catch(() => {});
        }
      });
      ws.on('error', () => {
        console.log('Presenter not ready. Retrying in 2s...');
        setTimeout(connectWS, 2000);
      });
    };
    connectWS();

    await page.goto('https://aws.amazon.com/console/', { waitUntil: 'commit', timeout: 60000 });
  } catch (err) {
    console.error('CRITICAL ERROR:', err);
  }
}
start();
