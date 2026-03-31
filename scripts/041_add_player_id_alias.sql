-- Add player_id column to tournament_registrations as an alias for user_id
-- This resolves the inconsistency where some code uses player_id and some uses user_id

-- Step 1: Add player_id column if it doesn't exist
ALTER TABLE public.tournament_registrations 
ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Backfill player_id from user_id for existing records
UPDATE public.tournament_registrations 
SET player_id = user_id 
WHERE player_id IS NULL AND user_id IS NOT NULL;

-- Step 3: Create index on player_id for query performance
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_player_id 
ON public.tournament_registrations(player_id);
