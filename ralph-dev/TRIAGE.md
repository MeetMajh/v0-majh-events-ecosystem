# TRIAGE.md — MAJH EVENTS dev-completion intake

Generated: iteration 1 (Phase 1).
Source of truth for the full tsc dump: `ralph-dev/tsc-errors.txt` (407 lines).

## 1. Known bugs (from PLAN.md / BACKEND-AUDIT.md)

| # | Bug | Evidence | Phase-2 fix |
|---|-----|----------|-------------|
| 1 | `mux_playback_id` column referenced but absent from base schema | `lib/go-live-actions.ts:294` (read in `manuallyStartStreaming`) + `BACKEND-AUDIT.md:31,133`. Column is defined in `scripts/051-user-streams-final.sql:34` but only as `ADD COLUMN IF NOT EXISTS`, and 051 drops the table — production may be on an older script | `scripts/137_add_mux_playback_id.sql` (additive, idempotent) |
| 2 | VOD page returns 0 rows — no RLS SELECT policy for `status='ended'` | `app/(public)/live/vods/page.tsx`. Policy `Public can view ended streams` exists in `scripts/051-user-streams-final.sql:60-61` but is not in any earlier migration — if 051 was not re-run, prod is missing it | `scripts/138_vod_rls_ended_streams.sql` (`CREATE POLICY IF NOT EXISTS` equivalent) |
| 3 | `stream_sources` has no admin-only UPDATE policy — `toggleStreamSourceLive()` callable by any auth'd user | `lib/go-live-actions.ts:345-347` (server action). `scripts/037-stream-sources.sql` enables RLS but defines only the public SELECT policy. `BACKEND-AUDIT.md:64-70` confirms gap | `scripts/139_stream_sources_admin_rls.sql` |
| 4 | `app/api/access/core access/` directory contains spaces — Next.js routes break in prod | Five empty subdirectories present: `services`, `database`, `git`, `vercel`, `codebase`. No `route.ts` files inside any of them. Sibling routes exist at `app/api/access/code/route.ts`, `app/api/access/db/route.ts`, `app/api/access/git/route.ts`, `app/api/access/env/route.ts` | Remove the empty `core access/` directory (no source to migrate) |
| 5 | No `.env.example` documenting required env vars | None present at repo root | Create `.env.example` from `ralph-dev/ENV.md` |

## 2. TypeScript errors

`npx tsc --noEmit` produces **407 error lines** across **~130 files**.

### 2a. By error code (top 12)
| Code | Count | Meaning |
|------|------:|---------|
| TS2339 | 110 | Property does not exist on type (most often Supabase relation shape vs hand-typed shape) |
| TS2559 | 49 | No properties in common with type (Supabase insert payload mismatch) |
| TS2345 | 43 | Argument not assignable to parameter |
| TS2322 | 28 | Type not assignable (Stripe API version literal, nullable mismatches) |
| TS2551 | 19 | Property does not exist; did you mean X (typo / drift) |
| TS2554 | 18 | Expected N arguments, got M |
| TS7031 |  11 | Binding element implicitly any (Supabase SSR cookies destructure) |
| TS7006 |  7 | Parameter implicitly any |
| TS18047 |  6 | Possibly null |
| TS2741 |  5 | Property missing in type (notification-type Record exhaustiveness) |
| TS2353 |  5 | Unknown property in object literal |
| TS2304 |  4 | Cannot find name (see imports below) |

### 2b. Files with the largest error footprint
| Errors | File |
|------:|------|
| 26 | `lib/role-actions.ts` |
| 21 | `components/tournaments/tournament-controller.tsx` |
| 16 | `app/api/v1/tickets/purchase/route.ts` |
| 16 | `app/api/v1/tickets/check-in/route.ts` |
| 15 | `app/api/v1/events/[eventId]/route.ts` |
| 14 | `app/api/v1/events/route.ts` |
| 12 | `lib/cold-start-service.ts` |
| 12 | `app/api/v1/ticket-types/route.ts` |
| 12 | `app/api/v1/orders/[orderId]/refund/route.ts` |
| 10 | `lib/revenue-splits-service.ts` |
|  9 | `lib/supabase/introspections.ts` |
|  9 | `app/dashboard/my-events/page.tsx` |
|  8 | `app/api/v1/features/route.ts` |

Full ordering and every error: `ralph-dev/tsc-errors.txt`.

### 2c. Stripe API version drift (TS2322)
Three route handlers pin a Stripe `apiVersion` literal that does not match the installed `Stripe` type's `LatestApiVersion`:
- `app/api/admin/payouts/approve/route.ts:6` → `"2025-03-31.basil"`
- `app/api/cron/process-payouts/route.ts:13` → `"2024-06-20"`
- `app/api/cron/reconcile-intents/route.ts:8` → `"2024-06-20"`

Canonical version (from `lib/stripe.ts`): `"2025-02-24.acacia"`.

### 2d. Top-level await (TS1378)
- `app/api/run/route.ts:40,41` — top-level await with current `tsconfig.json` target. Either bump module/target or move into an async handler.

## 3. Broken or missing imports (TS2304/TS2305/TS2307)

| File:line | Symbol | Diagnosis |
|---|---|---|
| `components/providers/analytics-provider.tsx:4` | module `@/hooks/use-user` | Hook file does not exist under `hooks/`. Either create it or switch to existing `useAuth`/`@supabase/auth-helpers` equivalent |
| `lib/refund-actions.ts:5` | module `@/lib/supabase/service` | Path does not exist. Likely intended `@/lib/supabase/server` (service-role client lives there) |
| `lib/supabase/introspections.ts:1` | named export `supabase` from `@/lib/supabase/client` | `client.ts` exports `createClient()` factory, no named `supabase` singleton. Update introspections to call factory or to use service-role client |
| `components/player/player-controller.tsx:442,470,487,860` | name `playerId` | Identifier referenced inside the component body but never declared as prop / state / param. Needs to either be a destructured prop or derived from `params` |

## 4. Stub / placeholder implementations

A targeted scan for `throw new Error("Not implemented")`, hard-stub TODO comments in server actions, and empty-return server actions found **no throw-stub bodies** in `lib/*-actions.ts`.

The only outstanding code TODO is:
- `lib/clip-actions.ts:37` — `// TODO: Delete from Blob storage if needed` (deferred cleanup, not a blocker)

`throw new Error(...)` calls in `lib/` are all real validation errors, not stubs (confirmed by spot-checking `lib/go-live-actions.ts`, `lib/wallet-actions.ts`, `lib/tournament-financial-actions.ts`).

Phase 4 work therefore focuses on **verifying** existing implementations (flow correctness, Stripe session creation, payout SQL function references), not filling stubs. ACCEPTANCE Phase 4 boxes will be flipped per the per-flow checklist as each is audited.

## 5. Path-with-spaces routes

`app/api/access/core access/` contains five empty subdirectories and zero `.ts` / `.tsx` files:

```
app/api/access/core access/codebase
app/api/access/core access/database
app/api/access/core access/git
app/api/access/core access/services
app/api/access/core access/vercel
```

Sibling routes that do exist at `app/api/access/`:
- `code/route.ts`
- `db/route.ts`
- `env/route.ts`
- `git/route.ts`

Decision for Phase 2: **delete** the empty `core access/` tree. No source to migrate, no callers (zero results for `"core access"` and `"core%20access"` outside that dir — to be re-confirmed before deletion).

## 6. Env vars

Full catalogue lives in `ralph-dev/ENV.md`. Phase 2 will materialise `.env.example` from that list.
