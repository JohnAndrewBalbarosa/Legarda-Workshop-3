// Walkthrough screenshots ng Workshop Guide Chrome extension.
//
// Assumes the user has the extension code at ./extension. Boots a Playwright-
// driven persistent Chromium context with the extension loaded, configures it
// via the popup, then captures the overlay in the following stages:
//
//   1. extension-popup.png        — configuration popup
//   2. extension-aws-home.png     — overlay on https://aws.amazon.com/console/
//                                   (red ripple on the "Sign in" hero button)
//   3. [PAUSE]                    — script stops; you sign in manually in the
//                                   visible Chromium window. Script auto-resumes
//                                   when it detects console.aws.amazon.com.
//   4. extension-console-home.png — overlay on the AWS console home page
//                                   (highlights the search bar for "EC2")
//   5. extension-ec2-dashboard.png — overlay on the EC2 dashboard
//                                    (highlights the orange Launch instance CTA)
//
// Runs Chromium headful — a window will appear during capture. Run from repo
// root: `npm run screenshots:extension`.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const requireFromUser = createRequire(path.join(ROOT, 'user', 'package.json'));
const requireFromPresenter = createRequire(path.join(ROOT, 'presenter', 'package.json'));
const { chromium } = requireFromUser('playwright');
const WebSocket = requireFromPresenter('ws');

const HOST = '127.0.0.1';
const PORT = 5050;
const BASE_URL = `http://${HOST}:${PORT}`;
const WS_URL = `ws://${HOST}:${PORT}`;
const EXTENSION_DIR = path.join(ROOT, 'extension');
const SCREENSHOTS_DIR = path.join(ROOT, 'docs', 'screenshots');
const USER_DATA_DIR = path.join(os.tmpdir(), `legarda-workshop-extension-profile-${Date.now()}`);

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await wait(250);
  }
  throw new Error(`Presenter did not respond on ${BASE_URL}/health within ${timeoutMs}ms`);
}

