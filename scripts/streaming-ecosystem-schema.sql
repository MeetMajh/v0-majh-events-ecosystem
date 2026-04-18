-- ============================================================================
-- MAJH STREAMING ECOSYSTEM - UNIFIED SCHEMA
-- Complete tournament streaming infrastructure with player feeds, broadcast control,
-- clips, VODs, and live hub integration
-- ============================================================================

-- Drop existing tables if they exist to ensure clean state
DROP TABLE IF EXISTS vod_chapters CASCADE;
DROP TABLE IF EXISTS stream_vods CASCADE;
DROP TABLE IF EXISTS stream_clips CASCADE;
DROP TABLE IF EXISTS live_events CASCADE;
DROP TABLE IF EXISTS broadcast_outputs CASCADE;
DROP TABLE IF EXISTS broadcast_scene_items CASCADE;
DROP TABLE IF EXISTS broadcast_scenes CASCADE;
DROP TABLE IF EXISTS broadcast_sources CASCADE;
DROP TABLE IF EXISTS broadcast_sessions CASCADE;
DROP TABLE IF EXISTS player_streams CASCADE;
DROP TABLE IF EXISTS stream_rooms CASCADE;

-- ============================================================================
-- 1. STREAM ROOMS - Where players stream their individual feeds
-- Each table/match has a room where both players can stream
-- ============================================================================
CREATE TABLE stream_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  tournament_id UUID,
  match_id UUID,
  round_id UUID,
  room_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  name TEXT NOT NULL,
  description TEXT,
  room_type TEXT NOT NULL DEFAULT 'match' CHECK (room_type IN ('match', 'table', 'stage', 'practice', 'custom')),
  max_streams INT DEFAULT 4,
  table_number INT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'live', 'paused', 'ended')),
  is_feature_room BOOLEAN DEFAULT FALSE,
  is_recording BOOLEAN DEFAULT FALSE,
  stream_delay_seconds INT DEFAULT 0,
  allow_spectators BOOLEAN DEFAULT TRUE,
  chat_enabled BOOLEAN DEFAULT TRUE,
  viewer_count INT DEFAULT 0,
  peak_viewers INT DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stream_rooms_tournament ON stream_rooms(tournament_id);
CREATE INDEX idx_stream_rooms_match ON stream_rooms(match_id);
CREATE INDEX idx_stream_rooms_status ON stream_rooms(status);
CREATE INDEX idx_stream_rooms_live ON stream_rooms(status) WHERE status = 'live';
CREATE INDEX idx_stream_rooms_code ON stream_rooms(room_code);

-- ============================================================================
-- 2. PLAYER STREAMS - Individual player video feeds within a room
-- ============================================================================
CREATE TABLE player_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES stream_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  slot_number INT NOT NULL DEFAULT 1 CHECK (slot_number BETWEEN 1 AND 8),
  player_role TEXT DEFAULT 'player' CHECK (player_role IN ('player', 'caster', 'observer', 'producer')),
  stream_key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  ingest_url TEXT,
  playback_url TEXT,
  peer_id TEXT,
  sdp_offer TEXT,
  sdp_answer TEXT,
  ice_candidates JSONB DEFAULT '[]',
  video_codec TEXT DEFAULT 'h264',
  audio_codec TEXT DEFAULT 'opus',
  resolution TEXT DEFAULT '1280x720',
  bitrate_kbps INT DEFAULT 2500,
  framerate INT DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'streaming', 'error')),
  is_muted BOOLEAN DEFAULT FALSE,
  is_video_enabled BOOLEAN DEFAULT TRUE,
  latency_ms INT,
  packet_loss_percent NUMERIC,
  last_heartbeat_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, slot_number)
);

CREATE INDEX idx_player_streams_room ON player_streams(room_id);
CREATE INDEX idx_player_streams_user ON player_streams(user_id);
CREATE INDEX idx_player_streams_key ON player_streams(stream_key);
CREATE INDEX idx_player_streams_status ON player_streams(status);

-- ============================================================================
-- 3. BROADCAST SESSIONS - Production sessions combining multiple feeds
-- ============================================================================
CREATE TABLE broadcast_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  tournament_id UUID,
  event_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  producer_id UUID,
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'preview', 'live', 'paused', 'ended')),
  output_resolution TEXT DEFAULT '1920x1080',
  output_bitrate_kbps INT DEFAULT 6000,
  output_framerate INT DEFAULT 30,
  broadcast_delay_seconds INT DEFAULT 10,
  is_recording BOOLEAN DEFAULT FALSE,
  recording_url TEXT,
  recording_started_at TIMESTAMPTZ,
  viewer_count INT DEFAULT 0,
  peak_viewers INT DEFAULT 0,
  total_views INT DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broadcast_sessions_tenant ON broadcast_sessions(tenant_id);
CREATE INDEX idx_broadcast_sessions_tournament ON broadcast_sessions(tournament_id);
CREATE INDEX idx_broadcast_sessions_status ON broadcast_sessions(status);
CREATE INDEX idx_broadcast_sessions_live ON broadcast_sessions(status) WHERE status = 'live';

