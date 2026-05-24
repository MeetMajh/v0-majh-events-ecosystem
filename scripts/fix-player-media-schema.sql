-- ============================================================================
-- FIX PLAYER_MEDIA SCHEMA
-- Ensures player_media table has all required columns and approves existing uploads
-- ============================================================================

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- source_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'source_type') THEN
    ALTER TABLE player_media ADD COLUMN source_type TEXT DEFAULT 'upload';
  END IF;
  
  -- video_url column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'video_url') THEN
    ALTER TABLE player_media ADD COLUMN video_url TEXT;
  END IF;
  
  -- embed_url column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'embed_url') THEN
    ALTER TABLE player_media ADD COLUMN embed_url TEXT;
  END IF;
  
  -- storage_path column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'storage_path') THEN
    ALTER TABLE player_media ADD COLUMN storage_path TEXT;
  END IF;
  
  -- moderation_status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'moderation_status') THEN
    ALTER TABLE player_media ADD COLUMN moderation_status TEXT DEFAULT 'approved';
  END IF;
  
  -- trending_score column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'trending_score') THEN
    ALTER TABLE player_media ADD COLUMN trending_score INT DEFAULT 0;
  END IF;
  
  -- is_featured column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'is_featured') THEN
    ALTER TABLE player_media ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- comment_count column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'comment_count') THEN
    ALTER TABLE player_media ADD COLUMN comment_count INT DEFAULT 0;
  END IF;
  
  -- game_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'game_id') THEN
    ALTER TABLE player_media ADD COLUMN game_id UUID REFERENCES games(id);
  END IF;
  
  -- tournament_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'tournament_id') THEN
    ALTER TABLE player_media ADD COLUMN tournament_id UUID;
  END IF;
  
  -- match_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'match_id') THEN
    ALTER TABLE player_media ADD COLUMN match_id UUID;
  END IF;
  
  -- duration_seconds column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_media' AND column_name = 'duration_seconds') THEN
    ALTER TABLE player_media ADD COLUMN duration_seconds INT;
  END IF;
END $$;

-- Migrate existing data: copy url to video_url if video_url is null
UPDATE player_media 
SET video_url = url 
WHERE video_url IS NULL AND url IS NOT NULL;

-- Set moderation_status to 'approved' for all existing content
UPDATE player_media 
SET moderation_status = 'approved' 
WHERE moderation_status IS NULL OR moderation_status = 'pending';

-- Set source_type to 'upload' for all existing content
UPDATE player_media 
SET source_type = 'upload' 
WHERE source_type IS NULL;

-- Fix media_type values (video -> clip for consistency)
UPDATE player_media 
SET media_type = 'clip' 
WHERE media_type = 'video';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_player_media_moderation ON player_media(moderation_status);
CREATE INDEX IF NOT EXISTS idx_player_media_trending ON player_media(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_player_media_featured ON player_media(is_featured) WHERE is_featured = TRUE;

-- Verify the fix
SELECT 
  COUNT(*) as total_media,
  COUNT(*) FILTER (WHERE moderation_status = 'approved') as approved,
  COUNT(*) FILTER (WHERE visibility = 'public') as public_media,
  COUNT(*) FILTER (WHERE video_url IS NOT NULL) as with_video_url
FROM player_media;
