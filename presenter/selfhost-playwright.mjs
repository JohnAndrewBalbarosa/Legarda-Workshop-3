import { spawn } from 'node:child_process';

const host = process.env.PRESENTER_HOST || process.env.HOST || '127.0.0.1';
const port = Number.parseInt(process.env.PRESENTER_PORT || process.env.PORT || '5050', 10);
const effectivePort = Number.isNaN(port) ? 5050 : port;
const presenterUrl = process.env.PRESENTER_UI_URL || `http://${host}:${effectivePort}/presenter`;
const healthUrl = `http://${host}:${effectivePort}/health`;

let presenterServerProcess = null;
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

  if (presenterServerProcess && !presenterServerProcess.killed) {
    presenterServerProcess.kill('SIGTERM');
  }

  process.exitCode = exitCode;
}

async function run() {
  const existingServerHealthy = await waitForHealth(healthUrl, 1, 1);

  if (!existingServerHealthy) {
    presenterServerProcess = spawn(process.execPath, ['server.js'], {
      cwd: new URL('.', import.meta.url),
      env: {
        ...process.env,
        PRESENTER_HOST: host,
        PRESENTER_PORT: String(effectivePort),
      },
      stdio: 'inherit',
    });

    presenterServerProcess.on('exit', (code) => {
      if (!shuttingDown && code !== 0) {
        shutdown(code || 1);
      }
    });

    const healthy = await waitForHealth(healthUrl);
    if (!healthy) {
      console.error(`Presenter server did not become healthy at ${healthUrl}`);
      shutdown(1);
      return;
    }
  }

  if (process.env.PLAYWRIGHT_SKIP_OPEN === '1') {
    console.log(`Presenter host is ready at ${presenterUrl}`);
    shutdown(0);
    return;
  }

  console.log(`Opening presenter UI with Playwright at ${presenterUrl}`);
  playwrightProcess = spawnPlaywrightOpen(presenterUrl);

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
  console.error('Failed to start Playwright presenter host.');
  console.error(error);
  shutdown(1);
});
