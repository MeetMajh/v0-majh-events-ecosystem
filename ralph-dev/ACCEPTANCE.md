# ACCEPTANCE.md — Exit criteria for MAJH EVENTS dev completion

The driver loop reads this file. When every `[ ]` becomes `[x]`, the loop
exits successfully. The agent flips boxes only after verifying the fix is real.

## Phase 1 — TRIAGE (identify all errors)
- [x] `ralph-dev/TRIAGE.md` created listing every TypeScript error from `npx tsc --noEmit`
- [x] All broken/missing imports identified and listed in TRIAGE.md
- [x] All stub/placeholder implementations identified (TODOs, `throw new Error`, empty returns)
- [x] All known bugs from BACKEND-AUDIT.md listed in TRIAGE.md with file+line references
- [x] Path-with-spaces bug documented: `app/api/access/core access/` routes catalogued
- [x] Missing env vars catalogued: every `process.env.X` reference listed in `ralph-dev/ENV.md`

## Phase 2 — CRITICAL FIXES (blocking issues)
- [x] `mux_playback_id` column: migration script written to `scripts/137_add_mux_playback_id.sql`
- [x] VOD RLS policy: migration script written to `scripts/138_vod_rls_ended_streams.sql`
- [x] Stream sources admin policy: migration script written to `scripts/139_stream_sources_admin_rls.sql`
- [x] Path-with-spaces routes in `app/api/access/core access/` renamed (spaces removed from directory name)
- [x] `.env.example` created with all required env vars from ENV.md

## Phase 3 — TYPESCRIPT ERRORS
- [x] Zero TypeScript errors on `npx tsc --noEmit` (or all remaining errors documented as intentional)
- [x] All broken imports resolved
- [x] All missing type definitions added

## Phase 4 — FEATURE COMPLETION
- [ ] All server actions in lib/ verified to have real implementations (no throw-stub bodies)
- [ ] All page components verified to have real data fetching (no hardcoded mock data passed as final)
- [ ] Streaming go-live flow: `manuallyStartStreaming()` end-to-end verified correct
- [ ] Ticketing checkout flow: Stripe session creation verified correct
- [ ] Wallet/payout flow: `execute_payout_request` SQL function confirmed referenced correctly
- [ ] Tournament bracket logic: `bracket-utils.ts` verified non-stub

## Phase 5 — BUILD VERIFICATION
- [x] `npm run build` completes without errors when required env vars are supplied
- [ ] No `console.error` calls that indicate runtime failures in server actions
- [ ] All cron route handlers return proper JSON responses (not undefined)
- [ ] All API routes have proper error handling (no unhandled promise rejections)

## Phase 6 — DOCUMENTATION
- [ ] `ralph-dev/FIXES_APPLIED.md` summarizes every change made by this loop
- [ ] `ralph-dev/SQL_TO_RUN.md` lists all SQL migration scripts to execute in Supabase (in order)
- [ ] `ralph-dev/ENV.md` finalized with all required environment variables and their purpose
- [ ] No unresolved `BLOCKED:` or `PLAN_DRIFT:` markers in STATE.md
