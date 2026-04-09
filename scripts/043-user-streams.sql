-- USER STREAMS TABLE
-- For Go Live feature - allows users to stream on the platform

CREATE TABLE IF NOT EXISTS user_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  game_id UUID,
  stream_key TEXT NOT NULL UNIQUE,
  rtmp_url TEXT NOT NULL,
  playback_url TEXT,
  status TEXT NOT NULL DEFAULT 'offline',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  peak_viewers INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  allow_chat BOOLEAN DEFAULT true,
  allow_clips BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_streams_user ON user_streams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streams_status ON user_streams(status);
CREATE INDEX IF NOT EXISTS idx_user_streams_stream_key ON user_streams(stream_key);

-- RLS
ALTER TABLE user_streams ENABLE ROW LEVEL SECURITY;

-- Users can view their own streams
DROP POLICY IF EXISTS "Users can view own streams" ON user_streams;
CREATE POLICY "Users can view own streams" ON user_streams
  FOR SELECT USING (auth.uid() = user_id OR (is_public = true AND status = 'live'));

-- Users can create their own streams
DROP POLICY IF EXISTS "Users can create streams" ON user_streams;
CREATE POLICY "Users can create streams" ON user_streams
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own streams
DROP POLICY IF EXISTS "Users can update own streams" ON user_streams;
CREATE POLICY "Users can update own streams" ON user_streams
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own streams
DROP POLICY IF EXISTS "Users can delete own streams" ON user_streams;
CREATE POLICY "Users can delete own streams" ON user_streams
  FOR DELETE USING (auth.uid() = user_id);
