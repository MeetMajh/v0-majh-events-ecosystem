-- ============================================================================
-- COMPLETE PLAYER_MEDIA COLUMNS FOR STREAMING ECOSYSTEM
-- Adds all columns needed for upload, scheduling, feed, and analytics
-- ============================================================================

-- Core streaming/scheduling columns
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS scheduled_live_at TIMESTAMPTZ;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS went_live_at TIMESTAMPTZ;

-- Media storage columns
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Source and moderation
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'upload';
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved';

-- Engagement metrics
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS share_count INT DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS save_count INT DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS trending_score FLOAT DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- Relationships
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS game_id UUID;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS tournament_id UUID;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS stream_id UUID;

-- Duration for videos
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS duration_seconds INT;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_player_media_scheduled ON player_media(scheduled_live_at) WHERE scheduled_live_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_media_live ON player_media(is_live) WHERE is_live = TRUE;
CREATE INDEX IF NOT EXISTS idx_player_media_source ON player_media(source_type);
CREATE INDEX IF NOT EXISTS idx_player_media_moderation ON player_media(moderation_status);
CREATE INDEX IF NOT EXISTS idx_player_media_trending ON player_media(trending_score DESC);
