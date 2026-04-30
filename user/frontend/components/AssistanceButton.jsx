import React from 'react';

const AssistanceButton = ({
  onRequestHelp = () => {},
  requestStatus = null,
  disabled = false,
}) => {
  const hasOpenRequest = requestStatus && requestStatus.status !== 'resolved';
  const isClaimed = requestStatus?.status === 'claimed';
  const label = isClaimed
    ? `Usher on the way: ${requestStatus.usherId || 'usher'}`
    : hasOpenRequest
      ? 'Help requested'
      : 'Need help?';
  const supportingText = isClaimed
    ? `${requestStatus.usherId || 'An usher'} is on their way to your seat.`
    : hasOpenRequest
      ? 'An usher has been notified and can see your seat and current step.'
      : 'Press this if you are stuck and need in-person assistance.';

  return (
    <section
      style={{
        borderRadius: '18px',
        padding: '20px',
        backgroundColor: isClaimed ? '#ecfeff' : '#fff7ed',
        border: isClaimed ? '1px solid #67e8f9' : '1px solid #fed7aa',
        display: 'grid',
        gap: '12px',
      }}
    >
      <div>
        <h2 style={{ margin: '0 0 8px' }}>Assistance</h2>
        <p style={{ margin: 0, color: isClaimed ? '#155e75' : '#9a3412' }}>{supportingText}</p>
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
          backgroundColor: isClaimed ? '#0891b2' : hasOpenRequest ? '#fdba74' : '#ea580c',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '1rem',
          cursor: disabled || hasOpenRequest ? 'default' : 'pointer',
        }}
      >
        {label}
      </button>
      {requestStatus ? (
        <div style={{ color: isClaimed ? '#155e75' : '#9a3412', fontWeight: 600 }}>
          Status: {requestStatus.status}
          {requestStatus.requestedAt ? ` since ${requestStatus.requestedAt}` : ''}
          {isClaimed && requestStatus.claimedAt ? ` — claimed at ${requestStatus.claimedAt}` : ''}
        </div>
      ) : null}
    </section>
  );
};

export default AssistanceButton;
