// Workshop Guide — Highlight Engine (extension build).
// Vendored from user/highlight-engine.mjs. No ES modules — exposes a single
// global `WorkshopHighlightEngine` for content.js to consume.
//
// Profile shape:
//   id, label, match(url) -> bool, selectors[], gateOnChoice?[]
// Selectors support normal CSS, "text=foo", and "aria=foo".

(function () {
  const PROFILES = [
    {
      id: 'aws-home',
      label: 'AWS Home — Sign in to the Console',
      match: (u) =>
        u.includes('aws.amazon.com') &&
        !u.includes('console.aws.amazon.com') &&
        !u.includes('signin.aws.amazon.com') &&
        !u.includes('signup.aws.amazon.com') &&
        !u.includes('portal.aws.amazon.com'),
      selectors: [
        // 2026 Rigel design system: hero CTA is <a role="button"> with a
        // data-rigel-analytics attribute carrying "variant":"primary".
        // The hashed rghr_* classes are unstable, so anchor on the analytics
        // attribute + the bare console host href. The nav variant lives
        // inside <li> with rggn_* classes and lacks "variant":"primary",
        // so this disambiguates hero from nav.
        'a[data-rigel-analytics*="\\"variant\\":\\"primary\\""][href="https://console.aws.amazon.com/"]',
        'a[role="button"][href="https://console.aws.amazon.com/"]',
        'a[href="https://console.aws.amazon.com/"][data-rigel-analytics*="Button"]',
        // Legacy lb-btn skin (older home page variants)
        'a.lb-btn-orange[href*="console.aws.amazon.com"]',
        'a.lb-btn[href*="console.aws.amazon.com/console/home"]',
        'a[data-testid="signin-button"]',
        'header a[href*="console.aws.amazon.com/console/home"]',
        'a[href="https://console.aws.amazon.com/console/home"]',
        'a[href^="https://console.aws.amazon.com/console/home"]',
        'text=Sign in to the Console',
        'text=Sign In to the Console',
      ],
    },
    {
      id: 'signin-choice',
      label: 'Sign-in — Choose existing account or create new',
      match: (u) =>
        u.includes('signin.aws.amazon.com/signin') ||
        u.includes('signin.aws.amazon.com/?') ||
        u.includes('signin.aws.amazon.com/oauth'),
      selectors: [],
    },
    {
      id: 'signin-root-existing',
      label: 'Sign-in — Root email account',
      match: (u) => u.includes('signin.aws.amazon.com'),
      gateOnChoice: ['root'],
      selectors: [
        '#root_account_signin',
        '[data-testid="not-sign-in-with-iam"]',
        'text=Sign in using root user email',
        'text=Root user',
      ],
    },
    {
      id: 'signin-root-iam',
      label: 'Sign-in — IAM user credentials',
      match: (u) => u.includes('signin.aws.amazon.com'),
      gateOnChoice: ['iam'],
      selectors: [
        '[data-testid="iam_user_signin"]',
        '#iam_user_radio_button',
        'text=Sign in with IAM user credentials',
        'text=IAM user',
      ],
    },
    {
      id: 'signup-root-new',
      label: 'Sign-up — Create a new AWS account',
      match: (u) =>
        u.includes('signin.aws.amazon.com/signin') ||
        u.includes('signin.aws.amazon.com/?') ||
        u.includes('signup.aws.amazon.com') ||
        u.includes('portal.aws.amazon.com/billing/signup'),
      gateOnChoice: ['new'],
      selectors: [
        'a[href*="signup"]',
        'a[href*="aws.amazon.com/resources/create-account"]',
        'button:has-text("Create a new AWS account")',
        'text=Create a new AWS account',
        'text=Create an AWS account',
      ],
    },
    {
      id: 'signin-password',
      label: 'Sign-in — Password',
      match: (u) =>
        u.includes('signin.aws.amazon.com/authenticate') ||
        u.includes('signin.aws.amazon.com/password'),
      selectors: [
        '#password',
        'input[type="password"]',
        '[data-testid="signin_button"]',
        '[data-testid="signin-button"]',
        'button[type="submit"]',
        'text=Sign in',
      ],
    },
    {
      id: 'signin-mfa',
      label: 'Sign-in — Email / MFA Code',
      match: (u) =>
        u.includes('signin.aws.amazon.com/mfa') ||
        u.includes('signin.aws.amazon.com/email-otp') ||
        u.includes('signin.aws.amazon.com/challenge'),
      selectors: [
        'input[name="otpCode"]',
        'input[autocomplete="one-time-code"]',
        'input[name="code"]',
        'input[name="mfacode"]',
        '[data-testid="email-code-submit-button"]',
        'button[type="submit"]',
        'text=Verify and continue',
        'text=Submit',
      ],
    },
    {
      id: 'console-home',
      label: 'Console Home — Search EC2',
      match: (u) =>
        u.includes('console.aws.amazon.com/console/home') ||
        /console\.aws\.amazon\.com\/?($|\?)/.test(u),
      selectors: [
        'input#awsc-concierge-input',
        'input[data-testid="awsc-concierge-input"]',
        'input[placeholder="Search"]',
        'input[aria-label="Search"]',
        'input[type="search"]',
        'a[data-testid="services-search-result-link-ec2"]',
        'aria=Search',
      ],
    },
    {
      id: 'ec2-launch-form',
      label: 'EC2 — Launch Instance Form',
      match: (u) =>
        u.includes('console.aws.amazon.com/ec2/') &&
        u.includes('#LaunchInstances'),
      selectors: [
        'input[placeholder="e.g. My Web Server"]',
        'input[placeholder*="My Web Server"]',
        '[data-testid="name-container"] input',
        '[data-testid="getting-started-tile-0"]',
        '[data-testid^="getting-started-tile-"]',
        'text=Free tier eligible',
        'text=Launch instance',
      ],
    },
    {
      id: 'ec2-dashboard',
      label: 'EC2 Dashboard — Launch instance',
      match: (u) =>
        u.includes('console.aws.amazon.com/ec2/') &&
        !u.includes('#LaunchInstances'),
      selectors: [
        'button[data-testid="launch-instance"]',
        'button[data-analytics-funnel-substep="launch-instance"]',
        'awsui-button[variant="primary"] button',
        '[data-testid="launch-instance-button"]',
        'a[href*="LaunchInstances"]',
        'button:has-text("Launch instance")',
        'text=Launch instance',
        'text=Launch instances',
      ],
    },
  ];

  const NAVIGATION_SEQUENCE = [
    { id: 'aws-home',             transitional: false },
    { id: 'signin-choice',        transitional: true  },
    { id: 'signin-root-existing', transitional: true  },
    { id: 'signin-root-iam',      transitional: true  },
    { id: 'signup-root-new',      transitional: true  },
    { id: 'signin-password',      transitional: true  },
    { id: 'signin-mfa',           transitional: true  },
    { id: 'console-home',         transitional: false },
    { id: 'ec2-dashboard',        transitional: false },
    { id: 'ec2-launch-form',      transitional: false },
  ];
  const TRANSITIONAL_IDS = new Set(NAVIGATION_SEQUENCE.filter((n) => n.transitional).map((n) => n.id));

  function findProfileForUrl(url) {
    if (typeof url !== 'string') return null;
    return PROFILES.find((p) => { try { return p.match(url); } catch { return false; } }) || null;
  }
  function getProfileById(id) { return PROFILES.find((p) => p.id === id) || null; }

  function getHighlightsForUrl(url, opts) {
    const signinChoice = (opts && opts.signinChoice) || null;
    const profile = findProfileForUrl(url);
    if (!profile) return { id: 'none', label: 'No match', selectors: [] };

    if (profile.id === 'signin-choice') {
      if (signinChoice) {
        const targetId =
          signinChoice === 'root' ? 'signin-root-existing' :
          signinChoice === 'iam'  ? 'signin-root-iam' :
          signinChoice === 'new'  ? 'signup-root-new' : null;
        if (targetId) {
          const target = getProfileById(targetId);
          if (target) return { id: target.id, label: target.label, selectors: target.selectors.slice() };
        }
      }
      return { id: profile.id, label: profile.label, selectors: [] };
    }

    if (Array.isArray(profile.gateOnChoice) && !profile.gateOnChoice.includes(signinChoice)) {
      return { id: profile.id, label: profile.label, selectors: [] };
    }
    return { id: profile.id, label: profile.label, selectors: profile.selectors.slice() };
  }

  function expectedUrlMatcher(expectedProfile, url) {
    if (!expectedProfile) return 'unknown';
    const profile = findProfileForUrl(url);
    if (!profile) return 'unknown';
    if (profile.id === expectedProfile) return 'correct';
    if (TRANSITIONAL_IDS.has(profile.id) && !TRANSITIONAL_IDS.has(expectedProfile)) return 'unknown';
    return 'wrong';
  }

  // Style + DOM application. Self-healing via MutationObserver.
  const STYLE_ID = 'w-style';
  const STYLE_CSS = `
    @keyframes w-ripple {
      0%   { outline: 4px solid rgba(239,68,68,1);    outline-offset: 0px;  box-shadow: 0 0 0 0    rgba(239,68,68,0.95), 0 0 18px 4px  rgba(239,68,68,0.85); background-color: rgba(239,68,68,0.18); }
      45%  { outline: 6px solid rgba(220,38,38,1);    outline-offset: 6px;  box-shadow: 0 0 0 18px rgba(239,68,68,0.45), 0 0 36px 10px rgba(239,68,68,0.7);  background-color: rgba(239,68,68,0.28); }
      100% { outline: 8px solid rgba(185,28,28,0.95); outline-offset: 14px; box-shadow: 0 0 0 36px rgba(239,68,68,0),    0 0 60px 18px rgba(239,68,68,0);    background-color: rgba(239,68,68,0.10); }
    }
    [data-w-hl] {
      animation: w-ripple 0.6s infinite ease-out !important;
      border-radius: 8px !important;
      position: relative !important;
      z-index: 2147483646 !important;
    }
  `;

  function ensureStyle() {
    const existing = document.getElementById(STYLE_ID);
    if (existing && existing.dataset.wRed === '1') return;
    if (existing) existing.remove();
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.dataset.wRed = '1';
    s.textContent = STYLE_CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return true;
  }

  function matchSelector(sel) {
    if (typeof sel !== 'string' || !sel) return [];
    if (sel.startsWith('text=')) {
      const needle = sel.slice(5).trim().toLowerCase();
      if (!needle) return [];
      const out = [];
      const candidates = document.querySelectorAll(
        'button, a, span, label, div[role="button"], input[type="submit"], input[type="button"], [role="link"], h1, h2, h3'
      );
      candidates.forEach((el) => {
        const t = (el.innerText || el.value || el.textContent || '').trim().toLowerCase();
        if (t && t.includes(needle) && t.length < 200) out.push(el);
      });
      return out;
    }
    if (sel.startsWith('aria=')) {
      const needle = sel.slice(5).trim().toLowerCase();
      if (!needle) return [];
      return Array.from(document.querySelectorAll('[aria-label]')).filter((el) => {
        const v = (el.getAttribute('aria-label') || '').toLowerCase();
        return v.includes(needle);
      });
    }
    try { return Array.from(document.querySelectorAll(sel)); } catch { return []; }
  }

  let activeSelectors = [];
  let observer = null;
  let lastScrollKey = '';

  function apply() {
    ensureStyle();
    document.querySelectorAll('[data-w-hl]').forEach((el) => el.removeAttribute('data-w-hl'));
    if (!Array.isArray(activeSelectors) || activeSelectors.length === 0) return 0;

    let hit = 0;
    for (const sel of activeSelectors) {
      const matches = matchSelector(sel).filter(isVisible);
      if (matches.length > 0) {
        matches.slice(0, 3).forEach((el) => { el.setAttribute('data-w-hl', 'true'); hit++; });
        if (hit > 0) break;
      }
    }

    const first = document.querySelector('[data-w-hl]');
    if (first) {
      const scrollKey = JSON.stringify(activeSelectors);
      if (lastScrollKey !== scrollKey) {
        lastScrollKey = scrollKey;
        try { first.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch {}
      }
    }
    return hit;
  }

  function setSelectors(selectors) {
    activeSelectors = Array.isArray(selectors) ? selectors.slice() : [];
    ensureStyle();
    if (!observer) {
      observer = new MutationObserver(() => {
        const live = document.querySelectorAll('[data-w-hl]').length;
        if (live === 0) apply();
      });
      try { observer.observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch {}
    }
    apply();
  }

  function clearSelectors() {
    activeSelectors = [];
    lastScrollKey = '';
    document.querySelectorAll('[data-w-hl]').forEach((el) => el.removeAttribute('data-w-hl'));
  }

  window.WorkshopHighlightEngine = {
    PROFILES,
    NAVIGATION_SEQUENCE,
    getHighlightsForUrl,
    expectedUrlMatcher,
    getProfileById,
    setSelectors,
    clearSelectors,
    apply,
    ensureStyle,
  };
})();
