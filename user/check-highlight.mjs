import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://aws.amazon.com/console/', { waitUntil: 'networkidle' });

  // Wait a moment for our overlay script to run
  await page.addInitScript(() => {
    // Inject the same logic used in the guide to see what it picks
    window.__checkHighlight = () => {
      const el = document.querySelector('[data-w-hl="true"]');
      if (!el) {
        // If not found yet, try to simulate the guide logic
        const selector = 'main a[href="https://console.aws.amazon.com/"]:visible';
        const elements = Array.from(document.querySelectorAll(selector));
        const best = elements.find(e => {
          const r = e.getBoundingClientRect();
          return r.width > 20 && r.height > 20;
        });
        return best ? { 
          foundBySim: true,
          tag: best.tagName,
          text: best.innerText,
          rect: best.getBoundingClientRect(),
          href: best.href 
        } : 'None found';
      }
      return {
        tag: el.tagName,
        text: el.innerText,
        rect: el.getBoundingClientRect(),
        href: el.href
      };
    };
  });

  // Since we can't easily hook into the ALREADY running browser, 
  // we will just run the selection logic on a fresh page to see what it resolves to.
  const result = await page.evaluate(() => {
    const selector = 'main a[href="https://console.aws.amazon.com/"]:visible';
    const elements = Array.from(document.querySelectorAll(selector));
    const best = elements.find(e => {
        const r = e.getBoundingClientRect();
        return r.width > 20 && r.height > 20;
    });
    if (!best) return 'No element matches main a[href="https://console.aws.amazon.com/"]:visible';
    return {
        tag: best.tagName,
        text: best.innerText.trim(),
        href: best.href,
        rect: { x: best.getBoundingClientRect().x, y: best.getBoundingClientRect().y, width: best.getBoundingClientRect().width, height: best.getBoundingClientRect().height }
    };
  });

  console.log('--- CURRENT HIGHLIGHT RESOLUTION ---');
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

run();
