-- ============================================================================
-- ANALYTICS & CREATOR TABLES
-- For tracking views, follows, and creator stats
-- ============================================================================

-- Media View Events (for analytics)
CREATE TABLE IF NOT EXISTS media_view_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID NOT NULL,
    user_id UUID,
    session_id TEXT,
    watch_time_seconds INT DEFAULT 0,
    total_duration INT,
    watch_percentage FLOAT,
    is_replay BOOLEAN DEFAULT FALSE,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_views_media ON media_view_events(media_id);
CREATE INDEX IF NOT EXISTS idx_media_views_user ON media_view_events(user_id);
CREATE INDEX IF NOT EXISTS idx_media_views_created ON media_view_events(created_at);

-- Player Follows Table
CREATE TABLE IF NOT EXISTS player_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_follows_follower ON player_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_player_follows_player ON player_follows(player_id);

-- RLS
ALTER TABLE media_view_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert view events" ON media_view_events;
DROP POLICY IF EXISTS "Media owners can view analytics" ON media_view_events;
DROP POLICY IF EXISTS "Users can manage their follows" ON player_follows;
DROP POLICY IF EXISTS "Anyone can view follows" ON player_follows;

CREATE POLICY "Anyone can insert view events" ON media_view_events
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can view own analytics" ON media_view_events
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their follows" ON player_follows
    FOR ALL USING (auth.uid() = follower_id);

CREATE POLICY "Anyone can view follows" ON player_follows
    FOR SELECT USING (TRUE);

-- Add creator columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS creator_bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stream_schedule JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_stream_hours FLOAT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS follower_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INT DEFAULT 0;

-- Verify
SELECT 'media_view_events, player_follows, and profile enhancements created' as result;
