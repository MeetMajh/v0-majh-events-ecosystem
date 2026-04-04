-- Fix missing columns - Simple version for Supabase dashboard
-- Copy and paste this into your Supabase SQL Editor

-- 1. Add published_at column to player_media if missing
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 2. Update existing records to set published_at = created_at where null
UPDATE player_media
SET published_at = created_at
WHERE published_at IS NULL;

-- 3. Add location column to cb_staff_shifts if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cb_staff_shifts') THEN
    ALTER TABLE cb_staff_shifts ADD COLUMN IF NOT EXISTS location TEXT;
  END IF;
END $$;
