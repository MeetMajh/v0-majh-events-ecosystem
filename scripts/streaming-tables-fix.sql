-- ============================================================================
-- STREAMING TABLES FIX
-- Creates or updates all necessary tables for streaming functionality
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. USER_STREAMS table (for Go Live functionality)
CREATE TABLE IF NOT EXISTS user_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  game_id UUID,
  stream_key TEXT UNIQUE NOT NULL,
  rtmp_url TEXT NOT NULL,
  playback_url TEXT,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'live', 'ended')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  peak_viewers INT DEFAULT 0,
  total_views INT DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  allow_chat BOOLEAN DEFAULT TRUE,
  allow_clips BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_streams_user ON user_streams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streams_status ON user_streams(status);
CREATE INDEX IF NOT EXISTS idx_user_streams_key ON user_streams(stream_key);

-- 2. STREAM_SOURCES table (for admin stream sources management)
CREATE TABLE IF NOT EXISTS stream_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('twitch', 'youtube', 'kick', 'custom')),
  channel_url TEXT NOT NULL,
  embed_url TEXT,
  channel_id TEXT,
  game_id UUID,
  category TEXT NOT NULL DEFAULT 'community' CHECK (category IN ('top_streamer', 'sponsored', 'organization', 'community')),
  tags TEXT[] DEFAULT '{}',
  source_type TEXT DEFAULT 'always' CHECK (source_type IN ('always', 'scheduled', 'live_only')),
  schedule_start TIMESTAMPTZ,
  schedule_end TIMESTAMPTZ,
  priority INT DEFAULT 50,
  is_active BOOLEAN DEFAULT TRUE,
  is_live BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  viewer_count INT DEFAULT 0,
  thumbnail_url TEXT,
  stream_title TEXT,
  last_live_at TIMESTAMPTZ,
  organization_id UUID,
  sponsor_id UUID,
  contact_email TEXT,
  added_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_sources_active ON stream_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_stream_sources_live ON stream_sources(is_live);
CREATE INDEX IF NOT EXISTS idx_stream_sources_platform ON stream_sources(platform);

-- 3. LIVESTREAMS table (for Live Hub page)
CREATE TABLE IF NOT EXISTS livestreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitch', 'youtube', 'kick', 'custom', 'majh')),
  embed_url TEXT NOT NULL,
  channel_name TEXT,
  is_live BOOLEAN DEFAULT FALSE,
  scheduled_at TIMESTAMPTZ,
  viewer_count INT DEFAULT 0,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PLAYER_MEDIA table (for media uploads)
CREATE TABLE IF NOT EXISTS player_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'clip')),
  category TEXT DEFAULT 'other',
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size BIGINT,
  mime_type TEXT,
  duration_seconds INT,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_media_player ON player_media(player_id);
CREATE INDEX IF NOT EXISTS idx_player_media_type ON player_media(media_type);
CREATE INDEX IF NOT EXISTS idx_player_media_visibility ON player_media(visibility);

-- 5. Enable RLS
ALTER TABLE user_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_media ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for user_streams
DROP POLICY IF EXISTS "Users can view their own streams" ON user_streams;
DROP POLICY IF EXISTS "Users can manage their own streams" ON user_streams;
DROP POLICY IF EXISTS "Public can view live streams" ON user_streams;

CREATE POLICY "Users can view their own streams" ON user_streams
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own streams" ON user_streams
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public can view live streams" ON user_streams
  FOR SELECT USING (status = 'live' AND is_public = TRUE);

-- 7. RLS Policies for stream_sources
DROP POLICY IF EXISTS "Anyone can view active stream sources" ON stream_sources;
DROP POLICY IF EXISTS "Admins can manage stream sources" ON stream_sources;

CREATE POLICY "Anyone can view active stream sources" ON stream_sources
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Authenticated can manage stream sources" ON stream_sources
  FOR ALL TO authenticated USING (true);

-- 8. RLS Policies for livestreams
DROP POLICY IF EXISTS "Anyone can view livestreams" ON livestreams;
DROP POLICY IF EXISTS "Authenticated can manage livestreams" ON livestreams;

CREATE POLICY "Anyone can view livestreams" ON livestreams
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can manage livestreams" ON livestreams
  FOR ALL TO authenticated USING (true);

-- 9. RLS Policies for player_media
DROP POLICY IF EXISTS "Users can view their own media" ON player_media;
DROP POLICY IF EXISTS "Users can manage their own media" ON player_media;
DROP POLICY IF EXISTS "Public can view public media" ON player_media;

CREATE POLICY "Users can view their own media" ON player_media
  FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "Users can manage their own media" ON player_media
  FOR ALL USING (auth.uid() = player_id);

CREATE POLICY "Public can view public media" ON player_media
  FOR SELECT USING (visibility = 'public');

-- 10. Create storage bucket for player media if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('player-media', 'player-media', true)
ON CONFLICT (id) DO NOTHING;

-- 11. Storage policies for player-media bucket
DROP POLICY IF EXISTS "Users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view public media" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their media" ON storage.objects;

CREATE POLICY "Users can upload media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view public media" ON storage.objects
  FOR SELECT USING (bucket_id = 'player-media');

CREATE POLICY "Users can manage their media" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'player-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 12. Grant permissions
GRANT SELECT ON user_streams TO anon, authenticated;
GRANT ALL ON user_streams TO authenticated;

GRANT SELECT ON stream_sources TO anon, authenticated;
GRANT ALL ON stream_sources TO authenticated;

GRANT SELECT ON livestreams TO anon, authenticated;
GRANT ALL ON livestreams TO authenticated;

GRANT SELECT ON player_media TO anon, authenticated;
GRANT ALL ON player_media TO authenticated;

-- 13. Verify tables exist
SELECT 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_streams') as user_streams_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'stream_sources') as stream_sources_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'livestreams') as livestreams_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'player_media') as player_media_exists;
