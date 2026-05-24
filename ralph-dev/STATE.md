# STATE.md — Ralph dev-completion loop

## Current phase
**Phase 4 — FEATURE COMPLETION / runtime verification next. Phase 3 TypeScript gate is complete.**
331 `error TS` lines at iter 1 → 330 (iter 7) → 329 (iter 8) → 320 (iter 9) → 316 (iter 10) → 313 (iter 11) → 310 (iter 12) → 295 (iter 13) → 283 (iter 14) → 270 (iter 15) → 266 (iter 16) → 253 (iter 17) → 251 (iter 18) → 245 (iter 19) → 237 (iter 20) → 225 (iter 21) → 204 (iter 22) → 178 (iter 23) → 169 (iter 24) → 157 (iter 25) → 58 (Codex checkpoint 3) → **0 (Codex checkpoint 6)**. Final verification: `npx tsc --noEmit > ralph-dev/tsc-errors-codex-6.txt 2>&1` produced a 0-line error file. `npm run build` without env fails at page-data collection with `supabaseUrl is required`; with required placeholder env vars supplied, `npm run build` completes successfully and output is saved in `ralph-dev/build-codex-2.txt`.

Codex continuation closed the remaining Phase 3 clusters: Supabase relation-cardinality drift, CARBARDMV server action signature drift, tournament controller narrowing/status drift, Studio/streaming nullable state, financial dashboard relation types, media/notification enum drift, Stripe payout union narrowing, wallet reversal dead update, and AI SDK output typing in moderation/highlight helpers.

## Authoritative authorization context
Mark supplied missing auth/tenant documentation on 2026-05-24. The first pasted
document is now saved at `docs/role-architecture.md`; two additional docs are
expected. Before touching authorization, role assignment, access checks, tenant
membership, department/location scoping, or site access behavior, read
`docs/role-architecture.md` and treat it as founder-authoritative over legacy
implicit assumptions.

Key constraints from the pasted doc:
- MAJH OS is multi-tenant, multi-department, multi-location, and users can hold
  different roles in different scopes simultaneously.
- Effective permissions are the UNION of all permissions from roles across
  platform, tenant, department, location, and event/broadcast layers, filtered
  by the operation's current scope.
- Platform legacy bridge is `profiles.role`: `owner` = OWNER, `admin` =
  SUPER_ADMIN bridge, `user` = USER. After T-204, this legacy column is
  deprecated in favor of authoritative role tables.
- Tenant roles live in `organization_members` with `tenant_id` set and
  `department_id=NULL`, `location_id=NULL`.
- Department roles live in `organization_members` with `tenant_id` and
  `department_id` set.
- Department roles: `DEPARTMENT_ADMIN`, `DEPARTMENT_MANAGER`,
  `DEPARTMENT_STAFF`.
- Location roles live in `organization_members` with `location_id` set:
  `LOCATION_MANAGER`, `LOCATION_STAFF`.
- Event/broadcast roles are future scoped per-event rows such as
  `organization_broadcast_roles`: `ORGANIZER`, `REFEREE`, `MODERATOR`,
  `COMMENTATOR`, `BROADCAST_ADMIN`, `BROADCAST_PRODUCER`,
  `BROADCAST_COMMENTATOR`, `BROADCAST_MODERATOR`.
- User-level community roles (`PLAYER`, `STREAMER`, `VIEWER`) are not
  authorization-bearing.
- Permissions are namespaced strings like `tenant.staff.grant`,
  `finance.payout.initiate`, `broadcast.go_live`; sensitive financial,
  destructive, and audit permissions should be treated as sensitive.
- Target authorization algorithm after T-204: collect platform + tenant +
  event roles, filter by operation scope, union permissions from matching role
  templates, then check `permissionKey IN permissions`.
- Legacy bridge warning: current code has authorization checks across
  `requireRole()` / `staff_roles`, inline `staff_roles` queries, and
  `profiles.role`; none consume `organization_members` yet. Until T-204 ships,
  founder users must have rows in all three legacy/current stores with matching
  values.
- Legacy bridge mapping:
  `PLATFORM_OWNER` => `profiles.role=owner`, `staff_roles.role=owner`,
  no `organization_members` row; `TENANT_OWNER` => `owner` / `owner` /
  `TENANT_OWNER`; `TENANT_SUPER_ADMIN` => `admin` / `owner` /
  `TENANT_SUPER_ADMIN`; `TENANT_ADMIN` => `admin` / `manager` /
  `TENANT_ADMIN`; `TENANT_MANAGER` => `staff` / `manager` /
  `TENANT_MANAGER`; `TENANT_MEMBER` => `user` / no `staff_roles` /
  `TENANT_MEMBER`.
- T-204 completion target: all 144 authorization check points consume
  `organization_members`; legacy columns are deprecated.
- Related missing/pasted artifact reference:
  `supabase/migrations/20260522_011_seed_role_hierarchy.sql`. Mark has only
  provided the path so far, not the SQL content. Do not fabricate it from the
  path alone.
- Decisions: SCREAMING_SNAKE_CASE adopted; `TENANT_SUPER_ADMIN` exists to
  distinguish tenant-wide authority from department-wide authority; existing
  2 `organization_members` rows migrated from `owner` to `TENANT_OWNER`; Zach
  assigned `TENANT_SUPER_ADMIN` of MAJH Events tenant, offered as executive
  role pending acceptance/decline.

