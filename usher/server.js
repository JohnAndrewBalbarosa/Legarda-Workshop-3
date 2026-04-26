import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const moduleDirectoryPath = path.dirname(currentFilePath);
const sharedPublicDirectoryPath = path.resolve(moduleDirectoryPath, '../presenter/public');

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload, null, 2));
}

function writeRedirect(response, location) {
  response.writeHead(302, {
    Location: location,
    'Cache-Control': 'no-store',
  });
  response.end();
}

function normalizePathname(pathname = '/') {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

async function writeStaticFile(response, { filePath, contentType }) {
  const resolvedPath = path.join(sharedPublicDirectoryPath, filePath);

  try {
    const payload = await readFile(resolvedPath);
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });
    response.end(payload);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      writeJson(response, 404, { error: 'Not found' });
      return;
    }

    writeJson(response, 500, { error: 'Failed to load static asset' });
  }
}

export function createUsherHostServer({
  host = process.env.USHER_HOST || process.env.HOST || '127.0.0.1',
  port = Number.parseInt(process.env.USHER_PORT || process.env.PORT || '5175', 10),
  presenterWs = process.env.PRESENTER_WS || 'ws://10.250.250.1:5050',
  defaultUsherId = process.env.USHER_ID || 'usher-1',
} = {}) {
  const effectivePort = Number.isNaN(port) ? 5175 : port;

  const staticRoutes = new Map([
    ['/usher', { filePath: 'usher.html', contentType: 'text/html; charset=utf-8' }],
    ['/index.html', { filePath: 'usher.html', contentType: 'text/html; charset=utf-8' }],
    ['/assets/styles.css', { filePath: 'styles.css', contentType: 'text/css; charset=utf-8' }],
    ['/assets/app.js', { filePath: 'app.js', contentType: 'application/javascript; charset=utf-8' }],
  ]);

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const pathname = normalizePathname(requestUrl.pathname);

    if (request.method === 'GET' && pathname === '/health') {
      writeJson(response, 200, {
        status: 'ok',
        role: 'usher',
        host,
        port: effectivePort,
        presenterWs,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/') {
      const launchUrl = new URL('/usher', `http://${request.headers.host ?? `localhost:${effectivePort}`}`);
      launchUrl.searchParams.set('id', requestUrl.searchParams.get('id') || defaultUsherId);
      launchUrl.searchParams.set('ws', requestUrl.searchParams.get('ws') || presenterWs);
      writeRedirect(response, launchUrl.pathname + launchUrl.search);
      return;
    }

    if (request.method === 'GET' && staticRoutes.has(pathname)) {
      const asset = staticRoutes.get(pathname);
      void writeStaticFile(response, asset);
      return;
    }

    writeJson(response, 404, {
      error: 'Not found',
    });
  });

  return {
    server,
    start() {
      return new Promise((resolve, reject) => {
        const handleError = (error) => {
          server.removeListener('error', handleError);
          reject(error);
        };

        server.once('error', handleError);
        server.listen(effectivePort, host, () => {
          server.removeListener('error', handleError);
          resolve({ host, port: effectivePort });
        });
      });
    },
    stop() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

export default createUsherHostServer;

const entryFilePath = process.argv[1];

if (entryFilePath && currentFilePath === entryFilePath) {
  const server = createUsherHostServer();
  server
    .start()
    .then(({ host, port }) => {
      console.log(`Usher host server listening on http://${host}:${port}`);
    })
    .catch((error) => {
      console.error('Failed to start usher host server.');
      console.error(error);
      process.exitCode = 1;
    });
}
