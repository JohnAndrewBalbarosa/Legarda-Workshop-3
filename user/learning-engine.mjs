import { chromium } from 'playwright';
import fs from 'fs';

async function run() {
  console.log('--- LEARNING MODE ACTIVE ---');
  console.log('1. Navigate to AWS Console.');
  console.log('2. Click the buttons you want highlighted.');
  console.log('3. I will capture the EXACT fingerprints.');

  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  await page.exposeFunction('__logBehavior', (data) => {
    console.log('\n[LEARNED BEHAVIOR]');
    console.log(JSON.stringify(data, null, 2));
    // Save to a knowledge file for the re-generation phase
    fs.appendFileSync('user/behavior_log.jsonl', JSON.stringify(data) + '\n');
  });

  await page.addInitScript(() => {
    window.addEventListener('mousedown', (e) => {
      // Find the interactive element
      let el = e.target;
      while (el && el.tagName !== 'A' && el.tagName !== 'BUTTON' && el.tagName !== 'INPUT') {
        el = el.parentElement;
      }
      if (!el) el = e.target;

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      window.__logBehavior({
        url: window.location.href,
        tagName: el.tagName,
        text: el.innerText?.trim() || el.value || '',
        id: el.id,
        classes: Array.from(el.classList),
        attributes: Object.fromEntries(Array.from(el.attributes).map(a => [a.name, a.value])),
        rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        style: {
          color: style.color,
          backgroundColor: style.backgroundColor,
          borderRadius: style.borderRadius,
          fontSize: style.fontSize
        },
        // Capture parent breadcrumbs for scoping
        path: (() => {
          let p = [];
          let curr = el;
          while (curr && p.length < 5) {
            p.push(curr.tagName.toLowerCase() + (curr.id ? `#${curr.id}` : ''));
            curr = curr.parentElement;
          }
          return p.reverse().join(' > ');
        })()
      });
    }, true);
  });

  await page.goto('https://aws.amazon.com/console/');
  
  // Keep the script alive
  await new Promise(() => {});
}

run();