## Last iteration
- **Iter 25** (2026-05-24): `lib/cold-start-service.ts` Supabase-relation-cardinality-mismatch fully closed. STATE.md recommended this file as the new TS2339 hotspot after iter 24. Pre-edit profile via `grep "cold-start-service" ralph-dev/tsc-errors-iter24-after.txt` confirmed 12 errors with uniform signature: `Property 'X' does not exist on type '{ id: any; gamertag: any; avatar_url: any; }[]'`. Single root cause: Supabase types the `player:players!player_media_player_id_fkey(id, gamertag, avatar_url)` join as an ARRAY but the runtime returns a single object (many-to-one FK relationship — each `player_media` has ONE `player`). Code accesses `.id`/`.gamertag`/`.avatar_url` directly; type-error but runtime-correct. Pre-edit verifications: (a) re-confirmed no established `Array.isArray(...)` or `as unknown as {...gamertag` pattern exists in the codebase (cleanest fix path is to establish one); (b) confirmed FK shape from the SQL join string indicates many-to-one (single FK column → single parent); (c) confirmed the iter-22 deferred pattern (`my-events/page.tsx:518` `tournament_rounds?.round_number`) is the same root cause — iter 25's recipe applies. Fix: 4 surgical Edits, one per `.map(c => ({...c, creator: {...}}))` block (trending L114, quality L147, diverse L182, random L216), each converting arrow-returning-object-literal to block-form with a typed local variable: `const player = c.player as unknown as { id: string; gamertag: string; avatar_url: string | null } | null`. JSX accessors changed `c.player?.X` → `player?.X` (same runtime semantics, type now correct). Considered and rejected alternatives: (i) `[0]` array-index access — would break at runtime since Supabase returns a single object, not an array; (ii) `as any` per access — discards typing; (iii) global helper `getPlayer(c)` — over-engineering for a single file. The local-variable `as unknown as` cast is the canonical recipe for "Supabase relation cardinality mismatch": minimal-diff, runtime-preserving, type-safe at the access. Zero behavior changes; pure type-level escape hatch. 12 errors eliminated, zero added. tsc count: 169 → 157. File fully clean. Post-fix capture at `ralph-dev/tsc-errors-iter25-after.txt`.
- **Iter 24** (2026-05-24): `tournament-controller.tsx` field-additions partial sweep. STATE.md iter-23 top recommendation was a repo-wide `createClient(cookieStore)` sweep — verified at iter-24 entry to be a no-op: `grep -rln "createClient(cookieStore)"` repo-wide returned 0 hits, and a careful loop over the 242 `@/lib/supabase/server` importers found zero non-awaited `= createClient()` patterns. Pivoted to STATE.md recommendation #2 (TS2339 hotspot exploration on `tournament-controller.tsx`). Profile: `grep "TS2339" ralph-dev/tsc-errors-iter23-after.txt | awk -F'(' '{print $1}' | sort | uniq -c | sort -rn | head` confirmed `components/tournaments/tournament-controller.tsx` at 14 TS2339 (top hotspot). Counting all error classes (per the iter-23 convention "don't filter by error code at hotspot entry"): 17 total errors in this file (14 × TS2339 + 3 × TS2345). Root-cause analysis revealed 3 distinct clusters: (A) discriminated-union narrowing on helper return types (5 × TS2339 at L612 `.message`, L617 `.playerName`, L858/L884 `.pairingsCount`, L1520 `.minutes` — function returns `{supabase, userId, role, error?} | {success, payload}` and callers access payload fields without narrowing); (B) `TournamentStatus` enum mismatch (3 × TS2345 at L773/L826 `"registration"`, L792 `"completed"` — closed set doesn't include these legacy status names); (C) missing fields on two manually-typed `matches` array prop interfaces (9 × TS2339: 6 × `is_feature_match` at L1606-1631 on `currentRound.matches[]` type, plus 1 × `draws` at L1846 + 2 × `dispute_reason` at L1877/L1879 on `allRounds[].matches[]` type). Picked Cluster C — single mechanical recipe (iter-22 "field additions to manually-typed prop interface") closes 9 errors. Pre-edit verifications: (a) `grep "is_feature_match|dispute_reason|\\bdraws\\b" scripts/*.sql` confirmed all three columns are REAL DB columns added in migration scripts 042/050/053 — no schema-drift warning needed (in contrast to iter-22's `reported_player1_draws`); (b) `grep -n "is_bye|table_number"` in the file revealed TWO distinct match interfaces (L167-177 `currentRound.matches`, smaller shape; L188-204 `allRounds[].matches`, fuller shape with `loser_id`/`reported_*`); (c) all JSX accessors confirmed safe under optional fields (`match.is_feature_match ? "default" : "ghost"`, `match.draws ?? 0`, `match.dispute_reason && (...)` — undefined gracefully handled in all 9 sites). First Edit (interface L188-204) added 3 fields and closed only 3 errors — the 6 `is_feature_match` errors at L1609-1634 were on the SECOND interface (L167-177). Diagnostic via the error message's "type {... no loser_id ...}" tell. Second Edit (interface L167-177) added `is_feature_match?` and closed the remaining 6. Two surgical Edits, both optional-field additions, no JSX changes. 9 errors eliminated, zero added. tsc count: 178 → 169. Post-fix capture at `ralph-dev/tsc-errors-iter24-after.txt`. Diff vs iter23-after: 9 lines deleted (the 9 closed errors), 8 lines updated (line-shift artifacts on the remaining 8 errors — line numbers shifted by +3 or +4 because of the 3-line and 1-line interface extensions). Zero NEW errors. Remaining 8 errors in the file (Clusters A + B) deferred to iter 25.
- **Iter 23** (2026-05-24): `lib/role-actions.ts` missing-await sweep. Profiled the TS2339 hotspot per iter-22 recommendation; STATE.md predicted `tournament-controller.tsx` (~30 errors) but the actual top file was `lib/role-actions.ts` (20 × TS2339 + 6 × TS2554 = 26 total errors, all in one file). Root cause was a single uniform legacy pattern across 6 server actions: each function opened with `const cookieStore = await cookies(); const supabase = createClient(cookieStore)`. After `lib/supabase/server.ts:10` was refactored to make `createClient()` async with zero parameters, every caller in this file was broken. The 20 TS2339s were from `supabase.auth`/`supabase.from` being called on the `Promise<SupabaseClient>` (no await); the 6 TS2554s were from passing `cookieStore` to a 0-arg function. Both error classes resolved by collapsing the 2-line pattern to `const supabase = await createClient()`. Pre-edit verifications: (a) read full `lib/supabase/server.ts` to confirm new signature (`async function createClient(): Promise<SupabaseClient>` with internal `await cookies()`); (b) grepped the file for `cookies`/`cookieStore` and confirmed 6 identical 2-line blocks, with no other usages — the `cookies` import becomes dead after the replacement. Two surgical edits: (1) single `replace_all` on the 2-line block → 1-line replacement (6 sites collapsed in one Edit), (2) removal of the now-unused `import { cookies } from 'next/headers'`. 26 errors eliminated, zero added. tsc count: 204 → 178. Post-fix capture at `ralph-dev/tsc-errors-iter23-after.txt`. Diff vs iter22-after: 26 lines deleted, 0 added — cleanest profile so far for a 26-error iter.
- **Iter 22** (2026-05-24): TS2551 mechanical batch — closed all 19 TS2551 errors plus 2 incidental TS2339. **Cluster A (10 errors: `.catch()` on Supabase PostgrestFilterBuilder):** `app/api/setup-carbardmv/route.ts:145, 148`; `lib/admin-actions.ts:148, 619`; `lib/content-moderation.ts:189`; `lib/media-actions.ts:220`; `lib/moderation-actions.ts:177, 216`; `lib/wallet-actions.ts:899`. Root cause: PostgrestFilterBuilder is a PromiseLike (has `.then`) not a Promise (no `.catch`). Mechanical fix: `.catch(handler)` → `.then(undefined, handler)`. Single-token replacement at each site, no restructuring, preserves the existing fallback semantics 1:1. Note: several of these sites' fallback bodies have a known runtime brokenness (e.g. `admin-actions.ts:148-161`, `wallet-actions.ts:899-917` — the fallback launches un-awaited Supabase calls that never resolve; Supabase RPC errors are returned in `{error}` not thrown anyway, so the fallback would never trigger). The TS fix preserves the current — broken — fallback verbatim; out of scope for this iter to refactor. Surface in FIXES_APPLIED.md as a runtime concern for a future iter. **Cluster B (6 errors: `match.player1_wins`/`match.player2_wins` in `app/dashboard/my-events/page.tsx`):** root cause was SELECT-column omission. The query at L27-37 selects only `id, tournament_id, status, result, player1_id, player2_id, winner_id, tournament_rounds(...)` but the render at L541-545 reads `player1_wins`, `player2_wins` (which exist as real columns on `tournament_matches` per the `tournament-controller.tsx` SELECT). Fix: added `player1_wins, player2_wins, is_bye` to the SELECT. Closed 6 × TS2551 plus 2 × TS2339 incidentally (`match.is_bye` at L522, L527 was the same root cause). The remaining TS2339 in this file (L518 `round_number` on the `tournament_rounds[]` array shape) is a different bug — the relation is being typed as an array when the code accesses it as an object. Out of scope, lives in iter-23+ queue. **Cluster C (4 errors: `match.reported_player1_draws`/`match.reported_player2_draws` in `components/tournaments/tournament-controller.tsx`):** root cause was missing fields on the prop interface for the `matches` array (at L188-201). The fields `reported_player1_wins`/`reported_player2_wins` exist on the interface but the `_draws` variants were missed. Both column names appear in `lib/tournament-controller-actions.ts:593, 637` (server-side writes) and in `scripts/050_match_confirmation_dispute.sql` comments only — the migration script does NOT create these columns in the SQL DDL. **PROBABLE SCHEMA DRIFT:** the columns may not exist in the DB at all (the actions would fail at runtime if so); only Mark/runtime testing can confirm. Fix: added `reported_player1_draws?: number | null` and `reported_player2_draws?: number | null` to the interface (optional, so parent doesn't need to thread them; the `?? 0` fallbacks in the JSX handle undefined gracefully). Surface as a runtime concern + needs a SQL migration audit if the columns don't actually exist. 3 surgical single-line edits + 8 surgical 1-token-replacement edits + 1 multi-line `.then(undefined, ...)` edit + 1 SELECT-extension edit = 13 edits total. 21 errors eliminated, zero added. tsc count: 225 → 204. Post-fix capture at `ralph-dev/tsc-errors-iter22-after.txt`. Diff vs iter21-after: 21 deletions + ~14 line-shift artifacts on tournament-controller.tsx (the interface addition shifted error line numbers downstream). Net 21 distinct errors closed.
- **Iter 21** (2026-05-24): api-response drift sweep on `app/api/v1/ticket-types/route.ts` — sixth application of the iter-13/14/15/17/20 recipe and **last dense v1 cluster file**. 12 errors in this file at iter-21 entry: 7 × TS2559 (status as 3rd positional arg on `apiError`: L11 401, L16 429, L24 400, L62 500, L70 401, L97 400, L140 500), 4 × TS2345 (legacy type names: L43 `"database_error"`, L74 `"permission_denied"`, L109 `"not_found"`, L134 `"database_error"`), 1 × TS2554 (L137: `apiSuccess(ticketType, {}, 201)` — 3rd positional arg disallowed). Canonical-name remap: `"database_error"` → `"internal_error"` (500, same status, no `code` needed since the legacy semantic is generic); `"permission_denied"` → `"authorization_error"` (403); `"not_found"` → `"resource_not_found"` (404). Dropped all 7 redundant 3rd-arg status codes (each matched the auto-derived `STATUS_CODES[type]`). Added `{ rateLimit: rateLimitResult }` to the L16 rate-limit-exceeded response — correctness improvement matching iters 13/14/15/17 (the legacy code passed a redundant 429 but emitted NO rate-limit headers; the rewrite restores `addRateLimitHeaders` emission of `Retry-After`/`X-RateLimit-*`). Rewrote L137 `apiSuccess(ticketType, {}, 201)` as `apiSuccess(ticketType, { status: 201 })` matching iter-14 pattern. Six surgical Edits, each targeting a distinct logical block. 12 errors eliminated, zero added. tsc count: 237 → 225. Post-fix capture at `ralph-dev/tsc-errors-iter21-after.txt`. Diff vs iter20-after: 12 lines deleted, 0 added — cleanest possible diff matching the iter-20 profile. **The entire dense v1 API cluster is now fully clean.**
- **Iter 20** (2026-05-24): api-response drift sweep on `app/api/v1/orders/[orderId]/refund/route.ts` — fifth application of the iter-13/14/15/17 recipe. 8 errors in this file at iter-20 entry: 4 × TS2559 (status as 3rd positional arg on `apiError`: L17 401, L54 400, L61 400, L109 500), 4 × TS2345 (legacy type names: L21 `"permission_denied"`, L50 `"not_found"`, L74 `"payment_error"`, L86 `"refund_error"`). STATE.md's iter-19 prediction had been 5 × TS2559 + 3 × TS2345 — actual was 4 + 4, but the recipe applied cleanly regardless. Canonical-name remap: `"permission_denied"` → `"authorization_error"` (403); `"not_found"` → `"resource_not_found"` (404); `"payment_error"` → `"internal_error"` (500, preserved via `{ code: "stripe_refund_failed" }`); `"refund_error"` → `"internal_error"` (500, preserved via `{ code: "refund_failed" }`). Dropped all 4 redundant 3rd-arg status codes (each matched the auto-derived `STATUS_CODES[type]`). Five surgical Edits: 1 for auth+permission block, 1 for not-found+refund-amount block, 1 for Stripe error, 1 for ledger error, 1 for catch-block. 8 errors eliminated, zero added. tsc count: 245 → 237. Post-fix capture at `ralph-dev/tsc-errors-iter20-after.txt`. Diff vs iter19-after: 8 lines deleted, 0 added — cleanest possible diff (no line-shift artifacts, no new errors). `refund/route.ts` now fully clean. Dense v1 API cluster status: all 5 originally-named files now clean (events/[eventId], tickets/purchase, tickets/check-in, events/route.ts, refund/route.ts), plus transactions/route.ts already clean. Only `ticket-types/route.ts` (~12 errors expected) remains as the last dense-cluster file.
- **Iter 19** (2026-05-24): Idempotency helper drift sweep across 2 caller files (`app/api/v1/tickets/purchase/route.ts` and `app/api/v1/orders/[orderId]/refund/route.ts`). Third caller (`app/api/v1/transactions/route.ts`) already used the canonical signatures — reference pattern. Pre-flight read of `lib/middleware/idempotency.ts` confirmed the iter-15 cache had errors: (a) `IdempotencyResult` shape is `{found: boolean, response?: {status, body}}` not `{cached, response}`; (b) `storeIdempotency` and `storeIdempotentResponse` both exist — the latter is an alias of the former (line 86). So callers can stay on whichever name they had; the issue was the arg signature, not the export name. Applied canonical-signature alignment to both files: `checkIdempotency(req, tenantId)` (was `checkIdempotency(tenantId, key)`), check via `cached.found && cached.response`, return body via `cached.response.body` with `cached.response.status`. Added `const startTime = Date.now()` at top of each `try` to feed `durationMs` to the 5-arg store. Rewrote `storeIdempotentResponse(tenantId, key, response)` (3 args) as `storeIdempotentResponse(req, tenantId, apiKeyId, {status, body}, Date.now() - startTime)` (5 args). Refund needed `NextResponse` added to its imports (was `import { NextRequest }` only) for the raw `NextResponse.json` fallback in the `Idempotent-Replayed` header response. One coupled fix in refund (L28 TS2353 `apiSuccess(cached, {"Idempotent-Replayed":"true"})` — api-response drift, not idempotency drift) collapsed naturally because the L26 fix changed `cached` from string to `IdempotencyResult` — the natural rewrite to raw `NextResponse.json` with the header closes the TS2353 as a side-effect. 6 errors eliminated total (5 idempotency + 1 coupled api-response). tsc count: 251 → 245. Post-fix capture at `ralph-dev/tsc-errors-iter19-after.txt`. Diff vs iter18-after: 8 added lines = the 8 surviving refund errors with shifted line numbers (+4 from the import + startTime line additions). Same errors, new line numbers — zero NEW errors introduced. Repo-wide grep `checkIdempotency\|storeIdempotency\|storeIdempotentResponse` confirms 3 callers exist, all 3 now canonical. `purchase/route.ts` is now fully clean (zero errors). `refund/route.ts` has 8 remaining api-response drift errors (iter-13/14/15/17 recipe target for iter 20).
- **Iter 18** (2026-05-24): Stripe drift cross-file sweep. Applied iter-11 recipe to the 2 remaining files surfaced after the iter-11 pass: `app/api/v1/tickets/purchase/route.ts:7-11` and `app/api/v1/orders/[orderId]/refund/route.ts:6-10`. Both had `import Stripe from "stripe"` + `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" })`. Replaced with `import { stripe } from "@/lib/stripe"` (the canonical singleton). Pre-edit greps confirmed: (a) zero `Stripe.` type-namespace refs in either file (only `stripe.checkout.sessions.create` in purchase L127 and `stripe.refunds.create` in refund L67 — both instance method calls), so the `Stripe` type import is fully unused; (b) only 2 sites repo-wide had the drifted apiVersion (the iter-14 finding was correct — iter-11's TRIAGE list was incomplete). Two surgical 6-line-deletion Edits (5 lines of code + 1 blank line each). 2 errors eliminated (both `TS2322: Type '"2024-12-18.acacia"' is not assignable to type '"2025-02-24.acacia"'`). tsc count: 253 → 251. Post-fix grep `apiVersion: "2024-12-18.acacia"` repo-wide → empty. TRIAGE §2c fully closed. Diff vs iter17-after: 12 lines deleted (2 errors + 10 line-shift artifacts from the 4-line removal in each file shifting subsequent error line numbers — refund had 11→10 errors at new line numbers, purchase had 4→3 errors at new line numbers), 10 lines added (the shifted errors). Net: 2 distinct errors eliminated. Post-fix capture at `ralph-dev/tsc-errors-iter18-after.txt`.
- **Iter 17** (2026-05-24): Applied the iter-13/14/15 caller-alignment recipe to `app/api/v1/events/route.ts` — fourth of five dense v1 cluster files. Root cause profile: 7 × TS2559 (status as 3rd positional arg on `apiError`), 3 × TS2345 (legacy type names: `database_error` ×2, `permission_denied`, `duplicate_error`), 2 × TS2554 (line 18: `apiError` with 4 args including manual headers bag; line 170: `apiSuccess(event, {}, 201)`), 1 × TS2353 (line 77: `apiSuccess` with `X-RateLimit-*` keys not in options shape). Canonical-name remap applied: `"database_error"` → `"internal_error"` (500, same status); `"permission_denied"` → `"authorization_error"` (403, same status); `"duplicate_error"` → `"idempotency_error"` (409, same status — the only canonical type with 409). Preserved the legacy semantic for `duplicate_error` via `{ code: "duplicate_slug" }` (matching iter-15's `code` preservation pattern). Two correctness improvements smuggled in: (a) lines 18 and 99 (GET and POST rate-limit-exceeded responses) had manual `X-RateLimit-*` headers bags / no rate-limit at all on the response — rewrote both as `{ rateLimit: rateLimitResult }` so `addRateLimitHeaders` emits the canonical headers including `Retry-After`. (b) Line 77 (GET success response) was passing the same manual headers bag to `apiSuccess` — rewrote as `{ rateLimit: rateLimitResult }` for the same reason. These are real behavior fixes: the legacy code was passing arbitrary header keys into the `apiError`/`apiSuccess` options shape, which the helper silently dropped (TS would error, but TS errors don't run at runtime — these calls were emitting NO rate-limit headers at all). 13 errors eliminated, zero new errors. tsc count: 266 → 253. Post-fix capture at `ralph-dev/tsc-errors-iter17-after.txt`. Diff vs iter16-after: 13 lines deleted, 0 added — surgical, matches the iter-7/iter-8/iter-11/iter-12/iter-13/iter-14 pattern.
- **Iter 16** (2026-05-24): Cross-file root-cause sweep for `ApiAuthResult.user_id` shape drift. 4 errors total across 2 files (3 in `app/api/v1/tickets/check-in/route.ts` at lines 38/50/117, 1 in `app/api/v1/events/route.ts:158`). Chose **Option B** (extend the type) over **Option A** (remove the field from callers). Reason: the developer comment at `events/route.ts:158` ("Use tenant owner if no user") makes the intent explicit — `user_id` is meant to be optional context when an API key is associated with a specific user. `lib/middleware/api-auth.ts:3-10` defined `ApiAuthResult` with only 5 fields; the success branch (line 72-78) constructed a return object that dropped any `user_id` the RPC might be returning. Without Supabase access we can't directly confirm `validate_api_key` returns `user_id`, but: (a) all 4 caller sites have fallbacks (`performed_by || authResult.user_id`, `authResult.user_id || authResult.tenant_id`) so a runtime `undefined` is gracefully handled, AND (b) if the RPC IS returning `user_id`, this fix silently restores a feature the legacy code was silently dropping. Two surgical edits: (1) added `user_id?: string` to the interface; (2) added `user_id: data.user_id` to the success return. Zero changes to error branches (optional field, so `valid: false` paths are unaffected). Zero changes to callers (their `|| fallback` patterns continue to work). 4 errors eliminated, zero new errors. tsc count: 270 → 266. Post-fix capture at `ralph-dev/tsc-errors-iter16-after.txt`. Diff vs iter15-after: 4 lines deleted, 0 added — most surgical iter so far.
- **Iter 15** (2026-05-24): Applied the iter-13/14 caller-alignment recipe to `app/api/v1/tickets/check-in/route.ts` — third of five dense v1 cluster files. Root cause profile: 8 × TS2559 (status as 3rd positional arg on `apiError`), 4 × TS2345 (legacy type names: `permission_denied` ×2, `database_error` ×2), 1 × TS2554 (line 61: `apiError("check_in_failed", msg, 400, {}, { checked_in_at })` — 5 args; helper expects 2-3). Pre-flight read of `lib/middleware/idempotency.ts` confirmed the canonical signatures (`checkIdempotency(req, tenantId)` returns `IdempotencyResult`; `storeIdempotency(req, tenantId, apiKeyId, response, durationMs)`) — but check-in/route.ts uses neither, so the pre-flight didn't apply to this file (will pay off in iter 16+ for `purchase`, `refund`, `transactions`). Canonical-name remap applied: `"permission_denied"` → `"authorization_error"` (403); `"database_error"` → `"internal_error"` (500); `"check_in_failed"` → `"invalid_request"` (400, with `code: "check_in_failed"` preserved on the response). Dropped all 8 redundant 3rd-arg status codes. Added `{ rateLimit: rateLimitResult }` to the rate-limit-exceeded response (correctness improvement matching iters 13/14). For the line 61 metadata bag (`{ checked_in_at: result?.checked_in_at }`) — which the helper has no slot for — dropped to raw `NextResponse.json` matching the iter-14 helper-fallback pattern, but extended the error body with a `code` field (semantic preservation) AND the `checked_in_at` field (developer-intent preservation). The legacy code was emitting NEITHER at runtime (helper silently dropped both — was returning HTTP 200 with `{error:{type:"check_in_failed",message:...}}` because `STATUS_CODES["check_in_failed"]` was undefined). This is a behavior FIX, not just a type fix. 13 errors eliminated, zero new errors. tsc count: 283 → 270. Post-fix capture at `ralph-dev/tsc-errors-iter15-after.txt`. Diff vs iter14-after: 14 lines deleted, 1 added (the deleted+re-added line is the `user_id` TS2339 at line 109 shifting to line 117 — same error, different line because raw `NextResponse.json` block added lines).
- **Iter 14** (2026-05-24): Applied the iter-13 caller-alignment recipe to `app/api/v1/tickets/purchase/route.ts` — second of five dense v1 cluster files. Same root cause profile: callers passed status as a redundant 3rd positional arg (TS2559 × 7), used legacy type names not in `ApiErrorType` (TS2345 × 4), and one `apiSuccess(cached, { "Idempotent-Replayed": "true" })` site with a headers bag that the helper silently ignored (TS2353). Two `apiSuccess(response, {}, 201)` sites also had wrong arg shape (TS2554 × 2 — `apiSuccess` expects `(data, options?)`, not `(data, headers, status)`). Applied canonical-name remap (`"permission_denied"` → `"authorization_error"`, `"not_found"` → `"resource_not_found"`, `"inventory_error"` → `"invalid_request"` (both 400), `"order_error"` → `"invalid_request"` (both 400)); dropped all 3rd-arg status codes; rewrote both `apiSuccess(_, {}, 201)` as `apiSuccess(_, { status: 201 })`; added `{ rateLimit: rateLimitResult }` to the rate-limit-exceeded response (correctness improvement matching iter 13). The `Idempotent-Replayed` header site had **no equivalent option** on the helper, so I dropped to raw `NextResponse.json(cached, { headers: { "Idempotent-Replayed": "true" } })` for that one site — a caller-level workaround that preserves the legacy developer intent without extending the helper contract. 12 errors eliminated, zero new errors. tsc count: 295 → 283. Post-fix capture at `ralph-dev/tsc-errors-iter14-after.txt`. Diff vs iter13-after: 12 lines deleted, 0 added — surgical, matches the iter-7/iter-8/iter-11/iter-12/iter-13 pattern.
- **Iter 13** (2026-05-24): Started the v1 API cluster cleanup by aligning callers to the canonical `apiError`/`apiSuccess` helper signatures in `lib/middleware/api-response.ts`. 15 errors eliminated in `app/api/v1/events/[eventId]/route.ts`. tsc count: 310 → 295.
- **Iter 12** (2026-05-24): Closed the `app/(dashboard)/notifications/page.tsx` `tournament_registration` Record gap. 3 × TS2741 eliminated. tsc count: 313 → 310.
- **Iter 11** (2026-05-24): Closed TRIAGE §2c (Stripe `apiVersion` literal drift) for three route handlers. 3 × TS2322 eliminated. tsc count: 316 → 313.
- **Iter 10** (2026-05-24): Closed TRIAGE §3 broken import #4 — `components/player/player-controller.tsx` `playerId` prop thread-through. 4 × TS2304. tsc count: 320 → 316. Flipped ACCEPTANCE Phase 3 "All broken imports resolved".
- **Iter 9** (2026-05-24): Deleted dead `lib/supabase/introspections.ts`. tsc count: 329 → 320.
- **Iter 8** (2026-05-24): Fixed `lib/refund-actions.ts` import. tsc count: 330 → 329.
- **Iter 7** (2026-05-24): Fixed `components/providers/analytics-provider.tsx` import. tsc count: 331 → 330.
- **Iter 6** (2026-05-24): Wrote `.env.example`. Phase 2 complete.
- **Iter 5** (2026-05-24): Removed `app/api/access/core access/` directory (Phase 2 bug #4).
- **Iter 4** (2026-05-24): Wrote `scripts/139_stream_sources_admin_rls.sql`.
- **Iter 3** (2026-05-24): Wrote `scripts/138_vod_rls_ended_streams.sql`.
- **Iter 2** (2026-05-24): Wrote `scripts/137_add_mux_playback_id.sql`.
- **Iter 1** (2026-05-24): Produced `ralph-dev/TRIAGE.md`, `ralph-dev/ENV.md`, `ralph-dev/tsc-errors.txt`.

## What's next
Iter 26 — iter 25 closed all 12 TS2339 errors in `lib/cold-start-service.ts` via 4 local-variable `as unknown as` casts (Supabase relation-cardinality-mismatch recipe established). 157 errors remain. Post-iter-25 distribution: TS2339 = 63 (was 75 — iter 25 closed 12), TS2322 = 23, TS2345 = 14, TS2559 = 12, TS7031 = 11, TS7006 = 7, TS18047 = 6, TS2367 = 4, TS2554 = 3, TS2741/TS2678/TS2352/TS18048/TS1378 = 2 each, TS2774/TS2353/TS18049/TS18046 = 1 each. Total 157.

Post-iter-25 TS2339 hotspot distribution:
- `lib/revenue-splits-service.ts` — 9 errors (new top hotspot)
- `app/dashboard/player-controller/page.tsx` — 7 errors
- `components/financial/usage-billing-dashboard.tsx` — 6 errors
- `components/tournaments/tournament-controller.tsx` — 5 (Clusters A + B from iter 24)
- `lib/auto-clip-service.ts` — 4, `components/dashboard/sidebar.tsx` — 4
- (then 3-error files: `lib/tournament-payment-actions.ts`, `lib/highlight-detection.ts`, `lib/engagement-triggers.ts`)

Candidates:

1. **(Recommended — `lib/revenue-splits-service.ts` TS2339 hotspot, 9 errors)** New top hotspot. Pre-iter profile required to determine root cause. Likely candidates: (a) Supabase relation-cardinality-mismatch (iter-25 recipe applies — `as unknown as` local-variable cast); (b) prop-interface field drift (iter-22/iter-24 recipe — field additions to manually-typed interfaces); (c) SELECT-column omission (iter-22 recipe — extend SELECT); (d) some other class-specific drift. Profile: `grep "TS2339" ralph-dev/tsc-errors-iter25-after.txt | grep revenue-splits-service`. Then read the first error site to identify root cause. If it's the iter-25 recipe, this could be very fast (1-3 surgical edits).

2. **(TS2345 sweep — `tournament-controller.tsx` Cluster B, 3 errors)** L773/L792/L826 `"registration"`/`"completed"` not assignable to `TournamentStatus`. Read the type definition first. The `STATUS_COLORS` map at L218-226 already includes `registration: ...` and `complete: ...` (note: "complete" not "completed" — L792 may be a typo that needs a different fix). Likely fix: extend the `TournamentStatus` enum if these are valid legacy status names that should be supported. Small batch but instructive.

3. **(`app/dashboard/player-controller/page.tsx` TS2339 hotspot, 7 errors)** Second hotspot after revenue-splits. Could be the same Supabase relation pattern, prop drift, or SELECT omission. Profile first.

4. **(Cluster A in `tournament-controller.tsx`, 5 errors — discriminated union narrowing)** Errors at L612 `.message`, L617 `.playerName`, L858/L884 `.pairingsCount`, L1520 `.minutes`. Function returns `{supabase, userId, role, error?} | {success, payload}`. Likely fix: type guard via `if ('error' in result)` or `if (result.success)` to narrow. Read the helper function first to see the best discriminator. More involved than mechanical interface fixes.

5. **(`components/financial/usage-billing-dashboard.tsx`, 6 errors)** Third hotspot. Profile first.

6. **(TS2322 cluster, 23 errors)** Spread across many files. Often resolved by adding union members or casting. Profile first to find concentrated files.

7. **(TS7031 / TS7006 / TS18047 implicit-any and null guards, 24 errors combined)** Mechanical batch. Adding type annotations on lambda params, null guards before access.

8. **(TS2559 cluster, 12 errors)** May be more api-response drift in non-v1 routes — same recipe as iters 13-21. Profile by file first.

Strong recommendation for iter 26: **(1) `lib/revenue-splits-service.ts` TS2339 hotspot**. After iter-25 established the Supabase-relation-cardinality-mismatch recipe (`as unknown as` local-variable cast in `.map` block-form), the next iter should test whether that recipe applies again. If yes, fast 1-3 surgical edits close 5-9 errors. If no, identify the actual root cause and apply the matching recipe.

Pre-iter-26 housekeeping:
- `grep "TS2339" ralph-dev/tsc-errors-iter25-after.txt | grep revenue-splits-service` — see what root cause dominates.
- Read `lib/revenue-splits-service.ts` opener + a couple of error sites to confirm root cause before committing to the iter.
- If revenue-splits is a different root cause (union-narrowing, cross-file shape drift, missing methods), pivot to candidate #2 (3-error `TournamentStatus` enum fix — small, instructive, unblocks tournament-controller Cluster B for iter 27).

Iter-22 / iter-24 / iter-25 conventions reinforced: when a hotspot file has multiple distinct root-cause clusters, pick the largest single-recipe cluster, close it, and tag remaining clusters for the next iter. The Supabase-relation-cardinality-mismatch recipe is now ESTABLISHED — apply it whenever a TS2339 error has signature `Property 'X' does not exist on type '{...}[]'` AND the code accesses `.X` directly (not via `[0]`).

Tally (post-iter-25): TS2339 = 63 (hotspot, dropped from 75), TS2322 = 23, TS2345 = 14, TS2559 = 12, TS7031 = 11, TS7006 = 7, TS18047 = 6, TS2367 = 4, TS2554 = 3, TS2741 = 2, TS2678 = 2, TS2352 = 2, TS18048 = 2, TS1378 = 2, TS2774/TS2353/TS18049/TS18046 = 1 each. Total 157. TS2551 = 0 (fully closed). Stripe apiVersion drift fully closed. Idempotency helper drift fully closed. `ApiAuthResult.user_id` drift fully closed. All dense v1 cluster files fully clean. `lib/role-actions.ts` fully clean (iter 23). `createClient(cookieStore)` legacy drift verified clean repo-wide (iter 24). `lib/cold-start-service.ts` fully clean (iter 25).

## Iter 25 fix detail (this iter)
**Action:** Four surgical Edits to `lib/cold-start-service.ts`, one per `.map(c => ({...c, creator: {...}}))` block (trending L114, quality L147, diverse L182, random L216). Each Edit converted the arrow function returning an object literal to block form with a typed local variable: `const player = c.player as unknown as { id: string; gamertag: string; avatar_url: string | null } | null`. The JSX accessors then read `player?.id`/`player?.gamertag`/`player?.avatar_url` instead of `c.player?.id`/etc. — semantically identical at runtime, type-correct under the cast.

**Root cause:** The Supabase join `player:players!player_media_player_id_fkey(id, gamertag, avatar_url)` is a many-to-one foreign key relationship (each `player_media` row has ONE parent `player`). At runtime, modern PostgREST/Supabase returns a single object (or null) for many-to-one joins. The TypeScript types — auto-generated or inferred from the SDK's generic select shape — instead model the join as an ARRAY: `{ id: any; gamertag: any; avatar_url: any; }[]`. The code accesses `.id`/`.gamertag`/`.avatar_url` directly on this "array" type, triggering 12 × TS2339 errors. The code is correct at runtime; only the type is wrong.

**Diagnosis:**
- 12 errors total, all in `lib/cold-start-service.ts`, all TS2339 with identical signature `Property 'X' does not exist on type '{ id: any; gamertag: any; avatar_url: any; }[]'`.
- 4 sites (one per feed strategy block: trending/quality/diverse/random), each with 3 errors (one per accessed field: `id`/`gamertag`/`avatar_url`).
- Same root cause as the iter-22 deferred pattern in `app/dashboard/my-events/page.tsx:518` (`match.tournament_rounds?.round_number` typed as array but accessed as object).

**Choices made:**
- **Used local-variable `as unknown as` cast, not inline cast per access.** 4 sites × 3 access points = 12 inline casts, OR 4 local-variable extractions = 4 casts. Local-variable is cleaner (single cast per `.map` block, repeated 4 times in the file).
- **Used `as unknown as` (two-step) cast, not direct `as`.** Direct `as { id: string; ... } | null` doesn't compile because TS doesn't see a clear conversion path from the array type to the object type. `as unknown as` is the canonical TS escape hatch for "I know better than the type system."
- **Rejected `[0]` array-index access.** Would compile (matches the array type) but break at runtime: Supabase returns a single object for many-to-one joins, not an array, so `obj?.[0]?.id` returns `undefined`.
- **Rejected `as any` per access.** Discards typing entirely; less safe than the typed cast.
- **Rejected adding a global helper (`getPlayer(c)` with `Array.isArray` normalization).** Over-engineering for a single file's pattern. iter rule: "Don't add features, refactor, or introduce abstractions beyond what the task requires."
- **Used block-form `.map(c => { ... return {...} })` instead of arrow-returning-object-literal.** Required for the local-variable extraction. Minimal change to surface area; runtime behavior is identical.
- **Used `string` types in the cast, not `any`.** Even though the Supabase auto-typed shape uses `any` for the join fields, the actual runtime values are strings (from a Postgres `text` column). Tighter typing helps downstream consumers.

**Pre-edit verifications:**
- `grep "cold-start-service" ralph-dev/tsc-errors-iter24-after.txt` → 12 errors, all TS2339 with identical signature.
- Read full `lib/cold-start-service.ts` (329 lines). Confirmed 4 `.map` blocks at L114, L147, L182, L216, all using `c.player?.X` access pattern.
- `grep -rn "as unknown as.*\\{.*id.*gamertag"` repo-wide → zero hits. No established pattern; iter 25 establishes the canonical recipe.
- `grep -rn "Array\\.isArray.*\\?.*\\[0\\]"` repo-wide → zero hits. No established normalization pattern either. Confirms the codebase has not yet faced this issue at scale.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 157 (was 169). Exactly 12 errors eliminated, zero added.
- `grep "cold-start-service" ralph-dev/tsc-errors-iter25-after.txt | wc -l` → 0. **File fully clean.**
- `grep -oP "error TS\\d+" ralph-dev/tsc-errors-iter25-after.txt | sort | uniq -c | sort -rn` → confirmed TS2339 = 63 (down from 75; exactly 12 closed).

**Out of scope deliberately:**
- The iter-22 deferred pattern in `my-events/page.tsx:518` (`tournament_rounds?.round_number`). Same root cause, but not in the cold-start-service hotspot. iter-26+ can apply the now-established recipe.
- Other potential Supabase relation-cardinality drift sites repo-wide. Profile via `grep -rn "Property.*does not exist on type.*\\[\\]"` in future tsc captures.
- 63 remaining TS2339 errors. Iter-26+ via hotspot-by-hotspot recipe application.
- 23 TS2322 errors. Later iter.

**Acceptance flipped:** None directly. Phase 3 aggregate boxes; 157 errors still to go.

**Learned:**
- **iter 25 convention — Supabase relation-cardinality-mismatch is a recurring TS2339 root cause; the recipe is now ESTABLISHED.** When a TS2339 error has signature `Property 'X' does not exist on type '{ ... }[]'` AND the code accesses `.X` directly (not `[0].X`), the root cause is many-to-one FK join typed as array by Supabase. Apply the local-variable `as unknown as` cast in block-form `.map`. Recipe: `const X = c.X as unknown as { ... } | null` then access `X?.X`. This pattern WILL recur — apply it at every TS2339-on-relation-shape site.
- **iter 25 convention — when no in-repo pattern exists for a recurring drift, iter 25 establishes the canonical pattern via the first surgical fix.** Future iters can grep for `as unknown as.*\\{.*id` to find established patterns. Single-file iter 25 also doubles as recipe-establishment work for future iters.
- **iter 25 convention — many-to-one FK joins return single objects at runtime; the array-shaped TS types are wrong.** Don't be fooled by the `[]` suffix in the error message — the runtime is a single object. Cast accordingly; never `[0]` access.
- **iter 25 convention — block-form `.map(c => { ... return {...} })` is the minimum-overhead way to extract a typed local variable from an inline arrow-returning-object-literal.** When you need to cast a property once for many accesses inside a `.map`, convert the arrow to block form. Single line added per block (`const X = c.X as ...`); runtime behavior unchanged.

## Iter 24 fix detail (previous iter)
**Action:** Two surgical Edits to `components/tournaments/tournament-controller.tsx`. (1) Extended the `allRounds[].matches` interface at L188-204 by adding three optional fields (`draws?: number | null`, `is_feature_match?: boolean | null`, `dispute_reason?: string | null`) immediately before the `player1`/`player2` lines. (2) Extended the `currentRound.matches` interface at L167-177 by adding `is_feature_match?: boolean | null` immediately before the `player1`/`player2` lines.

**Root cause:** The file had two distinct manually-typed `matches` array prop interfaces. Both were missing `is_feature_match` (referenced in JSX at L1606-1631 on `currentRound.matches[]`). The `allRounds[].matches` interface was also missing `draws` (L1846) and `dispute_reason` (L1877/L1879). All three columns are real DB columns:
- `draws` — `scripts/042_add_match_result_columns.sql:10` (`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS draws INTEGER DEFAULT 0`)
- `dispute_reason` — `scripts/050_match_confirmation_dispute.sql:5` (`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS dispute_reason TEXT`)
- `is_feature_match` — `scripts/053_feature_match_streaming.sql:6` (`ADD COLUMN IF NOT EXISTS is_feature_match BOOLEAN DEFAULT false`)

Since `lib/tournament-controller-actions.ts:getAllTournamentRounds` does `select("*")`, all three fields are returned at runtime — but the manually-typed prop interfaces never declared them. Same pattern as the iter-22 `reported_player1_draws`/`reported_player2_draws` fix (which exposed schema drift, since those columns had NO migration). This iter, the columns ARE in migrations, so no schema-drift warning is needed.

**Diagnosis:**
- 17 errors total in this file at iter-24 entry: 14 × TS2339 + 3 × TS2345 (counting all error classes, per the iter-23 convention "don't filter by error code at hotspot entry").
- Three distinct root-cause clusters identified by reading the error messages:
  - **Cluster A** (5 × TS2339, discriminated-union narrowing): L612 `.message`, L617 `.playerName`, L858/L884 `.pairingsCount`, L1520 `.minutes`. Function returns `{supabase, userId, role, error?} | {success, payload-field}` and callers access payload fields without narrowing. Requires reading helper definitions to design a type-guard.
  - **Cluster B** (3 × TS2345, enum mismatch): L773/L826 `"registration"`, L792 `"completed"` not in `TournamentStatus`. Requires reading the type definition.
  - **Cluster C** (9 × TS2339, missing fields): the 6 × `is_feature_match` errors at L1606-1631, 1 × `draws` at L1846, 2 × `dispute_reason` at L1877/L1879. Single-recipe mechanical fix (iter-22 "field additions to manually-typed prop interface").
- Picked Cluster C as the iter target: largest single-recipe cluster (9 errors), zero design ambiguity, fully mechanical.

**Choices made:**
- **Used optional fields, not required.** Matches the iter-22 convention. The parent action does `select("*")` so fields are present at runtime, but optional + safe-access JSX patterns (`?? 0`, `match.x && ...`) handle the type-side as if they could be undefined. Required fields would force the parent to declare them explicitly, which would cascade more errors.
- **Made `is_feature_match` nullable** (`boolean | null` instead of `boolean`). DB column has `DEFAULT false` but the row could theoretically be inserted with NULL (no NOT NULL constraint in the migration). The `?` makes the prop-side optional; `| null` covers the runtime case.
- **Did NOT add `loser_id`, `reported_player1_wins`, etc. to the `currentRound.matches` interface.** The two interfaces are intentionally different shapes — `currentRound.matches` is for active-round display (no reported_* needed), `allRounds[].matches` is for the history view (needs reported_* for dispute UI). Only added what was actually referenced in the JSX for each.
- **Did NOT do Clusters A or B in this iter.** Per "one root cause per iter," Cluster C closes via a single mechanical recipe; Clusters A and B require reading additional source (`TournamentStatus` enum, helper return-type functions). Surfaced as iter-25 candidates.
- **Made the JSX completely unmodified.** All 9 callers already used safe access patterns; no JSX changes were needed to make the iter complete.

**Pre-edit verifications:**
- Read full L160-216 (both interface definitions side-by-side).
- Read L1840-1890 (the `match.draws`/`match.dispute_reason` context — confirmed `?? 0` and `&& (...)` safe-access patterns).
- `grep -n "is_feature_match|dispute_reason|\\bdraws\\b" scripts/*.sql` — confirmed all 3 columns in real migration files.
- `grep -n "is_bye|table_number" components/tournaments/tournament-controller.tsx` — confirmed TWO interface declarations (L169 vs L190), keying the dual-fix discovery.
- After first Edit (allRounds interface), re-ran tsc — saw the 6 × is_feature_match errors persist with a smaller type signature in the error message ("no loser_id" tell). Pivoted to find the second interface.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 169 (was 178). Exactly 9 errors eliminated, zero added.
- `grep "tournament-controller.tsx" ralph-dev/tsc-errors-iter24-after.txt | wc -l` → 8 (was 17 — 9 closed, 8 remaining, all in Clusters A + B).
- `diff ralph-dev/tsc-errors-iter23-after.txt ralph-dev/tsc-errors-iter24-after.txt` → 9 lines deleted (the closed errors), 8 lines updated (line-shift artifacts: remaining errors shifted by +3 or +4 because of the 3-line + 1-line interface extensions). Zero NEW errors.

**Out of scope deliberately:**
- Cluster A (5 errors, discriminated-union narrowing). Iter-25 candidate #4. Needs reading helper functions to design a clean type-guard.
- Cluster B (3 errors, `TournamentStatus` enum mismatch). Iter-25 candidate #2. Likely 1-3 line fix once the enum definition is read.
- The new top hotspot `lib/cold-start-service.ts` (12 errors). Iter-25 recommended target.
- The 23 TS2322 errors, the 24 TS7031/TS7006/TS18047 implicit-any/null errors, the 12 TS2559 errors. Deferred to iters 26+.

**Acceptance flipped:** None directly. Phase 3 aggregate boxes; 169 errors still to go.

**Learned:**
- **iter 24 convention — verify cross-file sweep recommendations at iter entry; STATE.md predictions can be wrong.** The iter-23 top recommendation was a repo-wide `createClient(cookieStore)` sweep. Verified at iter-24 entry: 0 hits via `grep -rln "createClient(cookieStore)"`, and 0 non-awaited `= createClient()` calls in 242 `@/lib/supabase/server` importers. The legacy pattern was self-contained to `lib/role-actions.ts`. Generalization: when a previous iter speculates about cross-file scope, ALWAYS run the verification grep before committing time to the sweep. The grep is seconds; the wrong assumption is an iter.
- **iter 24 convention — multiple manually-typed interfaces for the same shape are common; both need extension.** The `currentRound.matches[]` interface (L167-177) and `allRounds[].matches[]` interface (L188-204) were two separate prop-type declarations covering the same underlying `tournament_matches` table. The first Edit closed only 3 of 9 errors because 6 errors were on the second interface. Generalization: when adding fields to a manually-typed prop interface, grep the file for ALL similar interface declarations with the same root shape (here: both started with `is_bye: boolean` and contained `player1: {...} | null`). Use the error-message's type-signature ("the type has no loser_id" vs "the type HAS loser_id") to distinguish multiple shapes from a single shape.
- **iter 24 convention — confirm columns exist before assuming schema drift.** Iter-22 surfaced `reported_player1_draws`/`reported_player2_draws` as schema-drift warnings (no migration found). Iter-24's three fields (`draws`, `dispute_reason`, `is_feature_match`) all have explicit migrations in `scripts/042_*.sql`, `scripts/050_*.sql`, `scripts/053_*.sql`. The grep for `scripts/*.sql` references is cheap and resolves the schema-drift question in seconds. Generalization: when extending a manually-typed prop interface with a real-looking column name, ALWAYS check `scripts/*.sql` for `ADD COLUMN.*<name>` before deciding whether to surface a drift warning.
- **iter 24 convention — counting all error classes at hotspot entry is load-bearing.** The TS2339-only grep returned 14 errors for tournament-controller; counting all classes returned 17 (the 3 TS2345 errors at L773/L792/L826 were excluded from the awk filter). Generalization carried from iter 23 — but iter 24 confirms: when picking a hotspot, run `grep "<file>" ralph-dev/tsc-errors-*.txt | wc -l` for the total. The TS2339 filter understates the iter's leverage.

## Iter 23 fix detail (previous iter)
**Action:** Two surgical Edits to `lib/role-actions.ts`. (1) `replace_all` on the 2-line block `const cookieStore = await cookies()\n  const supabase = createClient(cookieStore)` → 1-line `const supabase = await createClient()`, collapsing 6 identical occurrences in one Edit. (2) Removed the now-unused `import { cookies } from 'next/headers'` line.

**Root cause:** `lib/supabase/server.ts:10` defines `createClient()` as `async function createClient()` with zero parameters (reads cookies internally via `await cookies()`). But the 6 server actions in `role-actions.ts` were written against an older synchronous, 1-param signature (`createClient(cookieStore)`). Every site triggered TWO error classes simultaneously: TS2554 (arg-count mismatch, 1 vs 0) at the call site itself, and TS2339 (`auth`/`from` not on `Promise<SupabaseClient>`) at every downstream use because the un-awaited promise was being chained.

**Diagnosis:**
- 26 errors total in `lib/role-actions.ts` at iter-23 entry: 20 × TS2339 + 6 × TS2554.
- Both error classes have the same root cause (the call-site bug), so fixing the call site closes both simultaneously.
- All 6 functions in the file use the identical 2-line preamble — confirmed via `grep "createClient\|cookieStore"` returning exactly 6 pairs at lines (7,8), (59,60), (80,81), (97,98), (158,159), (200,201).
- No other usages of `cookies` in the file — the import becomes dead after the replacement.

**Choices made:**
- **Used a single `replace_all` Edit for all 6 sites.** The 2-line legacy block is byte-identical across all 6 occurrences (same indentation, same names), so `replace_all` is safe AND minimum-diff. iter 14 noted that `replace_all` is "not 100% reliable" — but in iter 14 the issue was a substring match. Here the 2-line block is a complete logical unit; the failure mode doesn't apply.
- **Removed the `cookies` import** rather than leaving it as a dead import. iter-9 convention says to delete unused imports; the import existed only to satisfy the legacy pattern.
- **Did NOT touch `lib/supabase/server.ts`.** The new async signature is correct and load-bearing (Next.js 15+ requires `await cookies()`). Callers are the ones that need to migrate.
- **Did NOT search the rest of the repo for the same drift in this iter.** Per "one root cause per iter," fixed only the surfaced file. But surfaced the cross-file sweep as the top iter-24 recommendation — the pattern is almost certainly repo-wide, and the iter-23 recipe applies verbatim.

**Pre-edit verifications:**
- Read full `lib/supabase/server.ts` (66 lines). Confirmed `createClient` is `async` with zero params; reads cookies via `await cookies()` internally; returns `SupabaseClient` (wrapped in Promise by async semantics).
- Read first 50 lines of `lib/role-actions.ts` to confirm the legacy 2-line pattern.
- `grep "createClient\|cookieStore\|cookies"` in the file → confirmed 6 identical 2-line blocks, 1 `cookies` import line, no other usages.
- Confirmed all 26 errors in this file are this single root cause (no off-pattern errors lurking).

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 178 (was 204). Exactly 26 errors eliminated, zero added.
- `grep "lib/role-actions.ts" ralph-dev/tsc-errors-iter23-after.txt | wc -l` → 0. **File fully clean.**
- `diff ralph-dev/tsc-errors-iter22-after.txt ralph-dev/tsc-errors-iter23-after.txt` → 26 lines deleted (all from role-actions.ts), 0 added. Cleanest possible diff profile.

**Out of scope deliberately:**
- The cross-file sweep for the same `createClient(cookieStore)` drift in other files. Iter-24 top recommendation. Profile commands provided in "What's next."
- 84 TS2339 errors. Iter-24+ once the missing-await sweep is done (since the sweep will likely shrink this count further before tournament-controller is touched).
- 23 TS2322 errors. Later iter.

**Acceptance flipped:** None directly. `lib/role-actions.ts` now fully clean. Phase 3 aggregate boxes still pending; 178 errors still to go.

**Learned:**
- **iter 23 convention — coupled error classes from a single root cause close together.** The 20 TS2339s and 6 TS2554s in `role-actions.ts` looked like two separate clusters in the awk profile but were a single root cause (caller-side legacy pattern against a refactored helper). Fixing the call site closed both classes simultaneously. Generalization: when an iter targets a single file's hotspot, count ALL error classes in that file at iter entry — don't filter by error code. A single fix may close multiple error codes if they share a root cause.
- **iter 23 convention — Next.js 15+ `createClient` migration is a repo-wide drift pattern.** The legacy `const cookieStore = await cookies(); const supabase = createClient(cookieStore)` was the established Next.js 14 / @supabase/ssr pre-Next-15 pattern. The new pattern is `const supabase = await createClient()` with cookies read internally. Every server action / route handler in a Next.js 15 migration project will have this drift unless explicitly updated. Profile repo-wide with `grep -rn "createClient(cookieStore)"` and `grep -rn "= createClient()" | grep -v "await"` to find all sites. The fix is mechanical: replace_all 2-line block → 1-line + remove `cookies` import.
- **iter 23 convention — STATE.md predictions about hotspot files can be wrong; profile FIRST.** STATE.md's iter-22 prediction was `tournament-controller.tsx` would be the TS2339 hotspot with ~30 errors. The actual iter-23 hotspot was `lib/role-actions.ts` with 20 TS2339 (+ 6 TS2554 that were excluded from the TS2339 grep). Generalization: predictions decay as iters close errors; always re-profile at iter entry. The cost of the awk command is seconds; the cost of starting work on the wrong file is an iter.
- **iter 23 convention — the cleanest 1-edit-fix-many opportunities are when the legacy pattern is byte-identical across N sites.** `role-actions.ts` had 6 byte-identical 2-line blocks → 1 replace_all closed 6 sites. Generalization: when grep shows identical multi-line patterns repeated N times in a file, prefer ONE replace_all over N individual Edits. The tool result will confirm all-N-replaced; verify with a tsc-count check.

## Iter 22 fix detail (previous iter)
**Action:** Thirteen surgical Edits across 8 files closing all 19 TS2551 errors plus 2 incidental TS2339 errors. Three error clusters by root cause.

**Cluster A — 10 sites: `.catch()` on Supabase PostgrestFilterBuilder.** Files: `app/api/setup-carbardmv/route.ts` (2 sites, L145 + L148), `lib/admin-actions.ts` (2 sites, L148 + L619), `lib/content-moderation.ts:189`, `lib/media-actions.ts:220`, `lib/moderation-actions.ts` (2 sites, L177 + L216), `lib/wallet-actions.ts:899`.

- Root cause: `PostgrestFilterBuilder` is a PromiseLike (it has `.then()` but NOT `.catch()`). When code chains `.catch(handler)` directly off a Supabase query/RPC builder, TS rejects because the type lacks `.catch`. The compiler suggested `match` (an unrelated PostgrestFilterBuilder method) — semantically wrong.
- Mechanical fix: `.catch(handler)` → `.then(undefined, handler)`. Identical runtime semantics (the `.then` form's onRejected handler is functionally equivalent to `.catch`), and `.then` is defined on `PostgrestFilterBuilder`. Single-token-replacement edit per site.
- One site (`setup-carbardmv:148`) had two `.catch` calls on a single line; replaced both in one Edit.
- **Out of scope (deliberate):** The fallback bodies at `admin-actions:148-161`, `admin-actions:619-631`, `media-actions:220-226`, and `wallet-actions:899-917` have un-awaited Supabase chain calls inside the handler — fire-and-forget queries that resolve in the background and silently fail. Plus, Supabase RPC errors are returned in `{error}`, NOT thrown — so the fallback handler would rarely run anyway. This is runtime brokenness, not a type problem; surface in FIXES_APPLIED.md but don't refactor in this iter. Iter 22's mandate is "fix the type error in the simplest possible way per error." The mechanical fix preserves the existing — broken — fallback verbatim.

**Cluster B — 6 errors: `match.player1_wins`/`match.player2_wins` in `app/dashboard/my-events/page.tsx`.** Lines 541, 543, 545 (one each for player1_wins/player2_wins).

- Root cause: the SELECT at L27-37 omitted `player1_wins, player2_wins, is_bye` from the `tournament_matches` query. The columns exist on the table (confirmed via `tournament-controller.tsx`'s manually-typed prop interface that includes `player1_wins: number | null` etc.). The compiler suggested `player1_id`/`player2_id` — semantically wrong (those are ID columns, not wins).
- Fix: added `player1_wins, player2_wins, is_bye` to the SELECT. Closed 6 × TS2551 plus 2 × TS2339 incidentally (`match.is_bye` at L522 and L527 was the same root cause — same SELECT, same omission). This matches the iter-19 "coupled fixes that collapse naturally are still in scope" convention.
- **One related TS2339 in this file deliberately NOT fixed:** L518 `match.tournament_rounds?.round_number` is a TS2339 because Supabase types the relation `tournament_rounds (round_number, status)` as an ARRAY but the code accesses it as a single object. Different root cause (relation cardinality mismatch); deferred to a future iter.

**Cluster C — 4 errors: `match.reported_player1_draws`/`match.reported_player2_draws` in `components/tournaments/tournament-controller.tsx`.** Lines 1891, 1897, 1959, 1973.

- Root cause: the manually-typed `matches` array shape (L188-201) listed `reported_player1_wins`/`reported_player2_wins` but not the `_draws` variants. The compiler suggested the `_wins` variant — semantically wrong (`wins` and `draws` are distinct metrics).
- Fix: added `reported_player1_draws?: number | null` and `reported_player2_draws?: number | null` to the interface (optional fields so the parent — `getAllTournamentRounds` returning `select("*")` — doesn't need to thread them; `?? 0` fallback in the JSX handles undefined gracefully).
- **PROBABLE SCHEMA DRIFT WARNING:** The columns `reported_player1_draws` and `reported_player2_draws` are referenced in `lib/tournament-controller-actions.ts:593, 637` (server-side writes via `updates.reported_player1_draws = draws`) and ONLY in comments in `scripts/050_match_confirmation_dispute.sql`. There is NO `ADD COLUMN` for these in any migration file. If the columns don't exist in the actual Supabase database, the server-side write at `tournament-controller-actions.ts:593` would fail at runtime with a Postgres error. Two possibilities: (a) the columns were added via an out-of-band Supabase dashboard edit and are NOT mirrored in `scripts/` (likely — the iter 14+ `select("*")` infers their presence from the actual DB schema); (b) they were never added, and the match-reporting flow is silently broken. Mark/runtime testing required to disambiguate. Surface in FIXES_APPLIED.md as a follow-up.

**Diagnosis (pre-iter):**
- 19 TS2551 errors at iter-22 entry, distributed across 8 files in 3 clusters.
- Pre-edit grep confirmed: zero TS2551 errors had compiler suggestions that were correct (in all 19 cases, the suggested name was either an unrelated method like `match` or a semantically-distinct field like `player1_id` for `player1_wins`). The "did you mean" suggestion was uniformly unhelpful; each fix required a real source-code analysis, not a 1-character swap.
- This revised the iter-21 prediction ("most fixes are 1-character swaps") — TS2551 is misleading because the compiler doesn't know about real-world semantics; the suggestion is just the closest string-distance match.

**Choices made:**
- **Used `.then(undefined, handler)` rather than `.then(null, handler)` or `.then(_ => _, handler)`.** All three are equivalent at runtime, but `undefined` is the most direct semantic equivalent of "no onFulfilled handler, only onRejected" — matches the spec's default treatment of omitted callbacks. Avoids any TS-side inference confusion about TResult1.
- **Did NOT refactor the broken fallback bodies in Cluster A.** Out of scope per "no cosmetic changes." The TS fix is purely about type errors; runtime correctness of the fallback is a separate iter.
- **Made `_draws` fields OPTIONAL on the tournament-controller interface.** If they were required, the parent component (in `tournament-controller-actions.ts:getAllTournamentRounds` → `select("*")`) would need to provide them, which would cascade more errors. Optional + `?? 0` fallback in JSX handles both possible runtime states cleanly.
- **Did NOT add `player1_draws/player2_draws` to the my-events SELECT.** Only added `player1_wins, player2_wins, is_bye` because those are the only fields the JSX reads. Resisted scope creep.
- **Did NOT investigate or fix the `tournament_rounds` array-vs-object TS2339 in my-events.** Different root cause; out of scope. Will surface in iter-23 hotspot profiling.

**Pre-edit verifications:**
- Read full files: `app/api/setup-carbardmv/route.ts` (relevant section L135-160), `lib/admin-actions.ts` (L142-168 and L612-638), `lib/content-moderation.ts` (L175-200), `lib/media-actions.ts` (L213-227), `lib/moderation-actions.ts` (L165-220), `lib/wallet-actions.ts` (L893-917), `app/dashboard/my-events/page.tsx` (L20-100 and L510-555), `components/tournaments/tournament-controller.tsx` (L180-220 and L1880-1980).
- Confirmed via grep that the `reported_player1_draws` and `reported_player2_draws` columns are used in `lib/tournament-controller-actions.ts:593, 637` for writes AND in `scripts/050_*.sql` only as comments. No `ADD COLUMN` migration found anywhere.
- Confirmed the my-events page's `is_bye` use at L522, L527 is a TS2339 that closes via the same SELECT-addition fix as the player_wins TS2551s.
- Cross-checked that no other caller of TournamentController passes `reported_player1_draws` explicitly (verified via `grep` for the field name — only the component reads, the action's `select("*")` provides).

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 204 (was 225). Exactly 21 errors eliminated, zero added.
- `grep -c "TS2551" ralph-dev/tsc-errors-iter22-after.txt` → 0. **All 19 TS2551 closed.**
- `diff ralph-dev/tsc-errors-iter21-after.txt ralph-dev/tsc-errors-iter22-after.txt` → 21 lines deleted, ~14 line-shift artifacts on `tournament-controller.tsx` (the interface addition shifted error line numbers downstream by 2). Net: 21 distinct errors closed, zero new errors.
- Post-fix capture at `ralph-dev/tsc-errors-iter22-after.txt`.

**Out of scope deliberately:**
- 104 TS2339 errors. Iter-23 target (hotspot profile then sub-recipe).
- 23 TS2322 errors. Iter 24+.
- 9 TS2554 errors. Possibly another helper-signature drift; iter 24+.
- Refactoring the un-awaited fallback bodies in Cluster A. Runtime concern, not a type concern.
- The `tournament_rounds` array-vs-object TS2339 in my-events:518. Different root cause; iter-23+.
- SQL migration audit for `reported_player*_draws` columns. Needs Mark + runtime testing.

**Acceptance flipped:** None directly. TS2551 = 0 now (fully closed). Phase 3 aggregate boxes still pending; 204 errors still to go.

**Learned:**
- **iter 22 convention — TS2551 "did you mean" suggestions are often semantically wrong.** The compiler's suggestion is purely string-distance-based and ignores real-world semantics (e.g., `player1_id` ≠ `player1_wins`, `match` method ≠ `.catch`). Don't trust the suggestion blindly; read the source. The "mechanical batch" label was misleading — the iter required 3 distinct root-cause analyses, not 19 trivial swaps. Generalization: when an error class includes compiler suggestions, treat them as hints not directives; root-cause-analyze each cluster of similar-structured errors.
- **iter 22 convention — `.catch(handler)` → `.then(undefined, handler)` is the canonical Supabase PostgrestFilterBuilder fix.** Stays runtime-equivalent, requires zero restructuring. The 10 sites converged on this pattern with no per-site variation needed. If future Supabase code introduces more `.catch` chains, this is the established recipe.
- **iter 22 convention — SELECT-omission TS2551s often hide adjacent TS2339s with the same root cause.** Adding `is_bye` to the my-events SELECT was deliberate — the 2 `is_bye` TS2339s were the same root cause as the `player1_wins` TS2551s (both came from the same SELECT). Generalization: when fixing a SELECT-omission cluster, grep the whole file for ALL field accesses on the result type and add every omitted field that the code reads. Single edit closes many errors.
- **iter 22 convention — manual-prop-interface TS2551s expose schema drift WARNINGS to surface.** The `reported_player*_draws` fix was a 4-line interface addition, but the underlying issue — server-side writes to columns that may not exist in the DB — is a runtime correctness concern that the type-fix INTENTIONALLY does not resolve. Surface schema-drift discoveries in FIXES_APPLIED.md with an explicit "needs SQL migration audit" callout. The type fix unblocks tsc; the schema audit unblocks the feature.
- **iter 22 convention — Cluster A's runtime brokenness illustrates the gap between type correctness and runtime correctness.** The mechanical `.catch` → `.then(undefined, ...)` fix makes tsc happy but preserves the fire-and-forget fallback bodies that were broken to begin with. Don't conflate "tsc passes" with "code works." The fix unblocks the Phase 3 acceptance criterion ("Zero TypeScript errors"); a separate Phase 4 ("Feature completion") iter or runtime testing pass is needed to fix the fallbacks. This is the right factoring of work — Phase 3 is the type-safety gate, not the feature-correctness gate.

## Iter 21 fix detail (previous iter)
**Action:** Six surgical Edits to `app/api/v1/ticket-types/route.ts` — one per logical block (GET auth + rate-limit; GET event_id validation; GET database_error; GET catch + POST auth + permission; POST body validation; POST event-not-found; POST database_error + apiSuccess(201) + catch).

**Canonical-name remap applied (file-specific):**
- `"database_error"` → `"internal_error"` (500, same status, NO `code` preservation — the legacy `database_error` was generic enough that `internal_error` fully conveys the semantic; consumers don't need to distinguish DB-error 500s from other 500s in this file. Compare iter 20 where both `payment_error` and `refund_error` mapped to `internal_error` and needed `code` to distinguish Stripe-layer vs ledger-layer — here both `database_error` sites are the same kind of failure, so no `code` is needed).
- `"permission_denied"` → `"authorization_error"` (403)
- `"not_found"` → `"resource_not_found"` (404)

**Convention applied:**
- Dropped all 7 redundant 3rd-arg status codes (L11 401, L16 429, L24 400, L62 500, L70 401, L97 400, L140 500). Each matched the auto-derived `STATUS_CODES[type]` for the (canonical) type name; no behavior change.
- Added `{ rateLimit: rateLimitResult }` to the L16 rate-limit-exceeded response — same correctness improvement as iters 13/14/15/17. The legacy code's 3rd-arg `429` was being silently dropped at runtime (the helper destructures `options?.rateLimit/code/param` and ignores unknown positional args), AND the legacy code passed no rate-limit metadata, so the response was emitting NO `Retry-After`/`X-RateLimit-*` headers. The rewrite restores `addRateLimitHeaders` emission. Type fix + behavior fix combined.
- Rewrote L137 `apiSuccess(ticketType, {}, 201)` as `apiSuccess(ticketType, { status: 201 })` matching iter-14 pattern.

**Diagnosis:**
- 12 errors total at iter-21 entry, all within the api-response caller-alignment scope:
  - 7 × TS2559 (status as 3rd positional arg): L11, L16, L24, L62, L70, L97, L140.
  - 4 × TS2345 (legacy type names): L43 `"database_error"`, L74 `"permission_denied"`, L109 `"not_found"`, L134 `"database_error"`.
  - 1 × TS2554 (wrong arg count): L137.
- Zero out-of-scope errors in this file at iter-21 entry. Cleanest possible recipe application target.
- No Stripe drift in this file (grepped for `apiVersion` — empty). No idempotency drift (grepped for `checkIdempotency` — empty). Clean single-recipe target.
- All legacy type names in this file (`database_error`, `permission_denied`, `not_found`) are in the iter-13/14/15/17/20 vocabulary. Zero surprise names.

**Choices made:**
- **No `code` preservation for `database_error` remap.** The legacy semantic is generic ("DB layer failure"); consumers can't act on it differently than any other 500. Resisted iter-20's `code: "stripe_refund_failed"`/`code: "refund_failed"` precedent here because there's no application-level subtype to preserve — both `database_error` sites are exactly the same kind of failure (insert vs select on the same `ticket_types` table). Saved 2 lines of code (no `{ code: ... }` block) and 2 fields in the response body.
- **Used 6 surgical Edits** rather than one Write rewrite. Stays surgical and isolates failure modes per block. The catch-block + POST auth + POST permission were combined into one Edit because the source text was contiguous (the GET catch closes the function, then POST opens with auth + permission — three contiguous lines per legacy issue).
- **Did NOT extend the helper.** Same as iter 20 — both legacy names had clean canonical mappings; no helper API surface added.
- **Did NOT add `code: "duplicate_ticket_type"` for L134 in case of unique-constraint violation.** Unlike iter 17's `duplicate_error` → `idempotency_error` with `code: "duplicate_slug"` (where the legacy code's name made the unique-constraint semantic explicit), here L134 is the catch-all for ANY insert error, not specifically a unique-constraint violation. The legacy `database_error` name carries no unique-constraint semantic. So a generic `internal_error` is correct without `code`.

**Pre-edit verifications:**
- Read full `app/api/v1/ticket-types/route.ts` (143 lines, post-iter-20 state).
- Re-read full `lib/middleware/api-response.ts` (116 lines) — confirmed `ApiErrorType` closed set, `apiError(type, message, options?)` signature, `apiSuccess(data, options?)` signature with `status` option, `STATUS_CODES` mapping.
- `grep "ticket-types/route.ts" ralph-dev/tsc-errors-iter20-after.txt | wc -l` → 12. Matched.
- `grep "ticket-types/route.ts" ralph-dev/tsc-errors-iter20-after.txt | grep TS2345` → 4 errors, all with legacy names in the iter-13/14/15/17/20 vocabulary. No surprises.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 225 (was 237). Exactly 12 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter20-after.txt ralph-dev/tsc-errors-iter21-after.txt` → 12 lines deleted, 0 added. Cleanest possible diff (no line-shift artifacts; the file's line count changed only minimally — net 0 since each edit was 1-line-for-1-line or removed a positional arg without adding lines).
- `grep "ticket-types/route.ts" ralph-dev/tsc-errors-iter21-after.txt` → empty. **File fully clean.**
- Updated tally: TS2559 = 12 (was 19 — 7 closed in iter 21); TS2345 = 14 (was 18 — 4 closed); TS2554 = 9 (was 10 — 1 closed). All other error counts unchanged (no cross-file effects).

**Out of scope deliberately:**
- 19 TS2551 typos. Iter-22 target (mechanical batch).
- 106 TS2339 errors. Iter-23+ target (hotspot analysis required first).
- 23 TS2322 errors. Iter 24+.

**Acceptance flipped:** None directly. `ticket-types/route.ts` now fully clean; the entire dense v1 API cluster is now done. Phase 3 aggregate boxes still pending; 225 errors still to go.

**Learned:**
- **iter 21 convention — when the legacy type name is generic enough, skip `code` preservation.** Iters 15/17/20 used `{ code: "..." }` to carry application-specific subtypes when remapping to a canonical type (e.g., `check_in_failed`, `duplicate_slug`, `stripe_refund_failed`). But iter 21's `database_error` → `internal_error` mapping needed NO `code` because the legacy name was as generic as the canonical: there's no subtype to preserve, consumers can't branch on "DB error specifically" because the next layer down is the SDK and the error message already carries the SDK's diagnostic. Generalization: use `code` only when the legacy name encodes a meaningful subtype that the canonical category subsumes. Saves response-body fields, reduces consumer-side branching, keeps the canonical-type contract clean.
- **iter 21 convention — recipe is now fully mature; predict clean diffs for any future single-file caller-alignment work.** Iter 13 (15 errors) was a learning iter; iter 14 (12 errors) added the helper-fallback case; iter 15 (13 errors) added the metadata-bag extension; iter 17 (13 errors) added the canonical-type-with-code preservation; iter 20 (8 errors) and iter 21 (12 errors) had zero file-specific surprises. The recipe handles every case observed: legacy type name, status-as-3rd-arg, wrong arg shape on apiSuccess, helper-has-no-equivalent (raw NextResponse fallback), code preservation when subtype matters. Future api-response drift in non-v1 routes (if discovered) should be 1-iter-per-file with predictable clean diffs.
- **iter 21 convention — the rate-limit-headers correctness improvement is a no-brainer when the iter touches the rate-limit-exceeded response.** Iters 13/14/15/17 and now 21 all added `{ rateLimit: rateLimitResult }` to the L16-or-equivalent rate-limit-exceeded response. Pattern: if the iter is editing a `apiError("rate_limit_exceeded", ...)` call ANYWAY, slip in the `rateLimit: ...` option. Cost is 1 token; benefit is restoring `Retry-After` emission for rate-limit-aware clients. Surface in FIXES_APPLIED.md eventually.
- **iter 21 milestone — the dense v1 API cluster is fully done.** 7 files cleaned across 6 iters (iter 13 events/[eventId]; iter 14+18+19 tickets/purchase; iter 15+16 tickets/check-in; iter 17 events/route; iter 18+19+20 refund/route; iter 21 ticket-types/route; transactions/route already clean). Total ~85 errors closed across the cluster. The recipe ("v1 api-response drift caller-alignment") is now a stable named pattern; should be referenced explicitly in FIXES_APPLIED.md.

## Iter 20 fix detail (previous iter)
**Action:** Five surgical Edits to `app/api/v1/orders/[orderId]/refund/route.ts` — one per logical block (auth+permission, not-found+refund-amount, Stripe error, ledger error, catch-block).

**Canonical-name remap applied (file-specific):**
- `"permission_denied"` → `"authorization_error"` (403, same status)
- `"not_found"` → `"resource_not_found"` (404, same status)
- `"payment_error"` → `"internal_error"` (500, same status; preserved via `{ code: "stripe_refund_failed" }`)
- `"refund_error"` → `"internal_error"` (500, same status; preserved via `{ code: "refund_failed" }`)

**Convention applied:**
- Dropped all 4 redundant 3rd-arg status codes (L17 401, L54 400, L61 400, L109 500). Each matched the auto-derived `STATUS_CODES[type]` for the (canonical) type name; no behavior change.
- The two `internal_error` remaps (L74 Stripe, L86 ledger) carry their legacy semantic via the `code` option — matching the iter-17 generalization of "canonical-type remap with `code` preservation when status matches but semantic doesn't."

**Diagnosis:**
- 8 errors total at iter-20 entry, all within the api-response caller-alignment scope:
  - 4 × TS2559 (status as 3rd positional arg): L17, L54, L61, L109.
  - 4 × TS2345 (legacy type names): L21 `"permission_denied"`, L50 `"not_found"`, L74 `"payment_error"`, L86 `"refund_error"`.
- STATE.md's iter-19 recommendation predicted 5 × TS2559 + 3 × TS2345 — the actual split was 4 × TS2559 + 4 × TS2345. The line counts in STATE.md were slightly off (a re-count from the iter-19 capture confirmed 4 + 4). The recipe applied cleanly regardless; predictive miscounts don't compound when the recipe is sound.
- Zero out-of-scope errors in this file at iter-20 entry. Cleanest possible recipe application target.

**Choices made:**
- **Used `{ code: "stripe_refund_failed" }` for the L74 Stripe error site.** Matches the recommendation in STATE.md. Distinguishes from generic 500s via the `code` field; API consumers can branch on `error.code === "stripe_refund_failed"` to detect Stripe-layer failures separately from ledger-layer failures.
- **Used `{ code: "refund_failed" }` for the L86 ledger error site.** Generic name (vs. `ledger_refund_failed`) because the legacy code's name `refund_error` was also generic. Resisted over-specification.
- **Did NOT extend the helper or add new `ApiErrorType` members** (e.g., `payment_error`, `refund_error`). Both legacy names had no clean canonical mapping; the `internal_error` + `code` pattern handles them at caller level with no helper API surface added.
- **Used 5 Edit calls** rather than one Write rewrite. Stays surgical and isolates failure modes per block. Each block's old_string was unique enough that no `replace_all` was needed.

**Pre-edit verifications:**
- Read full `app/api/v1/orders/[orderId]/refund/route.ts` (post-iter-19 state, 111 lines).
- Re-read full `lib/middleware/api-response.ts` (116 lines) — confirmed `ApiErrorType` is the closed set `invalid_request | authentication_error | authorization_error | rate_limit_exceeded | resource_not_found | idempotency_error | insufficient_funds | validation_error | internal_error`. Confirmed `apiError` signature is `(type, message, options?)` with options shape `{code?, param?, rateLimit?}`.
- `grep "refund/route.ts" ralph-dev/tsc-errors-iter19-after.txt` returned exactly 8 errors, all within the recipe scope. No surprise out-of-scope errors.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 237 (was 245). Exactly 8 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter19-after.txt ralph-dev/tsc-errors-iter20-after.txt` → 8 lines deleted, 0 added. Cleanest possible diff (no line-shift artifacts since the line-count of the file didn't change).
- `grep "refund/route.ts" ralph-dev/tsc-errors-iter20-after.txt` → empty. **File is fully clean.**

**Out of scope deliberately:**
- `ticket-types/route.ts` (~12 errors expected). Iter-21 target — same recipe.
- The 19 TS2551 typos. Mechanical batch, iter 22+.
- TS2339 hotspot (~106 errors). Iter 23+ exploration.

**Acceptance flipped:** None directly. `refund/route.ts` now fully clean; the entire dense v1 API cluster except `ticket-types/route.ts` is now clean. Phase 3 aggregate boxes still pending; 237 errors still to go.

**Learned:**
- **iter 20 convention — predictive line-counts may be off but the recipe is robust.** STATE.md's iter-19 prediction of "5 × TS2559 + 3 × TS2345" was actually 4 + 4. The discrepancy didn't matter because the recipe applies per-error, not per-error-class-count. Generalization: when recommending a recipe in "What's next," trust the recipe more than the exact line count. Always re-grep at iter entry for the canonical count.
- **iter 20 convention — `code` preservation generalized beyond iter-15/17 patterns.** Iter 15 used `code` for `check_in_failed`; iter 17 used `code` for `duplicate_slug`. Iter 20 used `code` for both `stripe_refund_failed` AND `refund_failed` in the same file. The pattern is robust: when the legacy name has no canonical equivalent but the status matches, use `internal_error` (or another same-status canonical) and put the legacy semantic in `code`. API consumers get the precise subtype without the helper's `type` enum having to grow.
- **iter 20 convention — cleanest possible diff confirms recipe maturity.** Iter 20's diff was 8 lines deleted, 0 added, zero line-shift artifacts. This is the cleanest profile achievable for a same-file recipe application. Compare with iter 13's 15-line surgical, iter 14's 12-line, iter 17's 13-line (all surgical, all 0-add). The recipe is now mature enough that file-specific surprises are rare; predict iter 21 (`ticket-types/route.ts`) to have a similar profile.

## Iter 19 fix detail (previous iter)
**Action:** Five surgical Edits across 2 files. `app/api/v1/tickets/purchase/route.ts`: (a) inserted `const startTime = Date.now()` at top of POST; rewrote the idempotency check block (L26-32) to use the canonical `checkIdempotency(req, tenantId)` signature with `cached.found && cached.response` and `cached.response.body`; (b) rewrote the free-order store (L114) and the paid-order store (L180) from 3-arg to canonical 5-arg `storeIdempotentResponse(req, tenantId, apiKeyId, {status, body}, Date.now() - startTime)`. `app/api/v1/orders/[orderId]/refund/route.ts`: (c) extended the import line to add `NextResponse`; (d) inserted `const startTime = Date.now()` at top of POST + rewrote idempotency check block (L24-30) with canonical signature AND raw `NextResponse.json` fallback for the `Idempotent-Replayed` header (the coupled L28 TS2353 fix); (e) rewrote the store (L93) from 3-arg to canonical 5-arg.

**Diagnosis:**
- 5 idempotency errors at iter-19 entry: 3 in `purchase/route.ts` (L28 TS2345 signature, L114 TS2554 arg count, L180 TS2554 arg count), 2 in `refund/route.ts` (L26 TS2345 signature, L93 TS2554 arg count). Plus 1 coupled error in `refund/route.ts:28` (TS2353 — `apiSuccess(cached, { "Idempotent-Replayed": "true" })`, headers bag not allowed in `apiSuccess` options shape). 6 total target errors across 2 files.
- Reference pattern: `app/api/v1/transactions/route.ts` already uses canonical signatures (L116-118 for check; L165 for store; L7-8 for startTime). Zero errors in transactions/route.ts at iter-19 entry. Treated as the gold-standard pattern.
- Pre-flight read of `lib/middleware/idempotency.ts` corrected the iter-15 cache: (a) `IdempotencyResult` shape is `{found: boolean, response?: {status: number, body: unknown}}`, not `{cached, response}`. (b) Both `storeIdempotency` (canonical, lines 50-81) AND `storeIdempotentResponse` (alias re-export, line 86) exist. The iter-15 cache had erroneously suggested one of them was wrong; in fact both are valid and the issue was the ARG signature, not the export name. Callers can keep whichever import name they used.

**Choices made:**
- **Used `storeIdempotentResponse` (the alias) in purchase and refund** rather than renaming to `storeIdempotency` (the canonical). Reason: it's a deliberate alias kept for backwards-compat per the doc comment on line 84. Renaming would be churn for no gain; the iter scope is "fix the signature drift," not "consolidate export names."
- **Did NOT touch `transactions/route.ts`** — already canonical. Zero edits there.
- **Inlined `const startTime = Date.now()` at the top of each POST `try` block** rather than threading from outside the `try`. Match the `transactions/route.ts` pattern (L8 has `const startTime = Date.now()` at function entry, before `try`). Slight divergence in placement (purchase/refund: inside `try`; transactions: before `try`) is intentional — the `startTime` only needs to feed the store call, which is inside the `try`. Placement inside is slightly safer (no exception risk between `startTime` and store).
- **Used raw `NextResponse.json` for the `Idempotent-Replayed` cached-response path in BOTH files** rather than extending `apiSuccess` with a `headers?: Record<string, string>` option. Matches the iter-14 helper-fallback convention. Three reasons: (a) only 2 sites use the header — extending the helper would be cross-cutting for a 2-caller benefit; (b) keeps the helper minimal; (c) preserves the cached response's original status code (which `apiSuccess` would override to 200 unless explicitly threaded).
- **Used `cached.response.body` not `cached.response`** in the raw return. The `body` field is the actual stored data; `response` is the wrapper with `{status, body}`. Returning `cached.response` directly would double-wrap the body.
- **Used `cached.response.status` for the response status** in the raw return. This preserves the original status code of the cached response — so if the original was a 201 (free order success) the replay is also 201. This is the correct semantic.
- **Did NOT fix the 8 remaining api-response drift errors in `refund/route.ts`** (L17/21/50/54/61/74/86/109). Different root cause (api-response drift, not idempotency drift). Per the "one root cause per iter" discipline, defer to iter 20. Same iter-13/14/15/17 recipe applies; should be a fully-clean-file iter.

**Pre-edit verifications:**
- Read full `lib/middleware/idempotency.ts` (112 lines). Confirmed canonical signatures, `IdempotencyResult` shape, and the alias re-export.
- Read full `app/api/v1/tickets/purchase/route.ts` (189 lines, post-iter-18 state).
- Read full `app/api/v1/orders/[orderId]/refund/route.ts` (101 lines, post-iter-18 state).
- Read full `app/api/v1/transactions/route.ts` (175 lines). Confirmed it's already canonical; treated as reference pattern.
- Re-read `lib/middleware/api-response.ts` (116 lines). Confirmed `apiSuccess` has no `headers` option — coupled L28 fix in refund needs raw `NextResponse.json` fallback.
- `grep -rn "checkIdempotency\|storeIdempotency\|storeIdempotentResponse" --include="*.ts" --include="*.tsx" app/ lib/` — confirmed exactly 3 caller files (purchase, refund, transactions) and the helper file. No hidden callers.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 245 (was 251). Exactly 6 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter18-after.txt ralph-dev/tsc-errors-iter19-after.txt` → 8 added lines = the 8 surviving refund errors with shifted line numbers (+4 from the `NextResponse` import and `startTime` line additions). Same errors, new line numbers. Zero NEW errors introduced.
- `grep "purchase/route.ts" ralph-dev/tsc-errors-iter19-after.txt` → empty. **Purchase is fully clean.**
- `grep "transactions/route.ts" ralph-dev/tsc-errors-iter19-after.txt` → empty. **Still clean.**
- `grep "refund/route.ts" ralph-dev/tsc-errors-iter19-after.txt | wc -l` → 8 (down from 11 at iter-18; the 3 closed = 2 idempotency + 1 coupled TS2353).
- Repo-wide grep `checkIdempotency\|storeIdempotency\|storeIdempotentResponse` post-fix confirms all 3 caller files now use the canonical `(req, tenantId)` and `(req, tenantId, apiKeyId, response, durationMs)` signatures.

**Out of scope deliberately:**
- The 8 api-response drift errors in `refund/route.ts`. Iter-20 target.
- `ticket-types/route.ts` (~12 errors expected). Iter-21 target.
- The 19 TS2551 typos. Mechanical batch, iter 22+.
- Consolidating `storeIdempotentResponse` → `storeIdempotency` (the canonical name). Cosmetic, not a bug. Out of scope per "no cosmetic changes" rule.

**Acceptance flipped:** None directly. `purchase/route.ts` is now fully clean; idempotency drift is fully closed. Phase 3 aggregate boxes; 245 errors still to go.

**Learned:**
- **iter 19 convention — verify cached pre-flight findings against the source of truth.** The iter-15 pre-flight cache had erroneously claimed `IdempotencyResult.cached` and uncertainty between `storeIdempotency` vs `storeIdempotentResponse`. Re-reading the helper at iter 19 entry corrected both: shape is `{found, response?}` and BOTH export names exist (alias). Generalization: when a previous iter caches API signatures for a future iter, re-read the source of truth at the future iter's entry. Caching is for context, not for correctness — cheap to re-verify, expensive to act on stale info.
- **iter 19 convention — coupled fixes that collapse naturally are still in scope.** The L28 TS2353 in refund was technically api-response drift, not idempotency drift. But fixing L26 (idempotency) changed `cached` from string to `IdempotencyResult` — the natural rewrite of L28 to use `cached.response.body` requires the raw `NextResponse.json` fallback anyway, which incidentally closes the TS2353. Don't artificially split coupled fixes across iters — count the side-effect closure as a bonus, not scope creep.
- **iter 19 convention — when a reference pattern exists in-repo, treat it as gold standard and align to it.** `transactions/route.ts` already used the canonical idempotency signatures. Reading it first gave a working template that purchase and refund just had to match. This is cheaper than designing from the helper signature alone — the reference pattern shows the developer-intent for HOW to integrate the helper (e.g., where to place `startTime`, what status code to use in `{status, body}`).
- **iter 19 convention — preserve cached-response status code in raw `NextResponse.json` replays.** Using `cached.response.status` (not a hardcoded 200) means a free-order replay returns 201, a paid-order replay returns 201, etc. — matches what the original request returned. The legacy code's `apiSuccess(cached, ...)` would have stripped this, defaulting to 200. The raw `NextResponse.json` rewrite restores it. Type fix + behavior fix combined.

## Iter 18 fix detail (previous iter)
**Action:** Two surgical 6-line-deletion Edits — one to `app/api/v1/tickets/purchase/route.ts:7-11`, one to `app/api/v1/orders/[orderId]/refund/route.ts:6-10`. Both files had identical drift: `import Stripe from "stripe"` + `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" })`. Replaced with single-line `import { stripe } from "@/lib/stripe"` (the canonical singleton from `lib/stripe.ts`, which uses no apiVersion override and lets the SDK pick its default — matching the iter-11 recipe and `lib/stripe.ts`'s actual pattern).

**Diagnosis:**
- 2 errors total at iter-18 entry, both `TS2322`:
  - `app/api/v1/orders/[orderId]/refund/route.ts(9,3)`: `Type '"2024-12-18.acacia"' is not assignable to type '"2025-02-24.acacia"'`
  - `app/api/v1/tickets/purchase/route.ts(10,3)`: same error
- Root cause: the installed `stripe` SDK version's TypeScript declarations pin `apiVersion` to a single literal type `"2025-02-24.acacia"`. The legacy callers passed `"2024-12-18.acacia"`. The `lib/stripe.ts` singleton avoids this by passing no apiVersion (lets the SDK use its bundled default), so callers that switch to the singleton inherit a future-proof config.
- This was the second pass of TRIAGE §2c. The iter-11 pass closed 3 files but missed these 2 because they were in `app/api/v1/`, not the top-level api routes the iter-11 grep targeted. The iter-14 finding that the TRIAGE list was incomplete is now resolved.

**Choices made:**
- **Removed the `Stripe` type import in both files** because zero `Stripe.` namespace refs exist in either (only `stripe.checkout.sessions.create` and `stripe.refunds.create` instance method calls). Pre-edit grep `grep -n "Stripe\."` returned empty in both files. The type import would have been dead code; keeping it would violate the iter-9 "delete unused imports" pattern.
- **Single Edit per file** rather than a multi-step (delete instantiation; separately delete import) approach. The 5-line block (import + 4-line const) is logically one unit — the whole point is "swap the local instantiation for the canonical singleton import," so the Edit captures both deletions and the new import together.
- **Did NOT touch any caller of `stripe`** (the lowercase instance). The variable name `stripe` is preserved between the old `const stripe = new Stripe(...)` and the new `import { stripe }`, so all instance-method call sites (`stripe.checkout.sessions.create` L127 in purchase; `stripe.refunds.create` L67 in refund) compile unchanged.
- **Did NOT switch to using the `Stripe` namespace anywhere** (e.g., `Stripe.Refund` for a type). Neither file needed it; the existing inline types and `any` returns already work.

**Pre-edit verifications:**
- `grep -rn 'apiVersion: "2024-12-18.acacia"'` repo-wide → exactly 2 sites (refund:9, purchase:10). No surprise files.
- `grep -rn "new Stripe("` repo-wide (excluding node_modules) → 6 total sites: 4 in non-v1 routes (`withdraw`, `reconciliation`, `kyc/create-session`, `kyc/refresh-status`) that do NOT have the apiVersion drift (those callers presumably use a different/correct apiVersion or none — out of scope for §2c). Plus the 2 v1 sites this iter targets.
- `grep -n "Stripe\."` in both target files → empty. Confirms `Stripe` is unused as a type/namespace; full import removal is safe.
- `grep -n "stripe\."` in both target files → confirms only `stripe.checkout.sessions.create` (purchase:127) and `stripe.refunds.create` (refund:67). One call site per file.
- Read `lib/stripe.ts` (5 lines, 1 export: `export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)`). Confirmed: the singleton uses no apiVersion override, matching the iter-11 recipe expectation.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 251 (was 253). Exactly 2 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter17-after.txt ralph-dev/tsc-errors-iter18-after.txt` → 12 lines deleted, 10 lines added. The 12 deleted include the 2 TS2322 fixes PLUS 10 line-shift artifacts (errors in lines after the deletion point shifted by -4). The 10 added are the same errors at their new line numbers. Net: 2 distinct errors eliminated, zero shift in any error type.
- `grep -rn 'apiVersion: "2024-12-18.acacia"' .` → empty. TRIAGE §2c fully closed.
- `grep "purchase/route.ts" ralph-dev/tsc-errors-iter18-after.txt | wc -l` → 3 (down from 4 — the TS2322 closed; the 3 remaining are idempotency drift at lines 28, 114, 180).
- `grep "refund/route.ts" ralph-dev/tsc-errors-iter18-after.txt | wc -l` → 11 (down from 12 — the TS2322 closed; the 11 remaining are api-response drift + idempotency drift).

**Out of scope deliberately:**
- The 4 non-v1 `new Stripe(...)` callers (`withdraw`, `reconciliation`, `kyc/create-session`, `kyc/refresh-status`). None had the apiVersion drift per the grep. If they later DO need to migrate to the singleton (for consistency / future-config drift), that's a separate concern — TRIAGE §2c was specifically about the apiVersion drift error, and that's closed.
- The 10 remaining errors in `refund/route.ts` (api-response drift + idempotency drift) and 3 in `purchase/route.ts` (idempotency drift). Iter 19 target — see "What's next" #1 (idempotency sweep) and #3 (refund file-by-file).
- The 19 TS2551 typos. Mechanical batch — iter 21+.

**Acceptance flipped:** None directly. TRIAGE §2c is fully closed but ACCEPTANCE.md doesn't have a per-§ Phase 1 box for it (the Phase 1 boxes are all already `[x]`). Phase 3 aggregate boxes remain: 251 errors still to go.

**Learned:**
- **iter 18 convention — TRIAGE-list completeness verification pays off.** The iter-14 finding that TRIAGE §2c was incomplete (because iter-11's grep missed 2 v1 files) was correct and load-bearing. The pre-iter-18 housekeeping recommendation ("re-grep `apiVersion: '2024-12-18.acacia'` repo-wide") confirmed the 2 sites and gave high confidence the sweep would close §2c entirely. Generalization: when a multi-pass triage finds N files and a later iter surfaces N+K, do the cross-file grep AGAIN before claiming closure on the next pass. The grep is cheap; the false-closure claim is expensive (it can leave drift errors lingering forever).
- **iter 18 convention — minimum-diff cross-file sweep template.** For "same fix in N files" sweeps, the smallest correct unit of work is 1 Edit per file, each replacing exactly the legacy block with exactly the canonical replacement. No collateral edits, no helper changes. iter 18 was the cleanest application of this template so far: 2 Edits, 2 errors closed, 12-line net diff (most of it line-shift artifacts), zero new errors. Time-to-implement was minutes once the pre-edit greps confirmed the pattern.
- **iter 18 convention — preserve identifier names across canonical-singleton swaps.** When swapping `const stripe = new Stripe(...)` for `import { stripe } from "..."`, the variable name `stripe` is intentionally preserved between source and replacement. This means ZERO caller changes — all instance-method calls (`stripe.checkout.sessions.create`, etc.) compile unchanged. If the singleton had been named `stripeClient` instead, every call site would need an edit. Name-preservation is a load-bearing decision in singleton-design and should be a deliberate criterion when designing new helpers/exports.

## Iter 17 fix detail (previous iter)
**Action:** Five surgical Edits to `app/api/v1/events/route.ts` (one per logical block: GET opener including rate-limit; GET database_error + apiSuccess + catch; POST opener including rate-limit; POST invalid_request; POST DB error chunk including duplicate + apiSuccess 201 + catch). Total 13 errors eliminated in one file.

**Canonical-name remap applied (file-specific):**
- `"permission_denied"` → `"authorization_error"` (403)
- `"database_error"` → `"internal_error"` (500)
- `"duplicate_error"` → `"idempotency_error"` (409) — preserved legacy semantic via `{ code: "duplicate_slug" }`. The only canonical type with 409 is `idempotency_error`; semantic match is imperfect (idempotency is for key conflicts, not unique-constraint conflicts) but status match is exact and the user-facing message ("An event with this slug already exists") + the `code` field together fully convey the semantic to API consumers.

**Convention applied:**
- Dropped all 7 redundant 3rd-arg status codes on `apiError(...)` calls (lines 12, 82, 90, 99, 128, 173, plus L18 and L165's 4th-arg-shape that collapsed when status was dropped).
- Two `apiError` rate-limit-exceeded sites (L18 GET, L99 POST): added `{ rateLimit: rateLimitResult }` option. L18 was passing a manual `X-RateLimit-*` headers bag as 4th positional arg — silently dropped at runtime since `apiError` only accepts 2-3 args. The rewrite makes the helper actually emit canonical rate-limit headers (including `Retry-After`). L99 had no headers at all — now also emits them. Two real behavior fixes smuggled in under type fixes.
- L77 `apiSuccess(_, {"X-RateLimit-*":...})` rewritten as `apiSuccess(_, { rateLimit: rateLimitResult })`. Same root cause as iter 14: helper's options shape doesn't include arbitrary headers; the rewrite restores rate-limit-header emission via `addRateLimitHeaders`.
- L170 `apiSuccess(event, {}, 201)` rewritten as `apiSuccess(event, { status: 201 })`. Matches iter-14 pattern.

**Diagnosis:**
- 13 errors total at iter-17 entry, ALL within the api-response caller-alignment scope:
  - 7 × TS2559 (status as 3rd positional arg): L12, L82, L90, L99, L128, L173, L165 (this one because the 4th-arg headers were collapsed when 3rd was already wrong — but the actual error code is TS2554 since arg count is wrong; recheck below).
  - 3 × TS2345 (legacy type names): L68 (`"database_error"`), L94 (`"permission_denied"`), L165 (`"duplicate_error"`), L167 (`"database_error"`).
  - 2 × TS2554 (wrong arg count): L18 (4 args), L170 (3 args).
  - 1 × TS2353 (object literal property): L77 (`X-RateLimit-*` keys not in options shape).
- All 13 errors were in scope for a single iter. Zero out-of-scope errors in this file (in contrast to iter 14 where `purchase/route.ts` had 4 out-of-scope errors from Stripe drift + idempotency drift).

**Choices made:**
- **`"duplicate_error"` → `"idempotency_error"` over `"validation_error"`.** Both options exist as canonical names but only `idempotency_error` matches the legacy 409 status. `validation_error` is 422 which is meaningfully different (HTTP 422 is "request shape OK but semantically invalid"; 409 is "resource state conflict"). The legacy code chose 409 deliberately for a unique-constraint conflict — preserve that.
- **Preserved the `duplicate_error` semantic via `{ code: "duplicate_slug" }`.** Matches iter-15's pattern (`code: "check_in_failed"` for the line-61 metadata-bag rewrite). The `code` field carries application-level error subtyping that the canonical `type` enumeration can't express. Consumers can branch on `error.code === "duplicate_slug"` to distinguish from generic idempotency-key conflicts.
- **Did NOT touch line 158 `created_by: authResult.user_id || authResult.tenant_id`.** Closed in iter 16 via the cross-file `ApiAuthResult.user_id` type extension. Confirmed via pre-edit grep that the line is no longer in the tsc errors.
- **Did NOT add `{ code: "duplicate_event_slug" }` more specifically.** "duplicate_slug" is generic enough to work for any event with a slug-uniqueness constraint and matches the message phrasing. Resisted over-specification.
- **Used 5 Edit calls** rather than one Write rewrite. Stays surgical, isolates failure modes, and avoids the iter-14 `replace_all` reliability issue (one Edit with `replace_all: true` left an occurrence behind).

**Pre-edit verifications:**
- Read full `app/api/v1/events/route.ts` (175 lines).
- Re-read full `lib/middleware/api-response.ts` (116 lines).
- Cross-checked iter-16 tsc capture against the 13 errors keyed to this file — confirmed all in scope, no Stripe/idempotency drift in this file (verified by `grep "apiVersion"` and `grep "checkIdempotency\|storeIdempotency"` returning empty for this file).
- Confirmed `idempotency_error` exists in `ApiErrorType` and maps to 409 in `STATUS_CODES`.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 253 (was 266). Exactly 13 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter16-after.txt ralph-dev/tsc-errors-iter17-after.txt` → 13 lines deleted, 0 added. Cleanest diff so far (no shift-of-line artifacts because no raw `NextResponse.json` block-additions were needed in this file — unlike iter 15 where the helper-fallback added lines).
- `grep "app/api/v1/events/route.ts" ralph-dev/tsc-errors-iter17-after.txt` → empty. File is fully clean.

**Out of scope deliberately:**
- The Stripe `apiVersion` drift in `purchase/route.ts:10` and `orders/[orderId]/refund/route.ts:9`. Iter-18 target (small 2-error sweep).
- The idempotency helper drift in `purchase/route.ts`, `refund/route.ts`, `transactions/route.ts`. Iter-19 target (or coupled with iter 18).
- `ticket-types/route.ts` api-response drift (~12 errors). Iter-20 target (last of the dense v1 cluster).
- The 19 TS2551 typos. Mechanical batch.

**Acceptance flipped:** None directly. `app/api/v1/events/route.ts` is now fully clean. Phase 3 aggregate boxes; 253 errors still to go.

**Learned:**
- **iter 17 convention — when the legacy code's manual headers bag is being silently dropped at runtime, the type-fix is also a behavior-fix.** L18 GET and L77 GET both had `X-RateLimit-*` keys passed as positional args / option keys that the helper's destructure ignored. The legacy code was emitting NO rate-limit headers at runtime despite the developer's evident intent. The rewrite to `{ rateLimit: rateLimitResult }` restores header emission via `addRateLimitHeaders`. Surface in FIXES_APPLIED.md as a behavior-fix: rate-limit-aware clients (which use `Retry-After`, `X-RateLimit-Remaining`) will now actually receive those headers.
- **iter 17 convention — canonical-type remap with `code` preservation handles "no exact canonical match" cases.** When the legacy name (`duplicate_error`) has no exact canonical equivalent but matches a status (409 → `idempotency_error`), use the closest-status canonical type and carry the precise legacy semantic in the `code` field. The `type` becomes the canonical category; the `code` becomes the application-specific subtype. This is the iter-15 pattern generalized: status preservation > semantic-name preservation, and `code` bridges the gap.
- **iter 17 convention — same-file recipe applications get cleaner across iters.** Iter 13 (events/[eventId]) and iter 14 (tickets/purchase) had file-specific surprises requiring caller-level workarounds (raw `NextResponse.json`). Iter 15 (check-in) had a metadata-bag rewrite. Iter 17 (events/route) had ZERO file-specific surprises — every error mapped to a known recipe element. The "v1 api-response drift" recipe is now well-tested and predictable. Iter 18+ should be even faster.

## Iter 16 fix detail (previous iter)
**Action:** Two surgical edits to `lib/middleware/api-auth.ts` — extending the `ApiAuthResult` interface and the validator success-branch return.

**Fix applied:**
- `lib/middleware/api-auth.ts:3-10` — added `user_id?: string` to the `ApiAuthResult` interface (optional, so all 4 error-branch returns are unaffected).
- `lib/middleware/api-auth.ts:72-78` — added `user_id: data.user_id` to the success-branch return. If the RPC returns `user_id`, it's now threaded through. If not, this is `undefined`, matching the optional type.

**Diagnosis:**
- 4 errors at iter-16 entry, all TS2339 `Property 'user_id' does not exist on type 'ApiAuthResult'`:
  - `app/api/v1/tickets/check-in/route.ts:38` (POST, `scan_ticket_qr`)
  - `app/api/v1/tickets/check-in/route.ts:50` (POST, `check_in_ticket`)
  - `app/api/v1/tickets/check-in/route.ts:117` (PUT, bulk `check_in_ticket`)
  - `app/api/v1/events/route.ts:158` (`created_by` field, with comment "Use tenant owner if no user")
- Root cause: `validate_api_key` RPC may return a `user_id` field that the TS validator function silently dropped. The interface had no `user_id` field, so callers referencing `authResult.user_id` triggered TS2339.

**Choices made:**
- **Chose Option B (extend the type) over Option A (remove from callers).** Reasons:
  1. The developer comment at `events/route.ts:158` ("Use tenant owner if no user") makes `user_id` an explicit optional concept — a user-bound API key vs a tenant-bound API key. Removing the field would erase that distinction.
  2. All 4 caller sites already have `||` fallbacks (`performed_by || authResult.user_id`, `authResult.user_id || authResult.tenant_id`), so runtime `undefined` is handled gracefully.
  3. If the RPC IS returning `user_id`, this fix restores a feature the legacy validator was silently dropping. Net behavior: either no-op (RPC doesn't return user_id) or bug-fix (RPC does, but was being dropped).
- **Made `user_id` optional, not required.** Reason: the 4 error-branch returns in `validateApiKey` (lines 20-27, 33-40, 51-58, 62-69) all have `valid: false` and no user_id available. Making it optional means they don't need to change. And the success branch's `data.user_id` may itself be undefined if the RPC doesn't return it.
- **Did NOT modify any caller.** Two-line type fix in the helper file is enough. The 4 caller sites compile correctly with no further changes.
- **Did NOT verify the RPC source.** `grep -rn "validate_api_key" scripts/` returned no results — the RPC source is in Supabase, not the repo. The fix is correct regardless of whether the RPC returns user_id (see "Choices made" #1-2 above).

**Pre-edit verifications:**
- Read full `lib/middleware/api-auth.ts` (87 lines) to confirm interface shape, validator return shape, all error branches.
- Read `app/api/v1/tickets/check-in/route.ts:38, 50, 117` (post-iter-15 state, 130 lines total).
- Read `app/api/v1/events/route.ts:158` (the only sibling drift site).
- `grep -n "authResult\.user_id"` repo-wide → confirmed exactly 4 caller sites, no other consumers in `lib/` or non-v1 code.
- `grep -rn "validate_api_key" scripts/` → empty. RPC source not in repo.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 266 (was 270). Exactly 4 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter15-after.txt ralph-dev/tsc-errors-iter16-after.txt` → 4 lines deleted, 0 added. Most surgical iter so far.
- `grep "tickets/check-in/route.ts" ralph-dev/tsc-errors-iter16-after.txt` → empty. File is fully clean.
- `grep "TS2339" ralph-dev/tsc-errors-iter16-after.txt | grep -E "(check-in|events/route)"` → empty. All 4 sites closed.
- `grep "api-auth\.ts" ralph-dev/tsc-errors-iter16-after.txt` → empty. The helper edit didn't introduce any new errors.

**Out of scope deliberately:**
- The remaining ~13 errors in `events/route.ts` (api-response drift). iter-17 target.
- The 4 errors in `purchase/route.ts` (Stripe drift + idempotency drift). Iters 17+.
- The 19 TS2551 typos. Mechanical batch.
- Validator-level changes beyond threading `user_id` through. The error branches still don't include `user_id` — they have nothing to thread.

**Acceptance flipped:** None directly. But `app/api/v1/tickets/check-in/route.ts` is now fully clean (zero remaining errors). Phase 3 aggregate boxes; 266 errors still to go.

**Learned:**
- **iter 16 convention — when the developer-intent comment in code reveals optional-field semantics, prefer the "extend the type" fix over the "remove from callers" fix.** Comments like "Use tenant owner if no user" at `events/route.ts:158` are a load-bearing signal: the developer DESIGNED for the field to be optional. Erasing the field by replacing it with a sibling (e.g., `api_key_id`) breaks that design. The optional-type extension preserves the distinction at no extra cost (the `||` fallbacks in callers already handle `undefined`).
- **iter 16 convention — cross-file type-level sweeps can be 2-line fixes.** When the root cause is a missing interface field, the fix lives entirely in the type definition. Don't touch any caller; the type-checker will propagate the fix to every reference. This is the highest-leverage fix pattern: 1 file edited, 4 errors closed, no caller churn.
- **iter 16 convention — when the source-of-truth (RPC source, external schema) is unavailable, design the fix to be correct under both branches of the unknown.** Here: the RPC may or may not return `user_id`. By making the field optional AND threading `data.user_id` through (which is `undefined` if absent), the fix is a no-op in the "RPC doesn't return it" branch and a bug-fix in the "RPC does return it but was being dropped" branch. Never strictly wrong.

## Iter 15 fix detail (previous iter)
**Action:** Edited `app/api/v1/tickets/check-in/route.ts` in 4 surgical chunks (one per logical block: imports + POST auth/scope/rate-limit/body-validation header; both `database_error` sites + the line-61 metadata-bag rewrite to raw `NextResponse.json`; POST catch-block + PUT auth/scope/body-validation; PUT catch-block).

**Canonical-name remap applied (file-specific):**
- `"permission_denied"` → `"authorization_error"` (403)
- `"database_error"` → `"internal_error"` (500 — same status, no behavior change at runtime)
- `"check_in_failed"` → `"invalid_request"` (400) with `code: "check_in_failed"` preserved in the response body (semantic preservation via the helper's optional `code` field — but since the iter required raw `NextResponse.json` anyway for the metadata bag, the `code` was embedded directly in the JSON shape)

**Convention applied:**
- Dropped all 8 redundant 3rd-arg status codes on `apiError(...)` calls (lines 11, 20, 29, 76, 85, 98, 102, 127). All matched the auto-derived `STATUS_CODES[type]` value; no behavior change.
- Added `{ rateLimit: rateLimitResult }` to the rate-limit-exceeded response at line 20 — correctness improvement matching iters 13/14. Lets the helper emit `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` via `addRateLimitHeaders`.
- For the line 61 site (`apiError("check_in_failed", msg, 400, {}, { checked_in_at })`), the helper has NO slot for arbitrary metadata in the error body. Dropped to raw `NextResponse.json` with the canonical error shape extended by `code: "check_in_failed"` AND `checked_in_at: result?.checked_in_at`. This matches the iter-14 helper-fallback pattern.
- **iter-15 finding (runtime bug fix, not just type fix):** The line 61 legacy call was a runtime bug — `STATUS_CODES["check_in_failed"]` was `undefined`, so the response status was `undefined`, which `NextResponse.json` defaults to 200. The error was being served as HTTP 200 OK with `{error:{type:"check_in_failed",message:...}}`. Worse, the `checked_in_at` metadata was being silently dropped (4th/5th args ignored by `apiError`). The raw `NextResponse.json` rewrite restores BOTH the correct 400 status AND the developer-intent `checked_in_at` field. This is a real behavior fix smuggled in under a type fix — call out explicitly in the FIXES_APPLIED.md eventually.

**Diagnosis:**
- 16 errors total at iter-15 entry: 8 × TS2559 (status-as-3rd-arg), 4 × TS2345 (bad type name: `permission_denied` ×2, `database_error` ×2), 1 × TS2554 (line 61: 5 args to `apiError`), 3 × TS2339 (`authResult.user_id` shape drift).
- Of those 16, 13 are within the api-response caller-alignment scope (TS2559/TS2345/TS2554 against the api-response helper). The other 3 errors (TS2339 user_id) are from a different root cause — `ApiAuthResult` shape drift. Deferred per "one root cause per iter" discipline AND batched with the matching 1 site in `events/route.ts` for an iter-16 sweep.

**Choices made:**
- **Did NOT extend the api-response helper with a `metadata?` or `extras?` option.** The single `check_in_failed` metadata-bag use case was solvable at the caller level with raw `NextResponse.json` (matching iter-14's `Idempotent-Replayed` fallback pattern). Extending the helper would be cross-cutting (affects 11+ callers) and adds API surface for one site. The caller-level workaround preserves helper minimalism.
- **Mapped `"check_in_failed"` to `"invalid_request"` (400)** rather than `"validation_error"` (422). Both legacy and new map to 400; `invalid_request` is the same-status canonical name. The semantic name `check_in_failed` is preserved as the `code` field on the response body, so API consumers can still distinguish it.
- **Did NOT fix the 3 TS2339 `authResult.user_id` errors in this iter.** Different root cause (auth shape drift). Recommended next-iter sweep: fix the 3 sites in `check-in/route.ts` AND the 1 site in `events/route.ts` (4 errors total) in one coherent fix once the `validate_api_key` RPC schema is confirmed. See "What's next" #1.
- **Used 4 Edit calls** rather than one Write rewrite. Stays surgical and isolates failure modes per chunk.
- **Did NOT pre-emptively fix Stripe drift or idempotency drift in this file.** Neither was present in `check-in/route.ts` (grepped for `apiVersion` and `checkIdempotency`/`storeIdempotency` — zero hits). Pre-flight read of `lib/middleware/idempotency.ts` was still valuable: it confirmed the canonical signatures so the next iter targeting `purchase`, `refund`, or `transactions` can fix idempotency drift surgically.

**Pre-edit verifications:**
- Read full `app/api/v1/tickets/check-in/route.ts` (130 lines).
- Re-read full `lib/middleware/api-response.ts` (116 lines) for confirmation.
- Read `lib/middleware/api-auth.ts` (87 lines) to confirm `ApiAuthResult` shape (no `user_id` field).
- Read `lib/middleware/idempotency.ts` (112 lines) for canonical idempotency-helper signatures (preps iter 16+).
- Cross-checked iter-14 tsc capture against `(11,86)`/`(15,23)`/... — confirmed 16 errors keyed to this file, broken down per the diagnosis above.

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 270 (was 283). Exactly 13 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter14-after.txt ralph-dev/tsc-errors-iter15-after.txt` → 14 lines deleted, 1 added. The 1 added is just the `user_id` TS2339 at line 109 shifting to line 117 (raw `NextResponse.json` block added lines). Net: 13 distinct errors eliminated.
- `grep "tickets/check-in/route.ts" ralph-dev/tsc-errors-iter15-after.txt` → 3 remaining errors, all from `ApiAuthResult.user_id` shape drift (lines 38, 50, 117). Deferred per discipline.

**Out of scope deliberately:**
- The 3 × TS2339 `authResult.user_id` errors in this file (and 1 sibling in `events/route.ts`). Sweep planned for iter 16 — see "What's next" #1.
- The 4 other dense v1 cluster files (`events/route.ts`, `ticket-types/route.ts`, `orders/[orderId]/refund/route.ts`, plus any lower-density v1 files). Iters 17+.
- The 19 TS2551 typos. Mechanical batch.
- Aliasing legacy names into `ApiErrorType` or extending the helper. Both would extend/pollute the contract; caller-side fixes are right direction.

**Acceptance flipped:** None. ACCEPTANCE Phase 3 boxes are aggregate ("Zero TypeScript errors", "All missing type definitions added"); 270 errors still to go.

## Iter 14 fix detail
**Action:** Edited `app/api/v1/tickets/purchase/route.ts` in 8 surgical chunks (one per logical block: import line; auth/scope/rate-limit/idempotency block; body-validation; event-lookup/status-check; availability loop; order-create; replace_all on `apiSuccess(_, {}, 201)`; catch-block).

**Canonical-name remap applied (file-specific):**
- `"permission_denied"` → `"authorization_error"` (403)
- `"not_found"` → `"resource_not_found"` (404)
- `"inventory_error"` → `"invalid_request"` (400 — same status as legacy semantic)
- `"order_error"` → `"invalid_request"` (400 — same status as legacy semantic)

The remap follows iter-13's principle: map to the canonical name whose status matches the legacy 3rd-arg status. For semantic-name divergence (`"inventory_error"` and `"order_error"` aren't natively `"invalid_request"`-meaning), the user-facing message string already carries the real meaning ("Tickets not available", "Failed to create order").

**Convention applied:**
- Dropped all 3rd-arg status codes on `apiError(...)` calls. The helper auto-derives status from `STATUS_CODES[type]`; in every case the dropped arg matched the auto-derived value, so no behavior change.
- For both `apiSuccess(response, {}, 201)` sites (lines 121, 187 originally — same string), rewrote as `apiSuccess(response, { status: 201 })`. The helper accepts `status` as an option.
- For the `apiSuccess(cached, { "Idempotent-Replayed": "true" })` site at line 34, dropped to raw `NextResponse.json(cached, { headers: { "Idempotent-Replayed": "true" } })`. The helper has no `headers?: Record<string, string>` option, so the legacy code was silently emitting NO headers (the helper destructured `options?.rateLimit/status` and ignored the unknown property). Rewriting to raw `NextResponse.json` restores the developer's evident intent — the legacy code never actually emitted the header at runtime.
- Added `{ rateLimit: rateLimitResult }` to the rate-limit-exceeded response at line 26 — same correctness improvement applied in iter 13. Lets the helper emit `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` via `addRateLimitHeaders`.

**Diagnosis:**
- 16 errors total at iter-14 entry: 11 × TS2559 (status-as-3rd-arg), 4 × TS2345 (bad type name: `permission_denied`, `not_found`, `inventory_error`, `order_error`), 1 × TS2353 (apiSuccess headers bag with `Idempotent-Replayed`), 2 × TS2554 (`apiSuccess(_, {}, 201)` — 3rd positional arg disallowed).
- Of those 16, 12 are within the iter-13 caller-alignment scope (TS2559/TS2345/TS2353/TS2554 against the api-response helper). The other 4 errors in the file are from different root causes — Stripe apiVersion (line 10) and idempotency helper signature (lines 32, 118, 184). Deferred per "one root cause per iter" discipline.

**Choices made:**
- **Did NOT extend the api-response helper with a `headers?` option.** The single `"Idempotent-Replayed"` use case was solvable at the caller level with raw `NextResponse.json`. Extending the helper would be cross-cutting (affects 11 other callers) and adds API surface for one site. The caller-level workaround preserves helper minimalism.
- **Used `replace_all: true` on the `apiSuccess(response, {}, 201)` edit** since both occurrences were identical. The Edit tool reported "All occurrences were successfully replaced" but only one was actually changed (line 121 → fixed; line 187 → unchanged). A follow-up surgical Edit at line 187 closed the second occurrence. Learned: replace_all should still be verified with a re-read of the file — the tool is not 100% reliable on multi-occurrence replace.
- **Mapped `"inventory_error"` and `"order_error"` to `"invalid_request"`** rather than `"validation_error"`. Both legacy types map to 400; `invalid_request` is also 400 (`validation_error` is 422). Picking the same-status canonical name minimizes status-code drift.
- **Used 8 Edit calls** rather than one Write rewrite. Stays surgical and isolates failure modes per chunk.
- **Did NOT fix the Stripe drift at line 10 in this iter.** Per "one root cause per iter," that's a separate fix using the iter-11 recipe (replace `new Stripe(...)` with `import { stripe } from "@/lib/stripe"`). Defer to iter 15 or later. Also noted: iter-11's STATE.md claimed §2c was "complete" with 3 files — but `purchase/route.ts` was missing from that pass. Open finding (see Open notes below).

**Pre-edit verifications:**
- Read full `app/api/v1/tickets/purchase/route.ts` (193 lines) and full `lib/middleware/api-response.ts` (116 lines, re-read for confirmation).
- Cross-checked iter-13 tsc capture against `(17,86):`/`(21,23):`/... — confirmed 16 errors keyed to this file, broken down per the diagnosis above.
- Already had verified helper-usage breadth in iter 13 (12 files, all v1) — no risk of helper edits affecting non-v1 code (and this iter didn't edit the helper anyway).

**Post-edit verifications:**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → 283 (was 295). Exactly 12 errors eliminated, zero added.
- `diff ralph-dev/tsc-errors-iter13-after.txt ralph-dev/tsc-errors-iter14-after.txt` → 12 lines deleted, 0 added.
- `grep "tickets/purchase/route.ts" ralph-dev/tsc-errors-iter14-after.txt` → 4 remaining errors, all from different root causes than the iter-14 scope:
  - Line 10: TS2322 Stripe apiVersion drift (iter-11 recipe applies)
  - Line 32: TS2345 `checkIdempotency` signature drift
  - Lines 118, 184: TS2554 `storeIdempotentResponse` signature drift

**Out of scope deliberately:**
- The Stripe `apiVersion` drift at line 10. Same fix as iter 11 (`import { stripe } from "@/lib/stripe"`). Defer to iter 15 or a dedicated "v1 Stripe drift sweep" iter that handles purchase + refund in one root-cause pass.
- The idempotency helper signature drift (3 errors). Different root cause; needs reading `lib/middleware/idempotency.ts` to understand the canonical signature. The fix likely applies to 3 v1 caller files (`tickets/purchase`, `orders/[orderId]/refund`, `transactions/route.ts` — confirmed via grep).
- The 4 other dense v1 cluster files (`tickets/check-in`, `events/route.ts`, `ticket-types/route.ts`, `orders/[orderId]/refund/route.ts`). Same recipe — iters 15+.
- Aliasing legacy names into `ApiErrorType` or extending `apiSuccess` with a `headers?` option. Both would extend/pollute the contract; caller-side fixes are right direction.
- Mass-fixing the 19 TS2551 typos. Mechanical low-density batch; sits in the queue.

**Acceptance flipped:** None. ACCEPTANCE Phase 3 boxes are aggregate ("Zero TypeScript errors", "All missing type definitions added"); 283 errors still to go.

## Open notes
- TRIAGE §3 broken-import count: **4 of 4 fixed** (iters 7, 8, 9, 10). Complete.
- TRIAGE §2c Stripe apiVersion drift: **FULLY CLOSED at iter 18.** 3 files fixed at iter 11 + 2 files fixed at iter 18 (`app/api/v1/tickets/purchase/route.ts`, `app/api/v1/orders/[orderId]/refund/route.ts`). Repo-wide grep `apiVersion: "2024-12-18.acacia"` → empty. Total 5 callers migrated to the `lib/stripe.ts` canonical singleton.
- V1 API cluster: **7 of 7 originally-named dense files fully clean.** (iter 13: events/[eventId]; iter 14+18+19: tickets/purchase; iter 15+16: tickets/check-in; iter 17: events/route.ts; iter 18+19+20: refund/route.ts; iter 21: ticket-types/route.ts; transactions/route.ts already clean entering iter 19). **DENSE V1 API CLUSTER WORK FULLY DONE.** Recipe well-tested over 6 successful api-response drift applications (iters 13/14/15/17/20/21).
- **Idempotency helper drift:** **FULLY CLOSED at iter 19** via canonical-signature alignment across 2 caller files (purchase, refund; transactions was already canonical). 6 errors closed total (5 idempotency + 1 coupled api-response TS2353 in refund). Repo-wide grep confirms all 3 caller files now use `checkIdempotency(req, tenantId)` and `storeIdempotency/storeIdempotentResponse(req, tenantId, apiKeyId, {status, body}, durationMs)` canonical signatures.
- **`ApiAuthResult.user_id` shape drift:** **CLOSED at iter 16** via 2-line type extension in `lib/middleware/api-auth.ts`. Added `user_id?: string` to interface + threaded `data.user_id` through in success-branch return. Zero caller changes. 4 errors closed (3 in check-in, 1 in events/route).
- Phase 3 progress: 331 → 169 errors (162 eliminated across iters 7-24, average ~8.1 per iter — dense v1 cluster work in iters 13/14/15/17/20/21 running at 8-15 per iter, iter 16 type sweep at 4 errors, iter 18 small sweep at 2 errors, iter 19 idempotency sweep at 6 errors across 2 files, iter 22 TS2551 batch at 21 errors across 8 files, iter 23 missing-await sweep at 26 errors in 1 file, iter 24 field-additions partial sweep at 9 errors in 1 file). Refresh tally with `grep -oP "error TS\d+" ralph-dev/tsc-errors-iter24-after.txt | sort | uniq -c | sort -rn` next iter.
- **`lib/role-actions.ts` missing-await sweep:** **CLOSED at iter 23** via 2 edits (replace_all on 6 identical 2-line blocks + remove dead `cookies` import). 26 errors eliminated (20 × TS2339 + 6 × TS2554) — both error classes had a single root cause (caller-side legacy pattern against the new `async createClient()` signature). **Iter 24 verified the legacy pattern is NOT repo-wide drift** — `grep -rln "createClient(cookieStore)"` returned 0 hits, and a careful check of 242 `@/lib/supabase/server` importers found zero non-awaited `= createClient()` patterns. The drift was self-contained to `role-actions.ts`. Closed.
- **`tournament-controller.tsx` Cluster C (missing-field interface drift):** **CLOSED at iter 24** via 2 surgical edits adding optional fields to two manually-typed `matches` array prop interfaces. 9 errors eliminated. Columns confirmed real in `scripts/042/050/053` (no schema-drift warning). Clusters A (5 × discriminated-union narrowing) and B (3 × `TournamentStatus` enum mismatch) remain — iter-25 candidates.
- **TS2551 cluster:** **FULLY CLOSED at iter 22.** All 19 errors closed across 3 root causes: (a) 10 × `.catch()` on Supabase PostgrestFilterBuilder → `.then(undefined, handler)` in 8 files, (b) 6 × `player1_wins/player2_wins` in `my-events/page.tsx` → SELECT-column addition (also closed 2 incidental TS2339s for `is_bye`), (c) 4 × `reported_player1_draws/_player2_draws` in `tournament-controller.tsx` → optional interface fields.
- **Runtime concerns surfaced at iter 22 (NOT type bugs, do not re-fix in Phase 3):**
  - `admin-actions.ts:148-161`, `admin-actions.ts:619-631`, `media-actions.ts:220-226`, `wallet-actions.ts:899-917`: the `.then(undefined, handler)` fallback bodies have un-awaited Supabase chain calls that fire-and-forget. Plus Supabase RPC errors are returned in `{error}` not thrown, so the fallback rarely triggers. Phase 4 / runtime testing.
  - `tournament-controller.tsx:188-201` interface added `reported_player1_draws`/`reported_player2_draws` as optional. The server-side writes at `tournament-controller-actions.ts:593, 637` set these as required columns. **No `ADD COLUMN` migration found in `scripts/`**. Probable schema drift — columns may not exist in the DB at all. Needs Mark + runtime test to confirm; if missing, write `scripts/140_add_match_dispute_draws.sql`.
  - `app/dashboard/my-events/page.tsx:518` has a residual TS2339 on `tournament_rounds?.round_number` because the relation is typed as an array but the code accesses it as an object. Different root cause; iter-23+.
- `app/(dashboard)/notifications/page.tsx`: fully clean after iter 12.
- `app/api/v1/events/[eventId]/route.ts`: fully clean after iter 13. Reference pattern for "v1 API caller alignment" fixes.
- `app/api/v1/tickets/purchase/route.ts`: **fully clean after iter 19.** api-response drift cleaned at iter 14 (12 errors); Stripe drift cleaned at iter 18 (1 error); idempotency drift cleaned at iter 19 (3 errors). Reference pattern for "raw NextResponse.json fallback when helper has no equivalent option" AND for "preserve cached-response status code in idempotency replays."
- `app/api/v1/ticket-types/route.ts`: **fully clean after iter 21.** api-response drift cleaned (12 errors: 7 × TS2559, 4 × TS2345 for `database_error` ×2 / `permission_denied` / `not_found`, 1 × TS2554 for `apiSuccess(_, {}, 201)`). Reference pattern for "generic legacy name remap without `code` preservation" — both `database_error` sites map to `internal_error` (500) with no `code`, because `database_error` is as generic as `internal_error`, so consumers gain nothing from a subtype.
- `app/api/v1/orders/[orderId]/refund/route.ts`: **fully clean after iter 20.** Stripe drift cleaned at iter 18 (1 error); idempotency drift + coupled TS2353 cleaned at iter 19 (3 errors); api-response drift cleaned at iter 20 (8 errors). Total 12 errors closed across 3 iters. Reference pattern for "two `code`-preservation sites in the same file" — both `stripe_refund_failed` and `refund_failed` use the `internal_error` + `code` pattern to distinguish Stripe-layer vs ledger-layer 500s.
- `app/api/v1/transactions/route.ts`: **clean entering iter 19 and still clean.** Reference pattern for canonical idempotency-helper integration (L116-118 for check, L165 for store, L8 for `startTime` placement). Used as the gold-standard template for iter 19's alignment work.
- `lib/middleware/idempotency.ts`: 3 callers confirmed at iter 19 (purchase, refund, transactions). Both `storeIdempotency` (canonical, line 50) and `storeIdempotentResponse` (alias re-export, line 86) are valid. `IdempotencyResult` shape: `{found: boolean, response?: {status: number, body: unknown}}`. Canonical signatures: `checkIdempotency(req: Request, tenantId: string)`, `storeIdempotency(req, tenantId, apiKeyId, response, durationMs)`.
- `lib/stripe.ts`: canonical Stripe SDK singleton. 5 callers now use it (3 pre-iter-11, 2 added iter 18). Reference pattern for "name-preserving canonical-singleton migration" — the variable name `stripe` is preserved between `const stripe = new Stripe(...)` and `import { stripe }`, so zero caller-side changes are needed at the call site of every instance method.
- `app/api/v1/tickets/check-in/route.ts`: **fully clean after iter 16.** api-response drift cleaned at iter 15 (13 errors); auth-shape drift cleaned at iter 16 (3 errors). Reference pattern for "raw `NextResponse.json` body extension with `code` + metadata when helper's typed `{code, param}` slot is insufficient." Also reference for "type fix that is also a runtime bug fix" — the legacy `apiError("check_in_failed", ..., 400, {}, {meta})` was serving 200 status with no `checked_in_at` in the body; the rewrite restores 400 status AND the metadata.
- `app/api/v1/events/route.ts`: **fully clean after iter 17.** api-response drift cleaned (13 errors). Reference pattern for "type fix that is also a behavior fix" — L18/L77 were silently dropping rate-limit headers at runtime; the rewrite restores `addRateLimitHeaders`-driven emission. Also reference for "canonical-type remap with `code` preservation when status matches but semantic doesn't" (the `duplicate_error` → `idempotency_error` mapping with `code: "duplicate_slug"`).
- `lib/middleware/api-auth.ts`: extended at iter 16 with `user_id?: string`. Reference pattern for "cross-file type-level sweep" — 2-line fix in the helper closes 4 caller errors with zero caller churn.
- `components/tournaments/tournament-controller.tsx`: Cluster C (9 missing-field errors) closed at iter 24 via optional-field additions to two manually-typed `matches` array interfaces (L167-177 + L188-204). 8 errors remain in the file: Cluster A (5 × discriminated-union narrowing on helper return types — L615 `.message`, L620 `.playerName`, L861/L887 `.pairingsCount`, L1523 `.minutes`) and Cluster B (3 × `TournamentStatus` enum mismatch — L776/L795/L829 with `"registration"`/`"completed"`). Reference pattern for "multiple manually-typed interfaces for the same shape need separate extension" — the file has TWO `matches` array shapes (`currentRound.matches` and `allRounds[].matches`), each had its own field omissions.
- `ralph-dev/tsc-errors.txt` (iter 1 baseline) remains canonical for iter-1 snapshot. Each iter writes `ralph-dev/tsc-errors-iter{N}-after.txt` post-fix.
- Conventions surfaced so far:
  - **iter 7:** Switch broken imports to the canonical equivalent rather than create the missing module — unless 2+ callers exist for the new abstraction.
  - **iter 8:** Consolidate onto an existing import line in the same file rather than adding a separate import statement.
  - **iter 9:** Delete broken-import files with zero callers rather than fixing them. Deletion test: grep for importers; if zero, the file is dead.
  - **iter 10:** For `Cannot find name` errors inside helper sub-components, the fix is prop thread-through (add to helper props, pass at call site, match outer optionality). Guard render sites with `&& <value>` to satisfy strict downstream contracts rather than loosening them.
  - **iter 11:** When the canonical equivalent is a configured SDK client singleton and ad-hoc per-caller instantiations exist with drifted config, switch the callers to the singleton — even when 2+ ad-hoc callers exist — because the singleton eliminates the whole class of "config drift over time" bug.
  - **iter 12:** For "missing union member in `Record<Union, T>`" errors (TS2741), add the missing key adjacent to the most semantically-related existing key (not at the end), and mirror the values of that related key when the new variant is a sibling rather than a distinct case.
  - **iter 13:** When many callers drift from a canonical helper (legacy names + extra positional args), align callers to the helper rather than aliasing the contract — even when caller count is high. Verify helper-usage breadth first; do the work one caller-file per iter to stay incremental.
  - **iter 14:** When applying the caller-alignment recipe to a target file, surface ALL errors keyed to the file at iter entry, not just the ones matching the recipe's primary error pattern (TS2559/TS2345). A file like `purchase/route.ts` had 16 errors of which only 12 were api-response drift — the other 4 (Stripe drift, idempotency drift) are valid follow-up targets but should NOT be conflated with the recipe-application iter. Discipline: "one root cause per iter" applies WITHIN a file, not just across files. Tag the file as "api-response drift cleaned" — not as "fully clean" — when only the recipe's targeted errors are closed. Companion convention: when a helper has NO equivalent option for a legacy use case (e.g., the `Idempotent-Replayed` header), prefer caller-level workaround (raw `NextResponse.json`) over extending the helper API — keeps the helper minimal and avoids cross-cutting changes during a per-file iter.
  - **iter 14 (tool note):** `Edit` with `replace_all: true` on a multi-occurrence string is NOT 100% reliable — verify with a re-read or a follow-up tsc count. In this iter, `replace_all` on `apiSuccess(response, {}, 201)` left one of two occurrences unchanged despite reporting "All occurrences were successfully replaced." Mitigated by a follow-up surgical Edit. Convention: never trust the multi-replace report blindly; always verify post-Edit with the same grep/tsc that catches the original error.
  - **iter 15:** When a recipe-application iter finds errors that span MULTIPLE files for the same OUT-OF-SCOPE root cause (here: `ApiAuthResult.user_id` shape drift in BOTH `check-in/route.ts` AND `events/route.ts`), tag it as a "sweep candidate" in the next-iter recommendations. Cross-file root causes deserve a single coherent fix iter rather than being closed file-by-file. Batch by root cause across files when the fix is the same; do per-file iters only when fixes diverge.
  - **iter 15 (helper-fallback enrichment):** When the iter-14 raw `NextResponse.json` fallback is applied, take the opportunity to ENRICH the response with legacy developer-intent data that the helper silently dropped. In iter 15, the line-61 metadata bag `{ checked_in_at }` AND the semantic name `check_in_failed` (which would have been the response `type` field) were BOTH being silently dropped by the helper. The rewrite restored BOTH: `code: "check_in_failed"` for semantic preservation, `checked_in_at` for the time data. Type fixes can be runtime bug fixes in disguise — surface this in the iter writeup so the FIXES_APPLIED.md eventually catches it.
  - **iter 15 (pre-flight read pattern):** When the "What's next" recommendation calls for pre-flight reads of helpers that aren't strictly needed for the target file (here: `lib/middleware/idempotency.ts`, needed for iter 16+ files but not for check-in), DO the pre-flight read anyway. It pays off in the NEXT iter when the recipe is applied to a file that uses those helpers. Pre-flight reads are cheap and the canonical signatures don't change file-to-file. Convention: when STATE.md recommends pre-flight reads, do all of them in the iter, even if the target file doesn't use them. Cache the canonical signatures in the iter writeup so the next iter can apply them without re-reading.
  - **iter 16 (extend-the-type vs remove-the-field):** When a developer-intent comment in code reveals optional-field semantics (here: `created_by: authResult.user_id || authResult.tenant_id, // Use tenant owner if no user`), prefer extending the type over removing the field from callers. The comment is a load-bearing signal that the developer DESIGNED for the field to be optional; erasing the field by substituting a sibling breaks that design.
  - **iter 16 (correct-under-both-unknowns):** When the source-of-truth (RPC source, external schema) is unavailable, design the fix to be correct under both branches of the unknown. Here, the RPC may or may not return `user_id`; the fix (optional field + thread `data.user_id` through) is a no-op if absent, a bug-fix if present. Never strictly wrong.
  - **iter 16 (2-line cross-file sweep):** Cross-file type-level sweeps can be 2-line fixes. When the root cause is a missing interface field, the fix lives entirely in the type definition. Don't touch any caller; the type-checker propagates the fix to every reference. Highest-leverage fix pattern: 1 file edited, 4 errors closed, no caller churn.
  - **iter 17 (type-fix is behavior-fix when manual headers are silently dropped):** When the legacy code passes manual header keys (`X-RateLimit-*`) into `apiError`/`apiSuccess` options shapes that don't accept arbitrary headers, TS errors AND the runtime silently dropped the headers. The rewrite to `{ rateLimit: rateLimitResult }` restores `addRateLimitHeaders`-driven emission. Surface in FIXES_APPLIED.md as a behavior-fix: rate-limit-aware clients now actually receive `Retry-After`, `X-RateLimit-Remaining`, etc.
  - **iter 17 (canonical-type remap with `code` preservation generalized):** When the legacy name has no exact canonical equivalent but matches a status (here: `duplicate_error` → `idempotency_error`, both 409), use the closest-status canonical type and carry the precise legacy semantic in the `code` field. Generalization of iter-15's `code: "check_in_failed"` pattern. Status preservation > semantic-name preservation; `code` bridges the gap.
  - **iter 17 (recipe maturity):** Same-file recipe applications get cleaner across iters. Iter 17 (events/route) had ZERO file-specific surprises — every error mapped to a known recipe element. The "v1 api-response drift" recipe is now well-tested over 4 successful applications (iters 13/14/15/17). Iter 18+ should be even faster.
  - **iter 18 (TRIAGE-list completeness verification):** When a multi-pass triage finds N files and a later iter surfaces N+K, do the cross-file grep AGAIN before claiming closure on the next pass. The grep is cheap; the false-closure claim is expensive (it can leave drift errors lingering forever). iter 18 confirmed iter 11's TRIAGE §2c claim was incomplete (3 files known → 5 actually had the drift) and closed §2c properly by re-grepping repo-wide before declaring done.
  - **iter 18 (minimum-diff cross-file sweep template):** For "same fix in N files" sweeps, the smallest correct unit of work is 1 Edit per file, each replacing exactly the legacy block with exactly the canonical replacement. No collateral edits, no helper changes. iter 18 was the cleanest application of this template: 2 Edits, 2 errors closed, 12-line net diff (most line-shift artifacts), zero new errors.
  - **iter 18 (name-preserving singleton swaps):** When swapping `const stripe = new Stripe(...)` for `import { stripe } from "..."`, the variable name `stripe` is intentionally preserved between source and replacement. This means ZERO caller changes — all instance-method calls (`stripe.checkout.sessions.create`, etc.) compile unchanged. If the singleton had been named `stripeClient` instead, every call site would need an edit. Name-preservation is a load-bearing decision in singleton-design and should be a deliberate criterion when designing new helpers/exports.
  - **iter 19 (verify cached pre-flight findings against the source of truth):** When a previous iter caches API signatures for a future iter (e.g., iter-15 cached `lib/middleware/idempotency.ts` signatures for iter 16+), re-read the source of truth at the future iter's entry. iter-15's cache had two errors (claimed `cached` field, suggested one export name was wrong) that re-reading the helper at iter-19 entry corrected. Generalization: caching is for context, not for correctness — cheap to re-verify, expensive to act on stale info.
  - **iter 19 (coupled fixes that collapse naturally are still in scope):** The L28 TS2353 in refund was technically api-response drift, not idempotency drift. But fixing L26 (idempotency) changed `cached` from string to `IdempotencyResult` — the natural rewrite of L28 to use `cached.response.body` requires the raw `NextResponse.json` fallback anyway, which incidentally closes the TS2353. Don't artificially split coupled fixes across iters — count the side-effect closure as a bonus, not scope creep.
  - **iter 19 (in-repo reference patterns as gold standard):** When a reference pattern exists in-repo, treat it as gold standard and align to it. `transactions/route.ts` already used canonical idempotency signatures — reading it first gave a working template that purchase and refund just had to match. Cheaper than designing from the helper signature alone — the reference shows developer-intent for HOW to integrate (e.g., where to place `startTime`, what status code to use in `{status, body}`).
  - **iter 19 (preserve cached-response status code in idempotency replays):** Using `cached.response.status` (not a hardcoded 200) means a free-order replay returns 201, a paid-order replay returns 201, etc. — matches the original request. The legacy `apiSuccess(cached, ...)` would have stripped this, defaulting to 200. The raw `NextResponse.json` rewrite restores it. Type fix + behavior fix combined.
  - **iter 20 (predictive line-counts may be off; recipe is robust):** STATE.md's iter-19 prediction of "5 × TS2559 + 3 × TS2345" was actually 4 + 4 at iter-20 entry. The discrepancy didn't matter because the recipe applies per-error, not per-error-class-count. Generalization: when recommending a recipe in "What's next," trust the recipe more than the exact line count. Always re-grep at iter entry for the canonical count.
  - **iter 20 (`code` preservation generalized to multi-site in one file):** Iter 15 used `code` once (`check_in_failed`); iter 17 used `code` once (`duplicate_slug`); iter 20 used `code` TWICE in the same file (`stripe_refund_failed` for Stripe-layer failures, `refund_failed` for ledger-layer failures). Both legacy names mapped to the same canonical `internal_error` (500); the `code` distinguishes them at the consumer level. Pattern is robust under multi-site per-file use.
  - **iter 20 (cleanest-possible diff confirms recipe maturity):** Iter 20's diff was 8 lines deleted, 0 added, zero line-shift artifacts. Cleanest profile achievable for a same-file recipe application. The recipe is now mature enough that file-specific surprises are rare; predict iter 21 (`ticket-types/route.ts`) to have a similar profile.
  - **iter 21 (skip `code` preservation when legacy name is as generic as the canonical):** Use `code` only when the legacy name encodes a meaningful subtype that the canonical category subsumes. iter 21's `database_error` → `internal_error` mapping needed NO `code` because both are equally generic — there's no subtype to preserve. Generalization: ask "would API consumers branch differently on the legacy name vs the canonical?" If yes, preserve via `code`; if no, drop. Saves response-body fields and consumer-side branching.
  - **iter 21 (recipe maturity; predict 1-iter-per-file clean diffs for any future api-response drift):** The recipe handles every case observed: legacy type name, status-as-3rd-arg, wrong arg shape on apiSuccess, helper-has-no-equivalent (raw NextResponse fallback), code preservation when subtype matters. Future api-response drift in non-v1 routes (if discovered) should be 1-iter-per-file with predictable clean diffs.
  - **iter 21 (dense v1 cluster milestone):** 7 files cleaned across 6 iters covering ~85 errors. The "v1 api-response drift caller-alignment" recipe is now a stable named pattern; should be referenced explicitly in FIXES_APPLIED.md.
  - **iter 22 (TS2551 "did you mean" is often semantically wrong):** Compiler suggestions for TS2551 are pure string-distance, not semantic. `player1_id` ≠ `player1_wins`, `match` method ≠ `.catch`. Treat the suggestion as a hint, not a directive; root-cause-analyze each cluster of similar-structured errors. The "mechanical batch" label is misleading — TS2551 errors usually represent 3-5 distinct root causes that each require source analysis.
  - **iter 22 (canonical Supabase PostgrestFilterBuilder `.catch` fix):** `.catch(handler)` → `.then(undefined, handler)`. Runtime-equivalent. Zero restructuring. Established recipe — if future Supabase code introduces more `.catch` chains, apply this.
  - **iter 22 (SELECT-omission TS2551s often hide adjacent TS2339s):** When fixing a SELECT-omission cluster, grep the whole file for ALL field accesses on the result type and add every omitted field that the code reads. Single edit closes many errors. iter 22's my-events fix added `is_bye` to the SELECT alongside `player1_wins/player2_wins`, closing 6 × TS2551 + 2 × TS2339 in one Edit.
  - **iter 22 (manual-prop-interface TS2551s expose schema drift):** When a missing-field error is on a manually-typed prop interface AND the underlying field is referenced in adjacent server-side write code BUT no `ADD COLUMN` migration exists in `scripts/`, surface a schema-drift WARNING for runtime audit. The type fix unblocks tsc; the schema audit unblocks the feature. The two concerns are factored apart deliberately.
  - **iter 22 (type-correctness ≠ runtime-correctness):** The mechanical `.catch` → `.then(undefined, ...)` fix preserved the broken fallback bodies verbatim. tsc passing does NOT mean the code works. Surface runtime concerns explicitly in FIXES_APPLIED.md; Phase 3 is the type-safety gate, Phase 4 is the feature-correctness gate. Don't conflate.
  - **iter 23 (coupled error classes from a single root cause close together):** The 20 TS2339s and 6 TS2554s in `role-actions.ts` looked like two separate clusters in the awk profile but were a single root cause (caller-side legacy pattern against a refactored helper). Fixing the call site closed both classes simultaneously. Generalization: when an iter targets a single file's hotspot, count ALL error classes in that file at iter entry — don't filter by error code. A single fix may close multiple error codes if they share a root cause.
  - **iter 23 (Next.js 15+ `createClient` migration is a repo-wide drift pattern):** Legacy pattern: `const cookieStore = await cookies(); const supabase = createClient(cookieStore)`. New pattern: `const supabase = await createClient()` (helper reads cookies internally). Every server action / route handler in a Next.js 15 migration will have this drift unless explicitly updated. Profile repo-wide with `grep -rn "createClient(cookieStore)"`. Fix is mechanical: replace_all 2-line block → 1-line + remove `cookies` import.
  - **iter 23 (STATE.md hotspot predictions can be wrong; profile FIRST):** STATE.md's iter-22 prediction was `tournament-controller.tsx` would be the TS2339 hotspot with ~30 errors. Actual iter-23 hotspot was `lib/role-actions.ts` (20 TS2339 + 6 TS2554 excluded from the awk). Predictions decay as iters close errors; always re-profile at iter entry. Cost of the awk command is seconds; cost of starting on the wrong file is an iter.
  - **iter 23 (cleanest 1-edit-fix-many is when the legacy pattern is byte-identical across N sites):** `role-actions.ts` had 6 byte-identical 2-line blocks → 1 replace_all closed 6 sites. Generalization: when grep shows identical multi-line patterns repeated N times in a file, prefer ONE replace_all over N individual Edits. Verify with a tsc-count check.
  - **iter 24 (verify cross-file sweep recommendations at iter entry; STATE.md predictions decay):** Iter 23 recommended a repo-wide `createClient(cookieStore)` sweep as iter-24's top candidate. Verification at iter-24 entry showed 0 hits. Run the verification grep BEFORE committing time to a cross-file sweep — the grep is seconds, the wrong assumption is an iter. Companion to iter 23's "STATE.md hotspot predictions can be wrong; profile FIRST."
  - **iter 24 (multiple manually-typed interfaces for the same shape need separate extension):** `tournament-controller.tsx` had TWO manually-typed `matches` array prop interfaces (`currentRound.matches` at L167-177 and `allRounds[].matches` at L188-204), each with its own field omissions. First Edit closed 3 of 9 errors because 6 errors were on the second interface. Generalization: when adding fields to a manually-typed prop interface, grep the file for ALL similar interface declarations with the same root shape (here: both started with `is_bye: boolean` and contained `player1: {...} | null`). Use the error-message's type-signature (presence/absence of fields like `loser_id`) to distinguish multiple shapes from a single shape.
  - **iter 24 (confirm columns exist before assuming schema drift):** Iter-22 surfaced `reported_player1_draws`/`reported_player2_draws` as schema-drift warnings (no migration found). Iter-24's three fields (`draws`, `dispute_reason`, `is_feature_match`) all had explicit migrations in `scripts/042_*.sql`, `scripts/050_*.sql`, `scripts/053_*.sql`. The grep for `scripts/*.sql` references is cheap and resolves the schema-drift question in seconds. Generalization: when extending a manually-typed prop interface with a real-looking column name, ALWAYS check `scripts/*.sql` for `ADD COLUMN.*<name>` before deciding whether to surface a drift warning. Don't over-warn.
- Three Phase 3 ACCEPTANCE items remain: "Zero TypeScript errors" (169 to go), "All missing type definitions added", and (already flipped in iter 10) "All broken imports resolved".
- `node_modules/` is **not** vendored. Only `typescript` was installed (no-save). Subsequent iters may need additional packages; do not run a full `pnpm install` unless build phase requires it.

No `BLOCKED:` or `PLAN_DRIFT:` markers.
