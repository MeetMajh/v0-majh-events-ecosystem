-- ============================================================================
-- STREAMING ECOSYSTEM COMPLETE
-- Full integration for: MAJH Studio, Upload Media, Clips, VODs, Multi-streaming
-- Run this in Supabase SQL Editor
-- ============================================================================

-- =============================================
-- 1. ENSURE player_media HAS ALL REQUIRED COLUMNS
-- =============================================

-- Add missing columns to player_media if they don't exist
DO $$ 
BEGIN
    -- Add moderation_status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'moderation_status') THEN
        ALTER TABLE player_media ADD COLUMN moderation_status TEXT DEFAULT 'approved' 
            CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
    END IF;

    -- Add source_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'source_type') THEN
        ALTER TABLE player_media ADD COLUMN source_type TEXT DEFAULT 'upload'
            CHECK (source_type IN ('upload', 'clip', 'vod', 'stream'));
    END IF;

    -- Add video_url column (alias for url)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'video_url') THEN
        ALTER TABLE player_media ADD COLUMN video_url TEXT;
    END IF;

    -- Add storage_path column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'storage_path') THEN
        ALTER TABLE player_media ADD COLUMN storage_path TEXT;
    END IF;

    -- Add trending_score column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'trending_score') THEN
        ALTER TABLE player_media ADD COLUMN trending_score FLOAT DEFAULT 0;
    END IF;

    -- Add is_featured column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'is_featured') THEN
        ALTER TABLE player_media ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add comment_count column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'comment_count') THEN
        ALTER TABLE player_media ADD COLUMN comment_count INT DEFAULT 0;
    END IF;

    -- Add share_count column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'share_count') THEN
        ALTER TABLE player_media ADD COLUMN share_count INT DEFAULT 0;
    END IF;

    -- Add save_count column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'save_count') THEN
        ALTER TABLE player_media ADD COLUMN save_count INT DEFAULT 0;
    END IF;

    -- Add game_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'game_id') THEN
        ALTER TABLE player_media ADD COLUMN game_id UUID;
    END IF;

    -- Add tournament_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'tournament_id') THEN
        ALTER TABLE player_media ADD COLUMN tournament_id UUID;
    END IF;

    -- Add stream_id column (link to source stream)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'stream_id') THEN
        ALTER TABLE player_media ADD COLUMN stream_id UUID;
    END IF;

    -- Add scheduled_live_at column for scheduled content
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'scheduled_live_at') THEN
        ALTER TABLE player_media ADD COLUMN scheduled_live_at TIMESTAMPTZ;
    END IF;

    -- Add is_live column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'is_live') THEN
        ALTER TABLE player_media ADD COLUMN is_live BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add went_live_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'player_media' AND column_name = 'went_live_at') THEN
        ALTER TABLE player_media ADD COLUMN went_live_at TIMESTAMPTZ;
    END IF;
END $$;

-- Update constraint for media_type to include more types
ALTER TABLE player_media DROP CONSTRAINT IF EXISTS player_media_media_type_check;
ALTER TABLE player_media ADD CONSTRAINT player_media_media_type_check 
    CHECK (media_type IN ('image', 'video', 'clip', 'vod', 'highlight', 'stream_recording'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_player_media_moderation ON player_media(moderation_status);
CREATE INDEX IF NOT EXISTS idx_player_media_source ON player_media(source_type);
CREATE INDEX IF NOT EXISTS idx_player_media_trending ON player_media(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_player_media_game ON player_media(game_id);
CREATE INDEX IF NOT EXISTS idx_player_media_scheduled ON player_media(scheduled_live_at) WHERE scheduled_live_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_media_live ON player_media(is_live) WHERE is_live = TRUE;

-- =============================================
-- 2. STREAM_SESSIONS TABLE (MAJH Studio)
-- =============================================

CREATE TABLE IF NOT EXISTS stream_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    game_id UUID REFERENCES games(id),
    category TEXT,
    livekit_room_name TEXT UNIQUE,
    stream_key TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'live', 'ended')),
    visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
    viewer_count INT DEFAULT 0,
    peak_viewers INT DEFAULT 0,
    total_views INT DEFAULT 0,
    total_chat_messages INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    thumbnail_url TEXT,
    vod_url TEXT,
    vod_media_id UUID, -- Link to player_media for VOD
    multistream_enabled BOOLEAN DEFAULT FALSE,
    chat_enabled BOOLEAN DEFAULT TRUE,
    clips_enabled BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_stream_sessions_user ON stream_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_status ON stream_sessions(status);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_live ON stream_sessions(status) WHERE status = 'live';

-- =============================================
-- 3. MULTISTREAM DESTINATIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS multistream_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'twitch', 'kick', 'facebook', 'custom')),
    name TEXT NOT NULL,
    rtmp_url TEXT NOT NULL,
    stream_key TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    is_connected BOOLEAN DEFAULT FALSE,
    last_connected_at TIMESTAMPTZ,
    connection_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_multistream_user ON multistream_destinations(user_id);
