// Highlight Engine
// Maps the current URL (and a small amount of DOM context) to a list of
// selectors that should blink. Used by aws-guide-playwright.mjs.
//
// Each profile has:
//   match:    (url) => boolean
//   label:    short human-readable label for logs
//   selectors: array of selector strings. Supports:
//     - normal CSS selectors
//     - "text=foo"  (case-insensitive substring match against innerText/value)
//     - "aria=foo"  (matches aria-label / aria-labelledby substring)

const PROFILES = [
  {
    id: 'aws-home',
    label: 'AWS Home — Sign in',
    match: (u) => u.includes('aws.amazon.com') && !u.includes('console.aws.amazon.com') && !u.includes('signin.aws.amazon.com'),
    selectors: [
      'a[data-testid="signin-button"]',
      'a[href*="console.aws.amazon.com"]',
      'text=Sign in to the Console',
      'text=Sign In to the Console',
      'text=Sign in',
    ],
  },
  {
    id: 'signin-root',
    label: 'Sign-in — Choose Root + Email',
    match: (u) => u.includes('signin.aws.amazon.com/signin') || u.includes('signin.aws.amazon.com/?'),
    selectors: [
      '#root_user_radio_button',
      'input[type="radio"][value="root"]',
      '#resolving_input',
      'input[type="email"]',
      'input[name="email"]',
      '#next_button',
      'button[type="submit"]',
      'text=Next',
    ],
  },
  {
    id: 'signin-password',
    label: 'Sign-in — Password',
    match: (u) => u.includes('signin.aws.amazon.com/authenticate') || u.includes('signin.aws.amazon.com/password'),
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
    match: (u) => u.includes('signin.aws.amazon.com/mfa') || u.includes('signin.aws.amazon.com/email-otp') || u.includes('signin.aws.amazon.com/challenge'),
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
    match: (u) => u.includes('console.aws.amazon.com/console/home') || /console\.aws\.amazon\.com\/?($|\?)/.test(u),
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
    match: (u) => u.includes('console.aws.amazon.com/ec2/') && u.includes('#LaunchInstances'),
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
    match: (u) => u.includes('console.aws.amazon.com/ec2/'),
    selectors: [
      '[data-testid="launch-instance-button"]',
      'a[href*="LaunchInstances"]',
      'button[data-testid="launch-instance"]',
      'text=Launch instance',
      'text=Launch instances',
    ],
  },
];

export function getHighlightsForUrl(url) {
  if (typeof url !== 'string') return { id: 'none', label: 'No match', selectors: [] };
  const profile = PROFILES.find((p) => {
    try { return p.match(url); } catch { return false; }
  });
  if (!profile) return { id: 'none', label: 'No match', selectors: [] };
  return { id: profile.id, label: profile.label, selectors: profile.selectors.slice() };
}

// Code that runs INSIDE the page (passed to frame.evaluate as a string).
// Kept self-contained — no closures, no imports.
export const FRAME_INJECTION_FN = function applyHighlights(selectors) {
  if (!document.body) return 0;

  if (!document.getElementById('w-style')) {
    const s = document.createElement('style');
    s.id = 'w-style';
    s.textContent = `
      @keyframes flashy-blink {
        0%   { box-shadow: 0 0 0 0 rgba(0,216,255,0.95), 0 0 0 0 rgba(0,216,255,0.65); }
        70%  { box-shadow: 0 0 0 22px rgba(0,216,255,0), 0 0 36px 14px rgba(0,216,255,0); }
        100% { box-shadow: 0 0 0 0 rgba(0,216,255,0), 0 0 0 0 rgba(0,216,255,0); }
      }
      [data-w-hl] {
        outline: 4px solid #00d8ff !important;
        outline-offset: 2px !important;
        animation: flashy-blink 1.2s infinite cubic-bezier(0.66,0,0,1) !important;
        border-radius: 6px !important;
        position: relative !important;
        z-index: 2147483646 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  const isVisible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return true;
  };

  const matchSelector = (sel) => {
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
  };

  const apply = () => {
    document.querySelectorAll('[data-w-hl]').forEach((el) => el.removeAttribute('data-w-hl'));
    if (!Array.isArray(selectors) || selectors.length === 0) return 0;
    let hit = 0;
    for (const sel of selectors) {
      const matches = matchSelector(sel).filter(isVisible);
      if (matches.length > 0) {
        // First-match-wins per selector — avoids highlighting the entire page.
        matches.slice(0, 3).forEach((el) => {
          el.setAttribute('data-w-hl', 'true');
          hit++;
        });
        // Stop after the first selector that produced any hits — gives stable
        // single-target blink instead of every selector firing at once.
        if (hit > 0) break;
      }
    }
    // Vertically center the first highlighted element (smooth, only if not
    // already roughly centered to avoid scroll jitter).
    const first = document.querySelector('[data-w-hl]');
    if (first) {
      const rect = first.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const center = rect.top + rect.height / 2;
      const offFromCenter = Math.abs(center - vh / 2);
      if (offFromCenter > vh * 0.25) {
        try { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {}
      }
    }
    return hit;
  };

  window.__wSelectors = selectors;
  if (window.__wObserver) {
    try { window.__wObserver.disconnect(); } catch {}
  }
  window.__wObserver = new MutationObserver(() => {
    // Re-apply only if the highlighted nodes were removed/replaced.
    const live = document.querySelectorAll('[data-w-hl]').length;
    if (live === 0) apply();
  });
  window.__wObserver.observe(document.body, { childList: true, subtree: true });
  return apply();
};

export async function injectBlinkInAllFrames(page, selectors) {
  const fnSource = FRAME_INJECTION_FN.toString();
  const frames = page.frames();
  const results = await Promise.all(
    frames.map(async (frame) => {
      try {
        const hits = await frame.evaluate(`(${fnSource})(${JSON.stringify(selectors)})`);
        return { url: frame.url(), hits: hits || 0 };
      } catch {
        return { url: frame.url(), hits: 0 };
      }
    })
  );
  return results;
}