-- ============================================================================
-- 4. BROADCAST SOURCES - Inputs available for mixing
-- ============================================================================
CREATE TABLE broadcast_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('player_stream', 'room', 'screen', 'camera', 'video', 'image', 'overlay', 'text', 'browser')),
  player_stream_id UUID REFERENCES player_streams(id) ON DELETE SET NULL,
  room_id UUID REFERENCES stream_rooms(id) ON DELETE SET NULL,
  media_url TEXT,
  name TEXT NOT NULL,
  volume NUMERIC DEFAULT 1.0,
  is_muted BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broadcast_sources_session ON broadcast_sources(session_id);
CREATE INDEX idx_broadcast_sources_player ON broadcast_sources(player_stream_id);

-- ============================================================================
-- 5. BROADCAST SCENES - Layouts combining multiple sources
-- ============================================================================
CREATE TABLE broadcast_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scene_type TEXT DEFAULT 'custom' CHECK (scene_type IN ('match', 'standings', 'bracket', 'interview', 'brb', 'intro', 'outro', 'custom')),
  thumbnail_url TEXT,
  layout_preset TEXT DEFAULT 'single' CHECK (layout_preset IN ('single', 'split', 'pip', 'quad', 'grid', 'custom')),
  is_preview BOOLEAN DEFAULT FALSE,
  is_program BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broadcast_scenes_session ON broadcast_scenes(session_id);

-- ============================================================================
-- 6. SCENE ITEMS - Sources positioned within scenes
-- ============================================================================
CREATE TABLE broadcast_scene_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES broadcast_scenes(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES broadcast_sources(id) ON DELETE CASCADE,
  x NUMERIC DEFAULT 0,
  y NUMERIC DEFAULT 0,
  width NUMERIC DEFAULT 100,
  height NUMERIC DEFAULT 100,
  rotation NUMERIC DEFAULT 0,
  scale_x NUMERIC DEFAULT 1,
  scale_y NUMERIC DEFAULT 1,
  opacity NUMERIC DEFAULT 1,
  z_index INT DEFAULT 0,
  border_radius NUMERIC DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  is_locked BOOLEAN DEFAULT FALSE,
  transition_type TEXT DEFAULT 'cut' CHECK (transition_type IN ('cut', 'fade', 'slide', 'zoom')),
  transition_duration_ms INT DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scene_items_scene ON broadcast_scene_items(scene_id);

-- ============================================================================
-- 7. BROADCAST OUTPUTS - Where the mixed stream goes
-- ============================================================================
CREATE TABLE broadcast_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('majh', 'twitch', 'youtube', 'kick', 'facebook', 'custom')),
  rtmp_url TEXT NOT NULL,
  stream_key TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  is_connected BOOLEAN DEFAULT FALSE,
  bitrate_kbps INT,
  dropped_frames INT DEFAULT 0,
  uptime_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broadcast_outputs_session ON broadcast_outputs(session_id);

-- ============================================================================
-- 8. CLIPS - Generated from streams/recordings
-- ============================================================================
CREATE TABLE stream_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  broadcast_session_id UUID REFERENCES broadcast_sessions(id) ON DELETE SET NULL,
  room_id UUID REFERENCES stream_rooms(id) ON DELETE SET NULL,
  match_id UUID,
  tournament_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INT NOT NULL,
  start_time_seconds INT,
  end_time_seconds INT,
  clip_type TEXT DEFAULT 'manual' CHECK (clip_type IN ('manual', 'auto_highlight', 'score_change', 'reaction_spike', 'clutch')),
  highlight_score NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed', 'deleted')),
  is_featured BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT TRUE,
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  share_count INT DEFAULT 0,
  player_ids UUID[] DEFAULT '{}',
  clipped_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stream_clips_tenant ON stream_clips(tenant_id);
