-- ============================================================================
-- MAJH STREAMING ECOSYSTEM - COMPLETE TEST DATA
-- Creates live rooms, broadcasts, clips, VODs for full system testing
-- ============================================================================

-- Get the user ID for ownership
DO $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID := '8dd63bc0-1742-478e-8743-dc55ce2b7127';
  v_room1_id UUID;
  v_room2_id UUID;
  v_room3_id UUID;
  v_session_id UUID;
  v_scene1_id UUID;
  v_scene2_id UUID;
  v_source1_id UUID;
  v_source2_id UUID;
  v_live_event_id UUID;
BEGIN
  -- Get first user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Please ensure at least one user exists.';
  END IF;

  -- ========================================
  -- 1. CREATE STREAM ROOMS (Live Tables)
  -- ========================================
  
  -- Feature Match Room (LIVE)
  INSERT INTO stream_rooms (
    id, tenant_id, name, room_type, table_number, status,
    is_feature_room, viewer_count, peak_viewers, started_at
  ) VALUES (
    gen_random_uuid(), v_tenant_id, 'Feature Match - Table 1', 'table', 1, 'live',
    TRUE, 245, 312, NOW() - INTERVAL '35 minutes'
  ) RETURNING id INTO v_room1_id;
  
  -- Add players to room 1
  INSERT INTO player_streams (room_id, user_id, slot_number, player_role, status, playback_url)
  VALUES 
    (v_room1_id, v_user_id, 1, 'player', 'streaming', 'https://stream.majhevents.com/play/' || v_room1_id || '/1'),
    (v_room1_id, v_user_id, 2, 'player', 'streaming', 'https://stream.majhevents.com/play/' || v_room1_id || '/2');
  
  -- Table 2 Room (LIVE)
  INSERT INTO stream_rooms (
    id, tenant_id, name, room_type, table_number, status,
    viewer_count, peak_viewers, started_at
  ) VALUES (
    gen_random_uuid(), v_tenant_id, 'Table 2 Match', 'table', 2, 'live',
    89, 124, NOW() - INTERVAL '22 minutes'
  ) RETURNING id INTO v_room2_id;
  
  INSERT INTO player_streams (room_id, user_id, slot_number, player_role, status, playback_url)
  VALUES 
    (v_room2_id, v_user_id, 1, 'player', 'streaming', 'https://stream.majhevents.com/play/' || v_room2_id || '/1'),
    (v_room2_id, v_user_id, 2, 'player', 'streaming', 'https://stream.majhevents.com/play/' || v_room2_id || '/2');
  
  -- Table 3 Room (Waiting)
  INSERT INTO stream_rooms (
    id, tenant_id, name, room_type, table_number, status
  ) VALUES (
    gen_random_uuid(), v_tenant_id, 'Table 3 - Next Match', 'table', 3, 'waiting'
  ) RETURNING id INTO v_room3_id;

  -- ========================================
  -- 2. CREATE BROADCAST SESSION (Production)
  -- ========================================
  
  INSERT INTO broadcast_sessions (
    id, tenant_id, title, description, producer_id, status,
    is_recording, viewer_count, peak_viewers, total_views, started_at
  ) VALUES (
    gen_random_uuid(), v_tenant_id, 
    'MAJH Spring Championship 2026 - Round 3',
    'Live coverage of Round 3 feature matches with commentary',
    v_user_id, 'live',
    TRUE, 456, 523, 1247, NOW() - INTERVAL '45 minutes'
  ) RETURNING id INTO v_session_id;
  
  -- Add scenes
  INSERT INTO broadcast_scenes (id, session_id, name, scene_type, sort_order, is_program)
  VALUES (gen_random_uuid(), v_session_id, 'Match Overlay', 'match', 1, TRUE)
  RETURNING id INTO v_scene1_id;
  
  INSERT INTO broadcast_scenes (id, session_id, name, scene_type, sort_order, is_preview)
  VALUES (gen_random_uuid(), v_session_id, 'Standings', 'standings', 2, TRUE)
  RETURNING id INTO v_scene2_id;
  
  INSERT INTO broadcast_scenes (session_id, name, scene_type, sort_order)
  VALUES 
    (v_session_id, 'Bracket View', 'bracket', 3),
    (v_session_id, 'BRB Screen', 'brb', 4),
    (v_session_id, 'Interview', 'interview', 5);
  
  -- Add sources
  INSERT INTO broadcast_sources (id, session_id, source_type, name, room_id, is_active)
  VALUES (gen_random_uuid(), v_session_id, 'room', 'Table 1 Feed', v_room1_id, TRUE)
  RETURNING id INTO v_source1_id;
  
  INSERT INTO broadcast_sources (id, session_id, source_type, name, room_id, is_active)
  VALUES (gen_random_uuid(), v_session_id, 'room', 'Table 2 Feed', v_room2_id, TRUE)
  RETURNING id INTO v_source2_id;
  
  INSERT INTO broadcast_sources (session_id, source_type, name, media_url, is_active)
  VALUES 
    (v_session_id, 'overlay', 'Match Scoreboard', '/overlays/scoreboard', TRUE),
    (v_session_id, 'overlay', 'Lower Third', '/overlays/lower-third', TRUE),
    (v_session_id, 'image', 'MAJH Logo', '/images/majh-logo.png', TRUE);
  
  -- Add scene items
  INSERT INTO broadcast_scene_items (scene_id, source_id, x, y, width, height, z_index)
  VALUES 
    (v_scene1_id, v_source1_id, 0, 0, 100, 100, 0),
    (v_scene1_id, v_source2_id, 70, 70, 28, 28, 1);
  
  -- Add outputs
  INSERT INTO broadcast_outputs (session_id, name, platform, rtmp_url, is_active, is_connected)
  VALUES 
    (v_session_id, 'MAJH Live', 'majh', 'rtmps://live.majhevents.com/live', TRUE, TRUE),
    (v_session_id, 'YouTube', 'youtube', 'rtmps://a.rtmp.youtube.com/live2', TRUE, TRUE),
    (v_session_id, 'Twitch', 'twitch', 'rtmps://live.twitch.tv/app', FALSE, FALSE);

  -- ========================================
  -- 3. CREATE LIVE EVENT (Live Hub Entry)
  -- ========================================
  
  INSERT INTO live_events (
    id, tenant_id, broadcast_session_id, title, description,
    stream_url, embed_url, platform, status, is_featured,
    viewer_count, peak_viewers, category, tags, started_at
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_session_id,
    'MAJH Spring Championship 2026 - LIVE',
    'Watch the best players compete in Round 3 of the Spring Championship!',
    'https://live.majhevents.com/watch/' || v_session_id,
    'https://live.majhevents.com/embed/' || v_session_id,
    'majh', 'live', TRUE,
    456, 523, 'tournament',
    ARRAY['championship', 'round3', 'mahjong', 'esports'],
    NOW() - INTERVAL '45 minutes'
  ) RETURNING id INTO v_live_event_id;
  
  -- Add a scheduled event
  INSERT INTO live_events (
    tenant_id, title, description, status, category, tags, scheduled_at
  ) VALUES (
    v_tenant_id,
    'MAJH Spring Championship - Finals Preview',
    'Pre-show coverage and predictions for tomorrow''s finals',
    'scheduled', 'tournament',
    ARRAY['championship', 'finals', 'preview'],
    NOW() + INTERVAL '2 hours'
  );

  -- ========================================
  -- 4. CREATE CLIPS
  -- ========================================
  
  INSERT INTO stream_clips (
    tenant_id, broadcast_session_id, title, description,
    video_url, thumbnail_url, duration_seconds,
    clip_type, highlight_score, status, is_featured, is_public,
    view_count, like_count, share_count, created_by, published_at
  ) VALUES 
    (v_tenant_id, v_session_id, 
     'INSANE Comeback - Down to Last Tile!',
     'Watch this incredible comeback where the player was down to their final tile',
     'https://clips.majhevents.com/clip-001.mp4',
     'https://clips.majhevents.com/thumb-001.jpg',
     42, 'auto_highlight', 0.95, 'ready', TRUE, TRUE,
     1523, 234, 89, v_user_id, NOW() - INTERVAL '2 hours'),
    
    (v_tenant_id, v_session_id,
     'Perfect Hand Declaration',
     'A rare perfect hand scored in round 2',
     'https://clips.majhevents.com/clip-002.mp4',
     'https://clips.majhevents.com/thumb-002.jpg',
     28, 'manual', 0.88, 'ready', FALSE, TRUE,
     892, 156, 45, v_user_id, NOW() - INTERVAL '4 hours'),
    
    (v_tenant_id, NULL,
     'Tournament Highlights Reel',
     'Best moments from Day 1 of the Spring Championship',
     'https://clips.majhevents.com/clip-003.mp4',
     'https://clips.majhevents.com/thumb-003.jpg',
     180, 'manual', 0.92, 'ready', TRUE, TRUE,
     3421, 512, 234, v_user_id, NOW() - INTERVAL '1 day'),
    
    (v_tenant_id, NULL,
     'Clutch Play of the Week',
     'The most talked about play from last week',
     'https://clips.majhevents.com/clip-004.mp4',
     'https://clips.majhevents.com/thumb-004.jpg',
     35, 'clutch', 0.97, 'ready', TRUE, TRUE,
     5892, 823, 412, v_user_id, NOW() - INTERVAL '3 days'),
    
    (v_tenant_id, NULL,
     'New Player Strategy Guide',
     'Tips for beginners from pro players',
     'https://clips.majhevents.com/clip-005.mp4',
     'https://clips.majhevents.com/thumb-005.jpg',
     120, 'manual', 0.75, 'ready', FALSE, TRUE,
     2134, 298, 156, v_user_id, NOW() - INTERVAL '5 days');

  -- ========================================
  -- 5. CREATE VODS
  -- ========================================
  
  INSERT INTO stream_vods (
    tenant_id, title, description, video_url, thumbnail_url,
    duration_seconds, status, is_featured, is_public,
    round_number, view_count, recorded_at, published_at
  ) VALUES 
    (v_tenant_id,
     'Spring Championship 2026 - Round 1 Full Coverage',
     'Complete coverage of all Round 1 matches',
     'https://vods.majhevents.com/vod-001.mp4',
     'https://vods.majhevents.com/thumb-vod-001.jpg',
     7200, 'ready', TRUE, TRUE, 1, 4521,
     NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
    
    (v_tenant_id,
     'Spring Championship 2026 - Round 2 Full Coverage',
     'Complete coverage of all Round 2 matches',
     'https://vods.majhevents.com/vod-002.mp4',
     'https://vods.majhevents.com/thumb-vod-002.jpg',
     6800, 'ready', TRUE, TRUE, 2, 3892,
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours'),
    
    (v_tenant_id,
     'Pro Player Interview - Championship Preview',
     'Exclusive interviews with top players before the championship',
     'https://vods.majhevents.com/vod-003.mp4',
     'https://vods.majhevents.com/thumb-vod-003.jpg',
     1800, 'ready', FALSE, TRUE, NULL, 1245,
     NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days');

  -- Add chapters to VODs
  INSERT INTO vod_chapters (vod_id, title, timestamp_seconds, chapter_type)
  SELECT id, 'Introduction', 0, 'custom' FROM stream_vods WHERE title LIKE '%Round 1%';
  
  INSERT INTO vod_chapters (vod_id, title, timestamp_seconds, chapter_type)
  SELECT id, 'Match 1 Start', 300, 'round_start' FROM stream_vods WHERE title LIKE '%Round 1%';
  
  INSERT INTO vod_chapters (vod_id, title, timestamp_seconds, chapter_type)
  SELECT id, 'Highlight - Amazing Play', 1200, 'highlight' FROM stream_vods WHERE title LIKE '%Round 1%';
  
  INSERT INTO vod_chapters (vod_id, title, timestamp_seconds, chapter_type)
  SELECT id, 'Match 2 Start', 2400, 'round_start' FROM stream_vods WHERE title LIKE '%Round 1%';

  RAISE NOTICE 'Test data created successfully!';
  RAISE NOTICE 'Room 1 ID: %', v_room1_id;
  RAISE NOTICE 'Room 2 ID: %', v_room2_id;
  RAISE NOTICE 'Session ID: %', v_session_id;
  RAISE NOTICE 'Live Event ID: %', v_live_event_id;
  
END $$;

-- ========================================
-- VERIFY DATA
-- ========================================

-- Check live stream rooms
SELECT 'Live Stream Rooms:' as check_type;
SELECT get_live_stream_rooms(NULL);

-- Check live events
SELECT 'Live Events:' as check_type;
SELECT get_live_events(NULL, NULL, 10);

-- Check trending clips
SELECT 'Trending Clips:' as check_type;
SELECT get_trending_clips(10, NULL);

-- Check upcoming events
SELECT 'Upcoming Events:' as check_type;
SELECT get_upcoming_events(5);

-- Summary counts
SELECT 
  (SELECT COUNT(*) FROM stream_rooms WHERE status = 'live') as live_rooms,
  (SELECT COUNT(*) FROM broadcast_sessions WHERE status = 'live') as live_broadcasts,
  (SELECT COUNT(*) FROM live_events WHERE status = 'live') as live_events,
  (SELECT COUNT(*) FROM stream_clips WHERE status = 'ready') as ready_clips,
  (SELECT COUNT(*) FROM stream_vods WHERE status = 'ready') as ready_vods;
