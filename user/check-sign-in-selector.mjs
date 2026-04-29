import { chromium } from 'playwright';

async function run() {
  console.log('🚀 Launching Diagnostic Browser...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('🌐 Navigating to AWS Homepage...');
  await page.goto('https://aws.amazon.com/console/', { waitUntil: 'networkidle' });

  console.log('🔍 Analyzing Selectors...');

  const selectors = [
    'div > div > div > div > a[href*="console.aws.amazon.com"]',
    'main a[href*="console.aws.amazon.com"]',
    'a[href*="console.aws.amazon.com"]'
  ];

  const results = await page.evaluate((selList) => {
    const report = [];
    selList.forEach(selector => {
      const elements = Array.from(document.querySelectorAll(selector));
      elements.forEach((el, index) => {
        // Highlight them visually so the user can see
        el.style.outline = '5px solid red';
        el.style.outlineOffset = '5px';
        
        const rect = el.getBoundingClientRect();
        report.push({
          selector,
          index,
          text: el.innerText.trim(),
          isVisible: rect.width > 0 && rect.height > 0,
          location: `x: ${rect.x}, y: ${rect.y}`,
          tag: el.tagName
        });
      });
    });
    return report;
  }, selectors);

  console.log('\n--- DIAGNOSTIC REPORT ---');
  if (results.length === 0) {
    console.log('❌ NO ELEMENTS FOUND with any selector.');
  } else {
    results.forEach(res => {
      console.log(`[${res.isVisible ? 'FOUND' : 'HIDDEN'}] Tag: ${res.tag} | Selector: ${res.selector}`);
      console.log(`   Text: "${res.text}"`);
      console.log(`   Location: ${res.location}`);
      console.log('-------------------------');
    });
  }

  console.log('\nCheck the browser window. Red outlines show what the selectors matched.');
  console.log('Keeping browser open for 30 seconds...');
  await new Promise(r => setTimeout(r, 30000));
  await browser.close();
}

run();
