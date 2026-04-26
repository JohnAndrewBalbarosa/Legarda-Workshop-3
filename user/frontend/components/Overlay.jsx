import React, { useEffect } from 'react';

const Overlay = ({
  step = null,
  highlights = [],
  completedActionIds = [],
  onActionClick = () => {},
  connectionStatus = 'connecting',
}) => {
  const completedActionSet = new Set(completedActionIds);
  const actions = step?.actions ?? [];
  const focusItems = highlights.length
    ? highlights
    : actions.map((action) => ({
        actionId: action.id,
        label: action.label,
        selector: action.selector,
        description: action.description,
      }));

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const highlightedElements = [];

    for (const item of focusItems) {
      if (!item?.selector) {
        continue;
      }

      let matchedElements = [];

      try {
        matchedElements = Array.from(document.querySelectorAll(item.selector));
      } catch (error) {
        matchedElements = [];
      }

      for (const element of matchedElements) {
        element.setAttribute('data-workshop-highlight', 'true');
        highlightedElements.push(element);
      }
    }

    return () => {
      for (const element of highlightedElements) {
        element.removeAttribute('data-workshop-highlight');
      }
    };
  }, [focusItems]);

  return (
    <section
      className="overlay"
      style={{
        borderRadius: '18px',
        padding: '20px',
        background:
          'linear-gradient(145deg, rgba(14,165,233,0.12), rgba(37,99,235,0.06)), #ffffff',
        border: '1px solid #dbeafe',
        boxShadow: '0 14px 40px rgba(14, 116, 144, 0.08)',
      }}
    >
      <style>
        {`
          @keyframes overlayPulse {
            0% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.35); }
            70% { box-shadow: 0 0 0 12px rgba(14, 165, 233, 0); }
            100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0); }
          }

          [data-workshop-highlight="true"] {
            position: relative;
            outline: 3px solid #0ea5e9 !important;
            outline-offset: 3px !important;
            animation: overlayPulse 1.8s ease-out infinite;
          }
        `}
      </style>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div
            style={{
              display: 'inline-flex',
              padding: '4px 10px',
              borderRadius: '999px',
              backgroundColor: '#e0f2fe',
              color: '#075985',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            Overlay guidance
          </div>
          <h2 style={{ margin: '12px 0 8px' }}>{step?.title ?? 'Waiting for the presenter'}</h2>
          {step?.phase ? <div style={{ marginBottom: '8px', color: '#075985', fontWeight: 700 }}>{step.phase}</div> : null}
          <p style={{ margin: 0, color: '#475569' }}>
            {step?.description ||
              'Waiting for the presenter to broadcast the next workshop instruction.'}
          </p>
          {step?.targetUrl ? (
            <div style={{ marginTop: '10px', color: '#64748b', fontSize: '0.9rem' }}>
              Target URL: {step.targetUrl}
            </div>
          ) : null}
        </div>
        <div
          style={{
            alignSelf: 'flex-start',
            borderRadius: '999px',
            padding: '6px 12px',
            backgroundColor: connectionStatus === 'connected' ? '#ecfdf5' : '#fff7ed',
            color: connectionStatus === 'connected' ? '#166534' : '#9a3412',
            fontWeight: 700,
          }}
        >
          {connectionStatus}
        </div>
      </div>

      <div style={{ marginTop: '18px', display: 'grid', gap: '12px' }}>
        {focusItems.length ? (
          focusItems.map((item) => {
            const action = actions.find((candidate) => candidate.id === item.actionId) ?? null;
            const isCompleted = action ? completedActionSet.has(action.id) : false;

            return (
              <article
                key={item.actionId}
                style={{
                  display: 'grid',
                  gap: '8px',
                  borderRadius: '14px',
                  border: isCompleted ? '1px solid #86efac' : '1px solid #38bdf8',
                  backgroundColor: isCompleted ? '#f0fdf4' : '#f8fafc',
                  padding: '14px 16px',
                  animation: isCompleted ? 'none' : 'overlayPulse 1.8s ease-out infinite',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <strong>{item.label}</strong>
                  <span style={{ color: isCompleted ? '#166534' : '#475569', fontWeight: 600 }}>
                    {action ? (isCompleted ? 'Completed' : 'Waiting') : 'Highlighted'}
                  </span>
                </div>
                {item.selector ? (
                  <code
                    style={{
                      display: 'inline-block',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      backgroundColor: '#e2e8f0',
                      color: '#0f172a',
                      width: 'fit-content',
                    }}
                  >
                    {item.selector}
                  </code>
                ) : null}
                {item.description ? <p style={{ margin: 0, color: '#475569' }}>{item.description}</p> : null}
                {action ? (
                  <button
                    type="button"
                    onClick={() => onActionClick(action.id)}
                    disabled={isCompleted}
                    style={{
                      width: 'fit-content',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      backgroundColor: isCompleted ? '#bbf7d0' : '#0f172a',
                      color: isCompleted ? '#166534' : '#ffffff',
                      fontWeight: 700,
                      cursor: isCompleted ? 'default' : 'pointer',
                    }}
                  >
                    {isCompleted ? 'Action completed' : 'Mark action complete'}
                  </button>
                ) : (
                  <div style={{ color: '#475569', fontWeight: 600 }}>
                    Watch for the blinking highlight on the target area.
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <div
            style={{
              borderRadius: '14px',
              padding: '16px',
              backgroundColor: '#f8fafc',
              color: '#64748b',
            }}
          >
            No highlighted actions are available for the current step yet.
          </div>
        )}
      </div>
    </section>
  );
};

export default Overlay;
