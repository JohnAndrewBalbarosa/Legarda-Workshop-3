import { generateReport } from './modules/ReportGenerator.js';

function createTimestamp() {
  return new Date().toISOString();
}

function createRequestId() {
  return `help-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class ProgressTracker {
  constructor() {
    this.participants = new Map();
    this.helpRequests = new Map();
    this.resolutionLog = [];
    this.activityLog = [];
  }

  registerParticipant({ participantId, role = 'user', seatLabel = '', name = '' } = {}) {
    if (!participantId) {
      return null;
    }

    const existingParticipant = this.participants.get(participantId);
    const participant = {
      participantId,
      role,
      seatLabel,
      name,
      connectedAt: existingParticipant?.connectedAt ?? createTimestamp(),
      lastSeenAt: createTimestamp(),
      currentStepId: existingParticipant?.currentStepId ?? null,
      currentStepTitle: existingParticipant?.currentStepTitle ?? '',
      completedStepIds: existingParticipant?.completedStepIds ?? [],
      currentStepActionIds: existingParticipant?.currentStepActionIds ?? [],
      activeHelpRequestId: existingParticipant?.activeHelpRequestId ?? null,
    };

    this.participants.set(participantId, participant);
    this.#logActivity('participant_registered', { participantId, role, seatLabel });
    return { ...participant };
  }

  updateParticipantProgress({
    participantId,
    currentStepId = null,
    currentStepTitle = '',
    completedStepIds = [],
    currentStepActionIds = [],
    isCurrentStepComplete = false,
  } = {}) {
    const participant = this.#ensureParticipant(participantId);

    if (!participant) {
      return null;
    }

    participant.currentStepId = currentStepId;
    participant.currentStepTitle = currentStepTitle;
    participant.completedStepIds = [...completedStepIds];
    participant.currentStepActionIds = [...currentStepActionIds];
    participant.lastSeenAt = createTimestamp();
    participant.isCurrentStepComplete = isCurrentStepComplete;

    if (isCurrentStepComplete) {
      participant.lastCompletedAt = createTimestamp();
    }

    this.#logActivity('progress_updated', {
      participantId,
      currentStepId,
      completedStepCount: completedStepIds.length,
      isCurrentStepComplete,
    });

    return { ...participant };
  }

  recordHelpRequest({
    requestId = createRequestId(),
    participantId,
    seatLabel = '',
    stepId = null,
    stepTitle = '',
  } = {}) {
    const participant = this.#ensureParticipant(participantId);

    if (!participant) {
      return null;
    }

    const existingOpenRequest = this.getOutstandingHelpRequests().find(
      (request) => request.participantId === participantId,
    );

    if (existingOpenRequest) {
      return existingOpenRequest;
    }

    const request = {
      requestId,
      participantId,
      seatLabel: seatLabel || participant.seatLabel,
      stepId,
      stepTitle,
      requestedAt: createTimestamp(),
      status: 'open',
    };

    this.helpRequests.set(request.requestId, request);
    participant.activeHelpRequestId = request.requestId;
    participant.lastHelpRequestedAt = request.requestedAt;

    this.#logActivity('help_requested', {
      participantId,
      requestId: request.requestId,
      stepId,
    });

    return { ...request };
  }

  resolveHelpRequest({ requestId, participantId, usherId = '', notes = '' } = {}) {
    const request = this.#findResolvableRequest({ requestId, participantId });

    if (!request) {
      return null;
    }

    if (request.status === 'resolved') {
      return { ...request };
    }

    request.status = 'resolved';
    request.resolvedAt = createTimestamp();
    request.usherId = usherId;
    request.notes = notes;

    const participant = this.#ensureParticipant(request.participantId);

    if (participant) {
      participant.activeHelpRequestId = null;
      participant.lastResolutionAt = request.resolvedAt;
    }

    const resolution = {
      requestId: request.requestId,
      participantId: request.participantId,
      usherId,
      resolvedAt: request.resolvedAt,
      notes,
    };

    this.resolutionLog.push(resolution);
    this.#logActivity('help_resolved', resolution);

    return { ...request };
  }

  getOutstandingHelpRequests() {
    return Array.from(this.helpRequests.values())
      .filter((request) => request.status !== 'resolved')
      .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt));
  }

  getParticipants() {
    return Array.from(this.participants.values()).sort((left, right) =>
      left.participantId.localeCompare(right.participantId),
    );
  }

  getSnapshot() {
    return {
      participants: this.getParticipants(),
      helpRequests: Array.from(this.helpRequests.values()).sort((left, right) =>
        left.requestedAt.localeCompare(right.requestedAt),
      ),
      outstandingHelpRequests: this.getOutstandingHelpRequests(),
      resolutions: [...this.resolutionLog],
      activityLog: [...this.activityLog],
    };
  }

  buildReport({ currentStepIndex = -1, totalSteps = 0 } = {}) {
    const snapshot = this.getSnapshot();

    return generateReport({
      participants: snapshot.participants,
      helpRequests: snapshot.helpRequests,
      resolutions: snapshot.resolutions,
      currentStepIndex,
      totalSteps,
    });
  }

  #ensureParticipant(participantId) {
    if (!participantId) {
      return null;
    }

    if (!this.participants.has(participantId)) {
      this.registerParticipant({ participantId });
    }

    return this.participants.get(participantId);
  }

  #findResolvableRequest({ requestId, participantId } = {}) {
    if (requestId && this.helpRequests.has(requestId)) {
      return this.helpRequests.get(requestId);
    }

    if (!participantId) {
      return null;
    }

    return this.getOutstandingHelpRequests().find((request) => request.participantId === participantId) ?? null;
  }

  #logActivity(type, payload) {
    this.activityLog.push({
      type,
      createdAt: createTimestamp(),
      ...payload,
    });

    if (this.activityLog.length > 250) {
      this.activityLog.shift();
    }
  }
}

export function createProgressTracker() {
  return new ProgressTracker();
}
