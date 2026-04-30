const DEFAULT_WORKSHOP_STATE = {
  currentStepIndex: -1,
  currentStep: null,
  steps: [],
  highlights: [],
  actionProgress: [],
  participants: [],
  outstandingHelpRequests: [],
  canAdvance: false,
  canRetreat: false,
};

const DEFAULT_PRESENTER_WEBSOCKET_URL = 'ws://10.250.250.1:5050';
const role = document.body?.dataset?.role ?? 'landing';

if (role !== 'landing') {
  initializeRoleClient(role);
}

function initializeRoleClient(clientRole) {
  const params = new URLSearchParams(window.location.search);
  const endpoint = resolveWebSocketEndpoint(clientRole, params);
  const identity = buildIdentity(clientRole, params);

  let workshopState = { ...DEFAULT_WORKSHOP_STATE };
  let connection = {
    status: 'connecting',
    url: endpoint,
  };
  let socket = null;
  let reconnectTimer = null;
  let closedManually = false;
  let userHelpStatus = 'No active help request.';

  setupRoleInteractions(clientRole, identity, {
    send,
    getState: () => workshopState,
    findParticipant,
    getCurrentStep,
  });

  render();
  connect();

  window.addEventListener('beforeunload', () => {
    closedManually = true;
    window.clearTimeout(reconnectTimer);
    if (socket) {
      socket.close();
    }
  });

  function buildIdentity(roleName, queryParams) {
    const requestedId = queryParams.get('id');
    const requestedSeat = queryParams.get('seat');

    if (roleName === 'presenter') {
      return {
        participantId: requestedId || 'presenter-main',
        seatLabel: '',
      };
    }

    if (roleName === 'usher') {
      return {
        participantId: requestedId || 'usher-1',
        seatLabel: '',
      };
    }

    return {
      participantId: requestedId || `user-${Math.random().toString(36).slice(2, 7)}`,
      seatLabel: requestedSeat || 'Seat not assigned',
    };
  }

  function setConnectionStatus(status) {
    connection = {
      status,
      url: endpoint,
    };
    renderConnectionStatus();
  }

  function renderConnectionStatus() {
    const statusNode = document.getElementById('connection-status');
    if (!statusNode) {
      return;
    }

    statusNode.textContent = connection.status;
    statusNode.classList.remove('status-connected', 'status-connecting', 'status-reconnecting', 'status-error', 'status-closed');
    statusNode.classList.add(`status-${connection.status}`);
  }

  function connect() {
    if (closedManually) {
      return;
    }

    setConnectionStatus('connecting');
    const nextSocket = new WebSocket(endpoint);
    socket = nextSocket;

    nextSocket.addEventListener('open', () => {
      setConnectionStatus('connected');
      send({
        type: 'hello',
        role: clientRole,
        participantId: identity.participantId,
        seatLabel: identity.seatLabel,
      });
      send({ type: 'request_state' });
    });

    nextSocket.addEventListener('message', (event) => {
      const message = safeParseMessage(event.data);

      if (!message) {
        return;
      }

      if (message.type === 'workshop_state') {
        workshopState = normalizeWorkshopState(message.state);
      }

      if (clientRole === 'user' && message.type === 'help_request_created' && message.request?.participantId === identity.participantId) {
        userHelpStatus = `Help requested (${message.request.requestId}). Waiting for usher.`;
      }

      if (clientRole === 'user' && message.type === 'help_resolved' && message.participantId === identity.participantId) {
        userHelpStatus = `Help resolved at ${message.resolvedAt || 'now'}.`;
      }

      render();
    });

    nextSocket.addEventListener('close', () => {
      if (socket === nextSocket) {
        socket = null;
      }

      if (closedManually) {
        setConnectionStatus('closed');
        return;
      }

      setConnectionStatus('reconnecting');
      scheduleReconnect();
    });

    nextSocket.addEventListener('error', () => {
      setConnectionStatus('error');
    });
  }

  function scheduleReconnect() {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => {
      connect();
    }, 1500);
  }

  function send(payload) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return true;
    }

    return false;
  }

  function normalizeWorkshopState(state) {
    return {
      ...DEFAULT_WORKSHOP_STATE,
      ...state,
      steps: Array.isArray(state?.steps) ? state.steps : [],
      highlights: Array.isArray(state?.highlights) ? state.highlights : [],
      actionProgress: Array.isArray(state?.actionProgress) ? state.actionProgress : [],
      participants: Array.isArray(state?.participants) ? state.participants : [],
      outstandingHelpRequests: Array.isArray(state?.outstandingHelpRequests) ? state.outstandingHelpRequests : [],
    };
  }

  function getCurrentStep() {
    if (workshopState.currentStep) {
      return workshopState.currentStep;
    }

    if (!Number.isInteger(workshopState.currentStepIndex)) {
      return null;
    }

    return workshopState.steps[workshopState.currentStepIndex] ?? null;
  }

  function findParticipant(participantId) {
    return (workshopState.participants || []).find((participant) => participant.participantId === participantId) ?? null;
  }

  function render() {
    renderConnectionStatus();

    if (clientRole === 'presenter') {
      renderPresenterView();
      return;
    }

    if (clientRole === 'user') {
      renderUserView();
      return;
    }

    if (clientRole === 'usher') {
      renderUsherView();
    }
  }

  function renderPresenterView() {
    const currentStep = getCurrentStep();
    const userParticipants = workshopState.participants.filter((participant) => participant.role === 'user');

    setText(
      'presenter-meta',
      `Presenter: ${identity.participantId} | Users: ${userParticipants.length} | Open requests: ${workshopState.outstandingHelpRequests.length} | WS: ${connection.url}`,
    );

    setHtml(
      'presenter-current-step',
      buildStepMarkup(currentStep, workshopState.currentStepIndex, workshopState.steps.length, workshopState.highlights),
    );

    if (workshopState.actionProgress.length === 0) {
      setHtml('presenter-action-progress', '<p class="state-empty">No tracked actions on this step.</p>');
    } else {
      const markup = workshopState.actionProgress
        .map(
          (item) =>
            `<div class="list-item"><h3>${escapeHtml(item.label || item.actionId)}</h3><p>${escapeHtml(item.description || 'No description')}</p><div class="inline-meta"><span class="pill">${item.completedCount}/${item.totalParticipants} complete</span><span class="pill">${item.pendingCount} pending</span></div></div>`,
        )
        .join('');
      setHtml('presenter-action-progress', `<div class="list">${markup}</div>`);
    }

    const distribution = Array.isArray(workshopState.stepDistribution) ? workshopState.stepDistribution : [];
    if (distribution.length > 0) {
      const minIdx = workshopState.minPersonalStepIndex;
      const slideIdx = workshopState.currentStepIndex;
      const distMarkup = distribution
        .map((entry) => {
          const tag = entry.stepIndex === slideIdx ? ' (slide)' : '';
          const slow = entry.stepIndex === minIdx && entry.count > 0 ? ' (slowest)' : '';
          return `<div class="list-item"><h3>${entry.stepIndex + 1}. ${escapeHtml(entry.stepTitle)}${tag}${slow}</h3><p>${entry.count} user${entry.count === 1 ? '' : 's'}</p></div>`;
        })
        .join('');
      setHtml('presenter-step-distribution', `<div class="list">${distMarkup}</div>`);
    } else {
      setHtml('presenter-step-distribution', '<p class="state-empty">No participants yet.</p>');
    }

    if (workshopState.participants.length === 0) {
      setHtml('presenter-participants', '<p class="state-empty">No participants connected yet.</p>');
    } else {
      const rows = workshopState.participants
        .map((participant) => {
          const status = getParticipantStatus(participant);
          const stepIdx = Number.isInteger(participant.personalStepIndex) ? participant.personalStepIndex + 1 : '-';
          return `<tr><td>${escapeHtml(participant.participantId)}</td><td>${escapeHtml(participant.role)}</td><td>${escapeHtml(
            participant.seatLabel || '-',
          )}</td><td>${stepIdx}</td><td>${participant.completedStepIds?.length || 0}</td><td><span class="pill ${status.className}">${status.label}</span></td></tr>`;
        })
        .join('');
      setHtml(
        'presenter-participants',
        `<table class="data-table"><thead><tr><th>ID</th><th>Role</th><th>Seat</th><th>Personal Step</th><th>Steps Done</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`,
      );
    }

    if (workshopState.outstandingHelpRequests.length === 0) {
      setHtml('presenter-help-requests', '<p class="state-empty">No active help requests.</p>');
    } else {
      const requestsMarkup = workshopState.outstandingHelpRequests
        .map((request, idx) => {
          const priority = idx === 0 ? '<span class="pill pill-help">priority</span>' : '';
          const stepIdx = Number.isInteger(request.personalStepIndex)
            ? `Step ${request.personalStepIndex + 1}`
            : '';
          return `<div class="list-item"><h3>${escapeHtml(request.seatLabel || request.participantId)} ${priority}</h3><p>${stepIdx} — ${escapeHtml(request.stepTitle || 'Current workshop step')}</p><p>Requested: ${escapeHtml(request.requestedAt)}</p></div>`;
        })
        .join('');
      setHtml('presenter-help-requests', `<div class="list">${requestsMarkup}</div>`);
    }

    const stepSelect = document.getElementById('step-select');
    if (stepSelect) {
      if (workshopState.steps.length === 0) {
        stepSelect.innerHTML = '<option value="-1">No steps available</option>';
      } else {
        stepSelect.innerHTML = workshopState.steps
          .map(
            (step, index) =>
              `<option value="${index}" ${index === workshopState.currentStepIndex ? 'selected' : ''}>${index + 1}. ${escapeHtml(
                step.title,
              )}</option>`,
          )
          .join('');
      }
      stepSelect.disabled = connection.status !== 'connected' || workshopState.steps.length === 0;
    }

    const previousButton = document.getElementById('btn-prev-step');
    const nextButton = document.getElementById('btn-next-step');
    const setStepButton = document.getElementById('btn-set-step');

    if (previousButton) {
      previousButton.disabled = connection.status !== 'connected' || !workshopState.canRetreat;
    }
    if (nextButton) {
      nextButton.disabled = connection.status !== 'connected' || !workshopState.canAdvance;
    }
    if (setStepButton) {
      setStepButton.disabled = connection.status !== 'connected' || workshopState.steps.length === 0;
    }
  }

  function renderUserView() {
    const participant = findParticipant(identity.participantId);
    const personalStepIndex = Number.isInteger(participant?.personalStepIndex)
      ? participant.personalStepIndex
      : workshopState.currentStepIndex;
    const personalStep = workshopState.steps[personalStepIndex] ?? null;
    const currentStep = personalStep ?? getCurrentStep();
    const completedActionIds = new Set(participant?.currentStepActionIds ?? []);
    const completedStepIds = participant?.completedStepIds ?? [];

    setText(
      'user-meta',
      `User: ${identity.participantId} | Seat: ${identity.seatLabel} | Personal step: ${personalStepIndex + 1}/${workshopState.steps.length} | Completed steps: ${completedStepIds.length} | WS: ${connection.url}`,
    );

    setHtml('user-current-step', buildStepMarkup(currentStep, personalStepIndex, workshopState.steps.length, workshopState.highlights));

    if (!currentStep) {
      setHtml('user-actions', '<p class="state-empty">Waiting for presenter step broadcast.</p>');
    } else if (currentStep.actions.length === 0) {
      setHtml('user-actions', '<p class="state-empty">No action clicks required for this step.</p>');
    } else {
      const actionMarkup = currentStep.actions
        .map((action) => {
          const isDone = completedActionIds.has(action.id);
          return `<div class="list-item"><h3>${escapeHtml(action.label)}</h3><p>${escapeHtml(action.description || 'No description')}</p><div class="inline-meta"><span class="pill ${
            isDone ? 'pill-ready' : 'pill-work'
          }">${isDone ? 'done' : 'pending'}</span><button class="button" data-action-id="${escapeHtml(action.id)}" ${
            connection.status !== 'connected' || isDone ? 'disabled' : ''
          }>${isDone ? 'Marked' : 'Mark Done'}</button></div></div>`;
        })
        .join('');
      setHtml('user-actions', `<div class="list">${actionMarkup}</div>`);
    }

    const activeRequestId = participant?.activeHelpRequestId;
    if (activeRequestId) {
      userHelpStatus = `Help request active (${activeRequestId}).`;
    } else if (!activeRequestId && userHelpStatus.startsWith('Help requested')) {
      userHelpStatus = 'No active help request.';
    }
    setText('user-help-status', userHelpStatus);

    const historyMarkup =
      completedStepIds.length === 0
        ? '<p class="state-empty">No completed steps yet.</p>'
        : `<div class="list">${completedStepIds
            .map((stepId) => {
              const step = workshopState.steps.find((item) => item.id === stepId);
              return `<div class="list-item"><h3>${escapeHtml(step?.title || stepId)}</h3><p>${escapeHtml(stepId)}</p></div>`;
            })
            .join('')}</div>`;
    setHtml('user-step-history', historyMarkup);

    const completeStepButton = document.getElementById('btn-complete-step');
    const requestHelpButton = document.getElementById('btn-request-help');
    const openTargetUrlButton = document.getElementById('btn-open-target-url');

    if (completeStepButton) {
      completeStepButton.disabled = connection.status !== 'connected' || !currentStep;
    }

    if (requestHelpButton) {
      requestHelpButton.disabled = connection.status !== 'connected';
    }

    if (openTargetUrlButton) {
      openTargetUrlButton.disabled = !currentStep?.targetUrl;
    }
  }

  function renderUsherView() {
    const userParticipants = workshopState.participants.filter((participant) => participant.role === 'user');

    setText(
      'usher-meta',
      `Usher: ${identity.participantId} | Open queue: ${workshopState.outstandingHelpRequests.length} | Users tracked: ${userParticipants.length} | WS: ${connection.url}`,
    );

    if (workshopState.outstandingHelpRequests.length === 0) {
      setHtml('usher-help-requests', '<p class="state-empty">No active help requests.</p>');
    } else {
      const requestMarkup = workshopState.outstandingHelpRequests
        .map(
          (request) =>
            `<div class="list-item"><h3>${escapeHtml(request.seatLabel || request.participantId)}</h3><p>Step: ${escapeHtml(
              request.stepTitle || 'Current workshop step',
            )}</p><p>Requested: ${escapeHtml(request.requestedAt)}</p><div class="inline-meta"><button class="button button-primary" data-resolve-request="${
              request.requestId
            }" data-participant-id="${escapeHtml(request.participantId)}">Mark Resolved</button></div></div>`,
        )
        .join('');
      setHtml('usher-help-requests', `<div class="list">${requestMarkup}</div>`);
    }

    if (userParticipants.length === 0) {
      setHtml('usher-participants', '<p class="state-empty">No user participants connected yet.</p>');
    } else {
      const rows = userParticipants
        .map((participant) => {
          const status = getParticipantStatus(participant);
          return `<tr><td>${escapeHtml(participant.participantId)}</td><td>${escapeHtml(participant.seatLabel || '-')}</td><td>${escapeHtml(
            participant.currentStepTitle || 'Waiting for workshop steps',
          )}</td><td><span class="pill ${status.className}">${status.label}</span></td></tr>`;
        })
        .join('');
      setHtml(
        'usher-participants',
        `<table class="data-table"><thead><tr><th>ID</th><th>Seat</th><th>Current Step</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`,
      );
    }
  }
}

