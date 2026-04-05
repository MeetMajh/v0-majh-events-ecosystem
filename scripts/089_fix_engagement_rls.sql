-- Fix RLS policies for media engagement (reactions, views, comments)

-- ==========================================
-- MEDIA_REACTIONS - Allow users to add/remove their reactions
-- ==========================================

-- Drop ALL possible policy names (for idempotency)
DROP POLICY IF EXISTS "Reactions are viewable by everyone" ON media_reactions;
DROP POLICY IF EXISTS "Users can manage their own reactions" ON media_reactions;
DROP POLICY IF EXISTS "Users can insert reactions" ON media_reactions;
DROP POLICY IF EXISTS "Users can delete reactions" ON media_reactions;
DROP POLICY IF EXISTS "Anyone can view reactions" ON media_reactions;
DROP POLICY IF EXISTS "Authenticated users can insert reactions" ON media_reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON media_reactions;

-- Create new policies
CREATE POLICY "Anyone can view reactions" ON media_reactions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert reactions" ON media_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions" ON media_reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ==========================================
-- MEDIA_VIEWS - Allow anyone to insert views
-- ==========================================

-- Drop ALL possible policy names (for idempotency)
DROP POLICY IF EXISTS "Views can be inserted by anyone" ON media_views;
DROP POLICY IF EXISTS "Anyone can insert views" ON media_views;
DROP POLICY IF EXISTS "Anyone can view views" ON media_views;

-- Allow anyone (including anonymous) to insert views
CREATE POLICY "Anyone can insert views" ON media_views
  FOR INSERT 
  WITH CHECK (true);

-- Allow reading views (for stats)
CREATE POLICY "Anyone can view views" ON media_views
  FOR SELECT USING (true);

-- ==========================================
-- MEDIA_COMMENTS - Allow authenticated users to comment
-- ==========================================

-- Drop ALL possible policy names (for idempotency)
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON media_comments;
DROP POLICY IF EXISTS "Users can create comments" ON media_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON media_comments;
DROP POLICY IF EXISTS "Anyone can view comments" ON media_comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON media_comments;

CREATE POLICY "Anyone can view comments" ON media_comments
  FOR SELECT USING (is_hidden = false);

CREATE POLICY "Authenticated users can insert comments" ON media_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON media_comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ==========================================
-- FIX MEDIA_VIEWS TABLE - Remove session_id, fix constraint
-- ==========================================

-- Remove session_id column if it exists (we don't need it)
ALTER TABLE media_views DROP COLUMN IF EXISTS session_id;

-- Ensure the unique constraint exists for logged-in user views
-- First drop if exists to avoid conflict
ALTER TABLE media_views DROP CONSTRAINT IF EXISTS media_views_media_user_unique;

-- Add the constraint back with NULLS NOT DISTINCT so null user_ids don't conflict
ALTER TABLE media_views ADD CONSTRAINT media_views_media_user_unique 
  UNIQUE NULLS NOT DISTINCT (media_id, user_id);

-- ==========================================
-- UPDATE_MEDIA_STATS FUNCTION
-- ==========================================

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

SELECT 'Engagement RLS policies fixed!' AS status;