function startPresenterServer() {
  const serverPath = path.join(ROOT, 'presenter', 'server.js');
  const child = spawn(process.execPath, [serverPath], {
    cwd: ROOT,
    env: {
      ...process.env,
      PRESENTER_HOST: HOST,
      HOST,
      PRESENTER_PORT: String(PORT),
      PORT: String(PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[presenter] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[presenter] ${chunk}`));
  return child;
}

function openSocket() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function send(socket, payload) {
  socket.send(JSON.stringify(payload));
}

async function seedFakeParticipants() {
  // Same demo state as the dashboard screenshot script — Alice has completed
  // step 0 and is mid-workshop, Bob is behind with an open help request.
  const alice = await openSocket();
  send(alice, { type: 'hello', role: 'user', participantId: 'user-alice', seatLabel: 'A1' });
  await wait(150);

  const bob = await openSocket();
  send(bob, { type: 'hello', role: 'user', participantId: 'user-bob', seatLabel: 'B3' });
  await wait(150);

  const presenterSocket = await openSocket();
  send(presenterSocket, { type: 'hello', role: 'presenter', participantId: 'presenter-main', seatLabel: '' });
  await wait(150);
  send(presenterSocket, { type: 'presenter.advance_step' });
  await wait(200);

  send(alice, { type: 'user.step_complete', participantId: 'user-alice', actionIds: [] });
  await wait(200);

  send(bob, {
    type: 'user.help_request',
    participantId: 'user-bob',
    seatLabel: 'B3',
    note: 'Hindi makita yung "Launch Instance" button.',
  });
  await wait(200);

  return [alice, bob, presenterSocket];
}

function closeSockets(sockets) {
  for (const socket of sockets) {
    try { socket.close(); } catch {}
  }
}

async function getExtensionId(context) {
  // MV3: service worker registration carries the extension ID in its URL.
  let workers = context.serviceWorkers();
  if (workers.length === 0) {
    try {
      const worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
      workers = [worker];
    } catch {
      // fall through; try background pages as a legacy fallback
    }
  }
  for (const worker of workers) {
    const match = worker.url().match(/^chrome-extension:\/\/([a-p]+)\//);
    if (match) return match[1];
  }
  throw new Error('Could not determine extension ID — make sure extension/ has a valid manifest.');
}

async function capturePopup(context, extensionId) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 320, height: 320 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForSelector('#userId');
  await page.fill('#userId', 'user-alice');
  await page.fill('#presenterWs', WS_URL);
  const outputPath = path.join(SCREENSHOTS_DIR, 'extension-popup.png');
  await page.screenshot({ path: outputPath });
  // Persist settings to the extension's storage so the AWS page picks up the
  // configured WS URL and participant ID.
  await page.click('#save');
  await wait(500);
  await page.close();
  return outputPath;
}

async function captureAwsHome(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  try {
    await page.goto('https://aws.amazon.com/console/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (error) {
    console.warn('Could not load aws.amazon.com — likely offline. Skipping extension-aws-home.png.');
    await page.close();
    return null;
  }
  // The overlay is rendered inside a shadow root attached to #workshop-host.
  try {
    await page.waitForSelector('#workshop-host', { timeout: 15000 });
  } catch {
    console.warn('Overlay did not appear within 15s — capturing whatever rendered.');
  }
  // Let the highlight engine settle (MutationObserver, scroll-into-view).
  await wait(3500);
  const outputPath = path.join(SCREENSHOTS_DIR, 'extension-aws-home.png');
  await page.screenshot({ path: outputPath, fullPage: false });
  await page.close();
  return outputPath;
}

// Open a fresh tab on aws.amazon.com/console/ so the user can click "Sign in"
// and complete the flow themselves. Resolves once the page navigates to a
// console.aws.amazon.com URL — i.e. they are signed in.
async function pauseForManualSignIn(context, timeoutMinutes = 10) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('https://aws.amazon.com/console/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

  console.log('\n========================================================');
  console.log(' ACTION REQUIRED — manual sign in');
  console.log('--------------------------------------------------------');
  console.log(' 1. Bumalik ka sa Chromium window na bukas.');
  console.log(' 2. I-click "Sign in" at kumpletuhin ang AWS sign-in.');
  console.log(' 3. Auto-resume yung script kapag nasa console.aws.amazon.com ka na.');
  console.log(`    Timeout: ${timeoutMinutes} minutes.`);
  console.log('========================================================\n');

  const deadline = Date.now() + timeoutMinutes * 60 * 1000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (/console\.aws\.amazon\.com\/console\/home/.test(url) || /console\.aws\.amazon\.com\/?($|\?)/.test(url)) {
      console.log(`Detected signed-in console URL: ${url}`);
      return page;
    }
    await wait(2000);
  }
  throw new Error('Timed out waiting for manual sign in.');
}

// Race a list of selectors and resolve when any of them is visible. The AWS
// console SPA mounts asynchronously after the URL changes, and different
// regions/accounts ship slightly different dashboards — so we accept any of
// several "this page actually rendered" signals.
async function waitForAny(page, selectors, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      try {
        const handle = await page.$(selector);
        if (handle && (await handle.isVisible())) return selector;
      } catch {}
    }
    await wait(500);
  }
  return null;
}

async function captureConsoleHome(page) {
  // The console-home highlight profile targets the concierge search bar — wait
  // until that (or a known dashboard widget) is actually painted before
  // screenshotting, otherwise the SPA loading splash is all we get.
  const hit = await waitForAny(
    page,
    [
      'input#awsc-concierge-input',
      'input[data-testid="awsc-concierge-input"]',
      'input[placeholder="Search"]',
      'input[aria-label="Search"]',
      '[data-testid="recently-visited-services"]',
      'awsui-app-layout',
    ],
    45000,
  );
  if (!hit) {
    console.warn('Console home did not finish rendering within 45s; capturing whatever is on screen.');
  }
  // Give the extension's MutationObserver a couple of cycles to attach the
  // red-ripple data attribute and scroll the search bar into view.
  await wait(2500);
  const outputPath = path.join(SCREENSHOTS_DIR, 'extension-console-home.png');
  await page.screenshot({ path: outputPath, fullPage: false });
  return outputPath;
}

async function captureEc2Dashboard(page) {
  try {
    // 'commit' resolves as soon as navigation starts — much more reliable on
    // slow AWS console pages than 'domcontentloaded', which often misses the
    // window because the SPA never fires a clean DOMContentLoaded.
    await page.goto('https://console.aws.amazon.com/ec2/home', { waitUntil: 'commit', timeout: 60000 });
  } catch (error) {
    console.warn('Could not navigate to EC2 dashboard:', error.message);
    return null;
  }
  // Wait for any EC2-specific UI to actually paint — the Launch instance CTA
  // is the highlight target, but the dashboard tiles and resource summary
  // panels also confirm the page rendered.
  const hit = await waitForAny(
    page,
    [
      'button[data-testid="launch-instance"]',
      'button[data-analytics-funnel-substep="launch-instance"]',
      'a[href*="LaunchInstances"]',
      'awsui-button button',
      '[data-testid="resource-counts"]',
      'h1:has-text("EC2")',
    ],
    60000,
  );
  if (!hit) {
    console.warn('EC2 dashboard did not finish rendering within 60s; capturing whatever is on screen.');
  }
  await wait(3500);
  const outputPath = path.join(SCREENSHOTS_DIR, 'extension-ec2-dashboard.png');
  await page.screenshot({ path: outputPath, fullPage: false });
  return outputPath;
}

async function main() {
  console.log('Starting presenter server...');
  const presenter = startPresenterServer();

  let sockets = [];
  let context = null;

  try {
    await waitForHealth();
    console.log('Presenter is up. Seeding fake participants...');
    sockets = await seedFakeParticipants();

    console.log('Launching Chromium with the extension loaded...');
    context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      viewport: { width: 1440, height: 900 },
      args: [
        `--disable-extensions-except=${EXTENSION_DIR}`,
        `--load-extension=${EXTENSION_DIR}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const extensionId = await getExtensionId(context);
    console.log(`Extension ID: ${extensionId}`);

    const generated = [];

    console.log('Capturing extension popup...');
    generated.push(await capturePopup(context, extensionId));

    console.log('Capturing overlay on https://aws.amazon.com/console/ ...');
    const awsShot = await captureAwsHome(context);
    if (awsShot) generated.push(awsShot);

    // Pause here — open AWS home in a new tab and wait for the user to sign in.
    const signedInPage = await pauseForManualSignIn(context, 10);

    console.log('Capturing overlay on the AWS Console home page...');
    const consoleShot = await captureConsoleHome(signedInPage);
    if (consoleShot) generated.push(consoleShot);

    console.log('Capturing overlay on the EC2 dashboard...');
    const ec2Shot = await captureEc2Dashboard(signedInPage);
    if (ec2Shot) generated.push(ec2Shot);

    console.log('\nGenerated screenshots:');
    for (const file of generated) {
      console.log(`  ${path.relative(ROOT, file)}`);
    }
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    closeSockets(sockets);
    presenter.kill('SIGTERM');
    await wait(300);

    // Scorched-earth cleanup of the throwaway Chrome profile so nothing
    // (cookies, extension storage, AWS session) persists on disk after the run.
    try {
      rmSync(USER_DATA_DIR, { recursive: true, force: true, maxRetries: 3 });
      console.log(`Removed throwaway profile: ${USER_DATA_DIR}`);
    } catch (error) {
      console.warn(`Could not remove ${USER_DATA_DIR}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
