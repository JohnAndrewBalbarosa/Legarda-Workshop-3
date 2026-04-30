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
    expectedProfile: step?.expectedProfile ?? '',
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

  getParticipantStepIndex(participantId) {
    const progress = this.#ensureParticipantProgress(participantId);
    const idx = progress.personalStepIndex ?? 0;
    return Math.max(0, Math.min(idx, Math.max(this.steps.length - 1, 0)));
  }

  getParticipantStep(participantId) {
    const idx = this.getParticipantStepIndex(participantId);
    return this.steps[idx] ?? null;
  }

  setParticipantStepIndex(participantId, index) {
    const progress = this.#ensureParticipantProgress(participantId);
    if (this.steps.length === 0) {
      progress.personalStepIndex = 0;
      return 0;
    }
    progress.personalStepIndex = Math.max(0, Math.min(Number(index) || 0, this.steps.length - 1));
    return progress.personalStepIndex;
  }

  advanceParticipantStep(participantId) {
    const progress = this.#ensureParticipantProgress(participantId);
    if (progress.personalStepIndex < this.steps.length - 1) {
      progress.personalStepIndex += 1;
    }
    return progress.personalStepIndex;
  }

  retreatParticipantStep(participantId) {
    const progress = this.#ensureParticipantProgress(participantId);
    if (progress.personalStepIndex > 0) {
      progress.personalStepIndex -= 1;
    }
    return progress.personalStepIndex;
  }

  getMinPersonalStepIndex(participantIds = []) {
    if (participantIds.length === 0 || this.steps.length === 0) return -1;
    let min = Infinity;
    for (const id of participantIds) {
      const idx = this.getParticipantStepIndex(id);
      if (idx < min) min = idx;
    }
    return Number.isFinite(min) ? min : -1;
  }

  getStepDistribution(participantIds = []) {
    const counts = new Map();
    for (const id of participantIds) {
      const idx = this.getParticipantStepIndex(id);
      counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
    return this.steps.map((step, index) => ({
      stepIndex: index,
      stepId: step.id,
      stepTitle: step.title,
      count: counts.get(index) ?? 0,
    }));
  }

  getActionCompletionCount(stepIndex, actionId, participantIds = []) {
    const step = this.steps[stepIndex];
    if (!step) return 0;
    let count = 0;
    for (const id of participantIds) {
      const progress = this.#ensureParticipantProgress(id);
      if (progress.completedStepIds.has(step.id) || (progress.personalStepIndex ?? 0) > stepIndex) {
        count += 1;
        continue;
      }
      const actions = progress.actionsByStep.get(step.id) ?? new Set();
      if (actions.has(actionId)) count += 1;
    }
    return count;
  }

  recordActionClick(participantId, actionId) {
    const progress = this.#ensureParticipantProgress(participantId);
    const step = this.steps[progress.personalStepIndex] ?? null;

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
      if (progress.personalStepIndex < this.steps.length - 1) {
        progress.personalStepIndex += 1;
      }
    }

    return this.buildParticipantSnapshot(participantId);
  }

  markStepComplete(participantId, actionIds = []) {
    const progress = this.#ensureParticipantProgress(participantId);
    const step = this.steps[progress.personalStepIndex] ?? null;

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
      if (progress.personalStepIndex < this.steps.length - 1) {
        progress.personalStepIndex += 1;
      }
    }

    return this.buildParticipantSnapshot(participantId);
  }

  isParticipantCompleteForCurrentStep(participantId) {
    const progress = this.#ensureParticipantProgress(participantId);
    if (progress.personalStepIndex > this.currentStepIndex) return true;
    const step = this.getCurrentStep();
    if (!step) return false;
    if (step.actions.length === 0) return true;
    const completedActionIds = progress.actionsByStep.get(step.id) ?? new Set();
    return this.#isStepComplete(step, completedActionIds);
  }

  allParticipantsPastSlide(participantIds = []) {
    if (participantIds.length === 0) return false;
    const slideIndex = this.getCurrentStepIndex();
    return participantIds.every((id) => this.getParticipantStepIndex(id) > slideIndex);
  }

  isCurrentStepCompleteForAll(participantIds = []) {
    return this.allParticipantsPastSlide(participantIds);
  }

  buildParticipantSnapshot(participantId) {
    const progress = this.#ensureParticipantProgress(participantId);
    const personalStep = this.steps[progress.personalStepIndex] ?? null;
    const currentStepActionIds = personalStep
      ? Array.from(progress.actionsByStep.get(personalStep.id) ?? [])
      : [];

    return {
      participantId,
      completedStepIds: Array.from(progress.completedStepIds),
      currentStepActionIds,
      isCurrentStepComplete: personalStep
        ? this.#isStepComplete(personalStep, new Set(currentStepActionIds))
        : false,
      personalStepIndex: progress.personalStepIndex ?? 0,
      personalStepId: personalStep?.id ?? null,
      personalStepTitle: personalStep?.title ?? '',
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
        personalStepIndex: 0,
      };
    }

    if (!this.participantProgress.has(participantId)) {
      this.participantProgress.set(participantId, {
        actionsByStep: new Map(),
        completedStepIds: new Set(),
        personalStepIndex: 0,
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
