-- ═══════════════════════════════════════════════════════════════════════════════
-- CLIP JOBS TABLE & AUTO-CLIP INFRASTRUCTURE
-- Supports: Auto highlight detection, clip generation pipeline, feed distribution
-- ═══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════
-- CLIP JOBS TABLE
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS clip_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 50,
  
  -- Highlight metadata
  highlight_type TEXT CHECK (highlight_type IN ('score_change', 'momentum_shift', 'clutch_moment', 'reaction_spike', 'manual')),
  highlight_score NUMERIC DEFAULT 0,
  context JSONB DEFAULT '{}',
  
  -- Output
  output_url TEXT,
  thumbnail_url TEXT,
  clip_id UUID, -- Reference to created clip in player_media
  error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  -- Index for efficient querying
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Indexes for efficient job processing
CREATE INDEX IF NOT EXISTS idx_clip_jobs_status ON clip_jobs(status);
CREATE INDEX IF NOT EXISTS idx_clip_jobs_pending ON clip_jobs(status, priority DESC, created_at ASC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_clip_jobs_match ON clip_jobs(match_id);

-- ══════════════════════════════════════════
-- MEDIA VIEW EVENTS TABLE (for retention tracking)
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS media_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL,
  user_id UUID,
  session_id TEXT,
  
  -- Watch metrics
  watch_time_seconds FLOAT DEFAULT 0,
  total_duration FLOAT,
  percent_watched FLOAT,
  completed BOOLEAN DEFAULT false,
  is_replay BOOLEAN DEFAULT false,
  
  -- Context
  source TEXT, -- 'feed', 'profile', 'search', etc.
  position_in_feed INTEGER,
  
  -- Device info
  device_type TEXT,
  platform TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_view_events_media ON media_view_events(media_id);
CREATE INDEX IF NOT EXISTS idx_media_view_events_user ON media_view_events(user_id);
CREATE INDEX IF NOT EXISTS idx_media_view_events_created ON media_view_events(created_at);

-- ══════════════════════════════════════════
-- ADD COLUMNS TO PLAYER_MEDIA FOR AUTO-CLIPS
-- ══════════════════════════════════════════

DO $$ 
BEGIN
  -- Auto-generation tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'auto_generated') THEN
    ALTER TABLE player_media ADD COLUMN auto_generated BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'is_highlight') THEN
    ALTER TABLE player_media ADD COLUMN is_highlight BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'highlight_type') THEN
    ALTER TABLE player_media ADD COLUMN highlight_type TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'highlight_score') THEN
    ALTER TABLE player_media ADD COLUMN highlight_score NUMERIC DEFAULT 0;
  END IF;
  
  -- Ranking columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'trending_score') THEN
    ALTER TABLE player_media ADD COLUMN trending_score NUMERIC DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'momentum_score') THEN
    ALTER TABLE player_media ADD COLUMN momentum_score NUMERIC DEFAULT 0;
  END IF;
  
  -- Match reference for clips
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'match_id') THEN
    ALTER TABLE player_media ADD COLUMN match_id UUID REFERENCES matches(id) ON DELETE SET NULL;
  END IF;
  
  -- Engagement metrics for ranking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'save_count') THEN
    ALTER TABLE player_media ADD COLUMN save_count INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'completion_rate') THEN
    ALTER TABLE player_media ADD COLUMN completion_rate NUMERIC DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'avg_watch_percentage') THEN
    ALTER TABLE player_media ADD COLUMN avg_watch_percentage NUMERIC DEFAULT 0;
  END IF;
END $$;

-- Index for auto-generated clips
CREATE INDEX IF NOT EXISTS idx_player_media_auto ON player_media(auto_generated) WHERE auto_generated = true;
CREATE INDEX IF NOT EXISTS idx_player_media_highlight ON player_media(is_highlight) WHERE is_highlight = true;
CREATE INDEX IF NOT EXISTS idx_player_media_trending ON player_media(trending_score DESC);

-- ══════════════════════════════════════════
-- MATCH EVENTS TABLE (for highlight detection)
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  timestamp FLOAT NOT NULL, -- Seconds from match start
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_match_events_type ON match_events(type);

-- ══════════════════════════════════════════
-- FUNCTION: Update media metrics after view events
-- ══════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_media_metrics_from_view()
RETURNS TRIGGER AS $$
BEGIN
  -- Update aggregate metrics on the media item
  UPDATE player_media
  SET 
    view_count = view_count + 1,
    avg_watch_percentage = (
      SELECT COALESCE(AVG(percent_watched), 0)
      FROM media_view_events
      WHERE media_id = NEW.media_id
    ),
    completion_rate = (
      SELECT COALESCE(
        (COUNT(*) FILTER (WHERE completed = true)::FLOAT / NULLIF(COUNT(*), 0)) * 100,
        0
      )
      FROM media_view_events
      WHERE media_id = NEW.media_id
    ),
    updated_at = NOW()
  WHERE id = NEW.media_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update metrics on view
DROP TRIGGER IF EXISTS trigger_update_media_metrics ON media_view_events;
CREATE TRIGGER trigger_update_media_metrics
AFTER INSERT ON media_view_events
FOR EACH ROW
EXECUTE FUNCTION update_media_metrics_from_view();

-- ══════════════════════════════════════════
-- FUNCTION: Calculate trending score
-- ══════════════════════════════════════════

CREATE OR REPLACE FUNCTION calculate_trending_score(p_media_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_views_24h INTEGER;
  v_engagement_24h INTEGER;
  v_total_views INTEGER;
  v_age_hours FLOAT;
  v_score NUMERIC;
BEGIN
  -- Get views in last 24 hours
  SELECT COUNT(*) INTO v_views_24h
  FROM media_view_events
  WHERE media_id = p_media_id
    AND created_at > NOW() - INTERVAL '24 hours';
  
  -- Get total views
  SELECT view_count INTO v_total_views
  FROM player_media
  WHERE id = p_media_id;
  
  -- Get engagement in last 24 hours
  SELECT (like_count + comment_count + share_count) INTO v_engagement_24h
  FROM player_media
  WHERE id = p_media_id;
  
  -- Calculate age in hours
  SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 INTO v_age_hours
  FROM player_media
  WHERE id = p_media_id;
  
  -- Trending formula: recent views * engagement * time decay
  v_score := (v_views_24h * 0.5 + v_engagement_24h * 0.3) * 
             POWER(0.95, GREATEST(v_age_hours - 24, 0) / 24);
  
  RETURN COALESCE(v_score, 0);
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════
-- RLS POLICIES
-- ══════════════════════════════════════════

ALTER TABLE clip_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_view_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

-- Clip jobs: Only admins can manage
CREATE POLICY "Admins can manage clip jobs"
ON clip_jobs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Allow service role to manage clip jobs
CREATE POLICY "Service role can manage clip jobs"
ON clip_jobs FOR ALL
TO service_role
USING (true);

-- Media view events: Anyone can create, users can see their own
CREATE POLICY "Anyone can create view events"
ON media_view_events FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can see their own view events"
ON media_view_events FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);

-- Match events: Anyone can read, system can write
CREATE POLICY "Anyone can read match events"
ON match_events FOR SELECT
USING (true);

CREATE POLICY "Service role can manage match events"
ON match_events FOR ALL
TO service_role
USING (true);
