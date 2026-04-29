import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://aws.amazon.com/console/', { waitUntil: 'networkidle' });

  const structure = await page.evaluate(() => {
    // Find the specific button by its stable href
    const target = document.querySelector('a[href="https://console.aws.amazon.com/"]');
    if (!target) return 'Target not found';

    const getSelector = (el) => {
      let path = [];
      while (el.parentElement) {
        let tag = el.tagName.toLowerCase();
        let id = el.id ? `#${el.id}` : '';
        // Skip hashed classes, look for stable ones or just tags
        let classes = Array.from(el.classList).filter(c => !c.includes('_')).map(c => `.${c}`).join('');
        path.unshift(tag + id + classes);
        el = el.parentElement;
        if (path.length > 5) break; // Don't go too deep
      }
      return path.join(' > ');
    };

    return {
      text: target.innerText,
      href: target.href,
      scopedPath: getSelector(target),
      parentTag: target.parentElement.tagName,
      parentClasses: target.parentElement.className
    };
  });

  console.log(JSON.stringify(structure, null, 2));
  await browser.close();
}

run();
