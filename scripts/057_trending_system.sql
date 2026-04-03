-- Trending System Migration
-- Calculates real-time trending scores for matches and tournaments

-- ==========================================
-- 1. TRENDING SNAPSHOTS (for velocity tracking)
-- ==========================================

CREATE TABLE IF NOT EXISTS match_trending_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  viewer_count INTEGER DEFAULT 0,
  reaction_count INTEGER DEFAULT 0,
  chat_count INTEGER DEFAULT 0,
  trending_score NUMERIC(10,2) DEFAULT 0,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trending_snapshots_match ON match_trending_snapshots(match_id);
CREATE INDEX IF NOT EXISTS idx_trending_snapshots_recent ON match_trending_snapshots(snapshot_at DESC);

-- ==========================================
-- 2. TRENDING BADGES/TAGS
-- ==========================================

-- Add trending metadata to matches
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS trending_badge TEXT CHECK (trending_badge IN (
  'hot', 'rising', 'chat_exploding', 'peak_viewers', 'clutch_moment', 'upset_alert'
)),
ADD COLUMN IF NOT EXISTS trending_badge_set_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reactions_per_minute NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS chat_per_minute NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS viewer_velocity INTEGER DEFAULT 0;

-- ==========================================
-- 3. CALCULATE TRENDING SCORE FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION calculate_trending_score(
  p_viewer_count INTEGER,
  p_reaction_rate NUMERIC,
  p_chat_rate NUMERIC,
  p_viewer_velocity INTEGER
) RETURNS NUMERIC AS $$
BEGIN
  -- Trending Score Formula:
  -- Base: viewer_count * 0.4
  -- Engagement: reaction_rate * 0.25 + chat_rate * 0.2
  -- Momentum: viewer_velocity * 0.15
  RETURN (
    (COALESCE(p_viewer_count, 0) * 0.4) +
    (COALESCE(p_reaction_rate, 0) * 0.25 * 10) +
    (COALESCE(p_chat_rate, 0) * 0.2 * 5) +
    (GREATEST(COALESCE(p_viewer_velocity, 0), 0) * 0.15 * 2)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==========================================
-- 4. UPDATE TRENDING METRICS FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION update_match_trending_metrics(p_match_id UUID)
RETURNS void AS $$
DECLARE
  v_viewer_count INTEGER;
  v_reactions_5min INTEGER;
  v_chat_5min INTEGER;
  v_prev_viewers INTEGER;
  v_reaction_rate NUMERIC;
  v_chat_rate NUMERIC;
  v_velocity INTEGER;
  v_score NUMERIC;
  v_badge TEXT;
BEGIN
  -- Get current viewer count
  SELECT COUNT(*) INTO v_viewer_count
  FROM match_viewer_sessions
  WHERE match_id = p_match_id
    AND ended_at IS NULL
    AND last_ping_at > NOW() - INTERVAL '60 seconds';

  -- Get reactions in last 5 minutes
  SELECT COUNT(*) INTO v_reactions_5min
  FROM match_reactions
  WHERE match_id = p_match_id
    AND created_at > NOW() - INTERVAL '5 minutes';

  -- Get chat messages in last 5 minutes
  SELECT COUNT(*) INTO v_chat_5min
  FROM match_chat_messages
  WHERE match_id = p_match_id
    AND created_at > NOW() - INTERVAL '5 minutes'
    AND is_deleted = false;

  -- Get previous snapshot viewer count (2 min ago)
  SELECT viewer_count INTO v_prev_viewers
  FROM match_trending_snapshots
  WHERE match_id = p_match_id
    AND snapshot_at < NOW() - INTERVAL '2 minutes'
  ORDER BY snapshot_at DESC
  LIMIT 1;

  -- Calculate rates (per minute)
  v_reaction_rate := v_reactions_5min / 5.0;
  v_chat_rate := v_chat_5min / 5.0;
  v_velocity := v_viewer_count - COALESCE(v_prev_viewers, v_viewer_count);

  -- Calculate trending score
  v_score := calculate_trending_score(v_viewer_count, v_reaction_rate, v_chat_rate, v_velocity);

  -- Determine badge
  v_badge := NULL;
  IF v_reaction_rate > 20 THEN
    v_badge := 'clutch_moment';
  ELSIF v_chat_rate > 30 THEN
    v_badge := 'chat_exploding';
  ELSIF v_velocity > 10 THEN
    v_badge := 'rising';
  ELSIF v_viewer_count > 50 AND v_reaction_rate > 5 THEN
    v_badge := 'hot';
  END IF;

  -- Update match
  UPDATE tournament_matches
  SET 
    viewer_count = v_viewer_count,
    reactions_per_minute = v_reaction_rate,
    chat_per_minute = v_chat_rate,
    viewer_velocity = v_velocity,
    trending_score = v_score,
    trending_badge = v_badge,
    trending_badge_set_at = CASE WHEN v_badge IS NOT NULL THEN NOW() ELSE trending_badge_set_at END,
    peak_viewer_count = GREATEST(peak_viewer_count, v_viewer_count)
  WHERE id = p_match_id;

  -- Insert snapshot
  INSERT INTO match_trending_snapshots (match_id, viewer_count, reaction_count, chat_count, trending_score)
  VALUES (p_match_id, v_viewer_count, v_reactions_5min, v_chat_5min, v_score);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 5. TOURNAMENT TRENDING
-- ==========================================

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS trending_score NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_viewers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_reactions INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION update_tournament_trending(p_tournament_id UUID)
RETURNS void AS $$
DECLARE
  v_total_viewers INTEGER;
  v_total_reactions INTEGER;
  v_score NUMERIC;
BEGIN
  -- Sum up all match metrics
  SELECT 
    COALESCE(SUM(tm.viewer_count), 0),
    COALESCE(SUM(tm.total_reactions), 0)
  INTO v_total_viewers, v_total_reactions
  FROM tournament_matches tm
  JOIN tournament_rounds tr ON tm.round_id = tr.id
  JOIN tournament_phases tp ON tr.phase_id = tp.id
  WHERE tp.tournament_id = p_tournament_id
    AND tm.status IN ('pending', 'in_progress', 'player1_reported', 'player2_reported');

  v_score := v_total_viewers * 0.6 + v_total_reactions * 0.4;

  UPDATE tournaments
  SET 
    trending_score = v_score,
    total_viewers = v_total_viewers,
    total_reactions = v_total_reactions
  WHERE id = p_tournament_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 6. RLS POLICIES
-- ==========================================

ALTER TABLE match_trending_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view trending snapshots"
  ON match_trending_snapshots FOR SELECT USING (true);

-- ==========================================
-- 7. CLEANUP OLD SNAPSHOTS (keep 1 hour)
-- ==========================================

CREATE OR REPLACE FUNCTION cleanup_old_trending_snapshots()
RETURNS void AS $$
BEGIN
  DELETE FROM match_trending_snapshots
  WHERE snapshot_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
