import assert from 'node:assert/strict';
import { createPresenterServer } from '../presenter/server.js';
import { getDefaultWorkshopSteps } from '../presenter/modules/WorkshopPlan.js';
import { connectToPresenter as connectUserToPresenter } from '../user/backend/websocket.js';
import { connectToPresenter as connectUsherToPresenter } from '../usher/websocket.js';

globalThis.window = globalThis;

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitFor(predicate, { timeoutMs = 10000, intervalMs = 50, label = 'condition' } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = predicate();

    if (result) {
      return result;
    }

    await delay(intervalMs);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

async function run() {
  const defaultState = createPresenterServer({
    host: '127.0.0.1',
    port: 0,
  }).getState();
  assert.ok(defaultState.steps.length > 0);
  assert.equal(defaultState.workflowReference.name, 'AWS EC2 AI-Guided Workshop');

  const autoAdvanceEvents = [];
  const stateChanges = [];
  const userMessages = [];
  const usherMessages = [];
  const userConnections = [];
  const usherConnections = [];
  const port = 5058;
  const endpoint = `ws://127.0.0.1:${port}`;

  const presenterServer = createPresenterServer({
    host: '127.0.0.1',
    port,
    steps: [
      {
        ...getDefaultWorkshopSteps()[0],
        id: 'step-1',
        actions: [
          {
            id: 'open-console',
            label: 'Open Console',
            selector: '#console',
            description: 'Click the console launcher.',
          },
        ],
        highlightSelectors: ['#console', '#nav-menu'],
      },
      {
        id: 'step-2',
        phase: 'Live AWS Capture',
        targetUrl: 'https://console.aws.amazon.com/ec2/',
        title: 'Review instance summary',
        description: 'Pause here for the next instruction.',
        actions: [],
        highlightSelectors: [],
      },
    ],
    onAutoAdvance: (step) => {
      autoAdvanceEvents.push(step?.id ?? null);
    },
    onStateChange: (state) => {
      stateChanges.push(state);
    },
  });

  let userConnection = null;
  let usherConnection = null;

  try {
    await presenterServer.start();

    userConnection = connectUserToPresenter({
      participantId: 'user-1',
      seatLabel: 'A1',
      endpoints: [endpoint],
      onConnectionChange: (status) => {
        userConnections.push(status);
      },
      onMessage: (message) => {
        userMessages.push(message);
      },
    });

    usherConnection = connectUsherToPresenter({
      usherId: 'usher-1',
      endpoints: [endpoint],
      onConnectionChange: (status) => {
        usherConnections.push(status);
      },
      onMessage: (message) => {
        usherMessages.push(message);
      },
    });

    await waitFor(
      () => presenterServer.getState().participants.filter((participant) => participant.role === 'user').length === 1,
      { label: 'user registration' },
    );
    await waitFor(
      () => presenterServer.getState().participants.some((participant) => participant.role === 'usher'),
      { label: 'usher registration' },
    );

    assert.equal(userConnections.at(-1)?.status, 'connected');
    assert.equal(usherConnections.at(-1)?.status, 'connected');

    userConnection.requestHelp({ requestId: 'help-1' });

    const helpRequest = await waitFor(
      () => presenterServer.getState().outstandingHelpRequests.find((request) => request.requestId === 'help-1'),
      { label: 'help request propagation' },
    );

    await waitFor(
      () => userMessages.some((message) => message.type === 'help_request_created' && message.request?.requestId === 'help-1'),
      { label: 'user help acknowledgement' },
    );
    await waitFor(
      () => usherMessages.some((message) => message.type === 'help_request_created' && message.request?.requestId === 'help-1'),
      { label: 'usher help notification' },
    );

    userConnection.sendActionClick('open-console');

    await waitFor(
      () => presenterServer.getState().currentStepIndex === 1,
      { label: 'auto advance to step 2' },
    );

    assert.deepEqual(autoAdvanceEvents, ['step-2']);
    assert.equal(stateChanges.at(-1)?.actionProgress?.length ?? 0, 0);

    usherConnection.resolveConcern({
      requestId: helpRequest.requestId,
      participantId: helpRequest.participantId,
      notes: 'Resolved during smoke test.',
    });

    await waitFor(
      () => presenterServer.getState().outstandingHelpRequests.length === 0,
      { label: 'help resolution' },
    );
    await waitFor(
      () => userMessages.some((message) => message.type === 'help_resolved' && message.requestId === 'help-1'),
      { label: 'user resolution notification' },
    );

    assert.ok(stateChanges.length > 0);

    console.log('Smoke test passed.');
    console.log(`Endpoint: ${endpoint}`);
    console.log(`User messages observed: ${userMessages.length}`);
    console.log(`Usher messages observed: ${usherMessages.length}`);
    console.log(`State updates observed: ${stateChanges.length}`);
  } finally {
    userConnection?.close();
    usherConnection?.close();
    await presenterServer.stop();
  }
}

run().catch((error) => {
  console.error('Smoke test failed.');
  console.error(error);
  process.exitCode = 1;
});
