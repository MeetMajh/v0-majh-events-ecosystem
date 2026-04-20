-- ============================================================================
-- COMPREHENSIVE RLS POLICIES FOR MAJH EVENTS STREAMING ECOSYSTEM
-- Run this after all tables are created to enable secure access
-- ============================================================================

-- First, ensure RLS is enabled on all relevant tables
ALTER TABLE stream_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================

-- Drop existing policies to recreate cleanly
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Anyone can view profiles (needed for displaying streamer info)
CREATE POLICY "Public profiles are viewable by everyone"
ON profiles FOR SELECT
TO public
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (for new signups)
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- STREAM_SESSIONS TABLE POLICIES (MAJH Studio)
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view public live streams" ON stream_sessions;
DROP POLICY IF EXISTS "Users can view own stream sessions" ON stream_sessions;
DROP POLICY IF EXISTS "Users can create own stream sessions" ON stream_sessions;
DROP POLICY IF EXISTS "Users can update own stream sessions" ON stream_sessions;
DROP POLICY IF EXISTS "Users can delete own stream sessions" ON stream_sessions;

-- Public can view live public streams
CREATE POLICY "Anyone can view public live streams"
ON stream_sessions FOR SELECT
TO public
USING (visibility = 'public' AND status = 'live');

-- Authenticated users can view their own streams (any status)
CREATE POLICY "Users can view own stream sessions"
ON stream_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own stream sessions
CREATE POLICY "Users can create own stream sessions"
ON stream_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own stream sessions
CREATE POLICY "Users can update own stream sessions"
ON stream_sessions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own stream sessions
CREATE POLICY "Users can delete own stream sessions"
ON stream_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- STREAM_SOURCES TABLE POLICIES (Admin-added external streams)
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view active stream sources" ON stream_sources;
DROP POLICY IF EXISTS "Admins can manage stream sources" ON stream_sources;

-- Anyone can view active stream sources
CREATE POLICY "Anyone can view active stream sources"
ON stream_sources FOR SELECT
TO public
USING (is_active = true);

-- Admins can do everything with stream sources
CREATE POLICY "Admins can manage stream sources"
ON stream_sources FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'staff', 'moderator')
  )
);

-- ============================================================================
-- PLAYER_MEDIA TABLE POLICIES (User uploaded clips/videos)
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view public approved media" ON player_media;
DROP POLICY IF EXISTS "Public can view public media" ON player_media;
DROP POLICY IF EXISTS "Users can view own media" ON player_media;
DROP POLICY IF EXISTS "Users can view their own media" ON player_media;
DROP POLICY IF EXISTS "Users can create own media" ON player_media;
DROP POLICY IF EXISTS "Users can insert own media" ON player_media;
DROP POLICY IF EXISTS "Users can update own media" ON player_media;
DROP POLICY IF EXISTS "Users can delete own media" ON player_media;
DROP POLICY IF EXISTS "Users can manage their own media" ON player_media;

-- Public can view approved public media
CREATE POLICY "Public can view approved media"
ON player_media FOR SELECT
TO public
USING (visibility = 'public' AND moderation_status = 'approved');

-- Users can view all their own media
CREATE POLICY "Users can view own media"
ON player_media FOR SELECT
TO authenticated
USING (auth.uid() = player_id);

-- Users can create media
CREATE POLICY "Users can create media"
ON player_media FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = player_id);

-- Users can update their own media
CREATE POLICY "Users can update media"
ON player_media FOR UPDATE
TO authenticated
USING (auth.uid() = player_id)
WITH CHECK (auth.uid() = player_id);

-- Users can delete their own media
CREATE POLICY "Users can delete media"
ON player_media FOR DELETE
TO authenticated
USING (auth.uid() = player_id);

-- ============================================================================
-- STREAM_LAYOUTS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view layouts for their streams" ON stream_layouts;
DROP POLICY IF EXISTS "Users can manage layouts for their streams" ON stream_layouts;

-- Users can view layouts for streams they can access
CREATE POLICY "Users can view stream layouts"
ON stream_layouts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stream_sessions 
    WHERE stream_sessions.id = stream_layouts.stream_id 
    AND (stream_sessions.user_id = auth.uid() OR stream_sessions.visibility = 'public')
  )
);

-- Users can manage layouts for their own streams
CREATE POLICY "Users can manage own stream layouts"
ON stream_layouts FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stream_sessions 
    WHERE stream_sessions.id = stream_layouts.stream_id 
    AND stream_sessions.user_id = auth.uid()
  )
);

-- ============================================================================
-- USER_STREAMS TABLE POLICIES (Go Live OBS streams)
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view public live user streams" ON user_streams;
DROP POLICY IF EXISTS "Users can view own user streams" ON user_streams;
DROP POLICY IF EXISTS "Users can create own user streams" ON user_streams;
DROP POLICY IF EXISTS "Users can update own user streams" ON user_streams;
DROP POLICY IF EXISTS "Users can delete own user streams" ON user_streams;

-- Public can view live public streams
CREATE POLICY "Anyone can view public live user streams"
ON user_streams FOR SELECT
TO public
USING (is_public = true AND status = 'live');

-- Users can view their own streams
CREATE POLICY "Users can view own user streams"
ON user_streams FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own streams
CREATE POLICY "Users can create own user streams"
ON user_streams FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own streams
CREATE POLICY "Users can update own user streams"
ON user_streams FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own streams
CREATE POLICY "Users can delete own user streams"
ON user_streams FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- STORAGE POLICIES (for player-media bucket)
-- ============================================================================

-- These need to be run separately if not already created
-- INSERT INTO storage.policies...

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Run this to verify all policies are in place
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('profiles', 'stream_sessions', 'stream_sources', 'player_media', 'stream_layouts', 'user_streams')
ORDER BY tablename, policyname;
