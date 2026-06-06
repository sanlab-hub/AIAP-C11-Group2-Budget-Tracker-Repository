/*
# Extend Budget Tracker Schema (v2)

## Overview
Non-destructive additions to the existing schema. All new columns are nullable
or have defaults so existing rows and code are unaffected.

## Changes

### expenses table (extended)
- `merchant` (text, nullable) – store name or payee
- `notes` (text, nullable) – longer freeform note; complements existing `description`
- `payment_method` (text, nullable) – e.g. "Credit Card", "Cash", "Bank Transfer"
- `expense_date` (date, nullable) – explicit transaction date field alongside `date`
  (defaults to `date` column value via trigger for new rows)

### budgets table (extended)
- `limit_amount` (numeric 12,2, nullable) – named alias for the budget ceiling;
  kept in sync with `amount` via trigger so both columns always match

### ai_insights table (new)
- Stores generated spending insights per user per period.
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, RLS owner)
- `category` (text) – category name the insight relates to (or "overall")
- `insight_type` (text) – e.g. "over_budget", "spending_spike", "savings_tip"
- `title` (text) – short headline
- `message` (text) – full insight body
- `data` (jsonb, nullable) – arbitrary supporting numbers/metadata
- `period` (date) – the month this insight covers (YYYY-MM-01)
- `created_at` (timestamptz)

## Security
- RLS enabled on ai_insights; existing RLS on other tables unchanged.
- New columns inherit table-level RLS automatically.

## Notes
1. Migration is fully idempotent (DO $$ IF NOT EXISTS blocks for columns).
2. Triggers keep `limit_amount` ↔ `amount` and `expense_date` ↔ `date` in sync.
*/

-- ─── expenses: add new columns ───────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='expenses' AND column_name='merchant'
  ) THEN
    ALTER TABLE expenses ADD COLUMN merchant text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='expenses' AND column_name='notes'
  ) THEN
    ALTER TABLE expenses ADD COLUMN notes text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='expenses' AND column_name='payment_method'
  ) THEN
    ALTER TABLE expenses ADD COLUMN payment_method text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='expenses' AND column_name='expense_date'
  ) THEN
    ALTER TABLE expenses ADD COLUMN expense_date date;
  END IF;
END $$;

-- Back-fill expense_date from date for existing rows
UPDATE expenses SET expense_date = date WHERE expense_date IS NULL;

-- Trigger: keep expense_date in sync with date on insert/update
CREATE OR REPLACE FUNCTION sync_expense_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.expense_date IS NULL THEN
    NEW.expense_date := NEW.date;
  ELSIF NEW.date IS DISTINCT FROM NEW.expense_date THEN
    NEW.date := NEW.expense_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_expense_date ON expenses;
CREATE TRIGGER trg_sync_expense_date
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION sync_expense_date();

-- ─── budgets: add limit_amount ────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='budgets' AND column_name='limit_amount'
  ) THEN
    ALTER TABLE budgets ADD COLUMN limit_amount numeric(12,2);
  END IF;
END $$;

-- Back-fill limit_amount from amount for existing rows
UPDATE budgets SET limit_amount = amount WHERE limit_amount IS NULL;

-- Trigger: keep limit_amount ↔ amount in sync
CREATE OR REPLACE FUNCTION sync_budget_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.limit_amount IS NULL THEN
    NEW.limit_amount := NEW.amount;
  ELSIF NEW.amount IS DISTINCT FROM NEW.limit_amount THEN
    NEW.amount := NEW.limit_amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_budget_limit ON budgets;
CREATE TRIGGER trg_sync_budget_limit
  BEFORE INSERT OR UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION sync_budget_limit();

-- ─── ai_insights table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_insights (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category     text NOT NULL DEFAULT 'overall',
  insight_type text NOT NULL DEFAULT 'general',
  title        text NOT NULL,
  message      text NOT NULL,
  data         jsonb,
  period       date NOT NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_insights_user_period_idx ON ai_insights(user_id, period DESC);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_insights" ON ai_insights;
CREATE POLICY "select_own_insights" ON ai_insights FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_insights" ON ai_insights;
CREATE POLICY "insert_own_insights" ON ai_insights FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_insights" ON ai_insights;
CREATE POLICY "update_own_insights" ON ai_insights FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_insights" ON ai_insights;
CREATE POLICY "delete_own_insights" ON ai_insights FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_insights;
