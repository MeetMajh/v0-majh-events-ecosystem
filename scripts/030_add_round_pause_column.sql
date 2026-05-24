-- Add column for storing remaining time when round is paused
ALTER TABLE tournament_rounds ADD COLUMN IF NOT EXISTS paused_time_remaining_ms BIGINT;

-- Add 'paused' status to the round status check constraint if not already there
-- First drop the existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'tournament_rounds' AND constraint_name = 'tournament_rounds_status_check'
  ) THEN
    ALTER TABLE tournament_rounds DROP CONSTRAINT tournament_rounds_status_check;
  END IF;
END $$;

-- Re-add with paused status included
ALTER TABLE tournament_rounds ADD CONSTRAINT tournament_rounds_status_check
  CHECK (status IN ('pending', 'active', 'paused', 'completed'));
