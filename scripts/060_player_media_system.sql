-- Player Media System
-- Turns players into content creators with clips, VODs, and highlights

-- ==========================================
-- 1. PLAYER MEDIA TABLE (Core Content)
-- ==========================================

CREATE TABLE IF NOT EXISTS player_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Content
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description TEXT CHECK (char_length(description) <= 2000),
  
  -- Type classification
  media_type TEXT NOT NULL CHECK (media_type IN ('clip', 'vod', 'highlight', 'full_match', 'tutorial')),
  
  -- Source handling
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'youtube', 'twitch', 'kick', 'external')),
  video_url TEXT,
  embed_url TEXT,
  storage_path TEXT,
  
  -- Media metadata
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  aspect_ratio TEXT DEFAULT '16:9',
  
  -- Context linking (at least one should be set for esports relevance)
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  match_id UUID REFERENCES tournament_matches(id) ON DELETE SET NULL,
  
  -- Visibility & Status
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private', 'followers_only')),
  moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
  rejection_reason TEXT,
  
  -- Engagement stats (denormalized for performance)
  view_count INTEGER DEFAULT 0,
  unique_view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  dislike_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  
  -- Trending
  trending_score NUMERIC(10,2) DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  featured_at TIMESTAMPTZ,
  
  -- Moderation metadata
  is_flagged BOOLEAN DEFAULT false,
  flag_count INTEGER DEFAULT 0,
  auto_moderation_score NUMERIC(5,2),
  auto_moderation_labels JSONB DEFAULT '[]',
  moderated_by UUID REFERENCES profiles(id),
  moderated_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_player_media_player ON player_media(player_id);
CREATE INDEX IF NOT EXISTS idx_player_media_type ON player_media(media_type);
CREATE INDEX IF NOT EXISTS idx_player_media_game ON player_media(game_id);
CREATE INDEX IF NOT EXISTS idx_player_media_tournament ON player_media(tournament_id);
CREATE INDEX IF NOT EXISTS idx_player_media_match ON player_media(match_id);
CREATE INDEX IF NOT EXISTS idx_player_media_status ON player_media(moderation_status);
CREATE INDEX IF NOT EXISTS idx_player_media_trending ON player_media(trending_score DESC) WHERE visibility = 'public' AND moderation_status = 'approved';
CREATE INDEX IF NOT EXISTS idx_player_media_recent ON player_media(created_at DESC) WHERE visibility = 'public' AND moderation_status = 'approved';

-- ==========================================
-- 2. MEDIA REACTIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS media_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike', 'fire', 'shocked', 'clap', 'sad', 'laugh', 'pog', 'gg')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(media_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_media_reactions_media ON media_reactions(media_id);
CREATE INDEX IF NOT EXISTS idx_media_reactions_user ON media_reactions(user_id);

-- ==========================================
-- 3. MEDIA COMMENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS media_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES media_comments(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  
  -- Engagement
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  
  -- Moderation
  is_deleted BOOLEAN DEFAULT false,
  is_flagged BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_comments_media ON media_comments(media_id);
CREATE INDEX IF NOT EXISTS idx_media_comments_user ON media_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_media_comments_parent ON media_comments(parent_id);

-- ==========================================
-- 4. MEDIA VIEWS (for unique view tracking)
-- ==========================================

CREATE TABLE IF NOT EXISTS media_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  watch_duration_seconds INTEGER DEFAULT 0,
  watch_percentage NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(media_id, user_id) -- One view per user per media
);

CREATE INDEX IF NOT EXISTS idx_media_views_media ON media_views(media_id);

-- ==========================================
-- 5. MEDIA REPORTS (Moderation)
-- ==========================================

CREATE TABLE IF NOT EXISTS media_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  reason TEXT NOT NULL CHECK (reason IN (
    'spam', 'harassment', 'hate_speech', 'violence', 'nudity', 
    'misinformation', 'copyright', 'not_esports', 'other'
  )),
  details TEXT CHECK (char_length(details) <= 500),
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(media_id, reporter_id) -- One report per user per media
);

