// Probe: load the Workshop Guide extension into Chromium via Playwright,
// navigate to aws.amazon.com/console/, and report what the highlight engine
// actually marks. Read-only — does not log into anything.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const playwrightPkg = pathToFileURL(path.join(repoRoot, 'user', 'node_modules', 'playwright', 'index.mjs')).href;
const { chromium } = await import(playwrightPkg);
const extensionPath = path.join(repoRoot, 'extension');
const profileDir = path.join(repoRoot, '.tmp', 'extension-profile');
const screenshotDir = path.join(repoRoot, '.tmp', 'extension-shots');
mkdirSync(profileDir, { recursive: true });
mkdirSync(screenshotDir, { recursive: true });

const TARGET_URL = process.env.TARGET_URL || 'https://aws.amazon.com/console/';
const PRESENTER_WS = process.env.PRESENTER_WS || 'ws://127.0.0.1:5050';

console.log(`[probe] launching Chromium with extension at ${extensionPath}`);
console.log(`[probe] presenter WS = ${PRESENTER_WS}`);

const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chromium',
  headless: false,
  viewport: { width: 1440, height: 900 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

const [page] = context.pages().length ? context.pages() : [await context.newPage()];

page.on('console', (msg) => {
  const t = msg.text();
  if (/workshop|highlight|presenter|profile/i.test(t)) {
    console.log(`[page:${msg.type()}] ${t}`);
  }
});

console.log(`[probe] navigating to ${TARGET_URL}`);
await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(4000); // give content script + WS state a beat

const report = await page.evaluate(() => {
  const ripples = Array.from(document.querySelectorAll('[data-w-hl]'));
  const allSignIn = Array.from(document.querySelectorAll('a, button')).filter(
    (el) => /^\s*sign\s*in/i.test(el.innerText || '')
  );
  return {
    title: document.title,
    url: location.href,
    rippleCount: ripples.length,
    ripples: ripples.slice(0, 6).map((el) => ({
      tag: el.tagName,
      text: (el.innerText || '').slice(0, 80),
      cls: el.className,
      href: el.getAttribute('href'),
    })),
    signInCandidates: allSignIn.slice(0, 8).map((el) => ({
      tag: el.tagName,
      text: (el.innerText || '').slice(0, 80),
      cls: typeof el.className === 'string' ? el.className.slice(0, 120) : '',
      href: el.getAttribute('href'),
      hasRigelAnalytics: el.hasAttribute('data-rigel-analytics'),
      rigelVariant: (el.getAttribute('data-rigel-analytics') || '').includes('"variant":"primary"'),
      insideNav: !!el.closest('nav, header li'),
    })),
  };
});

console.log('[probe] report:');
console.log(JSON.stringify(report, null, 2));

const shotPath = path.join(screenshotDir, 'aws-home.png');
await page.screenshot({ path: shotPath, fullPage: false });
console.log(`[probe] screenshot saved to ${shotPath}`);

await page.waitForTimeout(2000);
await context.close();
console.log('[probe] done');
