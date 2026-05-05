// Standalone interaction recorder.
// Launches a headed Chromium via Playwright, injects DOM listeners, and
// appends every event to interaction-logs/session-<timestamp>.jsonl
// so it can be read back later for context.

import { chromium } from 'playwright';
import { mkdir, appendFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const logsDir = join(here, 'logs');
await mkdir(logsDir, { recursive: true });

const DEFAULT_START_URL = process.env.RECORDER_START_URL || 'https://aws.amazon.com/console/';
const startUrl = process.argv[2] || DEFAULT_START_URL;
const sessionId = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = join(logsDir, `session-${sessionId}.jsonl`);

let buffer = [];
let flushing = false;

async function flush() {
  if (flushing || buffer.length === 0) return;
  flushing = true;
  const chunk = buffer.splice(0, buffer.length);
  try {
    await appendFile(logFile, chunk.map((e) => JSON.stringify(e)).join('\n') + '\n');
  } catch (err) {
    console.error('[recorder] write failed:', err.message);
  } finally {
    flushing = false;
  }
}

setInterval(flush, 500);

function record(event) {
  buffer.push({ ts: Date.now(), ...event });
}

console.log(`[recorder] log file: ${logFile}`);
console.log(`[recorder] starting at: ${startUrl}`);

const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();

await context.exposeBinding('__rec', (_source, payload) => record(payload));

await context.addInitScript(() => {
  const send = (data) => { try { window.__rec(data); } catch {} };

  const summarize = (el) => {
    if (!el || !(el instanceof Element)) return null;
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      cls: el.className && typeof el.className === 'string' ? el.className.slice(0, 120) : undefined,
      text: (el.innerText || el.value || '').toString().trim().slice(0, 80) || undefined,
      role: el.getAttribute('role') || undefined,
      href: el.getAttribute('href') || undefined,
      name: el.getAttribute('name') || undefined,
      type: el.getAttribute('type') || undefined,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    };
  };

  document.addEventListener('click', (e) => {
    send({ kind: 'click', target: summarize(e.target), button: e.button, x: e.clientX, y: e.clientY });
  }, true);

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;
    const valueLen = (t.value || '').length;
    send({ kind: 'input', target: summarize(t), valueLen });
  }, true);

  document.addEventListener('submit', (e) => {
    send({ kind: 'submit', target: summarize(e.target) });
  }, true);

  document.addEventListener('keydown', (e) => {
    if (['Enter', 'Escape', 'Tab'].includes(e.key) || e.metaKey || e.ctrlKey) {
      send({ kind: 'key', key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey });
    }
  }, true);

  let lastViewport = '';
  setInterval(() => {
    const v = {
      w: window.innerWidth, h: window.innerHeight,
      sx: Math.round(window.scrollX), sy: Math.round(window.scrollY),
      dpr: window.devicePixelRatio,
    };
    const sig = `${v.w}x${v.h}@${v.sx},${v.sy}/${v.dpr}`;
    if (sig !== lastViewport) {
      lastViewport = sig;
      send({ kind: 'viewport', ...v });
    }
  }, 500);

  window.addEventListener('focus', () => send({ kind: 'focus' }));
  window.addEventListener('blur', () => send({ kind: 'blur' }));
});

page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) {
    record({ kind: 'navigation', url: frame.url() });
  }
});

page.on('console', (msg) => {
  if (['error', 'warning'].includes(msg.type())) {
    record({ kind: 'console', level: msg.type(), text: msg.text().slice(0, 300) });
  }
});

page.on('pageerror', (err) => {
  record({ kind: 'pageerror', message: err.message.slice(0, 300) });
});

if (startUrl !== 'about:blank') {
  await page.goto(startUrl).catch((e) => record({ kind: 'goto_failed', url: startUrl, err: e.message }));
}

record({ kind: 'session_start', startUrl, sessionId });

const shutdown = async () => {
  record({ kind: 'session_end' });
  await flush();
  try { await browser.close(); } catch {}
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
browser.on('disconnected', shutdown);

console.log('[recorder] ready — interact in the browser. Ctrl+C here when done.');
