import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, Trash2, X, Pencil,
  AlertTriangle, CheckCircle, TrendingDown, Target, ChevronDown,
  Copy, BarChart3,
} from 'lucide-react';
import {
  getBudgets, getExpenses, getOrSeedCategories,
  upsertBudget, deleteBudget, updateBudgetAmount,
  subscribeToBudgets, unsubscribe,
} from '../services/api';
import { Budget, Category } from '../types';
import {
  formatCurrency, monthStart, monthEnd, monthLabel, prevMonth, nextMonth,
} from '../utils/helpers';
import { ProgressBar } from '../components/ProgressBar';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';

interface BudgetWithSpent extends Budget { spent: number }

// ─── Status helpers ──────────────────────────────────────────────────────────

type BudgetStatus = 'over' | 'warning' | 'on_track' | 'empty';

function getBudgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit === 0) return 'empty';
  const pct = (spent / limit) * 100;
  if (spent > limit) return 'over';
  if (pct >= 75) return 'warning';
  if (spent === 0) return 'empty';
  return 'on_track';
}

const STATUS_CONFIG: Record<BudgetStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  over:     { label: 'Over budget',   bg: 'bg-error-50 dark:bg-error-900/20',     text: 'text-error-600 dark:text-error-400',     icon: <AlertTriangle className="w-3 h-3" /> },
  warning:  { label: 'Nearing limit', bg: 'bg-warning-50 dark:bg-warning-900/20', text: 'text-warning-600 dark:text-warning-500', icon: <AlertTriangle className="w-3 h-3" /> },
  on_track: { label: 'On track',      bg: 'bg-success-50 dark:bg-success-900/20', text: 'text-success-600 dark:text-success-400', icon: <CheckCircle className="w-3 h-3" /> },
  empty:    { label: 'No spending',   bg: 'bg-gray-50 dark:bg-gray-800',          text: 'text-gray-400 dark:text-gray-500',       icon: null },
};

function StatusBadge({ status }: { status: BudgetStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMonthEnd(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo, 0).toISOString().slice(0, 10);
}

function daysRemainingInMonth(monthIso: string): number {
  if (monthIso !== monthStart()) return 0;
  const [y, m] = monthIso.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return Math.max(0, lastDay - new Date().getDate() + 1);
}

function daysInMonth(monthIso: string): number {
  const [y, m] = monthIso.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// ─── Budget form modal ────────────────────────────────────────────────────────

interface FormModalProps {
  budget?: BudgetWithSpent;
  availableCategories: Category[];
  mLabel: string;
  currency: string;
  onClose: () => void;
  onSaved: (result: Budget | { category_id: string; limit_amount: number }) => void;
}

const QUICK_AMOUNTS = [50, 100, 200, 300, 500, 1000];

function BudgetFormModal({ budget, availableCategories, mLabel, currency, onClose, onSaved }: FormModalProps) {
  const isEdit = !!budget;
  const [catId, setCatId] = useState(budget?.category_id ?? '');
  const [amount, setAmount] = useState(budget ? String(Number(budget.limit_amount ?? budget.amount)) : '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!isEdit && !catId) errs.cat = 'Select a category';
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) errs.amount = 'Enter a valid amount greater than 0';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (isEdit) {
        const updated = await updateBudgetAmount(budget.id, amt);
        onSaved(updated);
      } else {
        onSaved({ category_id: catId, limit_amount: amt });
      }
    } catch (err: any) {
      setErrors({ form: err.message });
      setSaving(false);
    }
  };

  const selectedCat = isEdit ? budget.category : availableCategories.find(c => c.id === catId);
  const sym = currency === 'USD' ? '$' : currency;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="card w-full sm:max-w-sm rounded-b-none sm:rounded-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {isEdit ? 'Edit Budget' : 'Add Budget'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{mLabel}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {!isEdit && (
            <div>
              <label className="label">Category</label>
              <div className="relative">
                <select
                  value={catId}
                  onChange={e => setCatId(e.target.value)}
                  className={`input appearance-none pr-8 ${errors.cat ? 'border-error-400' : ''}`}
                >
                  <option value="">Select category…</option>
                  {availableCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {errors.cat && <p className="text-error-500 text-xs mt-1">{errors.cat}</p>}
            </div>
          )}

          {selectedCat && (
            <div className="flex items-center gap-2.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: selectedCat.color }}>
                {selectedCat.name[0]}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedCat.name}</span>
            </div>
          )}

          <div>
            <label className="label">Monthly Limit</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">{sym}</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => { setAmount(e.target.value); if (errors.amount) setErrors(p => ({ ...p, amount: '' })); }}
                placeholder="0.00"
                className={`input pl-8 text-lg font-semibold ${errors.amount ? 'border-error-400' : ''}`}
                autoFocus
              />
            </div>
            {errors.amount && <p className="text-error-500 text-xs mt-1">{errors.amount}</p>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_AMOUNTS.map(q => (
                <button key={q} type="button" onClick={() => setAmount(String(q))}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                    amount === String(q)
                      ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/20 dark:border-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}>
                  {sym}{q}
                </button>
              ))}
            </div>
          </div>

          {errors.form && (
            <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800/40 rounded-xl px-4 py-2.5">
              <p className="text-error-600 dark:text-error-400 text-sm">{errors.form}</p>
            </div>
          )}

          <div className="flex gap-3 pb-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Add Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Budget card ──────────────────────────────────────────────────────────────

