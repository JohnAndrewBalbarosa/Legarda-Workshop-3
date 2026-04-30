// Translation service.
//
// Goals:
//   - Cheapest possible LLM call (Gemini 1.5 Flash free tier by default).
//   - Seat-based key pool: TRANSLATION_KEYS env var defines N tokens. Each
//     active participant holds one. On disconnect the seat is HELD for
//     `disconnectHoldMs` (default 10 minutes) before it can be reassigned.
//   - Each seat is capped at `seatPromptCap` Gemini calls (default 3) across
//     ALL modes. Cache hits and broadcast hits do not count.
//   - Modes:
//       'tagalog' / 'taglish': queue mode. The first user's translation for a
//         given content is broadcast to every other connected user who picked
//         the same language; they don't burn a prompt and we don't re-call
//         Gemini.
//       'other': hashed cache keyed by sha256(otherLang:content). Hit returns
//         cached text for free; miss calls Gemini and stores the result.
//   - Preserves technical AWS terms.

import crypto from 'node:crypto';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const TECHNICAL_TERMS_RULE = `
Preserve these terms in English exactly: AWS, EC2, AMI, Amazon Linux, Ubuntu,
Operating System, OS, instance, instance type, t3.micro, t2.micro, Free Tier,
key pair, security group, VPC, subnet, IAM, root user, MFA, console, dashboard,
Launch instance, Sign in, password, region, availability zone.
Do not translate proper nouns, button labels, menu labels, or product names.
Translate only the explanatory narrative — make it digestible for a Filipino
beginner. Return the translation only, no preamble.
`.trim();

const MODE_PROMPTS = {
  tagalog: 'Translate the text below into natural conversational Tagalog.',
  taglish: 'Translate the text below into natural Taglish (mixed Tagalog and English, code-switching as Filipinos naturally speak).',
  other: (lang) => `Translate the text below into ${lang}.`,
};

function hashOtherContent(content, otherLang) {
  const key = `other:${otherLang || ''}:${content}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
}

function hashQueueContent(mode, content) {
  const key = `${mode}:${content}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
}

const DEFAULT_DISCONNECT_HOLD_MS = 10 * 60 * 1000;
const DEFAULT_SEAT_PROMPT_CAP = 3;
const DEFAULT_SWEEP_INTERVAL_MS = 30 * 1000;

