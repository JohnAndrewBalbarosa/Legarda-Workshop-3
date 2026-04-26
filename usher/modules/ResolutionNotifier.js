export class ResolutionNotifier {
  constructor(sendMessage = () => false) {
    this.sendMessage = sendMessage;
  }

  setSendMessage(sendMessage) {
    this.sendMessage = sendMessage;
  }

  notifyResolution({ requestId, participantId, usherId, notes = '' } = {}) {
    const payload = {
      type: 'usher.concern_resolved',
      requestId,
      participantId,
      usherId,
      notes,
      resolvedAt: new Date().toISOString(),
    };

    this.sendMessage(payload);
    return payload;
  }
}

export function notifyResolution(options = {}) {
  const notifier = new ResolutionNotifier(options.sendMessage);
  return notifier.notifyResolution(options);
}
