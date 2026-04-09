-- UNIFIED FEED ENGINE SCHEMA
-- Transforms siloed content into one scrollable experience

-- FEED CACHE (precomputed ranked feed per user)
CREATE TABLE IF NOT EXISTS feed_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,                     -- NULL = anonymous/cold start
  session_id TEXT,                  -- For anonymous session tracking
  
  -- Content reference
  item_type TEXT NOT NULL,          -- 'clip', 'live_match', 'vod', 'ad', 'tournament'
  item_id UUID NOT NULL,
  
  -- Ranking
  score NUMERIC(10, 4) NOT NULL DEFAULT 0,
  rank_position INTEGER,
  
  -- Context for why this was ranked
  ranking_reason TEXT,              -- 'trending', 'following', 'personalized', 'exploration'
  
  -- Metadata cache (avoid joins on read)
  item_data JSONB DEFAULT '{}',
  
  -- Lifecycle
  inserted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),
  
  UNIQUE(user_id, session_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_cache_user ON feed_cache(user_id, score DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feed_cache_session ON feed_cache(session_id, score DESC) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feed_cache_expires ON feed_cache(expires_at);

-- UNIFIED CONTENT VIEW (virtual table joining all content types)
CREATE OR REPLACE VIEW unified_content AS
  -- Clips
  SELECT 
    pm.id,
    'clip' AS content_type,
    pm.title,
    pm.description,
    pm.media_url,
    pm.thumbnail_url,
    pm.duration_seconds,
    pm.player_id AS creator_id,
    pm.game_id,
    pm.tournament_id,
    pm.view_count,
    pm.like_count,
    pm.comment_count,
    COALESCE(pm.trending_score, 0) AS trending_score,
    COALESCE(pm.momentum_score, 0) AS momentum_score,
    pm.created_at,
    pm.status,
    pm.visibility,
    p.username AS creator_name,
    p.profile_image_url AS creator_avatar,
    g.name AS game_name,
    g.logo_url AS game_logo
  FROM player_media pm
  LEFT JOIN players p ON pm.player_id = p.id
  LEFT JOIN games g ON pm.game_id = g.id
  WHERE pm.media_type IN ('highlight', 'clip', 'video')
    AND pm.status = 'active'
    AND pm.visibility = 'public'
  
  UNION ALL
  
  -- Live Matches
  SELECT
    m.id,
    'live_match' AS content_type,
    CONCAT(t1.name, ' vs ', t2.name) AS title,
    CONCAT('Round ', m.round, ' - ', t.name) AS description,
    fm.stream_url AS media_url,
    fm.thumbnail_url,
    NULL AS duration_seconds,
    NULL AS creator_id,
    t.game_id,
    t.id AS tournament_id,
    fm.viewer_count AS view_count,
    0 AS like_count,
    0 AS comment_count,
    COALESCE(fm.viewer_count, 0) * 10 AS trending_score,
    100 AS momentum_score,  -- Live content gets momentum boost
    m.scheduled_time AS created_at,
    m.status,
    'public' AS visibility,
    t.name AS creator_name,
    t.logo_url AS creator_avatar,
    g.name AS game_name,
    g.logo_url AS game_logo
  FROM matches m
  JOIN tournaments t ON m.tournament_id = t.id
  LEFT JOIN teams t1 ON m.team_1_id = t1.id
  LEFT JOIN teams t2 ON m.team_2_id = t2.id
  LEFT JOIN feature_matches fm ON fm.match_id = m.id
  LEFT JOIN games g ON t.game_id = g.id
  WHERE m.status = 'in_progress'
  
  UNION ALL
  
  -- VODs (completed matches with recordings)
  SELECT
    va.id,
    'vod' AS content_type,
    va.title,
    va.description,
    va.stream_url AS media_url,
    va.thumbnail_url,
    va.duration_minutes * 60 AS duration_seconds,
    NULL AS creator_id,
    t.game_id,
    t.id AS tournament_id,
    va.view_count,
    0 AS like_count,
    0 AS comment_count,
    COALESCE(va.view_count, 0) AS trending_score,
    0 AS momentum_score,
    va.created_at,
    'active' AS status,
    'public' AS visibility,
    t.name AS creator_name,
    t.logo_url AS creator_avatar,
    g.name AS game_name,
    g.logo_url AS game_logo
  FROM vod_archives va
  JOIN tournaments t ON va.tournament_id = t.id
  LEFT JOIN games g ON t.game_id = g.id
  WHERE va.status = 'available';

-- FEED INTERACTION EVENTS (for session adaptation)
CREATE TABLE IF NOT EXISTS feed_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,
  
  -- What they interacted with
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  
  -- Interaction details
  action TEXT NOT NULL,             -- 'view', 'skip', 'like', 'share', 'comment', 'follow'
  watch_duration_seconds INTEGER,
  watch_percentage NUMERIC(5, 2),
  
  -- Context
  position_in_feed INTEGER,
  feed_session_id TEXT,             -- Groups interactions in one scroll session
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_interactions_user ON feed_interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_interactions_session ON feed_interactions(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_interactions_item ON feed_interactions(item_type, item_id);

-- SESSION STATE (tracks current user session preferences in real-time)
CREATE TABLE IF NOT EXISTS feed_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT NOT NULL,
  
  -- Session-learned preferences
  boosted_games TEXT[] DEFAULT '{}',
  avoided_games TEXT[] DEFAULT '{}',
  boosted_creators TEXT[] DEFAULT '{}',
  avoided_creators TEXT[] DEFAULT '{}',
  
  -- Session stats
  clips_viewed INTEGER DEFAULT 0,
  clips_skipped INTEGER DEFAULT 0,
  live_viewed INTEGER DEFAULT 0,
  vods_viewed INTEGER DEFAULT 0,
  ads_viewed INTEGER DEFAULT 0,
  ads_clicked INTEGER DEFAULT 0,
  
  -- Adaptation signals
  avg_watch_percentage NUMERIC(5, 2) DEFAULT 0,
  skip_rate NUMERIC(5, 2) DEFAULT 0,
  
  -- Lifecycle
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_sessions_user ON feed_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_sessions_activity ON feed_sessions(last_activity_at DESC);

-- FUNCTION: Update session stats after interaction
CREATE OR REPLACE FUNCTION update_feed_session()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO feed_sessions (session_id, user_id)
  VALUES (NEW.session_id, NEW.user_id)
  ON CONFLICT (session_id) DO UPDATE SET
    clips_viewed = CASE WHEN NEW.item_type = 'clip' AND NEW.action = 'view' 
                        THEN feed_sessions.clips_viewed + 1 
                        ELSE feed_sessions.clips_viewed END,
    clips_skipped = CASE WHEN NEW.item_type = 'clip' AND NEW.action = 'skip' 
                         THEN feed_sessions.clips_skipped + 1 
                         ELSE feed_sessions.clips_skipped END,
    live_viewed = CASE WHEN NEW.item_type = 'live_match' AND NEW.action = 'view' 
                       THEN feed_sessions.live_viewed + 1 
                       ELSE feed_sessions.live_viewed END,
    vods_viewed = CASE WHEN NEW.item_type = 'vod' AND NEW.action = 'view' 
                       THEN feed_sessions.vods_viewed + 1 
                       ELSE feed_sessions.vods_viewed END,
    ads_viewed = CASE WHEN NEW.item_type = 'ad' AND NEW.action = 'view' 
                      THEN feed_sessions.ads_viewed + 1 
                      ELSE feed_sessions.ads_viewed END,
    ads_clicked = CASE WHEN NEW.item_type = 'ad' AND NEW.action = 'click' 
                       THEN feed_sessions.ads_clicked + 1 
                       ELSE feed_sessions.ads_clicked END,
    last_activity_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_feed_session ON feed_interactions;
CREATE TRIGGER trg_update_feed_session
  AFTER INSERT ON feed_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_feed_session();

-- FUNCTION: Clean expired feed cache
CREATE OR REPLACE FUNCTION cleanup_expired_feed_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM feed_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- RLS
ALTER TABLE feed_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own feed cache" ON feed_cache
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Service can manage feed cache" ON feed_cache
  FOR ALL USING (true);

CREATE POLICY "Users can view own interactions" ON feed_interactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert interactions" ON feed_interactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own sessions" ON feed_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can manage sessions" ON feed_sessions
  FOR ALL USING (true);
