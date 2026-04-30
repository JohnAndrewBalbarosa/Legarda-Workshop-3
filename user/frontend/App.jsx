import React, { useEffect, useRef, useState } from 'react';
import { connectToPresenter } from '../backend/websocket.js';
import { HelpRequestManager } from '../modules/HelpRequest.js';
import { getCurrentStep, normalizeSteps } from '../modules/StepUtils.js';
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

// In a non-Playwright browser session we can compare current URL using a tiny
// subset of the highlight-engine's URL→profile mapping. Source of truth lives
// in user/highlight-engine.mjs; this is a small inline mirror so the React app
// can render the correct/wrong banner without importing the .mjs build artifact.
// Profiles that sit in the sign-in corridor between aws-home and console-home.
// Any URL resolving to one of these is treated as "in transit" rather than wrong.
const TRANSITIONAL_PROFILE_IDS = new Set([
  'signin-choice', 'signin-root-existing', 'signin-root-iam',
  'signup-root-new', 'signin-password', 'signin-mfa',
]);

function detectProfile(url) {
  if (typeof url !== 'string') return null;
  if (url.includes('signup.aws.amazon.com') || url.includes('portal.aws.amazon.com/billing/signup')) return 'signup-root-new';
  if (url.includes('signin.aws.amazon.com/authenticate') || url.includes('signin.aws.amazon.com/password')) return 'signin-password';
  if (url.includes('signin.aws.amazon.com/mfa') || url.includes('signin.aws.amazon.com/email-otp') || url.includes('signin.aws.amazon.com/challenge')) return 'signin-mfa';
  if (url.includes('signin.aws.amazon.com/signin') || url.includes('signin.aws.amazon.com/?') || url.includes('signin.aws.amazon.com/oauth')) return 'signin-choice';
  if (url.includes('signin.aws.amazon.com')) return 'signin-choice'; // catch-all for any other signin page
  if (url.includes('console.aws.amazon.com/ec2/') && url.includes('#LaunchInstances')) return 'ec2-launch-form';
  if (url.includes('console.aws.amazon.com/ec2/')) return 'ec2-dashboard';
  if (url.includes('console.aws.amazon.com/console/home') || /console\.aws\.amazon\.com\/?($|\?)/.test(url)) return 'console-home';
  if (url.includes('aws.amazon.com')) return 'aws-home';
  return null;
}

function compareUrlToStep(step, url) {
  const expected = step?.expectedProfile;
  if (!expected) return 'unknown';
  const profileId = detectProfile(url);
  if (!profileId) return 'unknown';
  if (profileId === expected) return 'correct';
  if (TRANSITIONAL_PROFILE_IDS.has(profileId) && !TRANSITIONAL_PROFILE_IDS.has(expected)) return 'unknown';
  return 'wrong';
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
  const [completedStepIds, setCompletedStepIds] = useState([]);
  const [helpRequestStatus, setHelpRequestStatus] = useState(null);
  const [currentBrowserUrl, setCurrentBrowserUrl] = useState(
    typeof window !== 'undefined' ? window.location.href : '',
  );
  const connectionRef = useRef(null);
  const helpRequestManagerRef = useRef(null);
  const lastReportedUrlRef = useRef('');

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

        if (message.type === 'help_claimed' && message.participantId === participantId) {
          helpRequestManagerRef.current.claimRequest({
            requestId: message.requestId,
            usherId: message.usherId,
            claimedAt: message.claimedAt,
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

  // Track navigation in the host page (when running outside Playwright) so the
  // React-only path can also show correct-link / wrong-link feedback.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateUrl = () => setCurrentBrowserUrl(window.location.href);
    window.addEventListener('popstate', updateUrl);
    window.addEventListener('hashchange', updateUrl);
    const interval = window.setInterval(updateUrl, 1000);

    return () => {
      window.removeEventListener('popstate', updateUrl);
      window.removeEventListener('hashchange', updateUrl);
      window.clearInterval(interval);
    };
  }, []);

  const currentStep = workshopState.currentStep ?? getCurrentStep(workshopState.steps, workshopState.currentStepIndex);
  const urlStatus = compareUrlToStep(currentStep, currentBrowserUrl);

  // Mirror the URL status to presenter so the dashboard knows where each
  // participant actually is. Only send when the URL changes.
  useEffect(() => {
    if (!connectionRef.current) return;
    if (lastReportedUrlRef.current === currentBrowserUrl) return;
    lastReportedUrlRef.current = currentBrowserUrl;
    connectionRef.current.send({
      type: 'user.url_report',
      url: currentBrowserUrl,
      urlStatus,
      profileId: detectProfile(currentBrowserUrl),
    });
  }, [currentBrowserUrl, urlStatus]);

  function handleRequestHelp() {
    helpRequestManagerRef.current.sendHelpRequest({
      participantId,
      currentStep,
    });
  }

  function handleGoBack() {
    if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
      window.history.back();
    }
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
              Seat: {seatLabel}. Stay in sync with the presenter and follow the highlighted action.
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
          completedActionIds={[]}
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
            onRequestHelp={handleRequestHelp}
            onGoBack={handleGoBack}
            connectionStatus={connectionStatus.status}
            urlStatus={urlStatus}
            helpRequestStatus={helpRequestStatus}
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
