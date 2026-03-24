-- Migration: Add tournament results, leaderboards, and career tracking
-- Safe to run multiple times (uses IF NOT EXISTS)

-- ============================================
-- 1. Add career stats columns to profiles
-- ============================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS career_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS career_losses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS career_tournaments INTEGER DEFAULT 0;

-- ============================================
-- 2. Add unenrolled_at to tournament_registrations
-- ============================================
ALTER TABLE tournament_registrations 
ADD COLUMN IF NOT EXISTS unenrolled_at TIMESTAMPTZ;

-- ============================================
-- 3. Add drop tracking to tournament_player_stats
-- ============================================
ALTER TABLE tournament_player_stats 
ADD COLUMN IF NOT EXISTS is_dropped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dropped_at_round INTEGER;

-- ============================================
-- 4. Create tournament_results table
-- ============================================
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
  prize_amount DECIMAL(10,2),
  prize_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tournament_id, user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tournament_results_user ON tournament_results(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_results_tournament ON tournament_results(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_results_placement ON tournament_results(placement);

-- ============================================
-- 5. Create leaderboard_entries table
-- ============================================
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ranking_points INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_draws INTEGER DEFAULT 0,
  tournaments_played INTEGER DEFAULT 0,
  tournaments_won INTEGER DEFAULT 0,
  best_placement INTEGER,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, game_id)
);

-- Index for faster leaderboard queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_user ON leaderboard_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_game ON leaderboard_entries(game_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_points ON leaderboard_entries(ranking_points DESC);

-- ============================================
-- 6. Enable RLS on new tables
-- ============================================
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- Tournament results: Anyone can read, only staff can write
CREATE POLICY IF NOT EXISTS "tournament_results_select" ON tournament_results
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "tournament_results_insert" ON tournament_results
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "tournament_results_update" ON tournament_results
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid())
  );

-- Leaderboard entries: Anyone can read, only staff can write
CREATE POLICY IF NOT EXISTS "leaderboard_entries_select" ON leaderboard_entries
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "leaderboard_entries_insert" ON leaderboard_entries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "leaderboard_entries_update" ON leaderboard_entries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- 7. Add unique constraint to tournament_player_stats
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tournament_player_stats_unique_player'
  ) THEN
    ALTER TABLE tournament_player_stats 
    ADD CONSTRAINT tournament_player_stats_unique_player 
    UNIQUE (tournament_id, phase_id, player_id);
  END IF;
END $$;

-- ============================================
-- Done!
-- ============================================
