-- Approve all pending media uploads
-- Run this once to approve existing uploads that didn't get auto-moderated

UPDATE player_media 
SET 
  moderation_status = 'approved',
  published_at = COALESCE(published_at, NOW())
WHERE moderation_status = 'pending';

-- Show what was approved
SELECT id, title, moderation_status, created_at, published_at 
FROM player_media 
ORDER BY created_at DESC 
LIMIT 10;
