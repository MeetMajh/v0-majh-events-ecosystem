-- STREAM DESTINATIONS (for multistream feature)
-- Allows users to save their stream keys for multiple platforms

CREATE TABLE IF NOT EXISTS stream_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  stream_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_stream_destinations_user ON stream_destinations(user_id);

-- RLS
ALTER TABLE stream_destinations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stream_destinations (users can only see/edit their own)
DROP POLICY IF EXISTS "Users can view own destinations" ON stream_destinations;
CREATE POLICY "Users can view own destinations" ON stream_destinations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own destinations" ON stream_destinations;
CREATE POLICY "Users can insert own destinations" ON stream_destinations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own destinations" ON stream_destinations;
CREATE POLICY "Users can update own destinations" ON stream_destinations
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own destinations" ON stream_destinations;
CREATE POLICY "Users can delete own destinations" ON stream_destinations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_streams (if not already set)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_streams' AND policyname = 'Users can view own streams'
  ) THEN
    CREATE POLICY "Users can view own streams" ON user_streams
      FOR SELECT USING (auth.uid() = user_id OR is_public = true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_streams' AND policyname = 'Users can insert own streams'
  ) THEN
    CREATE POLICY "Users can insert own streams" ON user_streams
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_streams' AND policyname = 'Users can update own streams'
  ) THEN
    CREATE POLICY "Users can update own streams" ON user_streams
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END
$$;