export function createTranslationService({
  apiKey = process.env.GEMINI_API_KEY || '',
  keyPoolRaw = process.env.TRANSLATION_KEYS || '',
  seatPromptCap = DEFAULT_SEAT_PROMPT_CAP,
  disconnectHoldMs = DEFAULT_DISCONNECT_HOLD_MS,
  sweepIntervalMs = DEFAULT_SWEEP_INTERVAL_MS,
  now = () => Date.now(),
  onBroadcast = () => {},
} = {}) {
  const keyPool = keyPoolRaw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  // seats: token -> { token, participantId, status, heldUntil, promptsUsed }
  // status is 'active' (currently bound to participantId) or 'held' (waiting
  // out the disconnect TTL) or undefined (free).
  const seats = new Map();
  for (const token of keyPool) {
    seats.set(token, { token, participantId: null, status: 'free', heldUntil: 0, promptsUsed: 0 });
  }

  const participantToToken = new Map();
  const participantLanguage = new Map(); // participantId -> 'tagalog' | 'taglish' | 'other'
  const otherCache = new Map();          // hash -> translated text (mode=other)
  const queueLast = new Map();           // mode -> { content, hash, text, ts }

  function sweepHeldSeats() {
    const ts = now();
    for (const seat of seats.values()) {
      if (seat.status === 'held' && seat.heldUntil <= ts) {
        seat.status = 'free';
        seat.participantId = null;
        seat.heldUntil = 0;
        seat.promptsUsed = 0;
      }
    }
  }

  let sweepTimer = null;
  if (sweepIntervalMs > 0 && typeof setInterval === 'function') {
    sweepTimer = setInterval(sweepHeldSeats, sweepIntervalMs);
    if (sweepTimer && typeof sweepTimer.unref === 'function') {
      sweepTimer.unref();
    }
  }

  function assignSeat(participantId) {
    if (!participantId) return null;
    sweepHeldSeats();

    const existingToken = participantToToken.get(participantId);
    if (existingToken) {
      const existing = seats.get(existingToken);
      if (existing) {
        existing.status = 'active';
        existing.heldUntil = 0;
        return { token: existing.token, promptsUsed: existing.promptsUsed, promptCap: seatPromptCap };
      }
    }

    let candidate = null;
    for (const seat of seats.values()) {
      if (seat.status === 'free') {
        candidate = seat;
        break;
      }
    }
    if (!candidate) return null;

    candidate.status = 'active';
    candidate.participantId = participantId;
    candidate.heldUntil = 0;
    candidate.promptsUsed = 0;
    participantToToken.set(participantId, candidate.token);
    return { token: candidate.token, promptsUsed: 0, promptCap: seatPromptCap };
  }

  function releaseSeat(participantId) {
    const token = participantToToken.get(participantId);
    if (!token) return;
    const seat = seats.get(token);
    if (!seat) return;
    seat.status = 'held';
    seat.heldUntil = now() + disconnectHoldMs;
    participantToToken.delete(participantId);
    participantLanguage.delete(participantId);
  }

  function setLanguage(participantId, mode) {
    if (!participantId) return;
    if (mode === 'tagalog' || mode === 'taglish' || mode === 'other') {
      participantLanguage.set(participantId, mode);
    }
  }

  function getLanguage(participantId) {
    return participantLanguage.get(participantId) || null;
  }

  function getParticipantsByLanguage(mode) {
    const ids = [];
    for (const [participantId, lang] of participantLanguage.entries()) {
      if (lang === mode) ids.push(participantId);
    }
    return ids;
  }

  async function callGemini(prompt) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim();
  }

  function buildPrompt(content, mode, otherLang) {
    const instr =
      mode === 'other'
        ? MODE_PROMPTS.other(otherLang || 'Filipino')
        : MODE_PROMPTS[mode] || MODE_PROMPTS.tagalog;
    return `${instr}\n\n${TECHNICAL_TERMS_RULE}\n\n---\n${content}\n---`;
  }

  async function translate({ participantId, content, mode, otherLang } = {}) {
    if (!content || typeof content !== 'string') {
      return { ok: false, error: 'empty_content' };
    }
    if (!['tagalog', 'taglish', 'other'].includes(mode)) {
      return { ok: false, error: 'bad_mode' };
    }
    if (!participantId) {
      return { ok: false, error: 'no_participant' };
    }

    const token = participantToToken.get(participantId);
    if (!token) {
      return { ok: false, error: 'no_seat' };
    }
    const seat = seats.get(token);
    if (!seat || seat.status !== 'active') {
      return { ok: false, error: 'seat_inactive' };
    }

    setLanguage(participantId, mode);

    // --- Tagalog / Taglish queue path ---------------------------------------
    // If the most recent broadcast for this mode is the same content, reuse it.
    if (mode === 'tagalog' || mode === 'taglish') {
      const queueHash = hashQueueContent(mode, content);
      const last = queueLast.get(mode);
      if (last && last.hash === queueHash) {
        return { ok: true, cached: true, broadcast: false, hash: queueHash, mode, text: last.text };
      }
    }

    // --- Other mode hashed cache -------------------------------------------
    if (mode === 'other') {
      const hash = hashOtherContent(content, otherLang);
      if (otherCache.has(hash)) {
        return { ok: true, cached: true, broadcast: false, hash, mode, text: otherCache.get(hash) };
      }
    }

    // We will call the LLM — first check the seat's prompt cap.
    if (seat.promptsUsed >= seatPromptCap) {
      return { ok: false, error: 'cap_reached' };
    }

    let text;
    try {
      text = await callGemini(buildPrompt(content, mode, otherLang));
    } catch (err) {
      return { ok: false, error: 'llm_failed', detail: String(err.message || err) };
    }
    if (!text) return { ok: false, error: 'empty_response' };

    seat.promptsUsed += 1;

    if (mode === 'other') {
      const hash = hashOtherContent(content, otherLang);
      otherCache.set(hash, text);
      return { ok: true, cached: false, broadcast: false, hash, mode, text, promptsUsed: seat.promptsUsed };
    }

    // tagalog / taglish: store as the latest broadcast for the mode.
    const queueHash = hashQueueContent(mode, content);
    const broadcastEntry = { content, hash: queueHash, text, ts: now() };
    queueLast.set(mode, broadcastEntry);

    // Push to every other connected user with the same language. The hosting
    // websocket layer wires this callback up so the service stays transport-agnostic.
    try {
      const recipients = getParticipantsByLanguage(mode).filter((id) => id !== participantId);
      if (recipients.length > 0) {
        onBroadcast({ mode, recipients, hash: queueHash, text, content });
      }
    } catch {
      // never fail the caller because of broadcast plumbing
    }

    return { ok: true, cached: false, broadcast: true, hash: queueHash, mode, text, promptsUsed: seat.promptsUsed };
  }

  function getStats() {
    let active = 0;
    let held = 0;
    let free = 0;
    for (const seat of seats.values()) {
      if (seat.status === 'active') active += 1;
      else if (seat.status === 'held') held += 1;
      else free += 1;
    }
    return {
      keyPoolSize: keyPool.length,
      seatsActive: active,
      seatsHeld: held,
      seatsFree: free,
      otherCacheSize: otherCache.size,
      queueModes: Array.from(queueLast.keys()),
    };
  }

  function close() {
    if (sweepTimer) clearInterval(sweepTimer);
  }

  return {
    assignSeat,
    releaseSeat,
    setLanguage,
    getLanguage,
    translate,
    getStats,
    close,
    // exposed for tests / inspection only
    _seats: seats,
  };
}
