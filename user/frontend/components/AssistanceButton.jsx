import React from 'react';

const AssistanceButton = ({
  onRequestHelp = () => {},
  requestStatus = null,
  disabled = false,
}) => {
  const hasOpenRequest = requestStatus && requestStatus.status !== 'resolved';
  const label = hasOpenRequest ? 'Help requested' : 'Need help?';
  const supportingText = hasOpenRequest
    ? 'An usher has been notified and can see your seat and current step.'
    : 'Press this if you are stuck and need in-person assistance.';

  return (
    <section
      style={{
        borderRadius: '18px',
        padding: '20px',
        backgroundColor: '#fff7ed',
        border: '1px solid #fed7aa',
        display: 'grid',
        gap: '12px',
      }}
    >
      <div>
        <h2 style={{ margin: '0 0 8px' }}>Assistance</h2>
        <p style={{ margin: 0, color: '#9a3412' }}>{supportingText}</p>
      </div>
      <button
        type="button"
        onClick={onRequestHelp}
        disabled={disabled || hasOpenRequest}
        className="assistance-button"
        style={{
          border: 'none',
          borderRadius: '14px',
          padding: '14px 18px',
          backgroundColor: hasOpenRequest ? '#fdba74' : '#ea580c',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '1rem',
          cursor: disabled || hasOpenRequest ? 'default' : 'pointer',
        }}
      >
        {label}
      </button>
      {requestStatus ? (
        <div style={{ color: '#9a3412', fontWeight: 600 }}>
          Status: {requestStatus.status}
          {requestStatus.requestedAt ? ` since ${requestStatus.requestedAt}` : ''}
        </div>
      ) : null}
    </section>
  );
};

export default AssistanceButton;
