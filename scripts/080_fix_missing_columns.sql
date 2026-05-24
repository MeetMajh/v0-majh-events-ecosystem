-- Fix missing columns in player_media and cb_staff_shifts tables
-- This script adds columns that were referenced in code but missing from the schema

-- Add published_at column to player_media if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'player_media' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE player_media ADD COLUMN published_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add location column to cb_staff_shifts if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cb_staff_shifts' AND column_name = 'location'
  ) THEN
    ALTER TABLE cb_staff_shifts ADD COLUMN location TEXT;
  END IF;
END $$;

-- Update existing player_media records to set published_at = created_at where null
UPDATE player_media 
SET published_at = created_at 
WHERE published_at IS NULL;

-- Add index on published_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_player_media_published_at ON player_media(published_at DESC);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON player_media TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cb_staff_shifts TO authenticated;
