# PLAN.md — Repo analysis & definition

## Subject
- **Repo:** v0-majh-events-ecosystem (MAJH EVENTS — majhevents.com)
- **Root:** /home/bert/majh-events/v0-majh-events-ecosystem-main
- **Goal:** Produce a canonical, accurate, navigable definition of this repo
  so a new contributor (human or agent) can be productive in under an hour.

## Context
Next.js 16 / React 19 events platform for the MTG and esports community.
Built iteratively via v0.app. Stack: Supabase (Postgres + RLS, 272 tables),
Stripe (escrow/payouts/disputes), Mux (livestream/VOD), LiveKit, Vercel Blob,
Resend, Capacitor (iOS/Android). Deployed to Vercel.

Known issues to surface in VERIFICATION.md:
- mux_playback_id column missing from user_streams table (blocks go-live)
- VOD RLS policy missing for status='ended' (blocks /live/vods page)
- toggleStreamSourceLive() lacks admin-only update policy (security gap)
- app/api/access/core access/ has spaces in directory name (will 404 in prod)
- No test suite anywhere
- No .env.example — env vars undocumented
- 136+ SQL migrations with no migration runner (manual execution only)

## Out of scope
- Do not modify any application source code (app/, components/, lib/)
- Do not modify SQL scripts in scripts/
- Do not add tests
- Ignore node_modules/
- Ignore ralph/ directory itself

## Phases

The loop walks these phases in order. The agent should not start phase N+1
until every acceptance item in phase N is checked.

### Phase 1 — INVENTORY
Establish ground truth about what physically exists.
- File tree at depth 2, languages by line count, build/package files,
  entry points, CI config, lockfiles, env templates.
- Output: `docs/INVENTORY.md`

### Phase 2 — MAP
Trace structure and flow.
- Module/package boundaries, public surface, data flow at module level,
  external dependencies (services, APIs, queues, DBs), config surface.
- Output: `docs/ARCHITECTURE.md` + a mermaid diagram of components.

### Phase 3 — CHARACTERIZE
Explain behavior in human terms.
- What does this do? Who calls it? What's the request/job/event lifecycle?
  What are the failure modes? What's load-bearing vs incidental?
- Output: append "Behavior" section to `docs/ARCHITECTURE.md`,
  plus `docs/GLOSSARY.md` for project-specific terms.

### Phase 4 — DEFINE
Produce the canonical contributor-facing docs.
- `README.md` (rewrite or create): what, why, install, run, test, deploy.
- `docs/CONTRIBUTING.md`: dev loop, conventions, where things go.
- `docs/RUNBOOK.md`: how to operate this in production (if applicable).

### Phase 5 — VERIFY
Stress-test the definitions against reality.
- Cross-check every claim in README/ARCHITECTURE against actual code via
  `rg`. Flag drift in `docs/VERIFICATION.md`. Fix or annotate as known gap.
- No phase 5 finding should silently change earlier phase outputs — record
  the diff in PROGRESS.md.

## Conventions
- All generated docs live under `docs/` except the top-level `README.md`.
- Diagrams: mermaid in fenced ```mermaid blocks.
- Cite code with relative paths and line ranges: `app/foo.tsx:42-58`.
- Never assert behavior you didn't verify with `rg` or by reading the file.
