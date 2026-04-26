import React, { useEffect, useRef, useState } from 'react';
import { connectToPresenter } from '../backend/websocket.js';
import { HelpRequestManager } from '../modules/HelpRequest.js';
import { getCurrentStep, normalizeSteps, registerActionCompletion } from '../modules/StepUtils.js';
import AssistanceButton from './components/AssistanceButton';
import Overlay from './components/Overlay';
import StepNavigator from './components/StepNavigator';

const DEFAULT_WORKSHOP_STATE = {
  currentStepIndex: -1,
  currentStep: null,
  steps: [],
  highlights: [],
  participants: [],
  outstandingHelpRequests: [],
};

function findParticipantState(state, participantId) {
  return (state.participants ?? []).find((participant) => participant.participantId === participantId) ?? null;
}

const App = ({
  participantId = 'participant-local',
  seatLabel = 'Seat not assigned',
  endpointUrls,
}) => {
  const [workshopState, setWorkshopState] = useState(DEFAULT_WORKSHOP_STATE);
  const [connectionStatus, setConnectionStatus] = useState({
    status: 'connecting',
    url: endpointUrls?.[0] ?? 'ws://10.250.250.1:5050',
  });
  const [completedActionIds, setCompletedActionIds] = useState([]);
  const [completedStepIds, setCompletedStepIds] = useState([]);
  const [helpRequestStatus, setHelpRequestStatus] = useState(null);
  const connectionRef = useRef(null);
  const helpRequestManagerRef = useRef(null);

  if (!helpRequestManagerRef.current) {
    helpRequestManagerRef.current = new HelpRequestManager({
      seatLabel,
      onStatusChange: setHelpRequestStatus,
    });
  }

  useEffect(() => {
    const connection = connectToPresenter({
      participantId,
      seatLabel,
      endpoints: endpointUrls,
      onState: (incomingState) => {
        const normalizedSteps = normalizeSteps(incomingState.steps ?? []);
        const currentStep = getCurrentStep(normalizedSteps, incomingState.currentStepIndex);
        const nextState = {
          ...DEFAULT_WORKSHOP_STATE,
          ...incomingState,
          steps: normalizedSteps,
          currentStep,
        };
        const participantState = findParticipantState(nextState, participantId);

        setWorkshopState(nextState);
        setCompletedActionIds(participantState?.currentStepActionIds ?? []);
        setCompletedStepIds(participantState?.completedStepIds ?? []);
      },
      onConnectionChange: setConnectionStatus,
      onMessage: (message) => {
        if (message.type === 'help_request_created' && message.request?.participantId === participantId) {
          helpRequestManagerRef.current.acknowledgeRequest({
            requestId: message.request.requestId,
            requestedAt: message.request.requestedAt,
            stepId: message.request.stepId,
            stepTitle: message.request.stepTitle,
          });
        }

        if (message.type === 'help_resolved' && message.participantId === participantId) {
          helpRequestManagerRef.current.resolveRequest({
            requestId: message.requestId,
            resolvedAt: message.resolvedAt,
            notes: message.notes,
          });
        }
      },
    });

    connectionRef.current = connection;
    helpRequestManagerRef.current.setSendMessage((payload) => connection.send(payload));

    return () => {
      connectionRef.current = null;
      connection.close();
    };
  }, [participantId, seatLabel, endpointUrls]);

  const currentStep = workshopState.currentStep ?? getCurrentStep(workshopState.steps, workshopState.currentStepIndex);

  function handleActionClick(actionId) {
    if (!currentStep) {
      return;
    }

    let nextResult = null;

    setCompletedActionIds((previousCompletedActionIds) => {
      nextResult = registerActionCompletion(currentStep, previousCompletedActionIds, actionId);
      return nextResult.completedActionIds;
    });

    connectionRef.current?.sendActionClick(actionId);

    if (!nextResult || !nextResult.isComplete) {
      return;
    }

    setCompletedStepIds((previousCompletedStepIds) => {
      if (previousCompletedStepIds.includes(currentStep.id)) {
        return previousCompletedStepIds;
      }

      return [...previousCompletedStepIds, currentStep.id];
    });

    connectionRef.current?.sendStepComplete({
      stepId: currentStep.id,
      actionIds: nextResult.completedActionIds,
    });
  }

  function handleRequestHelp() {
    helpRequestManagerRef.current.sendHelpRequest({
      participantId,
      currentStep,
    });
  }

  return (
    <div
      className="app-root"
      style={{
        minHeight: '100vh',
        padding: '24px',
        background:
          'radial-gradient(circle at top right, rgba(14,165,233,0.14), transparent 25%), linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)',
        color: '#0f172a',
        fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '1180px',
          margin: '0 auto',
          display: 'grid',
          gap: '20px',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                padding: '4px 10px',
                borderRadius: '999px',
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                fontWeight: 700,
              }}
            >
              Participant workspace
            </div>
            <h1 style={{ margin: '12px 0 8px' }}>EC2 workshop guide</h1>
            <p style={{ margin: 0, color: '#475569' }}>
              Seat: {seatLabel}. Stay in sync with the presenter and complete each highlighted action before moving on.
            </p>
          </div>
          <div
            style={{
              borderRadius: '14px',
              padding: '14px 16px',
              backgroundColor: connectionStatus.status === 'connected' ? '#ecfdf5' : '#fff7ed',
              color: connectionStatus.status === 'connected' ? '#166534' : '#9a3412',
              minWidth: '220px',
            }}
          >
            <strong>{connectionStatus.status}</strong>
            <div style={{ marginTop: '6px', fontSize: '0.9rem' }}>{connectionStatus.url}</div>
          </div>
        </header>

        <StepNavigator
          steps={workshopState.steps}
          currentStepIndex={workshopState.currentStepIndex}
          completedStepIds={completedStepIds}
          completedActionIds={completedActionIds}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
            gap: '20px',
          }}
        >
          <Overlay
            step={currentStep}
            highlights={workshopState.highlights}
            completedActionIds={completedActionIds}
            onActionClick={handleActionClick}
            connectionStatus={connectionStatus.status}
          />
          <AssistanceButton
            onRequestHelp={handleRequestHelp}
            requestStatus={helpRequestStatus}
            disabled={connectionStatus.status !== 'connected'}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
