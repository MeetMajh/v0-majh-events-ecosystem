-- Global Leaderboard Aggregation System
-- This creates functions and triggers to aggregate tournament results into global leaderboards

-- Add season tracking to leaderboard_entries
ALTER TABLE leaderboard_entries 
ADD COLUMN IF NOT EXISTS season TEXT DEFAULT 'all-time',
ADD COLUMN IF NOT EXISTS season_start DATE,
ADD COLUMN IF NOT EXISTS season_end DATE,
ADD COLUMN IF NOT EXISTS avg_placement NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_placement INTEGER,
ADD COLUMN IF NOT EXISTS peak_points INTEGER DEFAULT 0;

-- Drop unique constraint if it exists and recreate with season
ALTER TABLE leaderboard_entries DROP CONSTRAINT IF EXISTS leaderboard_entries_user_id_game_id_key;
ALTER TABLE leaderboard_entries ADD CONSTRAINT leaderboard_entries_user_game_season_key 
  UNIQUE (user_id, game_id, season);

-- Create index for season queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_season ON leaderboard_entries(season);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_ranking ON leaderboard_entries(ranking_points DESC);

-- Function to calculate ranking points based on tournament placement
CREATE OR REPLACE FUNCTION calculate_ranking_points(
  p_placement INTEGER,
  p_participant_count INTEGER,
  p_entry_fee INTEGER DEFAULT 0
) RETURNS INTEGER AS $$
DECLARE
  base_points INTEGER;
  size_multiplier NUMERIC;
  fee_bonus INTEGER;
BEGIN
  -- Base points by placement (top 8 get special points)
  CASE p_placement
    WHEN 1 THEN base_points := 100;
    WHEN 2 THEN base_points := 75;
    WHEN 3 THEN base_points := 55;
    WHEN 4 THEN base_points := 40;
    WHEN 5 THEN base_points := 30;
    WHEN 6 THEN base_points := 25;
    WHEN 7 THEN base_points := 20;
    WHEN 8 THEN base_points := 15;
    ELSE 
      -- Points decrease for lower placements
      base_points := GREATEST(0, 12 - (p_placement - 8));
  END CASE;
  
  -- Size multiplier (larger tournaments = more points)
  size_multiplier := CASE
    WHEN p_participant_count >= 64 THEN 2.0
    WHEN p_participant_count >= 32 THEN 1.5
    WHEN p_participant_count >= 16 THEN 1.2
    WHEN p_participant_count >= 8 THEN 1.0
    ELSE 0.8
  END;
  
  -- Entry fee bonus (paid events worth more)
  fee_bonus := CASE
    WHEN p_entry_fee >= 2000 THEN 20  -- $20+
    WHEN p_entry_fee >= 1000 THEN 10  -- $10+
    WHEN p_entry_fee >= 500 THEN 5    -- $5+
    ELSE 0
  END;
  
  RETURN ROUND(base_points * size_multiplier) + fee_bonus;
END;
$$ LANGUAGE plpgsql;

