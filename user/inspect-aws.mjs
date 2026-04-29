import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to AWS Console home...');
  await page.goto('https://aws.amazon.com/console/', { waitUntil: 'networkidle' });

  const elements = await page.evaluate(() => {
    const results = [];
    // Find all links and buttons with "Sign In"
    const items = document.querySelectorAll('a, button, span');
    items.forEach(el => {
      const text = el.innerText || '';
      if (text.toLowerCase().includes('sign in')) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          results.push({
            tag: el.tagName,
            text: text.trim(),
            id: el.id,
            className: el.className,
            href: el.href || null,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            computedStyle: {
              backgroundColor: window.getComputedStyle(el).backgroundColor,
              borderRadius: window.getComputedStyle(el).borderRadius,
              color: window.getComputedStyle(el).color,
              display: window.getComputedStyle(el).display
            }
          });
        }
      }
    });
    return results;
  });

  console.log('--- FOUND ELEMENTS ---');
  console.log(JSON.stringify(elements, null, 2));
  await browser.close();
}

run();