CREATE INDEX IF NOT EXISTS idx_multistream_enabled ON multistream_destinations(user_id, is_enabled) WHERE is_enabled = TRUE;

-- =============================================
-- 4. STREAM LAYOUTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS stream_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Default Layout',
    layout_data JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_stream_layouts_user ON stream_layouts(user_id);

-- =============================================
-- 5. STREAM OVERLAYS & ASSETS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS stream_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('overlay', 'logo', 'banner', 'stinger', 'alert', 'scene_background')),
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    storage_path TEXT,
    is_preset BOOLEAN DEFAULT FALSE, -- True for system presets
    category TEXT, -- e.g., 'esports', 'gaming', 'minimal'
    metadata JSONB DEFAULT '{}', -- Size, animation settings, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_assets_user ON stream_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_assets_type ON stream_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_stream_assets_preset ON stream_assets(is_preset) WHERE is_preset = TRUE;

-- Insert default preset overlays
INSERT INTO stream_assets (user_id, asset_type, name, file_url, is_preset, category, metadata) VALUES
    ('00000000-0000-0000-0000-000000000000', 'overlay', 'Gaming Overlay - Blue', '/presets/overlays/gaming-blue.png', true, 'gaming', '{"style": "blue", "theme": "gaming"}'),
    ('00000000-0000-0000-0000-000000000000', 'overlay', 'Esports Overlay - Red', '/presets/overlays/esports-red.png', true, 'esports', '{"style": "red", "theme": "esports"}'),
    ('00000000-0000-0000-0000-000000000000', 'overlay', 'Minimal Stream', '/presets/overlays/minimal.png', true, 'minimal', '{"style": "clean", "theme": "minimal"}'),
    ('00000000-0000-0000-0000-000000000000', 'scene_background', 'Stream Starting BG', '/presets/backgrounds/starting-soon.png', true, 'general', '{"type": "starting"}'),
    ('00000000-0000-0000-0000-000000000000', 'scene_background', 'BRB Background', '/presets/backgrounds/brb.png', true, 'general', '{"type": "brb"}')
ON CONFLICT DO NOTHING;

-- =============================================
-- 6. CREATOR PROFILES EXTENSION
-- =============================================

-- Add creator-specific columns to profiles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'is_creator') THEN
        ALTER TABLE profiles ADD COLUMN is_creator BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'creator_bio') THEN
        ALTER TABLE profiles ADD COLUMN creator_bio TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'banner_url') THEN
        ALTER TABLE profiles ADD COLUMN banner_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'social_links') THEN
        ALTER TABLE profiles ADD COLUMN social_links JSONB DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'stream_schedule') THEN
        ALTER TABLE profiles ADD COLUMN stream_schedule JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'total_stream_hours') THEN
        ALTER TABLE profiles ADD COLUMN total_stream_hours FLOAT DEFAULT 0;
    END IF;
END $$;

-- =============================================
-- 7. TEAM PROFILES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS team_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE UNIQUE,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    social_links JSONB DEFAULT '{}',
    achievements JSONB DEFAULT '[]',
    contact_email TEXT,
    website_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_profiles_team ON team_profiles(team_id);

-- =============================================
-- 8. ORGANIZATION PROFILES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS organization_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    social_links JSONB DEFAULT '{}',
    contact_email TEXT,
    website_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    stream_branding JSONB DEFAULT '{}', -- Logo overlays, colors, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_profiles_org ON organization_profiles(organization_id);

-- =============================================
-- 9. MEDIA VIEW EVENTS TABLE (for analytics)
-- =============================================

