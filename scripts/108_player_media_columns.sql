-- Add streaming-related columns to player_media
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS scheduled_live_at TIMESTAMPTZ;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS went_live_at TIMESTAMPTZ;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'upload';
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved';
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS stream_id UUID;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS game_id UUID;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS tournament_id UUID;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS trending_score FLOAT DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS share_count INT DEFAULT 0;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_player_media_scheduled ON player_media(scheduled_live_at) WHERE scheduled_live_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_media_live ON player_media(is_live) WHERE is_live = TRUE;
CREATE INDEX IF NOT EXISTS idx_player_media_source ON player_media(source_type);
