-- Momentum + Auto Feature Match System
-- Turns matches into stories and auto-promotes hype matches

-- ==========================================
-- 1. MOMENTUM TRACKING FIELDS
-- ==========================================

-- Add momentum fields to matches
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS momentum_player_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS momentum_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lead_changes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS comeback_player_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS max_deficit_overcome INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_deciding_game BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS momentum_badge TEXT CHECK (momentum_badge IN (
  'on_fire', 'comeback', 'clutch_game', 'final_game', 'upset_brewing', 'dominant'
)),
ADD COLUMN IF NOT EXISTS auto_featured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_featured_reason TEXT;

-- ==========================================
-- 2. MATCH GAME HISTORY (for tracking momentum)
-- ==========================================

CREATE TABLE IF NOT EXISTS match_game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  game_number INTEGER NOT NULL,
  winner_id UUID REFERENCES profiles(id),
  
  -- Score state after this game
  player1_score INTEGER NOT NULL DEFAULT 0,
  player2_score INTEGER NOT NULL DEFAULT 0,
  
  -- Momentum indicators
  was_comeback BOOLEAN DEFAULT false,
  streak_continues BOOLEAN DEFAULT false,
  
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(match_id, game_number)
);

CREATE INDEX IF NOT EXISTS idx_game_results_match ON match_game_results(match_id);

-- ==========================================
-- 3. AUTO FEATURE MATCH CONFIG
-- ==========================================

CREATE TABLE IF NOT EXISTS auto_feature_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  
  -- Thresholds for auto-featuring
  trending_score_threshold NUMERIC(10,2) DEFAULT 50,
  viewer_threshold INTEGER DEFAULT 10,
  reaction_rate_threshold NUMERIC(10,2) DEFAULT 5,
  
  -- Auto feature settings
  enabled BOOLEAN DEFAULT true,
  max_auto_features INTEGER DEFAULT 3,
  
  -- Notification settings
  notify_on_auto_feature BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tournament_id)
);

-- Global default config (tournament_id = null)
INSERT INTO auto_feature_config (tournament_id, trending_score_threshold, viewer_threshold)
VALUES (NULL, 50, 10)
ON CONFLICT DO NOTHING;

-- ==========================================
-- 4. MOMENTUM CALCULATION FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION calculate_match_momentum(p_match_id UUID)
RETURNS void AS $$
DECLARE
  v_match RECORD;
  v_games RECORD;
  v_player1_score INTEGER := 0;
  v_player2_score INTEGER := 0;
  v_current_leader UUID;
  v_prev_leader UUID;
  v_lead_changes INTEGER := 0;
  v_streak INTEGER := 0;
  v_streak_player UUID;
  v_max_deficit INTEGER := 0;
  v_comeback_player UUID;
  v_is_deciding BOOLEAN := false;
  v_momentum_badge TEXT;
  v_games_to_win INTEGER;