CREATE INDEX IF NOT EXISTS idx_media_reports_media ON media_reports(media_id);
CREATE INDEX IF NOT EXISTS idx_media_reports_status ON media_reports(status);

-- ==========================================
-- 6. ALLOWED EMBED DOMAINS (Security)
-- ==========================================

CREATE TABLE IF NOT EXISTS allowed_embed_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  platform_name TEXT NOT NULL,
  embed_pattern TEXT, -- regex pattern for embed URL validation
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert allowed platforms
INSERT INTO allowed_embed_domains (domain, platform_name, embed_pattern) VALUES
  ('youtube.com', 'YouTube', '^https://(www\.)?youtube\.com/(watch|embed)'),
  ('youtu.be', 'YouTube', '^https://youtu\.be/'),
  ('twitch.tv', 'Twitch', '^https://(www\.|clips\.)?twitch\.tv/'),
  ('kick.com', 'Kick', '^https://(www\.)?kick\.com/')
ON CONFLICT (domain) DO NOTHING;

-- ==========================================
-- 7. CONTENT GUIDELINES
-- ==========================================

CREATE TABLE IF NOT EXISTS content_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  rule TEXT NOT NULL,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'violation', 'ban')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert base guidelines
INSERT INTO content_guidelines (category, rule, severity) VALUES
  ('content', 'All media must be related to gaming/esports', 'violation'),
  ('content', 'No nudity or sexually explicit content', 'ban'),
  ('content', 'No hate speech or discrimination', 'ban'),
  ('content', 'No excessive violence or gore', 'violation'),
  ('content', 'No spam or repetitive content', 'warning'),
  ('content', 'No copyright infringement', 'violation'),
  ('behavior', 'No harassment of other players', 'violation'),
  ('behavior', 'No doxxing or personal information sharing', 'ban')
ON CONFLICT DO NOTHING;

-- ==========================================
-- 8. USER CONTENT TRUST SCORE
-- ==========================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS content_trust_score NUMERIC(5,2) DEFAULT 100;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_uploads INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_uploads INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rejected_uploads INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_content_banned BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS content_ban_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS content_ban_until TIMESTAMPTZ;

-- ==========================================
-- 9. RLS POLICIES
-- ==========================================

ALTER TABLE player_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_embed_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_guidelines ENABLE ROW LEVEL SECURITY;

-- Player media policies
CREATE POLICY "Anyone can view approved public media" ON player_media 
  FOR SELECT USING (
    visibility = 'public' AND moderation_status = 'approved'
    OR player_id = auth.uid()
    OR EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
  );

CREATE POLICY "Users can create own media" ON player_media 
  FOR INSERT WITH CHECK (player_id = auth.uid());

CREATE POLICY "Users can update own media" ON player_media 
  FOR UPDATE USING (player_id = auth.uid());

CREATE POLICY "Users can delete own media" ON player_media 
  FOR DELETE USING (player_id = auth.uid());

-- Reactions policies
CREATE POLICY "Anyone can view reactions" ON media_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can react" ON media_reactions 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can remove own reactions" ON media_reactions 
  FOR DELETE USING (user_id = auth.uid());

-- Comments policies
CREATE POLICY "Anyone can view non-deleted comments" ON media_comments 
  FOR SELECT USING (is_deleted = false);
CREATE POLICY "Authenticated users can comment" ON media_comments 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own comments" ON media_comments 
  FOR UPDATE USING (user_id = auth.uid());

-- Views policies
CREATE POLICY "System can track views" ON media_views FOR ALL USING (true);

-- Reports policies
CREATE POLICY "Authenticated users can report" ON media_reports 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view own reports" ON media_reports 
  FOR SELECT USING (reporter_id = auth.uid());

-- Config table policies
CREATE POLICY "Anyone can view embed domains" ON allowed_embed_domains FOR SELECT USING (true);
CREATE POLICY "Anyone can view guidelines" ON content_guidelines FOR SELECT USING (true);

-- ==========================================
-- 10. HELPER FUNCTIONS
-- ==========================================

