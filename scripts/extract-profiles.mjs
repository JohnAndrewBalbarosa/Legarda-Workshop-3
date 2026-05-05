// Extract derived selectors per highlight profile from interaction-recorder logs.
//
// Reads every *.jsonl session file under interaction-recorder/logs/, tracks the
// current URL via kind:"navigation" events, classifies each kind:"click" /
// kind:"submit" event into one of the existing PROFILES, derives a stable
// selector from the recorded target snapshot, and writes per-profile selector
// counts to user/derived-profiles.json.
//
// Sign-in / transitional profiles are intentionally skipped — real users sign
// in many different ways (root, IAM, federated, password manager, MFA), so
// harvesting selectors from one sign-in run would mislead future runs.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { PROFILES, NAVIGATION_SEQUENCE } from '../user/highlight-engine.mjs';

const logsDir = fileURLToPath(new URL('../interaction-recorder/logs/', import.meta.url));
const outPath = fileURLToPath(new URL('../user/derived-profiles.json', import.meta.url));

const TRANSITIONAL_IDS = new Set(
  NAVIGATION_SEQUENCE.filter((n) => n.transitional).map((n) => n.id)
);
TRANSITIONAL_IDS.add('signin-choice');

// AWS uses hashed class tokens like `awsui_button_vjswe_lssc8_157` and
// `rghr_8711ccd9` that change per build — reject these as unstable selectors.
const UNSTABLE_CLASS_PATTERNS = [
  /^awsui_/,
  /^rghr_/,
  /_lssc8_/,
  /_[0-9a-f]{6,}$/i,
];

function isUnstableClass(token) {
  return UNSTABLE_CLASS_PATTERNS.some((re) => re.test(token));
}

// Auto-generated ids look like `link-self10-1778003271390-8469` — reject those.
const AUTO_ID_PATTERNS = [
  /-\d{10,}/,
  /^link-self/,
  /^[0-9a-f-]{32,}$/i,
];

function isAutoId(id) {
  return AUTO_ID_PATTERNS.some((re) => re.test(id));
}

function deriveSelector(target) {
  if (!target || typeof target !== 'object') return null;

  // 1. Stable id
  if (target.id && !isAutoId(target.id)) {
    return `#${target.id}`;
  }

  // 2. role + name combo (uncommon in recorder logs but stable when present)
  if (target.role && target.name) {
    return `[role="${target.role}"][name="${target.name}"]`;
  }

  // 3. href keyword (links only) — pathname last segment, reject ids/long tokens
  if (target.tag === 'a' && target.href) {
    try {
      const url = new URL(target.href, 'https://example.invalid');
      const segments = url.pathname.split('/').filter(Boolean);
      const kw = segments.at(-1);
      if (kw && kw.length < 30 && !/^\d+$/.test(kw) && !/^[0-9a-f-]{32,}$/i.test(kw)) {
        return `[href*="${kw}"]`;
      }
    } catch { /* malformed href */ }
  }

  // 4. type for inputs
  if (target.tag === 'input' && target.type) {
    return `input[type="${target.type}"]`;
  }

  // 5. Stable class tokens only (skip if everything is hashed)
  if (typeof target.cls === 'string' && target.cls.trim()) {
    const stable = target.cls
      .split(/\s+/)
      .filter(Boolean)
      .filter((t) => !isUnstableClass(t));
    if (stable.length > 0) {
      return `${target.tag || '*'}.${stable.join('.')}`;
    }
  }

  // 6. Text content fallback
  const t = (target.text ?? '').trim();
  if (t) return `text=${t.slice(0, 60)}`;

  return null;
}

function findProfile(url) {
  if (typeof url !== 'string') return null;
  return PROFILES.find((p) => { try { return p.match(url); } catch { return false; } }) ?? null;
}

// profileId → Map<selector, count>
const accumulator = {};

let sessionFiles = [];
try {
  sessionFiles = readdirSync(logsDir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => join(logsDir, f));
} catch (err) {
  console.error(`[extract-profiles] cannot read ${logsDir}: ${err.message}`);
  process.exit(1);
}

let totalClicks = 0;
let skippedTransitional = 0;
let skippedNoProfile = 0;
let skippedNoSelector = 0;

for (const file of sessionFiles) {
  let currentUrl = null;
  const raw = readFileSync(file, 'utf8').trim();
  if (!raw) continue;

  for (const line of raw.split('\n')) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }

    if (entry.kind === 'navigation' && typeof entry.url === 'string') {
      currentUrl = entry.url;
      continue;
    }

    if (entry.kind !== 'click' && entry.kind !== 'submit') continue;
    if (!currentUrl) continue;
    totalClicks++;

    const profile = findProfile(currentUrl);
    if (!profile) { skippedNoProfile++; continue; }
    if (TRANSITIONAL_IDS.has(profile.id)) { skippedTransitional++; continue; }

    const selector = deriveSelector(entry.target);
    if (!selector) { skippedNoSelector++; continue; }

    if (!accumulator[profile.id]) accumulator[profile.id] = new Map();
    const map = accumulator[profile.id];
    map.set(selector, (map.get(selector) ?? 0) + 1);
  }
}

const output = {};
for (const [profileId, map] of Object.entries(accumulator)) {
  output[profileId] = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([selector, count]) => ({ selector, count }));
}

writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

console.log(`[extract-profiles] sessions:         ${sessionFiles.length}`);
console.log(`[extract-profiles] click+submit:     ${totalClicks}`);
console.log(`[extract-profiles] skip (no url):    ${totalClicks - skippedTransitional - skippedNoProfile - skippedNoSelector - Object.values(accumulator).reduce((s, m) => s + [...m.values()].reduce((a, b) => a + b, 0), 0)}`);
console.log(`[extract-profiles] skip transit:     ${skippedTransitional}`);
console.log(`[extract-profiles] skip no-profile:  ${skippedNoProfile}`);
console.log(`[extract-profiles] skip no-selector: ${skippedNoSelector}`);
console.log(`[extract-profiles] written: ${outPath}`);
for (const [id, list] of Object.entries(output)) {
  console.log(`  ${id}: ${list.length} selector(s) — top: ${list[0]?.selector} (×${list[0]?.count})`);
}
