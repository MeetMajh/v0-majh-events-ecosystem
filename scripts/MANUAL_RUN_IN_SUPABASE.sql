-- =====================================================
-- PLAYER MEDIA SYSTEM - COMPLETE SETUP
-- =====================================================
-- Run this SQL in your Supabase Dashboard SQL Editor
-- Go to: https://supabase.com/dashboard > Your Project > SQL Editor
-- Copy and paste this entire file, then click "Run"
-- =====================================================

-- 1. PLAYER_MEDIA TABLE (Core table for clips, VODs, highlights)
CREATE TABLE IF NOT EXISTS player_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  media_type TEXT NOT NULL DEFAULT 'clip' CHECK (media_type IN ('clip', 'vod', 'highlight', 'full_match', 'tutorial')),
  source_type TEXT NOT NULL DEFAULT 'upload' CHECK (source_type IN ('upload', 'youtube', 'twitch', 'kick', 'external')),
  video_url TEXT,
  embed_url TEXT,
  storage_path TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private', 'followers_only')),
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  trending_score NUMERIC NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  flag_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add published_at column if table exists but column doesn't
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'player_media' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE player_media ADD COLUMN published_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. MEDIA_REACTIONS TABLE (Likes, dislikes, emotes)
CREATE TABLE IF NOT EXISTS media_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'like' CHECK (reaction_type IN ('like', 'dislike', 'fire', 'shocked', 'clap', 'sad', 'laugh', 'pog', 'gg')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(media_id, user_id, reaction_type)
);

-- 3. MEDIA_COMMENTS TABLE
CREATE TABLE IF NOT EXISTS media_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES media_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. MEDIA_VIEWS TABLE (For view tracking/analytics)
CREATE TABLE IF NOT EXISTS media_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ip_hash TEXT,
  watch_duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. MEDIA_REPORTS TABLE (For moderation)
CREATE TABLE IF NOT EXISTS media_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id)
);

-- 6. PLAYER_FOLLOWS TABLE (For following players)
CREATE TABLE IF NOT EXISTS player_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, player_id),
  CHECK (follower_id != player_id)
);

-- 7. ALLOWED_EMBED_DOMAINS TABLE (For URL validation)
CREATE TABLE IF NOT EXISTS allowed_embed_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default allowed domains
INSERT INTO allowed_embed_domains (domain, platform) VALUES
  ('youtube.com', 'youtube'),
  ('youtu.be', 'youtube'),
  ('twitch.tv', 'twitch'),
  ('clips.twitch.tv', 'twitch'),
  ('kick.com', 'kick')
ON CONFLICT (domain) DO NOTHING;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_player_media_player ON player_media(player_id);
CREATE INDEX IF NOT EXISTS idx_player_media_game ON player_media(game_id);
CREATE INDEX IF NOT EXISTS idx_player_media_visibility ON player_media(visibility);
CREATE INDEX IF NOT EXISTS idx_player_media_moderation ON player_media(moderation_status);
CREATE INDEX IF NOT EXISTS idx_player_media_trending ON player_media(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_player_media_created ON player_media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_reactions_media ON media_reactions(media_id);
CREATE INDEX IF NOT EXISTS idx_media_comments_media ON media_comments(media_id);
CREATE INDEX IF NOT EXISTS idx_media_views_media ON media_views(media_id);
CREATE INDEX IF NOT EXISTS idx_player_follows_follower ON player_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_player_follows_player ON player_follows(player_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE player_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_follows ENABLE ROW LEVEL SECURITY;

-- player_media policies
DROP POLICY IF EXISTS "Public media is viewable by everyone" ON player_media;
CREATE POLICY "Public media is viewable by everyone" ON player_media
  FOR SELECT USING (visibility = 'public' AND moderation_status = 'approved');

DROP POLICY IF EXISTS "Users can view their own media" ON player_media;
CREATE POLICY "Users can view their own media" ON player_media
  FOR SELECT USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can insert their own media" ON player_media;
CREATE POLICY "Users can insert their own media" ON player_media
  FOR INSERT WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can update their own media" ON player_media;
CREATE POLICY "Users can update their own media" ON player_media
  FOR UPDATE USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can delete their own media" ON player_media;
CREATE POLICY "Users can delete their own media" ON player_media
  FOR DELETE USING (auth.uid() = player_id);

-- media_reactions policies
DROP POLICY IF EXISTS "Reactions are viewable by everyone" ON media_reactions;
CREATE POLICY "Reactions are viewable by everyone" ON media_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own reactions" ON media_reactions;
CREATE POLICY "Users can manage their own reactions" ON media_reactions
  FOR ALL USING (auth.uid() = user_id);

-- media_comments policies
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON media_comments;
CREATE POLICY "Comments are viewable by everyone" ON media_comments
  FOR SELECT USING (is_hidden = false);

DROP POLICY IF EXISTS "Users can create comments" ON media_comments;
CREATE POLICY "Users can create comments" ON media_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON media_comments;
CREATE POLICY "Users can delete their own comments" ON media_comments
  FOR DELETE USING (auth.uid() = user_id);

-- media_views policies
DROP POLICY IF EXISTS "Views can be inserted by anyone" ON media_views;
CREATE POLICY "Views can be inserted by anyone" ON media_views
  FOR INSERT WITH CHECK (true);

-- media_reports policies
DROP POLICY IF EXISTS "Users can create reports" ON media_reports;
CREATE POLICY "Users can create reports" ON media_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- player_follows policies
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON player_follows;
CREATE POLICY "Follows are viewable by everyone" ON player_follows
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own follows" ON player_follows;
CREATE POLICY "Users can manage their own follows" ON player_follows
  FOR ALL USING (auth.uid() = follower_id);

-- =====================================================
-- HELPER FUNCTION: Update media stats
-- =====================================================

CREATE OR REPLACE FUNCTION update_media_stats(p_media_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE player_media
  SET 
    like_count = (SELECT COUNT(*) FROM media_reactions WHERE media_id = p_media_id AND reaction_type = 'like'),
    comment_count = (SELECT COUNT(*) FROM media_comments WHERE media_id = p_media_id AND is_hidden = false),
    view_count = (SELECT COUNT(*) FROM media_views WHERE media_id = p_media_id),
    updated_at = now()
  WHERE id = p_media_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CB_STAFF_SHIFTS - Add location column
-- =====================================================

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cb_staff_shifts') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'cb_staff_shifts' AND column_name = 'location'
    ) THEN
      ALTER TABLE cb_staff_shifts ADD COLUMN location TEXT;
    END IF;
  END IF;
END $$;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
SELECT 'Player Media System setup complete!' AS status;
