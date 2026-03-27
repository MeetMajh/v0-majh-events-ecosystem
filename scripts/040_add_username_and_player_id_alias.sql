-- Migration: Add username to profiles and player_id alias columns
-- This migration:
-- 1. Adds username column to profiles with unique constraint
-- 2. Adds player_id alias columns to tournament tables for API compatibility
-- 3. Populates default usernames from email/name for existing users

-- ============================================
-- 1. Add username column to profiles
-- ============================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username TEXT;

-- Create unique index for usernames (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique 
ON public.profiles (LOWER(username)) 
WHERE username IS NOT NULL;

-- ============================================
-- 2. Add player_id alias column to tournament_registrations
-- This is a generated column that mirrors user_id for API compatibility
-- ============================================
DO $$
BEGIN
  -- Check if player_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tournament_registrations' 
    AND column_name = 'player_id'
  ) THEN
    -- Add player_id as a regular column
    ALTER TABLE public.tournament_registrations 
    ADD COLUMN player_id UUID;
    
    -- Populate it from user_id
    UPDATE public.tournament_registrations 
    SET player_id = user_id 
    WHERE player_id IS NULL;
    
    -- Add foreign key constraint
    ALTER TABLE public.tournament_registrations
    ADD CONSTRAINT fk_tournament_registrations_player_id 
    FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Create index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_tournament_registrations_player_id 
    ON public.tournament_registrations(player_id);
  END IF;
END $$;

-- ============================================
-- 3. Add player_id column to tournament_player_stats if not exists
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tournament_player_stats' 
    AND column_name = 'player_id'
  ) THEN
    ALTER TABLE public.tournament_player_stats 
    ADD COLUMN player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Populate from user_id
    UPDATE public.tournament_player_stats 
    SET player_id = user_id 
    WHERE player_id IS NULL;
    
    CREATE INDEX IF NOT EXISTS idx_tournament_player_stats_player_id 
    ON public.tournament_player_stats(player_id);
  END IF;
END $$;

-- ============================================
-- 4. Create trigger to sync player_id with user_id on insert/update
-- ============================================
CREATE OR REPLACE FUNCTION sync_player_id_registrations()
RETURNS TRIGGER AS $$
BEGIN
  NEW.player_id := COALESCE(NEW.player_id, NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_player_id_on_registration ON public.tournament_registrations;
CREATE TRIGGER sync_player_id_on_registration
  BEFORE INSERT OR UPDATE ON public.tournament_registrations
  FOR EACH ROW
  EXECUTE FUNCTION sync_player_id_registrations();

-- Same for tournament_player_stats
CREATE OR REPLACE FUNCTION sync_player_id_stats()
RETURNS TRIGGER AS $$
BEGIN
  NEW.player_id := COALESCE(NEW.player_id, NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_player_id_on_stats ON public.tournament_player_stats;
CREATE TRIGGER sync_player_id_on_stats
  BEFORE INSERT OR UPDATE ON public.tournament_player_stats
  FOR EACH ROW
  EXECUTE FUNCTION sync_player_id_stats();

-- ============================================
-- 5. Populate default usernames for existing profiles
-- Uses email prefix (before @) or first_name + last_name
-- ============================================
UPDATE public.profiles p
SET username = (
  SELECT 
    CASE 
      -- If first_name and last_name exist, use them
      WHEN p.first_name IS NOT NULL AND p.last_name IS NOT NULL 
        THEN LOWER(REPLACE(p.first_name || p.last_name, ' ', ''))
      -- Otherwise use email prefix from auth.users
      ELSE LOWER(SPLIT_PART(u.email, '@', 1))
    END
  FROM auth.users u
  WHERE u.id = p.id
)
WHERE p.username IS NULL;

-- Handle duplicate usernames by appending numbers
DO $$
DECLARE
  dup_record RECORD;
  counter INTEGER;
  new_username TEXT;
BEGIN
  -- Find duplicate usernames
  FOR dup_record IN 
    SELECT username, array_agg(id ORDER BY created_at) as ids
    FROM public.profiles
    WHERE username IS NOT NULL
    GROUP BY LOWER(username)
    HAVING COUNT(*) > 1
  LOOP
    counter := 1;
    -- Skip the first one (keep original), update the rest
    FOREACH new_username IN ARRAY dup_record.ids[2:]
    LOOP
      UPDATE public.profiles 
      SET username = dup_record.username || counter::text
      WHERE id = new_username::uuid;
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- Done!
-- ============================================
