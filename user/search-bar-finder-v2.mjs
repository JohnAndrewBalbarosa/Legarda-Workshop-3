import { chromium } from 'playwright';

async function run() {
  console.log('🔍 Advanced Search for AWS Global Search Bar...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://us-east-1.console.aws.amazon.com/ec2/home', { waitUntil: 'networkidle' });

  const found = await page.evaluate(() => {
    // Strategy 1: Test IDs
    let el = document.querySelector('[data-testid="awsc-concierge-input"]');
    
    // Strategy 2: Aria Label
    if (!el) el = document.querySelector('input[aria-label="Search"]');
    
    // Strategy 3: Placeholder
    if (!el) el = document.querySelector('input[placeholder="Search"]');
    
    // Strategy 4: Broad Tag Search
    if (!el) {
        const inputs = Array.from(document.querySelectorAll('input'));
        el = inputs.find(i => i.id.includes('concierge') || i.className.includes('search'));
    }

    if (el) {
      el.style.outline = '10px solid magenta';
      el.style.outlineOffset = '5px';
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        id: el.id,
        placeholder: el.placeholder,
        rect: { x: rect.x, y: rect.y }
      };
    }
    return null;
  });

  if (found) {
    console.log('✅ FOUND IT with Advanced Search!');
    console.log(JSON.stringify(found, null, 2));
  } else {
    console.log('❌ Still not found. AWS might be using a complex Shadow DOM or different structure in this region.');
  }

  await new Promise(r => setTimeout(r, 10000));
  await browser.close();
}

run();
