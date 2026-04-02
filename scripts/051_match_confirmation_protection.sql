-- Match Confirmation System: Protection Trigger
-- Prevents modifications to confirmed matches without TO authorization

-- Create function to protect confirmed matches
CREATE OR REPLACE FUNCTION protect_confirmed_matches()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow status changes from confirmed (TO override scenarios)
  -- But require confirmed_by to be set for the new record
  
  -- If the match was confirmed and we're changing result-related fields
  IF OLD.status = 'confirmed' THEN
    -- Allow if:
    -- 1. We're just changing status back (TO wants to reopen/dispute)
    -- 2. confirmed_by is being set (TO authorization)
    
    -- Check if critical fields are being changed
    IF (OLD.player1_wins IS DISTINCT FROM NEW.player1_wins OR
        OLD.player2_wins IS DISTINCT FROM NEW.player2_wins OR
        OLD.draws IS DISTINCT FROM NEW.draws OR
        OLD.winner_id IS DISTINCT FROM NEW.winner_id) THEN
      -- Only allow if this is a TO action (new confirmed_by or keeping existing)
      IF NEW.confirmed_by IS NULL AND OLD.confirmed_by IS NOT NULL THEN
        -- Trying to modify without TO auth
        RAISE EXCEPTION 'Cannot modify result of a confirmed match without TO authorization';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for protection
DROP TRIGGER IF EXISTS protect_confirmed_trigger ON tournament_matches;
CREATE TRIGGER protect_confirmed_trigger
  BEFORE UPDATE ON tournament_matches
  FOR EACH ROW
  WHEN (OLD.status = 'confirmed')
  EXECUTE FUNCTION protect_confirmed_matches();

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Match confirmation protection trigger installed successfully';
END $$;
