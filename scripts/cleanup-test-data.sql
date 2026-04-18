-- ============================================================================
-- CLEANUP TEST DATA
-- Removes all test/placeholder data that could give false information
-- ============================================================================

-- Delete test livestreams (fake streams)
DELETE FROM livestreams WHERE title LIKE '%MAJH Spring Championship%';
DELETE FROM livestreams WHERE title LIKE '%Community Tournament%';
DELETE FROM livestreams WHERE channel_name = 'majhcommunity';

-- Delete test stream sources (fake external streams)
DELETE FROM stream_sources WHERE title = 'MAJH Official';
DELETE FROM stream_sources WHERE title = 'Pro Mahjong Stream';
DELETE FROM stream_sources WHERE title = 'Community Table';
DELETE FROM stream_sources WHERE channel_url LIKE '%majhevents%';
DELETE FROM stream_sources WHERE channel_url LIKE '%promahjong%';
DELETE FROM stream_sources WHERE channel_url LIKE '%communitymj%';

-- Delete test live_events if any have fake data
DELETE FROM live_events WHERE title LIKE '%Test%';
DELETE FROM live_events WHERE stream_url LIKE '%example%';
DELETE FROM live_events WHERE stream_url LIKE '%placeholder%';

-- Delete any user_streams that are stuck in "offline" or "ended" state (cleanup)
DELETE FROM user_streams WHERE status IN ('offline', 'ended');

-- Verify cleanup
SELECT 'livestreams' as table_name, COUNT(*) as remaining FROM livestreams
UNION ALL
SELECT 'stream_sources' as table_name, COUNT(*) as remaining FROM stream_sources
UNION ALL
SELECT 'live_events' as table_name, COUNT(*) as remaining FROM live_events
UNION ALL
SELECT 'user_streams' as table_name, COUNT(*) as remaining FROM user_streams;
