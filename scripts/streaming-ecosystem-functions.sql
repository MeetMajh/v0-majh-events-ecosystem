-- ============================================================================
-- MAJH STREAMING ECOSYSTEM - FUNCTIONS & TRIGGERS
-- Atomic operations for streaming, broadcasting, clips, and analytics
-- ============================================================================

-- ============================================================================
-- 1. CREATE/JOIN STREAM ROOM FOR A MATCH
-- Automatically creates a room when a match is set as feature match
-- ============================================================================
CREATE OR REPLACE FUNCTION create_stream_room_for_match(
  p_match_id UUID,
  p_tournament_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_room_id UUID;
  v_tournament_id UUID;
  v_match RECORD;
  v_room_name TEXT;
BEGIN
  -- Get match info
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;
  
  -- Get tournament ID if not provided
  v_tournament_id := COALESCE(p_tournament_id, (
    SELECT tp.tournament_id 
    FROM tournament_rounds tr 
    JOIN tournament_phases tp ON tr.phase_id = tp.id
    WHERE tr.id = v_match.round_id
  ));
  
  -- Check if room already exists
  SELECT id INTO v_room_id FROM stream_rooms WHERE match_id = p_match_id;
  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;
  
  -- Create room name
  v_room_name := 'Match ' || COALESCE(v_match.table_number::text, 'TBD');
  
  -- Create the room
  INSERT INTO stream_rooms (
    tournament_id, match_id, round_id, name, room_type, table_number, max_streams
  ) VALUES (
    v_tournament_id, p_match_id, v_match.round_id, v_room_name, 'match', v_match.table_number, 4
  ) RETURNING id INTO v_room_id;
  
  -- Create player stream slots
  IF v_match.player1_id IS NOT NULL THEN
    INSERT INTO player_streams (room_id, user_id, slot_number, player_role)
    VALUES (v_room_id, v_match.player1_id, 1, 'player')
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF v_match.player2_id IS NOT NULL THEN
    INSERT INTO player_streams (room_id, user_id, slot_number, player_role)
    VALUES (v_room_id, v_match.player2_id, 2, 'player')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. JOIN STREAM ROOM - Get or create stream credentials for a player
-- ============================================================================
CREATE OR REPLACE FUNCTION join_stream_room(
  p_room_id UUID,
  p_user_id UUID DEFAULT auth.uid(),
  p_role TEXT DEFAULT 'player'
) RETURNS TABLE(
  stream_id UUID,
  stream_key TEXT,
  ingest_url TEXT,
  slot_number INT
) AS $$
DECLARE
  v_room RECORD;
  v_stream RECORD;
  v_slot INT;
BEGIN
  -- Get room
  SELECT * INTO v_room FROM stream_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;
  
  -- Check if user already has a stream in this room
  SELECT * INTO v_stream FROM player_streams WHERE room_id = p_room_id AND user_id = p_user_id;
  
  IF v_stream IS NOT NULL THEN
    RETURN QUERY SELECT v_stream.id, v_stream.stream_key, v_stream.ingest_url, v_stream.slot_number;
    RETURN;
  END IF;
  
  -- Find next available slot
  SELECT COALESCE(MAX(slot_number) + 1, 1) INTO v_slot 
  FROM player_streams WHERE room_id = p_room_id;
  
  IF v_slot > v_room.max_streams THEN
    RAISE EXCEPTION 'Room is full';
  END IF;
  
  -- Create stream slot
  INSERT INTO player_streams (room_id, user_id, slot_number, player_role, ingest_url)
  VALUES (
    p_room_id, 
    p_user_id, 
    v_slot, 
    p_role,
    'wss://stream.majhevents.com/ingest/' || p_room_id || '/' || v_slot
  )
  RETURNING * INTO v_stream;
  
  RETURN QUERY SELECT v_stream.id, v_stream.stream_key, v_stream.ingest_url, v_stream.slot_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. UPDATE STREAM STATUS - Player connect/disconnect/streaming
-- ============================================================================
CREATE OR REPLACE FUNCTION update_stream_status(
  p_stream_id UUID,
  p_status TEXT,
  p_peer_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS BOOLEAN AS $$
DECLARE
  v_stream RECORD;
  v_room_id UUID;
  v_active_streams INT;
BEGIN
  -- Get stream and verify ownership
  SELECT * INTO v_stream FROM player_streams WHERE id = p_stream_id;
  IF NOT FOUND OR v_stream.user_id != p_user_id THEN
    RAISE EXCEPTION 'Stream not found or not authorized';
  END IF;
  
  v_room_id := v_stream.room_id;
  
  -- Update stream status
  UPDATE player_streams 
  SET 
    status = p_status,
    peer_id = COALESCE(p_peer_id, peer_id),
    connected_at = CASE WHEN p_status = 'connected' THEN NOW() ELSE connected_at END,
    last_heartbeat_at = NOW(),
    updated_at = NOW()
  WHERE id = p_stream_id;
  
  -- Update room status based on active streams
  SELECT COUNT(*) INTO v_active_streams 
  FROM player_streams 
  WHERE room_id = v_room_id AND status IN ('connected', 'streaming');
  
  IF p_status = 'streaming' THEN
    UPDATE stream_rooms 
    SET 
      status = 'live',
      started_at = COALESCE(started_at, NOW()),
      updated_at = NOW()
    WHERE id = v_room_id;
  ELSIF v_active_streams = 0 THEN
    UPDATE stream_rooms 
    SET 
      status = 'waiting',
      updated_at = NOW()
    WHERE id = v_room_id AND status != 'ended';
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. CREATE BROADCAST SESSION
-- ============================================================================
CREATE OR REPLACE FUNCTION create_broadcast_session(
  p_title TEXT,
  p_tournament_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Get tenant from tournament or user
  IF p_tournament_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM tournaments WHERE id = p_tournament_id;
  ELSE
    SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = p_user_id;
  END IF;
  
  -- Create session
  INSERT INTO broadcast_sessions (
    tenant_id, tournament_id, title, description, producer_id, status
  ) VALUES (
    v_tenant_id, p_tournament_id, p_title, p_description, p_user_id, 'setup'
  ) RETURNING id INTO v_session_id;
  
  -- Create default scenes
  INSERT INTO broadcast_scenes (session_id, name, scene_type, is_program, sort_order)
  VALUES 
    (v_session_id, 'Main View', 'match', true, 0),
    (v_session_id, 'Standings', 'standings', false, 1),
    (v_session_id, 'Bracket', 'bracket', false, 2),
    (v_session_id, 'BRB Screen', 'brb', false, 3);
  
  -- Create default MAJH output
  INSERT INTO broadcast_outputs (session_id, name, platform, rtmp_url)
  VALUES (v_session_id, 'MAJH Live', 'majh', 'rtmps://live.majhevents.com/live');
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. ADD SOURCE TO BROADCAST
-- ============================================================================
CREATE OR REPLACE FUNCTION add_broadcast_source(
  p_session_id UUID,
  p_source_type TEXT,
  p_name TEXT,
  p_player_stream_id UUID DEFAULT NULL,
  p_room_id UUID DEFAULT NULL,
  p_media_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_source_id UUID;
BEGIN
  INSERT INTO broadcast_sources (
    session_id, source_type, name, player_stream_id, room_id, media_url
  ) VALUES (
    p_session_id, p_source_type, p_name, p_player_stream_id, p_room_id, p_media_url
  ) RETURNING id INTO v_source_id;
  
  RETURN v_source_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. GO LIVE - Start broadcast
-- ============================================================================
CREATE OR REPLACE FUNCTION start_broadcast(
  p_session_id UUID,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS BOOLEAN AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Get and verify session
  SELECT * INTO v_session FROM broadcast_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_session.producer_id != p_user_id THEN
    RAISE EXCEPTION 'Session not found or not authorized';
  END IF;
  
  IF v_session.status = 'live' THEN
    RETURN TRUE; -- Already live
  END IF;
  
  -- Update session status
  UPDATE broadcast_sessions 
  SET 
    status = 'live',
    started_at = NOW(),
    is_recording = TRUE,
    recording_started_at = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id;
  
  -- Activate outputs
  UPDATE broadcast_outputs
  SET is_active = TRUE, is_connected = TRUE, updated_at = NOW()
  WHERE session_id = p_session_id;
  
  -- Create live event
  INSERT INTO live_events (
    tenant_id, broadcast_session_id, tournament_id, title, status, started_at
  )
  SELECT 
    tenant_id, id, tournament_id, title, 'live', NOW()
  FROM broadcast_sessions 
  WHERE id = p_session_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. END BROADCAST
-- ============================================================================
CREATE OR REPLACE FUNCTION end_broadcast(
  p_session_id UUID,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS UUID AS $$ -- Returns VOD ID
DECLARE
  v_session RECORD;
  v_vod_id UUID;
BEGIN
  -- Get session
  SELECT * INTO v_session FROM broadcast_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_session.producer_id != p_user_id THEN
    RAISE EXCEPTION 'Session not found or not authorized';
  END IF;
  
  -- Calculate duration
  UPDATE broadcast_sessions 
  SET 
    status = 'ended',
    ended_at = NOW(),
    is_recording = FALSE,
    updated_at = NOW()
  WHERE id = p_session_id;
  
  -- Deactivate outputs
  UPDATE broadcast_outputs
  SET is_active = FALSE, is_connected = FALSE, updated_at = NOW()
  WHERE session_id = p_session_id;
  
  -- Update live event
  UPDATE live_events
  SET 
    status = 'ended',
    ended_at = NOW(),
    updated_at = NOW()
  WHERE broadcast_session_id = p_session_id;
  
  -- Create VOD from recording
  INSERT INTO stream_vods (
    tenant_id, broadcast_session_id, tournament_id, title, 
    video_url, status, recorded_at
  )
  SELECT 
    tenant_id, id, tournament_id, title || ' (VOD)',
    recording_url, 'processing', started_at
  FROM broadcast_sessions 
  WHERE id = p_session_id AND recording_url IS NOT NULL
  RETURNING id INTO v_vod_id;
  
  RETURN v_vod_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. CREATE CLIP - Manual clip creation
-- ============================================================================
CREATE OR REPLACE FUNCTION create_clip(
  p_title TEXT,
  p_start_seconds INT,
  p_end_seconds INT,
  p_source_type TEXT, -- 'broadcast' or 'room'
  p_source_id UUID,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS UUID AS $$
DECLARE
  v_clip_id UUID;
  v_tenant_id UUID;
  v_tournament_id UUID;
  v_match_id UUID;
BEGIN
  -- Get context based on source
  IF p_source_type = 'broadcast' THEN
    SELECT tenant_id, tournament_id INTO v_tenant_id, v_tournament_id
    FROM broadcast_sessions WHERE id = p_source_id;
  ELSE
    SELECT tenant_id, tournament_id, match_id INTO v_tenant_id, v_tournament_id, v_match_id
    FROM stream_rooms WHERE id = p_source_id;
  END IF;
  
  -- Create clip (video processing would happen async)
  INSERT INTO stream_clips (
    tenant_id, broadcast_session_id, room_id, tournament_id, match_id,
    title, created_by, 
    video_url, duration_seconds, start_time_seconds, end_time_seconds,
    clip_type, status
  ) VALUES (
    v_tenant_id, 
    CASE WHEN p_source_type = 'broadcast' THEN p_source_id ELSE NULL END,
    CASE WHEN p_source_type = 'room' THEN p_source_id ELSE NULL END,
    v_tournament_id, v_match_id,
    p_title, p_user_id,
    '', p_end_seconds - p_start_seconds, p_start_seconds, p_end_seconds,
    'manual', 'processing'
  ) RETURNING id INTO v_clip_id;
  
  RETURN v_clip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. AUTO-GENERATE HIGHLIGHT CLIPS
-- Called when score changes or reaction spikes are detected
-- ============================================================================
CREATE OR REPLACE FUNCTION create_auto_highlight(
  p_match_id UUID,
  p_highlight_type TEXT,
  p_timestamp_seconds INT,
  p_duration_seconds INT DEFAULT 30,
  p_highlight_score NUMERIC DEFAULT 0.5,
  p_context JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_clip_id UUID;
  v_room RECORD;
  v_start_time INT;
  v_end_time INT;
  v_title TEXT;
BEGIN
  -- Get room for this match
  SELECT * INTO v_room FROM stream_rooms WHERE match_id = p_match_id AND status = 'live';
  IF NOT FOUND THEN
    RETURN NULL; -- No active stream
  END IF;
  
  -- Calculate clip boundaries (capture 10s before, 20s after)
  v_start_time := GREATEST(0, p_timestamp_seconds - 10);
  v_end_time := p_timestamp_seconds + 20;
  
  -- Generate title based on type
  v_title := CASE p_highlight_type
    WHEN 'score_change' THEN 'Score Update'
    WHEN 'momentum_shift' THEN 'Momentum Shift'
    WHEN 'clutch_moment' THEN 'Clutch Play'
    WHEN 'reaction_spike' THEN 'Hype Moment'
    ELSE 'Highlight'
  END;
  
  -- Create clip
  INSERT INTO stream_clips (
    tenant_id, room_id, match_id, tournament_id,
    title, 
    video_url, duration_seconds, start_time_seconds, end_time_seconds,
    clip_type, highlight_score, status
  ) VALUES (
    v_room.tenant_id, v_room.id, p_match_id, v_room.tournament_id,
    v_title,
    '', v_end_time - v_start_time, v_start_time, v_end_time,
    'auto_highlight', p_highlight_score, 'processing'
  ) RETURNING id INTO v_clip_id;
  
  RETURN v_clip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. UPDATE VIEWER COUNTS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_viewer_count(
  p_target_type TEXT, -- 'room', 'broadcast', 'live_event'
  p_target_id UUID,
  p_delta INT -- +1 for join, -1 for leave
) RETURNS INT AS $$
DECLARE
  v_new_count INT;
BEGIN
  IF p_target_type = 'room' THEN
    UPDATE stream_rooms 
    SET 
      viewer_count = GREATEST(0, viewer_count + p_delta),
      peak_viewers = GREATEST(peak_viewers, viewer_count + p_delta),
      updated_at = NOW()
    WHERE id = p_target_id
    RETURNING viewer_count INTO v_new_count;
    
  ELSIF p_target_type = 'broadcast' THEN
    UPDATE broadcast_sessions 
    SET 
      viewer_count = GREATEST(0, viewer_count + p_delta),
      peak_viewers = GREATEST(peak_viewers, viewer_count + p_delta),
      total_views = total_views + CASE WHEN p_delta > 0 THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE id = p_target_id
    RETURNING viewer_count INTO v_new_count;
    
  ELSIF p_target_type = 'live_event' THEN
    UPDATE live_events 
    SET 
      viewer_count = GREATEST(0, viewer_count + p_delta),
      peak_viewers = GREATEST(peak_viewers, viewer_count + p_delta),
      updated_at = NOW()
    WHERE id = p_target_id
    RETURNING viewer_count INTO v_new_count;
  END IF;
  
  RETURN COALESCE(v_new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 11. GET LIVE STREAMS FOR TOURNAMENT
-- ============================================================================
CREATE OR REPLACE FUNCTION get_tournament_streams(p_tournament_id UUID)
RETURNS TABLE (
  room_id UUID,
  room_name TEXT,
  match_id UUID,
  table_number INT,
  status TEXT,
  viewer_count INT,
  is_feature_room BOOLEAN,
  streams JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sr.id as room_id,
    sr.name as room_name,
    sr.match_id,
    sr.table_number,
    sr.status,
    sr.viewer_count,
    sr.is_feature_room,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ps.id,
          'user_id', ps.user_id,
          'slot_number', ps.slot_number,
          'status', ps.status,
          'playback_url', ps.playback_url,
          'player_role', ps.player_role
        )
      ) FILTER (WHERE ps.id IS NOT NULL),
      '[]'::jsonb
    ) as streams
  FROM stream_rooms sr
  LEFT JOIN player_streams ps ON ps.room_id = sr.id
  WHERE sr.tournament_id = p_tournament_id
    AND sr.status != 'ended'
  GROUP BY sr.id
  ORDER BY sr.is_feature_room DESC, sr.table_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 12. GET ACTIVE LIVE EVENTS FOR HUB
-- ============================================================================
CREATE OR REPLACE FUNCTION get_live_hub_events(
  p_limit INT DEFAULT 20,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  stream_url TEXT,
  embed_url TEXT,
  platform TEXT,
  viewer_count INT,
  is_featured BOOLEAN,
  category TEXT,
  tags TEXT[],
  tournament_name TEXT,
  started_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    le.id,
    le.title,
    le.description,
    le.thumbnail_url,
    le.stream_url,
    le.embed_url,
    le.platform,
    le.viewer_count,
    le.is_featured,
    le.category,
    le.tags,
    t.name as tournament_name,
    le.started_at
  FROM live_events le
  LEFT JOIN tournaments t ON t.id = le.tournament_id
  WHERE le.status = 'live'
    AND (p_category IS NULL OR le.category = p_category)
  ORDER BY le.is_featured DESC, le.viewer_count DESC, le.started_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 13. SWITCH BROADCAST SCENE
-- ============================================================================
CREATE OR REPLACE FUNCTION switch_broadcast_scene(
  p_session_id UUID,
  p_scene_id UUID,
  p_transition TEXT DEFAULT 'cut',
  p_user_id UUID DEFAULT auth.uid()
) RETURNS BOOLEAN AS $$
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM broadcast_sessions 
    WHERE id = p_session_id AND producer_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Move current program to preview
  UPDATE broadcast_scenes
  SET is_preview = is_program, is_program = FALSE, updated_at = NOW()
  WHERE session_id = p_session_id AND is_program = TRUE;
  
  -- Make target scene program
  UPDATE broadcast_scenes
  SET is_program = TRUE, is_preview = FALSE, updated_at = NOW()
  WHERE id = p_scene_id AND session_id = p_session_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-create stream room when match becomes feature match
CREATE OR REPLACE FUNCTION trigger_create_stream_room()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_feature_match = TRUE AND (OLD.is_feature_match IS NULL OR OLD.is_feature_match = FALSE) THEN
    PERFORM create_stream_room_for_match(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_stream_room ON tournament_matches;
CREATE TRIGGER auto_create_stream_room
  AFTER UPDATE OF is_feature_match ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_stream_room();

-- Auto-end stream rooms when match completes
CREATE OR REPLACE FUNCTION trigger_end_stream_room()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') THEN
    UPDATE stream_rooms 
    SET status = 'ended', ended_at = NOW(), updated_at = NOW()
    WHERE match_id = NEW.id AND status != 'ended';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_end_stream_room ON tournament_matches;
CREATE TRIGGER auto_end_stream_room
  AFTER UPDATE OF status ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_end_stream_room();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_streaming_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stream_rooms_timestamp BEFORE UPDATE ON stream_rooms
  FOR EACH ROW EXECUTE FUNCTION update_streaming_timestamp();
CREATE TRIGGER player_streams_timestamp BEFORE UPDATE ON player_streams
  FOR EACH ROW EXECUTE FUNCTION update_streaming_timestamp();
CREATE TRIGGER broadcast_sessions_timestamp BEFORE UPDATE ON broadcast_sessions
  FOR EACH ROW EXECUTE FUNCTION update_streaming_timestamp();
CREATE TRIGGER broadcast_sources_timestamp BEFORE UPDATE ON broadcast_sources
  FOR EACH ROW EXECUTE FUNCTION update_streaming_timestamp();
CREATE TRIGGER broadcast_scenes_timestamp BEFORE UPDATE ON broadcast_scenes
  FOR EACH ROW EXECUTE FUNCTION update_streaming_timestamp();
CREATE TRIGGER broadcast_scene_items_timestamp BEFORE UPDATE ON broadcast_scene_items
  FOR EACH ROW EXECUTE FUNCTION update_streaming_timestamp();
CREATE TRIGGER broadcast_outputs_timestamp BEFORE UPDATE ON broadcast_outputs
  FOR EACH ROW EXECUTE FUNCTION update_streaming_timestamp();
CREATE TRIGGER stream_clips_timestamp BEFORE UPDATE ON stream_clips
  FOR EACH ROW EXECUTE FUNCTION update_streaming_timestamp();
CREATE TRIGGER stream_vods_timestamp BEFORE UPDATE ON stream_vods
  FOR EACH ROW EXECUTE FUNCTION update_streaming_timestamp();
CREATE TRIGGER live_events_timestamp BEFORE UPDATE ON live_events
  FOR EACH ROW EXECUTE FUNCTION update_streaming_timestamp();

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT EXECUTE ON FUNCTION create_stream_room_for_match TO authenticated;
GRANT EXECUTE ON FUNCTION join_stream_room TO authenticated;
GRANT EXECUTE ON FUNCTION update_stream_status TO authenticated;
GRANT EXECUTE ON FUNCTION create_broadcast_session TO authenticated;
GRANT EXECUTE ON FUNCTION add_broadcast_source TO authenticated;
GRANT EXECUTE ON FUNCTION start_broadcast TO authenticated;
GRANT EXECUTE ON FUNCTION end_broadcast TO authenticated;
GRANT EXECUTE ON FUNCTION create_clip TO authenticated;
GRANT EXECUTE ON FUNCTION create_auto_highlight TO authenticated;
GRANT EXECUTE ON FUNCTION update_viewer_count TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_tournament_streams TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_live_hub_events TO authenticated, anon;
GRANT EXECUTE ON FUNCTION switch_broadcast_scene TO authenticated;
