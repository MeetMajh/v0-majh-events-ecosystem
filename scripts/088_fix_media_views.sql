-- Fix media_views table for proper view tracking
-- Add unique constraint if not exists

-- First, drop existing constraint if any
ALTER TABLE media_views DROP CONSTRAINT IF EXISTS media_views_media_user_unique;

-- Add composite unique constraint for upsert to work
-- Allow multiple views per session but one per user
ALTER TABLE media_views ADD CONSTRAINT media_views_media_user_unique 
  UNIQUE NULLS NOT DISTINCT (media_id, user_id);

-- Also ensure the update_media_stats function exists and works
CREATE OR REPLACE FUNCTION update_media_stats(p_media_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE player_media
  SET 
    view_count = (SELECT COUNT(*) FROM media_views WHERE media_id = p_media_id),
    like_count = (SELECT COUNT(*) FROM media_reactions WHERE media_id = p_media_id AND reaction_type = 'like'),
    comment_count = (SELECT COUNT(*) FROM media_comments WHERE media_id = p_media_id AND is_hidden = false),
    updated_at = now()
  WHERE id = p_media_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
