-- ============================================================================
-- STREAM ASSETS TABLE
-- For overlays, logos, banners, and streaming graphics
-- ============================================================================

CREATE TABLE IF NOT EXISTS stream_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('overlay', 'logo', 'banner', 'stinger', 'alert', 'scene_background')),
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    storage_path TEXT,
    is_preset BOOLEAN DEFAULT FALSE,
    category TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_assets_user ON stream_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_assets_type ON stream_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_stream_assets_preset ON stream_assets(is_preset) WHERE is_preset = TRUE;

-- RLS
ALTER TABLE stream_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their assets" ON stream_assets;
DROP POLICY IF EXISTS "Anyone can view presets" ON stream_assets;

CREATE POLICY "Users can manage their assets" ON stream_assets
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view presets" ON stream_assets
    FOR SELECT USING (is_preset = TRUE);

-- Stream Layouts Table
CREATE TABLE IF NOT EXISTS stream_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Default Layout',
    layout_data JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_layouts_user ON stream_layouts(user_id);

ALTER TABLE stream_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their layouts" ON stream_layouts;
CREATE POLICY "Users can manage their layouts" ON stream_layouts
    FOR ALL USING (auth.uid() = user_id);

-- Verify
SELECT 'stream_assets and stream_layouts created' as result;
