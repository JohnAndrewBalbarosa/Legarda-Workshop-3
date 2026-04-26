function normalizeAction(action, index) {
  return {
    id: action?.id ?? `action-${index + 1}`,
    label: action?.label ?? `Action ${index + 1}`,
    selector: action?.selector ?? '',
    description: action?.description ?? '',
  };
}

function normalizeStep(step, index) {
  return {
    id: step?.id ?? `step-${index + 1}`,
    phase: step?.phase ?? '',
    targetUrl: step?.targetUrl ?? '',
    notes: step?.notes ?? '',
    title: step?.title ?? `Step ${index + 1}`,
    description: step?.description ?? '',
    actions: Array.isArray(step?.actions)
      ? step.actions.map((action, actionIndex) => normalizeAction(action, actionIndex))
      : [],
  };
}

export function normalizeSteps(steps = []) {
  return Array.isArray(steps) ? steps.map((step, index) => normalizeStep(step, index)) : [];
}

export function getCurrentStep(steps = [], currentStepIndex = 0) {
  const normalizedSteps = normalizeSteps(steps);

  if (normalizedSteps.length === 0 || currentStepIndex < 0) {
    return null;
  }

  return normalizedSteps[currentStepIndex] ?? null;
}

export function getNextStep(steps = [], currentStepIndex = 0) {
  const normalizedSteps = normalizeSteps(steps);
  return normalizedSteps[currentStepIndex + 1] ?? null;
}

export function getRequiredActions(step) {
  return Array.isArray(step?.actions) ? step.actions : [];
}

export function isStepComplete(step, completedActionIds = []) {
  const requiredActions = getRequiredActions(step);

  if (!step) {
    return false;
  }

  if (requiredActions.length === 0) {
    return true;
  }

  const completedActionSet = new Set(completedActionIds);
  return requiredActions.every((action) => completedActionSet.has(action.id));
}

export function registerActionCompletion(step, completedActionIds = [], actionId) {
  const requiredActions = getRequiredActions(step);
  const completedActionSet = new Set(completedActionIds);

  if (requiredActions.some((action) => action.id === actionId)) {
    completedActionSet.add(actionId);
  }

  const nextCompletedActionIds = Array.from(completedActionSet);

  return {
    completedActionIds: nextCompletedActionIds,
    isComplete: isStepComplete(step, nextCompletedActionIds),
    remainingActionIds: requiredActions
      .filter((action) => !completedActionSet.has(action.id))
      .map((action) => action.id),
  };
}

export function buildNavigatorState({
  steps = [],
  currentStepIndex = 0,
  completedStepIds = [],
} = {}) {
  const normalizedSteps = normalizeSteps(steps);
  const completedStepSet = new Set(completedStepIds);

  return normalizedSteps.map((step, index) => ({
    ...step,
    index,
    isCurrent: index === currentStepIndex,
    isCompleted: completedStepSet.has(step.id),
    isUpcoming: index > currentStepIndex,
  }));
}
