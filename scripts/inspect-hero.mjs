// One-shot inspector: open https://aws.amazon.com/console/ and dump the
// hero "Sign in" element's ancestry so we can pick a stable selector.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(fileURLToPath(new URL('../interaction-recorder/package.json', import.meta.url)));
const { chromium } = require('playwright');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://aws.amazon.com/console/', { waitUntil: 'domcontentloaded' });

const candidates = await page.evaluate(() => {
  const all = [...document.querySelectorAll('a, button, span')];
  const matches = all
    .filter((el) => /^Sign in$/i.test((el.innerText || '').trim()) ||
                    /^Sign in to the Console/i.test((el.innerText || '').trim()))
    .map((el) => {
      const rect = el.getBoundingClientRect();
      const ancestors = [];
      let p = el;
      for (let i = 0; i < 6 && p; i++) {
        ancestors.push({
          tag: p.tagName.toLowerCase(),
          id: p.id || null,
          cls: p.className && typeof p.className === 'string' ? p.className.slice(0, 200) : null,
          role: p.getAttribute?.('role') || null,
          dataAttrs: p.getAttributeNames?.()
            .filter((n) => n.startsWith('data-'))
            .reduce((a, n) => ({ ...a, [n]: p.getAttribute(n) }), {}) || {},
          href: p.getAttribute?.('href') || null,
          ariaLabel: p.getAttribute?.('aria-label') || null,
        });
        p = p.parentElement;
      }
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || '').trim().slice(0, 60),
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        ancestors,
      };
    });
  return matches;
});

console.log(JSON.stringify(candidates, null, 2));
await browser.close();