BEGIN
  -- Get match info
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Determine games to win (best of 3 = 2, best of 5 = 3, etc)
  v_games_to_win := GREATEST(2, CEIL((v_match.player1_wins + v_match.player2_wins + 1)::NUMERIC / 2));

  -- Process game history
  FOR v_games IN 
    SELECT * FROM match_game_results 
    WHERE match_id = p_match_id 
    ORDER BY game_number
  LOOP
    v_player1_score := v_games.player1_score;
    v_player2_score := v_games.player2_score;
    
    -- Track leader
    IF v_player1_score > v_player2_score THEN
      v_current_leader := v_match.player1_id;
    ELSIF v_player2_score > v_player1_score THEN
      v_current_leader := v_match.player2_id;
    ELSE
      v_current_leader := NULL;
    END IF;
    
    -- Count lead changes
    IF v_prev_leader IS NOT NULL AND v_current_leader IS NOT NULL 
       AND v_prev_leader != v_current_leader THEN
      v_lead_changes := v_lead_changes + 1;
    END IF;
    v_prev_leader := v_current_leader;
    
    -- Track streak
    IF v_games.winner_id = v_streak_player THEN
      v_streak := v_streak + 1;
    ELSE
      v_streak := 1;
      v_streak_player := v_games.winner_id;
    END IF;
    
    -- Track comeback (max deficit overcome)
    IF v_games.winner_id = v_match.player1_id AND v_player2_score > v_max_deficit THEN
      v_max_deficit := v_player2_score - (v_player1_score - 1);
      v_comeback_player := v_match.player1_id;
    ELSIF v_games.winner_id = v_match.player2_id AND v_player1_score > v_max_deficit THEN
      v_max_deficit := v_player1_score - (v_player2_score - 1);
      v_comeback_player := v_match.player2_id;
    END IF;
  END LOOP;
  
  -- Check if deciding game
  v_is_deciding := (v_player1_score = v_games_to_win - 1 AND v_player2_score = v_games_to_win - 1);
  
  -- Determine momentum badge
  IF v_is_deciding THEN
    v_momentum_badge := 'final_game';
  ELSIF v_max_deficit >= 2 THEN
    v_momentum_badge := 'comeback';
  ELSIF v_streak >= 3 THEN
    v_momentum_badge := 'on_fire';
  ELSIF v_lead_changes >= 3 THEN
    v_momentum_badge := 'clutch_game';
  ELSIF v_streak >= 2 AND (v_player1_score = 0 OR v_player2_score = 0) THEN
    v_momentum_badge := 'dominant';
  ELSE
    v_momentum_badge := NULL;
  END IF;
  
  -- Update match
  UPDATE tournament_matches SET
    momentum_player_id = v_streak_player,
    momentum_streak = v_streak,
    lead_changes = v_lead_changes,
    comeback_player_id = v_comeback_player,
    max_deficit_overcome = v_max_deficit,
    is_deciding_game = v_is_deciding,
    momentum_badge = v_momentum_badge
  WHERE id = p_match_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 5. AUTO FEATURE MATCH FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION check_auto_feature_match(p_match_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_match RECORD;
  v_config RECORD;
  v_current_auto_count INTEGER;
  v_reason TEXT;
BEGIN
  -- Get match
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND OR v_match.is_feature_match THEN RETURN FALSE; END IF;
  
  -- Get config (tournament-specific or global)
  SELECT * INTO v_config FROM auto_feature_config 
  WHERE tournament_id = (
    SELECT t.id FROM tournaments t
    JOIN tournament_phases tp ON tp.tournament_id = t.id
    JOIN tournament_rounds tr ON tr.phase_id = tp.id
    WHERE tr.id = v_match.round_id
  )
  OR tournament_id IS NULL
  ORDER BY tournament_id NULLS LAST
  LIMIT 1;
  
  IF NOT v_config.enabled THEN RETURN FALSE; END IF;
  
  -- Check current auto-featured count
  SELECT COUNT(*) INTO v_current_auto_count
  FROM tournament_matches
  WHERE round_id = v_match.round_id
  AND is_feature_match = true
  AND auto_featured_at IS NOT NULL;
  
  IF v_current_auto_count >= v_config.max_auto_features THEN RETURN FALSE; END IF;
  
  -- Check thresholds
  IF COALESCE(v_match.trending_score, 0) >= v_config.trending_score_threshold THEN
    v_reason := 'High trending score';
  ELSIF COALESCE(v_match.viewer_count, 0) >= v_config.viewer_threshold THEN
    v_reason := 'High viewer count';
  ELSIF COALESCE(v_match.reactions_per_minute, 0) >= v_config.reaction_rate_threshold THEN
    v_reason := 'High reaction rate';
  ELSIF v_match.momentum_badge IN ('final_game', 'comeback', 'clutch_game') THEN
    v_reason := 'Exciting momentum: ' || v_match.momentum_badge;
  ELSE
    RETURN FALSE;
  END IF;
  
  -- Auto-feature the match
  UPDATE tournament_matches SET
    is_feature_match = true,
    auto_featured_at = NOW(),
    auto_featured_reason = v_reason
  WHERE id = p_match_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 6. RLS POLICIES
-- ==========================================

ALTER TABLE match_game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_feature_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view game results" ON match_game_results FOR SELECT USING (true);
CREATE POLICY "TOs can manage game results" ON match_game_results FOR ALL USING (true);

CREATE POLICY "Anyone can view auto feature config" ON auto_feature_config FOR SELECT USING (true);
CREATE POLICY "TOs can manage auto feature config" ON auto_feature_config FOR ALL USING (
  tournament_id IS NULL OR
  EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = auto_feature_config.tournament_id
    AND (
      t.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM staff_roles sr
        WHERE sr.user_id = auth.uid()
        AND sr.role IN ('owner', 'manager', 'organizer')
      )
    )
  )
);

-- ==========================================
-- 7. ENABLE REALTIME
-- ==========================================

ALTER PUBLICATION supabase_realtime ADD TABLE match_game_results;
