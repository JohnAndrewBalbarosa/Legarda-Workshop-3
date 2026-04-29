import { chromium } from 'playwright';

async function run() {
  console.log('🚀 ULTIMATE SEARCH: Using Playwright Locators...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://us-east-1.console.aws.amazon.com/ec2/home', { waitUntil: 'networkidle' });

  // Playwright's smart locators can find elements even if they are tricky
  const searchBar = page.locator('input#awsc-concierge-input, input[placeholder="Search"], input[aria-label="Search"]').first();

  try {
    await searchBar.waitFor({ timeout: 10000 });
    const isVisible = await searchBar.isVisible();
    
    if (isVisible) {
      console.log('✅ FOUND IT using Playwright Locators!');
      await searchBar.evaluate(el => {
        el.style.outline = '10px solid magenta';
        el.style.outlineOffset = '5px';
      });
      const box = await searchBar.boundingBox();
      console.log('📍 Location:', box);
    } else {
      console.log('❌ Locator found it but it is not visible.');
    }
  } catch (e) {
    console.log('❌ Timeout: Playwright could not find the search bar. It might require an active session.');
  }

  await new Promise(r => setTimeout(r, 10000));
  await browser.close();
}

run();