function BudgetCard({
  budget, monthIso, currency, isCurrentMonth, onEdit, onDelete,
}: {
  budget: BudgetWithSpent; monthIso: string; currency: string;
  isCurrentMonth: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const limit = Number(budget.limit_amount ?? budget.amount);
  const { spent } = budget;
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const status = getBudgetStatus(spent, limit);
  const remaining = limit - spent;
  const color = budget.category?.color ?? '#6b7280';

  const days = daysInMonth(monthIso);
  const daysLeft = daysRemainingInMonth(monthIso);
  const daysElapsed = isCurrentMonth ? Math.max(1, days - daysLeft) : days;
  const dailyBudget = limit / days;
  const dailySpending = daysElapsed > 0 ? spent / daysElapsed : 0;

  const borderColor = status === 'over' ? '#ef4444' : status === 'warning' ? '#f59e0b' : color;

  return (
    <div className={`card overflow-hidden hover:shadow-md transition-shadow ${
      status === 'over' ? 'border-error-200 dark:border-error-800/60' : ''
    }`}>
      <div className="h-1.5" style={{ backgroundColor: borderColor }} />
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ backgroundColor: color }}>
              {(budget.category?.name ?? 'U')[0]}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                {budget.category?.name ?? 'Category'}
              </p>
              <p className="text-xs text-gray-400 tabular-nums">{pct.toFixed(0)}% used</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Progress bar */}
        <ProgressBar value={spent} max={limit} color={color} size="lg" showSegments />

        {/* Spent / limit */}
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums">
            {formatCurrency(spent, currency)}
          </span>
          <span className="text-xs text-gray-400">of {formatCurrency(limit, currency)}</span>
        </div>

        {/* Remaining row */}
        <div className="flex items-center justify-between mt-1 pb-3 border-b border-gray-50 dark:border-gray-800">
          <span className="text-xs text-gray-400">
            {isCurrentMonth && daysLeft > 0 ? `${daysLeft}d remaining` : ''}
          </span>
          <span className={`text-sm font-semibold tabular-nums ${
            remaining < 0 ? 'text-error-600 dark:text-error-400'
            : remaining === 0 ? 'text-warning-500'
            : 'text-success-600 dark:text-success-400'
          }`}>
            {remaining < 0
              ? `${formatCurrency(Math.abs(remaining), currency)} over`
              : `${formatCurrency(remaining, currency)} left`}
          </span>
        </div>

        {/* Pace indicator */}
        {isCurrentMonth && daysElapsed > 1 && limit > 0 && (
          <div className="flex items-center justify-between mt-3 text-[11px] text-gray-400">
            <span>Daily avg: <span className="font-medium">{formatCurrency(dailySpending, currency)}</span></span>
            <span>Target: <span className="font-medium">{formatCurrency(dailyBudget, currency)}/d</span></span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 dark:border-gray-800">
          <button onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 py-1.5 rounded-lg transition-colors">
            <Pencil className="w-3.5 h-3.5" />Edit
          </button>
          <button onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 py-1.5 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" />Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Budgets() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [month, setMonth] = useState(monthStart());
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([]);
  const [prevBudgets, setPrevBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editBudget, setEditBudget] = useState<BudgetWithSpent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetWithSpent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(false);

  const channelRef = useRef<ReturnType<typeof subscribeToBudgets> | null>(null);
  const currency = 'USD';
  const isCurrentMonth = month === monthStart();

  const load = async (m = month) => {
    setLoading(true);
    try {
      const mEnd = getMonthEnd(m);
      const prev = prevMonth(m);
      const [buds, exps, cats, prevBuds] = await Promise.all([
        getBudgets(m),
        getExpenses(m, mEnd),
        getOrSeedCategories(),
        getBudgets(prev),
      ]);
      const withSpent: BudgetWithSpent[] = buds.map(b => ({
        ...b,
        spent: exps
          .filter(e => e.category_id === b.category_id && e.type === 'expense')
          .reduce((s, e) => s + Number(e.amount), 0),
      }));
      withSpent.sort((a, b) => {
        const pA = Number(a.limit_amount ?? a.amount) > 0 ? a.spent / Number(a.limit_amount ?? a.amount) : 0;
        const pB = Number(b.limit_amount ?? b.amount) > 0 ? b.spent / Number(b.limit_amount ?? b.amount) : 0;
        return pB - pA;
      });
      setBudgets(withSpent);
      setPrevBudgets(prevBuds);
      setCategories(cats);
    } catch {
      toastError('Failed to load budgets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(month);
    if (user) channelRef.current = subscribeToBudgets(user.id, () => load(month));
    return () => { if (channelRef.current) unsubscribe(channelRef.current); };
  }, [month, user?.id]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const totalBudget = budgets.reduce((s, b) => s + Number(b.limit_amount ?? b.amount), 0);
  const totalSpent  = budgets.reduce((s, b) => s + b.spent, 0);
  const remaining   = totalBudget - totalSpent;
  const overBudgetCount = budgets.filter(b => b.spent > Number(b.limit_amount ?? b.amount)).length;
  const warningCount = budgets.filter(b => {
    const lim = Number(b.limit_amount ?? b.amount);
    const p = lim > 0 ? (b.spent / lim) * 100 : 0;
    return b.spent <= lim && p >= 75;
  }).length;
  const onTrackCount = budgets.length - overBudgetCount - warningCount;

  const expenseCats = categories.filter(c => c.type === 'expense');
  const budgetCatIds = new Set(budgets.map(b => b.category_id));
  const availableCats = expenseCats.filter(c => !budgetCatIds.has(c.id));
  const canCopyFromPrev = budgets.length === 0 && prevBudgets.length > 0;

  const allocationData = useMemo(() =>
    budgets.map(b => ({
      name: b.category?.name ?? '—',
      color: b.category?.color ?? '#6b7280',
      pct: totalBudget > 0 ? (Number(b.limit_amount ?? b.amount) / totalBudget) * 100 : 0,
    })), [budgets, totalBudget]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleFormSaved = async (result: Budget | { category_id: string; limit_amount: number }) => {
    if ('id' in result) {
      setBudgets(prev => prev.map(b => b.id === result.id ? { ...b, ...result } : b));
      success('Budget updated');
    } else {
      try {
        await upsertBudget({ category_id: result.category_id, limit_amount: result.limit_amount, month });
        await load(month);
        success('Budget added');
      } catch (err: any) {
        toastError(err.message);
      }
    }
    setShowForm(false);
    setEditBudget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBudget(deleteTarget.id);
      setBudgets(prev => prev.filter(b => b.id !== deleteTarget.id));
      setDeleteTarget(null);
      success('Budget removed');
    } catch { toastError('Failed to remove budget'); }
    finally { setDeleting(false); }
  };

  const handleCopyFromPrev = async () => {
    setCopying(true);
    try {
      await Promise.all(prevBudgets.map(b =>
        upsertBudget({ category_id: b.category_id, limit_amount: Number(b.limit_amount ?? b.amount), month })
      ));
      await load(month);
      success(`Copied ${prevBudgets.length} budget${prevBudgets.length !== 1 ? 's' : ''} from ${monthLabel(prevMonth(month))}`);
    } catch { toastError('Failed to copy budgets'); }
    finally { setCopying(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const mLabel = monthLabel(month);

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Monthly spending limits by category</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 card px-2 py-1.5">
            <button onClick={() => setMonth(prevMonth(month))}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2 min-w-[130px] text-center whitespace-nowrap">
              {mLabel}
            </span>
            <button onClick={() => setMonth(nextMonth(month))}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {availableCats.length > 0 && (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5">
              <Plus className="w-4 h-4" /><span>Add Budget</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-3">
            <Target className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(totalBudget, currency)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Budget</p>
        </div>
        <div className="card p-5">
          <div className="w-9 h-9 rounded-xl bg-error-50 dark:bg-error-900/20 flex items-center justify-center mb-3">
            <TrendingDown className="w-5 h-5 text-error-600" />
          </div>
          <p className={`text-xl font-bold tabular-nums ${totalSpent > totalBudget ? 'text-error-600 dark:text-error-400' : 'text-gray-900 dark:text-white'}`}>
            {formatCurrency(totalSpent, currency)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Total Spent</p>
        </div>
        <div className="card p-5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${remaining >= 0 ? 'bg-success-50 dark:bg-success-900/20' : 'bg-error-50 dark:bg-error-900/20'}`}>
            <BarChart3 className={`w-5 h-5 ${remaining >= 0 ? 'text-success-600' : 'text-error-600'}`} />
          </div>
          <p className={`text-xl font-bold tabular-nums ${remaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
            {formatCurrency(Math.abs(remaining), currency)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{remaining >= 0 ? 'Remaining' : 'Over total'}</p>
        </div>
        <div className="card p-5">
          <div className="w-9 h-9 rounded-xl bg-gold-50 dark:bg-yellow-900/20 flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5 text-gold-500 dark:text-yellow-400" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{onTrackCount}/{budgets.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Categories on track</p>
        </div>
      </div>

      {/* Over-budget alert banner */}
      {!loading && overBudgetCount > 0 && (
        <div className="flex items-center gap-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800/40 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-error-500 flex-shrink-0" />
          <p className="text-sm text-error-700 dark:text-error-400">
            <span className="font-semibold">{overBudgetCount} budget{overBudgetCount > 1 ? 's' : ''}</span> exceeded this month.
            {warningCount > 0 && (
              <span className="ml-1.5 text-warning-600 dark:text-warning-400">{warningCount} more nearing limit.</span>
            )}
          </p>
        </div>
      )}

      {/* Budget allocation bar */}
      {!loading && budgets.length > 1 && totalBudget > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Budget Allocation</h2>
          <div className="flex w-full h-4 rounded-full overflow-hidden gap-0.5">
            {allocationData.map(({ name, color, pct }) => (
              <div key={name} className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 0 ? 4 : 0 }}
                title={`${name}: ${pct.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {allocationData.map(({ name, color, pct }) => (
              <span key={name} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                {name} <span className="text-gray-400">{pct.toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Copy from previous month */}
      {!loading && canCopyFromPrev && (
        <div className="flex items-center justify-between gap-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/40 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <Copy className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
            <p className="text-sm text-primary-700 dark:text-primary-300">
              Copy <strong>{prevBudgets.length}</strong> budget{prevBudgets.length !== 1 ? 's' : ''} from <strong>{monthLabel(prevMonth(month))}</strong>?
            </p>
          </div>
          <button onClick={handleCopyFromPrev} disabled={copying}
            className="text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline disabled:opacity-50 flex-shrink-0">
            {copying ? 'Copying…' : 'Copy'}
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card overflow-hidden animate-pulse">
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700" />
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                    <div className="h-3 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                  <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                </div>
                <div className="h-3.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-base mb-1">No budgets for {mLabel}</h3>
          <p className="text-sm text-gray-400 max-w-xs mb-5">
            Set monthly limits per category to track spending and avoid overspending.
          </p>
          {availableCats.length > 0
            ? <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5"><Plus className="w-4 h-4" />Add your first budget</button>
            : <p className="text-xs text-gray-400">Add expense categories to get started.</p>
          }
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {budgets.map(b => (
              <BudgetCard key={b.id} budget={b} monthIso={month} currency={currency}
                isCurrentMonth={isCurrentMonth}
                onEdit={() => setEditBudget(b)}
                onDelete={() => setDeleteTarget(b)} />
            ))}
          </div>

          {/* Unbudgeted categories teaser */}
          {availableCats.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Categories without budgets</p>
                <span className="text-xs text-gray-400">{availableCats.length} remaining</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableCats.map(c => (
                  <button key={c.id} onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    {c.name}
                    <Plus className="w-3 h-3 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add / Edit modal */}
      {(showForm || editBudget) && (
        <BudgetFormModal
          budget={editBudget ?? undefined}
          availableCategories={availableCats}
          mLabel={mLabel}
          currency={currency}
          onClose={() => { setShowForm(false); setEditBudget(null); }}
          onSaved={handleFormSaved}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-error-50 dark:bg-error-900/20 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-error-500" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Remove budget?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">
              Remove the <strong>{deleteTarget.category?.name}</strong> budget for {mLabel}? Your transactions won't be affected.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1" disabled={deleting}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-error-600 hover:bg-error-700 disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-xl transition-colors">
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
