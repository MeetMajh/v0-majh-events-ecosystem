-- 138_vod_rls_ended_streams.sql
--
-- Bug #2 from PLAN.md / BACKEND-AUDIT.md:
-- app/(public)/live/vods/page.tsx fetches VODs via the anon-key client:
--   .from('user_streams').select('*')
--     .eq('status', 'ended').eq('is_public', true)
--     .not('mux_playback_id', 'is', null)
-- The original creation script 043-user-streams.sql only grants public SELECT
-- when status = 'live':
--   CREATE POLICY "Users can view own streams" ON user_streams
--     FOR SELECT USING (auth.uid() = user_id OR (is_public = true AND status = 'live'));
-- so ended public streams are filtered out by RLS and the VOD library renders
-- empty. (051-user-streams-final.sql does add the right policy, but it
-- DROP TABLE ... CASCADEs on apply, so prod is almost certainly pinned to
-- 043.)
--
-- This migration is additive and idempotent: it creates the missing SELECT
-- policy only if no policy with the same name exists yet. CREATE POLICY does
-- not support IF NOT EXISTS before Postgres 15.4, so we gate on pg_policies.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_streams'
      AND policyname = 'Public can view ended streams'
  ) THEN
    CREATE POLICY "Public can view ended streams" ON public.user_streams
      FOR SELECT
      USING (status = 'ended' AND is_public = true);
  END IF;
END$$;

COMMIT;
