/**
 * AI expense categorization service.
 *
 * Priority chain (first success wins):
 *   1. n8n webhook   — set VITE_N8N_WEBHOOK_URL to enable
 *   2. OpenAI direct — set VITE_OPENAI_API_KEY to enable
 *   3. Keyword fallback — always available, zero latency
 *
 * All failures are caught and the fallback is returned so the UI
 * never breaks regardless of network or config state.
 */

const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;
const OPENAI_API_KEY  = import.meta.env.VITE_OPENAI_API_KEY  as string | undefined;

export type CategorizationSource = 'n8n' | 'openai' | 'fallback';

export interface CategorizationResult {
  categoryName: string;
  confidence: number;
  source: CategorizationSource;
}

const EXPENSE_CATEGORIES = [
  'Food', 'Travel', 'Shopping', 'Bills',
  'Entertainment', 'Health', 'Education', 'Miscellaneous',
] as const;

// ─── Keyword fallback ─────────────────────────────────────────────────────────

const KEYWORD_RULES: { category: string; keywords: string[] }[] = [
  {
    category: 'Food',
    keywords: [
      'uber eats', 'doordash', 'grubhub', 'instacart', 'mcdonald', 'burger king',
      'starbucks', 'coffee', 'restaurant', 'grocery', 'groceries', 'food', 'dining',
      'pizza', 'sushi', 'cafe', 'bakery', 'chipotle', 'subway', 'wendys', 'taco bell',
      'panera', 'dominos', 'diner', 'bistro', 'eatery', 'whole foods', 'trader joe',
    ],
  },
  {
    category: 'Travel',
    keywords: [
      'uber', 'lyft', 'airbnb', 'hotel', 'marriott', 'hilton', 'hyatt',
      'flight', 'airline', 'airport', 'taxi', 'train', 'amtrak', 'greyhound',
      'gas', 'gasoline', 'fuel', 'shell', 'chevron', 'exxon', 'bp',
      'travel', 'car rental', 'hertz', 'avis', 'enterprise', 'parking',
      'delta', 'united', 'southwest', 'american airlines', 'jetblue',
    ],
  },
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'walmart', 'target', 'ebay', 'etsy', 'wayfair', 'ikea',
      'best buy', 'costco', 'home depot', 'lowes', 'macys', 'nordstrom',
      'shop', 'store', 'clothing', 'apparel', 'fashion', 'mall',
      'nike', 'adidas', 'zara', 'h&m', 'uniqlo', 'gap', 'old navy',
    ],
  },
  {
    category: 'Bills',
    keywords: [
      'electric', 'electricity', 'water', 'gas bill', 'internet', 'broadband',
      'phone', 'cell', 'verizon', 'at&t', 't-mobile', 'comcast', 'xfinity',
      'insurance', 'rent', 'mortgage', 'utilities', 'netflix', 'hulu',
      'subscription', 'bill', 'invoice', 'payment', 'lease',
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'cinema', 'movie', 'theater', 'gaming', 'steam', 'playstation', 'xbox',
      'nintendo', 'concert', 'ticket', 'music', 'spotify', 'youtube premium',
      'twitch', 'amusement', 'bowling', 'arcade', 'escape room', 'club',
      'bar', 'pub', 'nightclub', 'comedy', 'show', 'event',
    ],
  },
  {
    category: 'Health',
    keywords: [
      'pharmacy', 'cvs', 'walgreens', 'rite aid', 'hospital', 'clinic',
      'doctor', 'dental', 'dentist', 'optometrist', 'gym', 'planet fitness',
      '24 hour fitness', 'health', 'medicine', 'medical', 'prescription',
      'urgent care', 'vitamin', 'supplement', 'therapy', 'lab', 'imaging',
    ],
  },
  {
    category: 'Education',
    keywords: [
      'coursera', 'udemy', 'udacity', 'pluralsight', 'skillshare', 'linkedin learning',
      'school', 'university', 'college', 'tuition', 'books', 'textbook',
      'course', 'education', 'learning', 'tutoring', 'library', 'class',
      'workshop', 'seminar', 'bootcamp', 'khan academy',
    ],
  },
];

function fallbackCategorize(merchant: string, notes: string): CategorizationResult {
  const text = `${merchant} ${notes}`.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return { categoryName: rule.category, confidence: 0.78, source: 'fallback' };
      }
    }
  }
  return { categoryName: 'Miscellaneous', confidence: 0.4, source: 'fallback' };
}

// ─── n8n webhook ──────────────────────────────────────────────────────────────
//
// Expected POST payload:  { merchant, notes, categories: string[] }
// Expected response body: { category: string, confidence: number }

async function callN8nWebhook(
  merchant: string,
  notes: string,
  categories: readonly string[],
): Promise<CategorizationResult> {
  if (!N8N_WEBHOOK_URL) throw new Error('n8n not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant, notes, categories: [...categories] }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`n8n HTTP ${res.status}`);
    const data = await res.json();
    const categoryName = String(data.category ?? data.categoryName ?? '').trim();
    const confidence = Math.min(1, Math.max(0, Number(data.confidence ?? 0.85)));
    if (!categoryName || !(categories as readonly string[]).includes(categoryName)) {
      throw new Error('n8n returned unrecognized category');
    }
    return { categoryName, confidence, source: 'n8n' };
  } finally {
    clearTimeout(timer);
  }
}

// ─── OpenAI direct ────────────────────────────────────────────────────────────
//
// Uses gpt-4o-mini with JSON-mode-style prompting.
// Requires VITE_OPENAI_API_KEY. The key is exposed in the browser bundle —
// in production, proxy through a backend or Supabase Edge Function instead.

async function callOpenAI(
  merchant: string,
  notes: string,
  categories: readonly string[],
): Promise<CategorizationResult> {
  if (!OPENAI_API_KEY) throw new Error('OpenAI not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  const userPrompt = [
    `Merchant: ${merchant || '(unknown)'}`,
    `Notes: ${notes || '(none)'}`,
    `Available categories: ${categories.join(', ')}`,
    'Return JSON only, no markdown: {"category":"<best match>","confidence":<0.0-1.0>}',
  ].join('\n');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.85)));
    if (!categoryName || !(categories as readonly string[]).includes(categoryName)) {
      throw new Error('OpenAI returned unrecognized category');
    }
    return { categoryName, confidence, source: 'openai' };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Suggest a category for an expense given merchant name and/or notes.
 *
 * Tries (in order): n8n webhook → OpenAI direct → keyword fallback.
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

  // 1 — n8n webhook
  if (N8N_WEBHOOK_URL) {
    try {
      return await callN8nWebhook(merchant, notes, EXPENSE_CATEGORIES);
    } catch (_) { /* fall through */ }
  }

  // 2 — OpenAI direct
  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(merchant, notes, EXPENSE_CATEGORIES);
    } catch (_) { /* fall through */ }
  }

  // 3 — Keyword fallback (synchronous, always succeeds)
  return fallbackCategorize(merchant, notes);
}

/** Source display labels for the UI. */
export const SOURCE_LABELS: Record<CategorizationSource, string> = {
  n8n:      'n8n',
  openai:   'AI',
  fallback: 'Suggested',
};
