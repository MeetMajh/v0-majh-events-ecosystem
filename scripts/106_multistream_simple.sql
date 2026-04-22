-- Create multistream_destinations table for storing platform RTMP keys
CREATE TABLE IF NOT EXISTS multistream_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  stream_key TEXT,
  rtmp_url TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Enable RLS
ALTER TABLE multistream_destinations ENABLE ROW LEVEL SECURITY;

-- RLS policies for multistream_destinations
DROP POLICY IF EXISTS "Users can view own destinations" ON multistream_destinations;
CREATE POLICY "Users can view own destinations" ON multistream_destinations
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own destinations" ON multistream_destinations;
CREATE POLICY "Users can insert own destinations" ON multistream_destinations
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own destinations" ON multistream_destinations;
CREATE POLICY "Users can update own destinations" ON multistream_destinations
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own destinations" ON multistream_destinations;
CREATE POLICY "Users can delete own destinations" ON multistream_destinations
FOR DELETE USING (auth.uid() = user_id);

-- Create stream_assets table for storing user-uploaded overlays, logos, etc
CREATE TABLE IF NOT EXISTS stream_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'overlay',
  file_url TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  width INT,
  height INT,
  is_preset BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE stream_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies for stream_assets
DROP POLICY IF EXISTS "Users can view own assets" ON stream_assets;
CREATE POLICY "Users can view own assets" ON stream_assets
FOR SELECT USING (auth.uid() = user_id OR is_preset = TRUE);

DROP POLICY IF EXISTS "Users can insert own assets" ON stream_assets;
CREATE POLICY "Users can insert own assets" ON stream_assets
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own assets" ON stream_assets;
CREATE POLICY "Users can update own assets" ON stream_assets
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own assets" ON stream_assets;
CREATE POLICY "Users can delete own assets" ON stream_assets
FOR DELETE USING (auth.uid() = user_id);
