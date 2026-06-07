/**
 * aiService — centralized AI categorization service.
 *
 * Provider priority (first success wins):
 *   1. n8n webhook   — activated by setting VITE_N8N_WEBHOOK_URL
 *   2. OpenAI direct — activated by setting VITE_OPENAI_API_KEY
 *   3. Mock AI       — deterministic pattern matching (demo-safe, offline)
 *   4. Keyword rules — pure string matching (final safety net)
 *
 * To plug in a new provider in the future:
 *   1. Add a function following the CategorizationProvider signature below
 *   2. Push it into the PROVIDERS array before the fallbacks
 *   3. Set the corresponding env var
 *
 * Nothing in this file should be imported by UI components directly.
 * Use the public suggestCategory() export from this module (or the
 * re-export in aiCategorization.ts for backward compatibility).
 */

import {
  EXPENSE_CATEGORIES,
  keywordMatch,
  mockAiResponse,
  buildPayload,
  CategorizationPayload,
} from '../utils/aiHelpers';

// ─── Environment config ───────────────────────────────────────────────────────
// New vars only need to be added here — no other file changes needed.

const CONFIG = {
  n8nWebhookUrl:  import.meta.env.VITE_N8N_WEBHOOK_URL  as string | undefined,
  openAiApiKey:   import.meta.env.VITE_OPENAI_API_KEY   as string | undefined,
  openAiModel:    (import.meta.env.VITE_OPENAI_MODEL    as string | undefined) ?? 'gpt-4o-mini',
  timeoutN8n:     5_000,
  timeoutOpenAI:  8_000,
} as const;

// ─── Public types ─────────────────────────────────────────────────────────────

export type CategorizationSource = 'n8n' | 'openai' | 'mock' | 'fallback';

export interface CategorizationResult {
  categoryName: string;
  confidence: number;
  source: CategorizationSource;
}

/** Display labels for each provider source — used in the UI badge. */
export const SOURCE_LABELS: Record<CategorizationSource, string> = {
  n8n:      'n8n',
  openai:   'AI',
  mock:     'Suggested',
  fallback: 'Suggested',
};

// ─── Provider type ────────────────────────────────────────────────────────────

/** Every provider must satisfy this signature. */
type CategorizationProvider = (
  payload: CategorizationPayload,
) => Promise<CategorizationResult>;

// ─── Provider: n8n webhook ────────────────────────────────────────────────────
//
// Webhook POST contract (send):
//   { merchant, notes, categories: string[], type }
// Webhook response contract (receive):
//   { category: string, confidence: number }
//
// To connect n8n: set VITE_N8N_WEBHOOK_URL to your workflow trigger URL.
// No code changes needed.

async function n8nProvider(payload: CategorizationPayload): Promise<CategorizationResult> {
  if (!CONFIG.n8nWebhookUrl) throw new Error('n8n not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.timeoutN8n);

  try {
    const res = await fetch(CONFIG.n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`n8n HTTP ${res.status}`);
    const data = await res.json();
    const categoryName = String(data.category ?? data.categoryName ?? '').trim();
    const confidence = clampConfidence(Number(data.confidence ?? 0.85));
    validateCategory(categoryName, payload.categories);
    return { categoryName, confidence, source: 'n8n' };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Provider: OpenAI direct ──────────────────────────────────────────────────
//
// Uses gpt-4o-mini (configurable via VITE_OPENAI_MODEL).
// IMPORTANT: The API key is exposed in the browser bundle. For production,
// route calls through a Supabase Edge Function or your own backend instead,
// then treat that endpoint like the n8n webhook above.
//
// To connect OpenAI: set VITE_OPENAI_API_KEY. No code changes needed.

async function openAiProvider(payload: CategorizationPayload): Promise<CategorizationResult> {
  if (!CONFIG.openAiApiKey) throw new Error('OpenAI not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.timeoutOpenAI);

  const userPrompt = [
    `Merchant: ${payload.merchant || '(unknown)'}`,
    `Notes: ${payload.notes || '(none)'}`,
    `Available categories: ${payload.categories.join(', ')}`,
    'Return JSON only, no markdown: {"category":"<best match>","confidence":<0.0-1.0>}',
  ].join('\n');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONFIG.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: CONFIG.openAiModel,
        messages: [
          {
            role: 'system',
            content:
              'You are a financial transaction categorization assistant. ' +
              'Given a merchant name and optional notes, pick the single best category ' +
              'from the provided list. Respond only with valid JSON.',
          },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 60,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    const categoryName = String(parsed.category ?? '').trim();
    const confidence = clampConfidence(Number(parsed.confidence ?? 0.85));
    validateCategory(categoryName, payload.categories);
    return { categoryName, confidence, source: 'openai' };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Provider: Mock AI (demo / offline) ──────────────────────────────────────

async function mockProvider(payload: CategorizationPayload): Promise<CategorizationResult> {
  const { category, confidence } = mockAiResponse(payload.merchant, payload.notes);
  return { categoryName: category, confidence, source: 'mock' };
}

// ─── Provider: Keyword fallback ───────────────────────────────────────────────

async function keywordProvider(payload: CategorizationPayload): Promise<CategorizationResult> {
  const { category, confidence } = keywordMatch(payload.merchant, payload.notes);
  return { categoryName: category, confidence, source: 'fallback' };
}

// ─── Provider chain ───────────────────────────────────────────────────────────
//
// Providers are attempted in order. The first that resolves without throwing wins.
// Add future providers (Anthropic, custom backend, etc.) here.

const PROVIDERS: CategorizationProvider[] = [
  n8nProvider,
  openAiProvider,
  mockProvider,
  keywordProvider,
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Suggest a category for an expense given merchant name and/or notes.
 *
 * Runs the provider chain: n8n → OpenAI → mock → keyword.
 * Never throws — always returns a result.
 */
export async function suggestCategory(
  merchant: string,
  notes: string,
  type: 'expense' | 'income' = 'expense',
): Promise<CategorizationResult> {
  if (type === 'income') {
    return { categoryName: 'Salary', confidence: 0.5, source: 'fallback' };
  }

  const text = `${merchant} ${notes}`.trim();
  if (!text || text.length < 2) {
    return { categoryName: 'Miscellaneous', confidence: 0.2, source: 'fallback' };
  }

  const payload = buildPayload(merchant, notes, type);

  for (const provider of PROVIDERS) {
    try {
      const result = await provider(payload);
      if (result.confidence >= 0.4) return result;
    } catch (_) {
      // Provider unavailable or returned bad data — try next
    }
  }

  // Should never reach here (keywordProvider always succeeds)
  return { categoryName: 'Miscellaneous', confidence: 0.2, source: 'fallback' };
}

/**
 * Batch-categorize multiple transactions at once.
 * Uses the same provider chain; failures per-item fall through to fallback.
 */
export async function batchSuggestCategories(
  items: { merchant: string; notes: string }[],
  type: 'expense' | 'income' = 'expense',
): Promise<CategorizationResult[]> {
  return Promise.all(items.map(({ merchant, notes }) => suggestCategory(merchant, notes, type)));
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function clampConfidence(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function validateCategory(name: string, allowed: string[]): void {
  if (!name || !allowed.includes(name)) {
    throw new Error(`Unrecognized category: "${name}"`);
  }
}

/** Expose category list for consumers that need to display/validate categories. */
export { EXPENSE_CATEGORIES };
