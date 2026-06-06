import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getExpenses, getCategories, getBudgets, upsertInsights, deleteInsightsByPeriod } from '../services/api';
import { Expense, Category, Budget } from '../types';
import { formatCurrency, monthStart, monthEnd, prevMonth } from '../utils/helpers';

interface Insight {
  type: 'positive' | 'warning' | 'tip';
  title: string;
  body: string;
}

function buildInsights(
  expenses: Expense[],
  prevExpenses: Expense[],
  budgets: Budget[],
  categories: Category[],
): Insight[] {
  const insights: Insight[] = [];
  const expOnly = expenses.filter(e => e.type === 'expense');
  const prevExpOnly = prevExpenses.filter(e => e.type === 'expense');

  const total = expOnly.reduce((s, e) => s + Number(e.amount), 0);
  const prevTotal = prevExpOnly.reduce((s, e) => s + Number(e.amount), 0);

  if (prevTotal > 0) {
    const diff = ((total - prevTotal) / prevTotal) * 100;
    if (diff < -10) {
      insights.push({
        type: 'positive',
        title: 'Great spending control',
        body: `Your expenses are down ${Math.abs(diff).toFixed(0)}% compared to last month. Keep it up!`,
      });
    } else if (diff > 20) {
      insights.push({
        type: 'warning',
        title: 'Spending spike detected',
        body: `Expenses are up ${diff.toFixed(0)}% vs last month (${formatCurrency(total)} vs ${formatCurrency(prevTotal)}).`,
      });
    }
  }

  budgets.forEach(b => {
    const spent = expOnly
      .filter(e => e.category_id === b.category_id)
      .reduce((s, e) => s + Number(e.amount), 0);
    const limit = Number(b.limit_amount ?? b.amount);
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    const cat = categories.find(c => c.id === b.category_id);
    if (pct > 100) {
      insights.push({
        type: 'warning',
        title: `Over budget: ${cat?.name ?? 'Category'}`,
        body: `You've spent ${formatCurrency(spent)} of your ${formatCurrency(limit)} budget (${pct.toFixed(0)}%).`,
      });
    } else if (pct > 80) {
      insights.push({
        type: 'warning',
        title: `Approaching limit: ${cat?.name ?? 'Category'}`,
        body: `${pct.toFixed(0)}% of your ${cat?.name} budget used. Only ${formatCurrency(limit - spent)} left.`,
      });
    }
  });

  const catTotals = categories
    .filter(c => c.type === 'expense')
    .map(c => ({
      cat: c,
      total: expOnly.filter(e => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0),
    }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  if (catTotals.length > 0 && total > 0) {
    const top = catTotals[0];
    const share = (top.total / total) * 100;
    if (share > 40) {
      insights.push({
        type: 'tip',
        title: `${top.cat.name} is your biggest spend`,
        body: `It accounts for ${share.toFixed(0)}% of your total expenses this month (${formatCurrency(top.total)}).`,
      });
    }
  }

  const income = expenses.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
  if (income > 0 && total > 0) {
    const savingsRate = ((income - total) / income) * 100;
    if (savingsRate > 30) {
      insights.push({
        type: 'positive',
        title: 'Excellent savings rate',
        body: `You're saving ${savingsRate.toFixed(0)}% of your income this month. That's above average!`,
      });
    } else if (savingsRate < 0) {
      insights.push({
        type: 'warning',
        title: 'Spending exceeds income',
        body: `Your expenses (${formatCurrency(total)}) exceed your income (${formatCurrency(income)}) this month.`,
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: 'tip',
      title: 'Add more transactions',
      body: 'Track your daily expenses to unlock personalized insights and spending patterns.',
    });
  }

  return insights;
}

const ICON = {
  positive: <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400" />,
  tip: <Lightbulb className="w-5 h-5 text-primary-600 dark:text-primary-400" />,
};

const ACCENT = {
  positive: 'border-success-200 dark:border-success-800/40 bg-success-50/50 dark:bg-success-900/10',
  warning: 'border-warning-200 dark:border-warning-800/40 bg-warning-50/50 dark:bg-warning-900/10',
  tip: 'border-primary-200 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/10',
};

function InsightSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-4/5" />
        </div>
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-28" />
      </div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-28 mb-1" />
      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-20" />
    </div>
  );
}

export function Insights() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [prevExpenses, setPrevExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const currency = 'USD';

  useEffect(() => {
    const curr = monthStart();
    const prev = prevMonth(curr);
    const prevEnd = (() => {
      const [y, m] = prev.split('-').map(Number);
      return new Date(y, m, 0).toISOString().slice(0, 10);
    })();

    Promise.all([
      getExpenses(curr, monthEnd()),
      getExpenses(prev, prevEnd),
      getCategories(),
      getBudgets(curr),
    ]).then(async ([exp, prevExp, cats, buds]) => {
      setExpenses(exp);
      setPrevExpenses(prevExp);
      setCategories(cats);
      setBudgets(buds);

      const built = buildInsights(exp, prevExp, buds, cats);
      if (built.length > 0 && exp.length > 0) {
        try {
          await deleteInsightsByPeriod(curr);
          await upsertInsights(
            built.map((ins, i) => ({
              category: 'overall',
              insight_type: `${ins.type}_${i}`,
              title: ins.title,
              message: ins.body,
              data: null,
              period: curr,
            })),
          );
        } catch (_) {}
      }
    }).finally(() => setLoading(false));
  }, []);

  const insights = useMemo(
    () => buildInsights(expenses, prevExpenses, budgets, categories),
    [expenses, prevExpenses, budgets, categories],
  );

  const expOnly = expenses.filter(e => e.type === 'expense');

  const catData = useMemo(() => categories
    .filter(c => c.type === 'expense')
    .map(c => ({
      name: c.name,
      value: expOnly.filter(e => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0),
      color: c.color,
    }))
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8),
  [categories, expenses]);

  const totalIncome = expenses.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
  const totalExpense = expOnly.reduce((s, e) => s + Number(e.amount), 0);
  const prevTotal = prevExpenses.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0);
  const savingsRate = totalIncome > 0 ? Math.max(0, ((totalIncome - totalExpense) / totalIncome) * 100) : null;
  const expenseChange = prevTotal > 0 ? ((totalExpense - prevTotal) / prevTotal) * 100 : null;

  const hasData = !loading && expenses.length > 0;

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Insights</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Smart analysis of your finances</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          <>
            <StatSkeleton /><StatSkeleton /><StatSkeleton />
          </>
        ) : (
          <>
            <div className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-success-50 dark:bg-success-900/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4.5 h-4.5 text-success-600" />
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Income this month</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalIncome, currency)}</p>
            </div>
            <div className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-error-50 dark:bg-error-900/20 flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="w-4.5 h-4.5 text-error-600" />
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Spent this month</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalExpense, currency)}</p>
              {expenseChange !== null && (
                <p className={`text-xs mt-1 font-medium ${expenseChange > 0 ? 'text-error-500' : 'text-success-600'}`}>
                  {expenseChange > 0 ? '+' : ''}{expenseChange.toFixed(0)}% vs last month
                </p>
              )}
            </div>
            <div className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4.5 h-4.5 text-primary-600" />
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Savings rate</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {savingsRate !== null ? `${savingsRate.toFixed(0)}%` : '—'}
              </p>
              {savingsRate !== null && (
                <p className={`text-xs mt-1 font-medium ${savingsRate >= 20 ? 'text-success-600' : 'text-warning-600'}`}>
                  {savingsRate >= 20 ? 'Above average' : 'Below target'}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Empty state when no data */}
      {!loading && !hasData && (
        <div className="card p-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No insights yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
            Start tracking your expenses and income to unlock personalized AI-powered insights and spending analysis.
          </p>
          <Link to="/expenses" className="btn-primary flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Add your first transaction
          </Link>
        </div>
      )}

      {(loading || hasData) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Insights cards */}
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Personalized Insights</h2>
            {loading ? (
              <>
                <InsightSkeleton /><InsightSkeleton /><InsightSkeleton />
              </>
            ) : (
              insights.map((ins, i) => (
                <div key={i} className={`rounded-2xl border p-4 transition-shadow hover:shadow-sm ${ACCENT[ins.type]}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">{ICON[ins.type]}</div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{ins.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">{ins.body}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bar chart */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Spending by Category</h2>
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 flex-shrink-0" />
                    <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-r-md" style={{ width: `${70 - i * 12}%` }} />
                  </div>
                ))}
              </div>
            ) : catData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-center">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">No expense data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, catData.length * 38)}>
                <BarChart data={catData} layout="vertical" margin={{ top: 0, right: 16, left: 64, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,114,128,0.08)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'rgba(107,114,128,0.8)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'rgba(107,114,128,0.8)' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v, currency), 'Spent']}
                    contentStyle={{
                      background: 'var(--tooltip-bg, white)',
                      border: '1px solid rgba(107,114,128,0.15)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {catData.map((entry, i) => <Cell key={i} fill={entry.color} fillOpacity={0.9} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Top transactions */}
      {(loading || hasData) && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Top Transactions This Month</h2>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex justify-between">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : expOnly.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No expenses recorded this month</p>
          ) : (
            <div className="space-y-2.5">
              {expOnly
                .sort((a, b) => Number(b.amount) - Number(a.amount))
                .slice(0, 8)
                .map(t => {
                  const share = totalExpense > 0 ? (Number(t.amount) / totalExpense) * 100 : 0;
                  const label = t.merchant || t.notes || (t as any).description || t.category?.name || 'Transaction';
                  return (
                    <div key={t.id} className="flex items-center gap-3 group">
                      <div
                        className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: t.category?.color ?? '#6b7280' }}
                      >
                        {label[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{label}</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white ml-3 flex-shrink-0">
                            {formatCurrency(Number(t.amount), currency)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${share}%`, backgroundColor: t.category?.color ?? '#6b7280' }}
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {t.category && (
                            <span className="text-[10px] text-gray-400">{t.category.name}</span>
                          )}
                          <span className="text-[10px] text-gray-400">{share.toFixed(0)}% of total</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
