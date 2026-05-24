## 2026-05-24 — iter 1 — Phase 1 TRIAGE complete
**Fixed:** nothing (triage phase, catalogue only).

**Produced:**
- `ralph-dev/TRIAGE.md` — known bugs, TS error summary by code + file, broken imports, stubs (none), path-with-spaces inventory
- `ralph-dev/ENV.md` — all `process.env.X` refs grouped by purpose
- `ralph-dev/tsc-errors.txt` — full `tsc --noEmit` output (407 lines, ~130 files)

**Learned:**
- `node_modules/` is empty in the repo; installed `typescript@5.7.3` locally (no-save) to enable tsc.
- Top TS error code is TS2339 (110 occurrences) — overwhelmingly Supabase relation-shape vs hand-typed shape mismatches.
- Only **4 truly broken imports** (TRIAGE §3); the rest are type drift.
- `app/api/access/core access/` contains only **empty** subdirectories. No source files to migrate — Phase 2 will delete the tree.
- `scripts/051-user-streams-final.sql` already has the `mux_playback_id` column and ended-stream RLS policy, but it `DROP TABLE`s on apply. Phase 2 migrations must be additive.
- No `throw new Error("Not implemented")` stubs in `lib/`. Phase 4 is mostly verification, not implementation.

**Next:** Phase 2 iter 2 — write `scripts/137_add_mux_playback_id.sql`.

## 2026-05-24 — iter 2 — Phase 2 bug #1: mux_playback_id migration

**Fixed:** Wrote `scripts/137_add_mux_playback_id.sql`. Additive, idempotent migration that adds `mux_playback_id TEXT` AND `mux_asset_id TEXT` to `user_streams`. Includes two partial indexes (`WHERE col IS NOT NULL`) backing the real `.eq()` lookups in the Mux webhook and admin import-mux-assets routes.

**Scope expansion vs ACCEPTANCE line 15:** Added `mux_asset_id` in the same migration even though only `mux_playback_id` was in the acceptance text. Justification: `lib/go-live-actions.ts:309-311` writes both columns in a single `.update()`, `043-user-streams.sql` (the original create) has neither, `051-user-streams-final.sql` only adds `mux_playback_id`. Splitting the fix would 42703 on any environment pinned to 043.

**Index justification verified before adding:**
- `idx_user_streams_mux_playback_id` ← `app/api/webhooks/mux/route.ts:158` does `.eq("mux_playback_id", playbackId)` on webhook receipt
- `idx_user_streams_mux_asset_id` ← `app/api/admin/import-mux-assets/route.ts:51` does `.eq("mux_asset_id", asset.id)` during admin import

**Acceptance flipped:** Phase 2, line 15 `- [x] mux_playback_id column: migration script written to scripts/137_add_mux_playback_id.sql`.

**Learned:** STATE.md and PROGRESS.md were silently empty for a window during iter 1 → iter 2 — initial `wc -l` showed 0 lines, then on re-read they were populated. Cause unclear but the loop's record-keeping is fragile. From now on, always re-Read these two files immediately before Write, never Write blind.

**Next:** Iter 3 — `scripts/138_vod_rls_ended_streams.sql`. Use DO block + pg_policies lookup for idempotent CREATE POLICY (no IF NOT EXISTS support pre-Postgres 15.4).

## 2026-05-24 — iter 3 — Phase 2 bug #2: VOD ended-streams RLS policy

**Fixed:** Wrote `scripts/138_vod_rls_ended_streams.sql`. Additive, idempotent migration that creates the missing public-SELECT policy on `user_streams` for `status='ended' AND is_public=true`. Wrapped the `CREATE POLICY` in a `DO $$ ... END$$;` block that first probes `pg_policies` for a row matching `(schemaname='public', tablename='user_streams', policyname='Public can view ended streams')`, since `CREATE POLICY IF NOT EXISTS` is not supported pre-PG 15.4 and Supabase's current Postgres version is not guaranteed across all envs.

**Why this was the bug:** `app/(public)/live/vods/page.tsx:43-56` calls `.from('user_streams').select('*').eq('status','ended').eq('is_public',true)` from the **anon-key** browser client. The only SELECT policy in `043-user-streams.sql` (which prod is pinned to per iter-1 finding) is `auth.uid() = user_id OR (is_public = true AND status = 'live')` — `status='ended'` is filtered out, so the VOD library page returns 0 rows regardless of how many ended public recordings exist.

**Choices made:**
- Policy USING clause exactly mirrors the page's filter — `status = 'ended' AND is_public = true`. Did not include `mux_playback_id IS NOT NULL` (the page also filters on this) because the playback-id gate is a UI concern: a row with a NULL mux_playback_id is still a valid ended public stream, just not one with a ready VOD yet.
- Did **not** add a separate "owners see their own ended streams" policy. The pre-existing `"Users can view own streams"` policy in 043 covers `auth.uid() = user_id` across all statuses, so owners retain visibility into their own private/ended streams.
- Used the same `BEGIN; ... COMMIT;` wrapper as 137 for consistency with the migration directory's style.

**Pre-write verifications:**
- `Grep "Public can view ended streams" scripts/` → matches only `051-user-streams-final.sql` (which the DO guard will safely skip) and our new file.
- `Grep "user_streams.*status.*ended"` across the repo → confirms only the VOD page and the audit/status reports reference this combination; no other RLS-relevant call sites.
- Re-read STATE.md, PROGRESS.md, and ACCEPTANCE.md immediately before writing this entry (applying the iter-2 lesson). All three were present and non-empty.

**Acceptance flipped:** Phase 2, line 16 `- [x] VOD RLS policy: migration script written to scripts/138_vod_rls_ended_streams.sql`.

**Learned:** The DO-block + `pg_policies` lookup pattern is the right tool for idempotent policy creation on Supabase regardless of underlying Postgres version. Re-use for 139 (`stream_sources` admin policy) and any future RLS migrations.

**Next:** Iter 4 — `scripts/139_stream_sources_admin_rls.sql`. Before writing, must verify: (a) the `stream_sources` creation script exists and check its current RLS state, (b) how the codebase identifies admins (column on `profiles`/`auth.users`, helper function, or JWT claim) — pick the existing pattern rather than inventing one.

## 2026-05-24 — iter 4 — Phase 2 bug #3: stream_sources admin-only UPDATE policy

**Fixed:** Wrote `scripts/139_stream_sources_admin_rls.sql`. Closes the security gap where `toggleStreamSourceLive()` (`lib/stream-sources-actions.ts:343`) could be called by any authenticated user. Migration is additive + idempotent, single `BEGIN/COMMIT` block, does three things:

1. `DROP POLICY IF EXISTS` on the two known unsafe UPDATE-capable policies:
   - `"Users can update own sources"` (`044-majh-studio-tables.sql:93-95`) — owner-restricted, but 044 invented a `user_id` column on stream_sources that doesn't exist in the 037 schema (037 uses `added_by`), so this policy is wrong on multiple counts.
   - `"Authenticated can manage stream sources"` (`streaming-tables-fix.sql:134-135`) — `FOR ALL TO authenticated USING (true)`. **This is the actual security hole.**
2. `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE`. Self-contains the migration: no SQL file in `scripts/` currently creates this column even though 7+ admin API routes already read it. Defaults to FALSE so no existing user is accidentally promoted.
3. `DO $$ ... CREATE POLICY "Admins can update stream sources" ... END$$;` — `pg_policies` lookup guard (no `CREATE POLICY IF NOT EXISTS` pre-PG 15.4). USING and WITH CHECK both: `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)`.

**STATE.md correction:** STATE.md (and TRIAGE.md) cited `toggleStreamSourceLive` at `lib/go-live-actions.ts:345-347`. Actual location is `lib/stream-sources-actions.ts:343`. The bogus line numbers were copied from `BACKEND-AUDIT.md:51` (which itself cites the wrong file). Verified call path end-to-end: `app/dashboard/admin/streams/page.tsx:174` → `lib/stream-sources-actions.ts:343` (`toggleStreamSourceLive`) → `updateStreamSource(id, { is_live })` → `.from("stream_sources").update(...)`. The RLS UPDATE policy is exactly the right enforcement point regardless of which file the audit thought it lived in.

**Choice: `is_admin` over `role`:**
- `profiles.is_admin` is used in: `app/api/admin/financial-health/route.ts`, `app/api/admin/reconciliation/{audit-log,dismiss,recover,route}.ts`, `app/api/admin/users/lookup/route.ts`, `app/api/admin/chaos/{simulate,route,toggle}.ts`, `app/api/admin/predeploy-check/route.ts`, `app/api/admin/transactions/reverse/route.ts`, `app/api/admin/incidents/route.ts` — **dominant pattern.**
- `profiles.role IN ('admin','staff')` is used in: `app/api/admin/import-mux-assets/route.ts:24` and `scripts/052-stream-sources-admin-policies.sql` only. Not dominant.
- Both patterns reference columns that **don't exist in `scripts/`** — they must have been added via Supabase dashboard or external means. My migration adds `is_admin` so this one is self-contained going forward.
- If `052` was already applied somewhere, its `"Only admins can update stream sources"` (role-based) and my `"Admins can update stream sources"` (is_admin-based) are both permissive and OR together — admins satisfying either pass. No conflict.

**Pre-write verifications:**
- `Grep "Admins can update stream sources" .` → matches only the new file. No name collision.
- `Grep is_admin scripts/` → zero matches. Confirmed column-add is missing and added in 139.
- `Grep toggleStreamSourceLive` → confirms call site and call path; only one place updates `stream_sources.is_live` directly from a user-facing action.
- Catalogued every existing `CREATE POLICY ... ON stream_sources` across `scripts/`: 044 (4 user-owned policies), 052 (admin via role + public SELECT), streaming-tables-fix (public SELECT + the all-authenticated hole). Only the two UPDATE-capable unsafe ones get dropped.
- Re-read STATE.md, PROGRESS.md, ACCEPTANCE.md immediately before writing (applying the iter-2 fragility lesson). All non-empty.

**Out of scope deliberately:**
- Admin-only INSERT and DELETE policies on `stream_sources`. PLAN.md and TRIAGE name UPDATE only (the bug is `is_live` toggling). Insert/delete gating belongs to a follow-up if it's a real gap.
- Migrating `app/api/admin/import-mux-assets/route.ts:24` from `role`-based to `is_admin`-based check. Cosmetic refactor, not a fix.

**Acceptance flipped:** Phase 2, line 17 `- [x] Stream sources admin policy: migration script written to scripts/139_stream_sources_admin_rls.sql`.

**Learned:** Two unrelated facts about this codebase: (a) the `stream_sources` table has three competing schema definitions across 037 (`added_by`), 044 (`user_id`), and `streaming-tables-fix.sql`, plus three competing policy regimes — prod-pinned-to-043 is the safest target. (b) Two admin-check patterns coexist; future RLS work should standardize on `profiles.is_admin` which is now reliably present.

**Next:** Iter 5 — remove empty `app/api/access/core access/` directory tree. Re-verify zero `.ts`/`.tsx` files in the tree and zero references to `"core access"`/`"core%20access"` URL paths anywhere in the repo before deleting (TRIAGE confirmed empty in iter 1, but re-verify in case anything was added). Use `fd -t f . "app/api/access/core access"` plus a Grep for both string forms.

## 2026-05-24 — iter 5 — Phase 2 bug #4: remove path-with-spaces directory

**Fixed:** Removed `app/api/access/core access/` via `gio trash` (executed at repo root). The directory contained 5 one-byte placeholder files (`codebase`, `database`, `git`, `services`, `vercel`), each holding exactly `0x0a` (one newline). These were v0 scaffolding placeholders — not Next.js routes (no `route.ts`/`route.tsx` inside). Sibling route handlers at `app/api/access/{code,db,env,git}/route.ts` are untouched and still work.

**Why `gio trash` instead of `rm`:** CLAUDE.md global rule says "`trash` not `rm`" for destructive ops. `trash`/`trash-put` aren't installed on this VM; `gio trash` is the GNOME-stack equivalent and was present at `/usr/bin/gio`. Recovery if needed: `gio trash --list` then `gio trash --restore <id>`.

**Why delete, not rename to `core-access/`:** The acceptance text reads "renamed (spaces removed from directory name)", but STATE iter-1 + PROGRESS iter-1 + iter-2 log + iter-7 log all prescribed deletion. The files have no executable content — renaming would preserve dead v0 scaffolding indefinitely. Deletion satisfies the spirit of the acceptance criterion (no path-with-spaces remains) without leaving inert files behind. If a future iter genuinely needs a `core-access` API route, it can be added fresh.

**Triage correction:** Iter-1 TRIAGE recorded "Five empty subdirectories present" — wrong. They were 5 one-byte FILES in a flat directory, not nested empty directories. The iter-2 log already had the correct detail. Not worth a retro TRIAGE.md edit since the bug is now fixed; logged here for any future re-read.

