-- ============================================================================
-- MAJH STUDIO - STANDALONE BROADCAST SYSTEM
-- Complete browser-based streaming/broadcasting infrastructure
-- ============================================================================

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS studio_scene_items CASCADE;
DROP TABLE IF EXISTS studio_scenes CASCADE;
DROP TABLE IF EXISTS studio_sources CASCADE;
DROP TABLE IF EXISTS studio_sessions CASCADE;
DROP TABLE IF EXISTS studio_outputs CASCADE;

-- ============================================================================
-- STUDIO SESSIONS - Main broadcast sessions
-- ============================================================================
CREATE TABLE studio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  game_category TEXT,
  
  -- Stream status
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'preview', 'live', 'ended')),
  
  -- Stream settings
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
  chat_enabled BOOLEAN DEFAULT true,
  clips_enabled BOOLEAN DEFAULT true,
  
  -- Stats
  viewer_count INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_studio_sessions_user ON studio_sessions(user_id);
CREATE INDEX idx_studio_sessions_status ON studio_sessions(status);
CREATE INDEX idx_studio_sessions_live ON studio_sessions(status) WHERE status = 'live';

-- ============================================================================
-- STUDIO SOURCES - Video/audio inputs (webcam, screen, clips, etc.)
-- ============================================================================
CREATE TABLE studio_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Source info
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('webcam', 'screen', 'window', 'image', 'video', 'browser', 'text', 'overlay')),
  
  -- Media settings
  media_stream_id TEXT, -- Browser MediaStream ID
  media_url TEXT, -- For images/videos/overlays
  
  -- Audio settings
  has_audio BOOLEAN DEFAULT false,
  audio_muted BOOLEAN DEFAULT false,
  audio_volume NUMERIC DEFAULT 1.0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_studio_sources_session ON studio_sources(session_id);
CREATE INDEX idx_studio_sources_user ON studio_sources(user_id);

-- ============================================================================
-- STUDIO SCENES - Compositions of sources (like OBS scenes)
-- ============================================================================
CREATE TABLE studio_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
  
  -- Scene info
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- Status
  is_preview BOOLEAN DEFAULT false, -- Currently in preview
  is_program BOOLEAN DEFAULT false, -- Currently live/on-air
  sort_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_studio_scenes_session ON studio_scenes(session_id);

-- ============================================================================
-- STUDIO SCENE ITEMS - Sources placed within scenes with position/size
-- ============================================================================
CREATE TABLE studio_scene_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES studio_scenes(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES studio_sources(id) ON DELETE CASCADE,
  
  -- Position and size (percentage-based for responsive)
  x NUMERIC DEFAULT 0,
  y NUMERIC DEFAULT 0,
  width NUMERIC DEFAULT 100,
  height NUMERIC DEFAULT 100,
  
  -- Transform
  rotation NUMERIC DEFAULT 0,
  scale_x NUMERIC DEFAULT 1,
  scale_y NUMERIC DEFAULT 1,
  
  -- Appearance
  opacity NUMERIC DEFAULT 1,
  z_index INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  is_locked BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_studio_scene_items_scene ON studio_scene_items(scene_id);
CREATE INDEX idx_studio_scene_items_source ON studio_scene_items(source_id);

-- ============================================================================
-- STUDIO OUTPUTS - Multi-stream destinations (RTMP outputs)
-- ============================================================================
CREATE TABLE studio_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
  
  -- Output info
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('majh', 'twitch', 'youtube', 'facebook', 'custom')),
  
  -- RTMP settings
  rtmp_url TEXT,
  stream_key TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  is_connected BOOLEAN DEFAULT false,
  
  -- Stats
  bitrate INTEGER,
  dropped_frames INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_studio_outputs_session ON studio_outputs(session_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE studio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_scene_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_outputs ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Users can view own sessions" ON studio_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sessions" ON studio_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON studio_sessions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON studio_sessions
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view live sessions" ON studio_sessions
  FOR SELECT USING (status = 'live' AND visibility = 'public');

-- Sources policies
CREATE POLICY "Users can manage own sources" ON studio_sources
  FOR ALL USING (auth.uid() = user_id);

-- Scenes policies
CREATE POLICY "Users can manage scenes in own sessions" ON studio_scenes
  FOR ALL USING (
    session_id IN (SELECT id FROM studio_sessions WHERE user_id = auth.uid())
  );

-- Scene items policies
CREATE POLICY "Users can manage scene items in own scenes" ON studio_scene_items
  FOR ALL USING (
    scene_id IN (
      SELECT s.id FROM studio_scenes s
      JOIN studio_sessions ss ON s.session_id = ss.id
      WHERE ss.user_id = auth.uid()
    )
  );

-- Outputs policies
CREATE POLICY "Users can manage own outputs" ON studio_outputs
  FOR ALL USING (
    session_id IN (SELECT id FROM studio_sessions WHERE user_id = auth.uid())
  );

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_studio_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER studio_sessions_updated
  BEFORE UPDATE ON studio_sessions
  FOR EACH ROW EXECUTE FUNCTION update_studio_timestamp();

CREATE TRIGGER studio_sources_updated
  BEFORE UPDATE ON studio_sources
  FOR EACH ROW EXECUTE FUNCTION update_studio_timestamp();

CREATE TRIGGER studio_scenes_updated
  BEFORE UPDATE ON studio_scenes
  FOR EACH ROW EXECUTE FUNCTION update_studio_timestamp();

CREATE TRIGGER studio_scene_items_updated
  BEFORE UPDATE ON studio_scene_items
  FOR EACH ROW EXECUTE FUNCTION update_studio_timestamp();

CREATE TRIGGER studio_outputs_updated
  BEFORE UPDATE ON studio_outputs
  FOR EACH ROW EXECUTE FUNCTION update_studio_timestamp();
