-- ============================================================================
-- MULTISTREAM DESTINATIONS TABLE
-- For streaming to YouTube, Twitch, etc simultaneously
-- ============================================================================

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

-- RLS
ALTER TABLE multistream_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their destinations" ON multistream_destinations;
CREATE POLICY "Users can manage their destinations" ON multistream_destinations
    FOR ALL USING (auth.uid() = user_id);

-- Verify
SELECT 'multistream_destinations created' as result;
