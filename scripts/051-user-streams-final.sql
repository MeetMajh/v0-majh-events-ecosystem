-- USER STREAMS TABLE - For Go Live feature
-- This is the ONLY table needed for the Go Live streaming feature

-- Drop and recreate to ensure clean state
DROP TABLE IF EXISTS user_streams CASCADE;

CREATE TABLE user_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  game_id UUID,
  stream_key TEXT NOT NULL UNIQUE,
  rtmp_url TEXT NOT NULL DEFAULT 'rtmp://live.majhevents.com/live',
  playback_url TEXT,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'live', 'ended')),
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

-- Indexes for performance
CREATE INDEX idx_user_streams_user_id ON user_streams(user_id);
CREATE INDEX idx_user_streams_status ON user_streams(status);
CREATE INDEX idx_user_streams_stream_key ON user_streams(stream_key);

-- Enable RLS
ALTER TABLE user_streams ENABLE ROW LEVEL SECURITY;

-- Users can view their own streams
CREATE POLICY "Users can view own streams" ON user_streams
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own streams  
CREATE POLICY "Users can create own streams" ON user_streams
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own streams
CREATE POLICY "Users can update own streams" ON user_streams
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own streams
CREATE POLICY "Users can delete own streams" ON user_streams
  FOR DELETE USING (auth.uid() = user_id);

-- Public can view live public streams
CREATE POLICY "Public can view live streams" ON user_streams
  FOR SELECT USING (status = 'live' AND is_public = true);
