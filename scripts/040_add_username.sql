-- Add username column to profiles table
-- Username is unique, case-insensitive, and defaults to email prefix

-- Add username column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username text;

-- Create unique index for case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique 
ON public.profiles (lower(username));

-- Backfill existing users with username from email (via auth.users)
-- Default format: email prefix before @, or full email if no @
UPDATE public.profiles p
SET username = COALESCE(
  -- First try: first_name + '_' + last_name (if both exist)
  CASE 
    WHEN p.first_name IS NOT NULL AND p.first_name != '' 
         AND p.last_name IS NOT NULL AND p.last_name != ''
    THEN lower(regexp_replace(p.first_name || '_' || p.last_name, '[^a-zA-Z0-9_]', '', 'g'))
    ELSE NULL
  END,
  -- Fallback: email prefix from auth.users
  (SELECT lower(split_part(u.email, '@', 1)) FROM auth.users u WHERE u.id = p.id),
  -- Last resort: use the profile ID
  'user_' || substr(p.id::text, 1, 8)
)
WHERE p.username IS NULL;

-- Handle duplicate usernames by appending numbers
DO $$
DECLARE
  dup RECORD;
  counter INT;
  new_username TEXT;
BEGIN
  -- Find profiles with duplicate usernames (case-insensitive)
  FOR dup IN 
    SELECT p.id, p.username, 
           ROW_NUMBER() OVER (PARTITION BY lower(p.username) ORDER BY p.created_at) as rn
    FROM public.profiles p
    WHERE p.username IS NOT NULL
  LOOP
    IF dup.rn > 1 THEN
      counter := dup.rn;
      LOOP
        new_username := dup.username || counter::text;
        -- Check if this new username is available
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(new_username) AND id != dup.id) THEN
          UPDATE public.profiles SET username = new_username WHERE id = dup.id;
          EXIT;
        END IF;
        counter := counter + 1;
        -- Safety exit after 100 attempts
        IF counter > 100 THEN
          UPDATE public.profiles SET username = 'user_' || substr(dup.id::text, 1, 12) WHERE id = dup.id;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Add check constraint for username format (alphanumeric, underscore, 3-30 chars)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_username_format;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_format 
CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$' OR username IS NULL);

-- Create function to validate username uniqueness (case-insensitive)
CREATE OR REPLACE FUNCTION public.check_username_available(check_username text, exclude_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE lower(username) = lower(check_username)
    AND (exclude_user_id IS NULL OR id != exclude_user_id)
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.check_username_available TO authenticated;

COMMENT ON COLUMN public.profiles.username IS 'Unique username for the user, case-insensitive, 3-30 alphanumeric characters and underscores';
