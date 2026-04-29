import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://aws.amazon.com/console/', { waitUntil: 'networkidle' });

  const result = await page.evaluate(() => {
    // This replicates the guide's logic
    const selector = 'main a[href="https://console.aws.amazon.com/"]';
    const elements = Array.from(document.querySelectorAll(selector));
    const best = elements.find(e => {
        const r = e.getBoundingClientRect();
        // Visible and interactive size
        return r.width > 20 && r.height > 20;
    });
    
    if (!best) return 'No visible element found with standard CSS selector';
    
    return {
        tag: best.tagName,
        text: best.innerText.trim(),
        href: best.href,
        rect: { x: best.getBoundingClientRect().x, y: best.getBoundingClientRect().y, width: best.getBoundingClientRect().width, height: best.getBoundingClientRect().height }
    };
  });

  console.log('--- CROSS-REFERENCE DATA ---');
  console.log('User Clicked Position: { x: 80, y: 412.6, width: 102.5, height: 44 }');
  console.log('Current Match Position:', JSON.stringify(result, null, 2));
  
  await browser.close();
}

run();
