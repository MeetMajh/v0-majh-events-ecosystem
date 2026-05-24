-- MAJH STUDIO TABLES
-- Creates all tables needed for the in-browser streaming feature

-- Stream Sessions
CREATE TABLE IF NOT EXISTS stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  game_id UUID,
  room_name TEXT UNIQUE NOT NULL,
  is_live BOOLEAN DEFAULT false,
  viewer_count INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_public BOOLEAN DEFAULT true,
  allow_chat BOOLEAN DEFAULT true,
  allow_clips BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_stream_sessions_host ON stream_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_live ON stream_sessions(is_live) WHERE is_live = true;

-- Stream Layouts
CREATE TABLE IF NOT EXISTS stream_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  layout_type TEXT DEFAULT 'picture_in_picture',
  camera_enabled BOOLEAN DEFAULT true,
  camera_position TEXT DEFAULT 'bottom_right',
  camera_size TEXT DEFAULT 'small',
  overlay_enabled BOOLEAN DEFAULT true,
  overlay_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_layouts_stream ON stream_layouts(stream_id);

-- Stream Sources (for advanced scene configuration)
CREATE TABLE IF NOT EXISTS stream_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'scene', 'camera', 'screen', 'image', 'text', 'browser'
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_sources_user ON stream_sources(user_id);

-- RLS Policies
ALTER TABLE stream_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_sources ENABLE ROW LEVEL SECURITY;

-- Stream Sessions Policies
DROP POLICY IF EXISTS "Users can view own sessions" ON stream_sessions;
CREATE POLICY "Users can view own sessions" ON stream_sessions
  FOR SELECT USING (auth.uid() = host_id OR (is_public = true AND is_live = true));

DROP POLICY IF EXISTS "Users can insert own sessions" ON stream_sessions;
CREATE POLICY "Users can insert own sessions" ON stream_sessions
  FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON stream_sessions;
CREATE POLICY "Users can update own sessions" ON stream_sessions
  FOR UPDATE USING (auth.uid() = host_id);

-- Stream Layouts Policies
DROP POLICY IF EXISTS "Users can manage layouts via session" ON stream_layouts;
CREATE POLICY "Users can manage layouts via session" ON stream_layouts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stream_sessions 
      WHERE stream_sessions.id = stream_layouts.stream_id 
      AND stream_sessions.host_id = auth.uid()
    )
  );

-- Stream Sources Policies
DROP POLICY IF EXISTS "Users can view own sources" ON stream_sources;
CREATE POLICY "Users can view own sources" ON stream_sources
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sources" ON stream_sources;
CREATE POLICY "Users can insert own sources" ON stream_sources
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sources" ON stream_sources;
CREATE POLICY "Users can update own sources" ON stream_sources
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sources" ON stream_sources;
CREATE POLICY "Users can delete own sources" ON stream_sources
  FOR DELETE USING (auth.uid() = user_id);
