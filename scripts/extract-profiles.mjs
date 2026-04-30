import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROFILES } from '../user/highlight-engine.mjs';

const logPath = fileURLToPath(new URL('../user/behavior_log.jsonl', import.meta.url));
const outPath = fileURLToPath(new URL('../user/derived-profiles.json', import.meta.url));

const raw = readFileSync(logPath, 'utf8').trim();
const entries = raw ? raw.split('\n').map((l) => JSON.parse(l)) : [];

function deriveSelector(entry) {
  const attrs = entry.attributes ?? {};

  // 1. data-testid
  if (attrs['data-testid']) return `[data-testid="${attrs['data-testid']}"]`;

  // 2. id
  if (entry.id) return `#${entry.id}`;

  // 3. aria-label
  if (attrs['aria-label']) return `[aria-label="${attrs['aria-label']}"]`;

  // 4. href keyword (A tags only) — reject UUIDs, numeric IDs, and long tokens
  if (entry.tagName === 'A' && attrs.href) {
    try {
      const segments = new URL(attrs.href).pathname.split('/').filter(Boolean);
      const kw = segments.at(-1);
      if (kw && kw.length < 30 && !/^\d+$/.test(kw) && !/^[0-9a-f-]{32,}$/i.test(kw)) {
        return `[href*="${kw}"]`;
      }
    } catch { /* malformed href */ }
  }

  // 5. text content fallback
  const t = (entry.text ?? '').trim();
  if (t) return `text=${t}`;

  return null;
}

// profileId → Map<selector, count>
const accumulator = {};

for (const entry of entries) {
  const profile = PROFILES.find((p) => { try { return p.match(entry.url); } catch { return false; } });
  if (!profile) continue;

  const selector = deriveSelector(entry);
  if (!selector) continue;

  if (!accumulator[profile.id]) accumulator[profile.id] = new Map();
  const map = accumulator[profile.id];
  map.set(selector, (map.get(selector) ?? 0) + 1);
}

const output = {};
for (const [profileId, map] of Object.entries(accumulator)) {
  output[profileId] = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([selector, count]) => ({ selector, count }));
}

writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
console.log('Written:', outPath);
for (const [id, list] of Object.entries(output)) {
  console.log(`  ${id}: ${list.length} selector(s) (top: ${list[0]?.selector})`);
}
