# PLAN.md — MAJH EVENTS dev completion

## Subject
- **Repo:** v0-majh-events-ecosystem (MAJH EVENTS — majhevents.com)
- **Root:** /home/bert/majh-events/v0-majh-events-ecosystem-main
- **Goal:** Complete development so all features work as intended with no errors.
  Done = `npm run build` passes, all known bugs fixed, all stubs implemented.

## Context
Next.js 16 / React 19 events platform for MTG/esports community.
Built via v0.app. Stack: Supabase (Postgres + RLS, 272 tables), Stripe,
Mux (livestream/VOD), LiveKit, Vercel Blob, Resend, Capacitor (iOS/Android).
Deployed to Vercel on merge to main.

**Known bugs — fix these first:**
1. `mux_playback_id` column missing from `user_streams` table
   — referenced in `lib/go-live-actions.ts` but not in schema
2. VOD page blocked — RLS policy missing for `status='ended'` on `user_streams`
   — `app/(public)/live/vods/page.tsx` returns 0 rows
3. `stream_sources` table has no admin-only UPDATE policy
   — `toggleStreamSourceLive()` callable by any auth'd user
4. `app/api/access/core access/` — spaces in directory name, 404 in prod
5. No `.env.example` — all env vars undocumented

## Out of scope
- Do not add tests
- Do not refactor or rename beyond what fixes a real bug
- Ignore node_modules/
- Do not modify ralph-dev/ or ralph/ directories

## Phases

The loop walks these phases in order. Do not start phase N+1
until every acceptance item in phase N is checked.

### Phase 1 — TRIAGE
Run `npx tsc --noEmit` and scan for broken imports, stubs, and known bugs.
Produce `ralph-dev/TRIAGE.md` and `ralph-dev/ENV.md`.
Do not fix anything in this phase — only catalogue.

### Phase 2 — CRITICAL FIXES
Fix the 5 known bugs listed above. Write SQL migration scripts for DB fixes.
Fix the path-with-spaces directory. Create `.env.example`.
Each fix goes in its own commit-ready state (real file edits).

### Phase 3 — TYPESCRIPT ERRORS
Work through TRIAGE.md's TypeScript error list top to bottom.
Fix broken imports, missing types, wrong signatures.
Re-run `npx tsc --noEmit` after each batch to confirm progress.

### Phase 4 — FEATURE COMPLETION
Work through TRIAGE.md's stub list. Complete any server actions or page
components that are placeholders or missing real implementations.
Focus on: streaming flow, ticketing checkout, wallet/payout, tournament brackets.

### Phase 5 — BUILD & VERIFY
Run `npm run build`. Fix any remaining build errors.
Document everything done in `ralph-dev/FIXES_APPLIED.md` and
`ralph-dev/SQL_TO_RUN.md` (ordered list of SQL scripts to run in Supabase).

## Conventions
- SQL fixes go in `scripts/` numbered from 137 onward.
- All ralph-dev artifacts go in `ralph-dev/` directory.
- Cite code with relative paths and line ranges: `app/foo.tsx:42-58`.
- Never claim a fix is done without running rg or tsc to verify.