CREATE INDEX idx_stream_clips_tournament ON stream_clips(tournament_id);
CREATE INDEX idx_stream_clips_match ON stream_clips(match_id);
CREATE INDEX idx_stream_clips_status ON stream_clips(status);
CREATE INDEX idx_stream_clips_featured ON stream_clips(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_stream_clips_trending ON stream_clips(view_count DESC, created_at DESC);

-- ============================================================================
-- 9. VODS - Full recordings
-- ============================================================================
CREATE TABLE stream_vods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  broadcast_session_id UUID REFERENCES broadcast_sessions(id) ON DELETE SET NULL,
  room_id UUID REFERENCES stream_rooms(id) ON DELETE SET NULL,
  tournament_id UUID,
  match_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INT,
  file_size_bytes BIGINT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed', 'deleted')),
  processing_progress INT DEFAULT 0,
  quality_variants JSONB DEFAULT '[]',
  is_featured BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT TRUE,
  round_number INT,
  view_count INT DEFAULT 0,
  player_ids UUID[] DEFAULT '{}',
  recorded_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stream_vods_tenant ON stream_vods(tenant_id);
CREATE INDEX idx_stream_vods_tournament ON stream_vods(tournament_id);
CREATE INDEX idx_stream_vods_status ON stream_vods(status);

-- ============================================================================
-- 10. VOD CHAPTERS/TIMESTAMPS
-- ============================================================================
CREATE TABLE vod_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vod_id UUID NOT NULL REFERENCES stream_vods(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  timestamp_seconds INT NOT NULL,
  thumbnail_url TEXT,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  chapter_type TEXT CHECK (chapter_type IN ('round_start', 'score_change', 'highlight', 'break', 'custom')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vod_chapters_vod ON vod_chapters(vod_id);

-- ============================================================================
-- 11. LIVE EVENTS - Active broadcasts shown on Live Hub
-- ============================================================================
CREATE TABLE live_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  broadcast_session_id UUID REFERENCES broadcast_sessions(id) ON DELETE CASCADE,
  tournament_id UUID,
  room_id UUID REFERENCES stream_rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  stream_url TEXT,
  embed_url TEXT,
  platform TEXT,
  status TEXT DEFAULT 'live' CHECK (status IN ('scheduled', 'live', 'ended')),
  is_featured BOOLEAN DEFAULT FALSE,
  viewer_count INT DEFAULT 0,
  peak_viewers INT DEFAULT 0,
  category TEXT DEFAULT 'tournament' CHECK (category IN ('tournament', 'practice', 'community', 'educational', 'entertainment')),
  tags TEXT[] DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_events_status ON live_events(status);
CREATE INDEX idx_live_events_live ON live_events(status) WHERE status = 'live';
CREATE INDEX idx_live_events_featured ON live_events(is_featured) WHERE is_featured = TRUE;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE stream_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_scene_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_vods ENABLE ROW LEVEL SECURITY;
ALTER TABLE vod_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_events ENABLE ROW LEVEL SECURITY;

-- Stream rooms: Public can view
CREATE POLICY "Anyone can view stream rooms" ON stream_rooms FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage stream rooms" ON stream_rooms FOR ALL TO authenticated USING (true);

-- Player streams: Players can manage own, others can view
CREATE POLICY "Anyone can view player streams" ON player_streams FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage player streams" ON player_streams FOR ALL TO authenticated USING (true);

-- Broadcast sessions
CREATE POLICY "Anyone can view broadcasts" ON broadcast_sessions FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage broadcasts" ON broadcast_sessions FOR ALL TO authenticated USING (true);

-- Broadcast sources/scenes/items
CREATE POLICY "View broadcast sources" ON broadcast_sources FOR SELECT USING (true);
CREATE POLICY "Manage broadcast sources" ON broadcast_sources FOR ALL TO authenticated USING (true);

CREATE POLICY "View broadcast scenes" ON broadcast_scenes FOR SELECT USING (true);
CREATE POLICY "Manage broadcast scenes" ON broadcast_scenes FOR ALL TO authenticated USING (true);

CREATE POLICY "View scene items" ON broadcast_scene_items FOR SELECT USING (true);
CREATE POLICY "Manage scene items" ON broadcast_scene_items FOR ALL TO authenticated USING (true);

CREATE POLICY "View broadcast outputs" ON broadcast_outputs FOR SELECT USING (true);
CREATE POLICY "Manage broadcast outputs" ON broadcast_outputs FOR ALL TO authenticated USING (true);

-- Clips and VODs: Public can view, creators can manage
CREATE POLICY "Anyone can view clips" ON stream_clips FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage clips" ON stream_clips FOR ALL TO authenticated USING (true);

CREATE POLICY "Anyone can view VODs" ON stream_vods FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage VODs" ON stream_vods FOR ALL TO authenticated USING (true);

CREATE POLICY "Anyone can view VOD chapters" ON vod_chapters FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage VOD chapters" ON vod_chapters FOR ALL TO authenticated USING (true);

CREATE POLICY "Anyone can view live events" ON live_events FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage live events" ON live_events FOR ALL TO authenticated USING (true);

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT ON stream_rooms TO anon, authenticated;
GRANT SELECT ON player_streams TO anon, authenticated;
GRANT SELECT ON broadcast_sessions TO anon, authenticated;
GRANT SELECT ON broadcast_sources TO anon, authenticated;
GRANT SELECT ON broadcast_scenes TO anon, authenticated;
GRANT SELECT ON broadcast_scene_items TO anon, authenticated;
GRANT SELECT ON stream_clips TO anon, authenticated;
GRANT SELECT ON stream_vods TO anon, authenticated;
GRANT SELECT ON vod_chapters TO anon, authenticated;
GRANT SELECT ON live_events TO anon, authenticated;

GRANT ALL ON stream_rooms TO authenticated;
GRANT ALL ON player_streams TO authenticated;
GRANT ALL ON broadcast_sessions TO authenticated;
GRANT ALL ON broadcast_sources TO authenticated;
GRANT ALL ON broadcast_scenes TO authenticated;
GRANT ALL ON broadcast_scene_items TO authenticated;
GRANT ALL ON broadcast_outputs TO authenticated;
GRANT ALL ON stream_clips TO authenticated;
GRANT ALL ON stream_vods TO authenticated;
GRANT ALL ON vod_chapters TO authenticated;
GRANT ALL ON live_events TO authenticated;
