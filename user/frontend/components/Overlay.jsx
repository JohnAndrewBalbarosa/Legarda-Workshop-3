import React, { useEffect } from 'react';

const Overlay = ({
  step = null,
  highlights = [],
  onRequestHelp = () => {},
  onGoBack = () => {},
  connectionStatus = 'connecting',
  urlStatus = 'unknown',
  helpRequestStatus = null,
}) => {
  const actions = step?.actions ?? [];
  const focusItems = highlights.length
    ? highlights
    : actions.map((action) => ({
        actionId: action.id,
        label: action.label,
        selector: action.selector,
        description: action.description,
      }));

  // Suppress visual highlight when the participant is on the wrong link —
  // blinking would otherwise point at elements that no longer exist on the
  // current page.
  const shouldHighlight = urlStatus !== 'wrong';

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    if (!shouldHighlight) {
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
  }, [focusItems, shouldHighlight]);

  const banner =
    urlStatus === 'wrong'
      ? { color: '#b91c1c', bg: '#fee2e2', text: 'Wrong link — go back' }
      : urlStatus === 'correct'
        ? { color: '#166534', bg: '#dcfce7', text: 'You are at the correct link' }
        : { color: '#475569', bg: '#e2e8f0', text: 'Checking your location…' };

  const hasOpenHelp = helpRequestStatus && helpRequestStatus.status !== 'resolved';
  const oblong =
    urlStatus === 'wrong'
      ? { label: 'Go back', bg: '#b91c1c', onClick: onGoBack, disabled: false }
      : {
          label: hasOpenHelp ? 'Help requested' : 'Ask for help',
          bg: hasOpenHelp ? '#fdba74' : '#ea580c',
          onClick: onRequestHelp,
          disabled: hasOpenHelp || connectionStatus !== 'connected',
        };

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
          <div
            style={{
              display: 'inline-flex',
              marginLeft: '10px',
              padding: '4px 10px',
              borderRadius: '999px',
              backgroundColor: banner.bg,
              color: banner.color,
              fontWeight: 800,
              fontSize: '0.8rem',
              letterSpacing: '0.4px',
            }}
          >
            {banner.text}
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
          focusItems.map((item) => (
            <article
              key={item.actionId}
              style={{
                display: 'grid',
                gap: '8px',
                borderRadius: '14px',
                border: '1px solid #38bdf8',
                backgroundColor: '#f8fafc',
                padding: '14px 16px',
                animation: shouldHighlight ? 'overlayPulse 1.8s ease-out infinite' : 'none',
                opacity: shouldHighlight ? 1 : 0.5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <strong>{item.label}</strong>
                <span style={{ color: '#475569', fontWeight: 600 }}>Highlighted</span>
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
            </article>
          ))
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

        <button
          type="button"
          onClick={oblong.onClick}
          disabled={oblong.disabled}
          style={{
            justifySelf: 'stretch',
            border: 'none',
            borderRadius: '999px',
            padding: '14px 18px',
            backgroundColor: oblong.bg,
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '1rem',
            cursor: oblong.disabled ? 'default' : 'pointer',
            marginTop: '4px',
          }}
        >
          {oblong.label}
        </button>
      </div>
    </section>
  );
};

export default Overlay;
