import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Plus, TrendingUp, TrendingDown, PiggyBank, Target, ArrowRight,
  Receipt, AlertCircle, ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getExpenses, getCategories, getBudgets, getExpensesSince, getOrSeedCategories, subscribeToExpenses, unsubscribe } from '../services/api';
import { Expense, Category, Budget } from '../types';
import { formatCurrency, monthStart, monthEnd, monthLabel, prevMonth, nMonthsAgoStart, isoMonth } from '../utils/helpers';
import { ExpenseFormModal } from './ExpenseFormModal';
import { ProgressBar } from './ProgressBar';
import { useToast } from './Toast';
import { useAuth } from '../hooks/useAuth';
import {
  StatCardSkeleton, ChartSkeleton, TransactionRowSkeleton, BudgetRowSkeleton, DonutSkeleton,
} from './Skeleton';

// ─── Sub-components ──────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  positive?: boolean;
  negative?: boolean;
  icon: React.ReactNode;
  accentBg: string;
  badge?: { text: string; positive: boolean };
}

function StatCard({ label, value, subtext, icon, accentBg, badge }: StatCardProps) {
  return (
    <div className="card p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentBg}`}>
          {icon}
        </div>
        {badge && (
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              badge.positive
                ? 'text-success-700 bg-success-100 dark:bg-success-900/30 dark:text-success-400'
                : 'text-error-700 bg-error-100 dark:bg-error-900/30 dark:text-error-400'
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
}

function CategoryBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: color + '20',
        color: color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  );
}

function EmptyState({ icon, title, body, action }: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-[200px]">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.06) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 shadow-xl text-xs space-y-1 min-w-[130px]">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-gray-500 dark:text-gray-400 capitalize">{p.name}</span>
          </div>
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            {formatCurrency(p.value, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardContent() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [prevExpenses, setPrevExpenses] = useState<Expense[]>([]);
  const [trendExpenses, setTrendExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof subscribeToExpenses> | null>(null);
  const currency = 'USD';

  const currentMonth = monthStart();
  const lastMonth = prevMonth(currentMonth);
  const sixMonthsAgo = nMonthsAgoStart(5);

  const load = async () => {
    setLoading(true);
    try {
      const lastMonthEnd = (() => {
        const [y, m] = lastMonth.split('-').map(Number);
        return new Date(y, m, 0).toISOString().slice(0, 10);
      })();
      const [curr, prev, trend, cats, buds] = await Promise.all([
        getExpenses(currentMonth, monthEnd()),
        getExpenses(lastMonth, lastMonthEnd),
        getExpensesSince(sixMonthsAgo),
        getOrSeedCategories(),
        getBudgets(currentMonth),
      ]);
      setExpenses(curr);
      setPrevExpenses(prev);
      setTrendExpenses(trend);
      setCategories(cats);
      setBudgets(buds);
    } catch {
      showError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (user) {
      channelRef.current = subscribeToExpenses(user.id, load);
    }
    return () => {
      if (channelRef.current) unsubscribe(channelRef.current);
    };
  }, [user?.id]);

  const handleTransactionCreated = () => {
    load();
    success('Transaction added successfully');
  };

  // ─── Derived metrics ────────────────────────────────────────────────────────

  const { totalIncome, totalExpense, prevExpense, prevIncome } = useMemo(() => ({
    totalIncome: expenses.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0),
    totalExpense: expenses.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0),
    prevExpense: prevExpenses.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0),
    prevIncome: prevExpenses.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0),
  }), [expenses, prevExpenses]);

  const savings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, (savings / totalIncome) * 100) : 0;

  const { totalBudget, totalBudgetSpent } = useMemo(() => ({
    totalBudget: budgets.reduce((s, b) => s + Number(b.limit_amount ?? b.amount), 0),
    totalBudgetSpent: expenses
      .filter(e => e.type === 'expense' && budgets.some(b => b.category_id === e.category_id))
      .reduce((s, e) => s + Number(e.amount), 0),
  }), [budgets, expenses]);

  const budgetPct = totalBudget > 0 ? Math.round((totalBudgetSpent / totalBudget) * 100) : 0;
  const expenseChange = prevExpense > 0 ? ((totalExpense - prevExpense) / prevExpense) * 100 : null;
  const incomeChange = prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome) * 100 : null;

  // ─── Chart data ──────────────────────────────────────────────────────────────

  const trendData = useMemo(() => {
    const monthMap: Record<string, { month: string; expense: number; income: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const m = nMonthsAgoStart(i);
      const label = new Date(m + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' });
      monthMap[isoMonth(m)] = { month: label, expense: 0, income: 0 };
    }
    trendExpenses.forEach(e => {
      const key = isoMonth(e.expense_date ?? e.date);
      if (monthMap[key]) monthMap[key][e.type] += Number(e.amount);
    });
    return Object.values(monthMap);
  }, [trendExpenses]);

  const pieData = useMemo(() => categories
    .filter(c => c.type === 'expense')
    .map(c => ({
      name: c.name,
      value: expenses.filter(e => e.category_id === c.id && e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0),
      color: c.color,
    }))
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value),
  [categories, expenses]);

  const budgetProgress = useMemo(() => budgets
    .map(b => ({
      ...b,
      spent: expenses
        .filter(e => e.category_id === b.category_id && e.type === 'expense')
        .reduce((s, e) => s + Number(e.amount), 0),
    }))
    .sort((a, b) => {
      const aLimit = Number(a.limit_amount ?? a.amount);
      const bLimit = Number(b.limit_amount ?? b.amount);
      return (b.spent / bLimit) - (a.spent / aLimit);
    })
    .slice(0, 5),
  [budgets, expenses]);

  const recent = expenses.slice(0, 8);
  const overBudgetCount = budgetProgress.filter(b => b.spent > Number(b.limit_amount ?? b.amount)).length;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{monthLabel(currentMonth)}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Transaction</span>
        </button>
      </div>

      {/* Over-budget alert banner */}
      {!loading && overBudgetCount > 0 && (
        <div className="flex items-center gap-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800/40 rounded-2xl px-4 py-3">
          <AlertCircle className="w-5 h-5 text-error-500 flex-shrink-0" />
          <p className="text-sm text-error-700 dark:text-error-400 flex-1">
            <span className="font-semibold">{overBudgetCount} {overBudgetCount === 1 ? 'category' : 'categories'}</span> exceeded budget this month.
          </p>
          <Link to="/budgets" className="text-xs font-semibold text-error-600 dark:text-error-400 flex items-center gap-0.5 hover:underline flex-shrink-0">
            Review <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Income"
              value={formatCurrency(totalIncome, currency)}
              subtext={incomeChange !== null ? `vs ${formatCurrency(prevIncome, currency)} last month` : undefined}
              icon={<TrendingUp className="w-5 h-5 text-success-600" />}
              accentBg="bg-success-50 dark:bg-success-900/20"
              badge={incomeChange !== null ? {
                text: `${incomeChange >= 0 ? '+' : ''}${incomeChange.toFixed(0)}%`,
                positive: incomeChange >= 0,
              } : undefined}
            />
            <StatCard
              label="Total Expenses"
              value={formatCurrency(totalExpense, currency)}
              subtext={expenseChange !== null ? `vs ${formatCurrency(prevExpense, currency)} last month` : undefined}
              icon={<TrendingDown className="w-5 h-5 text-error-600" />}
              accentBg="bg-error-50 dark:bg-error-900/20"
              badge={expenseChange !== null ? {
                text: `${expenseChange >= 0 ? '+' : ''}${expenseChange.toFixed(0)}%`,
                positive: expenseChange <= 0,
              } : undefined}
            />
            <StatCard
              label="Savings"
              value={formatCurrency(savings, currency)}
              subtext={totalIncome > 0 ? `${savingsRate.toFixed(0)}% savings rate` : undefined}
              icon={<PiggyBank className="w-5 h-5 text-primary-600" />}
              accentBg="bg-primary-50 dark:bg-primary-900/20"
              badge={totalIncome > 0 ? {
                text: `${savingsRate.toFixed(0)}%`,
                positive: savings >= 0,
              } : undefined}
            />
            <StatCard
              label="Budget Usage"
              value={totalBudget > 0 ? `${budgetPct}%` : '—'}
              subtext={totalBudget > 0 ? `${formatCurrency(totalBudgetSpent, currency)} of ${formatCurrency(totalBudget, currency)}` : 'No budgets set'}
              icon={<Target className="w-5 h-5 text-warning-600" />}
              accentBg="bg-warning-50 dark:bg-warning-900/20"
              badge={totalBudget > 0 ? {
                text: budgetPct > 100 ? 'Over limit' : budgetPct > 80 ? 'Near limit' : 'On track',
                positive: budgetPct <= 80,
              } : undefined}
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly trend – area chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Monthly Trend</h2>
              <p className="text-xs text-gray-400 mt-0.5">Last 6 months</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-error-500 rounded-full inline-block" />
                Expense
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-success-500 rounded-full inline-block" />
                Income
              </span>
            </div>
          </div>
          {loading ? (
            <ChartSkeleton height={220} />
          ) : trendData.every(d => d.expense === 0 && d.income === 0) ? (
            <EmptyState
              icon={<TrendingUp className="w-6 h-6 text-gray-400" />}
              title="No trend data yet"
              body="Add transactions to see your monthly spending pattern"
            />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,114,128,0.08)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(107,114,128,0.8)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(107,114,128,0.8)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="expense"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  fill="url(#gradExpense)"
                  dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="income"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  fill="url(#gradIncome)"
                  dot={{ fill: '#22c55e', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  strokeDasharray="5 3"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category donut chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">By Category</h2>
              <p className="text-xs text-gray-400 mt-0.5">This month</p>
            </div>
          </div>
          {loading ? (
            <DonutSkeleton />
          ) : pieData.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-6 h-6 text-gray-400" />}
              title="No category data"
              body="Assign categories to your expenses to see the breakdown"
            />
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={70}
                    dataKey="value"
                    labelLine={false}
                    label={PieLabel}
                    strokeWidth={0}
                  >
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [formatCurrency(v, currency), '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {pieData.slice(0, 5).map(c => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{c.name}</span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">
                      {formatCurrency(c.value, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Recent transactions */}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Recent Transactions</h2>
              <p className="text-xs text-gray-400 mt-0.5">This month</p>
            </div>
            <Link
              to="/expenses"
              className="text-xs font-medium text-primary-600 dark:text-primary-400 flex items-center gap-0.5 hover:underline"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-0.5 divide-y divide-gray-50 dark:divide-gray-800/50">
              {Array.from({ length: 5 }).map((_, i) => <TransactionRowSkeleton key={i} />)}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-6 h-6 text-gray-400" />}
              title="No transactions yet"
              body="Add your first transaction to start tracking"
              action={
                <button
                  onClick={() => setShowAdd(true)}
                  className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add transaction
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800/40">
              {recent.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 -mx-1 px-1 rounded-xl transition-colors">
                  <div
                    className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: t.category?.color ?? '#6b7280' }}
                  >
                    {(t.merchant ?? t.category?.name ?? 'T')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {t.merchant || t.notes || t.description || t.category?.name || 'Transaction'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {t.category && (
                        <CategoryBadge name={t.category.name} color={t.category.color} />
                      )}
                      <span className="text-[11px] text-gray-400">
                        {new Date((t.expense_date ?? t.date) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      {t.payment_method && (
                        <span className="text-[11px] text-gray-400">· {t.payment_method}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-sm font-semibold flex-shrink-0 ${
                    t.type === 'income'
                      ? 'text-success-600 dark:text-success-400'
                      : 'text-error-600 dark:text-error-400'
                  }`}>
                    {t.type === 'income' ? '+' : '−'}{formatCurrency(Number(t.amount), currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Budget progress */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Budget Progress</h2>
              <p className="text-xs text-gray-400 mt-0.5">This month</p>
            </div>
            <Link
              to="/budgets"
              className="text-xs font-medium text-primary-600 dark:text-primary-400 flex items-center gap-0.5 hover:underline"
            >
              Manage <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-5">
              {Array.from({ length: 4 }).map((_, i) => <BudgetRowSkeleton key={i} />)}
            </div>
          ) : budgetProgress.length === 0 ? (
            <EmptyState
              icon={<Target className="w-6 h-6 text-gray-400" />}
              title="No budgets set"
              body="Set monthly limits to track spending by category"
              action={
                <Link to="/budgets" className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Set budgets
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {budgetProgress.map(b => {
                const limit = Number(b.limit_amount ?? b.amount);
                const pct = limit > 0 ? Math.round((b.spent / limit) * 100) : 0;
                const isOver = b.spent > limit;
                return (
                  <div key={b.id}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: b.category?.color ?? '#6b7280' }}
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">
                        {b.category?.name}
                      </span>
                      <span className={`text-xs font-semibold flex-shrink-0 ${isOver ? 'text-error-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        {pct}%
                      </span>
                    </div>
                    <ProgressBar value={b.spent} max={limit} color={b.category?.color} />
                    <div className="flex items-center justify-between mt-1 text-[11px] text-gray-400">
                      <span>{formatCurrency(b.spent, currency)} spent</span>
                      <span className={isOver ? 'text-error-500 font-medium' : ''}>
                        {isOver
                          ? `${formatCurrency(b.spent - limit, currency)} over`
                          : `${formatCurrency(limit - b.spent, currency)} left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <ExpenseFormModal
          categories={categories}
          currency={currency}
          onClose={() => setShowAdd(false)}
          onSaved={(_exp, isNew) => { if (isNew) handleTransactionCreated(); }}
        />
      )}
    </div>
  );
}