CREATE TABLE IF NOT EXISTS media_view_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID NOT NULL REFERENCES player_media(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT,
    watch_time_seconds INT DEFAULT 0,
    total_duration INT,
    watch_percentage FLOAT,
    is_replay BOOLEAN DEFAULT FALSE,
    source TEXT, -- 'feed', 'search', 'profile', 'direct'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_views_media ON media_view_events(media_id);
CREATE INDEX IF NOT EXISTS idx_media_views_user ON media_view_events(user_id);
CREATE INDEX IF NOT EXISTS idx_media_views_created ON media_view_events(created_at);

-- =============================================
-- 10. PLAYER FOLLOWS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS player_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_follows_follower ON player_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_player_follows_player ON player_follows(player_id);

-- =============================================
-- 11. FEED SESSIONS & INTERACTIONS TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS feed_sessions (
    session_id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feed_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT,
    item_type TEXT NOT NULL,
    item_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('view', 'like', 'share', 'skip', 'comment', 'save')),
    watch_duration_seconds INT,
    watch_percentage FLOAT,
    position_in_feed INT,
    feed_session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_interactions_user ON feed_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_interactions_item ON feed_interactions(item_id);

-- =============================================
-- 12. RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE stream_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE multistream_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_view_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_interactions ENABLE ROW LEVEL SECURITY;

-- Stream Sessions RLS
DROP POLICY IF EXISTS "Users can view their own sessions" ON stream_sessions;
DROP POLICY IF EXISTS "Users can manage their own sessions" ON stream_sessions;
DROP POLICY IF EXISTS "Public can view live sessions" ON stream_sessions;

CREATE POLICY "Users can view their own sessions" ON stream_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sessions" ON stream_sessions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public can view live sessions" ON stream_sessions
    FOR SELECT USING (status = 'live' AND visibility = 'public');

-- Multistream Destinations RLS
DROP POLICY IF EXISTS "Users can manage their destinations" ON multistream_destinations;
CREATE POLICY "Users can manage their destinations" ON multistream_destinations
    FOR ALL USING (auth.uid() = user_id);

-- Stream Layouts RLS
DROP POLICY IF EXISTS "Users can manage their layouts" ON stream_layouts;
CREATE POLICY "Users can manage their layouts" ON stream_layouts
    FOR ALL USING (auth.uid() = user_id);

-- Stream Assets RLS
DROP POLICY IF EXISTS "Users can manage their assets" ON stream_assets;
DROP POLICY IF EXISTS "Anyone can view presets" ON stream_assets;

CREATE POLICY "Users can manage their assets" ON stream_assets
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view presets" ON stream_assets
    FOR SELECT USING (is_preset = TRUE);

-- Team Profiles RLS
DROP POLICY IF EXISTS "Anyone can view team profiles" ON team_profiles;
DROP POLICY IF EXISTS "Team members can update profile" ON team_profiles;

CREATE POLICY "Anyone can view team profiles" ON team_profiles
    FOR SELECT USING (TRUE);

CREATE POLICY "Team members can update profile" ON team_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM team_members 
            WHERE team_members.team_id = team_profiles.team_id 
            AND team_members.player_id = auth.uid()
            AND team_members.role IN ('owner', 'captain', 'manager')
        )
    );

-- Organization Profiles RLS
DROP POLICY IF EXISTS "Anyone can view org profiles" ON organization_profiles;
CREATE POLICY "Anyone can view org profiles" ON organization_profiles
    FOR SELECT USING (TRUE);

-- Media View Events RLS
DROP POLICY IF EXISTS "Users can insert view events" ON media_view_events;
DROP POLICY IF EXISTS "Media owners can view analytics" ON media_view_events;

CREATE POLICY "Users can insert view events" ON media_view_events
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Media owners can view analytics" ON media_view_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM player_media 
            WHERE player_media.id = media_view_events.media_id 
            AND player_media.player_id = auth.uid()
        )
    );

-- Player Follows RLS
DROP POLICY IF EXISTS "Users can manage their follows" ON player_follows;
DROP POLICY IF EXISTS "Anyone can view follows" ON player_follows;

CREATE POLICY "Users can manage their follows" ON player_follows
    FOR ALL USING (auth.uid() = follower_id);

CREATE POLICY "Anyone can view follows" ON player_follows
    FOR SELECT USING (TRUE);

-- Feed Sessions/Interactions RLS
DROP POLICY IF EXISTS "Users can manage feed sessions" ON feed_sessions;
DROP POLICY IF EXISTS "Users can manage feed interactions" ON feed_interactions;

CREATE POLICY "Users can manage feed sessions" ON feed_sessions
    FOR ALL USING (TRUE);

CREATE POLICY "Users can manage feed interactions" ON feed_interactions
    FOR ALL USING (TRUE);

-- =============================================
-- 13. PLAYER_MEDIA FULL RLS
-- =============================================

DROP POLICY IF EXISTS "Users can view their own media" ON player_media;
DROP POLICY IF EXISTS "Users can manage their own media" ON player_media;
DROP POLICY IF EXISTS "Public can view public approved media" ON player_media;
DROP POLICY IF EXISTS "Users can insert their own media" ON player_media;

CREATE POLICY "Users can view their own media" ON player_media
    FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "Users can manage their own media" ON player_media
    FOR ALL USING (auth.uid() = player_id);

CREATE POLICY "Users can insert their own media" ON player_media
    FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Public can view public approved media" ON player_media
    FOR SELECT USING (visibility = 'public' AND moderation_status = 'approved');

