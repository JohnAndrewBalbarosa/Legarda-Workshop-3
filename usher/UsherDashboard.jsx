import React, { useEffect, useRef, useState } from 'react';
import { connectToPresenter } from './websocket.js';
import { HelpQueue } from './modules/HelpQueue.js';
import { ResolutionNotifier } from './modules/ResolutionNotifier.js';

const UsherDashboard = ({
  usherId = 'usher-local',
  endpointUrls,
}) => {
  const [connectionStatus, setConnectionStatus] = useState({
    status: 'connecting',
    url: endpointUrls?.[0] ?? 'ws://10.250.250.1:5050',
  });
  const [requests, setRequests] = useState([]);
  const [participants, setParticipants] = useState([]);
  const queueRef = useRef(new HelpQueue());
  const connectionRef = useRef(null);
  const notifierRef = useRef(new ResolutionNotifier());

  useEffect(() => {
    const connection = connectToPresenter({
      usherId,
      endpoints: endpointUrls,
      onState: (state) => {
        queueRef.current.sync(state.outstandingHelpRequests ?? []);
        setRequests(queueRef.current.getQueue());
        setParticipants(state.participants ?? []);
      },
      onConnectionChange: setConnectionStatus,
      onMessage: (message) => {
        if (message.type === 'help_request_created' && message.request) {
          queueRef.current.addHelpRequest(message.request);
          setRequests(queueRef.current.getQueue());
        }

        if (message.type === 'help_resolved' && message.requestId) {
          queueRef.current.resolveHelpRequest(message.requestId);
          setRequests(queueRef.current.getQueue());
        }
      },
    });

    connectionRef.current = connection;
    notifierRef.current.setSendMessage((payload) => connection.send(payload));

    return () => {
      connectionRef.current = null;
      connection.close();
    };
  }, [usherId, endpointUrls]);

  function findParticipant(participantId) {
    return participants.find((participant) => participant.participantId === participantId) ?? null;
  }

  function handleResolve(request) {
    queueRef.current.resolveHelpRequest(request.requestId);
    setRequests(queueRef.current.getQueue());
    notifierRef.current.notifyResolution({
      requestId: request.requestId,
      participantId: request.participantId,
      usherId,
    });
  }

  return (
    <div
      className="usher-dashboard"
      style={{
        minHeight: '100vh',
        padding: '24px',
        background:
          'radial-gradient(circle at top left, rgba(249,115,22,0.14), transparent 28%), linear-gradient(180deg, #fffaf5 0%, #fff4e6 100%)',
        color: '#1f2937',
        fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '1080px',
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
                backgroundColor: '#ffedd5',
                color: '#9a3412',
                fontWeight: 700,
              }}
            >
              Usher dashboard
            </div>
            <h1 style={{ margin: '12px 0 8px' }}>Live help queue</h1>
            <p style={{ margin: 0, color: '#7c2d12' }}>
              See who needs support, where they are seated, and which step they are currently on.
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

        <section
          style={{
            borderRadius: '18px',
            padding: '20px',
            backgroundColor: '#ffffff',
            border: '1px solid #fed7aa',
            boxShadow: '0 14px 40px rgba(154, 52, 18, 0.08)',
            display: 'grid',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Outstanding requests</h2>
            <strong>{requests.length} open</strong>
          </div>

          {requests.length ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              {requests.map((request) => {
                const participant = findParticipant(request.participantId);

                return (
                  <article
                    key={request.requestId}
                    style={{
                      borderRadius: '14px',
                      padding: '16px',
                      border: '1px solid #fdba74',
                      backgroundColor: '#fff7ed',
                      display: 'grid',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <strong>{request.seatLabel || request.participantId}</strong>
                      <span style={{ color: '#9a3412', fontWeight: 700 }}>Waiting for help</span>
                    </div>
                    <div style={{ color: '#7c2d12' }}>
                      Step: {request.stepTitle || participant?.currentStepTitle || 'Current workshop step'}
                    </div>
                    <div style={{ color: '#9a3412', fontSize: '0.9rem' }}>
                      Requested at {request.requestedAt}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResolve(request)}
                      style={{
                        width: 'fit-content',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        backgroundColor: '#9a3412',
                        color: '#ffffff',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Mark resolved
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, color: '#9a3412' }}>No participants are currently waiting for help.</p>
          )}
        </section>

        <section
          style={{
            borderRadius: '18px',
            padding: '20px',
            backgroundColor: '#ffffff',
            border: '1px solid #fed7aa',
            boxShadow: '0 14px 40px rgba(154, 52, 18, 0.08)',
            display: 'grid',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Participant status</h2>
            <strong>{participants.filter((participant) => participant.role === 'user').length} tracked</strong>
          </div>

          {participants.filter((participant) => participant.role === 'user').length ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              {participants
                .filter((participant) => participant.role === 'user')
                .map((participant) => (
                  <article
                    key={participant.participantId}
                    style={{
                      borderRadius: '14px',
                      padding: '16px',
                      border: '1px solid #fdba74',
                      backgroundColor: '#fffaf5',
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <strong>{participant.seatLabel || participant.participantId}</strong>
                      <span style={{ color: participant.activeHelpRequestId ? '#b91c1c' : '#9a3412', fontWeight: 700 }}>
                        {participant.activeHelpRequestId
                          ? 'Needs help'
                          : participant.isCurrentStepComplete
                            ? 'Ready for next step'
                            : 'Working'}
                      </span>
                    </div>
                    <div style={{ color: '#7c2d12' }}>
                      Current step: {participant.currentStepTitle || 'Waiting for workshop steps'}
                    </div>
                    <div style={{ color: '#9a3412', fontSize: '0.9rem' }}>
                      Completed steps: {participant.completedStepIds?.length ?? 0}
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: '#9a3412' }}>Participant status will appear here after users connect.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default UsherDashboard;
