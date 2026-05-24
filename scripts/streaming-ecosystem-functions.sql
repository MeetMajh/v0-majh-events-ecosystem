-- ============================================================================
-- MAJH STREAMING ECOSYSTEM - RPC FUNCTIONS
-- Atomic operations for streaming, broadcasting, clips, and VODs
-- Run this AFTER streaming-ecosystem-schema.sql
-- ============================================================================

-- ============================================================================
-- STREAM ROOM MANAGEMENT
-- ============================================================================

-- Create a stream room
CREATE OR REPLACE FUNCTION create_stream_room(
  p_tenant_id UUID,
  p_name TEXT,
  p_tournament_id UUID DEFAULT NULL,
  p_match_id UUID DEFAULT NULL,
  p_table_number INT DEFAULT NULL,
  p_room_type TEXT DEFAULT 'match'
)
RETURNS JSON AS $$
DECLARE
  v_room_id UUID;
  v_room_code TEXT;
BEGIN
  INSERT INTO stream_rooms (
    tenant_id, tournament_id, match_id, name, table_number, room_type
  ) VALUES (
    p_tenant_id, p_tournament_id, p_match_id, p_name, p_table_number, p_room_type
  )
  RETURNING id, room_code INTO v_room_id, v_room_code;
  
  RETURN json_build_object(
    'success', true,
    'room_id', v_room_id,
    'room_code', v_room_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join a stream room as a player
CREATE OR REPLACE FUNCTION join_stream_room(
  p_room_id UUID,
  p_user_id UUID,
  p_slot_number INT DEFAULT NULL,
  p_player_role TEXT DEFAULT 'player'
)
RETURNS JSON AS $$
DECLARE
  v_stream_id UUID;
  v_stream_key TEXT;
  v_slot INT;
  v_room RECORD;
BEGIN
  SELECT * INTO v_room FROM stream_rooms WHERE id = p_room_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Room not found');
  END IF;
  
  -- Check if user already in room
  SELECT id, stream_key, slot_number INTO v_stream_id, v_stream_key, v_slot
  FROM player_streams WHERE room_id = p_room_id AND user_id = p_user_id;
  
  IF v_stream_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'stream_id', v_stream_id,
      'stream_key', v_stream_key,
      'slot_number', v_slot,
      'room_code', v_room.room_code
    );
  END IF;
  
  -- Auto-assign slot if not specified
  IF p_slot_number IS NULL THEN
    SELECT COALESCE(MAX(slot_number), 0) + 1 INTO v_slot
    FROM player_streams WHERE room_id = p_room_id;
  ELSE
    v_slot := p_slot_number;
  END IF;
  
  IF v_slot > v_room.max_streams THEN
    RETURN json_build_object('success', false, 'error', 'Room is full');
  END IF;
  
  INSERT INTO player_streams (room_id, user_id, slot_number, player_role, ingest_url)
  VALUES (p_room_id, p_user_id, v_slot, p_player_role, 
    'wss://stream.majhevents.com/ingest/' || p_room_id || '/' || v_slot)
  ON CONFLICT (room_id, slot_number) DO UPDATE SET
    user_id = p_user_id,
    player_role = p_player_role,
    status = 'disconnected',
    updated_at = NOW()
  RETURNING id, stream_key INTO v_stream_id, v_stream_key;
  
  RETURN json_build_object(
    'success', true,
    'stream_id', v_stream_id,
    'stream_key', v_stream_key,
    'slot_number', v_slot,
    'room_code', v_room.room_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update player stream status
CREATE OR REPLACE FUNCTION update_player_stream_status(
  p_stream_key TEXT,
  p_status TEXT,
  p_playback_url TEXT DEFAULT NULL,
  p_latency_ms INT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_stream RECORD;
  v_streaming_count INT;
BEGIN
  UPDATE player_streams
  SET 
    status = p_status,
    playback_url = COALESCE(p_playback_url, playback_url),
    latency_ms = COALESCE(p_latency_ms, latency_ms),
    last_heartbeat_at = NOW(),
    connected_at = CASE WHEN p_status IN ('connected', 'streaming') AND connected_at IS NULL THEN NOW() ELSE connected_at END,
    updated_at = NOW()
  WHERE stream_key = p_stream_key
  RETURNING * INTO v_stream;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Stream not found');
  END IF;
  
  -- Update room status
  SELECT COUNT(*) INTO v_streaming_count 
  FROM player_streams 
  WHERE room_id = v_stream.room_id AND status = 'streaming';
  
  IF v_streaming_count > 0 THEN
    UPDATE stream_rooms 
    SET status = 'live', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
    WHERE id = v_stream.room_id AND status != 'live';
  END IF;
  
  RETURN json_build_object('success', true, 'stream_id', v_stream.id, 'status', p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get stream room with all player streams
CREATE OR REPLACE FUNCTION get_stream_room(p_room_code TEXT)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'room', row_to_json(sr),
      'streams', COALESCE((
        SELECT json_agg(row_to_json(ps) ORDER BY ps.slot_number)
        FROM player_streams ps
        WHERE ps.room_id = sr.id
      ), '[]'::json)
    )
    FROM stream_rooms sr
    WHERE sr.room_code = p_room_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get stream room by ID
CREATE OR REPLACE FUNCTION get_stream_room_by_id(p_room_id UUID)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'room', row_to_json(sr),
      'streams', COALESCE((
        SELECT json_agg(row_to_json(ps) ORDER BY ps.slot_number)
        FROM player_streams ps
        WHERE ps.room_id = sr.id
      ), '[]'::json)
    )
    FROM stream_rooms sr
    WHERE sr.id = p_room_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- BROADCAST SESSION MANAGEMENT
-- ============================================================================

-- Create a broadcast session
CREATE OR REPLACE FUNCTION create_broadcast_session(
  p_tenant_id UUID,
  p_producer_id UUID,
  p_title TEXT,
  p_tournament_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO broadcast_sessions (
    tenant_id, tournament_id, title, description, producer_id
  ) VALUES (
    p_tenant_id, p_tournament_id, p_title, p_description, p_producer_id
  )
  RETURNING id INTO v_session_id;
  
  -- Create default scenes
  INSERT INTO broadcast_scenes (session_id, name, scene_type, sort_order, is_program) VALUES
    (v_session_id, 'Match Overlay', 'match', 1, true),
    (v_session_id, 'Standings', 'standings', 2, false),
    (v_session_id, 'Bracket View', 'bracket', 3, false),
    (v_session_id, 'BRB Screen', 'brb', 4, false);
  
  -- Create default output
  INSERT INTO broadcast_outputs (session_id, name, platform, rtmp_url)
  VALUES (v_session_id, 'MAJH Live', 'majh', 'rtmps://live.majhevents.com/live');
  
  RETURN json_build_object('success', true, 'session_id', v_session_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add source to broadcast session
CREATE OR REPLACE FUNCTION add_broadcast_source(
  p_session_id UUID,
  p_source_type TEXT,
  p_name TEXT,
  p_player_stream_id UUID DEFAULT NULL,
  p_room_id UUID DEFAULT NULL,
  p_media_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSON AS $$
DECLARE
  v_source_id UUID;
BEGIN
  INSERT INTO broadcast_sources (
    session_id, source_type, name, player_stream_id, room_id, media_url, metadata
  ) VALUES (
    p_session_id, p_source_type, p_name, p_player_stream_id, p_room_id, p_media_url, p_metadata
  )
  RETURNING id INTO v_source_id;
  
  RETURN json_build_object('success', true, 'source_id', v_source_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add source to scene with positioning
CREATE OR REPLACE FUNCTION add_source_to_scene(
  p_scene_id UUID,
  p_source_id UUID,
  p_x NUMERIC DEFAULT 0,
  p_y NUMERIC DEFAULT 0,
  p_width NUMERIC DEFAULT 100,
  p_height NUMERIC DEFAULT 100,
  p_z_index INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
  v_item_id UUID;
BEGIN
  INSERT INTO broadcast_scene_items (
    scene_id, source_id, x, y, width, height, z_index
  ) VALUES (
    p_scene_id, p_source_id, p_x, p_y, p_width, p_height, p_z_index
  )
  RETURNING id INTO v_item_id;
  
  RETURN json_build_object('success', true, 'item_id', v_item_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Start broadcast (Go Live)
CREATE OR REPLACE FUNCTION start_broadcast(
  p_session_id UUID,
  p_producer_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_session RECORD;
  v_live_event_id UUID;
BEGIN
  UPDATE broadcast_sessions
  SET 
    status = 'live', 
    started_at = NOW(), 
    is_recording = TRUE,
    recording_started_at = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id AND producer_id = p_producer_id
  RETURNING * INTO v_session;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Session not found or not authorized');
  END IF;
  
  -- Activate outputs
  UPDATE broadcast_outputs SET is_active = TRUE, is_connected = TRUE WHERE session_id = p_session_id;
  
  -- Create live event entry
  INSERT INTO live_events (
    tenant_id, broadcast_session_id, tournament_id, title, description, status, started_at
  ) VALUES (
    v_session.tenant_id, p_session_id, v_session.tournament_id, v_session.title, v_session.description, 'live', NOW()
  )
  RETURNING id INTO v_live_event_id;
  
  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'live_event_id', v_live_event_id,
    'status', 'live'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End broadcast
CREATE OR REPLACE FUNCTION end_broadcast(
  p_session_id UUID,
  p_producer_id UUID,
  p_recording_url TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_session RECORD;
  v_vod_id UUID;
  v_duration INT;
BEGIN
  UPDATE broadcast_sessions
  SET 
    status = 'ended', 
    ended_at = NOW(), 
    recording_url = COALESCE(p_recording_url, recording_url),
    is_recording = FALSE,
    updated_at = NOW()
  WHERE id = p_session_id AND producer_id = p_producer_id
  RETURNING * INTO v_session;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Session not found');
  END IF;
  
  v_duration := EXTRACT(EPOCH FROM (NOW() - v_session.started_at))::INT;
  
  -- Deactivate outputs
  UPDATE broadcast_outputs SET is_active = FALSE, is_connected = FALSE WHERE session_id = p_session_id;
  
  -- Update live event
  UPDATE live_events
  SET status = 'ended', ended_at = NOW(), updated_at = NOW()
  WHERE broadcast_session_id = p_session_id;
  
  -- Create VOD if recording exists
  IF p_recording_url IS NOT NULL OR v_session.recording_url IS NOT NULL THEN
    INSERT INTO stream_vods (
      tenant_id, broadcast_session_id, tournament_id, title, description, 
      video_url, duration_seconds, status, recorded_at
    ) VALUES (
      v_session.tenant_id, p_session_id, v_session.tournament_id, 
      v_session.title || ' (VOD)', v_session.description,
      COALESCE(p_recording_url, v_session.recording_url), v_duration, 'processing', v_session.started_at
    )
    RETURNING id INTO v_vod_id;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'session_id', p_session_id,
    'vod_id', v_vod_id,
    'duration_seconds', v_duration
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get broadcast session with all details
CREATE OR REPLACE FUNCTION get_broadcast_session(p_session_id UUID)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'session', row_to_json(bs),
      'sources', COALESCE((
        SELECT json_agg(row_to_json(src))
        FROM broadcast_sources src
        WHERE src.session_id = bs.id
      ), '[]'::json),
      'scenes', COALESCE((
        SELECT json_agg(json_build_object(
          'scene', row_to_json(sc),
          'items', COALESCE((
            SELECT json_agg(json_build_object(
              'item', row_to_json(si),
              'source', row_to_json(src2)
            ))
            FROM broadcast_scene_items si
            JOIN broadcast_sources src2 ON src2.id = si.source_id
            WHERE si.scene_id = sc.id
          ), '[]'::json)
        ) ORDER BY sc.sort_order)
        FROM broadcast_scenes sc
        WHERE sc.session_id = bs.id
      ), '[]'::json),
      'outputs', COALESCE((
        SELECT json_agg(row_to_json(o))
        FROM broadcast_outputs o
        WHERE o.session_id = bs.id
      ), '[]'::json)
    )
    FROM broadcast_sessions bs
    WHERE bs.id = p_session_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Switch broadcast scene
CREATE OR REPLACE FUNCTION switch_broadcast_scene(
  p_session_id UUID,
  p_scene_id UUID,
  p_producer_id UUID
)
RETURNS JSON AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM broadcast_sessions WHERE id = p_session_id AND producer_id = p_producer_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  -- Move current program to preview
  UPDATE broadcast_scenes SET is_preview = is_program, is_program = FALSE WHERE session_id = p_session_id AND is_program = TRUE;
  
  -- Make target scene program
  UPDATE broadcast_scenes SET is_program = TRUE, is_preview = FALSE WHERE id = p_scene_id;
  
  RETURN json_build_object('success', true, 'active_scene_id', p_scene_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CLIP MANAGEMENT
-- ============================================================================

-- Create a clip
CREATE OR REPLACE FUNCTION create_clip(
  p_tenant_id UUID,
  p_created_by UUID,
  p_title TEXT,
  p_video_url TEXT,
  p_duration_seconds INT,
  p_broadcast_session_id UUID DEFAULT NULL,
  p_room_id UUID DEFAULT NULL,
  p_match_id UUID DEFAULT NULL,
  p_tournament_id UUID DEFAULT NULL,
  p_clip_type TEXT DEFAULT 'manual',
  p_start_time_seconds INT DEFAULT NULL,
  p_end_time_seconds INT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_clip_id UUID;
BEGIN
  INSERT INTO stream_clips (
    tenant_id, created_by, title, video_url, duration_seconds,
    broadcast_session_id, room_id, match_id, tournament_id,
    clip_type, start_time_seconds, end_time_seconds,
    status, published_at
  ) VALUES (
    p_tenant_id, p_created_by, p_title, p_video_url, p_duration_seconds,
    p_broadcast_session_id, p_room_id, p_match_id, p_tournament_id,
    p_clip_type, p_start_time_seconds, p_end_time_seconds,
    'ready', NOW()
  )
  RETURNING id INTO v_clip_id;
  
  RETURN json_build_object('success', true, 'clip_id', v_clip_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-generate highlight clip (called by AI/triggers)
CREATE OR REPLACE FUNCTION generate_highlight_clip(
  p_broadcast_session_id UUID,
  p_highlight_type TEXT,
  p_start_time_seconds INT,
  p_duration_seconds INT DEFAULT 30,
  p_highlight_score NUMERIC DEFAULT 0.8,
  p_title TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_session RECORD;
  v_clip_id UUID;
  v_title TEXT;
BEGIN
  SELECT * INTO v_session FROM broadcast_sessions WHERE id = p_broadcast_session_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Session not found');
  END IF;
  
  v_title := COALESCE(p_title, 
    CASE p_highlight_type
      WHEN 'score_change' THEN 'Score Update'
      WHEN 'reaction_spike' THEN 'Hype Moment'
      WHEN 'clutch' THEN 'Clutch Play'
      ELSE 'Highlight'
    END
  );
  
  INSERT INTO stream_clips (
    tenant_id, broadcast_session_id, tournament_id,
    title, video_url, duration_seconds,
    clip_type, highlight_score,
    start_time_seconds, end_time_seconds,
    status
  ) VALUES (
    v_session.tenant_id, p_broadcast_session_id, v_session.tournament_id,
    v_title, '', p_duration_seconds,
    'auto_highlight', p_highlight_score,
    p_start_time_seconds, p_start_time_seconds + p_duration_seconds,
    'processing'
  )
  RETURNING id INTO v_clip_id;
  
  RETURN json_build_object('success', true, 'clip_id', v_clip_id, 'requires_processing', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get trending clips
CREATE OR REPLACE FUNCTION get_trending_clips(
  p_limit INT DEFAULT 20,
  p_tournament_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.view_count DESC, c.created_at DESC), '[]'::json)
    FROM stream_clips c
    WHERE c.status = 'ready' 
      AND c.is_public = TRUE
      AND (p_tournament_id IS NULL OR c.tournament_id = p_tournament_id)
    LIMIT p_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VOD MANAGEMENT
-- ============================================================================

-- Get tournament VODs
CREATE OR REPLACE FUNCTION get_tournament_vods(
  p_tournament_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(json_build_object(
      'vod', row_to_json(v),
      'chapters', COALESCE((
        SELECT json_agg(row_to_json(vc) ORDER BY vc.timestamp_seconds)
        FROM vod_chapters vc
        WHERE vc.vod_id = v.id
      ), '[]'::json)
    ) ORDER BY v.recorded_at DESC), '[]'::json)
    FROM stream_vods v
    WHERE v.tournament_id = p_tournament_id
      AND v.status = 'ready'
      AND v.is_public = TRUE
    LIMIT p_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add chapter to VOD
CREATE OR REPLACE FUNCTION add_vod_chapter(
  p_vod_id UUID,
  p_title TEXT,
  p_timestamp_seconds INT,
  p_chapter_type TEXT DEFAULT 'custom',
  p_description TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_chapter_id UUID;
BEGIN
  INSERT INTO vod_chapters (
    vod_id, title, timestamp_seconds, chapter_type, description
  ) VALUES (
    p_vod_id, p_title, p_timestamp_seconds, p_chapter_type, p_description
  )
  RETURNING id INTO v_chapter_id;
  
  RETURN json_build_object('success', true, 'chapter_id', v_chapter_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- LIVE HUB
-- ============================================================================

-- Get live events for Live Hub
CREATE OR REPLACE FUNCTION get_live_events(
  p_category TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(json_build_object(
      'event', row_to_json(le),
      'session', row_to_json(bs)
    ) ORDER BY le.is_featured DESC, le.viewer_count DESC), '[]'::json)
    FROM live_events le
    LEFT JOIN broadcast_sessions bs ON bs.id = le.broadcast_session_id
    WHERE le.status = 'live'
      AND (p_category IS NULL OR le.category = p_category)
      AND (p_tenant_id IS NULL OR le.tenant_id = p_tenant_id)
    LIMIT p_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get upcoming events
CREATE OR REPLACE FUNCTION get_upcoming_events(p_limit INT DEFAULT 10)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(le) ORDER BY le.scheduled_at), '[]'::json)
    FROM live_events le
    WHERE le.status = 'scheduled' AND le.scheduled_at > NOW()
    LIMIT p_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update viewer count
CREATE OR REPLACE FUNCTION update_viewer_count(
  p_target_type TEXT,
  p_target_id UUID,
  p_delta INT
)
RETURNS INT AS $$
DECLARE
  v_new_count INT;
BEGIN
  IF p_target_type = 'room' THEN
    UPDATE stream_rooms 
    SET viewer_count = GREATEST(0, viewer_count + p_delta),
        peak_viewers = GREATEST(peak_viewers, viewer_count + p_delta)
    WHERE id = p_target_id RETURNING viewer_count INTO v_new_count;
  ELSIF p_target_type = 'broadcast' THEN
    UPDATE broadcast_sessions 
    SET viewer_count = GREATEST(0, viewer_count + p_delta),
        peak_viewers = GREATEST(peak_viewers, viewer_count + p_delta),
        total_views = total_views + CASE WHEN p_delta > 0 THEN 1 ELSE 0 END
    WHERE id = p_target_id RETURNING viewer_count INTO v_new_count;
  ELSIF p_target_type = 'live_event' THEN
    UPDATE live_events 
    SET viewer_count = GREATEST(0, viewer_count + p_delta),
        peak_viewers = GREATEST(peak_viewers, viewer_count + p_delta)
    WHERE id = p_target_id RETURNING viewer_count INTO v_new_count;
  END IF;
  
  RETURN COALESCE(v_new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TOURNAMENT STREAMING INTEGRATION
-- ============================================================================

-- Get all stream rooms for a tournament
CREATE OR REPLACE FUNCTION get_tournament_stream_rooms(p_tournament_id UUID)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(json_build_object(
      'room', row_to_json(sr),
      'streams', COALESCE((
        SELECT json_agg(row_to_json(ps) ORDER BY ps.slot_number)
        FROM player_streams ps
        WHERE ps.room_id = sr.id
      ), '[]'::json)
    ) ORDER BY sr.table_number, sr.created_at), '[]'::json)
    FROM stream_rooms sr
    WHERE sr.tournament_id = p_tournament_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get live stream rooms
CREATE OR REPLACE FUNCTION get_live_stream_rooms(p_tenant_id UUID DEFAULT NULL)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(json_build_object(
      'room', row_to_json(sr),
      'streams', COALESCE((
        SELECT json_agg(row_to_json(ps) ORDER BY ps.slot_number)
        FROM player_streams ps
        WHERE ps.room_id = sr.id
      ), '[]'::json)
    ) ORDER BY sr.viewer_count DESC), '[]'::json)
    FROM stream_rooms sr
    WHERE sr.status = 'live'
      AND (p_tenant_id IS NULL OR sr.tenant_id = p_tenant_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT EXECUTE ON FUNCTION create_stream_room(UUID, TEXT, UUID, UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION join_stream_room(UUID, UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_player_stream_status(TEXT, TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_stream_room(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_stream_room_by_id(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_broadcast_session(UUID, UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_broadcast_source(UUID, TEXT, TEXT, UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION add_source_to_scene(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION start_broadcast(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION end_broadcast(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_broadcast_session(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION switch_broadcast_scene(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_clip(UUID, UUID, TEXT, TEXT, INT, UUID, UUID, UUID, UUID, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_highlight_clip(UUID, TEXT, INT, INT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trending_clips(INT, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_tournament_vods(UUID, INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION add_vod_chapter(UUID, TEXT, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_live_events(TEXT, UUID, INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_upcoming_events(INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_viewer_count(TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tournament_stream_rooms(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_live_stream_rooms(UUID) TO authenticated, anon;
