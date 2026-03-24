-- Create tournament_results table for storing final placements
CREATE TABLE IF NOT EXISTS tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  placement INTEGER NOT NULL,
  ranking_points_awarded INTEGER DEFAULT 0,
  match_wins INTEGER DEFAULT 0,
  match_losses INTEGER DEFAULT 0,
  match_draws INTEGER DEFAULT 0,
  game_wins INTEGER DEFAULT 0,
  game_losses INTEGER DEFAULT 0,
  game_draws INTEGER DEFAULT 0,
  prize_amount DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tournament_results_user ON tournament_results(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_results_tournament ON tournament_results(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_results_placement ON tournament_results(placement);
