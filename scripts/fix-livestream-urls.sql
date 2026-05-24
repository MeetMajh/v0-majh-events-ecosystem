-- Fix livestream embed URLs to use valid platform embeds
-- Run this in Supabase SQL Editor

-- Update test livestreams with valid embed URLs
UPDATE livestreams 
SET embed_url = CASE 
  WHEN platform = 'twitch' THEN 'https://player.twitch.tv/?channel=majhevents&parent=majhevents.com&parent=localhost'
  WHEN platform = 'youtube' THEN 'https://www.youtube.com/embed/live_stream?channel=UCmajhevents'
  WHEN platform = 'majh' THEN 'https://player.twitch.tv/?channel=majhevents&parent=majhevents.com&parent=localhost'
  ELSE embed_url
END
WHERE embed_url LIKE '%stream.majhevents.com%';

-- Or if you want to use actual live channels for testing, update with real Twitch channels
-- UPDATE livestreams SET embed_url = 'https://player.twitch.tv/?channel=chess&parent=majhevents.com&parent=localhost' WHERE platform = 'majh';

-- Verify the updates
SELECT id, title, platform, embed_url FROM livestreams;
