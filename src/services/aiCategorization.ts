/**
 * Backward-compatibility re-export.
 *
 * All AI categorization logic has moved to:
 *   src/services/aiService.ts   — provider chain + public API
 *   src/utils/aiHelpers.ts      — keyword rules, mock data, payload builder
 *
 * This file keeps existing imports working without changes.
 */

export type {
  CategorizationSource,
  CategorizationResult,
} from './aiService';

export {
  suggestCategory,
  batchSuggestCategories,
  SOURCE_LABELS,
  EXPENSE_CATEGORIES,
} from './aiService';
