import { WebSocketServer } from 'ws';

const OPEN_READY_STATE = 1;

function safeParseMessage(rawMessage) {
  try {
    return JSON.parse(rawMessage);
  } catch (error) {
    return null;
  }
}

function sendMessage(socket, message) {
  if (socket && socket.readyState === OPEN_READY_STATE) {
    socket.send(JSON.stringify(message));
  }
}

export function createPresenterWebSocketServer({
  server,
  stepManager,
  progressTracker,
  onAutoAdvance = () => {},
  onStateChange = () => {},
} = {}) {
  const websocketServer = new WebSocketServer({ server });
  const presenters = new Set();
  const ushers = new Map();
  const users = new Map();

  function getActiveUserIds() {
    return Array.from(users.keys());
  }

  function buildWorkshopState() {
    const currentStep = stepManager.getCurrentStep();
    const participantStates = progressTracker.getParticipants().map((participant) => ({
      ...participant,
      ...stepManager.buildParticipantSnapshot(participant.participantId),
    }));
    const activeUserIds = getActiveUserIds();
    const activeParticipants = participantStates.filter(
      (participant) => participant.role === 'user' && activeUserIds.includes(participant.participantId),
    );
    const actionProgress = (currentStep?.actions ?? []).map((action) => {
      const completedCount = activeParticipants.filter((participant) =>
        (participant.currentStepActionIds ?? []).includes(action.id),
      ).length;

      return {
        actionId: action.id,
        label: action.label,
        description: action.description,
        selector: action.selector,
        completedCount,
        totalParticipants: activeParticipants.length,
        pendingCount: Math.max(activeParticipants.length - completedCount, 0),
      };
    });

    return {
      currentStepIndex: stepManager.getCurrentStepIndex(),
      currentStep,
      steps: stepManager.getStepList(),
      highlights: stepManager.getHighlightDetails(),
      actionProgress,
      participants: participantStates,
      outstandingHelpRequests: progressTracker.getOutstandingHelpRequests(),
      allUsersComplete: stepManager.isCurrentStepCompleteForAll(activeUserIds),
      canAdvance: stepManager.canAdvance(),
      canRetreat: stepManager.canRetreat(),
      reportSummary: progressTracker.buildReport({
        currentStepIndex: stepManager.getCurrentStepIndex(),
        totalSteps: stepManager.getStepList().length,
      }).summary,
    };
  }

  function syncActiveUserProgress() {
    const currentStep = stepManager.getCurrentStep();

    for (const participantId of getActiveUserIds()) {
      const snapshot = stepManager.buildParticipantSnapshot(participantId);
      progressTracker.updateParticipantProgress({
        participantId,
        currentStepId: currentStep?.id ?? null,
        currentStepTitle: currentStep?.title ?? '',
        completedStepIds: snapshot.completedStepIds,
        currentStepActionIds: snapshot.currentStepActionIds,
        isCurrentStepComplete: snapshot.isCurrentStepComplete,
      });
    }
  }

  function broadcastState(reason) {
    syncActiveUserProgress();
    const state = buildWorkshopState();
    const message = {
      type: 'workshop_state',
      reason,
      state,
    };

    for (const socket of presenters) {
      sendMessage(socket, message);
    }

    for (const socket of ushers.values()) {
      sendMessage(socket, message);
    }

    for (const socket of users.values()) {
      sendMessage(socket, message);
    }

    onStateChange(state);
    return state;
  }

  function maybeAutoAdvance() {
    if (!stepManager.isCurrentStepCompleteForAll(getActiveUserIds()) || !stepManager.canAdvance()) {
      return false;
    }

    const nextStep = stepManager.advanceStep();
    onAutoAdvance(nextStep);
    broadcastState('auto_advanced');
    return true;
  }

  function handleHello(socket, message) {
    const role = message.role === 'presenter' || message.role === 'usher' ? message.role : 'user';
    const participantId = message.participantId || `${role}-${Date.now()}`;
    const seatLabel = message.seatLabel ?? '';

    socket.meta = {
      role,
      participantId,
      seatLabel,
    };

    if (role === 'presenter') {
      presenters.add(socket);
    } else if (role === 'usher') {
      ushers.set(participantId, socket);
      progressTracker.registerParticipant({ participantId, role, seatLabel });
    } else {
      users.set(participantId, socket);
      stepManager.registerParticipant(participantId);
      progressTracker.registerParticipant({ participantId, role, seatLabel });
    }

    sendMessage(socket, {
      type: 'hello_ack',
      state: broadcastState('participant_joined'),
    });
  }

  function handlePresenterCommand(message) {
    if (message.type === 'presenter.advance_step') {
      stepManager.advanceStep();
      broadcastState('presenter_advanced');
      return;
    }

    if (message.type === 'presenter.previous_step') {
      stepManager.retreatStep();
      broadcastState('presenter_retreated');
      return;
    }

    if (message.type === 'presenter.set_step' && Number.isInteger(message.index)) {
      stepManager.setCurrentStep(message.index);
      broadcastState('presenter_set_step');
    }
  }

  function handleUserEvent(socket, message) {
    const participantId = socket.meta?.participantId;
    const currentStep = stepManager.getCurrentStep();

    if (message.type === 'user.action_clicked') {
      stepManager.recordActionClick(participantId, message.actionId);

      if (!maybeAutoAdvance()) {
        broadcastState('user_action_clicked');
      }

      return;
    }

    if (message.type === 'user.step_complete') {
      stepManager.markStepComplete(participantId, message.actionIds);

      if (!maybeAutoAdvance()) {
        broadcastState('user_step_completed');
      }

      return;
    }

    if (message.type === 'user.help_request') {
      const request = progressTracker.recordHelpRequest({
        requestId: message.requestId,
        participantId,
        seatLabel: socket.meta?.seatLabel ?? '',
        stepId: currentStep?.id ?? null,
        stepTitle: currentStep?.title ?? '',
      });

      if (!request) {
        return;
      }

      const helpMessage = {
        type: 'help_request_created',
        request,
      };

      sendMessage(socket, helpMessage);

      for (const usherSocket of ushers.values()) {
        sendMessage(usherSocket, helpMessage);
      }

      for (const presenterSocket of presenters) {
        sendMessage(presenterSocket, helpMessage);
      }

      broadcastState('help_requested');
    }
  }

  function handleUsherEvent(message) {
    if (message.type !== 'usher.concern_resolved') {
      return;
    }

    const resolvedRequest = progressTracker.resolveHelpRequest({
      requestId: message.requestId,
      participantId: message.participantId,
      usherId: message.usherId,
      notes: message.notes,
    });

    if (!resolvedRequest) {
      return;
    }

    const participantSocket = users.get(resolvedRequest.participantId);

    sendMessage(participantSocket, {
      type: 'help_resolved',
      requestId: resolvedRequest.requestId,
      participantId: resolvedRequest.participantId,
      resolvedAt: resolvedRequest.resolvedAt,
      notes: resolvedRequest.notes,
    });

    broadcastState('help_resolved');
  }

  function cleanupConnection(socket) {
    const role = socket.meta?.role;
    const participantId = socket.meta?.participantId;

    if (role === 'presenter') {
      presenters.delete(socket);
    } else if (role === 'usher') {
      ushers.delete(participantId);
    } else if (role === 'user') {
      users.delete(participantId);
    }

    broadcastState('participant_left');
  }

  websocketServer.on('connection', (socket) => {
    socket.on('message', (rawMessage) => {
      const message = safeParseMessage(rawMessage.toString());

      if (!message) {
        sendMessage(socket, {
          type: 'error',
          message: 'Invalid JSON payload received by presenter WebSocket server.',
        });
        return;
      }

      if (message.type === 'hello') {
        handleHello(socket, message);
        return;
      }

      if (message.type === 'request_state') {
        sendMessage(socket, {
          type: 'workshop_state',
          reason: 'state_requested',
          state: buildWorkshopState(),
        });
        return;
      }

      if (socket.meta?.role === 'presenter') {
        handlePresenterCommand(message);
        return;
      }

      if (socket.meta?.role === 'usher') {
        handleUsherEvent(message);
        return;
      }

      handleUserEvent(socket, message);
    });

    socket.on('close', () => {
      cleanupConnection(socket);
    });
  });

  return {
    websocketServer,
    broadcastState,
    getState: buildWorkshopState,
    close() {
      websocketServer.close();
    },
  };
}
