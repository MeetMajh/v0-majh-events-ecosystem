-- Viewer Engagement System
-- Creates emotional stickiness through reactions, predictions, and presence

-- 1. Live Reactions (ephemeral, real-time)
CREATE TABLE IF NOT EXISTS match_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  reaction_type TEXT NOT NULL CHECK (reaction_type IN (
    'hype', 'gg', 'clutch', 'sadge', 'pog', 'lul', 'fire', 'skull'
  )),
  
  -- Anonymous reactions allowed
  session_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Match Predictions (before match starts)
CREATE TABLE IF NOT EXISTS match_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  predicted_winner_id UUID REFERENCES profiles(id),
  predicted_score TEXT, -- e.g. "2-1", "2-0"
  confidence INTEGER DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  
  -- Points earned (calculated after match)
  points_earned INTEGER DEFAULT 0,
  is_correct BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(match_id, user_id)
);

-- 3. Viewer Presence (who's watching)
CREATE TABLE IF NOT EXISTS match_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id TEXT,
  
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one entry per user/session per match
  UNIQUE(match_id, user_id),
  UNIQUE(match_id, session_id)
);

-- 4. Prediction Leaderboard (cumulative points)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS prediction_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS predictions_correct INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS predictions_total INTEGER DEFAULT 0;

-- 5. Match Hype Score (aggregate reactions)
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS hype_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS peak_viewers INTEGER DEFAULT 0;

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reactions_match ON match_reactions(match_id);
CREATE INDEX IF NOT EXISTS idx_reactions_recent ON match_reactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON match_predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON match_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_viewers_match ON match_viewers(match_id);
CREATE INDEX IF NOT EXISTS idx_viewers_active ON match_viewers(last_seen_at DESC);

-- 7. Function to clean up stale viewers (older than 2 minutes)
CREATE OR REPLACE FUNCTION cleanup_stale_viewers()
RETURNS void AS $$
BEGIN
  DELETE FROM match_viewers
  WHERE last_seen_at < NOW() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql;

-- 8. Function to calculate match hype score
CREATE OR REPLACE FUNCTION calculate_hype_score(p_match_id UUID)
RETURNS INTEGER AS $$
DECLARE
  reaction_count INTEGER;
  viewer_count INTEGER;
  prediction_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO reaction_count
  FROM match_reactions
  WHERE match_id = p_match_id
  AND created_at > NOW() - INTERVAL '5 minutes';
  
  SELECT COUNT(*) INTO viewer_count
  FROM match_viewers
  WHERE match_id = p_match_id
  AND last_seen_at > NOW() - INTERVAL '2 minutes';
  
  SELECT COUNT(*) INTO prediction_count
  FROM match_predictions
  WHERE match_id = p_match_id;
  
  RETURN (reaction_count * 10) + (viewer_count * 5) + (prediction_count * 3);
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger to update hype score on reaction
CREATE OR REPLACE FUNCTION update_match_hype()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tournament_matches
  SET hype_score = calculate_hype_score(NEW.match_id)
  WHERE id = NEW.match_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reaction_hype_trigger ON match_reactions;
CREATE TRIGGER reaction_hype_trigger
  AFTER INSERT ON match_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_match_hype();

-- 10. Function to award prediction points
CREATE OR REPLACE FUNCTION award_prediction_points(p_match_id UUID)
RETURNS void AS $$
DECLARE
  winner_id UUID;
  p RECORD;
BEGIN
  -- Get the actual winner (player with more wins)
  SELECT 
    CASE 
      WHEN player1_wins > player2_wins THEN player1_id
      WHEN player2_wins > player1_wins THEN player2_id
      ELSE NULL
    END INTO winner_id
  FROM tournament_matches
  WHERE id = p_match_id;
  
  -- Update each prediction
  FOR p IN SELECT * FROM match_predictions WHERE match_id = p_match_id LOOP
    IF p.predicted_winner_id = winner_id THEN
      -- Correct prediction: base 100 points + confidence bonus
      UPDATE match_predictions
      SET is_correct = true, points_earned = 100 + p.confidence
      WHERE id = p.id;
      
      -- Update user's cumulative stats
      UPDATE profiles
      SET 
        prediction_points = prediction_points + 100 + p.confidence,
        predictions_correct = predictions_correct + 1,
        predictions_total = predictions_total + 1
      WHERE id = p.user_id;
    ELSE
      -- Incorrect prediction
      UPDATE match_predictions
      SET is_correct = false, points_earned = 0
      WHERE id = p.id;
      
      UPDATE profiles
      SET predictions_total = predictions_total + 1
      WHERE id = p.user_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 11. Enable RLS
ALTER TABLE match_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_viewers ENABLE ROW LEVEL SECURITY;

-- Anyone can view reactions
CREATE POLICY "Anyone can view reactions"
  ON match_reactions FOR SELECT USING (true);

-- Anyone can add reactions
CREATE POLICY "Anyone can add reactions"
  ON match_reactions FOR INSERT WITH CHECK (true);

-- Anyone can view predictions
CREATE POLICY "Anyone can view predictions"
  ON match_predictions FOR SELECT USING (true);

-- Users can manage their own predictions
CREATE POLICY "Users can manage own predictions"
  ON match_predictions FOR ALL
  USING (user_id = auth.uid());

-- Anyone can view viewers
CREATE POLICY "Anyone can view viewers"
  ON match_viewers FOR SELECT USING (true);

-- Anyone can add/update viewer presence
CREATE POLICY "Anyone can update viewer presence"
  ON match_viewers FOR ALL USING (true);

-- 12. Enable realtime for engagement tables
ALTER PUBLICATION supabase_realtime ADD TABLE match_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE match_predictions;
ALTER PUBLICATION supabase_realtime ADD TABLE match_viewers;
