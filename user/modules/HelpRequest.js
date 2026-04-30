function createRequestId() {
  return `help-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class HelpRequestManager {
  constructor({ seatLabel = '', sendMessage = () => false, onStatusChange = () => {} } = {}) {
    this.seatLabel = seatLabel;
    this.sendMessage = sendMessage;
    this.onStatusChange = onStatusChange;
    this.outstandingRequest = null;
  }

  setSendMessage(sendMessage) {
    this.sendMessage = sendMessage;
  }

  sendHelpRequest({ participantId, currentStep } = {}) {
    if (this.outstandingRequest && this.outstandingRequest.status !== 'resolved') {
      return { ...this.outstandingRequest };
    }

    const request = {
      requestId: createRequestId(),
      participantId,
      seatLabel: this.seatLabel,
      stepId: currentStep?.id ?? null,
      stepTitle: currentStep?.title ?? '',
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };

    this.outstandingRequest = request;
    this.onStatusChange({ ...request });
    this.sendMessage({
      type: 'user.help_request',
      ...request,
    });

    return { ...request };
  }

  claimRequest(payload = {}) {
    if (!this.outstandingRequest) {
      return null;
    }

    this.outstandingRequest = {
      ...this.outstandingRequest,
      ...payload,
      status: 'claimed',
      claimedAt: payload.claimedAt ?? new Date().toISOString(),
    };

    this.onStatusChange({ ...this.outstandingRequest });
    return { ...this.outstandingRequest };
  }

  acknowledgeRequest(payload = {}) {
    if (!this.outstandingRequest) {
      return null;
    }

    this.outstandingRequest = {
      ...this.outstandingRequest,
      ...payload,
      status: 'acknowledged',
    };

    this.onStatusChange({ ...this.outstandingRequest });
    return { ...this.outstandingRequest };
  }

  resolveRequest(payload = {}) {
    if (!this.outstandingRequest) {
      return null;
    }

    this.outstandingRequest = {
      ...this.outstandingRequest,
      ...payload,
      status: 'resolved',
      resolvedAt: payload.resolvedAt ?? new Date().toISOString(),
    };

    this.onStatusChange({ ...this.outstandingRequest });
    return { ...this.outstandingRequest };
  }

  clearRequest() {
    this.outstandingRequest = null;
    this.onStatusChange(null);
  }

  getStatus() {
    return this.outstandingRequest ? { ...this.outstandingRequest } : null;
  }
}

export function sendHelpRequest(options = {}) {
  const manager = new HelpRequestManager({
    seatLabel: options.seatLabel,
    sendMessage: options.sendMessage,
    onStatusChange: options.onStatusChange,
  });

  return manager.sendHelpRequest(options);
}
