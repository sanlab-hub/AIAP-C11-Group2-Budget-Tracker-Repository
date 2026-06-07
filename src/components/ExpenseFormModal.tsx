import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Plus, ChevronDown, Sparkles, Loader2 } from 'lucide-react';
import { Category, Expense, TransactionType, PAYMENT_METHODS } from '../types';
import { createExpense, updateExpense, createCategory } from '../services/api';
import { suggestCategory, CategorizationResult, SOURCE_LABELS } from '../services/aiService';
import { CATEGORY_COLORS } from '../utils/helpers';

interface Props {
  expense?: Expense;
  categories: Category[];
  onClose: () => void;
  onSaved: (expense: Expense, isNew: boolean) => void;
  currency?: string;
}

interface NewCatState {
  name: string;
  color: string;
}

export function ExpenseFormModal({ expense, categories, onClose, onSaved, currency = 'USD' }: Props) {
  const isEdit = !!expense;

  const [type, setType] = useState<TransactionType>(expense?.type ?? 'expense');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [merchant, setMerchant] = useState(expense?.merchant ?? '');
  const [notes, setNotes] = useState(expense?.notes ?? expense?.description ?? '');
  const [date, setDate] = useState(
    expense?.expense_date ?? expense?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [categoryId, setCategoryId] = useState(expense?.category_id ?? '');
  const [paymentMethod, setPaymentMethod] = useState(expense?.payment_method ?? '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState<NewCatState>({ name: '', color: CATEGORY_COLORS[0] });
  const [creatingCat, setCreatingCat] = useState(false);

  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<CategorizationResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>();

  const filtered = categories.filter(c => c.type === type);

  // Trigger AI suggestion after debounce whenever merchant/notes change
  const scheduleSuggestion = useCallback((m: string, n: string, t: TransactionType, catId: string) => {
    clearTimeout(suggestTimer.current);
    // Only suggest for new expenses with no category selected yet
    if (isEdit || catId || t !== 'expense') return;
    const text = `${m} ${n}`.trim();
    if (text.length < 3) {
      setAiSuggestion(null);
      return;
    }
    setAiLoading(true);
    setAiSuggestion(null);
    suggestTimer.current = setTimeout(async () => {
      try {
        const result = await suggestCategory(m, n, t);
        if (result.confidence >= 0.5) setAiSuggestion(result);
      } catch (_) {
        // silent — fallback already handled inside suggestCategory
      } finally {
        setAiLoading(false);
      }
    }, 700);
  }, [isEdit]);

  // Cancel pending suggestion on unmount
  useEffect(() => () => clearTimeout(suggestTimer.current), []);

  const acceptSuggestion = () => {
    if (!aiSuggestion) return;
    const match = filtered.find(
      c => c.name.toLowerCase() === aiSuggestion.categoryName.toLowerCase(),
    );
    if (match) {
      setCategoryId(match.id);
      setAiSuggestion(null);
      setAiLoading(false);
    }
  };

  function validate(): boolean {
    const e: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount greater than 0';
    if (!date) e.date = 'Date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        amount: parseFloat(amount),
        type,
        date,
        expense_date: date,
        category_id: categoryId || null,
        merchant: merchant.trim() || null,
        notes: notes.trim() || null,
        description: notes.trim() || null,
        payment_method: paymentMethod || null,
      };
      const saved = isEdit
        ? await updateExpense(expense.id, payload)
        : await createExpense(payload);
      onSaved(saved, !isEdit);
      onClose();
    } catch (err: any) {
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCat.name.trim()) return;
    setCreatingCat(true);
    try {
      const created = await createCategory({ name: newCat.name.trim(), color: newCat.color, icon: 'tag', type });
      categories.push(created);
      setCategoryId(created.id);
      setAiSuggestion(null);
      setShowNewCat(false);
      setNewCat({ name: '', color: CATEGORY_COLORS[0] });
    } catch (_) {
    } finally {
      setCreatingCat(false);
    }
  };

  const currencySymbol = currency === 'USD' ? '$' : currency;

  // Source pill config
  const sourceLabel = aiSuggestion ? SOURCE_LABELS[aiSuggestion.source] : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="card w-full sm:max-w-lg rounded-b-none sm:rounded-2xl max-h-[96vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {isEdit ? 'Edit Transaction' : 'Add Transaction'}
            </h2>
            {isEdit && expense.merchant && (
              <p className="text-xs text-gray-400 mt-0.5">{expense.merchant}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

          {/* Type toggle */}
          {!isEdit && (
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {(['expense', 'income'] as TransactionType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    setCategoryId('');
                    setAiSuggestion(null);
                    clearTimeout(suggestTimer.current);
                    setAiLoading(false);
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                    type === t
                      ? t === 'expense'
                        ? 'bg-white dark:bg-gray-700 text-error-600 dark:text-error-400 shadow-sm'
                        : 'bg-white dark:bg-gray-700 text-success-600 dark:text-success-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="label">Amount <span className="text-error-500">*</span></label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">
                {currencySymbol}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => {
                  setAmount(e.target.value);
                  if (errors.amount) setErrors(p => ({ ...p, amount: '' }));
                }}
                placeholder="0.00"
                className={`input pl-8 text-lg font-semibold ${errors.amount ? 'border-error-400 focus:ring-error-400' : ''}`}
                autoFocus={!isEdit}
              />
            </div>
            {errors.amount && <p className="text-error-500 text-xs mt-1">{errors.amount}</p>}
          </div>

          {/* Merchant */}
          <div>
            <label className="label">Merchant / Payee</label>
            <input
              type="text"
              value={merchant}
              onChange={e => {
                setMerchant(e.target.value);
                scheduleSuggestion(e.target.value, notes, type, categoryId);
              }}
              placeholder="e.g. Amazon, Starbucks, Netflix"
              className="input"
              maxLength={100}
            />
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Category</label>
              <button
                type="button"
                onClick={() => setShowNewCat(v => !v)}
                className="text-xs text-primary-600 dark:text-primary-400 font-medium flex items-center gap-0.5 hover:underline"
              >
                <Plus className="w-3 h-3" />
                New category
              </button>
            </div>

            {/* AI suggestion strip */}
            {!isEdit && type === 'expense' && !categoryId && (
              <>
                {aiLoading && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800/40">
                    <Loader2 className="w-3.5 h-3.5 text-primary-500 animate-spin flex-shrink-0" />
                    <span className="text-xs text-primary-600 dark:text-primary-400">Categorizing…</span>
                  </div>
                )}
                {!aiLoading && aiSuggestion && (
                  <div className="flex items-center justify-between mb-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800/40">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-gold-500 flex-shrink-0" />
                      <span className="text-xs text-primary-700 dark:text-primary-300 truncate">
                        <span className="font-semibold">{aiSuggestion.categoryName}</span>
                      </span>
                      <span className="text-[10px] font-medium bg-primary-100 dark:bg-primary-800/50 text-primary-500 dark:text-primary-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {sourceLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={acceptSuggestion}
                        className="text-xs font-semibold text-primary-700 dark:text-primary-300 hover:text-primary-900 dark:hover:text-primary-100 px-2 py-0.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-800/50 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiSuggestion(null)}
                        className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        aria-label="Dismiss suggestion"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* New category inline form */}
            {showNewCat && (
              <div className="mb-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Create custom category</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCat.name}
                    onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                    placeholder="Category name"
                    className="input text-sm flex-1"
                    maxLength={40}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateCategory())}
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={!newCat.name.trim() || creatingCat}
                    className="btn-primary text-xs px-3 py-2 flex-shrink-0"
                  >
                    {creatingCat ? '…' : 'Add'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCat(p => ({ ...p, color: c }))}
                      className={`w-6 h-6 rounded-full transition-transform ${newCat.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="relative">
              <select
                value={categoryId}
                onChange={e => {
                  setCategoryId(e.target.value);
                  if (e.target.value) {
                    setAiSuggestion(null);
                    clearTimeout(suggestTimer.current);
                    setAiLoading(false);
                  }
                }}
                className="input appearance-none pr-8"
              >
                <option value="">No category</option>
                {filtered.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Payment + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Payment Method</label>
              <div className="relative">
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="input appearance-none pr-8"
                >
                  <option value="">Any</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label">Date <span className="text-error-500">*</span></label>
              <input
                type="date"
                value={date}
                onChange={e => {
                  setDate(e.target.value);
                  if (errors.date) setErrors(p => ({ ...p, date: '' }));
                }}
                className={`input ${errors.date ? 'border-error-400' : ''}`}
              />
              {errors.date && <p className="text-error-500 text-xs mt-1">{errors.date}</p>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              value={notes}
              onChange={e => {
                setNotes(e.target.value);
                scheduleSuggestion(merchant, e.target.value, type, categoryId);
              }}
              placeholder="Optional description or note…"
              className="input resize-none"
              rows={2}
              maxLength={500}
            />
          </div>

          {errors.form && (
            <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800/40 rounded-xl px-4 py-2.5">
              <p className="text-error-600 dark:text-error-400 text-sm">{errors.form}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 py-2.5">
              {loading
                ? (isEdit ? 'Saving…' : 'Adding…')
                : (isEdit ? 'Save Changes' : 'Add Transaction')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
