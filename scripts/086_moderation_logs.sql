-- Moderation logs table for tracking AI and manual moderation decisions
CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID REFERENCES player_media(id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  result JSONB NOT NULL,
  action_taken TEXT NOT NULL CHECK (action_taken IN ('approved', 'flagged', 'rejected', 'pending')),
  notes TEXT,
  is_automated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_moderation_logs_media ON moderation_logs(media_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created ON moderation_logs(created_at DESC);

-- Enable RLS
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view moderation logs
DROP POLICY IF EXISTS "Admins can view moderation logs" ON moderation_logs;
CREATE POLICY "Admins can view moderation logs" ON moderation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'moderator')
    )
  );

-- System can insert moderation logs (for automated moderation)
DROP POLICY IF EXISTS "System can insert moderation logs" ON moderation_logs;
CREATE POLICY "System can insert moderation logs" ON moderation_logs
  FOR INSERT WITH CHECK (true);

-- Add is_flagged and flag_count to player_media if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'player_media' AND column_name = 'is_flagged'
  ) THEN
    ALTER TABLE player_media ADD COLUMN is_flagged BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'player_media' AND column_name = 'flag_count'
  ) THEN
    ALTER TABLE player_media ADD COLUMN flag_count INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

SELECT 'Moderation logs table created!' AS status;
