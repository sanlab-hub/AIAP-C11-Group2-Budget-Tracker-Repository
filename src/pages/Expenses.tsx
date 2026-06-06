import { useEffect, useRef, useState } from 'react';
import {
  Plus, Search, Filter, X, Trash2, Pencil, SlidersHorizontal,
  TrendingUp, TrendingDown, Minus, Receipt, ChevronDown,
} from 'lucide-react';
import {
  getExpenses, deleteExpense, getOrSeedCategories, subscribeToExpenses, unsubscribe,
} from '../services/api';
import { Expense, Category, TransactionType, PAYMENT_METHODS } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { ExpenseFormModal } from '../components/ExpenseFormModal';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'last_month';

function applyDatePreset(preset: DatePreset, expenses: Expense[]): Expense[] {
  if (preset === 'all') return expenses;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (preset === 'today') return expenses.filter(e => (e.expense_date ?? e.date) === todayStr);
  if (preset === 'week') {
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6);
    const from = weekAgo.toISOString().slice(0, 10);
    return expenses.filter(e => (e.expense_date ?? e.date) >= from);
  }
  if (preset === 'month') {
    const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    return expenses.filter(e => (e.expense_date ?? e.date) >= from);
  }
  if (preset === 'last_month') {
    const y = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const m = today.getMonth() === 0 ? 12 : today.getMonth();
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    const to = lastDay.toISOString().slice(0, 10);
    return expenses.filter(e => {
      const d = e.expense_date ?? e.date;
      return d >= from && d <= to;
    });
  }
  return expenses;
}

const DATE_LABELS: Record<DatePreset, string> = {
  all: 'All time', today: 'Today', week: 'Past 7 days', month: 'This month', last_month: 'Last month',
};

