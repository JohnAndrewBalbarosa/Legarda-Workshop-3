import { chromium } from 'playwright';

async function run() {
  console.log('🔍 Searching for the AWS Search Bar...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Susubukan nating hanapin sa EC2 dashboard since nandoon ka
  await page.goto('https://us-east-1.console.aws.amazon.com/ec2/home', { waitUntil: 'networkidle' });

  const found = await page.evaluate(() => {
    const searchBar = document.querySelector('input#awsc-concierge-input') || 
                      document.querySelector('[data-testid="awsc-concierge-input"]');
    
    if (searchBar) {
      searchBar.style.outline = '10px solid magenta';
      searchBar.style.outlineOffset = '5px';
      searchBar.scrollIntoView();
      return {
        id: searchBar.id,
        placeholder: searchBar.placeholder,
        rect: searchBar.getBoundingClientRect()
      };
    }
    return null;
  });

  if (found) {
    console.log('✅ FOUND IT!');
    console.log(`🆔 ID: ${found.id}`);
    console.log(`📝 Placeholder: "${found.placeholder}"`);
    console.log(`📍 Location: x=${found.rect.x}, y=${found.rect.y}`);
  } else {
    console.log('❌ Search bar not found in this specific view.');
  }

  console.log('\nNaka-outline na ng MAGENTA ang search bar sa browser window.');
  await new Promise(r => setTimeout(r, 15000));
  await browser.close();
}

run();
