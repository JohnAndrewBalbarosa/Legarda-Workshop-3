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

  // Always allow highlighting — workspace is personal-paced, so a non-correct
  // URL just means the user is ahead/elsewhere, not wrong.
  const shouldHighlight = urlStatus === 'correct' || urlStatus === 'unknown';

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
    urlStatus === 'correct'
      ? { color: '#166534', bg: '#dcfce7', text: 'You are at the correct link' }
      : { color: '#475569', bg: '#e2e8f0', text: 'Continue at your own pace' };

  const hasOpenHelp = helpRequestStatus && helpRequestStatus.status !== 'resolved';
  const oblong = {
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
            0%   { outline: 4px solid rgba(239,68,68,1);    outline-offset: 0px;  box-shadow: 0 0 0 0    rgba(239,68,68,0.95), 0 0 18px 4px  rgba(239,68,68,0.85); background-color: rgba(239,68,68,0.18); }
            45%  { outline: 6px solid rgba(220,38,38,1);    outline-offset: 6px;  box-shadow: 0 0 0 18px rgba(239,68,68,0.45), 0 0 36px 10px rgba(239,68,68,0.7);  background-color: rgba(239,68,68,0.28); }
            100% { outline: 8px solid rgba(185,28,28,0.95); outline-offset: 14px; box-shadow: 0 0 0 36px rgba(239,68,68,0),    0 0 60px 18px rgba(239,68,68,0);    background-color: rgba(239,68,68,0.10); }
          }

          [data-workshop-highlight="true"] {
            position: relative;
            outline: 4px solid rgba(239,68,68,1) !important;
            outline-offset: 0px !important;
            border-radius: 8px !important;
            animation: overlayPulse 0.6s ease-out infinite !important;
            z-index: 2147483646 !important;
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
