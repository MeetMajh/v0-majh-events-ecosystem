-- Migration: Add player_id column to tournament_registrations
-- This adds player_id as an alias for user_id for API compatibility

-- Add player_id column
ALTER TABLE public.tournament_registrations
ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Copy user_id values to player_id
UPDATE public.tournament_registrations
SET player_id = user_id
WHERE player_id IS NULL AND user_id IS NOT NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_player_id 
ON public.tournament_registrations(player_id);
