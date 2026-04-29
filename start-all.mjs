import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PRESENTER_HOST = process.env.PRESENTER_HOST || '127.0.0.1';
const PRESENTER_PORT = process.env.PRESENTER_PORT || '5050';
const PRESENTER_WS = process.env.PRESENTER_WS || `ws://${PRESENTER_HOST}:${PRESENTER_PORT}`;
const USER_HOST = process.env.USER_HOST || '127.0.0.1';

const COLORS = {
  presenter: '\x1b[36m',
  usher:     '\x1b[35m',
  user:      '\x1b[33m',
  reset:     '\x1b[0m',
};

const services = [
  {
    name: 'presenter',
    cwd: path.join(__dirname, 'presenter'),
    cmd: process.execPath,
    args: ['server.js'],
    env: { PRESENTER_HOST, PRESENTER_PORT, HOST: PRESENTER_HOST },
  },
  {
    name: 'usher',
    cwd: path.join(__dirname, 'usher'),
    cmd: process.execPath,
    args: ['server.js'],
    env: { PRESENTER_WS },
  },
  {
    name: 'user',
    cwd: path.join(__dirname, 'user'),
    cmd: process.execPath,
    args: ['aws-guide-playwright.mjs'],
    env: { PRESENTER_WS, USER_HOST },
  },
];

const children = [];

function prefix(name) {
  const color = COLORS[name] || '';
  return `${color}[${name}]${COLORS.reset}`;
}

function pipeStream(stream, name, isErr = false) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      const out = isErr ? process.stderr : process.stdout;
      out.write(`${prefix(name)} ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffer) {
      const out = isErr ? process.stderr : process.stdout;
      out.write(`${prefix(name)} ${buffer}\n`);
    }
  });
}

function startService(svc, delayMs = 0) {
  setTimeout(() => {
    console.log(`${prefix(svc.name)} starting: ${svc.cmd} ${svc.args.join(' ')} (cwd: ${svc.cwd})`);
    const child = spawn(svc.cmd, svc.args, {
      cwd: svc.cwd,
      env: { ...process.env, ...svc.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    children.push({ name: svc.name, child });
    pipeStream(child.stdout, svc.name);
    pipeStream(child.stderr, svc.name, true);
    child.on('exit', (code, signal) => {
      console.log(`${prefix(svc.name)} exited (code=${code}, signal=${signal})`);
    });
  }, delayMs);
}

startService(services[0], 0);      // presenter first
startService(services[1], 1500);   // usher after WS is up
startService(services[2], 3000);   // user (Playwright) last

let shuttingDown = false;
function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nShutting down (${reason})...`);
  for (const { child } of children) {
    if (!child.killed) {
      try { child.kill('SIGTERM'); } catch (e) {}
    }
  }
  setTimeout(() => process.exit(0), 1500);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
