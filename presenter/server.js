import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { formatReportAsText } from './modules/ReportGenerator.js';
import { StepManager } from './modules/StepManager.js';
import { WORKSHOP_WORKFLOW_REFERENCE, getDefaultWorkshopSteps } from './modules/WorkshopPlan.js';
import { ProgressTracker } from './progressTracker.js';
import { createPresenterWebSocketServer } from './websocket.js';

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload, null, 2));
}

function writeText(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
  });
  response.end(payload);
}

const currentFilePath = fileURLToPath(import.meta.url);
const moduleDirectoryPath = path.dirname(currentFilePath);

const STATIC_ROUTE_DEFINITIONS = new Map([
  ['/', { filePath: 'public/index.html', contentType: 'text/html; charset=utf-8' }],
  ['/index.html', { filePath: 'public/index.html', contentType: 'text/html; charset=utf-8' }],
  ['/presenter', { filePath: 'public/presenter.html', contentType: 'text/html; charset=utf-8' }],
  ['/user', { filePath: 'public/user.html', contentType: 'text/html; charset=utf-8' }],
  ['/usher', { filePath: 'public/usher.html', contentType: 'text/html; charset=utf-8' }],
  ['/assets/styles.css', { filePath: 'public/styles.css', contentType: 'text/css; charset=utf-8' }],
  ['/assets/app.js', { filePath: 'public/app.js', contentType: 'application/javascript; charset=utf-8' }],
]);

function normalizePathname(pathname = '/') {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

async function writeStaticFile(response, assetDefinition) {
  const resolvedPath = path.join(moduleDirectoryPath, assetDefinition.filePath);

  try {
    const filePayload = await readFile(resolvedPath);
    response.writeHead(200, {
      'Content-Type': assetDefinition.contentType,
      'Cache-Control': 'no-store',
    });
    response.end(filePayload);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      writeJson(response, 404, {
        error: 'Not found',
      });
      return;
    }

    writeJson(response, 500, {
      error: 'Failed to load static asset',
    });
  }
}

export function createPresenterServer({
  host = '10.250.250.1',
  port = 5050,
  steps = getDefaultWorkshopSteps(),
  onAutoAdvance = () => {},
  onStateChange = () => {},
} = {}) {
  const normalizedSteps = Array.isArray(steps) && steps.length > 0 ? steps : getDefaultWorkshopSteps();
  const stepManager = new StepManager(normalizedSteps);
  const progressTracker = new ProgressTracker();
  let realtimeServer = null;

  function buildState() {
    const realtimeState = realtimeServer?.getState?.() ?? {
      currentStepIndex: stepManager.getCurrentStepIndex(),
      currentStep: stepManager.getCurrentStep(),
      steps: stepManager.getStepList(),
      highlights: stepManager.getHighlightDetails(),
      actionProgress: [],
      participants: progressTracker.getParticipants().map((participant) => ({
        ...participant,
        ...stepManager.buildParticipantSnapshot(participant.participantId),
      })),
      outstandingHelpRequests: progressTracker.getOutstandingHelpRequests(),
      allUsersComplete: false,
      canAdvance: stepManager.canAdvance(),
      canRetreat: stepManager.canRetreat(),
      reportSummary: null,
    };
    const report = progressTracker.buildReport({
      currentStepIndex: realtimeState.currentStepIndex,
      totalSteps: realtimeState.steps.length,
    });

    return {
      host,
      port,
      workflowReference: WORKSHOP_WORKFLOW_REFERENCE,
      ...realtimeState,
      reportSummary: realtimeState.reportSummary ?? report.summary,
      report,
    };
  }

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const normalizedPathname = normalizePathname(requestUrl.pathname);

    if (request.method === 'GET' && normalizedPathname === '/health') {
      writeJson(response, 200, {
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (request.method === 'GET' && normalizedPathname === '/state') {
      writeJson(response, 200, buildState());
      return;
    }

    if (request.method === 'GET' && normalizedPathname === '/report') {
      writeJson(response, 200, buildState().report);
      return;
    }

    if (request.method === 'GET' && normalizedPathname === '/report.txt') {
      writeText(response, 200, formatReportAsText(buildState().report));
      return;
    }

    if (request.method === 'GET' && STATIC_ROUTE_DEFINITIONS.has(normalizedPathname)) {
      const staticRoute = STATIC_ROUTE_DEFINITIONS.get(normalizedPathname);
      void writeStaticFile(response, staticRoute);
      return;
    }

    writeJson(response, 404, {
      error: 'Not found',
    });
  });

  realtimeServer = createPresenterWebSocketServer({
    server,
    stepManager,
    progressTracker,
    onAutoAdvance,
    onStateChange,
  });

  return {
    server,
    stepManager,
    progressTracker,
    realtimeServer,
    getState: buildState,
    exportReport() {
      return buildState().report;
    },
    advanceStep() {
      stepManager.advanceStep();
      return realtimeServer.broadcastState('manual_advance');
    },
    retreatStep() {
      stepManager.retreatStep();
      return realtimeServer.broadcastState('manual_retreat');
    },
    start() {
      return new Promise((resolve, reject) => {
        const handleStartupError = (error) => {
          server.removeListener('error', handleStartupError);
          realtimeServer.websocketServer.removeListener('error', handleStartupError);
          reject(error);
        };

        server.once('error', handleStartupError);
        realtimeServer.websocketServer.once('error', handleStartupError);
        server.listen(port, host, () => {
          server.removeListener('error', handleStartupError);
          realtimeServer.websocketServer.removeListener('error', handleStartupError);
          resolve({
            host,
            port,
          });
        });
      });
    },
    stop() {
      return new Promise((resolve, reject) => {
        realtimeServer.close();
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

export default createPresenterServer;

const entryFilePath = process.argv[1];

if (entryFilePath && currentFilePath === entryFilePath) {
  const configuredHost = process.env.PRESENTER_HOST || process.env.HOST || '10.250.250.1';
  const configuredPort = Number.parseInt(process.env.PRESENTER_PORT || process.env.PORT || '5050', 10);
  const server = createPresenterServer({
    host: configuredHost,
    port: Number.isNaN(configuredPort) ? 5050 : configuredPort,
  });

  server
    .start()
    .then(({ host, port }) => {
      console.log(`Presenter server listening on http://${host}:${port}`);
    })
    .catch((error) => {
      console.error('Failed to start presenter server.');
      console.error(error);
      process.exitCode = 1;
    });
}
