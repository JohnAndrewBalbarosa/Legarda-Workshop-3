// Translation service.
//
// Goals:
//   - Cheapest possible LLM call (Gemini 1.5 Flash free tier by default).
//   - Cache: same content + same mode reuses the first user's translation.
//     Means tokens are only spent once per (content, mode) pair.
//   - Key pool of N tokens (.env TRANSLATION_KEYS comma-sep). Each user
//     session gets one assigned. Once exhausted, no more issued.
//   - Modes: 'tagalog' | 'taglish' | 'other'. Tagalog/Taglish open to all.
//     'other' requires a key and capped at 2 prompts per user.
//   - Preserves technical AWS terms (AMI, EC2, Operating System, t3.micro, etc).

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

function hashContent(content, mode, otherLang) {
  const key = `${mode}:${otherLang || ''}:${content}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
}

export function createTranslationService({
  apiKey = process.env.GEMINI_API_KEY || '',
  keyPoolRaw = process.env.TRANSLATION_KEYS || '',
  otherPromptCap = 2,
} = {}) {
  const keyPool = keyPoolRaw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const issuedKeys = new Map(); // participantId -> { token, otherUsed }
  const tokenToParticipant = new Map();
  const cache = new Map(); // contentHash -> translation text

  function issueKey(participantId) {
    if (issuedKeys.has(participantId)) return issuedKeys.get(participantId);
    const used = new Set(tokenToParticipant.keys());
    const free = keyPool.find((k) => !used.has(k));
    if (!free) return null;
    const record = { token: free, otherUsed: 0 };
    issuedKeys.set(participantId, record);
    tokenToParticipant.set(free, participantId);
    return record;
  }

  function validateKey(participantId, token) {
    const record = issuedKeys.get(participantId);
    return record && record.token === token ? record : null;
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

  async function translate({
    participantId,
    content,
    mode,
    otherLang,
    token,
  }) {
    if (!content || typeof content !== 'string') {
      return { ok: false, error: 'empty_content' };
    }
    if (!['tagalog', 'taglish', 'other'].includes(mode)) {
      return { ok: false, error: 'bad_mode' };
    }

    if (mode === 'other') {
      const record = validateKey(participantId, token);
      if (!record) return { ok: false, error: 'key_required' };
      if (record.otherUsed >= otherPromptCap) {
        return { ok: false, error: 'cap_reached' };
      }
    }

    const hash = hashContent(content, mode, otherLang);
    if (cache.has(hash)) {
      return { ok: true, cached: true, hash, mode, text: cache.get(hash) };
    }

    let text;
    try {
      text = await callGemini(buildPrompt(content, mode, otherLang));
    } catch (err) {
      return { ok: false, error: 'llm_failed', detail: String(err.message || err) };
    }

    if (!text) return { ok: false, error: 'empty_response' };

    cache.set(hash, text);
    if (mode === 'other') {
      const record = issuedKeys.get(participantId);
      if (record) record.otherUsed += 1;
    }
    return { ok: true, cached: false, hash, mode, text };
  }

  function getStats() {
    return {
      keyPoolSize: keyPool.length,
      keysIssued: issuedKeys.size,
      keysAvailable: keyPool.length - issuedKeys.size,
      cacheSize: cache.size,
    };
  }

  return { issueKey, translate, getStats };
}
