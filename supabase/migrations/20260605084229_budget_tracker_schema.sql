/*
# Budget Tracker Schema

## Overview
Creates the core tables for a multi-user budget tracking application.
Each user owns their own data, isolated by Row Level Security.

## Tables

### profiles
- Stores display name and currency preference per user.
- id: matches auth.users.id (UUID, PK)
- display_name: user's chosen name
- currency: ISO 4217 currency code (default 'USD')

### categories
- Expense and income categories per user.
- id: UUID primary key
- user_id: owner (defaults to auth.uid())
- name: category name (e.g. "Groceries")
- color: hex color for UI
- icon: lucide icon name
- type: 'expense' | 'income'

### expenses
- Individual transactions (expenses and income).
- id: UUID primary key
- user_id: owner (defaults to auth.uid())
- category_id: FK to categories
- amount: numeric (positive value; sign determined by category type)
- description: free-text note
- date: transaction date
- type: 'expense' | 'income'

### budgets
- Monthly budget limits per category.
- id: UUID primary key
- user_id: owner (defaults to auth.uid())
- category_id: FK to categories
- amount: budget limit
- month: ISO date truncated to month start (YYYY-MM-01)

## Security
- RLS enabled on all tables.
- Authenticated users can CRUD only their own rows.
- DEFAULT auth.uid() on user_id columns so frontend can omit it from inserts.
*/

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- categories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  icon text NOT NULL DEFAULT 'tag',
  type text NOT NULL DEFAULT 'expense' CHECK (type IN ('expense','income')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_categories" ON categories;
CREATE POLICY "select_own_categories" ON categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_categories" ON categories;
CREATE POLICY "insert_own_categories" ON categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_categories" ON categories;
CREATE POLICY "update_own_categories" ON categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_categories" ON categories;
CREATE POLICY "delete_own_categories" ON categories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- expenses
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  description text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL DEFAULT 'expense' CHECK (type IN ('expense','income')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_user_date_idx ON expenses(user_id, date DESC);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_expenses" ON expenses;
CREATE POLICY "select_own_expenses" ON expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_expenses" ON expenses;
CREATE POLICY "insert_own_expenses" ON expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_expenses" ON expenses;
CREATE POLICY "update_own_expenses" ON expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_expenses" ON expenses;
CREATE POLICY "delete_own_expenses" ON expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- budgets
CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  month date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, category_id, month)
);
CREATE INDEX IF NOT EXISTS budgets_user_month_idx ON budgets(user_id, month DESC);
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_budgets" ON budgets;
CREATE POLICY "select_own_budgets" ON budgets FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_budgets" ON budgets;
CREATE POLICY "insert_own_budgets" ON budgets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_budgets" ON budgets;
CREATE POLICY "update_own_budgets" ON budgets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_budgets" ON budgets;
CREATE POLICY "delete_own_budgets" ON budgets FOR DELETE TO authenticated USING (auth.uid() = user_id);
