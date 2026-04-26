import { spawn } from 'node:child_process';

const host = process.env.USER_HOST || process.env.HOST || '127.0.0.1';
const port = Number.parseInt(process.env.USER_PORT || process.env.PORT || '5174', 10);
const effectivePort = Number.isNaN(port) ? 5174 : port;
const userId = process.env.USER_ID || 'user-1';
const seatLabel = process.env.USER_SEAT || 'A1';
const presenterWs = process.env.PRESENTER_WS || 'ws://10.250.250.1:5050';
const healthUrl = `http://${host}:${effectivePort}/health`;
const userUrl = new URL(`http://${host}:${effectivePort}/user`);
userUrl.searchParams.set('id', userId);
userUrl.searchParams.set('seat', seatLabel);
userUrl.searchParams.set('ws', presenterWs);

let userServerProcess = null;
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

  if (userServerProcess && !userServerProcess.killed) {
    userServerProcess.kill('SIGTERM');
  }

  process.exitCode = exitCode;
}

async function run() {
  const existingServerHealthy = await waitForHealth(healthUrl, 1, 1);

  if (!existingServerHealthy) {
    userServerProcess = spawn(process.execPath, ['server.js'], {
      cwd: new URL('.', import.meta.url),
      env: {
        ...process.env,
        USER_HOST: host,
        USER_PORT: String(effectivePort),
        PRESENTER_WS: presenterWs,
        USER_ID: userId,
        USER_SEAT: seatLabel,
      },
      stdio: 'inherit',
    });

    userServerProcess.on('exit', (code) => {
      if (!shuttingDown && code !== 0) {
        shutdown(code || 1);
      }
    });

    const healthy = await waitForHealth(healthUrl);
    if (!healthy) {
      console.error(`User host server did not become healthy at ${healthUrl}`);
      shutdown(1);
      return;
    }
  }

  if (process.env.PLAYWRIGHT_SKIP_OPEN === '1') {
    console.log(`User host is ready at ${userUrl.toString()}`);
    shutdown(0);
    return;
  }

  console.log(`Opening user UI with Playwright at ${userUrl.toString()}`);
  playwrightProcess = spawnPlaywrightOpen(userUrl.toString());

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
  console.error('Failed to start Playwright user host.');
  console.error(error);
  shutdown(1);
});
