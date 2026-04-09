-- UNIFIED FEED ENGINE SCHEMA

-- FEED CACHE (precomputed ranked feed per user)
CREATE TABLE IF NOT EXISTS feed_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  score NUMERIC(10, 4) NOT NULL DEFAULT 0,
  rank_position INTEGER,
  ranking_reason TEXT,
  item_data JSONB DEFAULT '{}',
  inserted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_feed_cache_user ON feed_cache(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_feed_cache_session ON feed_cache(session_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_feed_cache_expires ON feed_cache(expires_at);

-- Skip unified_content view creation (requires existing tables)
-- The unified-feed-service.ts handles content aggregation in code

/*
-- UNIFIED CONTENT VIEW - Run this separately after all tables exist
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
*/

-- FEED INTERACTION EVENTS
CREATE TABLE IF NOT EXISTS feed_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  action TEXT NOT NULL,
  watch_duration_seconds INTEGER,
  watch_percentage NUMERIC(5, 2),
  position_in_feed INTEGER,
  feed_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_interactions_user ON feed_interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_interactions_session ON feed_interactions(session_id, created_at DESC);

-- SESSION STATE
CREATE TABLE IF NOT EXISTS feed_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT NOT NULL UNIQUE,
  boosted_games TEXT[] DEFAULT '{}',
  avoided_games TEXT[] DEFAULT '{}',
  boosted_creators TEXT[] DEFAULT '{}',
  avoided_creators TEXT[] DEFAULT '{}',
  clips_viewed INTEGER DEFAULT 0,
  clips_skipped INTEGER DEFAULT 0,
  live_viewed INTEGER DEFAULT 0,
  vods_viewed INTEGER DEFAULT 0,
  ads_viewed INTEGER DEFAULT 0,
  ads_clicked INTEGER DEFAULT 0,
  avg_watch_percentage NUMERIC(5, 2) DEFAULT 0,
  skip_rate NUMERIC(5, 2) DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_sessions_user ON feed_sessions(user_id);

-- RLS
ALTER TABLE feed_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_sessions ENABLE ROW LEVEL SECURITY;
