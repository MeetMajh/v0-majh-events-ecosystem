-- 139: Admin-only UPDATE policy on stream_sources.
--
-- Fixes Phase 2 critical bug #3 from ralph-dev/PLAN.md: stream_sources has no
-- admin-only UPDATE policy, so toggleStreamSourceLive()
-- (lib/stream-sources-actions.ts:343) is callable by any authenticated user.
--
-- Root cause in prod (pinned to ~043): 037-stream-sources.sql ENABLEs RLS on
-- stream_sources but defines no policies for it. Subsequent un-pinned-in-prod
-- migrations either (a) opened it up entirely
-- ("Authenticated can manage stream sources" FOR ALL TO authenticated
-- USING(true) in streaming-tables-fix.sql), or (b) restricted by owner
-- ("Users can update own sources" in 044-majh-studio-tables.sql). Neither
-- matches the admin-only intent.
--
-- This migration is additive + idempotent: safe to apply on any environment
-- regardless of whether 044, 052, or streaming-tables-fix.sql ran.

BEGIN;

-- Drop the two known over-permissive UPDATE-capable policies if they exist.
-- DROP POLICY IF EXISTS is idempotent and a no-op when the policy is absent,
-- so this is safe on every environment (prod pinned to 043 or dev with later
-- migrations applied).
DROP POLICY IF EXISTS "Users can update own sources" ON public.stream_sources;
DROP POLICY IF EXISTS "Authenticated can manage stream sources" ON public.stream_sources;

-- profiles.is_admin is the dominant admin-check pattern across the codebase
-- (7+ admin API routes select on this column; only import-mux-assets uses the
-- legacy profiles.role pattern). The column itself is not created by any
-- existing migration script in scripts/, so add it here to make this
-- migration self-contained — without this, the policy below would 42703 on
-- a prod env pinned to 043.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Idempotent CREATE POLICY via pg_policies probe.
-- CREATE POLICY IF NOT EXISTS was not added to Postgres until 15.4 and is
-- not guaranteed across every Supabase environment, so use a DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stream_sources'
      AND policyname = 'Admins can update stream sources'
  ) THEN
    CREATE POLICY "Admins can update stream sources" ON public.stream_sources
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.is_admin = TRUE
        )
      );
  END IF;
END$$;

COMMIT;
