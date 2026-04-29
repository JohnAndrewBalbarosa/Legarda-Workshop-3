import { chromium } from 'playwright';

async function run() {
  console.log('🚀 ULTIMATE SEARCH: Discovering AWS Global Search Bar...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // We go to the main console home where the bar is most active
  console.log('🌐 Navigating to AWS Console Home...');
  await page.goto('https://aws.amazon.com/console/', { waitUntil: 'networkidle' });

  // AWS search bar is often lazy-loaded. We wait for the header to be present.
  console.log('⏳ Waiting for Header elements...');
  
  const searchBar = page.locator([
    'input#awsc-concierge-input',
    'input[data-testid="awsc-concierge-input"]',
    'input[aria-label="Search"]',
    'input[placeholder="Search"]'
  ].join(', ')).first();

  try {
    await searchBar.waitFor({ timeout: 15000 });
    console.log('✅ SEARCH BAR LOCATED!');

    // Apply the Flashy Electric Blue Blink
    await searchBar.evaluate(el => {
      // Inject the animation first
      const s = document.createElement('style');
      s.textContent = `
        @keyframes flashy-blink { 
          0% { box-shadow: 0 0 0 0 rgba(0, 216, 255, 0.8); } 
          70% { box-shadow: 0 0 0 15px rgba(0, 216, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 216, 255, 0); }
        }
      `;
      document.head.appendChild(s);
      
      el.style.outline = '4px solid #00d8ff';
      el.style.outlineOffset = '2px';
      el.style.animation = 'flashy-blink 1.2s infinite cubic-bezier(0.66, 0, 0, 1)';
    });

    const details = await searchBar.evaluate(el => ({
      id: el.id,
      tag: el.tagName,
      placeholder: el.placeholder,
      rect: el.getBoundingClientRect()
    }));

    console.log('\n--- ELEMENT DETAILS ---');
    console.log(JSON.stringify(details, null, 2));
    console.log('-----------------------');
    console.log('\nCheck the browser window. The search bar should be FLASHING ELECTRIC BLUE.');

  } catch (e) {
    console.log('❌ FAILED: Search bar not found or timed out.');
    console.log('Note: AWS sometimes hides the search bar if not authenticated.');
  }

  console.log('\nKeeping browser open for 20 seconds...');
  await new Promise(r => setTimeout(r, 20000));
  await browser.close();
}

run();