-- Update media stats
CREATE OR REPLACE FUNCTION update_media_stats(p_media_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE player_media SET
    like_count = (SELECT COUNT(*) FROM media_reactions WHERE media_id = p_media_id AND reaction_type = 'like'),
    dislike_count = (SELECT COUNT(*) FROM media_reactions WHERE media_id = p_media_id AND reaction_type = 'dislike'),
    comment_count = (SELECT COUNT(*) FROM media_comments WHERE media_id = p_media_id AND is_deleted = false),
    view_count = (SELECT COUNT(*) FROM media_views WHERE media_id = p_media_id),
    unique_view_count = (SELECT COUNT(DISTINCT COALESCE(user_id::text, session_id)) FROM media_views WHERE media_id = p_media_id),
    updated_at = NOW()
  WHERE id = p_media_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate trending score
CREATE OR REPLACE FUNCTION calculate_media_trending_score(p_media_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_views INTEGER;
  v_reactions INTEGER;
  v_comments INTEGER;
  v_age_hours NUMERIC;
  v_score NUMERIC;
BEGIN
  SELECT view_count, like_count, comment_count INTO v_views, v_reactions, v_comments
  FROM player_media WHERE id = p_media_id;
  
  v_age_hours := EXTRACT(EPOCH FROM (NOW() - (SELECT created_at FROM player_media WHERE id = p_media_id))) / 3600;
  
  -- Trending formula: engagement weighted by recency
  v_score := (
    (COALESCE(v_views, 0) * 0.3) +
    (COALESCE(v_reactions, 0) * 0.4) +
    (COALESCE(v_comments, 0) * 0.3)
  ) / POWER(GREATEST(v_age_hours, 1), 0.5);
  
  UPDATE player_media SET trending_score = v_score WHERE id = p_media_id;
  
  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-moderate content (basic URL validation)
CREATE OR REPLACE FUNCTION validate_media_url(p_url TEXT, p_source_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_domain TEXT;
  v_allowed BOOLEAN;
BEGIN
  IF p_source_type = 'upload' THEN
    RETURN true;
  END IF;
  
  -- Extract domain from URL
  v_domain := substring(p_url from 'https?://([^/]+)');
  
  -- Check against allowed domains
  SELECT EXISTS(
    SELECT 1 FROM allowed_embed_domains 
    WHERE is_active = true 
    AND (v_domain LIKE '%' || domain OR domain LIKE '%' || v_domain)
  ) INTO v_allowed;
  
  RETURN v_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 11. TRIGGERS
-- ==========================================

-- Update stats on reaction
CREATE OR REPLACE FUNCTION trigger_update_media_stats_on_reaction()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_media_stats(OLD.media_id);
    RETURN OLD;
  ELSE
    PERFORM update_media_stats(NEW.media_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_media_reaction_stats ON media_reactions;
CREATE TRIGGER trigger_media_reaction_stats
  AFTER INSERT OR DELETE ON media_reactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_media_stats_on_reaction();

-- Update stats on comment
CREATE OR REPLACE FUNCTION trigger_update_media_stats_on_comment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_media_stats(OLD.media_id);
    RETURN OLD;
  ELSE
    PERFORM update_media_stats(NEW.media_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_media_comment_stats ON media_comments;
CREATE TRIGGER trigger_media_comment_stats
  AFTER INSERT OR UPDATE OR DELETE ON media_comments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_media_stats_on_comment();

-- Auto-flag on reports threshold
CREATE OR REPLACE FUNCTION trigger_auto_flag_media()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE player_media 
  SET 
    is_flagged = true,
    flag_count = flag_count + 1,
    moderation_status = CASE WHEN flag_count >= 3 THEN 'flagged' ELSE moderation_status END
  WHERE id = NEW.media_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_media_report_flag ON media_reports;
CREATE TRIGGER trigger_media_report_flag
  AFTER INSERT ON media_reports
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_flag_media();

-- ==========================================
-- 12. ENABLE REALTIME
-- ==========================================

ALTER PUBLICATION supabase_realtime ADD TABLE media_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE media_reactions;
