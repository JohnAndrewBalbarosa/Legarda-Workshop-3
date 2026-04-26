import { spawn } from 'node:child_process';

const host = process.env.USHER_HOST || process.env.HOST || '127.0.0.1';
const port = Number.parseInt(process.env.USHER_PORT || process.env.PORT || '5175', 10);
const effectivePort = Number.isNaN(port) ? 5175 : port;
const usherId = process.env.USHER_ID || 'usher-1';
const presenterWs = process.env.PRESENTER_WS || 'ws://10.250.250.1:5050';
const healthUrl = `http://${host}:${effectivePort}/health`;
const usherUrl = new URL(`http://${host}:${effectivePort}/usher`);
usherUrl.searchParams.set('id', usherId);
usherUrl.searchParams.set('ws', presenterWs);

let usherServerProcess = null;
let playwrightProcess = null;
let shuttingDown = false;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForHealth(url, attempts = 40, intervalMs = 500) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Keep retrying while the server is booting.
    }

    await wait(intervalMs);
  }

  return false;
}

function spawnPlaywrightOpen(targetUrl) {
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/c', 'npx', '-y', 'playwright', 'open', targetUrl], {
      stdio: 'inherit',
      shell: false,
    });
  }

  return spawn('npx', ['-y', 'playwright', 'open', targetUrl], {
    stdio: 'inherit',
    shell: false,
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (playwrightProcess && !playwrightProcess.killed) {
    playwrightProcess.kill('SIGTERM');
  }

  if (usherServerProcess && !usherServerProcess.killed) {
    usherServerProcess.kill('SIGTERM');
  }

  process.exitCode = exitCode;
}

async function run() {
  const existingServerHealthy = await waitForHealth(healthUrl, 1, 1);

  if (!existingServerHealthy) {
    usherServerProcess = spawn(process.execPath, ['server.js'], {
      cwd: new URL('.', import.meta.url),
      env: {
        ...process.env,
        USHER_HOST: host,
        USHER_PORT: String(effectivePort),
        PRESENTER_WS: presenterWs,
        USHER_ID: usherId,
      },
      stdio: 'inherit',
    });

    usherServerProcess.on('exit', (code) => {
      if (!shuttingDown && code !== 0) {
        shutdown(code || 1);
      }
    });

    const healthy = await waitForHealth(healthUrl);
    if (!healthy) {
      console.error(`Usher host server did not become healthy at ${healthUrl}`);
      shutdown(1);
      return;
    }
  }

  if (process.env.PLAYWRIGHT_SKIP_OPEN === '1') {
    console.log(`Usher host is ready at ${usherUrl.toString()}`);
    shutdown(0);
    return;
  }

  console.log(`Opening usher UI with Playwright at ${usherUrl.toString()}`);
  playwrightProcess = spawnPlaywrightOpen(usherUrl.toString());

  playwrightProcess.on('exit', (code) => {
    shutdown(code || 0);
  });
}

process.on('SIGINT', () => {
  shutdown(0);
});

process.on('SIGTERM', () => {
  shutdown(0);
});

run().catch((error) => {
  console.error('Failed to start Playwright usher host.');
  console.error(error);
  shutdown(1);
});
