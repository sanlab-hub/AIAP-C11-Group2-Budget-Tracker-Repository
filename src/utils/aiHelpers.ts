/**
 * AI categorization helpers.
 *
 * Keyword rules and mock data live here so they can be updated without
 * touching provider logic in aiService.ts.
 */

export const EXPENSE_CATEGORIES = [
  'Food', 'Travel', 'Shopping', 'Bills',
  'Entertainment', 'Health', 'Education', 'Miscellaneous',
] as const;

export const INCOME_CATEGORIES = ['Salary', 'Freelance'] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
export type IncomeCategory  = typeof INCOME_CATEGORIES[number];
export type KnownCategory   = ExpenseCategory | IncomeCategory;

// ─── Keyword rules ────────────────────────────────────────────────────────────

interface KeywordRule {
  category: ExpenseCategory;
  keywords: string[];
}

export const KEYWORD_RULES: KeywordRule[] = [
  {
    category: 'Food',
    keywords: [
      'uber eats', 'doordash', 'grubhub', 'instacart', 'mcdonald', 'burger king',
      'starbucks', 'coffee', 'restaurant', 'grocery', 'groceries', 'food', 'dining',
      'pizza', 'sushi', 'cafe', 'bakery', 'chipotle', 'subway', 'wendys', 'taco bell',
      'panera', 'dominos', 'diner', 'bistro', 'eatery', 'whole foods', 'trader joe',
      'shake shack', 'cheesecake factory', 'nobu', 'costco food',
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

// ─── Keyword fallback ─────────────────────────────────────────────────────────

/**
 * Pure synchronous keyword match — zero latency, zero network.
 * Returns the first matching category or 'Miscellaneous'.
 */
export function keywordMatch(merchant: string, notes: string): {
  category: ExpenseCategory;
  confidence: number;
} {
  const text = `${merchant} ${notes}`.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return { category: rule.category, confidence: 0.78 };
      }
    }
  }
  return { category: 'Miscellaneous', confidence: 0.4 };
}

// ─── Mock AI responses (for demos without live keys) ─────────────────────────

const MOCK_RULES: { pattern: RegExp; category: ExpenseCategory }[] = [
  { pattern: /uber|lyft|taxi|airport|flight|airline|airbnb|hotel|gas|fuel/i, category: 'Travel' },
  { pattern: /food|eat|restaurant|cafe|coffee|pizza|burger|sushi|grocery/i,  category: 'Food' },
  { pattern: /amazon|walmart|target|shop|store|clothing|apparel/i,           category: 'Shopping' },
  { pattern: /netflix|hulu|spotify|movie|cinema|concert|game|gaming/i,       category: 'Entertainment' },
  { pattern: /electric|water|phone|internet|insurance|rent|bill|utility/i,   category: 'Bills' },
  { pattern: /gym|doctor|pharmacy|dentist|health|medicine|therapy/i,         category: 'Health' },
  { pattern: /school|course|university|tuition|book|education|learn/i,       category: 'Education' },
];

/**
 * Deterministic mock that returns richer results than keyword fallback.
 * Used when neither n8n nor OpenAI is configured, to simulate AI in demos.
 */
export function mockAiResponse(merchant: string, notes: string): {
  category: ExpenseCategory;
  confidence: number;
} {
  const text = `${merchant} ${notes}`;
  for (const rule of MOCK_RULES) {
    if (rule.pattern.test(text)) {
      return { category: rule.category, confidence: 0.92 };
    }
  }
  return { category: 'Miscellaneous', confidence: 0.5 };
}

// ─── Payload builder ──────────────────────────────────────────────────────────

/** Canonical payload shape sent to both n8n and OpenAI. */
export interface CategorizationPayload {
  merchant: string;
  notes: string;
  categories: string[];
  type: 'expense' | 'income';
}

export function buildPayload(
  merchant: string,
  notes: string,
  type: 'expense' | 'income' = 'expense',
): CategorizationPayload {
  return {
    merchant: merchant.trim(),
    notes: notes.trim(),
    categories: [...EXPENSE_CATEGORIES],
    type,
  };
}
