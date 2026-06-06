/*
# Add unique constraint to ai_insights

Adds a composite unique constraint on (user_id, insight_type, period) so that
upserts in the frontend can use onConflict to replace stale insights for the same
type and period without creating duplicates.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_insights_user_type_period_key'
  ) THEN
    ALTER TABLE ai_insights
      ADD CONSTRAINT ai_insights_user_type_period_key
      UNIQUE (user_id, insight_type, period);
  END IF;
END $$;
