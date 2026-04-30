import React from 'react';

const sectionStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7deea',
  borderRadius: '16px',
  padding: '20px',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
};

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '999px',
  padding: '4px 10px',
  backgroundColor: '#eff6ff',
  color: '#1d4ed8',
  fontSize: '0.85rem',
  fontWeight: 600,
};

function renderParticipantStatus(participant) {
  if (participant.activeHelpRequestId) {
    return 'Needs help';
  }

  if (participant.isCurrentStepComplete) {
    return 'Ready for next step';
  }

  return 'Working';
}

function calculateProgress(participant, totalSteps) {
  if (!totalSteps) {
    return 0;
  }

  return Math.round(((participant.completedStepIds?.length ?? 0) / totalSteps) * 100);
}

const Dashboard = ({
  state = {
    currentStepIndex: -1,
    currentStep: null,
    steps: [],
    actionProgress: [],
    stepDistribution: [],
    minPersonalStepIndex: -1,
    participants: [],
    outstandingHelpRequests: [],
    reportSummary: null,
    canAdvance: false,
    canRetreat: false,
    allUsersComplete: false,
  },
  onAdvanceStep = () => {},
  onRetreatStep = () => {},
  onExportReport = () => {},
}) => {
  const reportSummary = state.reportSummary ?? {
    totalParticipants: 0,
    completedParticipants: 0,
    outstandingHelpRequests: 0,
    resolvedHelpRequests: 0,
  };

  return (
    <div
      className="dashboard"
      style={{
        minHeight: '100vh',
        padding: '32px',
        background:
          'radial-gradient(circle at top left, rgba(59,130,246,0.14), transparent 35%), linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)',
        color: '#0f172a',
        fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gap: '24px',
        }}
      >
        <section style={{ ...sectionStyle, display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={badgeStyle}>Presenter command center</div>
              <h1 style={{ margin: '12px 0 8px', fontSize: '2rem' }}>Workshop dashboard</h1>
              <p style={{ margin: 0, color: '#475569', maxWidth: '720px' }}>
                Keep the room synchronized, watch for help requests, and move the workshop forward when everyone is ready.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onRetreatStep}
                disabled={!state.canRetreat}
                style={{
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  padding: '12px 16px',
                  fontWeight: 600,
                  cursor: state.canRetreat ? 'pointer' : 'not-allowed',
                }}
              >
                Previous step
              </button>
              <button
                type="button"
                onClick={onAdvanceStep}
                disabled={!state.canAdvance}
                style={{
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '12px 16px',
                  fontWeight: 600,
                  cursor: state.canAdvance ? 'pointer' : 'not-allowed',
                }}
              >
                Advance step
              </button>
              <button
                type="button"
                onClick={onExportReport}
                style={{
                  borderRadius: '12px',
                  border: '1px solid #94a3b8',
                  backgroundColor: '#eff6ff',
                  color: '#0f172a',
                  padding: '12px 16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Export report
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
            }}
          >
            <div style={sectionStyle}>
              <strong>{reportSummary.totalParticipants}</strong>
              <div style={{ color: '#475569' }}>Participants connected</div>
            </div>
            <div style={sectionStyle}>
              <strong>{reportSummary.completedParticipants}</strong>
              <div style={{ color: '#475569' }}>Completed workshop</div>
            </div>
            <div style={sectionStyle}>
              <strong>{reportSummary.outstandingHelpRequests}</strong>
              <div style={{ color: '#475569' }}>Open help requests</div>
            </div>
            <div style={sectionStyle}>
              <strong>{reportSummary.resolvedHelpRequests}</strong>
              <div style={{ color: '#475569' }}>Resolved concerns</div>
            </div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
            gap: '24px',
          }}
        >
          <div style={{ ...sectionStyle, display: 'grid', gap: '16px' }}>
            <div>
              <div style={badgeStyle}>
                Step {state.currentStepIndex >= 0 ? state.currentStepIndex + 1 : 0} of {state.steps.length}
              </div>
              {state.currentStep?.phase ? (
                <div style={{ marginTop: '10px', color: '#1d4ed8', fontWeight: 600 }}>{state.currentStep.phase}</div>
              ) : null}
              <h2 style={{ marginBottom: '8px' }}>{state.currentStep?.title ?? 'Waiting for workshop steps'}</h2>
              <p style={{ margin: 0, color: '#475569' }}>
                {state.currentStep?.description || 'Waiting for the presenter to load or broadcast the current workshop step.'}
              </p>
              {state.currentStep?.targetUrl ? (
                <div style={{ marginTop: '10px', color: '#64748b', fontSize: '0.9rem' }}>
                  Target URL: {state.currentStep.targetUrl}
                </div>
              ) : null}
            </div>

            <div>
              <h3 style={{ marginBottom: '10px' }}>Current highlights</h3>
              {state.highlights?.length ? (
                <ul style={{ margin: 0, paddingLeft: '18px', color: '#334155' }}>
                  {state.highlights.map((highlight) => (
                    <li key={highlight.actionId}>
                      {highlight.label}
                      {highlight.selector ? ` (${highlight.selector})` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, color: '#64748b' }}>No highlight selectors are defined for the current step yet.</p>
              )}
            </div>

            {state.actionProgress?.length ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                <h3 style={{ margin: 0 }}>Room Progress By Section</h3>
                {state.actionProgress.map((item) => (
                  <div
                    key={item.actionId}
                    style={{
                      borderRadius: '12px',
                      padding: '12px 14px',
                      border: '1px solid #d7deea',
                      backgroundColor: '#f8fbff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <strong>{item.label}</strong>
                      <span style={{ color: '#475569', fontWeight: 600 }}>
                        {item.completedCount}/{item.totalParticipants} complete
                      </span>
                    </div>
                    {item.description ? (
                      <div style={{ marginTop: '6px', color: '#64748b', fontSize: '0.9rem' }}>{item.description}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {state.allUsersComplete ? (
              <div
                style={{
                  borderRadius: '12px',
                  padding: '14px 16px',
                  backgroundColor: '#ecfdf5',
                  color: '#166534',
                  fontWeight: 600,
                }}
              >
                Everyone connected is past the slide step. The slide will auto-advance.
              </div>
            ) : null}

            {state.stepDistribution?.length ? (
              <div style={{ display: 'grid', gap: '8px' }}>
                <h3 style={{ margin: 0 }}>Step Distribution</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                  Slide auto-advances when every user passes the current step. Lowest step gets help priority.
                </p>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {state.stepDistribution.map((entry) => {
                    const isSlide = entry.stepIndex === state.currentStepIndex;
                    const isBaseline = entry.stepIndex === state.minPersonalStepIndex;
                    return (
                      <div
                        key={entry.stepId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '12px',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          border: isSlide ? '2px solid #2563eb' : '1px solid #d7deea',
                          backgroundColor: isBaseline ? '#fef3c7' : '#ffffff',
                        }}
                      >
                        <span>
                          <strong>{entry.stepIndex + 1}.</strong> {entry.stepTitle}
                          {isSlide ? <span style={{ marginLeft: 8, color: '#2563eb', fontWeight: 700 }}>(slide)</span> : null}
                          {isBaseline && entry.count > 0 ? <span style={{ marginLeft: 8, color: '#92400e', fontWeight: 700 }}>(slowest)</span> : null}
                        </span>
                        <span style={{ fontWeight: 700 }}>{entry.count} user{entry.count === 1 ? '' : 's'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ ...sectionStyle, display: 'grid', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0 }}>Participant progress</h2>
                <p style={{ margin: '8px 0 0', color: '#64748b' }}>
                  See who is working, who is ready, and who needs support.
                </p>
              </div>
            </div>

            {state.participants.length ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                {state.participants
                  .filter((participant) => participant.role === 'user')
                  .map((participant) => {
                    const progress = calculateProgress(participant, state.steps.length);

                    return (
                      <article
                        key={participant.participantId}
                        style={{
                          border: '1px solid #d7deea',
                          borderRadius: '14px',
                          padding: '14px 16px',
                          display: 'grid',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                          <strong>{participant.seatLabel || participant.participantId}</strong>
                          <span style={badgeStyle}>{renderParticipantStatus(participant)}</span>
                        </div>
                        <div style={{ color: '#334155' }}>
                          Current step: {participant.currentStepTitle || 'Waiting for workshop steps'}
                        </div>
                        <div
                          style={{
                            height: '10px',
                            borderRadius: '999px',
                            overflow: 'hidden',
                            backgroundColor: '#e2e8f0',
                          }}
                        >
                          <div
                            style={{
                              width: `${progress}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                            }}
                          />
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                          Completed steps: {participant.completedStepIds.length} of {state.steps.length || 0}
                        </div>
                      </article>
                    );
                  })}
              </div>
            ) : (
              <p style={{ margin: 0, color: '#64748b' }}>No participant connections yet.</p>
            )}
          </div>
        </section>

        <section style={{ ...sectionStyle, display: 'grid', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Help queue</h2>
          {state.outstandingHelpRequests.length ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              {state.outstandingHelpRequests.map((request) => (
                <article
                  key={request.requestId}
                  style={{
                    borderRadius: '14px',
                    padding: '14px 16px',
                    border: '1px solid #fecaca',
                    backgroundColor: '#fff7f7',
                  }}
                >
                  <strong>{request.seatLabel || request.participantId}</strong>
                  <div style={{ color: '#7f1d1d', marginTop: '6px' }}>
                    Needs help on {request.stepTitle || 'the current step'}.
                  </div>
                  <div style={{ color: '#991b1b', fontSize: '0.9rem', marginTop: '6px' }}>
                    Requested at {request.requestedAt}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: '#64748b' }}>No open concerns right now.</p>
          )}
        </section>
      </div>

      {state.allUsersComplete ? (
        <aside
          style={{
            position: 'fixed',
            right: '24px',
            bottom: '24px',
            maxWidth: '320px',
            borderRadius: '16px',
            padding: '16px 18px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.24)',
          }}
        >
          <strong>Room ready to advance</strong>
          <div style={{ marginTop: '8px', color: '#cbd5e1' }}>
            Everyone connected has completed the current step.
          </div>
        </aside>
      ) : null}
    </div>
  );
};

export default Dashboard;
