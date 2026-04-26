import React from 'react';
import {
  buildNavigatorState,
  getCurrentStep,
  getNextStep,
  getRequiredActions,
  isStepComplete,
} from '../../modules/StepUtils.js';

const StepNavigator = ({
  steps = [],
  currentStepIndex = -1,
  completedStepIds = [],
  completedActionIds = [],
}) => {
  const navigatorSteps = buildNavigatorState({
    steps,
    currentStepIndex,
    completedStepIds,
  });
  const currentStep = getCurrentStep(steps, currentStepIndex);
  const nextStep = getNextStep(steps, currentStepIndex);
  const requiredActions = getRequiredActions(currentStep);
  const progressPercentage = steps.length === 0 ? 0 : Math.round((completedStepIds.length / steps.length) * 100);

  return (
    <section
      className="step-navigator"
      style={{
        borderRadius: '18px',
        padding: '20px',
        border: '1px solid #dbe3f3',
        backgroundColor: '#ffffff',
        boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)',
        display: 'grid',
        gap: '16px',
      }}
    >
      <div style={{ display: 'grid', gap: '8px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0 }}>Step navigator</h2>
          <strong>{progressPercentage}% complete</strong>
        </div>
        <div
          style={{
            height: '10px',
            borderRadius: '999px',
            backgroundColor: '#e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #0ea5e9, #2563eb)',
            }}
          />
        </div>
      </div>

      {navigatorSteps.length ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          {navigatorSteps.map((step) => (
            <article
              key={step.id}
              style={{
                borderRadius: '14px',
                padding: '14px 16px',
                border: step.isCurrent ? '1px solid #60a5fa' : '1px solid #d7deea',
                backgroundColor: step.isCompleted ? '#eff6ff' : step.isCurrent ? '#f8fbff' : '#ffffff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <strong>{step.title}</strong>
                <span style={{ color: '#475569', fontWeight: 600 }}>
                  {step.isCompleted ? 'Completed' : step.isCurrent ? 'Current' : 'Upcoming'}
                </span>
              </div>
              {step.description ? <p style={{ marginBottom: 0, color: '#64748b' }}>{step.description}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>No workshop steps are defined yet.</p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
        }}
      >
        <div
          style={{
            borderRadius: '14px',
            padding: '14px 16px',
            backgroundColor: '#f8fafc',
          }}
        >
          <strong>Current step</strong>
          <div style={{ marginTop: '8px', color: '#475569' }}>{currentStep?.title ?? 'Waiting for presenter'}</div>
        </div>
        <div
          style={{
            borderRadius: '14px',
            padding: '14px 16px',
            backgroundColor: '#f8fafc',
          }}
        >
          <strong>Required actions</strong>
          <div style={{ marginTop: '8px', color: '#475569' }}>
            {requiredActions.length ? `${completedActionIds.length} of ${requiredActions.length} clicked` : 'No required actions'}
          </div>
        </div>
        <div
          style={{
            borderRadius: '14px',
            padding: '14px 16px',
            backgroundColor: '#f8fafc',
          }}
        >
          <strong>Completion status</strong>
          <div style={{ marginTop: '8px', color: '#475569' }}>
            {currentStep ? (isStepComplete(currentStep, completedActionIds) ? 'Ready for next step' : 'Still in progress') : 'Awaiting steps'}
          </div>
        </div>
        <div
          style={{
            borderRadius: '14px',
            padding: '14px 16px',
            backgroundColor: '#f8fafc',
          }}
        >
          <strong>Next up</strong>
          <div style={{ marginTop: '8px', color: '#475569' }}>{nextStep?.title ?? 'No next step yet'}</div>
        </div>
      </div>
    </section>
  );
};

export default StepNavigator;
