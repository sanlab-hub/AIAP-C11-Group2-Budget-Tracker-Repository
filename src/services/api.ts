import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Category, Expense, Budget, AiInsight } from '../types';
import { DEFAULT_CATEGORIES } from '../utils/helpers';

// ─── Categories ──────────────────────────────────────────────────────────────

export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as Category[];
}

export async function getOrSeedCategories(): Promise<Category[]> {
  const cats = await getCategories();
  if (cats.length > 0) return cats;
  const seeded = await Promise.all(DEFAULT_CATEGORIES.map(c => createCategory(c)));
  return seeded.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCategory(cat: Omit<Category, 'id' | 'user_id' | 'created_at'>) {
  const { data, error } = await supabase.from('categories').insert(cat).select().single();
  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ─── Expenses ────────────────────────────────────────────────────────────────

const EXPENSE_SELECT = '*, category:categories(*)';

export type CreateExpenseInput = {
  amount: number;
  type: Expense['type'];
  date: string;
  expense_date?: string;
  category_id?: string | null;
  merchant?: string | null;
  notes?: string | null;
  description?: string | null;
  payment_method?: string | null;
};

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export async function getExpenses(from?: string, to?: string) {
  let q = supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .order('expense_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (from) q = q.gte('expense_date', from);
  if (to) q = q.lte('expense_date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data as Expense[];
}

export async function getExpensesSince(from: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .gte('expense_date', from)
    .order('expense_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as Expense[];
}

export async function getExpenseById(id: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Expense | null;
}

export async function createExpense(input: CreateExpenseInput) {
  const row = normalizeExpenseInput(input);
  const { data, error } = await supabase
    .from('expenses')
    .insert(row)
    .select(EXPENSE_SELECT)
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function updateExpense(id: string, input: UpdateExpenseInput) {
  const row = normalizeExpenseInput(input);
  const { data, error } = await supabase
    .from('expenses')
    .update(row)
    .eq('id', id)
    .select(EXPENSE_SELECT)
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

function normalizeExpenseInput(input: CreateExpenseInput | UpdateExpenseInput) {
  const expenseDate = input.expense_date ?? input.date ?? undefined;
  return {
    ...input,
    expense_date: expenseDate,
    date: expenseDate,
    description: input.notes ?? input.description ?? null,
    notes: input.notes ?? input.description ?? null,
  };
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

const BUDGET_SELECT = '*, category:categories(*)';

export type CreateBudgetInput = {
  category_id: string;
  limit_amount: number;
  month: string;
};

export async function getBudgets(month: string) {
  const { data, error } = await supabase
    .from('budgets')
    .select(BUDGET_SELECT)
    .eq('month', month);
  if (error) throw error;
  return data as Budget[];
}

export async function upsertBudget(input: CreateBudgetInput) {
  const row = {
    category_id: input.category_id,
    limit_amount: input.limit_amount,
    amount: input.limit_amount,
    month: input.month,
  };
  const { data, error } = await supabase
    .from('budgets')
    .upsert(row, { onConflict: 'user_id,category_id,month' })
    .select(BUDGET_SELECT)
    .single();
  if (error) throw error;
  return data as Budget;
}

export async function deleteBudget(id: string) {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) throw error;
}

export async function updateBudgetAmount(id: string, limit_amount: number) {
  const { data, error } = await supabase
    .from('budgets')
    .update({ limit_amount, amount: limit_amount })
    .eq('id', id)
    .select(BUDGET_SELECT)
    .single();
  if (error) throw error;
  return data as Budget;
}

// ─── AI Insights ─────────────────────────────────────────────────────────────

export async function getInsights(period: string) {
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('period', period)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as AiInsight[];
}

export async function upsertInsights(
  insights: Omit<AiInsight, 'id' | 'user_id' | 'created_at'>[],
) {
  if (insights.length === 0) return [];
  const { data, error } = await supabase
    .from('ai_insights')
    .upsert(insights, { onConflict: 'user_id,insight_type,period' })
    .select();
  if (error) throw error;
  return data as AiInsight[];
}

export async function deleteInsightsByPeriod(period: string) {
  const { error } = await supabase.from('ai_insights').delete().eq('period', period);
  if (error) throw error;
}

// ─── Demo data seeding ───────────────────────────────────────────────────────

export async function seedDemoData(categories: Category[]): Promise<void> {
  const byName = (name: string) => categories.find(c => c.name === name);

  const food = byName('Food');
  const travel = byName('Travel');
  const shopping = byName('Shopping');
  const bills = byName('Bills');
  const entertainment = byName('Entertainment');
  const health = byName('Health');
  const salary = byName('Salary');
  const freelance = byName('Freelance');

  const today = new Date();
  const dateInMonth = (monthsAgo: number, day: number) => {
    const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, day);
    return d.toISOString().slice(0, 10);
  };

  const expenses: CreateExpenseInput[] = [];

  // 6 months of salary + freelance income
  for (let m = 5; m >= 0; m--) {
    if (salary) {
      expenses.push({ amount: 5500, type: 'income', date: dateInMonth(m, 1), expense_date: dateInMonth(m, 1), category_id: salary.id, merchant: 'Employer', notes: 'Monthly salary' });
    }
    if (freelance && m % 2 === 0) {
      expenses.push({ amount: 800 + Math.round(Math.random() * 400), type: 'income', date: dateInMonth(m, 15), expense_date: dateInMonth(m, 15), category_id: freelance.id, merchant: 'Client', notes: 'Freelance project' });
    }
  }

  // Month-by-month expenses
  const monthData = [
    // 5 months ago
    [
      { cat: food, amount: 68, day: 3, merchant: 'Trader Joe\'s', notes: 'Weekly groceries' },
      { cat: food, amount: 42, day: 8, merchant: 'Chipotle', notes: 'Lunch' },
      { cat: bills, amount: 120, day: 2, merchant: 'Electric Co', notes: 'Electricity bill' },
      { cat: bills, amount: 59, day: 5, merchant: 'Netflix', notes: 'Streaming subscription' },
      { cat: health, amount: 30, day: 12, merchant: 'CVS Pharmacy', notes: 'Vitamins' },
      { cat: travel, amount: 310, day: 20, merchant: 'Delta Airlines', notes: 'Weekend trip' },
      { cat: shopping, amount: 89, day: 22, merchant: 'Amazon', notes: 'Books and supplies' },
    ],
    // 4 months ago
    [
      { cat: food, amount: 74, day: 4, merchant: 'Whole Foods', notes: 'Groceries' },
      { cat: food, amount: 55, day: 11, merchant: 'The Cheesecake Factory', notes: 'Dinner' },
      { cat: entertainment, amount: 45, day: 7, merchant: 'AMC Theaters', notes: 'Movies with friends' },
      { cat: bills, amount: 120, day: 2, merchant: 'Electric Co', notes: 'Electricity' },
      { cat: bills, amount: 59, day: 5, merchant: 'Netflix', notes: 'Streaming' },
      { cat: shopping, amount: 135, day: 14, merchant: 'Zara', notes: 'Clothing' },
      { cat: health, amount: 150, day: 18, merchant: 'Dr. Smith Clinic', notes: 'Annual checkup' },
    ],
    // 3 months ago
    [
      { cat: food, amount: 82, day: 3, merchant: 'Costco', notes: 'Monthly bulk buy' },
      { cat: food, amount: 38, day: 9, merchant: 'Starbucks', notes: 'Coffee runs' },
      { cat: travel, amount: 520, day: 15, merchant: 'Airbnb', notes: 'Weekend getaway' },
      { cat: travel, amount: 85, day: 16, merchant: 'Uber', notes: 'Airport rides' },
      { cat: bills, amount: 120, day: 2, merchant: 'Electric Co', notes: 'Electricity' },
      { cat: bills, amount: 59, day: 5, merchant: 'Netflix', notes: 'Streaming' },
      { cat: entertainment, amount: 60, day: 22, merchant: 'Spotify + Gym', notes: 'Subscriptions' },
    ],
    // 2 months ago
    [
      { cat: food, amount: 71, day: 4, merchant: 'Trader Joe\'s', notes: 'Groceries' },
      { cat: food, amount: 48, day: 13, merchant: 'Shake Shack', notes: 'Lunch' },
      { cat: shopping, amount: 245, day: 8, merchant: 'Apple Store', notes: 'Accessories' },
      { cat: bills, amount: 120, day: 2, merchant: 'Electric Co', notes: 'Electricity' },
      { cat: bills, amount: 59, day: 5, merchant: 'Netflix', notes: 'Streaming' },
      { cat: health, amount: 85, day: 20, merchant: 'Pharmacy Plus', notes: 'Monthly meds' },
      { cat: entertainment, amount: 75, day: 25, merchant: 'Broadway Tickets', notes: 'Show' },
    ],
    // Last month
    [
      { cat: food, amount: 91, day: 2, merchant: 'Whole Foods', notes: 'Groceries' },
      { cat: food, amount: 62, day: 10, merchant: 'Nobu Restaurant', notes: 'Birthday dinner' },
      { cat: travel, amount: 180, day: 18, merchant: 'Marriott', notes: 'Business trip hotel' },
      { cat: shopping, amount: 110, day: 5, merchant: 'IKEA', notes: 'Home items' },
      { cat: bills, amount: 120, day: 2, merchant: 'Electric Co', notes: 'Electricity' },
      { cat: bills, amount: 59, day: 5, merchant: 'Netflix', notes: 'Streaming' },
      { cat: health, amount: 40, day: 15, merchant: 'GNC', notes: 'Supplements' },
    ],
    // Current month
    [
      { cat: food, amount: 56, day: 2, merchant: 'Trader Joe\'s', notes: 'Groceries' },
      { cat: food, amount: 34, day: 6, merchant: 'Panera Bread', notes: 'Lunch' },
      { cat: bills, amount: 120, day: 1, merchant: 'Electric Co', notes: 'Electricity' },
      { cat: bills, amount: 59, day: 3, merchant: 'Netflix', notes: 'Streaming' },
      { cat: shopping, amount: 78, day: 5, merchant: 'Amazon', notes: 'Home supplies' },
    ],
  ];

  const monthsAgoForIndex = [5, 4, 3, 2, 1, 0];
  for (let mi = 0; mi < monthData.length; mi++) {
    const mAgo = monthsAgoForIndex[mi];
    for (const item of monthData[mi]) {
      if (!item.cat) continue;
      const d = dateInMonth(mAgo, item.day);
      expenses.push({
        amount: item.amount,
        type: 'expense',
        date: d,
        expense_date: d,
        category_id: item.cat.id,
        merchant: item.merchant,
        notes: item.notes,
      });
    }
  }

  // Insert expenses in batches
  const BATCH = 20;
  for (let i = 0; i < expenses.length; i += BATCH) {
    const batch = expenses.slice(i, i + BATCH);
    const rows = batch.map(input => normalizeExpenseInput(input));
    const { error } = await supabase.from('expenses').insert(rows);
    if (error) throw error;
  }

  // Seed current-month budgets
  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();

  const budgetDefs = [
    { cat: food,          limit: 400 },
    { cat: bills,         limit: 250 },
    { cat: shopping,      limit: 200 },
    { cat: travel,        limit: 300 },
    { cat: entertainment, limit: 100 },
    { cat: health,        limit: 150 },
  ];

  for (const { cat, limit } of budgetDefs) {
    if (!cat) continue;
    const { error } = await supabase.from('budgets').upsert({
      category_id: cat.id,
      limit_amount: limit,
      amount: limit,
      month: currentMonth,
    }, { onConflict: 'user_id,category_id,month' });
    if (error) throw error;
  }
}

// ─── Realtime helpers ────────────────────────────────────────────────────────

export function subscribeToExpenses(
  userId: string,
  onChange: () => void,
): RealtimeChannel {
  return supabase
    .channel(`expenses:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expenses', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
}

export function subscribeToBudgets(
  userId: string,
  onChange: () => void,
): RealtimeChannel {
  return supabase
    .channel(`budgets:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
}

export function unsubscribe(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}
