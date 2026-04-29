// Launch-EC2 sequential form tracker.
// Lives entirely in the page (injected as a string into all frames). Each
// stage has an ordered selector and a "complete" predicate. Returns the
// first incomplete stage so the overlay can guide the user step by step.

export const FORM_STAGES = [
  {
    id: 'name',
    label: 'Name your instance',
    selector: 'input[placeholder*="My Web Server"], [data-testid="name-container"] input, input[name="name"]',
    isComplete: (el) => !!(el && el.value && el.value.trim().length > 0),
  },
  {
    id: 'ami',
    label: 'Pick an Amazon Machine Image (AMI)',
    selector: '[data-testid^="getting-started-tile-"][aria-pressed="true"], [data-testid="quick-start-ami-tile-amazon-linux"]',
    isComplete: (el) => !!el,
  },
  {
    id: 'instance-type',
    label: 'Choose an instance type (t3.micro is Free Tier)',
    selector: 'input[placeholder*="t3.micro"], [data-testid="instance-type-selector"] input, [data-analytics-id="instance-type"]',
    isComplete: (el) => {
      if (!el) return false;
      const v = (el.value || el.textContent || '').toLowerCase();
      return v.includes('t3.micro') || v.includes('t2.micro');
    },
  },
  {
    id: 'key-pair',
    label: 'Select or create a key pair',
    selector: '[data-testid="key-pair-selector"] input, select[name="keyPair"], [aria-labelledby*="keyPair"]',
    isComplete: (el) => !!(el && (el.value || el.textContent || '').trim().length > 0),
  },
  {
    id: 'network',
    label: 'Confirm network settings (defaults are fine)',
    selector: '[data-testid="network-settings"]',
    isComplete: (el) => !!el,
  },
  {
    id: 'storage',
    label: 'Configure storage (defaults work)',
    selector: '[data-testid="storage-settings"]',
    isComplete: (el) => !!el,
  },
  {
    id: 'launch',
    label: 'Click Launch instance',
    selector: '[data-testid="launch-instance-button"], button[data-testid="submit-button"]',
    isComplete: () => false,
  },
];

export const FRAME_FORM_FN = function detectFormStage(stages) {
  if (!document.body) return null;
  for (const stage of stages) {
    let el = null;
    try { el = document.querySelector(stage.selector); } catch { el = null; }
    // Reconstruct predicate (passed as string).
    let complete = false;
    try { complete = new Function('el', `return (${stage.predicate})(el);`)(el); } catch {}
    if (!complete) {
      return { id: stage.id, label: stage.label, selector: stage.selector, hasField: !!el };
    }
  }
  return { id: 'done', label: 'All set — review and launch', selector: '', hasField: false };
};

export async function detectFormStageInAllFrames(page) {
  const fnSource = FRAME_FORM_FN.toString();
  const serialized = FORM_STAGES.map((s) => ({
    id: s.id,
    label: s.label,
    selector: s.selector,
    predicate: s.isComplete.toString(),
  }));
  const frames = page.frames();
  const results = await Promise.all(
    frames.map(async (frame) => {
      try {
        return await frame.evaluate(`(${fnSource})(${JSON.stringify(serialized)})`);
      } catch {
        return null;
      }
    })
  );
  // Pick the first frame that has the form (any stage with hasField=true OR done).
  const hit = results.find((r) => r && (r.hasField || r.id === 'done'));
  return hit || results.find((r) => r) || null;
}
