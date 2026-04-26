function normalizeAction(action, index) {
  return {
    id: action?.id ?? `action-${index + 1}`,
    label: action?.label ?? `Action ${index + 1}`,
    selector: action?.selector ?? '',
    description: action?.description ?? '',
  };
}

function splitSelectors(selectorValue = '') {
  return String(selectorValue)
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean);
}

function buildHighlightLabel(selector) {
  return `Focus ${selector}`;
}

function normalizeStep(step, index) {
  const actions = Array.isArray(step?.actions)
    ? step.actions.map((action, actionIndex) => normalizeAction(action, actionIndex))
    : [];

  return {
    id: step?.id ?? `step-${index + 1}`,
    phase: step?.phase ?? '',
    targetUrl: step?.targetUrl ?? '',
    notes: step?.notes ?? '',
    title: step?.title ?? `Step ${index + 1}`,
    description: step?.description ?? '',
    actions,
    highlightSelectors: Array.isArray(step?.highlightSelectors)
      ? step.highlightSelectors.filter(Boolean)
      : actions.map((action) => action.selector).filter(Boolean),
  };
}

export class StepManager {
  constructor(steps = []) {
    this.currentStepIndex = 0;
    this.participantProgress = new Map();
    this.setSteps(steps);
  }

  setSteps(steps = []) {
    this.steps = Array.isArray(steps) ? steps.map((step, index) => normalizeStep(step, index)) : [];

    if (this.steps.length === 0) {
      this.currentStepIndex = 0;
      return null;
    }

    if (this.currentStepIndex > this.steps.length - 1) {
      this.currentStepIndex = this.steps.length - 1;
    }

    return this.getCurrentStep();
  }

  registerParticipant(participantId) {
    return this.#ensureParticipantProgress(participantId);
  }

  getStepList() {
    return this.steps.map((step, index) => ({
      ...step,
      index,
    }));
  }

  getCurrentStepIndex() {
    return this.steps.length === 0 ? -1 : this.currentStepIndex;
  }

  getCurrentStep() {
    return this.steps[this.currentStepIndex] ?? null;
  }

  getHighlightDetails() {
    const step = this.getCurrentStep();

    if (!step) {
      return [];
    }

    const actionHighlights = step.actions
      .map((action) => ({
        actionId: action.id,
        label: action.label,
        selector: action.selector,
        description: action.description,
      }))
      .filter((action) => action.selector || action.label);

    const knownSelectors = new Set(
      actionHighlights.flatMap((action) => splitSelectors(action.selector)),
    );
    const selectorHighlights = step.highlightSelectors
      .map((selector) => String(selector).trim())
      .filter(Boolean)
      .filter((selector) => !knownSelectors.has(selector))
      .map((selector, index) => ({
        actionId: `highlight-${index + 1}`,
        label: buildHighlightLabel(selector),
        selector,
        description: '',
      }));

    return [...actionHighlights, ...selectorHighlights];
  }

  canAdvance() {
    return this.steps.length > 0 && this.currentStepIndex < this.steps.length - 1;
  }

  canRetreat() {
    return this.steps.length > 0 && this.currentStepIndex > 0;
  }

  advanceStep() {
    if (!this.canAdvance()) {
      return this.getCurrentStep();
    }

    this.currentStepIndex += 1;
    return this.getCurrentStep();
  }

  retreatStep() {
    if (!this.canRetreat()) {
      return this.getCurrentStep();
    }

    this.currentStepIndex -= 1;
    return this.getCurrentStep();
  }

  setCurrentStep(index) {
    if (this.steps.length === 0) {
      this.currentStepIndex = 0;
      return null;
    }

    const boundedIndex = Math.max(0, Math.min(index, this.steps.length - 1));
    this.currentStepIndex = boundedIndex;
    return this.getCurrentStep();
  }

  recordActionClick(participantId, actionId) {
    const step = this.getCurrentStep();
    const progress = this.#ensureParticipantProgress(participantId);

    if (!step) {
      return this.buildParticipantSnapshot(participantId);
    }

    const actionIds = progress.actionsByStep.get(step.id) ?? new Set();

    if (step.actions.some((action) => action.id === actionId)) {
      actionIds.add(actionId);
      progress.actionsByStep.set(step.id, actionIds);
    }

    if (this.#isStepComplete(step, actionIds)) {
      progress.completedStepIds.add(step.id);
    }

    return this.buildParticipantSnapshot(participantId);
  }

  markStepComplete(participantId, actionIds = []) {
    const step = this.getCurrentStep();
    const progress = this.#ensureParticipantProgress(participantId);

    if (!step) {
      return this.buildParticipantSnapshot(participantId);
    }

    const completedActionIds = progress.actionsByStep.get(step.id) ?? new Set();

    for (const actionId of actionIds) {
      if (step.actions.some((action) => action.id === actionId)) {
        completedActionIds.add(actionId);
      }
    }

    progress.actionsByStep.set(step.id, completedActionIds);

    if (step.actions.length === 0 || this.#isStepComplete(step, completedActionIds)) {
      progress.completedStepIds.add(step.id);
    }

    return this.buildParticipantSnapshot(participantId);
  }

  isParticipantCompleteForCurrentStep(participantId) {
    const step = this.getCurrentStep();

    if (!step) {
      return false;
    }

    if (step.actions.length === 0) {
      return true;
    }

    const progress = this.#ensureParticipantProgress(participantId);
    const completedActionIds = progress.actionsByStep.get(step.id) ?? new Set();
    return this.#isStepComplete(step, completedActionIds);
  }

  isCurrentStepCompleteForAll(participantIds = []) {
    if (!this.getCurrentStep() || participantIds.length === 0) {
      return false;
    }

    return participantIds.every((participantId) => this.isParticipantCompleteForCurrentStep(participantId));
  }

  buildParticipantSnapshot(participantId) {
    const step = this.getCurrentStep();
    const progress = this.#ensureParticipantProgress(participantId);
    const currentStepActionIds = step ? Array.from(progress.actionsByStep.get(step.id) ?? []) : [];

    return {
      participantId,
      completedStepIds: Array.from(progress.completedStepIds),
      currentStepActionIds,
      isCurrentStepComplete: step ? this.#isStepComplete(step, new Set(currentStepActionIds)) : false,
    };
  }

  getParticipantSnapshots() {
    return Array.from(this.participantProgress.keys())
      .sort()
      .map((participantId) => this.buildParticipantSnapshot(participantId));
  }

  #ensureParticipantProgress(participantId) {
    if (!participantId) {
      return {
        actionsByStep: new Map(),
        completedStepIds: new Set(),
      };
    }

    if (!this.participantProgress.has(participantId)) {
      this.participantProgress.set(participantId, {
        actionsByStep: new Map(),
        completedStepIds: new Set(),
      });
    }

    return this.participantProgress.get(participantId);
  }

  #isStepComplete(step, completedActionIds) {
    if (!step) {
      return false;
    }

    if (step.actions.length === 0) {
      return true;
    }

    return step.actions.every((action) => completedActionIds.has(action.id));
  }
}

export function createStepManager(steps = []) {
  return new StepManager(steps);
}

export function getStepList(stepManager) {
  return stepManager.getStepList();
}

export function advanceStep(stepManager) {
  return stepManager.advanceStep();
}
