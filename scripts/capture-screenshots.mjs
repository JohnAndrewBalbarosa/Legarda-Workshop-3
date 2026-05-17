// Boots presenter/server.js on 127.0.0.1:5050, registers a couple of fake
// participants and a help request over WS so dashboards aren't empty, then
// uses Playwright to capture PNGs of each role page into docs/screenshots/.
//
// Run from the project root: `npm run screenshots`.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Playwright lives under user/node_modules; ws under presenter/node_modules.
const requireFromUser = createRequire(path.join(ROOT, 'user', 'package.json'));
const requireFromPresenter = createRequire(path.join(ROOT, 'presenter', 'package.json'));
const { chromium } = requireFromUser('playwright');
const WebSocket = requireFromPresenter('ws');

const HOST = '127.0.0.1';
const PORT = 5050;
const BASE_URL = `http://${HOST}:${PORT}`;
const WS_URL = `ws://${HOST}:${PORT}`;
const SCREENSHOTS_DIR = path.join(ROOT, 'docs', 'screenshots');

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) return;
    } catch {
      // server not ready yet
    }
    await wait(250);
  }
  throw new Error(`Presenter server did not respond on ${BASE_URL}/health within ${timeoutMs}ms`);
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

  child.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`[presenter] exited unexpectedly: code=${code} signal=${signal}`);
    }
  });

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
  // Two demo users so the dashboards show population. Alice is mid-workshop
  // (one completed step) so her panel shows the "Completed Steps" panel and a
  // help status. Bob lags behind and raises a help request so the usher view
  // has an open queue item.
  const alice = await openSocket();
  send(alice, {
    type: 'hello',
    role: 'user',
    participantId: 'user-alice',
    seatLabel: 'A1',
  });
  await wait(150);

  const bob = await openSocket();
  send(bob, {
    type: 'hello',
    role: 'user',
    participantId: 'user-bob',
    seatLabel: 'B3',
  });
  await wait(150);

  // Presenter advances the room to step 1 (Sign in or create account).
  const presenterSocket = await openSocket();
  send(presenterSocket, {
    type: 'hello',
    role: 'presenter',
    participantId: 'presenter-main',
    seatLabel: '',
  });
  await wait(150);
  send(presenterSocket, { type: 'presenter.advance_step' });
  await wait(200);

  // Alice has completed step 0 — her personal step is now 1, caught up with
  // the slide. Bob did not, so he is "stuck behind" the slide.
  send(alice, {
    type: 'user.step_complete',
    participantId: 'user-alice',
    actionIds: [],
  });
  await wait(200);

  // Bob asks for help from his current (behind) step.
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
    try {
      socket.close();
    } catch {
      // ignore
    }
  }
}

async function captureRole(browser, urlPath, fileName) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const target = `${BASE_URL}${urlPath}`;
  console.log(`Capturing ${target} -> ${fileName}`);
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1');
  // Allow the WebSocket handshake and first render to settle.
  await page.waitForTimeout(1500);

  const outputPath = path.join(SCREENSHOTS_DIR, fileName);
  await page.screenshot({ path: outputPath, fullPage: true });
  await context.close();
  return outputPath;
}

async function main() {
  console.log('Starting presenter server...');
  const presenter = startPresenterServer();

  let sockets = [];
  let browser = null;

  try {
    await waitForHealth();
    console.log('Presenter server is up.');

    sockets = await seedFakeParticipants();
    console.log('Seeded fake participants (Alice @ A1, Bob @ B3 with help request).');

    browser = await chromium.launch();
    const generated = [];
    generated.push(await captureRole(browser, '/presenter', 'presenter.png'));
    generated.push(await captureRole(browser, '/user?id=user-alice&seat=A1', 'user.png'));
    generated.push(await captureRole(browser, '/usher?id=usher-1', 'usher.png'));

    console.log('\nGenerated screenshots:');
    for (const file of generated) {
      console.log(`  ${path.relative(ROOT, file)}`);
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    closeSockets(sockets);
    presenter.kill('SIGTERM');
    // Give it a moment to release the port before the process exits.
    await wait(250);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
