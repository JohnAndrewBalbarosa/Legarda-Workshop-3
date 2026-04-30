export const WORKSHOP_WORKFLOW_REFERENCE = {
  name: 'AWS EC2 AI-Guided Workshop',
  overview: 'AI-enhanced guidance for launching EC2 instances.',
  phases: [
    { id: 'setup', title: 'Preparation', description: 'Participants sign in manually.' },
    { id: 'dashboard', title: 'Navigation', description: 'Finding EC2 from the Dashboard.' },
    { id: 'launch', title: 'Launch Wizard', description: 'Configuring the instance with AI assistance.' }
  ]
};

// expectedProfile aligns each step with a profile id in user/highlight-engine.mjs.
// The Playwright shell uses it to compare current page URL against the step
// and tell the participant whether they are at the correct link.
export const WORKSHOP_STEP_DEFINITIONS = [
  {
    id: 'aws-home',
    phase: 'Preparation',
    targetUrl: 'aws.amazon.com/console',
    expectedProfile: 'aws-home',
    title: 'AWS Home Page',
    description: 'Click the "Sign in" button to enter the console.',
    highlightSelectors: ['a[href*="console.aws.amazon.com/console/home"]', 'a:has-text("Sign in")']
  },
  {
    id: 'aws-signin-choice',
    phase: 'Preparation',
    targetUrl: 'signin.aws.amazon.com/signin',
    expectedProfile: 'signin-choice',
    title: 'Sign in or create an account',
    description: 'Choose whether to sign in with an existing AWS account or create a new one. Highlights start after you pick.',
    highlightSelectors: []
  },
  {
    id: 'aws-console-home',
    phase: 'Navigation',
    targetUrl: 'console.aws.amazon.com/console/home',
    expectedProfile: 'console-home',
    title: 'AWS Dashboard',
    description: 'Welcome! Use the Search bar at the top to find "EC2".',
    highlightSelectors: ['#awsc-concierge-input', 'input[type="search"]']
  },
  {
    id: 'arrive-at-ec2',
    phase: 'Navigation',
    targetUrl: 'console.aws.amazon.com/ec2/home',
    expectedProfile: 'ec2-dashboard',
    title: 'EC2 Dashboard',
    description: 'Click the orange "Launch instance" button.',
    highlightSelectors: ['button:has-text("Launch instance")', 'a:has-text("Launch instance")']
  }
];

export function getDefaultWorkshopSteps() {
  return WORKSHOP_STEP_DEFINITIONS.map(s => ({ ...s, actions: [], highlightSelectors: [...(s.highlightSelectors || [])] }));
}