function CategoryDot({ color, size = 'md' }: { color: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  return <span className={`${cls} rounded-full flex-shrink-0 inline-block`} style={{ backgroundColor: color }} />;
}

function AmountBadge({ type, amount, currency }: { type: TransactionType; amount: number; currency: string }) {
  return (
    <span className={`font-semibold tabular-nums ${type === 'income' ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
      {type === 'income' ? '+' : '−'}{formatCurrency(Number(amount), currency)}
    </span>
  );
}

function PaymentChip({ method }: { method: string }) {
  return (
    <span className="text-[11px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full font-medium">
      {method}
    </span>
  );
}

// ─── Mobile expense card ─────────────────────────────────────────────────────

function ExpenseCard({
  expense, onEdit, onDelete, currency,
}: { expense: Expense; onEdit: () => void; onDelete: () => void; currency: string }) {
  const color = expense.category?.color ?? '#6b7280';
  const label = expense.merchant || expense.notes || expense.description || expense.category?.name || 'Transaction';
  const dateStr = new Date((expense.expense_date ?? expense.date) + 'T00:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {label[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{label}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {expense.category && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: color + '20', color }}
                  >
                    <CategoryDot color={color} size="sm" />
                    {expense.category.name}
                  </span>
                )}
                {expense.payment_method && <PaymentChip method={expense.payment_method} />}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <AmountBadge type={expense.type} amount={Number(expense.amount)} currency={currency} />
              <p className="text-[11px] text-gray-400 mt-0.5">{dateStr}</p>
            </div>
          </div>

          {expense.notes && expense.merchant && (
            <p className="text-xs text-gray-400 mt-1.5 truncate">{expense.notes}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 dark:border-gray-800">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 py-1.5 rounded-lg transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 py-1.5 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Expenses() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [showFilters, setShowFilters] = useState(false);

  const channelRef = useRef<ReturnType<typeof subscribeToExpenses> | null>(null);
  const currency = 'USD';

  const load = async () => {
    setLoading(true);
    try {
      const [exp, cats] = await Promise.all([getExpenses(), getOrSeedCategories()]);
      setAllExpenses(exp);
      setCategories(cats);
    } catch {
      toastError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (user) channelRef.current = subscribeToExpenses(user.id, load);
    return () => { if (channelRef.current) unsubscribe(channelRef.current); };
  }, [user?.id]);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const dateFiltered = applyDatePreset(datePreset, allExpenses);

  const filtered = dateFiltered.filter(e => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (categoryFilter && e.category_id !== categoryFilter) return false;
    if (paymentFilter && e.payment_method !== paymentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (e.merchant ?? '').toLowerCase().includes(q) ||
        (e.notes ?? e.description ?? '').toLowerCase().includes(q) ||
        (e.category?.name ?? '').toLowerCase().includes(q) ||
        (e.payment_method ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeFilterCount = [
    typeFilter !== 'all', categoryFilter, paymentFilter, datePreset !== 'all',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setTypeFilter('all');
    setCategoryFilter('');
    setPaymentFilter('');
    setDatePreset('all');
    setSearch('');
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalIncome = filtered.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
  const totalExpense = filtered.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0);
  const net = totalIncome - totalExpense;

  // ── Mutations ─────────────────────────────────────────────────────────────

  const handleSaved = (expense: Expense, isNew: boolean) => {
    if (isNew) {
      setAllExpenses(prev => [expense, ...prev]);
      success('Transaction added');
    } else {
      setAllExpenses(prev => prev.map(e => e.id === expense.id ? expense : e));
      success('Transaction updated');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget.id);
      setAllExpenses(prev => prev.filter(e => e.id !== deleteTarget.id));
      setDeleteTarget(null);
      success('Transaction deleted');
    } catch {
      toastError('Failed to delete transaction');
    } finally {
      setDeleting(false);
    }
  };

  // ── Skeleton ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-7 w-28 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
            <div className="h-4 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
          </div>
          <div className="h-9 w-24 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4 animate-pulse space-y-2">
              <div className="h-6 w-20 bg-gray-200 dark:bg-gray-800 rounded-lg mx-auto" />
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded mx-auto" />
            </div>
          ))}
        </div>
        <div className="card overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800 animate-pulse last:border-0">
              <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-800 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 bg-gray-200 dark:bg-gray-800 rounded-lg" />
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {filtered.length} of {allExpenses.length} transactions
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 flex-shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Transaction</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* ── Summary cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Income', value: totalIncome, icon: <TrendingUp className="w-4 h-4 text-success-600" />, color: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/20' },
          { label: 'Expenses', value: totalExpense, icon: <TrendingDown className="w-4 h-4 text-error-600" />, color: 'text-error-600 dark:text-error-400', bg: 'bg-error-50 dark:bg-error-900/20' },
          { label: 'Net', value: net, icon: <Minus className="w-4 h-4 text-primary-600" />, color: net >= 0 ? 'text-primary-600 dark:text-primary-400' : 'text-error-600 dark:text-error-400', bg: 'bg-primary-50 dark:bg-primary-900/20' },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} className="card p-4">
            <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-2.5`}>{icon}</div>
            <p className={`text-lg font-bold ${color} tabular-nums leading-none`}>{formatCurrency(value, currency)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter toolbar ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-col sm:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search merchant, notes, category…"
              className="input pl-10"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-0.5 flex-shrink-0">
            {(['all', 'expense', 'income'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                  typeFilter === t
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors flex-shrink-0 ${
              activeFilterCount > 0
                ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Date preset */}
            <div>
              <label className="label text-xs">Date Range</label>
              <div className="relative">
                <select
                  value={datePreset}
                  onChange={e => setDatePreset(e.target.value as DatePreset)}
                  className="input appearance-none pr-8 text-sm"
                >
                  {(Object.keys(DATE_LABELS) as DatePreset[]).map(k => (
                    <option key={k} value={k}>{DATE_LABELS[k]}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="label text-xs">Category</label>
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="input appearance-none pr-8 text-sm"
                >
                  <option value="">All categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="label text-xs">Payment Method</label>
              <div className="relative">
                <select
                  value={paymentFilter}
                  onChange={e => setPaymentFilter(e.target.value)}
                  className="input appearance-none pr-8 text-sm"
                >
                  <option value="">All methods</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {typeFilter !== 'all' && (
              <Chip label={`Type: ${typeFilter}`} onRemove={() => setTypeFilter('all')} />
            )}
            {categoryFilter && (
              <Chip
                label={`Category: ${categories.find(c => c.id === categoryFilter)?.name ?? '…'}`}
                onRemove={() => setCategoryFilter('')}
              />
            )}
            {paymentFilter && (
              <Chip label={`Payment: ${paymentFilter}`} onRemove={() => setPaymentFilter('')} />
            )}
            {datePreset !== 'all' && (
              <Chip label={DATE_LABELS[datePreset]} onRemove={() => setDatePreset('all')} />
            )}
            <button
              onClick={clearFilters}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Receipt className="w-7 h-7 text-gray-400" />
          </div>
          {allExpenses.length === 0 ? (
            <>
              <p className="font-semibold text-gray-700 dark:text-gray-300">No transactions yet</p>
              <p className="text-sm text-gray-400 mt-1 max-w-xs">Add your first transaction to start tracking your spending.</p>
              <button onClick={() => setShowAdd(true)} className="btn-primary mt-4 flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                Add Transaction
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold text-gray-700 dark:text-gray-300">No results</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters.</p>
              <button onClick={clearFilters} className="btn-ghost mt-3 text-sm flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  {['Transaction', 'Merchant', 'Category', 'Payment', 'Date', 'Amount', ''].map((h, i) => (
                    <th
                      key={h || i}
                      className={`text-left px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide ${
                        h === 'Amount' ? 'text-right' : ''
                      } ${h === 'Merchant' ? 'hidden lg:table-cell' : ''} ${h === 'Payment' ? 'hidden xl:table-cell' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {filtered.map(t => {
                  const color = t.category?.color ?? '#6b7280';
                  const label = t.notes || t.description || t.category?.name || 'Transaction';
                  return (
                    <tr key={t.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/20 transition-colors group">
                      {/* Description */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                            style={{ backgroundColor: color }}
                          >
                            {(t.merchant ?? label)[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[180px]">{label}</span>
                        </div>
                      </td>
                      {/* Merchant */}
                      <td className="px-5 py-3.5 hidden lg:table-cell text-gray-500 dark:text-gray-400">
                        {t.merchant ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      {/* Category */}
                      <td className="px-5 py-3.5">
                        {t.category ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-0.5 rounded-full"
                            style={{ backgroundColor: color + '1a', color }}
                          >
                            <CategoryDot color={color} size="sm" />
                            {t.category.name}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-sm">—</span>
                        )}
                      </td>
                      {/* Payment */}
                      <td className="px-5 py-3.5 hidden xl:table-cell">
                        {t.payment_method
                          ? <PaymentChip method={t.payment_method} />
                          : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      {/* Date */}
                      <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(t.expense_date ?? t.date)}
                      </td>
                      {/* Amount */}
                      <td className="px-5 py-3.5 text-right">
                        <AmountBadge type={t.type} amount={Number(t.amount)} currency={currency} />
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3.5 w-20">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditExpense(t)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(t)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card grid */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtered.map(t => (
              <ExpenseCard
                key={t.id}
                expense={t}
                onEdit={() => setEditExpense(t)}
                onDelete={() => setDeleteTarget(t)}
                currency={currency}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {(showAdd || editExpense) && (
        <ExpenseFormModal
          expense={editExpense ?? undefined}
          categories={categories}
          currency={currency}
          onClose={() => { setShowAdd(false); setEditExpense(null); }}
          onSaved={(exp, isNew) => {
            handleSaved(exp, isNew);
            if (!isNew && categories.find(c => c.id === exp.category_id) === undefined) {
              // reload categories if a new one was created inside the modal
              getOrSeedCategories().then(setCategories);
            }
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-error-50 dark:bg-error-900/20 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-error-500" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Delete transaction?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">
              {deleteTarget.merchant
                ? `"${deleteTarget.merchant}" — `
                : ''
              }
              {formatCurrency(Number(deleteTarget.amount), currency)} on {formatDate(deleteTarget.expense_date ?? deleteTarget.date)}. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1" disabled={deleting}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-error-600 hover:bg-error-700 disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/40 px-2.5 py-1 rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-primary-900 dark:hover:text-primary-100">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
