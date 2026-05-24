-- ============================================================================
-- ANALYTICS TABLES WITH RLS FOR REAL DATA
-- ============================================================================

-- ANALYTICS EVENTS TABLE
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(server_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_target ON analytics_events(target_type, target_id);

-- REALTIME METRICS TABLE (for time-bucketed aggregations)
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

-- CONTENT INTERACTIONS TABLE
CREATE TABLE IF NOT EXISTS content_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- USER EVENTS TABLE (for ML/personalization)
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

-- RLS POLICIES
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- Analytics events: Anyone can insert (for tracking), admins can read all
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON analytics_events;
CREATE POLICY "Anyone can insert analytics events" ON analytics_events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all analytics" ON analytics_events;
CREATE POLICY "Admins can view all analytics" ON analytics_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager'))
);

-- Realtime metrics: Admins can read, system can write
DROP POLICY IF EXISTS "Admins can view realtime metrics" ON realtime_metrics;
CREATE POLICY "Admins can view realtime metrics" ON realtime_metrics FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager'))
);

DROP POLICY IF EXISTS "System can manage realtime metrics" ON realtime_metrics;
CREATE POLICY "System can manage realtime metrics" ON realtime_metrics FOR ALL USING (true);

-- Content interactions: Users can see own, admins can see all
DROP POLICY IF EXISTS "Users can view own interactions" ON content_interactions;
CREATE POLICY "Users can view own interactions" ON content_interactions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own interactions" ON content_interactions;
CREATE POLICY "Users can insert own interactions" ON content_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all interactions" ON content_interactions;
CREATE POLICY "Admins can view all interactions" ON content_interactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager'))
);

-- User events: Users can see own, admins can see all
DROP POLICY IF EXISTS "Users can manage own events" ON user_events;
CREATE POLICY "Users can manage own events" ON user_events FOR ALL USING (auth.uid()::TEXT = user_id::TEXT);

-- FUNCTION: Atomic update for realtime metrics
CREATE OR REPLACE FUNCTION update_realtime_metric(
  p_metric_type TEXT,
  p_entity_id TEXT,
  p_granularity TEXT DEFAULT 'hour',
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
  CASE p_granularity
    WHEN 'minute' THEN v_time_bucket := DATE_TRUNC('minute', NOW());
    WHEN 'hour' THEN v_time_bucket := DATE_TRUNC('hour', NOW());
    WHEN 'day' THEN v_time_bucket := DATE_TRUNC('day', NOW());
    ELSE v_time_bucket := DATE_TRUNC('hour', NOW());
  END CASE;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;
