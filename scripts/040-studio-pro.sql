-- MAJH STUDIO PRO - Broadcast Production System
-- Scenes, Sources, Switching, Multi-Output

-- STUDIO SOURCES (video/audio inputs)
CREATE TABLE IF NOT EXISTS studio_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL, -- 'webcam', 'screen', 'match', 'clip', 'image', 'browser', 'rtmp'
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  z_index INTEGER DEFAULT 0,
  -- Source-specific config
  config JSONB DEFAULT '{}',
  -- Position/size (percentages 0-100)
  position_x NUMERIC(5,2) DEFAULT 0,
  position_y NUMERIC(5,2) DEFAULT 0,
  width NUMERIC(5,2) DEFAULT 100,
  height NUMERIC(5,2) DEFAULT 100,
  opacity NUMERIC(3,2) DEFAULT 1,
  -- For match sources
  match_id UUID,
  -- For clip sources
  clip_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_sources_session ON studio_sources(session_id);

-- STUDIO SCENES (compositions of sources)
CREATE TABLE IF NOT EXISTS studio_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  is_preview BOOLEAN DEFAULT false,
  scene_order INTEGER DEFAULT 0,
  -- Scene config
  background_color TEXT DEFAULT '#000000',
  background_image TEXT,
  transition_type TEXT DEFAULT 'cut', -- 'cut', 'fade', 'wipe', 'slide'
  transition_duration INTEGER DEFAULT 300, -- ms
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_scenes_session ON studio_scenes(session_id);
CREATE INDEX IF NOT EXISTS idx_studio_scenes_active ON studio_scenes(session_id, is_active) WHERE is_active = true;

-- STUDIO SCENE ITEMS (sources placed in scenes)
CREATE TABLE IF NOT EXISTS studio_scene_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL,
  source_id UUID NOT NULL,
  -- Position/size override for this scene
  position_x NUMERIC(5,2) DEFAULT 0,
  position_y NUMERIC(5,2) DEFAULT 0,
  width NUMERIC(5,2) DEFAULT 100,
  height NUMERIC(5,2) DEFAULT 100,
  opacity NUMERIC(3,2) DEFAULT 1,
  z_index INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  -- Crop settings
  crop_top NUMERIC(5,2) DEFAULT 0,
  crop_bottom NUMERIC(5,2) DEFAULT 0,
  crop_left NUMERIC(5,2) DEFAULT 0,
  crop_right NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_scene_items_scene ON studio_scene_items(scene_id);

-- STUDIO OUTPUTS (multi-stream destinations)
CREATE TABLE IF NOT EXISTS studio_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL, -- 'majh', 'twitch', 'youtube', 'kick', 'custom'
  rtmp_url TEXT,
  stream_key TEXT,
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'idle', -- 'idle', 'connecting', 'live', 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_studio_outputs_session ON studio_outputs(session_id);

-- STUDIO AUDIO TRACKS
CREATE TABLE IF NOT EXISTS studio_audio_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  source_id UUID,
  label TEXT NOT NULL,
  track_type TEXT NOT NULL, -- 'mic', 'desktop', 'music', 'game'
  volume NUMERIC(3,2) DEFAULT 1, -- 0 to 1
  is_muted BOOLEAN DEFAULT false,
  is_solo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_audio_session ON studio_audio_tracks(session_id);

-- STUDIO OVERLAYS (tournament-integrated)
CREATE TABLE IF NOT EXISTS studio_overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  overlay_type TEXT NOT NULL, -- 'match_score', 'player_cam', 'chat', 'alerts', 'custom'
  label TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  position_x NUMERIC(5,2) DEFAULT 0,
  position_y NUMERIC(5,2) DEFAULT 0,
  width NUMERIC(5,2) DEFAULT 100,
  height NUMERIC(5,2) DEFAULT 100,
  -- For tournament overlays
  match_id UUID,
  tournament_id UUID,
  -- Custom config
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_overlays_session ON studio_overlays(session_id);

-- STUDIO REPLAY BUFFER (for instant replay)
CREATE TABLE IF NOT EXISTS studio_replay_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_url TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  timestamp_start TIMESTAMPTZ NOT NULL,
  timestamp_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_replay_session ON studio_replay_buffer(session_id, chunk_index DESC);

-- STUDIO HOTKEYS (keyboard shortcuts)
CREATE TABLE IF NOT EXISTS studio_hotkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'switch_scene', 'toggle_source', 'start_stream', 'instant_replay'
  key_combo TEXT NOT NULL, -- e.g., 'ctrl+1', 'f5'
  target_id UUID, -- scene_id or source_id depending on action
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key_combo)
);

CREATE INDEX IF NOT EXISTS idx_studio_hotkeys_user ON studio_hotkeys(user_id);

-- STUDIO PRESETS (saved scene collections)
CREATE TABLE IF NOT EXISTS studio_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  preset_data JSONB NOT NULL, -- Full scene/source configuration
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_presets_user ON studio_presets(user_id);

-- RLS
ALTER TABLE studio_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_scene_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_audio_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_overlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_replay_buffer ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_hotkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_presets ENABLE ROW LEVEL SECURITY;
