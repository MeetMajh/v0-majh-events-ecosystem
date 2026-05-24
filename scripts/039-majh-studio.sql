-- MAJH STUDIO - In-Browser Streaming System
-- WebRTC-based streaming with LiveKit integration

-- STREAM SESSIONS (browser-based streams)
CREATE TABLE IF NOT EXISTS stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL,
  
  -- Stream info
  title TEXT NOT NULL,
  description TEXT,
  game_id UUID,
  
  -- Room info (for LiveKit)
  room_name TEXT UNIQUE NOT NULL,
  
  -- Status
  is_live BOOLEAN DEFAULT false,
  viewer_count INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Settings
  is_public BOOLEAN DEFAULT true,
  allow_chat BOOLEAN DEFAULT true,
  allow_clips BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_stream_sessions_host ON stream_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_live ON stream_sessions(is_live) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_stream_sessions_room ON stream_sessions(room_name);

-- STREAM LAYOUTS (picture-in-picture, fullscreen, etc.)
CREATE TABLE IF NOT EXISTS stream_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
  
  layout_type TEXT DEFAULT 'fullscreen', -- 'fullscreen', 'picture_in_picture', 'side_by_side'
  camera_enabled BOOLEAN DEFAULT true,
  camera_position TEXT DEFAULT 'bottom_right', -- 'top_left', 'top_right', 'bottom_left', 'bottom_right'
  camera_size TEXT DEFAULT 'small', -- 'small', 'medium', 'large'
  
  -- Overlay settings
  overlay_enabled BOOLEAN DEFAULT true,
  overlay_config JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_layouts_stream ON stream_layouts(stream_id);

-- STREAM CLIPS BUFFER (for instant clipping)
CREATE TABLE IF NOT EXISTS stream_clips_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
  
  chunk_url TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  duration_seconds INTEGER DEFAULT 10,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_clips_buffer_stream ON stream_clips_buffer(stream_id, chunk_index DESC);

-- STREAM CLIPS (saved clips from streams)
CREATE TABLE IF NOT EXISTS stream_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES stream_sessions(id) ON DELETE SET NULL,
  creator_id UUID NOT NULL,
  
  title TEXT NOT NULL,
  clip_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  duration_seconds INTEGER NOT NULL,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  
  -- Timing within stream
  stream_timestamp_start INTEGER, -- seconds from stream start
  stream_timestamp_end INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_clips_stream ON stream_clips(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_clips_creator ON stream_clips(creator_id);
CREATE INDEX IF NOT EXISTS idx_stream_clips_views ON stream_clips(view_count DESC);

-- STREAM CHAT MESSAGES
CREATE TABLE IF NOT EXISTS stream_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  message TEXT NOT NULL,
  
  -- Moderation
  is_deleted BOOLEAN DEFAULT false,
  deleted_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_chat_stream ON stream_chat_messages(stream_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stream_chat_user ON stream_chat_messages(user_id);

-- STREAM VIEWERS (presence tracking)
CREATE TABLE IF NOT EXISTS stream_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
  user_id UUID,
  session_id TEXT NOT NULL, -- For anonymous viewers
  
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  
  UNIQUE(stream_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_viewers_stream ON stream_viewers(stream_id) WHERE left_at IS NULL;

-- RLS Policies
ALTER TABLE stream_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_clips_buffer ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_viewers ENABLE ROW LEVEL SECURITY;

-- Stream sessions: public can view live, host can manage
CREATE POLICY "Anyone can view public live streams" ON stream_sessions
  FOR SELECT USING (is_public = true OR auth.uid() = host_id);

CREATE POLICY "Host can manage own streams" ON stream_sessions
  FOR ALL USING (auth.uid() = host_id);

-- Layouts: only host can manage
CREATE POLICY "Host can manage layouts" ON stream_layouts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM stream_sessions WHERE id = stream_id AND host_id = auth.uid())
  );

-- Clips: creator can manage, anyone can view
CREATE POLICY "Anyone can view clips" ON stream_clips
  FOR SELECT USING (true);

CREATE POLICY "Creator can manage clips" ON stream_clips
  FOR ALL USING (auth.uid() = creator_id);

-- Chat: anyone can view, authenticated users can post
CREATE POLICY "Anyone can view chat" ON stream_chat_messages
  FOR SELECT USING (is_deleted = false);

CREATE POLICY "Authenticated users can post" ON stream_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Viewers: anyone can join
CREATE POLICY "Anyone can join streams" ON stream_viewers
  FOR ALL USING (true);
