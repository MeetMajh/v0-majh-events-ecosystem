CREATE TABLE IF NOT EXISTS stream_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT,
  is_preset BOOLEAN DEFAULT FALSE,
  category TEXT DEFAULT 'custom',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stream_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets and presets" ON stream_assets
FOR SELECT USING (user_id = auth.uid() OR is_preset = TRUE);

CREATE POLICY "Users can insert own assets" ON stream_assets
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own assets" ON stream_assets
FOR DELETE USING (user_id = auth.uid() AND is_preset = FALSE);
