-- Add loser_id and draws columns to tournament_matches for better result tracking
-- These columns enable proper win/lose/draw reporting

-- Add loser_id column
ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS loser_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add draws column (number of drawn games in a match)
ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS draws INTEGER DEFAULT 0;

-- Add player1_wins and player2_wins for detailed game counts
ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS player1_wins INTEGER DEFAULT 0;

ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS player2_wins INTEGER DEFAULT 0;

-- Add result column for quick status lookup
ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS result TEXT CHECK (result IN ('player1_win', 'player2_win', 'draw', NULL));

-- Add reporting status columns for two-player confirmation flow
ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS player1_reported_at TIMESTAMPTZ;

ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS player2_reported_at TIMESTAMPTZ;

ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update status check constraint to include new statuses
ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_status_check;
ALTER TABLE tournament_matches ADD CONSTRAINT tournament_matches_status_check 
  CHECK (status IN ('pending', 'in_progress', 'completed', 'bye', 'player1_reported', 'player2_reported', 'confirmed'));

-- Add tournament_id column for easier querying (denormalized from round)
ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;

-- Backfill tournament_id from rounds
UPDATE tournament_matches m
SET tournament_id = p.tournament_id
FROM tournament_rounds r
JOIN tournament_phases p ON r.phase_id = p.id
WHERE m.round_id = r.id
AND m.tournament_id IS NULL;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player1_id ON tournament_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player2_id ON tournament_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_winner_id ON tournament_matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(status);
