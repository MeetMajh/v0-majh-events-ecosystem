-- Match Confirmation System: Add Dispute Status & Detection
-- This script adds the disputed status and mismatch detection trigger

-- 1. Add dispute_reason column if it doesn't exist
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

-- 2. Drop existing status constraint and add with disputed status
ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_status_check;
ALTER TABLE tournament_matches ADD CONSTRAINT tournament_matches_status_check 
  CHECK (status IN ('pending', 'in_progress', 'completed', 'bye', 'player1_reported', 'player2_reported', 'confirmed', 'disputed'));

-- 3. Create function to detect result mismatches when both players have reported
-- The logic compares what each player reported for game wins
CREATE OR REPLACE FUNCTION check_match_result_mismatch()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check when transitioning to confirmed (both players reported)
  -- Skip if already disputed or if this is a TO override (confirmed_by is set)
  IF NEW.status = 'confirmed' AND OLD.status IN ('player1_reported', 'player2_reported') THEN
    -- If a TO is confirming (confirmed_by set), skip mismatch check
    IF NEW.confirmed_by IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- Compare reported results
    -- Player 1 reports: reported_player1_wins (their wins) vs reported_player1_draws
    -- Player 2 reports: reported_player2_wins (their wins) vs reported_player2_draws
    -- If player1 claims X wins and player2 claims Y wins, X + Y should equal total games
    -- For simplicity: both players should agree on who won the match
    
    -- Check if the reported wins match the final recorded wins
    -- If player1 reported different wins than what's recorded, it's a mismatch
    IF (NEW.reported_player1_wins IS NOT NULL AND NEW.reported_player2_wins IS NOT NULL) THEN
      -- Both players reported - check if they agree
      -- Player 1 says they won X games, Player 2 says they won Y games
      -- They should match: player1_wins = reported_player1_wins, player2_wins = reported_player2_wins
      -- But we also need to check cross-agreement
      IF (NEW.player1_wins != NEW.reported_player1_wins OR 
          NEW.player2_wins != NEW.reported_player2_wins) THEN
        NEW.status = 'disputed';
        NEW.dispute_reason = 'Player-reported results do not match';
        NEW.confirmed_at = NULL;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger for mismatch detection
DROP TRIGGER IF EXISTS check_match_mismatch_trigger ON tournament_matches;
CREATE TRIGGER check_match_mismatch_trigger
  BEFORE UPDATE ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION check_match_result_mismatch();

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Match confirmation dispute system installed successfully';
END $$;
