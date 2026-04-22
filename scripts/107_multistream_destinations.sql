-- Create multistream_destinations table
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

ALTER TABLE multistream_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "multistream_select" ON multistream_destinations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "multistream_insert" ON multistream_destinations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "multistream_update" ON multistream_destinations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "multistream_delete" ON multistream_destinations FOR DELETE USING (auth.uid() = user_id);