function resolveWebSocketEndpoint(clientRole, params) {
  const queryEndpoint = params.get('ws') || params.get('endpoint');

  if (queryEndpoint) {
    return queryEndpoint;
  }

  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

  if (clientRole === 'presenter') {
    return `${wsProtocol}://${window.location.host}`;
  }

  if (window.location.port === '5050') {
    return `${wsProtocol}://${window.location.host}`;
  }

  return DEFAULT_PRESENTER_WEBSOCKET_URL;
}

function setupRoleInteractions(roleName, identity, api) {
  if (roleName === 'presenter') {
    const previousButton = document.getElementById('btn-prev-step');
    const nextButton = document.getElementById('btn-next-step');
    const setStepButton = document.getElementById('btn-set-step');
    const stepSelect = document.getElementById('step-select');

    if (previousButton) {
      previousButton.addEventListener('click', () => {
        api.send({ type: 'presenter.previous_step' });
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        api.send({ type: 'presenter.advance_step' });
      });
    }

    if (setStepButton) {
      setStepButton.addEventListener('click', () => {
        const selectedIndex = Number.parseInt(stepSelect?.value ?? '-1', 10);
        if (Number.isInteger(selectedIndex) && selectedIndex >= 0) {
          api.send({
            type: 'presenter.set_step',
            index: selectedIndex,
          });
        }
      });
    }
  }

  if (roleName === 'user') {
    const actionContainer = document.getElementById('user-actions');
    const completeStepButton = document.getElementById('btn-complete-step');
    const requestHelpButton = document.getElementById('btn-request-help');
    const openTargetUrlButton = document.getElementById('btn-open-target-url');

    if (actionContainer) {
      actionContainer.addEventListener('click', (event) => {
        const actionButton = event.target.closest('button[data-action-id]');
        if (!actionButton) {
          return;
        }

        const actionId = actionButton.dataset.actionId;
        if (!actionId) {
          return;
        }

        api.send({
          type: 'user.action_clicked',
          actionId,
        });
      });
    }

    if (completeStepButton) {
      completeStepButton.addEventListener('click', () => {
        const currentStep = api.getCurrentStep();
        const participant = api.findParticipant(identity.participantId);
        api.send({
          type: 'user.step_complete',
          stepId: currentStep?.id ?? null,
          actionIds: participant?.currentStepActionIds ?? [],
        });
      });
    }

    if (requestHelpButton) {
      requestHelpButton.addEventListener('click', () => {
        api.send({
          type: 'user.help_request',
          requestId: `help-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
      });
    }

    if (openTargetUrlButton) {
      openTargetUrlButton.addEventListener('click', () => {
        const currentStep = api.getCurrentStep();
        const targetUrl = normalizeAwsTargetUrl(currentStep?.targetUrl);

        if (!targetUrl) {
          return;
        }

        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      });
    }
  }

  if (roleName === 'usher') {
    const requestContainer = document.getElementById('usher-help-requests');

    if (requestContainer) {
      requestContainer.addEventListener('click', (event) => {
        const resolveButton = event.target.closest('button[data-resolve-request]');
        if (!resolveButton) {
          return;
        }

        const requestId = resolveButton.dataset.resolveRequest;
        const participantId = resolveButton.dataset.participantId;

        if (!requestId || !participantId) {
          return;
        }

        const notes = window.prompt('Resolution notes (optional):', 'Resolved by usher') ?? '';
        api.send({
          type: 'usher.concern_resolved',
          usherId: identity.participantId,
          requestId,
          participantId,
          notes,
        });
      });
    }
  }
}

function safeParseMessage(rawMessage) {
  try {
    return JSON.parse(rawMessage);
  } catch (error) {
    return null;
  }
}

function normalizeAwsTargetUrl(url) {
  if (!url) {
    return '';
  }

  if (url === 'https://signin.aws.amazon.com/signin') {
    return 'https://signin.aws.amazon.com/console';
  }

  return url;
}

function setText(elementId, value) {
  const node = document.getElementById(elementId);
  if (!node) {
    return;
  }
  node.textContent = value;
}

function setHtml(elementId, value) {
  const node = document.getElementById(elementId);
  if (!node) {
    return;
  }
  node.innerHTML = value;
}

function buildStepMarkup(step, currentStepIndex, totalSteps, highlights) {
  if (!step) {
    return '<p class="state-empty">Waiting for workshop step broadcast.</p>';
  }

  const highlightsMarkup = Array.isArray(highlights) && highlights.length > 0
    ? `<div class="list">${highlights
        .map((highlight) => `<div class="list-item"><h3>${escapeHtml(highlight.label || highlight.actionId)}</h3><p>${escapeHtml(highlight.selector || 'No selector')}</p></div>`)
        .join('')}</div>`
    : '<p class="state-empty">No highlight selectors defined for this step.</p>';

  return `
    <div class="list-item">
      <h3>Step ${Number.isInteger(currentStepIndex) ? currentStepIndex + 1 : '-'} of ${totalSteps}</h3>
      <p>${escapeHtml(step.phase || 'No phase')}</p>
      <p><strong>${escapeHtml(step.title)}</strong></p>
      <p>${escapeHtml(step.description || 'No description')}</p>
      <p>Target URL: ${escapeHtml(step.targetUrl || 'N/A')}</p>
    </div>
    <h3>Highlights</h3>
    ${highlightsMarkup}
  `;
}

function getParticipantStatus(participant) {
  if (participant.activeHelpRequestId) {
    return {
      label: 'needs help',
      className: 'pill-help',
    };
  }

  if (participant.isCurrentStepComplete) {
    return {
      label: 'ready',
      className: 'pill-ready',
    };
  }

  return {
    label: 'working',
    className: 'pill-work',
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
