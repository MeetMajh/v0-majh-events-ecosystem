-- Ensure Player Media System Tables Exist
-- Run this to verify/fix the media system schema

-- ==========================================
-- 1. PLAYER MEDIA TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS player_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  media_type TEXT NOT NULL DEFAULT 'clip',
  source_type TEXT NOT NULL DEFAULT 'external',
  video_url TEXT,
  embed_url TEXT,
  storage_path TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  aspect_ratio TEXT DEFAULT '16:9',
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  match_id UUID REFERENCES tournament_matches(id) ON DELETE SET NULL,
  visibility TEXT DEFAULT 'public',
  moderation_status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  view_count INTEGER DEFAULT 0,
  unique_view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  dislike_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  trending_score NUMERIC(10,2) DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  featured_at TIMESTAMPTZ,
  is_flagged BOOLEAN DEFAULT false,
  flag_count INTEGER DEFAULT 0,
  auto_moderation_score NUMERIC(5,2),
  auto_moderation_labels JSONB DEFAULT '[]',
  moderated_by UUID REFERENCES profiles(id),
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Add published_at if missing
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_player_media_player ON player_media(player_id);
CREATE INDEX IF NOT EXISTS idx_player_media_type ON player_media(media_type);
CREATE INDEX IF NOT EXISTS idx_player_media_game ON player_media(game_id);
CREATE INDEX IF NOT EXISTS idx_player_media_status ON player_media(moderation_status);
CREATE INDEX IF NOT EXISTS idx_player_media_trending ON player_media(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_player_media_recent ON player_media(created_at DESC);

-- ==========================================
-- 2. MEDIA REACTIONS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS media_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(media_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_media_reactions_media ON media_reactions(media_id);
CREATE INDEX IF NOT EXISTS idx_media_reactions_user ON media_reactions(user_id);

-- ==========================================
-- 3. MEDIA COMMENTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS media_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES media_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  is_flagged BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_comments_media ON media_comments(media_id);
CREATE INDEX IF NOT EXISTS idx_media_comments_user ON media_comments(user_id);

-- ==========================================
-- 4. MEDIA VIEWS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS media_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  watch_duration_seconds INTEGER DEFAULT 0,
  watch_percentage NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_views_media ON media_views(media_id);

-- ==========================================
-- 5. MEDIA REPORTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS media_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_reports_media ON media_reports(media_id);
CREATE INDEX IF NOT EXISTS idx_media_reports_status ON media_reports(status);

-- ==========================================
-- 6. PLAYER FOLLOWS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS player_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_follows_follower ON player_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_player_follows_player ON player_follows(player_id);

-- ==========================================
-- 7. ALLOWED EMBED DOMAINS
-- ==========================================

CREATE TABLE IF NOT EXISTS allowed_embed_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  platform_name TEXT NOT NULL,
  embed_pattern TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert allowed platforms
INSERT INTO allowed_embed_domains (domain, platform_name) VALUES
  ('youtube.com', 'YouTube'),
  ('youtu.be', 'YouTube'),
  ('twitch.tv', 'Twitch'),
  ('kick.com', 'Kick')
ON CONFLICT (domain) DO NOTHING;

-- ==========================================
-- 8. RLS POLICIES
-- ==========================================

ALTER TABLE player_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_embed_domains ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Anyone can view approved public media" ON player_media;
DROP POLICY IF EXISTS "Users can create own media" ON player_media;
DROP POLICY IF EXISTS "Users can update own media" ON player_media;
DROP POLICY IF EXISTS "Users can delete own media" ON player_media;

-- Player media policies
CREATE POLICY "Anyone can view approved public media" ON player_media 
  FOR SELECT USING (
    visibility = 'public' AND moderation_status = 'approved'
    OR player_id = auth.uid()
  );

CREATE POLICY "Users can create own media" ON player_media 
  FOR INSERT WITH CHECK (player_id = auth.uid());

CREATE POLICY "Users can update own media" ON player_media 
  FOR UPDATE USING (player_id = auth.uid());

CREATE POLICY "Users can delete own media" ON player_media 
  FOR DELETE USING (player_id = auth.uid());

-- Reactions policies
DROP POLICY IF EXISTS "Anyone can view reactions" ON media_reactions;
DROP POLICY IF EXISTS "Authenticated users can react" ON media_reactions;
DROP POLICY IF EXISTS "Users can remove own reactions" ON media_reactions;

CREATE POLICY "Anyone can view reactions" ON media_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can react" ON media_reactions 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can remove own reactions" ON media_reactions 
  FOR DELETE USING (user_id = auth.uid());

-- Comments policies
DROP POLICY IF EXISTS "Anyone can view non-deleted comments" ON media_comments;
DROP POLICY IF EXISTS "Authenticated users can comment" ON media_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON media_comments;

CREATE POLICY "Anyone can view non-deleted comments" ON media_comments 
  FOR SELECT USING (is_deleted = false);
CREATE POLICY "Authenticated users can comment" ON media_comments 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own comments" ON media_comments 
  FOR UPDATE USING (user_id = auth.uid());

-- Views policies
DROP POLICY IF EXISTS "System can track views" ON media_views;
CREATE POLICY "System can track views" ON media_views FOR ALL USING (true);

-- Reports policies
DROP POLICY IF EXISTS "Authenticated users can report" ON media_reports;
DROP POLICY IF EXISTS "Users can view own reports" ON media_reports;

CREATE POLICY "Authenticated users can report" ON media_reports 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view own reports" ON media_reports 
  FOR SELECT USING (reporter_id = auth.uid());

-- Follows policies
DROP POLICY IF EXISTS "Anyone can view follows" ON player_follows;
DROP POLICY IF EXISTS "Users can follow" ON player_follows;
DROP POLICY IF EXISTS "Users can unfollow" ON player_follows;

CREATE POLICY "Anyone can view follows" ON player_follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON player_follows 
  FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Users can unfollow" ON player_follows 
  FOR DELETE USING (follower_id = auth.uid());

-- Embed domains
DROP POLICY IF EXISTS "Anyone can view embed domains" ON allowed_embed_domains;
CREATE POLICY "Anyone can view embed domains" ON allowed_embed_domains FOR SELECT USING (true);

-- ==========================================
-- 9. HELPER FUNCTIONS
-- ==========================================

-- Update media stats function
CREATE OR REPLACE FUNCTION update_media_stats(p_media_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE player_media SET
    like_count = (SELECT COUNT(*) FROM media_reactions WHERE media_id = p_media_id AND reaction_type = 'like'),
    dislike_count = (SELECT COUNT(*) FROM media_reactions WHERE media_id = p_media_id AND reaction_type = 'dislike'),
    comment_count = (SELECT COUNT(*) FROM media_comments WHERE media_id = p_media_id AND is_deleted = false),
    view_count = (SELECT COUNT(*) FROM media_views WHERE media_id = p_media_id),
    updated_at = NOW()
  WHERE id = p_media_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 10. FIX CB_STAFF_SHIFTS (if exists)
-- ==========================================

ALTER TABLE cb_staff_shifts ADD COLUMN IF NOT EXISTS location TEXT;

-- ==========================================
-- 11. CREATE STORAGE BUCKET FOR MEDIA
-- ==========================================

-- Note: Storage bucket must be created via Supabase Dashboard or API
-- Bucket name: "player-media"
-- Public: true (for video streaming)
