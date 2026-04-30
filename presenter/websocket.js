import { WebSocketServer } from 'ws';
import { createTranslationService } from './modules/TranslationService.js';

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
  translationService = null,
  onAutoAdvance = () => {},
  onStateChange = () => {},
} = {}) {
  const websocketServer = new WebSocketServer({ server });
  const presenters = new Set();
  const ushers = new Map();
  const users = new Map();

  // Translation service is wired here (instead of leaking through the HTTP
  // layer) so the broadcast callback can reach every connected user socket.
  const translator =
    translationService ??
    createTranslationService({
      onBroadcast({ recipients, mode, hash, text, content }) {
        const payload = {
          type: 'translation_broadcast',
          mode,
          hash,
          text,
          content,
        };
        for (const participantId of recipients) {
          sendMessage(users.get(participantId), payload);
        }
      },
    });

  function getActiveUserIds() {
    return Array.from(users.keys());
  }

  function buildWorkshopState() {
    const currentStep = stepManager.getCurrentStep();
    const slideIndex = stepManager.getCurrentStepIndex();
    const participantStates = progressTracker.getParticipants().map((participant) => ({
      ...participant,
      ...stepManager.buildParticipantSnapshot(participant.participantId),
    }));
    const activeUserIds = getActiveUserIds();
    const activeParticipants = participantStates.filter(
      (participant) => participant.role === 'user' && activeUserIds.includes(participant.participantId),
    );
    const actionProgress = (currentStep?.actions ?? []).map((action) => {
      const completedCount = stepManager.getActionCompletionCount(slideIndex, action.id, activeUserIds);

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
    const stepDistribution = stepManager.getStepDistribution(activeUserIds);
    const minPersonalStepIndex = stepManager.getMinPersonalStepIndex(activeUserIds);

    return {
      currentStepIndex: slideIndex,
      currentStep,
      steps: stepManager.getStepList(),
      highlights: stepManager.getHighlightDetails(),
      actionProgress,
      stepDistribution,
      minPersonalStepIndex,
      participants: participantStates,
      outstandingHelpRequests: progressTracker.getOutstandingHelpRequestsRanked(
        (id) => stepManager.getParticipantStepIndex(id),
      ),
      allUsersComplete: stepManager.allParticipantsPastSlide(activeUserIds),
      canAdvance: stepManager.canAdvance(),
      canRetreat: stepManager.canRetreat(),
      reportSummary: progressTracker.buildReport({
        currentStepIndex: slideIndex,
        totalSteps: stepManager.getStepList().length,
      }).summary,
      translatorStats: translator.getStats(),
    };
  }

  function syncActiveUserProgress() {
    for (const participantId of getActiveUserIds()) {
      const snapshot = stepManager.buildParticipantSnapshot(participantId);
      progressTracker.updateParticipantProgress({
        participantId,
        currentStepId: snapshot.personalStepId,
        currentStepTitle: snapshot.personalStepTitle,
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
    const activeIds = getActiveUserIds();
    if (activeIds.length === 0) return false;

    let lastStep = null;
    let advanced = false;
    while (stepManager.canAdvance() && stepManager.allParticipantsPastSlide(activeIds)) {
      lastStep = stepManager.advanceStep();
      advanced = true;
    }

    if (advanced) {
      onAutoAdvance(lastStep);
      broadcastState('auto_advanced');
      return true;
    }
    return false;
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

      const seat = translator.assignSeat(participantId);
      if (seat) {
        sendMessage(socket, {
          type: 'translation_seat_assigned',
          token: seat.token,
          promptCap: seat.promptCap,
          promptsUsed: seat.promptsUsed,
        });
      } else {
        sendMessage(socket, { type: 'translation_seat_unavailable' });
      }
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

  async function handleUserEvent(socket, message) {
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

    if (message.type === 'user.url_report') {
      progressTracker.setCurrentUrl(participantId, {
        url: message.url ?? '',
        urlStatus: message.urlStatus ?? 'unknown',
        profileId: message.profileId ?? null,
      });
      broadcastState('user_url_report');
      return;
    }

    if (message.type === 'user.signin_choice') {
      progressTracker.setSigninChoice(participantId, message.choice);
      broadcastState('user_signin_choice');
      return;
    }

    if (message.type === 'user.translation_lang') {
      const language = message.language;
      progressTracker.setTranslationLanguage(participantId, language);
      translator.setLanguage(participantId, language);
      broadcastState('user_translation_lang');
      return;
    }

    if (message.type === 'user.ai_request' || message.type === 'user.translation_request') {
      const mode = message.mode || message.language || 'tagalog';
      const result = await translator.translate({
        participantId,
        content: message.content ?? '',
        mode,
        otherLang: message.otherLang ?? message.targetLanguage ?? null,
      });
      sendMessage(socket, { type: 'translation_result', requestId: message.requestId ?? null, ...result });
      return;
    }

    if (message.type === 'user.help_request') {
      const personalStepIndex = stepManager.getParticipantStepIndex(participantId);
      const personalStep = stepManager.getParticipantStep(participantId);
      const request = progressTracker.recordHelpRequest({
        requestId: message.requestId,
        participantId,
        seatLabel: socket.meta?.seatLabel ?? '',
        stepId: personalStep?.id ?? currentStep?.id ?? null,
        stepTitle: personalStep?.title ?? currentStep?.title ?? '',
        personalStepIndex,
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

  function handleUsherEvent(socket, message) {
    if (message.type === 'usher.claim') {
      const claimed = progressTracker.claimHelpRequest({
        requestId: message.requestId,
        usherId: socket.meta?.participantId ?? message.usherId ?? '',
      });

      if (!claimed) return;

      const claimedMessage = {
        type: 'help_claimed',
        requestId: claimed.requestId,
        participantId: claimed.participantId,
        usherId: claimed.claimedBy,
        claimedAt: claimed.claimedAt,
      };

      sendMessage(users.get(claimed.participantId), claimedMessage);
      for (const usherSocket of ushers.values()) {
        sendMessage(usherSocket, claimedMessage);
      }
      for (const presenterSocket of presenters) {
        sendMessage(presenterSocket, claimedMessage);
      }

      broadcastState('help_claimed');
      return;
    }

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
      // Hold the seat for `disconnectHoldMs` (10 minutes by default) before
      // releasing the token back to the pool.
      translator.releaseSeat(participantId);
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
        handleUsherEvent(socket, message);
        return;
      }

      Promise.resolve(handleUserEvent(socket, message)).catch(() => {});
    });

    socket.on('close', () => {
      cleanupConnection(socket);
    });
  });

  return {
    websocketServer,
    broadcastState,
    getState: buildWorkshopState,
    translator,
    close() {
      try { translator.close?.(); } catch {}
      websocketServer.close();
    },
  };
}