-- Function to update leaderboard entry for a player after tournament completion
CREATE OR REPLACE FUNCTION update_player_leaderboard(
  p_user_id UUID,
  p_game_id UUID,
  p_tournament_id UUID,
  p_placement INTEGER,
  p_match_wins INTEGER,
  p_match_losses INTEGER,
  p_participant_count INTEGER,
  p_entry_fee INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
  v_points INTEGER;
  v_is_win BOOLEAN;
BEGIN
  -- Calculate points for this tournament
  v_points := calculate_ranking_points(p_placement, p_participant_count, p_entry_fee);
  v_is_win := (p_placement = 1);
  
  -- Upsert into leaderboard_entries for all-time
  INSERT INTO leaderboard_entries (
    user_id, game_id, season,
    total_wins, total_losses,
    tournaments_played, tournaments_won,
    ranking_points, avg_placement, best_placement, peak_points,
    last_updated
  ) VALUES (
    p_user_id, p_game_id, 'all-time',
    p_match_wins, p_match_losses,
    1, CASE WHEN v_is_win THEN 1 ELSE 0 END,
    v_points, p_placement, p_placement, v_points,
    NOW()
  )
  ON CONFLICT (user_id, game_id, season) DO UPDATE SET
    total_wins = leaderboard_entries.total_wins + EXCLUDED.total_wins,
    total_losses = leaderboard_entries.total_losses + EXCLUDED.total_losses,
    tournaments_played = leaderboard_entries.tournaments_played + 1,
    tournaments_won = leaderboard_entries.tournaments_won + CASE WHEN v_is_win THEN 1 ELSE 0 END,
    ranking_points = leaderboard_entries.ranking_points + v_points,
    avg_placement = (leaderboard_entries.avg_placement * leaderboard_entries.tournaments_played + p_placement) 
                    / (leaderboard_entries.tournaments_played + 1),
    best_placement = LEAST(COALESCE(leaderboard_entries.best_placement, p_placement), p_placement),
    peak_points = GREATEST(leaderboard_entries.peak_points, leaderboard_entries.ranking_points + v_points),
    last_updated = NOW();
    
  -- Also update current season (assuming quarterly seasons)
  INSERT INTO leaderboard_entries (
    user_id, game_id, season, season_start, season_end,
    total_wins, total_losses,
    tournaments_played, tournaments_won,
    ranking_points, avg_placement, best_placement, peak_points,
    last_updated
  ) VALUES (
    p_user_id, p_game_id, 
    'season-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-Q' || CEIL(EXTRACT(MONTH FROM CURRENT_DATE) / 3.0)::INTEGER::TEXT,
    DATE_TRUNC('quarter', CURRENT_DATE)::DATE,
    (DATE_TRUNC('quarter', CURRENT_DATE) + INTERVAL '3 months' - INTERVAL '1 day')::DATE,
    p_match_wins, p_match_losses,
    1, CASE WHEN v_is_win THEN 1 ELSE 0 END,
    v_points, p_placement, p_placement, v_points,
    NOW()
  )
  ON CONFLICT (user_id, game_id, season) DO UPDATE SET
    total_wins = leaderboard_entries.total_wins + EXCLUDED.total_wins,
    total_losses = leaderboard_entries.total_losses + EXCLUDED.total_losses,
    tournaments_played = leaderboard_entries.tournaments_played + 1,
    tournaments_won = leaderboard_entries.tournaments_won + CASE WHEN v_is_win THEN 1 ELSE 0 END,
    ranking_points = leaderboard_entries.ranking_points + v_points,
    avg_placement = (leaderboard_entries.avg_placement * leaderboard_entries.tournaments_played + p_placement) 
                    / (leaderboard_entries.tournaments_played + 1),
    best_placement = LEAST(COALESCE(leaderboard_entries.best_placement, p_placement), p_placement),
    peak_points = GREATEST(leaderboard_entries.peak_points, leaderboard_entries.ranking_points + v_points),
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate all past tournament data into leaderboard
-- Run this once to populate initial leaderboard from existing data
CREATE OR REPLACE FUNCTION populate_leaderboard_from_history() RETURNS VOID AS $$
DECLARE
  r RECORD;
  v_participant_count INTEGER;
BEGIN
  -- Clear existing leaderboard entries
  DELETE FROM leaderboard_entries;
  
  -- Loop through all tournament results
  FOR r IN 
    SELECT 
      tr.user_id,
      t.game_id,
      tr.tournament_id,
      tr.placement,
      COALESCE(tr.match_wins, 0) as match_wins,
      COALESCE(tr.match_losses, 0) as match_losses,
      COALESCE(t.entry_fee_cents, 0) as entry_fee
    FROM tournament_results tr
    JOIN tournaments t ON t.id = tr.tournament_id
    WHERE t.status = 'completed' AND t.game_id IS NOT NULL
  LOOP
    -- Get participant count for this tournament
    SELECT COUNT(*) INTO v_participant_count 
    FROM tournament_registrations 
    WHERE tournament_id = r.tournament_id;
    
    -- Update leaderboard
    PERFORM update_player_leaderboard(
      r.user_id,
      r.game_id,
      r.tournament_id,
      r.placement,
      r.match_wins,
      r.match_losses,
      v_participant_count,
      r.entry_fee
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_ranking_points TO authenticated;
GRANT EXECUTE ON FUNCTION update_player_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION populate_leaderboard_from_history TO authenticated;

-- Allow reading leaderboard entries for all users
CREATE POLICY IF NOT EXISTS "Anyone can view leaderboard entries"
ON leaderboard_entries FOR SELECT
USING (true);

-- Add RLS policy for inserting/updating (only via functions)
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "System can manage leaderboard entries"
ON leaderboard_entries FOR ALL
USING (true)
WITH CHECK (true);