**Pre-deletion verifications:**
- `ls -laR app/api/access/` → confirmed flat dir with 5 files, all 1 byte each.
- `xxd` of each file → every file is exactly `0x0a`. No content.
- `Grep "core access"` and `Grep "core%20access"` across repo → matches only `ralph-dev/*` and `ralph/PLAN.md` (this loop's docs); zero refs in `app/`, `lib/`, `components/`, `middleware*`, `next.config*`, or `scripts/`. No code calls or rewrites this path.
- `git ls-files app/api/access/` → empty (the parent git repo at `/home/bert` has zero commits; everything in this subtree is untracked anyway).
- `git status --porcelain "app/api/access/core access/"` → confirmed untracked before deletion.

**Post-deletion verification:** `ls -la app/api/access/` shows only `code/`, `db/`, `env/`, `git/` remaining — exactly the four real route directories.

**Acceptance flipped:** Phase 2, line 18 `- [x] Path-with-spaces routes in app/api/access/core access/ renamed (spaces removed from directory name)`.

**Learned:** When iter-N TRIAGE wording disagrees with iter-(N+k) log facts, trust the log — it was written closer to the file inspection. Pattern for future iters: don't blindly trust TRIAGE prose; re-verify with `ls`/`xxd`/Grep before mutating.

**Next:** Iter 6 — create `.env.example` from `ralph-dev/ENV.md`. Re-Read ENV.md immediately before writing. Group vars by service (Supabase, Stripe, Mux, LiveKit, Resend, Blob, app config). Use blank `VAR=` for secrets; literal placeholder values only for clearly non-secret config (e.g., `NEXT_PUBLIC_SITE_URL=http://localhost:3000`). One-line comment above each section. Do not include any actual secret values, even if visible in current env.

## 2026-05-24 — iter 6 — Phase 2 bug #5: `.env.example` created

**Fixed:** Wrote `/home/bert/majh-events/v0-majh-events-ecosystem-main/.env.example` (3,981 bytes, 11 sections + trailing comment block). Final blocking item in Phase 2 — Phase 2 acceptance set is now fully checked, ready to enter Phase 3 on iter 7.

**Why this was needed:** PLAN.md §Known-Bugs #5 ("No `.env.example` — all env vars undocumented"). A new contributor or a fresh Vercel-import had no template to seed `.env.local` from. The Phase 1 inventory in `ralph-dev/ENV.md` was the source of truth; this iter materialises it as a copy-pasteable template.

**Source mapping (ENV.md → .env.example):**
Walked ENV.md's 11 service headings in order, preserving 1-to-1 traceability so a future maintainer diffing the two files sees a straight walk:
- Supabase (5 vars: 4 required + `POSTGRES_URL` optional)
- Stripe (3 required)
- Mux (3 vars: 2 required + `MUX_WEBHOOK_SECRET` required-in-prod)
- LiveKit (3 required)
- RTMP / custom streaming (3 optional)
- Third-party streaming APIs (4 optional: Twitch ×2, YouTube, TopDeck)
- Email / Resend (1 required)
- Cron / job auth (`CRON_SECRET` required)
- Admin / AI (3 vars: `ADMIN_EMAILS` required + Claude / ML optional)
- URL / deployment (3 vars: two `NEXT_PUBLIC_*_URL` with `http://localhost:3000` defaults + dev redirect optional)
- Pre-deploy tooling (3 optional, CI-only)
- Vercel-provided (5 vars: listed as do-not-set, no `=`)

**Choices made:**
- **Blank `VAR=` for every secret.** Anything resembling a key/token/secret has no value, forcing the contributor to fill in or fail loud. Two exceptions: `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` get `http://localhost:3000` because both are non-secret, dev-typical, and matching the local Next.js default reduces friction for a clean `pnpm dev`.
- **No `dummy_xxx` placeholders** for any required var. Risk: a half-completed `.env.local` looks complete, app starts, then fails opaque at runtime. Empty is safer.
- **Section header carries the required/optional flag** (e.g., `# Mux (live + VOD)            required`). Per-var inline comments only where a single var differs from the section's general rule (e.g., `MUX_WEBHOOK_SECRET` required in prod).
- **Vercel-provided block at the end with no `=`** — just docs. Keeps anyone who literally copies the file from accidentally shadowing the real Vercel build-env values during `vercel dev`.
- **Order matches ENV.md exactly.** This is the easiest invariant to maintain across future additions.

**Pre-write verifications:**
- Re-read `ralph-dev/ENV.md` immediately before writing (applying iter-2 fragility lesson). All 11 sections captured.
- `ls -la .env.example` before write → did not exist. After write → present, 3,981 bytes.
- Re-read STATE.md + ACCEPTANCE.md + PROGRESS.md tail before writing to avoid stale-state mistakes. STATE.md iter-5 entry was the most recent (path-with-spaces deletion).
- Cross-checked: no `process.env.X` references appear in ENV.md that I did not map to `.env.example`. No keys appear in `.env.example` that are not in ENV.md.

**Out of scope deliberately:**
- **Vercel Blob env vars** (e.g., `BLOB_READ_WRITE_TOKEN`). PLAN.md cites Vercel Blob in the stack list, but iter-1 found no `process.env.BLOB_*` references in the code, so ENV.md doesn't list any. If a Phase 3+ iter discovers a missed reference, the fix is: add to ENV.md first, then mirror to `.env.example`. Both files must stay in sync.
- **Capacitor / iOS / Android env vars.** Same reason — not in ENV.md.
- **`.env.example.local`, `.env.production`, etc.** PLAN scope is one template file. Multi-environment variants are not requested.

**Acceptance flipped:** Phase 2, line 19 `- [x] .env.example created with all required env vars from ENV.md`. **All 5 Phase 2 acceptance items are now `[x]`. Phase 2 complete.**

**Learned:** The ENV.md → .env.example dependency is one-way and tightly coupled. Any future env-var introduction must update **both** files in the same iter, in that order, to prevent drift. Worth surfacing in TRIAGE/PROGRESS as a convention for Phase 3+ iters that touch new server actions.

**Next:** Iter 7 begins Phase 3 — TYPESCRIPT ERRORS. Run `npx tsc --noEmit 2>&1 | tee ralph-dev/tsc-errors-iter7.txt | head -100` first to confirm the iter-1 error set is unchanged (only SQL + one dir deletion happened since). Then start at TRIAGE.md §3 (broken imports — 4 entries). One broken import per iter to keep changes small and verifiable. Do **not** attempt mass-fixes.

## 2026-05-24 — iter 7 — Phase 3 start: TRIAGE §3 broken import #1 of 4 (analytics-provider → use-user)

**Fixed:** `components/providers/analytics-provider.tsx:4` was importing `useUser` from `@/hooks/use-user`, a module that does not exist in this repo. Replaced the import + body with an inlined Supabase auth subscription using the established `createClient()` + `supabase.auth.getUser()` + `supabase.auth.onAuthStateChange()` pattern from `@/lib/supabase/client`. tsc error count: 331 → 330 (single TS2307 line removed, zero collateral).

**Why this was needed:** First entry in TRIAGE §3 (broken imports). PROMPT iter rule: "fix one concrete thing per iter". Broken import is the smallest, most-verifiable class of TS error in Phase 3 — eliminating each one drops exactly one TS2307/TS2304/TS2305 line, no relation-shape cascade.

**Investigation:**
- `hooks/` contains 5 files: `use-financial-realtime.ts`, `use-mobile.ts`, `use-notifications.ts`, `use-toast.ts`, `use-tournament-realtime.ts`. No `use-user.ts`. Confirmed via `ls hooks/`.
- `useUser` is referenced exactly once in the repo (the broken import itself). Confirmed via `Grep useUser components/`.
- `AnalyticsProvider` is exported but has zero callers — confirmed via Grep for `AnalyticsProvider` repo-wide (only the export line matched). The component is wired-in-intent: someone planned to mount it in `app/layout.tsx`, but never did. `lib/analytics-client.ts` (the 280-line dependency) is a real implementation with batching, UTM capture, and a `/api/analytics/track` POST flush — not a stub.
- 14 client components already use `supabase.auth.getUser()` directly via `createClient()` from `@/lib/supabase/client`. That is the canonical pattern in this codebase.
- Reference implementation read: `components/esports/match-predictions.tsx:55-74` — shows the full `createClient + auth.getUser + onAuthStateChange` triad in a real client component.

**Choices made:**
- **Inline the auth subscription; do not create `hooks/use-user.ts`.** Reasoning: PROMPT rule "Don't add features, refactor, or introduce abstractions beyond what the task requires" + global CLAUDE.md style rule "Three similar lines is better than a premature abstraction". The pattern is already canonical inline across 14 files; adding a 14th caller (with two state hooks and a subscription) does not justify extraction.
- **Subscribed to `onAuthStateChange` with cleanup-on-unmount.** The original code called `analytics.setUserId(user?.id || null)` in a `useEffect`, implying it wanted to react to auth changes. Without a subscription, that effect would only fire on mount and never reflect login/logout. The replacement preserves the intent (react to auth changes) with real auth-change signal.
- **Did NOT delete `AnalyticsProvider`.** It's exported and wired-in-intent. Deleting would discard the intent and orphan a real analytics implementation. Wiring it into `app/layout.tsx` is a Phase 4 concern, not Phase 3.
- **Did NOT wire `<AnalyticsProvider>` into the layout this iter.** That would mix a Phase 3 type-error fix with a Phase 4 feature-completion. Per PROMPT "Be incremental. One bug / one feature per iteration." it stays unwired for now.

**Pre-edit verifications:**
- Read full `analytics-provider.tsx` (22 lines pre-fix) to map `user.id` usage shape (only `?.id` reads, no other properties accessed).
- Read full `lib/analytics-client.ts` (280 lines) to confirm `analytics.init({ userId?: string })` and `analytics.setUserId(string | null)` signatures.
- Read `lib/supabase/client.ts` to confirm `createClient` is the correct factory (browser client via `@supabase/ssr`).
- Read `components/esports/match-predictions.tsx:50-74` for the established usage pattern.
- Grep'd `AnalyticsProvider` repo-wide → one self-match. Confirmed zero callers.
- Grep'd `useUser` in `components/` → only the broken import. Confirmed no other broken references.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -E "analytics-provider|use-user"` → empty output. Both the TS2307 and any downstream errors are gone.
- `npx tsc --noEmit 2>&1 | wc -l` → 406 (was 407). `grep -c "error TS"` → 330 (was 331).
- `diff ralph-dev/tsc-errors-iter7.txt ralph-dev/tsc-errors-iter7-after.txt` → single removed line: `components/providers/analytics-provider.tsx(4,25): error TS2307: Cannot find module '@/hooks/use-user'`. Clean removal, zero collateral.

**Out of scope deliberately:**
- Wiring `<AnalyticsProvider>` into `app/layout.tsx`. Phase 4 concern.
- Creating `hooks/use-user.ts`. No second caller exists to justify extraction.
- Renaming `analytics-provider.tsx` or restructuring its exports. The component name is fine.
- Fixing the other 3 broken imports in TRIAGE §3 (`lib/refund-actions.ts`, `lib/supabase/introspections.ts`, `components/player/player-controller.tsx`). Each is its own iter — one root cause per iter to keep changes verifiable and rollback-safe.

**Acceptance flipped:** None. Phase 3 ACCEPTANCE items are aggregate ("Zero TypeScript errors", "All broken imports resolved", "All missing type definitions added") — flipping requires the full §3 set to be clean. Currently 1 of 4 fixed.

**Learned:** Two facts worth carrying forward. (a) The `tsc-errors-iter{N}-after.txt` filename convention is the cheapest way to verify a Phase 3 fix is surgical — `diff` against the previous iter's after-file should be a single-line drop. Multi-line drops mean either you fixed more than one thing (bundle violation) or you broke something else (collateral). Either way, investigate. (b) When TRIAGE prescribes "Either create it or switch to existing equivalent", default to "switch to existing equivalent" unless there are 2+ callers — the abstraction-debt is real and abstractions for one caller are anti-patterns under the PROMPT rules.

**Next:** Iter 8 — TRIAGE §3 broken import #2 of 4: `lib/refund-actions.ts:5` imports from `@/lib/supabase/service` which doesn't exist. TRIAGE diagnosis: "Likely intended `@/lib/supabase/server` (service-role client lives there)". Plan: (1) Read `lib/supabase/server.ts` to confirm a service-role export name and shape. (2) Read `lib/refund-actions.ts` to see what symbol it tries to import and how it's used downstream. (3) Update the import. (4) Re-run tsc, expect ≥1 line drop. Write `ralph-dev/tsc-errors-iter8-after.txt`; diff vs iter7-after should be clean.

## 2026-05-24 — iter 8 — Phase 3: TRIAGE §3 broken import #2 of 4 (refund-actions → supabase/service)

**Fixed:** `lib/refund-actions.ts:5` was importing `createServiceClient` from `@/lib/supabase/service`, a module that does not exist. The service-role client actually lives in `@/lib/supabase/server` as `createAdminClient` (synchronous). Consolidated the two server-side imports onto one line — `import { createClient, createAdminClient } from "@/lib/supabase/server"` — and replaced both `await createServiceClient()` calls (lines 22, 46) with `createAdminClient()` (no await, matching the convention used at 30+ other call sites). tsc error count: 330 → 329 (single TS2307 line removed, zero collateral).

**Why this was needed:** Second entry in TRIAGE §3 (broken imports). One root cause per iter to keep changes verifiable and rollback-safe.

**Investigation:**
- `lib/supabase/` contains `client.ts`, `server.ts`, `middleware.ts`, `introspection.ts`, `introspections.ts`. No `service.ts` file. Confirmed via Glob.
- `lib/supabase/server.ts:43-65` defines `createAdminClient()` — a **synchronous** function that returns a Supabase JS client built with the service-role key. Throws on missing `SUPABASE_SERVICE_ROLE_KEY`. This is the canonical service-role client.
- `createServiceClient` is referenced exactly 3 times in the repo — all 3 inside `lib/refund-actions.ts` itself. Zero external callers. Confirmed via Grep.
- `createAdminClient` is referenced 30+ times across `lib/timer-actions.ts`, `lib/tournament-controller-actions.ts`, `lib/player-actions.ts`, `lib/financial-intents.ts`, 4 dashboard pages, and 3 API routes. **Every single call site uses no `await`** because the function is synchronous. The codebase convention is unambiguous.
- The two `createServiceClient` call sites in `refund-actions.ts` were used for: (a) line 22 — `validateRefund` RPC call (admin client appropriate, no auth context needed since the calling function does no auth check); (b) line 46 — `initiateRefund` RPC call + `financial_intents` table writes, after the function performs a staff-role auth check using the regular `createClient`. Both call sites legitimately need RLS bypass via the admin client.

**Choices made:**
- **Switch to existing `createAdminClient`; do not create `lib/supabase/service.ts`.** Reasoning: same PROMPT rule applied in iter 7 ("Don't add features, refactor, or introduce abstractions beyond what the task requires") + iter-7's learned heuristic ("default to switch to existing equivalent unless 2+ callers exist for the new abstraction"). Zero external callers exist for a hypothetical `createServiceClient`. Creating `service.ts` would just re-export `createAdminClient` under a different name and produce two canonical patterns where one suffices.
- **Drop the `await` on lines 22 and 46.** `createAdminClient` is synchronous. Keeping `await` would type-check (await on non-Promise is allowed by TS — resolves to the underlying type) but contradicts the 30+ existing call sites that all use no-await. Matching convention is cheap and reduces future grep-mismatches.
- **Consolidate imports onto one line.** `lib/refund-actions.ts:3` already imported `createClient` from `@/lib/supabase/server`. Adding `createAdminClient` to that same line matches the pattern at `lib/timer-actions.ts:3`, `lib/player-actions.ts:3`, `lib/tournament-controller-actions.ts:3`, `app/dashboard/admin/users/page.tsx:1`, and `app/api/admin/payouts/approve/route.ts:1`. Removing the (now-broken) second import line as part of the same edit produces a clean, idiomatic result.
- **Preserve local variable names (`supabase` at line 22, `serviceClient` at line 46).** They are local to the function body and accurately describe each variable's role. Renaming `serviceClient → adminClient` is cosmetic churn outside the bug's scope — touches more lines for no functional improvement.

**Pre-edit verifications:**
- Read full `lib/refund-actions.ts` (219 lines) to map every `createServiceClient` call site and downstream usage. Verified RPC calls (`create_refund_intent`, `process_refund_intent`, `validate_refund`) and table operations (`from("financial_intents").update`, `from("financial_intents").select`) are all admin-client-compatible — these are the same kinds of operations performed via `createAdminClient` elsewhere in `lib/financial-intents.ts`.
- Read full `lib/supabase/server.ts` (66 lines) to confirm `createAdminClient` is synchronous, returns the right shape, and throws on missing env (matches the failure mode `refund-actions.ts` would want if the env is broken — fail loud).
- Grep'd `createServiceClient` repo-wide → 3 matches, all in `lib/refund-actions.ts`. Confirmed no external callers.
- Grep'd `createAdminClient` repo-wide → 30+ matches, all using the no-await convention.
- Grep'd `lib/supabase/service` → only the broken import line. Confirmed the module truly does not exist.
- Glob'd `lib/supabase/*` → 5 files, none named `service.ts`.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -E "refund-actions|supabase/service"` → empty output.
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 329 (was 330). Exactly 1 error eliminated, zero new errors introduced.
- `diff ralph-dev/tsc-errors-iter7-after.txt ralph-dev/tsc-errors-iter8-after.txt` → single-line removal `lib/refund-actions.ts(5,37): error TS2307: Cannot find module '@/lib/supabase/service' or its corresponding type declarations.` Clean diff, no collateral.

**Out of scope deliberately:**
- Auditing whether `initiateRefund`'s staff-role check at lines 55-64 is sufficient authorization for the admin-client-driven writes that follow. Security audit concern (Phase 4/5), not a Phase 3 type-error fix. Behavior is unchanged from before the fix — same code path, same auth check, same writes.
- Renaming `serviceClient` to `adminClient` to match codebase naming. Cosmetic churn; local scope only.
- Creating `lib/supabase/service.ts` as a re-export shim. Zero external callers; PROMPT forbids backwards-compatibility shims when the call sites can just be edited.
- Fixing the remaining 2 broken imports in TRIAGE §3 (`lib/supabase/introspections.ts`, `components/player/player-controller.tsx`). One root cause per iter — bundling them would defeat the surgical-diff verification heuristic established in iter 7.

**Acceptance flipped:** None. Phase 3 ACCEPTANCE items are aggregate ("Zero TypeScript errors", "All broken imports resolved", "All missing type definitions added") — flipping requires the full §3 set to be clean. Currently 2 of 4 fixed.

**Learned:** Two carry-forward facts. (a) **Convention for fixing broken imports to non-existent modules:** when the file already imports something from the canonical equivalent module, consolidate onto the existing import line rather than adding a separate import statement. Matches the dominant pattern across the lib/ tree and reduces line noise. (b) **Sync vs async client functions:** `createClient` (server.ts) is async because of `cookies()`; `createAdminClient` (server.ts) is sync because the service-role client construction doesn't read cookies. Any future iter that touches both must keep the asymmetry — don't accidentally add `await` to `createAdminClient` to "match" the other one. The 30+ existing call sites are the source of truth.

**Next:** Iter 9 — TRIAGE §3 broken import #3 of 4: `lib/supabase/introspections.ts:1` imports a named `supabase` from `@/lib/supabase/client`, but `client.ts` only exports a `createClient()` factory. Plan: (1) Read `lib/supabase/introspections.ts` AND `lib/supabase/introspection.ts` (note the singular-vs-plural collision — iter must confirm which is real vs typo/dead before editing). (2) Map downstream usage of the `supabase` identifier inside introspections.ts. (3) Decide between three repairs: `const supabase = createClient()` (browser client — likely wrong for an introspection/admin script), `const supabase = createAdminClient()` (service-role — likely correct), or delete the file if it's dead. (4) If alive, prefer the smallest fix that clears the TS2305; downstream errors in the file (TRIAGE notes 9 total) may need follow-up iters. (5) Re-run tsc, write `ralph-dev/tsc-errors-iter9-after.txt`, diff vs iter8-after — expect ≥1 line drop.


## 2026-05-24 — iter 9 — Phase 3: TRIAGE §3 broken import #3 of 4 (introspections.ts deletion)

**Fixed:** Deleted `lib/supabase/introspections.ts` (plural) — a dead, internally-malformed duplicate that had no callers anywhere in the repo. The file produced 9 TypeScript errors: 1 × TS2305 (`Module '"@/lib/supabase/client"' has no exported member 'supabase'`) on line 1, plus 4 × TS2323 + 4 × TS2393 from a duplicate paste of a different implementation in lines 12-44 that redeclared `getSchema`, `getRLS`, and `supabase`. Deletion via `gio trash` (recoverable; matches user's trash-not-rm rule and the iter 5 convention). Also dropped the stale `lib/supabase/introspections.ts:18` reference from `ralph-dev/ENV.md` row 12 — `SUPABASE_URL` remains because `app/api/setup-carbardmv/route.ts:5` still uses it. tsc error count: 329 → 320 (exactly 9 errors eliminated, zero new errors).

**Why this was needed:** Third entry in TRIAGE §3 (broken imports). Note from STATE.md required disambiguation of the singular-vs-plural collision before editing — the plural was the dead one.

**Investigation:**
- `ls lib/supabase/` showed both `introspection.ts` (singular, 1059B) and `introspections.ts` (plural, 945B) — distinct files, not symlinks.
- Reading the full plural file (44 lines) showed it was malformed in a specific way: lines 1-11 were one version (broken `import { supabase } from "@/lib/supabase/client"` + 2 functions using RPC names `get_schema`/`get_rls_policies`), and lines 12-44 were a duplicate-pasted second version with its own `import { createClient } from "@supabase/supabase-js"`, its own local `const supabase = createClient(...)`, and re-declarations of `getSchema`/`getRLS` calling RPC names `get_full_schema`/`get_full_rls`. Even contained a `// /lib/supabase/introspection.ts` comment in the middle — suggesting someone pasted the singular file's contents into the plural at some point without removing the original head.
- Reading the singular file (35 lines) showed a clean, modern implementation: `supabaseAdmin` constructed once, 3 exports (`getSchema`, `getRLS`, `getTableCounts`), proper error handling with `throw new Error(...)`, RPC names `introspect_schema`/`introspect_rls`/`introspect_counts`. No TS errors in this file per the iter-8 capture.
- Reading `client.ts` (9 lines) confirmed `createClient` is the only export — a browser-client factory using `createBrowserClient` from `@supabase/ssr`. There is no `supabase` named export. The broken import was never going to resolve.
- Grep'd `supabase/introspection` repo-wide → 3 caller imports, all of `@/lib/supabase/introspection` (singular): `app/api/ai/context/route.ts:2`, `app/api/run/route.ts:2`, `app/api/access/db/route.ts:2`. Zero plural imports. Confirms `introspections.ts` is dead.
- Grep'd `process.env.SUPABASE_URL` repo-wide → 2 hits: the dead file (gone soon) and `app/api/setup-carbardmv/route.ts:5`. So the env var must stay in ENV.md/`.env.example`; only the reference list needs trimming.
- Grep'd current `ralph-dev/tsc-errors-iter8-after.txt` for `introspection` → all 9 hits in the plural file. The singular file has zero TS errors. Deletion safely removes 9 errors with no collateral risk to the singular file.

**Choices made:**
- **Delete the plural file rather than try to repair it.** Reasoning: it has zero callers. Fixing it would produce a working file that nothing imports — pure dead code. PROMPT rule "Don't add features, refactor, or introduce abstractions beyond what the task requires" applies; the singular `introspection.ts` is the canonical implementation and already wired everywhere it needs to be.
- **Trash via `gio trash`, not `rm`.** Matches user's "trash not rm" rule from global CLAUDE.md and the iter 5 convention. Recoverable for ~30 days from `~/.local/share/Trash` if anyone needs to inspect.
- **Update ENV.md row 12 in-place (drop just the stale ref); keep the `SUPABASE_URL` row.** The env var is still legitimately referenced by `setup-carbardmv/route.ts:5`. Removing the row entirely would orphan that consumer. Cleanest is to leave the row with the one remaining ref.
- **Did NOT update `.env.example`.** That file documents *which* variables are required, not *where* each is used. The set of required vars is unchanged this iter; only the ref documentation in ENV.md changed. Editing `.env.example` would be churn for no functional reason.
- **Did NOT delete `lib/supabase/introspection.ts` (singular) or modify any callers.** They are the canonical, working path — left alone per "If you touch a file, leave it more correct than you found it" and "Be incremental".

**Pre-edit verifications:**
- Read full `lib/supabase/introspections.ts` (44 lines, the doomed file).
- Read full `lib/supabase/introspection.ts` (35 lines, the keeper).
- Read full `lib/supabase/client.ts` (9 lines) to confirm `createClient` is the only export.
- `ls lib/supabase/` to confirm both files exist as distinct entities.
- Grep'd `supabase/introspection` repo-wide → 3 caller imports, all singular. Zero plural imports.
- Grep'd `process.env.SUPABASE_URL` repo-wide → 2 references; only one outside the dead file.
- Grep'd current tsc capture for `introspection` → confirms all 9 hits are in the plural file; singular file is clean.

**Post-edit verifications:**
- `ls lib/supabase/` → 4 .ts files (client, introspection, middleware, server) + Migrations subdir. Plural gone.
- `npx tsc --noEmit 2>&1 | grep -E "introspection"` → empty output. All 9 errors gone.
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 320 (was 329). Exactly 9 errors eliminated, zero new errors introduced.
- `diff ralph-dev/tsc-errors-iter8-after.txt ralph-dev/tsc-errors-iter9-after.txt` → 9 lines deleted (all from `lib/supabase/introspections.ts`), 0 lines added. Every dropped line is attributable to the one file removed. Surgical.

**Out of scope deliberately:**
- Adding `getTableCounts` (a 3rd export the singular file has but the plural didn't) to any caller. None of the 3 callers currently needs it; adding callers would be Phase 4 feature work.
- Auditing whether the RPC functions `introspect_schema`/`introspect_rls`/`introspect_counts` exist server-side in Supabase. Runtime / SQL concern, not a Phase 3 type-error fix. If they don't exist, the 3 route handlers will fail at runtime — surface that in Phase 5.
- Updating `.env.example`. The variable list is unchanged.
- Fixing the last broken import in TRIAGE §3 (`components/player/player-controller.tsx`, 4 × TS2304 for undeclared `playerId`). One root cause per iter.

**Acceptance flipped:** None. Phase 3 ACCEPTANCE items are aggregate. Currently 3 of 4 broken imports fixed; the §3 set is one iter from complete.

**Learned:** (a) **Dead-file deletion is a legitimate Phase 3 move.** When a broken-import file has zero importers, the right fix is delete-not-repair. The deletion test is one Grep away. This is the second dead-file case this loop (iter 5 deleted `app/api/access/core access/` placeholder dir; iter 9 deleted the plural introspections file). Two data points = an emerging convention to record for future iters. (b) **Larger diffs can still be surgical.** Iters 7 and 8 had single-line tsc diffs and that was held up as the verification heuristic. Iter 9 has a 9-line diff but is still surgical because every dropped line is attributable to the one file removed — the heuristic generalizes to "every change in the diff must be attributable to the iter's one root cause," which can manifest as either 1 line (point-fix) or N lines (dead-file deletion). The discipline is the same: no unrelated errors should change.

**Next:** Iter 10 — TRIAGE §3 broken import #4 of 4 (the last one): `components/player/player-controller.tsx:442,470,487,860` — `playerId` referenced but never declared (4 × TS2304 lines, one root cause). Plan: (1) Read the component's full props/params signature (likely a Next.js server-or-client component with `params` from a dynamic route, or a hook caller using `useParams()`). (2) Identify where `playerId` *should* come from — most likely either a destructured prop, a route param via `useParams()` from `next/navigation`, or a session-derived value via `supabase.auth.getUser()`. (3) Add the single declaration that makes all 4 reference sites legal. (4) Re-run tsc, write `ralph-dev/tsc-errors-iter10-after.txt`, expect ≥4 line drop. (5) After iter 10, §3 should be fully clean — the next iter can then move on to TRIAGE §4 (Stripe `apiVersion` literal drift in 3 routes, an easy string-literal fix).


## 2026-05-24 — iter 10 — Phase 3: TRIAGE §3 broken import #4 of 4 (player-controller.tsx playerId thread-through)

**Fixed:** `components/player/player-controller.tsx:442,470,487,860` — `playerId` referenced inside two helper sub-components (`CurrentMatchSection`, `SeatingsSection`) that never declared it as a prop. The outer `PlayerController` already had `playerId?: string` (line 70) and destructured it (line 86), but the value was never threaded down to the helpers. Added `playerId?: string` to both helpers' prop signatures, passed `playerId={playerId}` at both call sites (lines 339, 362), and guarded the two `MatchResultReporter` renders (lines 467, 484) with `&& playerId` so the reporter's required `playerId: string` prop still satisfies. 4 × TS2304 eliminated, 0 new errors. tsc count: 320 → 316. **Flipped ACCEPTANCE Phase 3 line 23** ("All broken imports resolved") — TRIAGE §3 is now fully clean (iter 7, 8, 9, 10).

**Why this was needed:** Last entry in TRIAGE §3 (broken imports / undeclared names). Closing this set is a meaningful milestone — the next Phase 3 attack surface (§4+: Stripe `apiVersion` drift, Supabase relation-shape drift, etc.) is non-broken-import type drift.

**Investigation:**
- Read line counts: file is 893 lines. Surveyed ranges 57-100 (outer props + entry), 339-365 (helper call sites), 411-545 (CurrentMatchSection + MatchResultReporter), 848-895 (SeatingsSection).
- `PlayerController` props (line 57-71): `playerId?: string // The player's ID in this tournament (from players table)`. Destructured line 86. So the prop exists at the outer level.
- The 4 error sites all live in nested function components defined later in the same file:
  - `CurrentMatchSection` (declared line 411 with props `match`/`userId`/`points`/`tournamentId` — no `playerId`). Uses `playerId` at line 442 (`match.player1_id === playerId`), line 470 (`<MatchResultReporter playerId={playerId} />`), line 487 (`<MatchResultReporter playerId={playerId} … prefillWins=… />`).
  - `SeatingsSection` (declared line 848 with props `matches`/`userId` — no `playerId`). Uses `playerId` at line 860 (`match.player1_id === playerId`).
- Call sites for the two helpers (lines 339, 362) also did NOT pass `playerId` through. Bug = thread-the-prop bug.
- `MatchResultReporter` (declared line 533) requires `playerId: string` (line 543). The helper-side `playerId` from `PlayerController` is `string | undefined`. Without a guard, fixing TS2304 would introduce TS2322.
- `reportMatchResult` (lib/tournament-controller-actions.ts:531-537) requires `reportingPlayerId: string`. Anchors the guard-vs-loosen-prop choice: the reporter genuinely needs a real string, the runtime contract demands it.
- Grep'd `PlayerController` repo-wide: 2 call sites. `app/dashboard/player-portal/[id]/page.tsx:91` passes `playerId={playerId}`. `app/dashboard/my-events/[id]/page.tsx:46` does NOT pass `playerId`. Anchors the `playerId?: string` (optional) choice on the helpers — making it required would break the my-events caller and require Phase-4-scope downstream work to derive `playerId` from the user's tournament registration.

**Choices made:**
- **`playerId?: string` (optional) on both helpers.** Matches the outer optionality and preserves the my-events caller's contract.
- **Guard `MatchResultReporter` renders with `&& playerId`.** Localizes the `string | undefined → string` narrowing at the render site. Reflects runtime truth: you cannot report a match result without a player ID. Less invasive than making the reporter's `playerId` optional (which would push 4+ undefined checks into `handleQuickReport`/`handleDetailedReport`).
- **Did NOT make `PlayerController.playerId` required.** Would break my-events caller and force a Phase-4-scope downstream change. Out of scope for a TS2304 fix.
- **Did NOT add a `useMemo`/extracted derivation for `playerId` inside the helpers.** Pure prop thread-through is the minimum correct change.
- **Did NOT touch the 7 type-drift errors in `app/dashboard/player-controller/page.tsx` (TS2339 for `player2`/`player1`/`round_number` on Supabase relation shapes).** Different file, different root cause; not in TRIAGE §3. Belongs to a later iter.
- **Reflowed the `CurrentMatchSection` call site formatting** (removed trailing whitespace on each line of the JSX). Minor cosmetic fold inside the same edit — the original `old_string` was easier to make unique with the clean version. Stays inside the same JSX block.

**Pre-edit verifications:**
- Read line 1-100 of `components/player/player-controller.tsx` (outer component + props).
- Read lines 335-367, 395-425, 420-510, 530-595, 840-895 (all relevant ranges).
- Grep'd `CurrentMatchSection|SeatingsSection`: exactly 2 call sites + 2 declarations each.
- Grep'd `MatchResultReporter`: 2 render sites + 1 declaration. Read declaration to confirm `playerId: string` required.
- Read `reportMatchResult` signature: `reportingPlayerId: string` required.
- Grep'd `PlayerController` repo-wide: 2 call sites; only one passes `playerId`.
- Confirmed via iter-9 tsc capture that only the 4 `playerId` errors exist in `player-controller.tsx` — no latent errors.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -E "player-controller\.tsx"` → empty. All 4 errors gone.
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 316 (was 320). Exactly 4 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter9-after.txt ralph-dev/tsc-errors-iter10-after.txt` → 4 lines deleted, 0 lines added. Surgical, matches iter 7/8 pattern.
- Confirmed 7 pre-existing TS2339 errors in `app/dashboard/player-controller/page.tsx` unchanged.

**Out of scope deliberately:**
- 7 TS2339 errors in `app/dashboard/player-controller/page.tsx` (Supabase relation-shape drift). Different file, different root cause.
- Renaming/removing the now-possibly-unused `userId` prop on `SeatingsSection`. Cosmetic; might still be live in JSX I didn't fully audit. Single-purpose iter.
- Threading `playerId` into other helpers (StandingsSection, DecklistSection). They currently compile; touching them would be feature work, not a TS-error fix.
- Auditing whether the my-events caller SHOULD pass `playerId` (semantically the player ID exists for a registered player; it's just not derived in the page-level data fetch). That's Phase 4 feature-correctness work, not Phase 3 type-error work.
- Stripe `apiVersion` drift in TRIAGE §4. Next iter's work.

**Acceptance flipped:** Phase 3 line 23 — "All broken imports resolved" → `[x]`. All 4 TRIAGE §3 entries are now resolved across iters 7-10.

**Learned:**
- **Convention for missing-name errors inside nested components:** When a `Cannot find name` error fires inside a helper sub-component but the name is a legitimate prop on the parent, the fix is prop thread-through — add to helper prop signature, pass at call site, match the outer optionality. Don't introduce a derivation or context provider unless 2+ helpers need it.
- **Optional-to-required prop boundary:** When threaded `T | undefined` reaches a downstream child that requires `T`, guard the render with `&& <value>` rather than loosening the downstream prop. Guards localize narrowing at the render boundary and preserve the strict contract for callers that DO have the value. The runtime semantics often align — if the value is genuinely required for the downstream operation (here: `reportMatchResult` needs a real player ID), hiding the UI when the value is missing is the right behavior anyway.
- **Multi-edit single-iter discipline:** This iter made 6 edits to one file (call sites, prop signatures, guards). The discipline holds — all 6 edits trace to the single root cause (thread `playerId` through to two helpers without violating downstream contracts). Single-iter does not mean single-edit; it means single root cause.

**Next:** Iter 11 — TRIAGE §3 is fully clean; start TRIAGE §4. Re-read `ralph-dev/TRIAGE.md` to confirm the current §4 entry list. Easiest known target: Stripe `apiVersion` literal drift across 3 routes — purely string-literal mismatches against `lib/stripe.ts`'s canonical `"2025-02-24.acacia"`. Plan: (1) Re-read TRIAGE.md §4. (2) `grep -rn "apiVersion" app/api lib | rg -v node_modules` to enumerate. (3) Either align literals to canonical, or — if `lib/stripe.ts` exports a configured singleton — switch the 3 callers to import that singleton (matches iter-7/iter-8 convention). (4) Re-run tsc, write `ralph-dev/tsc-errors-iter11-after.txt`, expect ≥3 line drop.


## 2026-05-24 — iter 11 — Phase 3: TRIAGE §2c Stripe apiVersion drift (3 routes consolidated onto lib/stripe singleton)

**Fixed:** Three route handlers each constructed their own `new Stripe(...)` with a drift apiVersion literal that the installed Stripe SDK type rejected:
- `app/api/admin/payouts/approve/route.ts:5-7` — `"2025-03-31.basil"` (too new — not in the SDK's literal union)
- `app/api/cron/process-payouts/route.ts:12-14` — `"2024-06-20"` (too old)
- `app/api/cron/reconcile-intents/route.ts:7-9` — `"2024-06-20"` (too old)

`lib/stripe.ts` exports a canonical `stripe` singleton (`new Stripe(process.env.STRIPE_SECRET_KEY!)`) with no apiVersion pin, letting the SDK use its default `LatestApiVersion` ("2025-02-24.acacia"). Replaced all three per-route Stripe instantiations with `import { stripe } from "@/lib/stripe"`. Eliminated 3 × TS2322. tsc count: 316 → 313.

**Why this was needed:** TRIAGE §2c is the most mechanically tractable open Phase-3 work — pure string-literal drift, single error code (TS2322), 3 files with identical fix pattern. Closing it before moving to the larger TS2339/TS2559 drift work continues the iter-7/iter-8 pattern of "high-density, low-risk type fixes first."

**Investigation:**
- Read iter-10 tsc capture lines 21, 26, 27 — confirmed exactly 3 TS2322 errors keyed to apiVersion literals.
- Read `lib/stripe.ts` (6 lines): `import "server-only"`; `export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)`. No apiVersion pinned — the SDK defaults to LatestApiVersion. This is the canonical client for the repo.
- Grep'd `new Stripe(` repo-wide: 9 call sites (1 in lib/stripe.ts singleton, 8 in route handlers). The 8 ad-hoc instantiations each pin their own apiVersion literal. Three of them (the targets) use literals outside the SDK's accepted union; the other five use `"2024-12-18.acacia"` or `"2025-02-24.acacia"` which ARE accepted, so they don't error.
- Grep'd `apiVersion:` repo-wide to enumerate all literal values (9 total across the 8 route files + nothing in singleton). Confirms the 3 target literals.
- Grep'd `\bStripe\b` in each of the 3 target files: usages are limited to the `import Stripe from "stripe"` line, the `const stripe = new Stripe(...)` block, and Stripe-as-word in comments/error strings. No `Stripe.something` type/namespace references. Safe to remove the default `Stripe` import alongside the constructor block.
- All 3 target files are server-side route handlers (`app/api/.../route.ts`), so the `"server-only"` guard on `lib/stripe.ts` is satisfied.

**Choices made:**
- **Switched to the singleton (`import { stripe } from "@/lib/stripe"`) rather than aligning apiVersion literals.** Reasoning: the canonical singleton already exists, has zero apiVersion drift risk (no pinned literal), and 2 of the 3 target routes are doing the same thing (cron/payouts, cron/reconcile-intents). Aligning literals would have left 3 ad-hoc `new Stripe(...)` calls in the codebase that would re-drift the next time someone bumps the SDK. The singleton pattern eliminates that whole class of bug going forward. Matches iter-7/iter-8 convention: "default to the existing canonical equivalent."
- **Did NOT touch the other 5 ad-hoc Stripe instantiations** (`app/api/v1/tickets/purchase/route.ts`, `app/api/kyc/refresh-status/route.ts`, `app/api/kyc/create-session/route.ts`, `app/api/wallet/withdraw/route.ts`, `app/api/admin/reconciliation/route.ts`, `app/api/v1/orders/[orderId]/refund/route.ts`). They currently compile — their apiVersion literals are in the SDK's accepted union. Touching them would be a refactor (cosmetic consolidation), not a bug fix. Out of scope per PROMPT.md "No cosmetic changes" rule. They'll be at risk the next time someone bumps the SDK and the literal falls out of the union — a future iter or PR can consolidate then.
- **Did NOT add `apiVersion` to the singleton in `lib/stripe.ts`.** The current default-version behavior matches what these 3 routes need, and adding an explicit pin would be a style/refactor change beyond the bug fix.
- **Removed the now-unused `import Stripe from "stripe"` from each file** rather than leaving it. Stripe is not used as a type or namespace in any of the 3 files (grep confirmed). Leaving the import would surface a TS6133 (unused import) under stricter settings and is dead code today.

**Pre-edit verifications:**
- Read full `app/api/admin/payouts/approve/route.ts` (139 lines). Confirmed Stripe constructor at line 5-7, no `Stripe.` namespace references, all `stripe.` method calls are valid against the canonical client.
- Read first 30 lines of `app/api/cron/process-payouts/route.ts`. Confirmed constructor at line 12-14.
- Read first 20 lines of `app/api/cron/reconcile-intents/route.ts`. Confirmed constructor at line 7-9.
- Grep'd `Stripe` (case-sensitive, word boundary) in each of the 3 files — confirmed Stripe-the-symbol is used only by the import and constructor lines; all other matches are comments/strings.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 313 (was 316). Exactly 3 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter10-after.txt ralph-dev/tsc-errors-iter11-after.txt` → 3 lines deleted (the 3 TS2322 lines for the apiVersion literals at the exact lines edited), 0 lines added. Surgical, matches iter-7/iter-8 pattern.
- `grep -E "admin/payouts/approve|cron/process-payouts|cron/reconcile-intents"` against iter-11 capture → empty. All errors in the 3 edited files are gone, no latent errors uncovered.

**Out of scope deliberately:**
- The other 5 ad-hoc `new Stripe(...)` callers (`tickets/purchase`, `kyc/refresh-status`, `kyc/create-session`, `wallet/withdraw`, `admin/reconciliation`, `orders/[orderId]/refund`). They compile today; consolidating them onto the singleton would be a cosmetic refactor.
- The other entries in TRIAGE §2 (TS2339 110 errors, TS2559 49 errors, TS2345 43 errors, TS2322 remaining 25 errors after this fix, etc.). Higher mechanical-fix density per iter is possible if we batch by single-file or single-root-cause groupings — next iter should pick the densest target.
- The 2 TS1378 top-level await errors in `app/api/run/route.ts` (TRIAGE §2d). Resolving these requires `tsconfig.json` changes (module/target bump) which would have repo-wide effects; needs more scrutiny than a one-iter fix.
- Adding an explicit `apiVersion` pin to `lib/stripe.ts`. Cosmetic.

**Acceptance flipped:** None. TRIAGE §2c is now resolved (3 TS2322s gone), but ACCEPTANCE Phase 3 boxes are aggregate ("Zero TypeScript errors", "All missing type definitions added") and still have 313 errors to go. The "All broken imports resolved" box was flipped in iter 10.

**Learned:**
- **Singleton-replacement convention for SDK clients:** When the canonical equivalent is a configured singleton and an ad-hoc per-caller instantiation exists with the same secret/config, the fix is "switch caller to singleton" — not "align the ad-hoc config." Even when 2+ ad-hoc callers exist, the singleton wins because it eliminates the whole class of "config drift over time" bug. Iter-7's convention was "switch to canonical equivalent" for module-level imports; this iter extends it to SDK client instantiation patterns.
- **Selective scope discipline:** Of 8 ad-hoc Stripe instantiations, only 3 errored today. The temptation to "consolidate all 8 onto the singleton" is real (DRY, future-proofing, deletes 5 more `new Stripe(...)` blocks), but it's a refactor disguised as a bug fix — out of scope under PROMPT.md's "No cosmetic changes" rule. The discipline is: fix what errors today; don't touch what compiles. The 5 surviving ad-hoc callers are a Phase 5 / Phase 6 cleanup target, not a Phase 3 type-error iter.
- **Mechanical-fix density heuristic:** Iters 7-11 averaged ~5 errors fixed per iter (1+1+9+4+3 = 18 errors across 5 iters). The TS2304 (broken imports) and TS2322 (literal drift) categories had high density because each error mapped to one root cause and the fix pattern was uniform. TS2339 (110 errors, "property does not exist") will have lower per-iter density because errors likely cluster around Supabase generated type drift and won't share a uniform fix pattern. Plan iter-12 accordingly — expect 1-2 errors per iter on TS2339 work unless a single file has a cluster.

**Next:** Iter 12 — pick the next TRIAGE §2 target. Candidates ranked by mechanical-fix density:
1. `lib/role-actions.ts` (26 errors, top file). Likely Supabase relation-shape drift or admin-client typing. Single-file means a regen-types or `as any` cast fix could close many errors at once. **Recommended first pass.**
2. `app/(dashboard)/notifications/page.tsx` (3 × TS2741 missing `tournament_registration` in Record<NotificationType, ...>). Tightly scoped; one symbol added to 3 Records would close them all.
3. `app/api/v1/tickets/purchase/route.ts` + `app/api/v1/tickets/check-in/route.ts` + `app/api/v1/events/[eventId]/route.ts` + `app/api/v1/events/route.ts` + `app/api/v1/ticket-types/route.ts` (16+16+15+14+12 = 73 errors, all using the v1 API error helpers with shared TS2559/TS2345 patterns). One fix to the shared API error helper signatures could close many at once. **Highest density potential.**

Recommend iter-12 attempt (2) first (smallest, contained, 3 errors with one likely-mechanical fix), then iter-13+ attack (3) as a multi-iter shared-helper fix.


## 2026-05-24 — iter 12 — Phase 3: notifications-page Record gap closed (3 × TS2741)

**Fixed:** `app/(dashboard)/notifications/page.tsx` declared three `Record<NotificationType, ...>` literals (`typeIcons` at line 38, `typeColors` at line 52, `typeLabels` at line 66), each with only 11 of the union's 12 keys — missing `tournament_registration`. Added one entry to each Record adjacent to the existing `tournament_starting` line. Eliminated 3 × TS2741. tsc count: 313 → 310.

**Why this was needed:** The recommended first-pass target from iter-11's STATE.md. Smallest open Phase 3 target (3 errors, one file, one root cause). Followed the iter-7/iter-8/iter-11 pattern of "high-density, low-risk type fixes first" before attacking the larger Supabase-drift clusters.

**Investigation:**
- Read full `app/(dashboard)/notifications/page.tsx` (379 lines). Confirmed three Records and verified no other consumers of `NotificationType` in this file.
- Grep'd `NotificationType|tournament_registration` in `lib/notification-actions.ts` — confirmed:
  - The union has exactly 12 members (lines 11-23), with `tournament_registration` at line 16.
  - `tournament_registration` is used in a real dispatch at line 504 (`type: "tournament_registration"`) — not a stale variant.
- Grep'd `notifications/page.tsx` in `ralph-dev/tsc-errors-iter11-after.txt` — confirmed exactly 3 errors, all TS2741, all about `tournament_registration`.

**Choices made:**
- **Mirrored `tournament_starting` values for icon (`Trophy`) and color (`text-primary`).** Both are tournament lifecycle events in the same visual category — same semantic group, same visual treatment. The label diverges (`"Tournament Registration"` vs `"Tournament"`) because that distinction IS user-facing and is the reason the two variants exist.
- **Placed each new entry immediately after `tournament_starting`** rather than at the end of the Record. Adjacency by semantic grouping reads better than chronological insertion order and makes the dual-tournament-variant pattern visible at a glance.
- **Did NOT modify `NotificationType` or the dispatcher in `lib/notification-actions.ts`.** Those are correct; the page Records were the lagging code.
- **Did NOT audit other consumers of `NotificationType` for the same gap.** The tsc capture only flagged `notifications/page.tsx` — other Record/switch consumers either compile today or use `Partial<Record<>>` / exhaustive-check helpers. Phase 3 fixes what tsc shows, not latent gaps.
- **Did NOT refactor the three Records into one `Record<NotificationType, {icon, color, label}>`.** Cosmetic — out of scope per PROMPT.md.

**Pre-edit verifications:**
- Read full target file (379 lines).
- Read `lib/notification-actions.ts:1-35` to confirm the union shape.
- Cross-checked tsc-errors-iter11 capture to confirm exactly 3 errors keyed to this file, no latent errors.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 310 (was 313). Exactly 3 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter11-after.txt ralph-dev/tsc-errors-iter12-after.txt` → 3 lines deleted, 0 added. Surgical, matches iter-7/iter-8/iter-11 pattern.
- `grep "notifications/page.tsx" ralph-dev/tsc-errors-iter12-after.txt` → empty. File is fully clean.

**Out of scope deliberately:**
- Auditing other repo-wide `Record<NotificationType, ...>` consumers for the same missing-key pattern. Phase 3 fixes errors tsc shows; consumers that compile today don't need preemptive fixing.
- Combining the 3 Records into one (cosmetic refactor).
- The other open Phase 3 categories — `lib/role-actions.ts` (26 TS errors), v1 API cluster (~73 errors), TS2551 batch (~19 errors). One root cause per iter.

**Acceptance flipped:** None. ACCEPTANCE Phase 3 aggregate boxes ("Zero TypeScript errors", "All missing type definitions added") still have 310 errors to go. No individual ACCEPTANCE box maps to "notifications-page Record gap closed."

**Learned:**
- **Convention for `Record<Union, T>` missing-key (TS2741) errors:** Add the missing key adjacent to the most semantically-related existing key — not at the end of the Record. When the new variant is a sibling of an existing key (here: `tournament_registration` is a sibling of `tournament_starting` — both tournament lifecycle events), mirror the values of that related key by default. Only diverge on values where the distinct-variant argument is real and user-facing (here: only the label diverges, because the icon and color groupings are the same visual category but the label is the user-facing distinction). This keeps the Record self-documenting: future readers see the pair and immediately understand the grouping without reading dispatch sites.
- **Multi-Record uniform fixes:** When the same union-member gap exists across multiple Records in the same file, fix all of them in the iter — not just one — because the cost of finding and re-reading the file is fixed and the gaps share a single root cause (the variant was added to the union but the page Records weren't updated). Single iter, multiple edits, one root cause — same discipline as iter 10.
- **The `lib/notification-actions.ts:504` real-dispatch check** is the test that decides whether to delete the missing variant from the union or add it to the Records. If the variant has zero callers, removing it from the union is the correct fix and would close the same 3 errors. Here a real dispatch exists, so adding to the Records is the right direction.

**Next:** Iter 13 — pick the next TRIAGE §2 target. Updated candidates with notifications-page now closed:
1. **Recommended:** `app/api/v1/` shared-helper cluster (~73 errors across 5 route files, TS2559/TS2345 patterns). One fix to the shared error helper could close 20-40 at once. Plan: (1) Read one route file. (2) Locate the shared helper (likely `lib/api/errors.ts`, `lib/api/responses.ts`, or `app/api/v1/_lib/`). (3) Read helper + 2-3 callers. (4) Fix helper signature OR fix callers to match. Risk: helper may be touched by non-v1 routes; mitigate by grep-ing usage breadth first.
2. Alternative: `lib/role-actions.ts` (26 errors, top single file). Likely Supabase relation drift or admin-client typing. Risk: may need a full types regen which the loop can't run without DB access.
3. Smaller-scoped fallback: 19 TS2551 errors (typos/drift). Usually 1 error per edit, very high mechanical-fix density. Enumerate with `grep "TS2551" ralph-dev/tsc-errors-iter12-after.txt`, batch-fix by callee.


## 2026-05-24 — iter 13 — Phase 3: v1 events/[eventId] route fully aligned to api-response helper (15 errors)

**Fixed:** `app/api/v1/events/[eventId]/route.ts` had 15 errors from convention drift between callers and the canonical `apiError`/`apiSuccess` helper in `lib/middleware/api-response.ts`. Callers passed HTTP status as a redundant 3rd positional arg (TS2559) and used legacy type names not in the `ApiErrorType` union (TS2345). One `apiSuccess` site passed a raw headers bag (`{ "X-RateLimit-Remaining": ... }`) where the helper expects a typed options object (TS2353). Applied a canonical-name remap (`"not_found"` → `"resource_not_found"`, `"permission_denied"` → `"authorization_error"`, `"database_error"` → `"internal_error"`, `"conflict"` → `"idempotency_error"`), dropped all 3rd-arg status codes (each matched the helper's auto-derivation, so no behavior change), and rewrote the headers-bag call as `{ rateLimit: rateLimitResult }`. Also added `{ rateLimit: rateLimitResult }` to the rate-limit-exceeded response (the legacy code had no rate-limit headers on that response — a small correctness improvement, not just a type fix). 15 errors eliminated, zero new errors. tsc count: 310 → 295.

**Why this was needed:** First strike against the v1 API cluster (~73 errors across 5 dense files), the iter-13 recommended target. The cluster shares one root cause (the `apiError`/`apiSuccess` callers drifted from the helper signature); iter-13's job was to establish the fix recipe in the smallest of the five files so iters 14-17 can apply it mechanically to the other four.

**Investigation:**
- Sampled 40 lines of v1 errors via `grep -E "v1/(tickets|events|ticket-types)" ralph-dev/tsc-errors-iter12-after.txt | head -40`. Confirmed shared TS2559/TS2345/TS2353 patterns.
- `find lib/api` returned nothing; `grep ApiErrorType` found the helper at `lib/middleware/api-response.ts`.
- Read full helper (116 lines): `apiError(type: ApiErrorType, message, options?: { code?, param?, rateLimit? })` with status auto-derived from `STATUS_CODES[type]`; `apiSuccess(data, options?: { rateLimit?, status? })`. Both helpers are correct and Stripe-style.
- Read full target route (181 lines): confirmed 15 errors keyed to this file, all from caller-side drift.
- Verified helper-usage breadth: `grep "from \"@/lib/middleware/api-response\""` returned exactly 12 files, ALL under `app/api/v1/`. No risk of helper changes touching non-target code.
- Counted error-code distribution in v1 cluster: TS2559 × 49, TS2345 × 33, TS2554 × 9, TS2353 × 4, TS2339 × 4, TS2322 × 2 (total 101). This file's 15 are 7 TS2559 + 7 TS2345 + 1 TS2353.
- Tallied legacy type-name occurrences: 12 `"database_error"`, 8 `"permission_denied"`, 5 `"not_found"`, 1 each of `"conflict"`/`"duplicate_error"`/`"inventory_error"`/`"order_error"`/`"payment_error"`/`"refund_error"`. Built the canonical-name remap table from this list before editing.

**Choices made:**
- **Aligned callers to the helper, did NOT alias the contract.** The helper is the canonical Stripe-style API surface; legacy names (`"not_found"`) are HTTP-status-aligned but pollute the typed contract if added as aliases. Aligning callers is the right direction.
- **One file this iter, not all 5 v1 cluster files.** PROMPT.md: "Be incremental. One bug / one feature per iteration." Recipe established; iters 14-17 apply it.
- **`"conflict"` → `"idempotency_error"`.** Semantic name doesn't match cleanly, but status (409) matches exactly and "idempotency" is what the canonical helper calls all 409s. User-facing message carries the real meaning.
- **Used 5 surgical `Edit` calls** rather than one Write rewrite — one per handler section (GET-auth/rate-limit, GET-not-found/success/catch, PATCH-auth/permission/not-found, PATCH-update/catch, DELETE-full). Diff stays easy to review, isolation per chunk.
- **Added rate-limit headers to the rate-limit-exceeded response.** The legacy code emitted zero rate-limit headers on that response, ironically. Passing `{ rateLimit: rateLimitResult }` lets the helper add `X-RateLimit-*` headers consistently. Not strictly required for the type fix but a real correctness improvement.

**Pre-edit verifications:**
- Read full target file (181 lines).
- Read full helper (116 lines).
- Verified helper-usage breadth (12 files, all v1).
- Cross-checked iter-12 tsc capture against `events/[eventId]/route.ts` lines.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 295 (was 310). Exactly 15 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter12-after.txt ralph-dev/tsc-errors-iter13-after.txt` → 15 lines deleted, 0 added. Surgical, matches iter-7/iter-8/iter-11/iter-12 pattern.
- `grep "events/\[eventId\]/route.ts" ralph-dev/tsc-errors-iter13-after.txt` → empty. File is fully clean.

**Out of scope deliberately:**
- The other 4 dense v1 cluster files (`tickets/purchase`, `tickets/check-in`, `events/route.ts`, `ticket-types/route.ts`). Same recipe — iters 14-17.
- The other 8 lower-error v1 cluster files. Visit only if needed.
- Aliasing legacy names into `ApiErrorType`. Wrong direction.
- The `authResult.user_id` TS2339 in `events/route.ts:158`. Different root cause (auth-result shape drift), deferred to iter 15+ where it will be addressed in `events/route.ts` directly.

**Acceptance flipped:** None. ACCEPTANCE Phase 3 boxes are aggregate; 295 errors still to go.

**Learned:**
- **Caller-alignment recipe for "many drifted callers to one canonical helper":** Read the helper, build a canonical-name remap table, verify helper-usage breadth (grep import path), then fix callers one file per iter using the recipe. Don't alias the contract — even when caller count is large. Don't try to fix all caller files in one iter — the recipe is the point, the application is mechanical, multi-iter discipline keeps regressions visible.
- **"Redundant arg matches auto-derived value" is a no-op behavior fix.** Each dropped `, 404)` in `apiError("resource_not_found", "msg", 404)` is a true no-op because `STATUS_CODES["resource_not_found"]` is 404. When the redundant arg DOES NOT match the auto-derived value (rare but possible), the canonical contract wins — fix the caller's intent (use the right type name) rather than override the auto-derivation. The helper's status table is the contract.
- **For headers/options bags passed as a literal record where the helper expects a typed options object, replace with the helper's preferred option.** Often this is a correctness improvement, not just a type fix — the legacy code may be emitting fewer headers than intended (e.g., `{ "X-RateLimit-Remaining": ... }` only sets one header; `{ rateLimit: rateLimitResult }` sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` via the helper's `addRateLimitHeaders` utility).
- **Helper-usage breadth check is mandatory before deciding helper-edit vs caller-edit.** If the helper had non-v1 callers, weakening the contract would have broken them. Grep first, then decide. (12 files, all v1 — caller-alignment was safe.)

**Next:** Iter 14 — apply the iter-13 recipe to the next densest v1 cluster file.
1. **Recommended:** `app/api/v1/tickets/purchase/route.ts` (16 errors). Top single-file count remaining. Same fix recipe. Risk: `purchase` likely uses Stripe checkout session helpers and ticket-inventory utilities that may surface non-helper-related TS errors when the file is read end-to-end; if so, focus only on the apiError/apiSuccess sites this iter and defer the rest.
2. (Alternative) `app/api/v1/tickets/check-in/route.ts` (16 errors).
3. (Next-densest) `app/api/v1/events/route.ts` (14 errors, but has 1 TS2339 `authResult.user_id` that needs cross-check against `ApiAuthResult` shape in `lib/middleware/api-auth.ts`).
4. (Smaller) `app/api/v1/ticket-types/route.ts` (12 errors).
5. (Smallest) 19 TS2551 typos. Mechanical batch, low per-iter density but very low risk.

Cluster math post-iter-13: 101 → 86 v1 errors across remaining dense files (purchase 16 + check-in 16 + events 14 + ticket-types 12 = 58) plus orders/transactions/usage/wallets/features/refund residuals (~28). After iters 14-17, the v1 cluster should be ~0 modulo `ApiAuthResult` field drift surprises.


## 2026-05-24 — iter 14 — Phase 3: v1 tickets/purchase api-response drift cleaned (12 errors)

**Fixed:** `app/api/v1/tickets/purchase/route.ts` had 16 errors at iter-14 entry. Applied the iter-13 caller-alignment recipe to the 12 errors keyed to api-response helper drift: 11 × TS2559 (status as 3rd positional arg on `apiError`), 4 × TS2345 (legacy type names: `permission_denied`/`not_found`/`inventory_error`/`order_error`), 1 × TS2353 (`apiSuccess` headers bag `{ "Idempotent-Replayed": "true" }`), 2 × TS2554 (`apiSuccess(_, {}, 201)` — 3rd positional arg disallowed). Applied canonical-name remap (`"permission_denied"` → `"authorization_error"`, `"not_found"` → `"resource_not_found"`, `"inventory_error"` → `"invalid_request"` (both 400), `"order_error"` → `"invalid_request"` (both 400)); dropped all 3rd-arg status codes; rewrote both `apiSuccess(_, {}, 201)` as `apiSuccess(_, { status: 201 })`; added `{ rateLimit: rateLimitResult }` to the rate-limit-exceeded response. For the `Idempotent-Replayed` header site at line 34, the helper has no equivalent option (legacy code was silently emitting NO header at runtime), so dropped to raw `NextResponse.json(cached, { headers: { "Idempotent-Replayed": "true" } })` — caller-level workaround that preserves developer intent without extending the helper. 12 errors eliminated, zero new errors. tsc count: 295 → 283.

**Why this was needed:** Second of five dense v1 API cluster files. Iter-13 established the recipe in `events/[eventId]/route.ts`; iter-14's job was to apply the recipe to the next-densest file. Knocks the v1 cluster math from 58 → 42 remaining drift errors across 3 unfixed top-density files.

**Investigation:**
- Read full `app/api/v1/tickets/purchase/route.ts` (193 lines) and re-read `lib/middleware/api-response.ts` (116 lines) to confirm helper signatures.
- Cross-checked iter-13 tsc capture against `(17,86):`/`(21,23):`/... — confirmed 16 errors keyed to this file, broken down: 11 × TS2559, 4 × TS2345, 1 × TS2353, 2 × TS2554 (total = 18, but some lines have multiple errors — actual file-line error rows = 16).
- Identified 4 of those 16 errors as NOT api-response drift: Stripe apiVersion drift at line 10 (TS2322), idempotency helper signature drift at lines 32 (TS2345 — different from the api-response TS2345 since this one is `Argument of type 'string' is not assignable to parameter of type 'Request'`) and lines 118, 184 (TS2554 — `storeIdempotentResponse` expects 5 args, got 3). These are different root causes; deferred per "one root cause per iter" discipline.
- Confirmed idempotency helper drift extends to 2 other v1 files: `grep -l "checkIdempotency\|storeIdempotentResponse" app/api/v1` returned `tickets/purchase`, `orders/[orderId]/refund`, `transactions/route.ts`. Same fix applies once the canonical signature is read from `lib/middleware/idempotency.ts`.
- Confirmed Stripe drift extends to 1 other v1 file: `refund/route.ts:9` also has `apiVersion: "2024-12-18.acacia"`. Same iter-11 recipe applies.

**Choices made:**
- **Aligned callers to the helper, did NOT extend the helper with a `headers?` option** despite the `Idempotent-Replayed` site being a use case the helper doesn't cover. Cross-cutting helper changes don't belong in a per-file caller-alignment iter; caller-level workaround (raw `NextResponse.json`) is more surgical. If multiple future callers need arbitrary headers, revisit and extend the helper in a dedicated iter.
- **One file this iter, not multiple.** PROMPT.md: "Be incremental. One bug / one feature per iteration." Even though the iter-13 recipe is now established and could be mechanically applied to the other 3 dense files, holding to per-file iter discipline keeps regressions visible and the diff small. iters 15-17 will work through the remaining files.
- **Did NOT fix the Stripe apiVersion drift at line 10 even though I noticed it.** Same "one root cause per iter" discipline. Iter-11 recipe is documented and ready to apply when this becomes the iter target.
- **Did NOT fix the idempotency helper signature drift even though I noticed it.** Different root cause; needs the canonical signature from `lib/middleware/idempotency.ts` to be read first. Deferred to a future iter (recommended iter 16 after the api-response cluster is done, or fold into iter 15 if reading the helper is cheap and the canonical fix is obvious).
- **Mapped `"inventory_error"` and `"order_error"` to `"invalid_request"` (not `"validation_error"`).** Both legacy types map to 400; `invalid_request` is also 400 (`validation_error` is 422). Same-status canonical name minimizes status-code drift; the user-facing message string carries the real semantic ("Tickets not available", "Failed to create order").
- **Used 8 surgical Edit calls** rather than one Write rewrite. One edit per logical block (imports, auth/scope/rate-limit/idempotency block, body-validation, event-lookup, availability loop, order-create, replace_all on the `apiSuccess(_, {}, 201)` pair, catch-block). Stays isolated, easy to review.
- **Used `replace_all: true` on the duplicate `apiSuccess(response, {}, 201)` string.** Tool reported "All occurrences were successfully replaced" but only one was changed; follow-up surgical Edit closed the second. Lesson learned (see Convention).

**Pre-edit verifications:**
- Read full target file (193 lines).
- Re-read full helper (116 lines).
- Cross-checked iter-13 tsc capture against this file's lines.
- Already had verified helper-usage breadth in iter 13 (12 files, all v1).

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 283 (was 295). Exactly 12 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter13-after.txt ralph-dev/tsc-errors-iter14-after.txt` → 12 lines deleted, 0 added. Surgical.
- `grep "tickets/purchase/route.ts" ralph-dev/tsc-errors-iter14-after.txt` → 4 remaining errors, all from different root causes (Stripe drift + idempotency drift). API-response drift portion is fully clean.

**Out of scope deliberately:**
- The Stripe `apiVersion` drift at line 10. iter-11 recipe applies — `import { stripe } from "@/lib/stripe"`. Defer to a Stripe-drift sweep iter that handles both `purchase` and `refund`.
- The idempotency helper signature drift (3 errors in this file, plus errors in 2 other v1 files). Different root cause; needs the canonical signature from `lib/middleware/idempotency.ts`.
- The 3 other dense v1 cluster files (`tickets/check-in`, `events/route.ts`, `ticket-types/route.ts`). Same recipe — iters 15+.
- The 19 TS2551 typos. Mechanical batch.
- Extending `apiSuccess` with a `headers?` option. Caller-level workaround was sufficient for the one Idempotent-Replayed site.

**Acceptance flipped:** None. ACCEPTANCE Phase 3 aggregate boxes; 283 errors still to go.

**Learned:**
- **iter 14 convention — surface ALL errors keyed to the target file, not just the recipe-matched ones, at iter entry.** A file may have errors from multiple root causes; the recipe-application iter should close ONLY the recipe-matched ones and explicitly defer the rest. Don't conflate fixes from different root causes into one iter just because they're in the same file — that breaks the "one root cause per iter" discipline. Tag the file as "[recipe name] drift cleaned" — not as "fully clean" — when only the recipe-targeted errors are closed.
- **iter 14 convention — when a canonical helper has NO equivalent option for a legacy use case, prefer a caller-level workaround (raw API like `NextResponse.json`) over extending the helper.** Extending the helper is cross-cutting and adds API surface for limited gain. Caller-level workarounds keep the helper minimal and confine the change to the affected file. Only extend the helper if multiple distinct callers need the same legacy use case — wait for that signal before generalizing.
- **iter 14 tool-handling note — `Edit` with `replace_all: true` on multi-occurrence strings is NOT 100% reliable.** Tool reported success but only fixed one of two occurrences. Mitigated by follow-up surgical Edit. Convention: always verify post-Edit with the same grep/tsc that catches the original error. Never trust the replace_all report blindly.
- **iter 14 finding — iter-11's "TRIAGE §2c complete" claim was premature.** iter-11 fixed 3 known files but missed at least 2 more drift sites (`tickets/purchase`, `orders/[orderId]/refund`). The TRIAGE list was incomplete. Action: re-grep `apiVersion: "2024-12-18.acacia"` repo-wide before claiming any cross-cutting drift is fully resolved. Lesson: "fixed the files I knew about" ≠ "drift fully closed." Generalize: TRIAGE-driven cleanup needs a final cross-check grep before flipping the TRIAGE box.

**Next:** Iter 15 — apply the iter-13/14 recipe to the next densest v1 cluster file. Pre-iter housekeeping recommended:
1. **Read `lib/middleware/idempotency.ts`** to learn the canonical signatures of `checkIdempotency` and `storeIdempotentResponse`. That preps idempotency-drift fixes for purchase + refund + transactions (3 callers).
2. **Re-grep `apiVersion: "2024-12-18.acacia"` repo-wide** to find any remaining Stripe drift before claiming TRIAGE §2c closed.
3. **Recommended iter-15 target:** `app/api/v1/tickets/check-in/route.ts` (~16 errors at iter-1 baseline). Same api-response drift recipe. Verify error count with `grep "tickets/check-in/route.ts" ralph-dev/tsc-errors-iter14-after.txt | wc -l`.
4. **Alternative iter-15 target:** `app/api/v1/orders/[orderId]/refund/route.ts` (~14 errors confirmed at iter 14). Same recipe + Stripe drift + idempotency drift — would be a multi-root-cause iter, mildly violating "one root cause per iter" but could be justified if the idempotency helper canonical signature has been pre-read.


## 2026-05-24 — iter 15 — Phase 3: v1 tickets/check-in api-response drift cleaned (13 errors)

**Fixed:** `app/api/v1/tickets/check-in/route.ts` had 16 errors at iter-15 entry. Applied the iter-13/14 caller-alignment recipe to the 13 errors keyed to api-response helper drift: 8 × TS2559 (status as 3rd positional arg on `apiError`, lines 11/20/29/76/85/98/102/127), 4 × TS2345 (legacy type names: `permission_denied` ×2, `database_error` ×2), 1 × TS2554 at line 61 (`apiError("check_in_failed", msg, 400, {}, { checked_in_at })` — 5 args, helper expects 2-3). Applied canonical-name remap (`"permission_denied"` → `"authorization_error"`, `"database_error"` → `"internal_error"` (both 500), `"check_in_failed"` → `"invalid_request"` (both 400, with `code` preserved on the response body)); dropped all 8 redundant 3rd-arg status codes; added `{ rateLimit: rateLimitResult }` to the rate-limit-exceeded response (correctness improvement matching iters 13/14). For the line 61 metadata-bag site (`{ checked_in_at }`) — which the helper has no slot for — dropped to raw `NextResponse.json` with the canonical error shape extended by `code: "check_in_failed"` AND `checked_in_at: result?.checked_in_at`. This matches the iter-14 helper-fallback pattern AND is a real runtime bug fix: the legacy call was returning HTTP 200 (no `STATUS_CODES["check_in_failed"]` entry, status defaulted to undefined → 200) with neither `code` nor `checked_in_at` in the body (4th/5th args silently dropped by `apiError`). 13 errors eliminated, zero new errors. tsc count: 283 → 270.

**Why this was needed:** Third of five dense v1 API cluster files. Iter-13 established the recipe in `events/[eventId]/route.ts`; iter-14 applied to `tickets/purchase`; iter-15 applies to `tickets/check-in`. Knocks the v1 cluster math from 42 → ~29 remaining drift errors across 2 unfixed top-density files (events, ticket-types).

**Investigation:**
- Read full `app/api/v1/tickets/check-in/route.ts` (130 lines).
- Re-read full `lib/middleware/api-response.ts` (116 lines) to confirm helper signatures.
- Read `lib/middleware/api-auth.ts` (87 lines) — confirmed `ApiAuthResult` has fields `{ valid, tenant_id, api_key_id, environment, scopes, error }` and NO `user_id`. This means the 3 × TS2339 errors at lines 38/50/109 (which became 38/50/117 post-fix due to line shift) are a real shape drift, not just type-confusion. The legacy callers reference a field that never existed on `ApiAuthResult`.
- Pre-flight read `lib/middleware/idempotency.ts` (112 lines) per iter-14's "What's next" recommendation. Canonical signatures: `checkIdempotency(req: Request, tenantId: string): Promise<IdempotencyResult>` (2 args), `storeIdempotency(req, tenantId, apiKeyId, response, durationMs)` (5 args, exported as `storeIdempotency` and re-exported as `storeIdempotentResponse` for back-compat). This preps iter 16+ for `purchase`, `refund`, `transactions` — but `check-in/route.ts` uses neither helper, so the pre-flight didn't apply to this file.
- Cross-checked iter-14 tsc capture against this file's lines. 16 errors total: 8 × TS2559, 4 × TS2345, 1 × TS2554, 3 × TS2339.
- Confirmed `check-in/route.ts` does NOT have Stripe drift (`grep "apiVersion" app/api/v1/tickets/check-in/route.ts` → empty) and does NOT use idempotency helpers. The only out-of-scope errors in this file are the 3 TS2339 user_id sites.

**Choices made:**
- **Aligned callers to the helper, did NOT extend the helper with a `metadata?` or `extras?` option.** The single `check_in_failed` metadata-bag use case (line 61) was solvable at the caller level with raw `NextResponse.json`. Matches iter-14's `Idempotent-Replayed` fallback discipline. If multiple future callers need arbitrary error-body metadata, revisit and extend the helper in a dedicated iter.
- **Mapped `"check_in_failed"` to `"invalid_request"` (400) with `code: "check_in_failed"` preserved.** Same-status canonical name + semantic preservation via the `code` field. API consumers can still distinguish `check_in_failed` from other `invalid_request` types via the `code` field.
- **Did NOT fix the 3 × TS2339 `authResult.user_id` errors.** Different root cause (auth shape drift). And — key insight — there's a SIBLING site in `events/route.ts:158` with the same drift. Batching all 4 sites into a single iter-16 sweep is more coherent than fixing 3 here + 1 in another iter. Sweep-by-root-cause across files, when the fix is the same.
- **Did NOT pre-emptively fix anything else in this file.** No Stripe drift, no idempotency drift, no other root causes present. Clean scope.
- **Used 4 surgical Edit calls** rather than one Write rewrite. One edit per logical block (imports + POST header, both `database_error` sites + line-61 rewrite, POST catch + PUT header, PUT catch). Stays isolated, easy to review.

**Pre-edit verifications:**
- Read full target file (130 lines), full helper (116 lines), full auth helper (87 lines), full idempotency helper (112 lines).
- Cross-checked iter-14 tsc capture against this file's lines (16 errors confirmed).
- Already had verified helper-usage breadth in iter 13 (12 files, all v1).

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 270 (was 283). Exactly 13 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter14-after.txt ralph-dev/tsc-errors-iter15-after.txt` → 14 lines deleted, 1 added. The 1 added is just the `user_id` TS2339 at line 109 shifting to line 117 (raw `NextResponse.json` block added 8 lines). Net: 13 distinct errors eliminated.
- `grep "tickets/check-in/route.ts" ralph-dev/tsc-errors-iter15-after.txt` → 3 remaining errors at lines 38/50/117, all TS2339 `user_id` shape drift. API-response drift portion is fully clean.

**Out of scope deliberately:**
- The 3 × TS2339 `authResult.user_id` errors. Batched with the 1 sibling in `events/route.ts:158` for an iter-16 sweep.
- The 2 other dense v1 cluster files (`events/route.ts`, `ticket-types/route.ts`). Same recipe — iters 17+.
- The unfinished `purchase/route.ts` and `refund/route.ts` work (Stripe + idempotency drift). Iters 16+.
- The 19 TS2551 typos. Mechanical batch.
- Extending the helper to support error-body metadata. Caller-level workaround was sufficient.

**Acceptance flipped:** None. ACCEPTANCE Phase 3 aggregate boxes; 270 errors still to go.

**Learned:**
- **iter 15 convention — cross-file root-cause sweep.** When a recipe-application iter surfaces out-of-scope errors with the same root cause as errors in OTHER files (here: `ApiAuthResult.user_id` in `check-in/route.ts` AND `events/route.ts`), tag it as a "sweep candidate" in the next-iter recommendations. Cross-file root causes deserve a single coherent fix iter rather than being closed file-by-file. Batch by root cause across files when the fix is the same.
- **iter 15 convention — helper-fallback enrichment.** When the iter-14 raw `NextResponse.json` fallback is applied, take the opportunity to enrich the response with legacy developer-intent data that the helper was silently dropping. Type fixes can be runtime bug fixes in disguise (here: `check_in_failed` was being served as HTTP 200 with no metadata; rewrite restored 400 status AND the metadata). Surface in the iter writeup so FIXES_APPLIED.md eventually catches it.
- **iter 15 convention — do pre-flight reads even if the current target file doesn't use them.** STATE.md "What's next" recommended reading `lib/middleware/idempotency.ts` even though `check-in/route.ts` doesn't use idempotency. Doing the read anyway preps iter 16+ for `purchase`, `refund`, `transactions` (3 callers known to have idempotency drift). Pre-flight reads are cheap and the canonical signatures don't change file-to-file. Cache the signatures in the iter writeup so the next iter can apply them without re-reading.

**Next:** Iter 16 — strongly recommended: `ApiAuthResult.user_id` shape drift sweep (4 errors across 2 files in one iter). Pre-flight: read `validate_api_key` RPC source (`grep -rn "validate_api_key" scripts/` or check Supabase) to determine whether the right fix is "remove `.user_id` from callers" (use `api_key_id` or `null`) or "add `user_id?: string` to `ApiAuthResult` interface." This is a one-and-done cross-file fix that closes a whole root cause class. Alternative: continue v1 cluster cleanup with `events/route.ts` (~14 errors) using the iter-13/14/15 recipe.


## 2026-05-24 — iter 16 — Phase 3: `ApiAuthResult.user_id` cross-file sweep (4 errors, 2 files)

**Fixed:** 4 TS2339 errors keyed to the missing `user_id` field on `ApiAuthResult`:
- `app/api/v1/tickets/check-in/route.ts:38` (`p_performed_by: performed_by || authResult.user_id`)
- `app/api/v1/tickets/check-in/route.ts:50` (same shape)
- `app/api/v1/tickets/check-in/route.ts:117` (PUT bulk, same shape)
- `app/api/v1/events/route.ts:158` (`created_by: authResult.user_id || authResult.tenant_id`)

Two surgical edits to `lib/middleware/api-auth.ts`:
1. Added `user_id?: string` to the `ApiAuthResult` interface (lines 3-10).
2. Added `user_id: data.user_id` to the success-branch return (lines 72-78).

Zero caller changes. Zero changes to the 4 error-branch returns (optional field, so `valid: false` paths unaffected). 4 errors eliminated, zero new errors. tsc count: 270 → 266. Most surgical iter so far (4 lines deleted, 0 added in the tsc-errors diff).

**Why this was needed:** Cross-file root-cause sweep identified at iter 15. The `validateApiKey` validator function constructed a success-return object that dropped any `user_id` the RPC might return, even though 4 caller sites (3 in `tickets/check-in/route.ts`, 1 in `events/route.ts`) reference it. The developer comment `// Use tenant owner if no user` at `events/route.ts:158` makes the optional-field intent explicit.

**Investigation:**
- Read `lib/middleware/api-auth.ts` (87 lines): interface defined fields `{ valid, tenant_id, api_key_id, environment, scopes, error }` — no `user_id`. Validator success branch (lines 72-78) returns 5 fields, dropping any `user_id` from `data`.
- `grep -rn "validate_api_key" scripts/` → empty. RPC source is in Supabase, not the repo. So we can't directly confirm whether the RPC returns `user_id`.
- `grep -n "authResult\.user_id" .` → exactly 4 caller sites, all v1 routes. No non-v1 consumers, no `lib/` consumers.
- Read `app/api/v1/events/route.ts:140-175` for context — confirmed the developer comment and the optional-field intent.
- Read `app/api/v1/tickets/check-in/route.ts` post-iter-15 (130 lines) — confirmed all 3 sites have `|| fallback` patterns, so runtime `undefined` is gracefully handled.

**Choices made:**
- **Chose Option B (extend the type) over Option A (remove from callers).** Reasons:
  1. The developer comment at `events/route.ts:158` ("Use tenant owner if no user") makes `user_id` an explicit optional concept — a user-bound API key vs a tenant-bound API key. Removing the field would erase that distinction.
  2. All 4 caller sites already have `||` fallbacks. Runtime `undefined` is handled gracefully — no regression.
  3. If the RPC IS returning `user_id`, this fix restores a feature the legacy validator was silently dropping. The fix is a no-op in the "RPC doesn't return it" branch and a bug-fix in the "RPC does return it" branch.
- **Made `user_id` optional, not required.** All 4 error-branch returns (`valid: false`) have no user_id available. Making it optional means they don't need to change.
- **Did NOT modify any caller.** Two-line type fix in the helper file is enough. The 4 caller sites compile correctly with no further changes.
- **Did NOT verify the RPC source.** `grep -rn "validate_api_key" scripts/` returned no results; the RPC source is in Supabase. The fix is correct regardless of whether the RPC returns user_id (see "Choices made" #1-2 above).

**Pre-edit verifications:**
- Read full `lib/middleware/api-auth.ts` (87 lines).
- Read `app/api/v1/tickets/check-in/route.ts:38, 50, 117`.
- Read `app/api/v1/events/route.ts:140-175` for context around line 158.
- `grep -n "authResult\.user_id"` repo-wide → confirmed exactly 4 caller sites, no other consumers.
- `grep -rn "validate_api_key" scripts/` → empty (RPC source not in repo).

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 266 (was 270). Exactly 4 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter15-after.txt ralph-dev/tsc-errors-iter16-after.txt` → 4 lines deleted, 0 added.
- `grep "tickets/check-in/route.ts" ralph-dev/tsc-errors-iter16-after.txt` → empty. File is fully clean.
- `grep "TS2339" ralph-dev/tsc-errors-iter16-after.txt | grep -E "(check-in|events/route)"` → empty. All 4 sites closed.
- `grep "api-auth\.ts" ralph-dev/tsc-errors-iter16-after.txt` → empty. The helper edit didn't introduce any new errors.
- Verified 14 other `validateApiKey` callers (`tickets/purchase`, `events/[eventId]`, `events/route`, `features`, `orders/[orderId]/refund`, `orders/route`, `organization/members`, `ticket-types`, `tickets/route`, `transactions`, `usage`, `wallets`) — none affected, since `user_id?` is optional.

**Out of scope deliberately:**
- The remaining ~13 errors in `events/route.ts` (api-response drift). iter-17 target.
- The 4 errors in `purchase/route.ts` (Stripe drift + idempotency drift). Iters 17+.
- The 19 TS2551 typos. Mechanical batch.
- Validator-level changes beyond threading `user_id` through.

**Acceptance flipped:** None directly. `app/api/v1/tickets/check-in/route.ts` is now fully clean (zero remaining errors). Phase 3 aggregate boxes; 266 errors still to go.

**Learned:**
- **iter 16 convention — extend-the-type vs remove-the-field.** When a developer-intent comment in code reveals optional-field semantics (here: `// Use tenant owner if no user`), prefer extending the type over removing the field from callers. The comment is a load-bearing signal that the developer DESIGNED for the field to be optional; erasing the field by substituting a sibling (e.g., `api_key_id`) breaks that design at no benefit.
- **iter 16 convention — correct-under-both-unknowns.** When the source-of-truth (RPC source, external schema) is unavailable, design the fix to be correct under both branches of the unknown. The RPC may or may not return `user_id`; the fix (optional field + thread `data.user_id` through) is a no-op if absent, a bug-fix if present. Never strictly wrong. This is the discipline for working under partial visibility: don't bet on the unknown; make the fix robust to either resolution.
- **iter 16 convention — 2-line cross-file sweep.** Cross-file type-level sweeps can be 2-line fixes. When the root cause is a missing interface field, the fix lives entirely in the type definition. Don't touch any caller; the type-checker propagates the fix to every reference. Highest-leverage fix pattern available so far: 1 file edited, 4 errors closed, 14 callers unaffected.

**Next:** Iter 17 — recommended target `app/api/v1/events/route.ts` (~13 errors at iter-16 post-fix). Same iter-13/14/15 api-response drift recipe. Alternative: bundled Stripe-drift + idempotency-drift sweep across `purchase/route.ts` + `refund/route.ts` + `transactions/route.ts` (3 files, 1 root cause for each drift type). Pre-flight: re-grep `apiVersion: "2024-12-18.acacia"` repo-wide; refresh tally with `grep -oP "error TS\d+" ralph-dev/tsc-errors-iter16-after.txt | sort | uniq -c | sort -rn`.


## 2026-05-24 — iter 17 — Phase 3: `app/api/v1/events/route.ts` api-response drift (13 errors)

**Fixed:** 13 errors keyed to `app/api/v1/events/route.ts` — fourth of five dense v1 cluster files, now fully clean. Recipe from iters 13/14/15:
- 7 × TS2559 (status as 3rd positional arg on `apiError`): dropped all 3rd args.
- 3 × TS2345 (legacy type names): `"database_error"` ×2 → `"internal_error"`; `"permission_denied"` → `"authorization_error"`; `"duplicate_error"` → `"idempotency_error"` (with `{ code: "duplicate_slug" }` preserving semantic).
- 2 × TS2554 (wrong arg count): L18 4-arg `apiError` with manual headers bag → `{ rateLimit: rateLimitResult }`; L170 `apiSuccess(_, {}, 201)` → `apiSuccess(_, { status: 201 })`.
- 1 × TS2353 (object literal property): L77 `apiSuccess` headers bag → `{ rateLimit: rateLimitResult }`.

Five surgical Edits to `app/api/v1/events/route.ts` (one per logical block). tsc count: 266 → 253. Diff vs iter16-after: 13 lines deleted, 0 added — cleanest diff of the recipe iters.

**Two correctness improvements smuggled in under type fixes:** L18 (GET rate-limit-exceeded), L77 (GET success), L99 (POST rate-limit-exceeded). The legacy code was passing manual `X-RateLimit-*` headers as positional args / option keys that the helper's destructure silently ignored at runtime. The rewrite to `{ rateLimit: rateLimitResult }` restores actual header emission via `addRateLimitHeaders`. Rate-limit-aware clients (using `Retry-After`, `X-RateLimit-Remaining`) will now actually receive those headers in practice.

**Why this was needed:** Fourth and second-to-last application of the iter-13/14/15 v1 api-response caller-alignment recipe. Same root cause as the prior iters: callers drifted from the canonical `apiError`/`apiSuccess` helper signatures over time. With this iter, only `ticket-types/route.ts` remains of the dense v1 cluster files.

**Investigation:**
- `grep -c "app/api/v1/events/route.ts" ralph-dev/tsc-errors-iter16-after.txt` → 13 (matched iter-15 prediction).
- `grep "app/api/v1/events/route.ts" ralph-dev/tsc-errors-iter16-after.txt` → enumerated all 13 errors with codes (TS2559/TS2345/TS2554/TS2353) and lines.
- `grep -rn 'apiVersion: "2024-12-18.acacia"' .` → 2 callers (purchase, refund) — confirms iter-18's Stripe-drift sweep target.
- Read full `app/api/v1/events/route.ts` (175 lines) post-iter-16.
- Re-read full `lib/middleware/api-response.ts` (116 lines) — confirmed `ApiErrorType` membership: `idempotency_error` is in (maps to 409); `duplicate_error`, `database_error`, `permission_denied` are NOT.
- Confirmed no Stripe drift and no idempotency-helper drift in this file (greps for `apiVersion` and `checkIdempotency`/`storeIdempotency` returned empty).

**Choices made:**
- **`"duplicate_error"` → `"idempotency_error"` over `"validation_error"`.** Both are canonical names; only `idempotency_error` matches the legacy 409 status. `validation_error` is 422, which is meaningfully different (HTTP 422 is "request shape OK but semantically invalid"; 409 is "resource state conflict"). Preserved the legacy 409 deliberately.
- **Preserved `duplicate_error` semantic via `{ code: "duplicate_slug" }`.** Matches iter-15's `code: "check_in_failed"` pattern. The `type` becomes the canonical category; the `code` is the application-specific subtype. Consumers can branch on `error.code === "duplicate_slug"`.
- **Used 5 Edit calls** rather than one Write rewrite. Per iter-14 convention. Avoids the iter-14 `replace_all` reliability issue.
- **Did NOT modify line 158** (`created_by: authResult.user_id || authResult.tenant_id`). Closed at iter 16; not in the tsc errors list.

**Pre-edit verifications:**
- Read full `app/api/v1/events/route.ts` (175 lines).
- Re-read full `lib/middleware/api-response.ts` (116 lines).
- Cross-checked iter-16 tsc capture: all 13 errors in scope, no out-of-scope errors in this file.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 253 (was 266). Exactly 13 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter16-after.txt ralph-dev/tsc-errors-iter17-after.txt` → 13 lines deleted, 0 added. Cleanest diff of all recipe iters.
- `grep "app/api/v1/events/route.ts" ralph-dev/tsc-errors-iter17-after.txt` → empty. File is fully clean.

**Out of scope deliberately:**
- The Stripe `apiVersion` drift in `purchase/route.ts:10` and `orders/[orderId]/refund/route.ts:9`. Iter-18 target (small 2-error sweep — closes TRIAGE §2c).
- The idempotency helper drift in `purchase/route.ts`, `refund/route.ts`, `transactions/route.ts`. Iter-19 target.
- `ticket-types/route.ts` api-response drift (~12 errors). Iter-20 target — last of the dense v1 cluster.
- The 19 TS2551 typos. Mechanical batch.

**Acceptance flipped:** None directly. `app/api/v1/events/route.ts` is now fully clean. Phase 3 aggregate boxes; 253 errors still to go.

**Learned:**
- **iter 17 convention — type-fix is behavior-fix when manual headers are silently dropped.** When the legacy code passes manual header keys (`X-RateLimit-*`) into `apiError`/`apiSuccess` options shapes that don't accept arbitrary headers, TS errors AND the runtime silently dropped the headers. The rewrite to `{ rateLimit: rateLimitResult }` restores `addRateLimitHeaders`-driven emission. Surface in FIXES_APPLIED.md as a behavior-fix.
- **iter 17 convention — canonical-type remap with `code` preservation generalized.** When the legacy name has no exact canonical equivalent but matches a status (here: `duplicate_error` → `idempotency_error`, both 409), use the closest-status canonical type and carry the precise legacy semantic in the `code` field. Generalization of iter-15's pattern. Status preservation > semantic-name preservation; `code` bridges the gap.
- **iter 17 convention — recipe maturity.** Same-file recipe applications get cleaner across iters. Iter 17 had ZERO file-specific surprises — every error mapped to a known recipe element. The "v1 api-response drift" recipe is now well-tested over 4 successful applications (iters 13/14/15/17). Iter 18+ should be even faster.

**Next:** Iter 18 — strongly recommended: Stripe drift sweep across 2 files (`purchase/route.ts:10`, `orders/[orderId]/refund/route.ts:9`). 2 errors, 1 root cause, finally closes TRIAGE §2c. Apply iter-11 recipe (`import { stripe } from "@/lib/stripe"`). Pre-flight: re-grep `apiVersion: "2024-12-18.acacia"` to catch any newly-surfaced sites. Alternative: idempotency helper sweep across 3 files (iter-15 pre-flight cached the canonical signatures). Alternative: continue dense v1 cluster with `ticket-types/route.ts` (~12 errors).


## 2026-05-24 — iter 18 — Phase 3: Stripe apiVersion drift sweep (2 errors, closes TRIAGE §2c)

**Fixed:** 2 errors keyed to `app/api/v1/tickets/purchase/route.ts:10` and `app/api/v1/orders/[orderId]/refund/route.ts:9` — both `TS2322: Type '"2024-12-18.acacia"' is not assignable to type '"2025-02-24.acacia"'`. Applied iter-11 recipe: replaced the local `new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" })` instantiation in each file with `import { stripe } from "@/lib/stripe"` (the canonical singleton from `lib/stripe.ts`, which uses no apiVersion override and lets the SDK pick its bundled default).

Two surgical 6-line-deletion Edits (5 lines of code + 1 blank line each). tsc count: 253 → 251. Repo-wide grep `apiVersion: "2024-12-18.acacia"` post-fix → empty. TRIAGE §2c fully closed. Total 5 callers now use the singleton (3 pre-iter-11 + 2 added iter 18).

**Why this was needed:** iter-11 claimed TRIAGE §2c "complete" but only covered 3 files. iter 14 surfaced 2 more files in the `app/api/v1/` cluster that had identical drift — they were missed by the iter-11 grep. The iter-18 pre-flight grep confirmed exactly 2 sites remained; the iter-18 fix closes them.

**Investigation:**
- `grep -rn 'apiVersion: "2024-12-18.acacia"' --include="*.ts" --include="*.tsx" .` → 2 sites (refund:9, purchase:10).
- `grep -rn "new Stripe(" --include="*.ts" --include="*.tsx" .` → 6 non-test sites total: 4 in non-v1 routes that DO NOT have the drift (`withdraw`, `reconciliation`, `kyc/create-session`, `kyc/refresh-status`), plus the 2 v1 sites. Confirms the iter-11 scope was incomplete but no other files exist.
- `grep -n "Stripe\." app/api/v1/tickets/purchase/route.ts app/api/v1/orders/\[orderId\]/refund/route.ts` → empty. The `Stripe` type import is dead in both files.
- `grep -n "stripe\." app/api/v1/tickets/purchase/route.ts app/api/v1/orders/\[orderId\]/refund/route.ts` → one call site per file (`stripe.checkout.sessions.create` in purchase L127, `stripe.refunds.create` in refund L67).
- Read `lib/stripe.ts` (5 lines): `export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)`. No apiVersion override — matches iter-11 recipe expectation.

**Choices made:**
- **Removed the `Stripe` type import in both files** because zero `Stripe.` namespace refs exist. The type import would be dead code; keeping it violates the iter-9 "delete unused imports" pattern.
- **Single Edit per file** rather than separate import-removal and instantiation-removal Edits. The 5-line block (import + 4-line const) is logically one unit.
- **Preserved the variable name `stripe`** between source and replacement — zero call-site changes needed.
- **Did NOT touch any non-v1 caller** (`withdraw`, `reconciliation`, `kyc/*`). Out of scope for §2c (those callers don't have the apiVersion drift).

**Pre-edit verifications:** baseline tsc count 253; both target files read in full; `lib/stripe.ts` confirmed.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 251 (was 253). Exactly 2 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter17-after.txt ralph-dev/tsc-errors-iter18-after.txt` → 12 lines deleted, 10 lines added. The 12 deleted include the 2 TS2322 fixes PLUS 10 line-shift artifacts. The 10 added are the shifted errors at new line numbers. Net: 2 distinct errors eliminated, zero shift in any error TYPE.
- `grep -rn 'apiVersion: "2024-12-18.acacia"' .` → empty. TRIAGE §2c fully closed.
- `grep "purchase/route.ts" ralph-dev/tsc-errors-iter18-after.txt | wc -l` → 3 (down from 4).
- `grep "refund/route.ts" ralph-dev/tsc-errors-iter18-after.txt | wc -l` → 11 (down from 12).

**Out of scope deliberately:**
- The 4 non-v1 `new Stripe(...)` callers (no apiVersion drift). Future "stripe singleton consistency" iter could migrate these but it's not a §2c bug.
- The 3 remaining errors in `purchase/route.ts` (idempotency drift). iter-19 target.
- The 11 remaining errors in `refund/route.ts` (api-response drift + idempotency drift). iter-19 + iter-20 targets.

**Acceptance flipped:** None directly. TRIAGE §2c is fully closed but ACCEPTANCE.md doesn't have a per-§ Phase 1 box for it (all Phase 1 boxes already `[x]`). Phase 3 aggregate boxes; 251 errors still to go.

**Learned:**
- **iter 18 convention — TRIAGE-list completeness verification.** When a multi-pass triage finds N files and a later iter surfaces N+K, do the cross-file grep AGAIN before claiming closure on the next pass. The grep is cheap; the false-closure claim is expensive (drift errors can linger forever). iter 11 claimed §2c done with 3 files; iter 14 found 2 more; iter 18 re-grepped to confirm only 2 more, closed them, then re-grepped post-fix to confirm zero remaining. Generalization: re-grep before declaring closure, every time.
- **iter 18 convention — minimum-diff cross-file sweep template.** For "same fix in N files" sweeps, the smallest correct unit of work is 1 Edit per file, each replacing exactly the legacy block with exactly the canonical replacement. No collateral edits. iter 18: 2 Edits, 2 errors closed, 12-line net diff, zero new errors.
- **iter 18 convention — name-preserving canonical-singleton swaps.** When swapping `const stripe = new Stripe(...)` for `import { stripe }`, the variable name `stripe` is preserved. Zero call-site changes needed. Name-preservation is a load-bearing criterion when designing exports for canonical singletons.

**Next:** Iter 19 — strongly recommended: idempotency helper drift sweep across 3 files (`purchase`, `refund`, `transactions`). Pre-flight: re-read `lib/middleware/idempotency.ts` to verify which exported name (`storeIdempotency` per iter-15 cache, OR `storeIdempotentResponse` per callers) is canonical. 1 root cause, 3 files, ~7 errors total. After that: `ticket-types/route.ts` (~12 errors, iter-13/14/15/17 recipe), then TS2339 hotspot exploration.


## 2026-05-24 — iter 19 — Phase 3: Idempotency helper drift sweep (6 errors, fully closes drift across 3 callers)

**Fixed:** 6 errors total — 5 idempotency drift + 1 coupled api-response TS2353 — across `app/api/v1/tickets/purchase/route.ts` (3 errors) and `app/api/v1/orders/[orderId]/refund/route.ts` (3 errors). Third caller (`transactions/route.ts`) was already canonical and used as the gold-standard reference pattern.

Aligned both files to the canonical helper signatures: `checkIdempotency(req, tenantId)` with `cached.found && cached.response` guard and `cached.response.body`/`cached.response.status` consumption, AND `storeIdempotency/storeIdempotentResponse(req, tenantId, apiKeyId, {status, body}, durationMs)`. Added `const startTime = Date.now()` at top of each POST to feed the 5-arg store call. Refund needed `NextResponse` added to its imports (was `import { NextRequest }` only) for the raw `NextResponse.json` fallback on the `Idempotent-Replayed` header response — that fallback simultaneously closed the L28 TS2353 (api-response drift coupled with idempotency drift via the `cached` type change). tsc count: 251 → 245. `purchase/route.ts` now fully clean; `transactions/route.ts` still clean.

**Why this was needed:** purchase + refund had drifted to a non-existent 2-arg `checkIdempotency(tenantId, key)` signature and a 3-arg `storeIdempotentResponse(tenantId, key, response)` shape. The TS errors (TS2345 + TS2554) had been blocking these routes from type-checking. At runtime the calls would have failed (wrong-shape supabase queries; missing required args). transactions/route.ts had been correctly written from the start — strong evidence the helper signature wasn't drifted, just two callers were copy-pasted from an earlier helper revision.

**Investigation:**
- Read full `lib/middleware/idempotency.ts` (112 lines). Confirmed: `IdempotencyResult` shape `{found: boolean, response?: {status, body}}`. Both `storeIdempotency` (canonical) AND `storeIdempotentResponse` (alias re-export, line 86) exist — iter-15's cache had erroneously suggested one was wrong. Verified canonical signatures: `checkIdempotency(req: Request, tenantId: string)`, `storeIdempotency(req, tenantId, apiKeyId, response, durationMs)`.
- Read full `app/api/v1/transactions/route.ts` (175 lines). Confirmed it's already canonical (L116-118 for check, L165 for store, L8 for startTime). Used as the template for purchase + refund.
- Re-read `lib/middleware/api-response.ts` (116 lines). Confirmed `apiSuccess` has no `headers` option — the L28 refund coupled fix needs raw `NextResponse.json` fallback.
- Grep `checkIdempotency\|storeIdempotency\|storeIdempotentResponse` repo-wide → exactly 3 caller files. No hidden callers.

**Choices made:**
- **Used `storeIdempotentResponse` (the alias) in purchase and refund** rather than renaming to `storeIdempotency` (the canonical). The alias is documented as backwards-compat (helper comment line 84); renaming is churn.
- **Did NOT touch `transactions/route.ts`** — already canonical.
- **Inlined `startTime` inside each `try`** rather than before. Matches the intent: only needed for the store call, which is inside the try.
- **Used raw `NextResponse.json` for the `Idempotent-Replayed` cached-response path in BOTH files** rather than extending `apiSuccess` with a `headers?` option. Matches iter-14 helper-fallback convention.
- **Used `cached.response.body` (not `cached.response`)** in the raw return. The `body` field is the actual stored data; returning `cached.response` would double-wrap.
- **Used `cached.response.status`** for the response status. Preserves the original status code of the cached response (e.g., a 201 free-order replays as 201). Type fix + behavior fix combined.
- **Did NOT fix the 8 remaining api-response drift errors in `refund/route.ts`** — different root cause (iter-20 target).

**Pre-edit verifications:** baseline tsc count 251; all 4 relevant files read in full; repo-wide grep confirmed 3 callers + 1 helper.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 245 (was 251). Exactly 6 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter18-after.txt ralph-dev/tsc-errors-iter19-after.txt` → 8 added lines = the 8 surviving refund errors with shifted line numbers (+4 from `NextResponse` import and `startTime` additions). Same errors, new line numbers. Zero NEW errors.
- `grep "purchase/route.ts" ralph-dev/tsc-errors-iter19-after.txt` → empty. **Purchase fully clean.**
- `grep "transactions/route.ts" ralph-dev/tsc-errors-iter19-after.txt` → empty. **Still clean.**
- `grep "refund/route.ts" ralph-dev/tsc-errors-iter19-after.txt | wc -l` → 8 (down from 11; the 3 closed = 2 idempotency + 1 coupled TS2353).
- Repo-wide grep `checkIdempotency\|storeIdempotency\|storeIdempotentResponse` post-fix → all 3 callers now canonical.

**Out of scope deliberately:**
- The 8 api-response drift errors in `refund/route.ts`. iter-20 target.
- `ticket-types/route.ts` api-response drift (~12 errors expected). iter-21 target.
- The 19 TS2551 typos. Mechanical batch, iter 22+.
- Consolidating `storeIdempotentResponse` → `storeIdempotency`. Cosmetic, not a bug.

**Acceptance flipped:** None directly. `purchase/route.ts` fully clean; idempotency drift fully closed. Phase 3 aggregate boxes; 245 errors still to go.

**Learned:**
- **iter 19 convention — verify cached pre-flight findings against the source of truth.** Caching is for context, not correctness. iter-15's cache had errors that re-reading the helper at iter 19 entry corrected. Cheap to re-verify, expensive to act on stale info.
- **iter 19 convention — coupled fixes that collapse naturally are still in scope.** The L28 TS2353 in refund was technically api-response drift, but the natural fix for L26 (idempotency) forced the L28 rewrite that closes the TS2353 as a side-effect. Don't split coupled fixes artificially.
- **iter 19 convention — in-repo reference patterns as gold standard.** `transactions/route.ts` showed the canonical idempotency integration; aligning purchase + refund to that reference was faster + safer than designing from the helper signature alone.
- **iter 19 convention — preserve cached-response status code in idempotency replays.** Using `cached.response.status` preserves the original status (e.g., 201 free-order replays as 201). Type fix + behavior fix combined.

**Next:** Iter 20 — strongly recommended: `refund/route.ts` api-response drift sweep (8 errors, iter-13/14/15/17 recipe). Should close the file fully. Then iter 21: `ticket-types/route.ts` (~12 errors, same recipe — last of the dense v1 cluster). Then iter 22+: TS2339 hotspot analysis or TS2551 batch.


## 2026-05-24 — iter 20 — Phase 3: refund/route.ts api-response drift sweep (8 errors, file fully clean)

**Fixed:** 8 api-response drift errors in `app/api/v1/orders/[orderId]/refund/route.ts` — 4 × TS2559 (status-as-3rd-arg: L17 401, L54 400, L61 400, L109 500) and 4 × TS2345 (legacy type names: L21 `permission_denied`, L50 `not_found`, L74 `payment_error`, L86 `refund_error`). File now fully clean. tsc count: 245 → 237.

Applied the iter-13/14/15/17 recipe (fifth successful application). Canonical-name remap: `"permission_denied"` → `"authorization_error"` (403); `"not_found"` → `"resource_not_found"` (404); `"payment_error"` → `"internal_error"` (500, preserved via `{ code: "stripe_refund_failed" }`); `"refund_error"` → `"internal_error"` (500, preserved via `{ code: "refund_failed" }`). Dropped all 4 redundant 3rd-arg status codes.

**Why this was needed:** `refund/route.ts` was the last dense v1 cluster file with api-response drift errors. STATE.md's iter-19 recommendation listed this as iter 20's primary target. After iter 20 the only remaining dense v1 cluster file is `ticket-types/route.ts`.

**Investigation:**
- Read full `app/api/v1/orders/[orderId]/refund/route.ts` (111 lines, post-iter-19 state).
- Re-read `lib/middleware/api-response.ts` (116 lines) to confirm `ApiErrorType` canonical set and `apiError(type, message, options?)` signature.
- `grep "refund/route.ts" ralph-dev/tsc-errors-iter19-after.txt` → 8 errors, all api-response drift scope. STATE.md's iter-19 prediction was 5 × TS2559 + 3 × TS2345; actual was 4 + 4. The discrepancy didn't affect the recipe application.

**Choices made:**
- **Used `{ code: "stripe_refund_failed" }` and `{ code: "refund_failed" }`** to distinguish the two `internal_error` 500 sites. Matches the recommendation in STATE.md. API consumers can branch on the `code` to detect Stripe-layer vs ledger-layer failures.
- **Did NOT extend the helper or add new `ApiErrorType` members.** Both legacy names had no clean canonical mapping; the `internal_error` + `code` pattern handles them at the caller level with no helper API surface added.
- **Used 5 surgical Edits**, each targeting a distinct logical block (auth+permission; not-found+refund-amount; Stripe error; ledger error; catch-block). Each old_string was unique enough that no `replace_all` was needed.

**Pre-edit verifications:** baseline tsc count 245; target file read in full; api-response helper re-read; 8 errors confirmed via grep.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 237 (was 245). Exactly 8 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter19-after.txt ralph-dev/tsc-errors-iter20-after.txt` → 8 lines deleted, 0 added. Cleanest possible diff (no line-shift artifacts; file line-count unchanged).
- `grep "refund/route.ts" ralph-dev/tsc-errors-iter20-after.txt` → empty. **File fully clean.**

**Out of scope deliberately:**
- `ticket-types/route.ts` (~12 errors expected). iter-21 target.
- 19 TS2551 typos. Mechanical batch, iter 22+.
- ~106 TS2339 errors. Iter 23+ exploration.

**Acceptance flipped:** None directly. `refund/route.ts` fully clean. Phase 3 aggregate boxes still pending; 237 errors still to go.

**Learned:**
- **iter 20 convention — predictive line-counts may be off but the recipe is robust.** The actual 4 + 4 split vs STATE.md's 5 + 3 prediction had no impact on the recipe application. Trust the recipe more than the exact line count; re-grep at iter entry for the canonical count.
- **iter 20 convention — `code` preservation generalized to multi-site in one file.** Both `stripe_refund_failed` and `refund_failed` map to `internal_error` (500) and use `code` to distinguish. The pattern is robust under multi-site per-file use.
- **iter 20 convention — cleanest-possible diff confirms recipe maturity.** 8 lines deleted, 0 added, zero shift artifacts. The recipe is now mature; predict iter 21 (`ticket-types/route.ts`) to have a similar profile.

**Next:** Iter 21 — strongly recommended: `ticket-types/route.ts` api-response drift sweep (~12 errors, iter-13/14/15/17/20 recipe). Last dense v1 cluster file. After that the v1 API cluster work is fully done; iter 22+ should pivot to TS2551 batch or TS2339 hotspot analysis.


## 2026-05-24 — iter 21 — Phase 3: ticket-types/route.ts api-response drift sweep (12 errors, file fully clean; DENSE V1 CLUSTER DONE)

**Fixed:** 12 api-response drift errors in `app/api/v1/ticket-types/route.ts` — 7 × TS2559 (status-as-3rd-arg: L11 401, L16 429, L24 400, L62 500, L70 401, L97 400, L140 500), 4 × TS2345 (legacy type names: L43 `database_error`, L74 `permission_denied`, L109 `not_found`, L134 `database_error`), 1 × TS2554 (L137 `apiSuccess(ticketType, {}, 201)`). File now fully clean. tsc count: 237 → 225. **The entire dense v1 API cluster is now done — 7 of 7 originally-named files fully clean.**

Applied the iter-13/14/15/17/20 recipe (sixth successful application). Canonical-name remap: `"database_error"` → `"internal_error"` (500, no `code` preservation — see "Choices" below); `"permission_denied"` → `"authorization_error"` (403); `"not_found"` → `"resource_not_found"` (404). Dropped all 7 redundant 3rd-arg status codes. Rewrote L137 `apiSuccess(ticketType, {}, 201)` as `apiSuccess(ticketType, { status: 201 })`. Added `{ rateLimit: rateLimitResult }` to L16 rate-limit-exceeded response (correctness improvement matching iters 13/14/15/17 — restores `addRateLimitHeaders` emission of `Retry-After`/`X-RateLimit-*`).

**Why this was needed:** `ticket-types/route.ts` was the last dense v1 cluster file with api-response drift errors. STATE.md's iter-20 recommendation listed this as iter 21's primary target. After iter 21 the dense v1 API cluster work is fully done; the loop should pivot to a different recipe family.

**Investigation:**
- Read full `app/api/v1/ticket-types/route.ts` (143 lines, post-iter-20 state).
- Re-read `lib/middleware/api-response.ts` (116 lines) to confirm `ApiErrorType` canonical set, `apiError(type, message, options?)` signature, `apiSuccess(data, options?)` with `status` option, `STATUS_CODES` mapping.
- `grep "ticket-types/route.ts" ralph-dev/tsc-errors-iter20-after.txt | wc -l` → 12. All legacy type names in iter-13/14/15/17/20 vocabulary (zero surprise names).

**Choices made:**
- **No `code` preservation for `database_error` remap.** The legacy semantic is generic ("DB layer failure"); consumers can't act on it differently than any other 500. Resisted iter-20's `code: "stripe_refund_failed"`/`code: "refund_failed"` precedent because there's no application-level subtype to preserve. Both `database_error` sites in this file are exactly the same kind of failure (insert vs select on the same table).
- **Used 6 surgical Edits** rather than one Write rewrite. GET catch + POST auth + POST permission combined into one Edit because the source text was contiguous.
- **Did NOT extend the helper.** Both legacy names had clean canonical mappings; no helper API surface added.

**Pre-edit verifications:** baseline tsc count 237; target file read in full; api-response helper re-read; 12 errors confirmed via grep; all legacy names in known vocabulary.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 225 (was 237). Exactly 12 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter20-after.txt ralph-dev/tsc-errors-iter21-after.txt` → 12 lines deleted, 0 added. Cleanest possible diff matching iter-20 profile.
- `grep "ticket-types/route.ts" ralph-dev/tsc-errors-iter21-after.txt` → empty. **File fully clean.**
- Updated tally: TS2559 = 12 (was 19), TS2345 = 14 (was 18), TS2554 = 9 (was 10). All other error counts unchanged (no cross-file effects).

**Out of scope deliberately:**
- 19 TS2551 typos. iter-22 target (mechanical batch).
- 106 TS2339 errors. iter-23+ target (hotspot analysis).
- 23 TS2322 errors. Iter 24+.

**Acceptance flipped:** None directly. `ticket-types/route.ts` fully clean; **dense v1 API cluster fully done**. Phase 3 aggregate boxes still pending; 225 errors still to go.

**Learned:**
- **iter 21 convention — when the legacy type name is generic enough, skip `code` preservation.** Iters 15/17/20 used `{ code: "..." }` to carry application-specific subtypes when remapping. But iter 21's `database_error` → `internal_error` needed NO `code` because both are equally generic. Generalization: ask "would API consumers branch differently on the legacy name vs the canonical?" If yes, preserve via `code`; if no, drop.
- **iter 21 convention — recipe is now fully mature.** 6 successful applications (iters 13/14/15/17/20/21). The recipe handles every case observed: legacy type name, status-as-3rd-arg, wrong arg shape on apiSuccess, helper-has-no-equivalent (raw NextResponse fallback), code preservation when subtype matters. Future api-response drift in non-v1 routes (if discovered) should be 1-iter-per-file with predictable clean diffs.
- **iter 21 milestone — dense v1 API cluster fully done.** 7 files cleaned across 6 iters (iter 13 events/[eventId]; iter 14+18+19 tickets/purchase; iter 15+16 tickets/check-in; iter 17 events/route; iter 18+19+20 refund/route; iter 21 ticket-types/route; transactions/route already clean). ~85 errors closed across the cluster.

**Next:** Iter 22 — strongly recommended: TS2551 mechanical batch (19 errors). Lowest-risk path to error reduction. After that, iter 23 should profile the TS2339 hotspot (106 errors, 47% of remaining queue) and decide on a recipe.


## 2026-05-24 — iter 22 — Phase 3: TS2551 mechanical batch fully closed (19 errors + 2 incidental TS2339)

**Fixed:** All 19 TS2551 errors closed across 8 files in 3 root-cause clusters, plus 2 incidental TS2339 errors closed by the same SELECT-addition. tsc count: 225 → 204.

**Cluster A — 10 sites: `.catch()` on Supabase PostgrestFilterBuilder.**
- Files: `app/api/setup-carbardmv/route.ts` (L145, L148), `lib/admin-actions.ts` (L148, L619), `lib/content-moderation.ts:189`, `lib/media-actions.ts:220`, `lib/moderation-actions.ts` (L177, L216), `lib/wallet-actions.ts:899`.
- Root cause: PostgrestFilterBuilder is a PromiseLike (has `.then`) not a Promise (no `.catch`).
- Mechanical fix: `.catch(handler)` → `.then(undefined, handler)`. Identical runtime semantics.

**Cluster B — 6 errors: `match.player1_wins`/`match.player2_wins` in `app/dashboard/my-events/page.tsx`.**
- Root cause: SELECT-column omission. The tournament_matches SELECT didn't include `player1_wins, player2_wins, is_bye`.
- Fix: added the missing columns to the SELECT. Closed 6 × TS2551 + 2 × TS2339 (the `is_bye` accesses) in one Edit.

**Cluster C — 4 errors: `match.reported_player1_draws`/`match.reported_player2_draws` in `components/tournaments/tournament-controller.tsx`.**
- Root cause: missing fields on the manually-typed `matches` array shape (L188-201).
- Fix: added `reported_player1_draws?: number | null` and `reported_player2_draws?: number | null` (optional) to the interface.

**Why this was needed:** iter-21 STATE.md recommended TS2551 as the iter-22 target — lowest-risk path to error reduction. After iter 22, only TS2339 (104), TS2322 (23), and smaller error classes remain.

**Investigation:**
- `grep "TS2551" ralph-dev/tsc-errors-iter21-after.txt` → 19 errors across 8 files.
- Read source for 3-5 representative errors before starting. Found that the compiler "did you mean" suggestions were uniformly semantically wrong (suggested `player1_id` for `player1_wins`, suggested `match` method for `.catch`).
- Categorized into 3 clusters by root cause. Confirmed each cluster's fix recipe before starting edits.
- `grep "my-events/page.tsx" ralph-dev/tsc-errors-iter21-after.txt` revealed 2 adjacent TS2339s (`is_bye`) with the same root cause as the player_wins TS2551s — closed in the same SELECT edit.
- Confirmed via `grep "reported_player.*draws" scripts/*.sql` that no `ADD COLUMN` migration exists for the `_draws` columns; only referenced in comments and server-side code. **Probable schema drift surfaced as a runtime concern; type fix preserves Phase 3 scope.**

**Choices made:**
- **Used `.then(undefined, handler)` not `.then(null, handler)` or `.then(_ => _, handler)`.** Most direct semantic equivalent of `.catch(handler)`.
- **Did NOT refactor the broken fallback bodies in Cluster A.** Out of scope per "no cosmetic changes." Cluster A's `.then(undefined, ...)` handlers preserve un-awaited Supabase chains that were broken to begin with. Surface as runtime concern.
- **Made `_draws` fields optional, not required.** Avoids cascading required-field errors at the parent.
- **Did NOT add `player1_draws/player2_draws` to my-events SELECT.** The JSX doesn't read those; resisted scope creep.
- **Did NOT fix the residual `tournament_rounds?.round_number` TS2339 in my-events:518.** Different root cause (relation cardinality mismatch); iter-23+.

**Pre-edit verifications:** baseline tsc count 225 confirmed; all 8 source files read in relevant ranges; compiler suggestions spot-checked and rejected as semantically wrong; `scripts/*.sql` grep for `reported_player*_draws` columns returned only comments.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 204 (was 225). Exactly 21 errors eliminated.
- `grep -c "TS2551" ralph-dev/tsc-errors-iter22-after.txt` → 0. **All 19 TS2551 closed.**
- `diff ralph-dev/tsc-errors-iter21-after.txt ralph-dev/tsc-errors-iter22-after.txt` → 21 deletions plus expected line-shift artifacts on tournament-controller.tsx.

**Out of scope deliberately:**
- 104 TS2339 errors. Iter-23+ (profile hotspot first).
- 23 TS2322 errors. Iter 24+.
- Refactoring un-awaited fallback bodies (runtime concern).
- The `tournament_rounds` array-vs-object TS2339 in my-events:518.
- SQL migration audit for `reported_player*_draws` columns (needs runtime testing).

**Acceptance flipped:** None directly. TS2551 = 0 (fully closed). Phase 3 aggregate boxes still pending; 204 errors still to go.

**Learned:**
- **iter 22 convention — TS2551 "did you mean" is often semantically wrong.** Compiler suggestion is pure string-distance, not semantic. Treat as hint; root-cause-analyze each cluster.
- **iter 22 convention — canonical Supabase `.catch` fix is `.then(undefined, handler)`.** 10 sites converged on this. Established recipe.
- **iter 22 convention — SELECT-omission TS2551s often hide adjacent TS2339s.** Grep the whole file for ALL field accesses on the result type and add every omitted field in one edit.
- **iter 22 convention — manual-prop-interface TS2551s expose schema drift WARNINGS.** Surface as runtime concern with explicit "needs SQL migration audit" callout.
- **iter 22 convention — type-correctness ≠ runtime-correctness.** Cluster A's mechanical fix preserves broken fallback bodies. tsc passing does NOT mean code works. Phase 3 = type-safety; Phase 4 = feature-correctness.

**Next:** Iter 23 — strongly recommended: TS2339 hotspot profile and recipe selection. Run:
```sh
grep "TS2339" ralph-dev/tsc-errors-iter22-after.txt | awk -F'(' '{print $1}' | sort | uniq -c | sort -rn | head -10
```
Likely hotspot: `components/tournaments/tournament-controller.tsx` (~30 errors). Pick from sub-recipes 1a (prop interface), 1b (SELECT-column), or 1c (discriminated union narrowing) based on the dominant pattern.


## 2026-05-24 — iter 23 — Phase 3: lib/role-actions.ts missing-await sweep (26 errors closed)

**Fixed:** All 26 errors in `lib/role-actions.ts` (20 × TS2339 + 6 × TS2554) closed via 2 surgical edits. tsc count: 204 → 178.

**Root cause:** `lib/supabase/server.ts:10` was refactored to `async function createClient()` with zero params (Next.js 15+ pattern — reads cookies internally). But the 6 server actions in `role-actions.ts` were using the legacy synchronous pattern: `const cookieStore = await cookies(); const supabase = createClient(cookieStore)`. Every site triggered both TS2554 (wrong arg count at call) AND TS2339 (un-awaited `Promise<SupabaseClient>` chained with `.auth`/`.from`).

**Fix:**
1. `replace_all` on the 2-line legacy block → `const supabase = await createClient()`. Collapsed 6 byte-identical occurrences in one Edit.
2. Removed the now-unused `import { cookies } from 'next/headers'`.

**Why this was needed:** Iter-22 STATE.md recommended TS2339 hotspot exploration. Profile (`grep "TS2339" ... | awk ... | sort | uniq -c | sort -rn`) showed `lib/role-actions.ts` as the top hotspot at 20 TS2339 — not the predicted `tournament-controller.tsx`. Pivoted to role-actions.ts. The hotspot turned out to have a single uniform root cause spanning ALL 26 errors in the file (TS2554 was excluded from the TS2339 grep but had the same root cause).

**Investigation:**
- `grep "TS2339" ralph-dev/tsc-errors-iter22-after.txt | awk -F'(' '{print $1}' | sort | uniq -c | sort -rn | head -10` showed `lib/role-actions.ts` (20) at the top, well ahead of `tournament-controller.tsx` (14).
- Read `lib/role-actions.ts` (first 50 lines) and `lib/supabase/server.ts` (full) to confirm signature mismatch.
- `grep "createClient\|cookieStore\|cookies" lib/role-actions.ts` confirmed 6 byte-identical 2-line blocks at lines (7,8), (59,60), (80,81), (97,98), (158,159), (200,201). No other `cookies` usages.

**Choices made:**
- **Used `replace_all` for the 2-line block.** iter-14's caveat about replace_all unreliability was on substring matches; the 2-line block here is a complete logical unit (full lines with consistent indentation). Tool confirmed all 6 replaced; tsc count drop confirmed.
- **Removed the `cookies` import** per the iter-9 dead-import convention.
- **Did NOT extend the sweep to other files in this iter.** Per "one root cause per iter," fixed only the surfaced file. The pattern is almost certainly repo-wide; surfaced as the top iter-24 recommendation.
- **Did NOT touch `lib/supabase/server.ts`.** The new async signature is the canonical / load-bearing one (Next.js 15+ requires `await cookies()`). Callers migrate to it.

**Pre-edit verifications:** baseline tsc count 204 confirmed; `lib/supabase/server.ts` read (confirmed `async createClient()` zero params); grep confirmed 6 identical 2-line legacy blocks; all 26 errors in this file confirmed to be the same root cause.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 178 (was 204). Exactly 26 errors eliminated.
- `grep "lib/role-actions.ts" ralph-dev/tsc-errors-iter23-after.txt | wc -l` → 0. **File fully clean.**
- `diff ralph-dev/tsc-errors-iter22-after.txt ralph-dev/tsc-errors-iter23-after.txt` → 26 lines deleted (all role-actions.ts), 0 added. Cleanest possible diff for a 26-error iter.

**Out of scope deliberately:**
- Repo-wide cross-file sweep for the same `createClient(cookieStore)` drift. Iter-24 top recommendation. Profile commands provided in STATE.md "What's next."
- 84 remaining TS2339 errors. Iter-24+ (likely shrunk further if the createClient sweep finds more files).
- 23 TS2322 errors. Later iter.

**Acceptance flipped:** None directly. Phase 3 aggregate boxes; 178 errors still to go.

**Learned:**
- **iter 23 convention — coupled error classes from a single root cause close together.** Counting only TS2339 underestimated the iter's leverage by 30% (20 vs 26). Count ALL error classes in the target file at iter entry, not just the one matched by your recipe filter.
- **iter 23 convention — Next.js 15+ `createClient` migration is repo-wide drift.** Legacy `const cookieStore = await cookies(); const supabase = createClient(cookieStore)` → canonical `const supabase = await createClient()`. Mechanical fix. Profile with `grep -rn "createClient(cookieStore)"` to find all sites.
- **iter 23 convention — STATE.md hotspot predictions decay; re-profile at iter entry.** STATE.md predicted `tournament-controller.tsx` (~30 errors); actual was `role-actions.ts` (26 errors). The awk command runs in seconds.
- **iter 23 convention — cleanest 1-edit-fix-many is when the legacy pattern is byte-identical across N sites.** 6 byte-identical 2-line blocks → 1 replace_all. Verify with tsc-count check.

**Next:** Iter 24 — strongly recommended: repo-wide `createClient(cookieStore)` sweep. Profile:
```sh
grep -rn "createClient(cookieStore)" --include="*.ts" --include="*.tsx" app/ lib/ components/
```
If 5+ caller files have the drift, apply the iter-23 recipe to each. Could close 30-100 errors in one iter.


---
Iteration: Codex direct continuation
Repo root: /home/bert/majh-events/v0-majh-events-ecosystem-main
Working dir: /home/bert/majh-events/v0-majh-events-ecosystem-main

## 2026-05-24 — Codex continuation — Phase 3 complete, build gate passed with env

**Fixed:** Remaining TypeScript errors closed. Starting from Ralph/Codex snapshot count 58, the final `npx tsc --noEmit` snapshot is clean.

**Verification:**
- `npx tsc --noEmit > ralph-dev/tsc-errors-codex-6.txt 2>&1` → `0` lines.
- `npm run build` without env reached page-data collection then failed with `supabaseUrl is required`, which is expected for this app without `.env.local`.
- `npm run build` with required placeholder env vars supplied completed successfully and wrote output to `ralph-dev/build-codex-2.txt`.

**Primary fix clusters closed:**
- Supabase relation shape drift from joined rows typed as arrays instead of single objects.
- Legacy server action signatures in CARBARDMV inventory/staff/prep surfaces.
- Tournament controller discriminated-union narrowing and status enum drift.
- Revenue split, media, notification, streaming, Studio, financial dashboard, payout, wallet, and highlight-detection type drift.
- V1 API helper drift not already completed by Ralph.

**Acceptance flipped:**
- Phase 3 `Zero TypeScript errors` checked.
- Phase 3 `All missing type definitions added` checked.
- Phase 5 `npm run build completes without errors when required env vars are supplied` checked.

**Remaining non-TypeScript work:**
- Phase 4 feature verification still needs runtime smoke tests against real Supabase/Stripe/Mux/LiveKit configuration.
- Phase 5 non-build API/cron/runtime error-handling audit remains open.
- Phase 6 loop summary docs remain open.

No `BLOCKED:` or `PLAN_DRIFT:` markers.

---
Iteration: 7
Repo root: /home/bert/majh-events/v0-majh-events-ecosystem-main
Working dir: /home/bert/majh-events/v0-majh-events-ecosystem-main

## 2026-05-24 — iter 24 — Phase 3: tournament-controller.tsx field-additions partial sweep (9 errors closed)

**Fixed:** 9 of 17 errors in `components/tournaments/tournament-controller.tsx` closed via 2 surgical edits adding optional fields to two manually-typed `matches` array prop interfaces. tsc count: 178 → 169.

**Investigation summary (iter entry):**
- Verified iter-23's top recommendation (repo-wide `createClient(cookieStore)` sweep) was a no-op: `grep -rln "createClient(cookieStore)"` returned 0 hits, and a careful check of 242 `@/lib/supabase/server` importers found zero non-awaited `= createClient()` patterns. The drift was self-contained to `lib/role-actions.ts`.
- Pivoted to STATE.md recommendation #2 (TS2339 hotspot exploration). Re-profile via awk identified `components/tournaments/tournament-controller.tsx` at 14 TS2339 errors (top hotspot). Counting all error classes per the iter-23 convention: 17 total errors in this file (14 × TS2339 + 3 × TS2345).
- Three distinct root-cause clusters: (A) discriminated-union narrowing — 5 × TS2339; (B) `TournamentStatus` enum mismatch — 3 × TS2345; (C) missing fields on manually-typed match interfaces — 9 × TS2339.

**Root cause (Cluster C — picked for this iter):** Two distinct manually-typed `matches` array prop interfaces, both missing fields. `currentRound.matches[]` (L167-177) missing `is_feature_match`. `allRounds[].matches[]` (L188-204) missing `is_feature_match`, `draws`, `dispute_reason`. All three columns are REAL DB columns from real migration scripts (042, 050, 053). The parent action does `select("*")` so they're returned at runtime; the bug was purely the manually-typed interface omissions.

**Fix:**
1. Edit interface L188-204 (allRounds[].matches): added `draws?: number | null`, `is_feature_match?: boolean | null`, `dispute_reason?: string | null` before the `player1`/`player2` lines.
2. Edit interface L167-177 (currentRound.matches): added `is_feature_match?: boolean | null` before the `player1`/`player2` lines.

**Choices made:**
- **Optional fields, not required.** Matches the iter-22 convention. JSX accessors already use safe patterns (`?? 0`, `match.x && ...`), so `undefined` runtime values are handled gracefully.
- **Did NOT add `loser_id`, `reported_*` etc. to the smaller (currentRound) interface.** The two interfaces are intentionally different shapes — current-round display doesn't need `reported_*` for dispute UI. Only added what JSX actually references.
- **Did NOT do Clusters A or B in this iter.** Per "one root cause per iter." Surfaced as iter-25 candidates.

**Pre-edit verifications:** baseline tsc count 178 confirmed; both interface definitions read; all 9 JSX usage sites read (confirmed safe-access patterns); `grep -n "is_bye|table_number"` revealed TWO interface declarations; `grep -n "scripts/*.sql"` confirmed all 3 columns have real migrations.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 169 (was 178). Exactly 9 errors eliminated.
- `grep "tournament-controller.tsx" ralph-dev/tsc-errors-iter24-after.txt | wc -l` → 8 (was 17 — 9 closed, 8 remaining in Clusters A + B).
- `diff ralph-dev/tsc-errors-iter23-after.txt ralph-dev/tsc-errors-iter24-after.txt` → 9 deletions + 8 line-shift updates. Zero NEW errors.

**Process note — dual-interface discovery:**
First Edit closed only 3 of 9 expected errors. Pivoted by reading the error message's type signature ("Property 'is_feature_match' does not exist on type {... no loser_id ...}") which revealed a SECOND, smaller interface. Second Edit closed the remaining 6.

**Out of scope deliberately:**
- Cluster A (5 errors, discriminated-union narrowing). Iter-25 candidate.
- Cluster B (3 errors, `TournamentStatus` enum mismatch). Iter-25 candidate (small, instructive).
- New top hotspot `lib/cold-start-service.ts` (12 errors). Iter-25 recommended target.
- 23 TS2322, 24 TS7031/TS7006/TS18047, 12 TS2559. Iters 26+.

**Acceptance flipped:** None directly. Phase 3 aggregate boxes; 169 errors still to go.

**Learned:**
- **iter 24 convention — verify cross-file sweep recommendations at iter entry; STATE.md predictions decay.** The iter-23 top recommendation was a no-op. Always run the verification grep BEFORE committing time to a cross-file sweep.
- **iter 24 convention — multiple manually-typed interfaces for the same shape need separate extension.** When a file has multiple prop-type declarations covering the same underlying table, each may need its own field additions. Use the error message's type-signature presence/absence to distinguish shapes.
- **iter 24 convention — confirm columns exist before assuming schema drift.** Cheap `grep "ADD COLUMN.*<name>" scripts/*.sql` resolves the question in seconds. Don't over-warn; iter-22's `reported_player*_draws` warning was right, but iter-24's 3 fields all had real migrations.
- **iter 24 convention — counting all error classes at hotspot entry is load-bearing.** TS2339-only filter showed 14 errors; counting all classes showed 17. Generalization from iter 23: always run `grep "<file>" ralph-dev/tsc-errors-*.txt | wc -l` for the total at hotspot entry.

**Next:** Iter 25 — strongly recommended: TS2339 hotspot exploration on `lib/cold-start-service.ts` (new top hotspot at 12 errors). Pre-iter profile:
```sh
grep "TS2339" ralph-dev/tsc-errors-iter24-after.txt | grep cold-start-service
```
Read first 50 lines + a couple of error sites to identify root cause before committing. If root cause is mechanical (interface drift or SELECT omission), single iter closes 8-12 errors. If complex (cross-file shape drift), pivot to candidate #2 (3-error `TournamentStatus` enum fix in tournament-controller — small, instructive, unblocks Cluster B for iter 26).
