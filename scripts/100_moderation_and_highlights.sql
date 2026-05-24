-- =============================================
-- MODERATION SYSTEM TABLES
-- =============================================

-- Moderation reports (user-submitted reports)
CREATE TABLE IF NOT EXISTS moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('clip', 'chat', 'comment', 'profile', 'stream')),
  content_id UUID NOT NULL,
  content_url TEXT,
  message TEXT,
  reason TEXT NOT NULL CHECK (reason IN (
    'inappropriate', 'spam', 'harassment', 'hate_speech', 
    'violence', 'copyright', 'misinformation', 'other'
  )),
  additional_info TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Moderation actions taken
CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES moderation_reports(id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'approve', 'remove', 'warn', 'mute', 'ban', 
    'shadow_ban', 'restrict', 'dismiss', 'escalate'
  )),
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'content', 'comment')),
  reason TEXT,
  duration_hours INTEGER, -- For temporary actions (mute, ban)
  expires_at TIMESTAMPTZ,
  notes TEXT,
  automated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Moderation logs (audit trail)
CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID,
  user_id UUID,
  moderator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  result JSONB,
  action_taken TEXT,
  automated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User restrictions/bans
CREATE TABLE IF NOT EXISTS user_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL CHECK (restriction_type IN (
    'muted', 'banned', 'shadow_banned', 'restricted', 'upload_disabled'
  )),
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AI HIGHLIGHT SYSTEM TABLES
-- =============================================

-- Highlight candidates (auto-detected moments)
CREATE TABLE IF NOT EXISTS highlight_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL,
  tournament_id UUID,
  start_time INTEGER NOT NULL, -- milliseconds from stream start
  end_time INTEGER NOT NULL,
  duration INTEGER GENERATED ALWAYS AS (end_time - start_time) STORED,
  reason TEXT NOT NULL CHECK (reason IN (
    'high_engagement', 'score_change', 'reaction_spike', 
    'chat_spike', 'game_end', 'clutch_moment', 'manual'
  )),
  score NUMERIC(5,2) DEFAULT 0, -- 0-100 highlight quality score
  engagement_metrics JSONB DEFAULT '{}',
  -- Metrics captured at the moment
  reaction_count INTEGER DEFAULT 0,
  chat_rate NUMERIC(5,2) DEFAULT 0, -- messages per second
  viewer_count INTEGER DEFAULT 0,
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'rejected', 'archived')),
  clip_id UUID, -- Link to generated clip if published
  thumbnail_url TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match engagement events (for real-time detection)
CREATE TABLE IF NOT EXISTS match_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'reaction', 'chat', 'viewer_join', 'viewer_leave',
    'score_update', 'game_start', 'game_end', 'timeout'
  )),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reaction aggregates (for faster queries)
CREATE TABLE IF NOT EXISTS reaction_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL,
  time_bucket TIMESTAMPTZ NOT NULL, -- 10-second buckets
  reaction_type TEXT,
  count INTEGER DEFAULT 0,
  UNIQUE(match_id, time_bucket, reaction_type)
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_moderation_reports_status ON moderation_reports(status);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_content ON moderation_reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_created ON moderation_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_report ON moderation_actions(report_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target ON moderation_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_user ON user_restrictions(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_highlight_candidates_match ON highlight_candidates(match_id);
CREATE INDEX IF NOT EXISTS idx_highlight_candidates_status ON highlight_candidates(status);
CREATE INDEX IF NOT EXISTS idx_highlight_candidates_score ON highlight_candidates(score DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_match_engagement_events_match ON match_engagement_events(match_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reaction_aggregates_match ON reaction_aggregates(match_id, time_bucket DESC);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE moderation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlight_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reaction_aggregates ENABLE ROW LEVEL SECURITY;

-- Allow staff to view/manage all moderation data
CREATE POLICY "Staff can manage moderation reports" ON moderation_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'moderator', 'staff')
    )
  );

-- Users can create reports
CREATE POLICY "Users can create reports" ON moderation_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON moderation_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Staff can manage all moderation actions
CREATE POLICY "Staff can manage moderation actions" ON moderation_actions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'moderator', 'staff')
    )
  );

