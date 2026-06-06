export type TransactionType = 'expense' | 'income';

export type PaymentMethod = 'Cash' | 'Credit Card' | 'Debit Card' | 'Bank Transfer' | 'Other';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other',
];

export interface Profile {
  id: string;
  display_name: string | null;
  currency: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  type: TransactionType;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  date: string;
  type: TransactionType;
  created_at: string;
  // Extended fields
  merchant: string | null;
  notes: string | null;
  payment_method: string | null;
  expense_date: string | null;
  // Joined
  category?: Category;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  limit_amount: number;
  month: string;
  created_at: string;
  // Joined
  category?: Category;
}

export interface BudgetWithSpent extends Budget {
  spent: number;
}

export interface AiInsight {
  id: string;
  user_id: string;
  category: string;
  insight_type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  period: string;
  created_at: string;
}

export type InsightType = 'positive' | 'warning' | 'tip';