-- =============================================
-- 14. STORAGE BUCKETS
-- =============================================

-- Create storage buckets for media and assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('player-media', 'player-media', true, 52428800, ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']),
    ('stream-assets', 'stream-assets', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
    ('profile-assets', 'profile-assets', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies
DROP POLICY IF EXISTS "Users can upload to player-media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view player-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their player-media" ON storage.objects;

CREATE POLICY "Users can upload to player-media" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'player-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view player-media" ON storage.objects
    FOR SELECT USING (bucket_id = 'player-media');

CREATE POLICY "Users can manage their player-media" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'player-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Stream assets storage
DROP POLICY IF EXISTS "Users can upload stream-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view stream-assets" ON storage.objects;

CREATE POLICY "Users can upload stream-assets" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'stream-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view stream-assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'stream-assets');

-- Profile assets storage
DROP POLICY IF EXISTS "Users can upload profile-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile-assets" ON storage.objects;

CREATE POLICY "Users can upload profile-assets" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'profile-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view profile-assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'profile-assets');

-- =============================================
-- 15. AUTOMATIC VOD CREATION FUNCTION
-- =============================================

-- Function to create VOD from ended stream
CREATE OR REPLACE FUNCTION create_vod_from_stream()
RETURNS TRIGGER AS $$
BEGIN
    -- When a stream ends, create a VOD entry in player_media
    IF NEW.status = 'ended' AND OLD.status = 'live' AND NEW.vod_url IS NOT NULL THEN
        INSERT INTO player_media (
            player_id,
            title,
            description,
            media_type,
            source_type,
            video_url,
            url,
            thumbnail_url,
            stream_id,
            visibility,
            moderation_status,
            game_id
        ) VALUES (
            NEW.user_id,
            NEW.title || ' (VOD)',
            NEW.description,
            'vod',
            'vod',
            NEW.vod_url,
            NEW.vod_url,
            NEW.thumbnail_url,
            NEW.id,
            NEW.visibility,
            'approved',
            NEW.game_id
        )
        RETURNING id INTO NEW.vod_media_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for VOD creation
DROP TRIGGER IF EXISTS create_vod_on_stream_end ON stream_sessions;
CREATE TRIGGER create_vod_on_stream_end
    BEFORE UPDATE ON stream_sessions
    FOR EACH ROW
    WHEN (NEW.status = 'ended' AND OLD.status = 'live')
    EXECUTE FUNCTION create_vod_from_stream();

-- =============================================
-- 16. UPDATE VIEW COUNT FUNCTION
-- =============================================

-- Function to increment view count on player_media
CREATE OR REPLACE FUNCTION increment_media_view_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE player_media 
    SET view_count = view_count + 1,
        updated_at = NOW()
    WHERE id = NEW.media_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS increment_view_on_event ON media_view_events;
CREATE TRIGGER increment_view_on_event
    AFTER INSERT ON media_view_events
    FOR EACH ROW
    EXECUTE FUNCTION increment_media_view_count();

-- =============================================
-- 17. SCHEDULED CONTENT GO-LIVE FUNCTION
-- =============================================

-- Function to mark scheduled content as live
CREATE OR REPLACE FUNCTION check_scheduled_content_live()
RETURNS void AS $$
BEGIN
    UPDATE player_media
    SET is_live = TRUE,
        went_live_at = NOW(),
        updated_at = NOW()
    WHERE scheduled_live_at IS NOT NULL
        AND scheduled_live_at <= NOW()
        AND is_live = FALSE
        AND moderation_status = 'approved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 18. GRANTS
-- =============================================

GRANT SELECT ON stream_sessions TO anon, authenticated;
GRANT ALL ON stream_sessions TO authenticated;

GRANT ALL ON multistream_destinations TO authenticated;
GRANT ALL ON stream_layouts TO authenticated;
GRANT SELECT ON stream_assets TO anon, authenticated;
GRANT ALL ON stream_assets TO authenticated;

GRANT SELECT ON team_profiles TO anon, authenticated;
GRANT ALL ON team_profiles TO authenticated;

GRANT SELECT ON organization_profiles TO anon, authenticated;
GRANT ALL ON organization_profiles TO authenticated;

GRANT INSERT ON media_view_events TO anon, authenticated;
GRANT SELECT ON media_view_events TO authenticated;

GRANT ALL ON player_follows TO authenticated;
GRANT SELECT ON player_follows TO anon;

GRANT ALL ON feed_sessions TO anon, authenticated;
GRANT ALL ON feed_interactions TO anon, authenticated;

-- Verify
SELECT 'Streaming Ecosystem Complete migration successful' as status;