-- Staff can view logs
CREATE POLICY "Staff can view moderation logs" ON moderation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'moderator', 'staff')
    )
  );

-- Staff can manage user restrictions
CREATE POLICY "Staff can manage user restrictions" ON user_restrictions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'moderator', 'staff')
    )
  );

-- Staff can manage highlight candidates
CREATE POLICY "Staff can manage highlights" ON highlight_candidates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'moderator', 'staff')
    )
  );

-- Public read access for engagement events (used by real-time viewers)
CREATE POLICY "Anyone can view engagement events" ON match_engagement_events
  FOR SELECT USING (TRUE);

-- Service role can insert engagement events
CREATE POLICY "Service can insert engagement events" ON match_engagement_events
  FOR INSERT WITH CHECK (TRUE);

-- Public read for reaction aggregates
CREATE POLICY "Anyone can view reaction aggregates" ON reaction_aggregates
  FOR SELECT USING (TRUE);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to get pending moderation count
CREATE OR REPLACE FUNCTION get_pending_moderation_count()
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM moderation_reports WHERE status = 'pending';
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to check if user is restricted
CREATE OR REPLACE FUNCTION is_user_restricted(user_uuid UUID, restriction TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_restrictions
    WHERE user_id = user_uuid
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (restriction IS NULL OR restriction_type = restriction)
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to aggregate reactions into time buckets
CREATE OR REPLACE FUNCTION aggregate_reactions(p_match_id UUID, p_reaction_type TEXT)
RETURNS VOID AS $$
DECLARE
  bucket_size INTERVAL := '10 seconds';
BEGIN
  INSERT INTO reaction_aggregates (match_id, time_bucket, reaction_type, count)
  SELECT 
    p_match_id,
    date_trunc('minute', timestamp) + 
      (EXTRACT(SECOND FROM timestamp)::INTEGER / 10) * INTERVAL '10 seconds',
    p_reaction_type,
    COUNT(*)
  FROM match_engagement_events
  WHERE match_id = p_match_id
    AND event_type = 'reaction'
    AND (data->>'type')::TEXT = p_reaction_type
  GROUP BY 1, 2, 3
  ON CONFLICT (match_id, time_bucket, reaction_type)
  DO UPDATE SET count = EXCLUDED.count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect highlight candidates based on engagement spikes
CREATE OR REPLACE FUNCTION detect_highlight_candidate(
  p_match_id UUID,
  p_timestamp INTEGER,
  p_reason TEXT,
  p_metrics JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  candidate_id UUID;
  highlight_score NUMERIC;
  reaction_cnt INTEGER;
  chat_spd NUMERIC;
BEGIN
  -- Calculate score based on metrics
  reaction_cnt := COALESCE((p_metrics->>'reaction_count')::INTEGER, 0);
  chat_spd := COALESCE((p_metrics->>'chat_rate')::NUMERIC, 0);
  
  highlight_score := 0;
  
  -- Score based on reactions (max 40 points)
  highlight_score := highlight_score + LEAST(reaction_cnt * 4, 40);
  
  -- Score based on chat rate (max 30 points)
  highlight_score := highlight_score + LEAST(chat_spd * 2, 30);
  
  -- Bonus for specific reasons
  IF p_reason = 'score_change' THEN
    highlight_score := highlight_score + 20;
  ELSIF p_reason = 'game_end' THEN
    highlight_score := highlight_score + 15;
  ELSIF p_reason = 'clutch_moment' THEN
    highlight_score := highlight_score + 25;
  END IF;
  
  -- Only create candidate if score is high enough
  IF highlight_score >= 50 THEN
    INSERT INTO highlight_candidates (
      match_id,
      start_time,
      end_time,
      reason,
      score,
      engagement_metrics,
      reaction_count,
      chat_rate,
      viewer_count
    ) VALUES (
      p_match_id,
      p_timestamp - 10000, -- 10 seconds before
      p_timestamp + 5000,  -- 5 seconds after
      p_reason,
      highlight_score,
      p_metrics,
      reaction_cnt,
      chat_spd,
      COALESCE((p_metrics->>'viewer_count')::INTEGER, 0)
    )
    RETURNING id INTO candidate_id;
    
    RETURN candidate_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
