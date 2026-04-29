import { chromium } from 'playwright';

async function run() {
  console.log('🚀 Opening Live AWS Session...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://aws.amazon.com/console/', { waitUntil: 'domcontentloaded' });
  
  console.log('🌐 Browser is open. Waiting for user interaction...');
  // Keep process alive
  await new Promise(() => {}); 
}

run().catch(e => console.error(e));
