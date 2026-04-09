-- PLATFORM INTELLIGENCE SCHEMA
-- Cold Start, Onboarding, User Embeddings, Event Tracking

-- USER PREFERENCES (extended for onboarding)
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS games TEXT[] DEFAULT '{}';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS intents TEXT[] DEFAULT '{}';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS skill_level TEXT;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- USER EMBEDDINGS for ML ranking
CREATE TABLE IF NOT EXISTS user_embeddings (
  user_id UUID PRIMARY KEY,
  embedding DOUBLE PRECISION[] NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_embeddings_updated ON user_embeddings(updated_at DESC);

-- USER EVENTS for ML training
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_created ON user_events(created_at DESC);

-- PLAYER FOLLOWS
CREATE TABLE IF NOT EXISTS player_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  followed_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, followed_id)
);

CREATE INDEX IF NOT EXISTS idx_player_follows_follower ON player_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_player_follows_followed ON player_follows(followed_id);

-- ANALYTICS EVENTS (if not exists)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  user_id UUID,
  session_id TEXT,
  device_id TEXT,
  target_type TEXT,
  target_id UUID,
  properties JSONB DEFAULT '{}',
  platform TEXT,
  device_type TEXT,
  country TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  client_timestamp TIMESTAMPTZ,
  server_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(server_timestamp DESC);

-- REALTIME METRICS (if not exists)
CREATE TABLE IF NOT EXISTS realtime_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  granularity TEXT NOT NULL DEFAULT 'hour',
  time_bucket TIMESTAMPTZ NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  watch_time_seconds INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_type, entity_id, granularity, time_bucket)
);

CREATE INDEX IF NOT EXISTS idx_realtime_metrics_lookup ON realtime_metrics(metric_type, entity_id, time_bucket);

-- CONTENT INTERACTIONS (if not exists)
CREATE TABLE IF NOT EXISTS content_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  interaction_type TEXT NOT NULL,
  watch_time_seconds INTEGER,
  watch_percentage NUMERIC,
  completed BOOLEAN DEFAULT false,
  source TEXT,
  position_in_feed INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_interactions_user ON content_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_content ON content_interactions(content_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_type ON content_interactions(interaction_type);

-- FUNCTION: Get user engagement stats
CREATE OR REPLACE FUNCTION get_user_engagement_stats(p_user_id UUID)
RETURNS TABLE (
  avg_watch_time NUMERIC,
  completion_rate NUMERIC,
  like_rate NUMERIC,
  comment_rate NUMERIC,
  share_rate NUMERIC,
  session_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(AVG(ci.watch_time_seconds), 0)::NUMERIC as avg_watch_time,
    COALESCE(AVG(CASE WHEN ci.completed THEN 1 ELSE 0 END), 0)::NUMERIC as completion_rate,
    COALESCE(
      SUM(CASE WHEN ci.interaction_type = 'like' THEN 1 ELSE 0 END)::NUMERIC /
      NULLIF(SUM(CASE WHEN ci.interaction_type = 'view' THEN 1 ELSE 0 END), 0),
      0
    ) as like_rate,
    COALESCE(
      SUM(CASE WHEN ci.interaction_type = 'comment' THEN 1 ELSE 0 END)::NUMERIC /
      NULLIF(SUM(CASE WHEN ci.interaction_type = 'view' THEN 1 ELSE 0 END), 0),
      0
    ) as comment_rate,
    COALESCE(
      SUM(CASE WHEN ci.interaction_type = 'share' THEN 1 ELSE 0 END)::NUMERIC /
      NULLIF(SUM(CASE WHEN ci.interaction_type = 'view' THEN 1 ELSE 0 END), 0),
      0
    ) as share_rate,
    COUNT(DISTINCT DATE_TRUNC('day', ci.created_at))::BIGINT as session_count
  FROM content_interactions ci
  WHERE ci.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- FUNCTION: Update realtime metric
CREATE OR REPLACE FUNCTION update_realtime_metric(
  p_metric_type TEXT,
  p_entity_id TEXT,
  p_granularity TEXT,
  p_views INTEGER DEFAULT 0,
  p_likes INTEGER DEFAULT 0,
  p_comments INTEGER DEFAULT 0,
  p_shares INTEGER DEFAULT 0,
  p_watch_time INTEGER DEFAULT 0,
  p_impressions INTEGER DEFAULT 0,
  p_clicks INTEGER DEFAULT 0,
  p_spend_cents INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
  v_time_bucket TIMESTAMPTZ;
BEGIN
  -- Determine time bucket based on granularity
  CASE p_granularity
    WHEN 'minute' THEN v_time_bucket := DATE_TRUNC('minute', NOW());
    WHEN 'hour' THEN v_time_bucket := DATE_TRUNC('hour', NOW());
    WHEN 'day' THEN v_time_bucket := DATE_TRUNC('day', NOW());
    ELSE v_time_bucket := DATE_TRUNC('hour', NOW());
  END CASE;

  -- Upsert the metric
  INSERT INTO realtime_metrics (
    metric_type, entity_id, granularity, time_bucket,
    views, likes, comments, shares, watch_time_seconds,
    impressions, clicks, spend_cents
  ) VALUES (
    p_metric_type, p_entity_id, p_granularity, v_time_bucket,
    p_views, p_likes, p_comments, p_shares, p_watch_time,
    p_impressions, p_clicks, p_spend_cents
  )
  ON CONFLICT (metric_type, entity_id, granularity, time_bucket)
  DO UPDATE SET
    views = realtime_metrics.views + EXCLUDED.views,
    likes = realtime_metrics.likes + EXCLUDED.likes,
    comments = realtime_metrics.comments + EXCLUDED.comments,
    shares = realtime_metrics.shares + EXCLUDED.shares,
    watch_time_seconds = realtime_metrics.watch_time_seconds + EXCLUDED.watch_time_seconds,
    impressions = realtime_metrics.impressions + EXCLUDED.impressions,
    clicks = realtime_metrics.clicks + EXCLUDED.clicks,
    spend_cents = realtime_metrics.spend_cents + EXCLUDED.spend_cents;
END;
$$ LANGUAGE plpgsql;

-- RLS POLICIES
ALTER TABLE user_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own embeddings
CREATE POLICY "Users can view own embeddings" ON user_embeddings
  FOR SELECT USING (user_id = auth.uid());

-- Users can view their own events
CREATE POLICY "Users can view own events" ON user_events
  FOR SELECT USING (user_id = auth.uid());

-- Users can manage their follows
CREATE POLICY "Users can view follows" ON player_follows
  FOR SELECT USING (follower_id = auth.uid() OR followed_id = auth.uid());

CREATE POLICY "Users can create follows" ON player_follows
  FOR INSERT WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can delete own follows" ON player_follows
  FOR DELETE USING (follower_id = auth.uid());

-- Users can view their own interactions
CREATE POLICY "Users can view own interactions" ON content_interactions
  FOR SELECT USING (user_id = auth.uid());

-- Service can insert analytics
CREATE POLICY "Service can insert analytics" ON analytics_events
  FOR INSERT WITH CHECK (true);
