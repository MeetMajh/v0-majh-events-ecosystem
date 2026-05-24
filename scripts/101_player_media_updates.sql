-- ============================================================================
-- PLAYER MEDIA ENHANCEMENTS
-- Adds required columns for streaming, clips, and scheduling
-- ============================================================================

-- Add missing columns to player_media
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved';
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'upload';
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS trending_score FLOAT DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS share_count INT DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS save_count INT DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS game_id UUID;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS tournament_id UUID;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS stream_id UUID;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS scheduled_live_at TIMESTAMPTZ;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS went_live_at TIMESTAMPTZ;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_player_media_moderation ON player_media(moderation_status);
CREATE INDEX IF NOT EXISTS idx_player_media_source ON player_media(source_type);
CREATE INDEX IF NOT EXISTS idx_player_media_trending ON player_media(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_player_media_game ON player_media(game_id);
CREATE INDEX IF NOT EXISTS idx_player_media_scheduled ON player_media(scheduled_live_at) WHERE scheduled_live_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_media_live ON player_media(is_live) WHERE is_live = TRUE;

-- Ensure player_media has proper RLS
ALTER TABLE player_media ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Public can view published media" ON player_media;
DROP POLICY IF EXISTS "Users can manage own media" ON player_media;
DROP POLICY IF EXISTS "Users can insert own media" ON player_media;

CREATE POLICY "Public can view published media" ON player_media
FOR SELECT USING (visibility = 'public' AND moderation_status = 'approved');

CREATE POLICY "Users can view own media" ON player_media
FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "Users can insert own media" ON player_media
FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update own media" ON player_media
FOR UPDATE USING (auth.uid() = player_id);

CREATE POLICY "Users can delete own media" ON player_media
FOR DELETE USING (auth.uid() = player_id);

-- Verify
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'player_media' 
ORDER BY ordinal_position;
