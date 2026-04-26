const DEFAULT_ENDPOINTS = ['ws://10.250.250.1:5050', 'ws://localhost:5050'];

function safeParseMessage(rawMessage) {
  try {
    return JSON.parse(rawMessage);
  } catch (error) {
    return null;
  }
}

export function connectToPresenter({
  participantId,
  seatLabel = '',
  endpoints = DEFAULT_ENDPOINTS,
  onState = () => {},
  onConnectionChange = () => {},
  onMessage = () => {},
} = {}) {
  if (typeof WebSocket === 'undefined') {
    throw new Error('A browser-compatible WebSocket implementation is required for the user client.');
  }

  let socket = null;
  let reconnectTimer = null;
  let closedManually = false;
  let endpointIndex = 0;
  let activeEndpoint = endpoints[0] ?? DEFAULT_ENDPOINTS[0];

  function updateConnection(status, extra = {}) {
    onConnectionChange({
      status,
      url: activeEndpoint,
      ...extra,
    });
  }

  function send(payload) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return true;
    }

    return false;
  }

  function scheduleReconnect() {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => {
      connect();
    }, 1500);
  }

  function connect() {
    if (closedManually || endpoints.length === 0) {
      return;
    }

    activeEndpoint = endpoints[endpointIndex] ?? DEFAULT_ENDPOINTS[0];
    updateConnection('connecting');

    const nextSocket = new WebSocket(activeEndpoint);
    socket = nextSocket;

    nextSocket.addEventListener('open', () => {
      updateConnection('connected');
      send({
        type: 'hello',
        role: 'user',
        participantId,
        seatLabel,
      });
      send({ type: 'request_state' });
    });

    nextSocket.addEventListener('message', (event) => {
      const message = safeParseMessage(event.data);

      if (!message) {
        return;
      }

      if (message.type === 'workshop_state') {
        onState(message.state ?? {});
      }

      onMessage(message);
    });

    nextSocket.addEventListener('close', () => {
      if (socket === nextSocket) {
        socket = null;
      }

      if (closedManually) {
        updateConnection('closed');
        return;
      }

      endpointIndex = (endpointIndex + 1) % endpoints.length;
      updateConnection('reconnecting');
      scheduleReconnect();
    });

    nextSocket.addEventListener('error', () => {
      updateConnection('error');
    });
  }

  connect();

  return {
    send,
    requestState() {
      return send({ type: 'request_state' });
    },
    sendActionClick(actionId) {
      return send({
        type: 'user.action_clicked',
        actionId,
      });
    },
    sendStepComplete({ stepId, actionIds = [] } = {}) {
      return send({
        type: 'user.step_complete',
        stepId,
        actionIds,
      });
    },
    requestHelp(payload = {}) {
      return send({
        type: 'user.help_request',
        ...payload,
      });
    },
    close() {
      closedManually = true;
      window.clearTimeout(reconnectTimer);

      if (socket) {
        socket.close();
      }
    },
    getStatus() {
      return socket ? socket.readyState : WebSocket.CLOSED;
    },
  };
}
