-- 137_add_mux_playback_id.sql
--
-- Bug #1 from PLAN.md / BACKEND-AUDIT.md:
-- lib/go-live-actions.ts ends a stream by writing mux_playback_id and
-- mux_asset_id onto user_streams (see endStream at lines 304-317, and
-- manuallyStartStreaming at lines 343-358). Neither column is present in
-- the original creation script 043-user-streams.sql, and the recreation in
-- 051-user-streams-final.sql only adds mux_playback_id. If production was
-- pinned to 043 (or 051 was skipped), the columns are absent and the
-- "go live" / VOD save flow fails with a 42703 column-not-found error.
--
-- This migration is additive and idempotent: it adds the columns and
-- supporting indexes if and only if they are missing. Safe to run on any
-- environment.

BEGIN;

-- Mux HLS playback id (used to construct playback_url:
-- https://stream.mux.com/{mux_playback_id}.m3u8). Set by endStream after
-- the Mux asset is created from the recorded live stream.
ALTER TABLE user_streams
  ADD COLUMN IF NOT EXISTS mux_playback_id TEXT;

-- Mux asset id (returned by Mux when the recording is encoded into a VOD).
-- Persisted so we can look the asset back up for moderation / takedown.
ALTER TABLE user_streams
  ADD COLUMN IF NOT EXISTS mux_asset_id TEXT;

-- Lookups by mux_playback_id happen in the Mux webhook handler
-- (app/api/webhooks/mux/route.ts) when an asset.ready event arrives.
CREATE INDEX IF NOT EXISTS idx_user_streams_mux_playback_id
  ON user_streams (mux_playback_id)
  WHERE mux_playback_id IS NOT NULL;

-- Lookups by mux_asset_id happen during the asset import route
-- (app/api/admin/import-mux-assets/route.ts) and webhook reconciliation.
CREATE INDEX IF NOT EXISTS idx_user_streams_mux_asset_id
  ON user_streams (mux_asset_id)
  WHERE mux_asset_id IS NOT NULL;

COMMIT;
