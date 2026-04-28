# MAJHEVENTS Backlog — Priority Queue

**Status:** Living document. Update task status as you work.  
**Rule:** Always work from READY, never from BLOCKED.

## How to use this document

1. Scan READY tasks. Pick one that fits your time and energy.
2. Mark it IN-FLIGHT with timestamp + brief note when you start.
3. When done, mark DONE and check what newly became READY.
4. Calling an audible? Look at the dependency graph and surface the cost.
5. Stuck? Mark IN-FLIGHT-BLOCKED with what you need.

## Track legend
- **A — Foundation** (security, financial spine, schema consolidation): focus work, hand-written SQL, multi-hour blocks
- **B — Modules** (UI, server actions, features): v0-friendly, small, parallel
- **C — Discovery** (Barbados specifics, partner conversations, integration testing): waiting-on-others

## Effort legend
- **XS** — under 30 min
- **S** — 30 min to 2 hours
- **M** — half a day (2–4 hours focused)
- **L** — full day (4–8 hours)
- **XL** — multi-day

---

## TIER 0 — Triage (do first, ungates everything else)

### T-001: Drop fictional ML/treasury layer
- **Status:** READY
- **Track:** A · **Effort:** XS · **Where:** Supabase SQL editor
- **Blocks:** T-005, T-012
- **Why:** The functions reference tables that don't exist; first call will throw. Fictional layer misleads future planning.
- **The work:**
```sql
  DROP FUNCTION IF EXISTS get_investor_reports(uuid, integer);
  DROP FUNCTION IF EXISTS generate_financial_report(uuid, text, date, date);
  DROP FUNCTION IF EXISTS get_treasury_history(uuid, integer);
  DROP FUNCTION IF EXISTS check_treasury_rules(uuid);
  DROP FUNCTION IF EXISTS capture_treasury_snapshot(uuid);
  DROP FUNCTION IF EXISTS ml_score_payout_risk(uuid);
  DROP FUNCTION IF EXISTS compute_ml_features(uuid);
  DROP TABLE IF EXISTS organizer_cohorts;
  DROP TABLE IF EXISTS financial_reports;
  DROP TABLE IF EXISTS treasury_actions;
  DROP TABLE IF EXISTS treasury_rules;
  DROP TABLE IF EXISTS treasury_snapshots;
  DROP TABLE IF EXISTS ml_scoring_history;
  DROP TABLE IF EXISTS ml_feature_store;
  DROP TABLE IF EXISTS ml_models;
```
- **Acceptance:** `\dt ml_*` and `\dt treasury_*` return nothing.

### T-002: Enable RLS on `wallets` (or drop it)
- **Status:** READY
- **Track:** A · **Effort:** XS · **Where:** SQL editor
- **Blocks:** T-018
- **Why:** Currently world-readable. Wallet balances exposed to any authenticated user.
- **Decision needed first:** Is `wallets` or `user_wallets` the canonical table? Audit usage. If `user_wallets` is canonical, just drop `wallets` after migrating any rows. If `wallets` is canonical, enable RLS:
```sql
  ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "users_view_own_wallet" ON public.wallets
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "staff_view_all_wallets" ON public.wallets
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM organization_members
              WHERE user_id = auth.uid()
                AND role_key IN ('owner','admin','finance')
                AND is_active = true)
    );
  REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM authenticated;
```
- **Acceptance:** `SET ROLE authenticated; SELECT * FROM wallets;` returns only the current user's row. INSERT fails.

### T-003: Enable RLS on tournament-integrity tables
- **Status:** DONE 2026-04-27
- **Scope correction (vs original task description):** RLS was already 
  enabled on all 8 tables. Pre-flight audit revealed:
  - 4 tables (matches, players, registrations, round_pairings) already 
    had appropriate policies; left alone (matches/players/registrations 
    slated for DROP via T-010/T-020 anyway)
  - 4 tables (brackets, bracket_nodes, pools, pool_members) had RLS 
    enabled but zero policies (i.e., denied to non-service-role users); 
    these needed policy additions to allow the app to function
- **Pattern applied:** Copy of round_pairings' existing policy structure
  - Public SELECT (spectators can view bracket/pool data)
  - TO-only INSERT/UPDATE/DELETE (only the tournament's created_by user)
  - bracket_nodes and pool_members go through their parent table 
    (brackets, pools) via JOIN since they don't have direct tournament_id
- **Lessons:**
  - Always audit pre-existing state before writing RLS policies
  - "RLS enabled, zero policies" is functionally locked-down (denied) 
    rather than open — different from "RLS off"
- **Track:** A · **Effort:** S · **Where:** SQL migration file
- **Blocks:** T-024 (registration consolidation)
- **Why:** `brackets`, `bracket_nodes`, `pools`, `pool_members`, `players`, `registrations`, `round_pairings` are all currently world-writable. A user can edit `round_pairings` to avoid an opponent or flip `winner_id` on `brackets`.
- **The work:** Single migration; for each table:
```sql
  ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anyone_can_view" ON public.<table>
    FOR SELECT USING (true);
  CREATE POLICY "tournament_organizer_writes" ON public.<table>
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM tournaments t
        WHERE t.id = <table>.tournament_id
          AND t.created_by = auth.uid()
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM tournaments t
        WHERE t.id = <table>.tournament_id
          AND t.created_by = auth.uid()
      )
    );
  REVOKE INSERT, UPDATE, DELETE ON public.<table> FROM authenticated;
  GRANT INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
  -- (revoke + re-grant ensures the policy is the only path)
```
  *(Adapt the FK reference for tables that don't have direct tournament_id; bracket_nodes goes through brackets.bracket_id.)*
- **Acceptance:** Authenticated user who isn't the tournament organizer cannot INSERT/UPDATE/DELETE; can SELECT.

### T-004: Fix INSERT forgery vectors
- **Status:** DONE 2026-04-27
- **Notes for future reference:**
  - Required 5 sub-passes (Parts 1-5) due to v0 generating new policies 
    without dropping old ones; old policies remained active and continued 
    to permit forgery via Postgres OR-composition
  - Verification query is essential after every RLS migration; "no rows 
    returned" on a CREATE POLICY does not mean the goal was achieved
  - Tables affected: access_audit_log, analytics_events, financial_alerts, 
    match_engagement_events, match_reactions, match_viewer_sessions, 
    match_viewers, media_view_events, media_views, notifications, 
    reaction_aggregates, wallet_transactions, plus 7 cb_* deferred-module 
    tables
  - Intentionally left open (rate-limit via T-064): contact_submissions, 
    recruitment_applications
- **Track:** A · **Effort:** S · **Where:** SQL migration file
- **Blocks:** T-012
- **Why:** Several tables have INSERT policies with `with_check = true`, allowing any user to forge rows attributing actions to others.
- **The work:** Tighten or revoke for each:
  - `wallet_transactions`: revoke INSERT from authenticated entirely (service-role only)
  - `notifications`: revoke INSERT from authenticated (service-role only)
  - `financial_alerts`: revoke INSERT from authenticated (service-role only)
  - `access_audit_log`: revoke INSERT from authenticated (service-role only)
  - `match_reactions`: replace `with_check = true` with `with_check = (user_id = auth.uid() OR user_id IS NULL)`
  - `match_viewer_sessions`: same pattern
  - `match_viewers`: same pattern
  - `match_engagement_events`: keep service-role only (these should not come from clients)
  - `media_view_events`: replace with `with_check = (user_id = auth.uid() OR user_id IS NULL)`
  - `media_views`: same
  - `analytics_events`: replace with `with_check = (user_id = auth.uid() OR user_id IS NULL)`. Drop the duplicate "Allow insert analytics" policy.
  - `cb_*` insert policies: revoke INSERT from authenticated (these run server-side via admin actions)
  - `contact_submissions`: keep open (anonymous submission expected) but add rate-limiting at the app layer (T-064)
- **Acceptance:** As authenticated user, attempts to insert forged rows (with another user's id) fail.

### T-005: Build `core.financial_intents` table + reconciler
- **Status:** BLOCKED-BY T-001
- **Track:** A · **Effort:** L · **Where:** SQL migration + Vercel cron route + ask Claude for full draft
- **Blocks:** T-021, T-024 (real-money flows), T-025 (refund flow)
- **Why:** The platform has no idempotency layer for Stripe. Every payment-touching feature must use this. See ARCHITECTURE.md §7.
- **Sub-tasks:**
  - T-005a: Create `financial_intents` table with the canonical schema (intent_type enum, amount_cents, platform_fee_cents, currency, reference_type, reference_id, stripe_object_id, status enum, created_at, submitted_at, completed_at, last_error)
  - T-005b: RLS policies (users see their own, staff see all per tenant)
  - T-005c: Server action helper `createFinancialIntent()` that wraps insert
  - T-005d: Stripe webhook handler at `app/api/webhooks/stripe/route.ts` that matches by intent.id, updates status, writes ledger entries
  - T-005e: Reconciler at `app/api/cron/reconcile-stripe-intents/route.ts` that sweeps `submitted` intents older than 1 hour, queries Stripe, updates state
  - T-005f: Add cron schedule to `vercel.json`
- **Acceptance:** Test charge succeeds end-to-end via the new pattern. Test webhook delivery failure is recovered by reconciler within 1 hour.

### T-006: Tighten `escrow_accounts` "Public can view funded escrow" policy
- **Status:** DONE 2026-04-27
- **Track:** A · **Effort:** XS · **Where:** SQL editor
- **Why:** Current policy exposes amount_cents, funded_by, stripe_payment_intent_id, proof_of_funds_url to any authenticated user.
- **The work:**
```sql
  DROP POLICY "Public can view funded escrow status" ON escrow_accounts;
  CREATE VIEW public.escrow_status AS
    SELECT tournament_id, status, amount_cents
    FROM escrow_accounts
    WHERE status IN ('funded', 'released');
  GRANT SELECT ON public.escrow_status TO authenticated, anon;
```
- **Acceptance:** Authenticated user can SELECT from `escrow_status` view (showing only safe columns); cannot SELECT from `escrow_accounts` directly except via the existing organizer/staff policies.

### T-007: Fix `player_payouts` OR-composition bug
- **Status:** DONE 2026-04-27
- **Track:** A · **Effort:** XS · **Where:** SQL editor
- **Why:** "No updates after completion" policy doesn't actually prevent updates because "Staff can manage all" policy is broader and permits everything. RLS policies OR together; AND must be expressed as triggers.
- **The work:**
```sql
  DROP POLICY "No updates after completion" ON player_payouts;
  CREATE OR REPLACE FUNCTION block_payout_updates_after_completion()
  RETURNS TRIGGER AS $$
  BEGIN
    IF OLD.status IN ('completed', 'failed', 'cancelled') THEN
      RAISE EXCEPTION 'Cannot modify payout after status %', OLD.status;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  
  CREATE TRIGGER player_payouts_no_update_after_completion
    BEFORE UPDATE ON player_payouts
    FOR EACH ROW EXECUTE FUNCTION block_payout_updates_after_completion();
```
- **Acceptance:** UPDATE on a completed/failed/cancelled payout raises exception even when called as service-role.
**STATUS** DONE 2026-04-27
- ...rest unchanged

### T-008: Audit dismissed_stripe_payments rows + plan deletion
- **Status:** DONE 2026-04-27
- **Audit findings:**
  - 0 rows
  - No FK dependencies
  - RLS enabled
  - 1 policy ("Admins can manage dismissed payments") uses deprecated 
    `profiles.is_admin` pattern; will be dropped with the table
- **Action:** Drop scheduled for T-010 migration bundle.
- **Track:** A · **Effort:** XS · **Where:** SQL editor
- **Why:** Already confirmed 0 rows. Drop the table once T-005 is in place (since reconciliation makes it unnecessary).
- **The work:** Mark for drop in next migration after T-005 is shipped.

---

## TIER 1 — Architecture foundation (gates everything else)

### T-010: Module schema migration
- **Status:** BLOCKED-BY T-001 through T-007
- **Track:** A · **Effort:** L · **Where:** Big SQL migration, with Claude help
- **Blocks:** T-011, T-012, all module work after this
- **Why:** Move all `public.*` tables into module schemas (`core.*`, `tournament.*`, etc.) per SCHEMA.md. This is reversible and makes every later RLS policy and FK reference cleaner.
- **The work:** Generated migration; for each table: `ALTER TABLE public.<table> SET SCHEMA <module>;`. Update `search_path` in app config so existing code still resolves.
- **Acceptance:** All tables visible via `SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('core','tournament',...)`. App still functions (read-only smoke test).
- **Caveat:** Because `search_path` includes the new schemas, app code keeps working without changes initially. Update queries to fully-qualified references as you touch each module.

### T-011: Consolidate to `organization_members` as auth source
- **Status:** BLOCKED-BY T-010
- **Track:** A · **Effort:** L · **Where:** SQL migration + RLS audit
- **Blocks:** T-013, T-019
- **The Work**
T-011g: Pre-migration audit — query pg_policies for all policies whose 
qual or with_check references `profiles.is_admin`, `staff_roles`, or 
`tenant_memberships`. Document count and table list. This is the scope 
of the policy rewrite work.
- **Why:** Currently 5 places encode "is this user staff" — `organization_members.role_key`, `tenant_memberships.role`, `staff_roles.role`, `profiles.is_admin`, `profiles.role`. Pick one.
- **Sub-tasks:**
  - T-011a: Migrate all `staff_roles` rows into `organization_members` with role_key mapping (`owner` → `owner`, `manager` → `admin`, `staff` → `staff`, `organizer` → `staff`)
  - T-011b: Migrate `tenant_memberships` rows similarly
  - T-011c: Set `profiles.is_admin = true` derives from membership in platform-owner tenant; backfill, then drop the column
  - T-011d: Drop `profiles.role` after backfill
  - T-011e: Audit every RLS policy that references `staff_roles`, `tenant_memberships`, or `profiles.is_admin`; replace with `organization_members` predicate
  - T-011f: Drop `staff_roles` and `tenant_memberships` tables
- **Acceptance:** All RLS policies pass an audit grep showing only `organization_members` references for auth. No staff_roles or tenant_memberships in policy definitions.

### T-012: Build canonical `core.audit_log`
- **Status:** BLOCKED-BY T-001, T-004, T-010
- **Track:** A · **Effort:** M · **Where:** SQL migration + helper module
- **Blocks:** T-021, T-031, every state-transition feature
- **Why:** Currently 7+ fragmented log tables, none are the canonical "what happened to entity X." Need one for tournament/match/payment/dispute audits.
- **The work:**
  - Create `core.audit_log` (id uuid, tenant_id, actor_id, entity_type, entity_id, event_type, before jsonb, after jsonb, metadata jsonb, created_at)
  - INSERT permitted via SECURITY DEFINER function `core.write_audit(...)`
  - UPDATE/DELETE blocked by trigger
  - TypeScript helper `lib/audit.ts` exporting `recordAudit({entityType, entityId, eventType, before, after})` that calls the function
- **Acceptance:** Helper successfully writes audit row in same transaction as state change. UPDATE attempt raises exception. Existing log tables (access_audit_log, reconciliation_audit_log) still serve their specialized purposes; this is the general one.

### T-013: Tenant feature flag enforcement at RLS
- **Status:** BLOCKED-BY T-010, T-011
- **Track:** A · **Effort:** M · **Where:** SQL migration affecting many policies
- **Blocks:** T-019 (deferred-module gating)
- **Why:** Architecture rule §2.5 — tenant without `feature.fnb` enabled cannot read `fnb.*` tables.
- **The work:** Helper SQL function `core.tenant_has_feature(tenant_id uuid, feature_key text) RETURNS boolean`. Update RLS policies on each module's tables to AND with this check.
- **Acceptance:** A tenant without `feature.tournament` enabled cannot SELECT from `tournament.tournaments`. Verified by integration test.

### T-014: Outbox worker
- **Status:** BLOCKED-BY T-010
- **Track:** A · **Effort:** M · **Where:** Vercel Cron route
- **Blocks:** T-026 (read models), T-038 (clip pipeline)
- **Why:** Cross-module events depend on outbox processing. The 1 stuck row in your current outbox confirms the pattern was started but not wired.
- **The work:** `app/api/cron/process-outbox/route.ts` runs every minute, claims unprocessed rows, dispatches to handlers based on `topic`, marks processed. Handlers registered in a switch statement; specific handlers built per-need (T-026 etc.)
- **Acceptance:** New outbox row gets processed within 60 seconds. Failed rows retry up to max_attempts. Unprocessed-rows-older-than-5-minutes alert wired (T-068).

---

## TIER 2 — Tournament module (the core deliverable)

### T-020: Consolidate match table — pick `tournament_matches`
- **Status:** BLOCKED-BY T-010
- **Track:** A · **Effort:** M · **Where:** SQL migration
- **Blocks:** T-021, T-022, T-026
- **Why:** Two parallel match tables with different schemas. Keep `tournament_matches` (richer columns including streaming/engagement); drop `matches`.
- **The work:** Migrate any data from `matches` into `tournament_matches`. Repoint FKs (especially `brackets`, `bracket_nodes`, `clip_jobs`). Drop `matches`.
- **Acceptance:** `matches` table gone. App references all updated. Brackets render correctly.

### T-021: Tournament entry payment via financial_intents
- **Status:** BLOCKED-BY T-005, T-012, T-020
- **Track:** B · **Effort:** L · **Where:** Server action + Stripe + Claude help
- **Blocks:** T-022
- **Why:** First end-to-end use of the financial spine. Refactor existing tournament entry payment to use intent → execute → reconcile pattern.
- **Acceptance:** Test tournament entry creates intent row, calls Stripe with idempotency key, webhook updates status, ledger entries balance, audit log row written. Repeat the same call: no double charge.

### T-022: End-to-end tournament money test (the critical path)
- **Status:** BLOCKED-BY T-021, T-029, T-030
- **Track:** A · **Effort:** L · **Where:** Vitest + Postgres testcontainer
- **Blocks:** Barbados readiness
- **Why:** This is the bet-the-company test. If it passes, the platform handles money correctly.
- **The work:** Single integration test: organizer creates tournament with $25 entry, 8 players register and pay, matches play through to completion, prizes distribute, payouts process. Verifies every ledger transaction balances and every state transition has an audit row.
- **Acceptance:** Test passes 5 times in a row in CI without flake.

### T-023: Tournament check-in page
- **Status:** READY (good v0 candidate; uses existing tables)
- **Track:** B · **Effort:** S · **Where:** v0
- **Blocks:** T-022
- **Why:** Players need to confirm presence within the check-in window before tournament starts.
- **The prompt:** *(see PROMPTS.md → "Tournament check-in page")*
- **Acceptance:** Logged-in registered player can check in within window; sees clear error outside window; status flips to checked_in atomically; `audience.viewer` row optional.

### T-024: Consolidate registration tables
- **Status:** BLOCKED-BY T-010, T-011
- **Track:** A · **Effort:** M · **Where:** SQL migration
- **Blocks:** T-022
- **Why:** Currently 4 registration representations (registrations, players, tournament_participants, tournament_registrations). Keep tournament_registrations + tournament_participants (one is payment-side, one is play-side).
- **The work:** Migrate rows from `registrations` and `players` into the canonical pair. Repoint FKs. Drop the deprecated tables. Fix exports_*_missing_* tables to verify zero drift remains, then drop those too.
- **Acceptance:** Schema has one canonical registration model. exports_* tables empty and dropped.

### T-025: Refund + cancel flow
- **Status:** BLOCKED-BY T-005
- **Track:** B · **Effort:** M · **Where:** Server action + Claude help
- **Why:** When tournament is cancelled or organizer issues refund, money flow must reverse cleanly through ledger.
- **Acceptance:** Refund creates compensating ledger entries, audit log row, Stripe refund call via intent pattern, audit log shows complete history.

### T-026: `audience.match_summary` read model
- **Status:** BLOCKED-BY T-014, T-020
- **Track:** A · **Effort:** M · **Where:** SQL + worker handler
- **Blocks:** T-031
- **Why:** Live match page needs denormalized data (match + tournament + stream + scores + reactions) in one query. Maintained from outbox.
- **Acceptance:** Match state change writes outbox row; summary table updates within 5 seconds; live page renders in single SELECT.

### T-027: Pairings audit
- **Status:** READY (independent investigation)
- **Track:** A · **Effort:** M · **Where:** Code review + tests
- **Blocks:** T-028
- **Why:** Swiss pairings are notoriously tricky. Need to know if existing implementation is correct, broken, or missing.
- **The work:** Find pairing function in repo (likely `lib/pairings/*` or a SQL function). Read it. Build test cases from DCI floor rules examples. Verify or document gaps.
- **Acceptance:** Document `docs/pairings-audit.md` describing what's there, what works, what's broken, what's missing.

### T-028: Add head-to-head tracking for Swiss
- **Status:** BLOCKED-BY T-027 (depends on what we find)
- **Track:** B · **Effort:** S · **Where:** SQL + pairing code
- **Why:** Swiss must avoid repeat pairings. If the existing implementation doesn't track this, it's broken.
- **Acceptance:** Pairing for round N+1 cannot match two players who already played each other in rounds 1..N.

### T-029: Tournament list page
- **Status:** READY
- **Track:** B · **Effort:** S · **Where:** v0
- **The prompt:** *(see PROMPTS.md)*
- **Acceptance:** Public list of tournaments with filters (game, status, format, prize range), accessible without login.

### T-030: Tournament detail / registration page
- **Status:** READY
- **Track:** B · **Effort:** M · **Where:** v0 + financial intent integration
- **The prompt:** *(see PROMPTS.md)*
- **Acceptance:** Visitor sees tournament details; logged-in user can register (free) or pay entry fee (uses T-021's flow).

---

## TIER 3 — Audience module (the audience-facing live experience)

### T-031: Live match page
- **Status:** BLOCKED-BY T-026, T-035
- **Track:** B · **Effort:** L · **Where:** v0 + realtime wiring
- **Why:** The single most important user-facing surface for an audience event.
- **Acceptance:** Page shows live video (Mux player), real-time score, reactions appearing live, viewer count, chat (T-033). Updates without polling.

### T-032: Reactions UI
- **Status:** BLOCKED-BY T-004 (forgery fix)
- **Track:** B · **Effort:** S · **Where:** v0
- **Why:** Hype emojis users tap to express engagement. Feeds match_reactions, drives reaction_aggregates, contributes to hype_score.
- **Acceptance:** Tappable reaction bar; rate-limit (1 per second per user); reactions visible on stream within 500ms; counts persisted.

### T-033: Match chat with moderation tools
- **Status:** BLOCKED-BY T-031, T-004 (forgery fix)
- **Track:** B · **Effort:** L · **Where:** v0 + realtime + moderation logic
- **Blocks:** Barbados readiness (live finals chat)
- **Why:** Live chat tied to a specific match while it's live, locked after. The Twitch model. Core to the audience layer feeling like a live event rather than a recording. The organizer is the moderator of their tournament's chat by default; they have skin in the game.
- **Schema:** Uses existing `audience.chat_messages` (renamed from `match_chat_messages`). Uses existing `audience.viewers` to enforce follower-only mode. New table NOT required.
- **Sub-features required:**
  - **Slow mode** — configurable per match, default 3 seconds between messages from the same user. Stored on `tournament.matches` as `chat_slow_mode_seconds` (use existing column or add via T-033 migration if absent — verify before assuming).
  - **Follower-only mode** — toggle stored on tournament_matches; if true, message INSERT requires sender to follow the streamer or be registered for the tournament.
  - **Caster/moderator badge** — `is_caster` and `is_moderator` flags on chat_messages already exist per schema. Surface them in UI with distinct badge styling.
  - **Mod actions** — delete message (soft-delete via `is_deleted = true`), timeout user (insert into `core.user_restrictions` with `restriction_type = 'muted'`, scope to this match's chat via metadata, with expires_at), ban from match (same pattern, no expiry until match ends).
  - **AutoMod blocklist** — basic word/phrase blocklist stored as a tenant config (use `core.site_settings` keyed by `automod.blocklist.{tenant_id}`). Blocked messages get `is_deleted = true` on insert via a server-side check; sender sees "your message was filtered" silently.
  - **Per-tournament chat disable** — `chat_enabled` toggle on tournament; if false, chat panel doesn't render and INSERTs are denied at the server action layer.
  - **Read-only after match ends** — server action checks `match.status = 'completed'` AND `now() - match.completed_at > interval '30 minutes'`; if true, INSERTs return error "Chat closed."
- **Default settings for Barbados:**
  - For tournaments under 200 expected viewers: follower-only ON, slow mode 3s
  - For larger tournaments: follower-only OFF, slow mode 5s
  - AutoMod blocklist: a baseline list seeded for the platform tenant; convention tenant can add to theirs
- **The work:**
  1. Audit `audience.chat_messages` schema for missing columns (e.g., `chat_slow_mode_seconds`); add via migration if needed
  2. Server action `sendChatMessage(matchId, content)` enforcing all preconditions atomically (slow mode, follower-only, AutoMod, restrictions)
  3. Server action `moderateChatMessage(messageId, action)` for mods
  4. Server action `setMatchChatConfig(matchId, config)` for organizers
  5. Component `<MatchChat matchId={...} />` — paginated history + Realtime subscription on `audience:match:{matchId}:chat`; renders messages with badges, supports moderator inline actions, shows current chat state (slow mode, follower-only) inline
  6. Mod tool drawer for organizers/casters — list of recent messages with one-click timeout/delete/ban
  7. AutoMod check at the server action layer; do NOT trust client to filter
- **Acceptance:** 
  - Audience member sends message; appears in real-time for all viewers
  - Slow mode prevents second message within window with clear inline error
  - Non-follower cannot send in follower-only mode
  - Moderator can timeout user; user's subsequent INSERTs fail with restriction message
  - AutoMod-blocked message returns success to sender (no leak) but never appears in feed
  - Chat locks 30 min after match completion
  - Organizer can disable chat entirely for a match before/during; existing messages remain readable
- **Anti-patterns to refuse:**
  - Client-side AutoMod filtering (always server-side)
  - "Trusted user" bypasses for slow mode (no exceptions)
  - Hard-deleting messages (soft-delete only, for audit)
  - Cross-match moderation actions (a timeout in match A does not apply to match B; that's user_restrictions territory and a separate decision)


### T-034: Predictions
- **Status:** READY
- **Track:** B · **Effort:** M · **Where:** v0
- **Why:** Engagement loop — viewers predict match outcomes; correct predictions earn prediction_points.
- **Acceptance:** Predictions submitted before match starts; locked at start; resolved on match completion; user gains/loses points; leaderboard updated.

### T-035: Mux player integration
- **Status:** READY (Track A focus task)
- **Track:** A · **Effort:** M · **Where:** Library code, ask Claude for help
- **Blocks:** T-031, T-036
- **Why:** Mux is the primary video stack. Need clean React component wrapping `@mux/mux-player-react` with the platform's overlay layer.
- **Acceptance:** `<MajhVideoPlayer playbackId={...} />` component renders, supports overlays (T-036), reports analytics events.

### T-036: Match overlays
- **Status:** BLOCKED-BY T-035
- **Track:** B · **Effort:** M · **Where:** v0 + animation library
- **Why:** Score/timer/round-info overlays rendered on top of video. The "looks like ESPN" requirement.
- **Acceptance:** Overlays customizable per tournament (theme, colors, layout); update in real-time from match state.

### T-037: Hype/trending score job
- **Status:** BLOCKED-BY T-014
- **Track:** A · **Effort:** M · **Where:** Cron route
- **Why:** Surface trending matches in feed and auto-feature. Score is a function of viewer count, reaction rate, score changes, recency.
- **Acceptance:** Cron updates trending_score on tournament_matches every minute. Documented formula in code comments.

---

## TIER 4 — Clips module (audience growth + sponsor deliverable)

### T-038: Clip job worker
- **Status:** BLOCKED-BY T-014, T-035
- **Track:** A · **Effort:** L · **Where:** Cron route + Mux clips API + Claude help
- **Blocks:** T-039, T-040
- **Why:** `clip_jobs` rows pile up forever without a worker. Mux has a clips API; this worker calls it.
- **Acceptance:** New clip_job processes within 5 minutes; output_url populated; failed jobs marked with error.

### T-039: Manual clipping UI
- **Status:** BLOCKED-BY T-038
- **Track:** B · **Effort:** M · **Where:** v0
- **Why:** Producer/audience member selects clip range during live or VOD playback.
- **Acceptance:** Range slider over playback; submit creates clip_job row; user gets notification when clip ready.

### T-040: Auto-highlight detector
- **Status:** BLOCKED-BY T-014, T-037
- **Track:** A · **Effort:** L · **Where:** Heuristic-based logic, NOT ML (call it what it is)
- **Why:** Detect moments worth clipping based on engagement spikes (reaction velocity, viewer spike, score change).
- **Acceptance:** Clip candidates created automatically when engagement signals exceed thresholds; reviewed status starts as 'pending'.

### T-041: Clip publication
- **Status:** BLOCKED-BY T-039 or T-040
- **Track:** B · **Effort:** S · **Where:** v0
- **Why:** Approved clips become content_items in the feed.
- **Acceptance:** Approving a clip creates a content_item row; clip appears in feed; feed_cache invalidated.

---

## TIER 5 — Feed module (between-events retention)

### T-045: Feed page
- **Status:** BLOCKED-BY T-041
- **Track:** B · **Effort:** L · **Where:** v0
- **Why:** TikTok-style scrollable content surface. Where audiences spend attention between events.
- **Acceptance:** Vertical scroll feed of clips/highlights/streams; infinite scroll; per-item engagement (like, save, share); feed personalization (T-047).

### T-046: Follows + follower count
- **Status:** READY (good v0 task)
- **Track:** B · **Effort:** S · **Where:** v0
- **The prompt:** *(see PROMPTS.md)*
- **Acceptance:** Follow/unfollow buttons; counts update; profile pages show follower/following counts.

### T-047: Feed ranking algorithm v1
- **Status:** BLOCKED-BY T-045
- **Track:** A · **Effort:** M · **Where:** SQL function + cron + Claude help
- **Why:** Currently feed_cache has no ranking logic. Need basic algorithm: trending_score + recency + follow boost.
- **Acceptance:** Documented formula. Feed for a user reflects their follows + globally trending content.

---

## TIER 6 — Venue module (Barbados ticketing + check-in)

### T-050: Ticket purchase via financial_intents
- **Status:** BLOCKED-BY T-005, T-013
- **Track:** B · **Effort:** L · **Where:** Server action + Stripe
- **Why:** Ticket purchase must use the same money pattern as tournament entry.
- **Acceptance:** Test ticket purchase end-to-end; refund flow works; sold-out enforcement (race-condition safe).

### T-051: QR code + check-in flow
- **Status:** BLOCKED-BY T-050
- **Track:** B · **Effort:** M · **Where:** v0 + scanner
- **Why:** Convention attendees scan QR at door; staff sees green/red.
- **Acceptance:** Generate QR per ticket; scanner page validates, marks attended, prevents double check-in; offline fallback (T-067).

### T-052: Promo codes
- **Status:** READY
- **Track:** B · **Effort:** S · **Where:** v0
- **Acceptance:** Organizer creates code; applies discount at checkout; usage limits enforced.

### T-053: Event chat rooms (venue-scoped, lifecycle-bound)
- **Status:** BLOCKED-BY T-013 (tenant feature flag enforcement), T-014 (outbox worker)
- **Track:** B · **Effort:** L · **Where:** v0 + Realtime + schema migration
- **Blocks:** Barbados convention experience
- **Why:** Conventions need event-scoped chat ("main stage," "side events," "vendors," "lost & found") without the platform becoming Discord. Rooms are properties of events: they start when the event opens, close when the event ends. This is a different lifecycle from match chat (which is per-match) and from a hypothetical persistent global community (which we are not building). Default rooms are auto-created per event; convention staff are auto-moderators of their event's rooms.
- **Schema migration required:** Move and rename existing `community_*` tables into venue scope:
  - `public.community_rooms` → `venue.event_rooms`
  - `public.community_room_members` → `venue.event_room_members`
  - `public.community_messages` → `venue.event_room_messages`
  - `public.community_moderators` → `venue.event_room_moderators`
  - Add `event_id uuid REFERENCES venue.events(id) NOT NULL` to event_rooms (currently missing)
  - Existing data migration: if any `community_rooms` rows exist that aren't tied to an event, archive them and start fresh; verify before destructive migration
- **Lifecycle (enforced in code, audited in core.audit_log):**
  - Room created → status `active` (only when parent event is `published` or running)
  - Event ends → cron handler closes all rooms to read-only (`status = 'archived'`)
  - Archived rooms: INSERTs denied; SELECTs allowed for 90 days; then soft-deleted
- **Auto-creation:** When an event is created with `feature.event_rooms` enabled for the tenant, default rooms get inserted via the same transaction: `general`, `matches`, `vendors`, `help`. Organizer can add/remove rooms.
- **Moderation features required for August:**
  - Slow mode per room (default 5 seconds; configurable per room)
  - Per-room ability to require a valid ticket (`venue.tickets` row) for the parent event before posting
  - Soft-delete messages (`is_deleted = true`)
  - User timeout scoped to a single room (insert into `core.user_restrictions` with metadata identifying the room and an expires_at)
  - Pin message (existing `is_pinned` column)
  - Auto-moderators: event organizer + any `organization_members` row with role_key in (`owner`, `admin`, `staff`) for the tenant owning the event
  - Same AutoMod blocklist mechanism as T-033 (server-side check on insert; soft-delete blocked content)
- **The work:**
  1. SQL migration: move tables, rename, add event_id FK, backfill if any rows
  2. RLS policies: tenant-feature-flag check (`feature.event_rooms`), event-membership check (must have ticket OR be staff), per-room read/write
  3. Server action `createEventRoom(eventId, name, settings)` — staff only, fires outbox event
  4. Server action `sendEventRoomMessage(roomId, content)` — preconditions: event is active, room is active, user has access (ticket holder or staff), slow mode satisfied, AutoMod passed
  5. Server action `moderateEventRoomMessage(messageId, action)` — moderator-only
  6. Cron handler subscribed to outbox event `event.ended` → closes rooms to read-only
  7. Component `<EventRoomsList eventId={...} />` — list of rooms in sidebar
  8. Component `<EventRoom roomId={...} />` — message list with Realtime subscription on `venue:event:{eventId}:room:{roomId}`, send box, mod tools for moderators
- **Acceptance:**
  - Convention organizer creates event → 4 default rooms appear automatically
  - Ticket holder can join and post in event rooms
  - Non-ticket-holder is denied posting (and seeing, depending on room visibility)
  - Convention staff can moderate without holding a ticket
  - Event ends → rooms become read-only within 60 seconds (outbox cycle); cannot post; can read for 90 days
  - Per-room slow mode enforced
  - Timeout in room A does not affect room B
- **Anti-patterns to refuse:**
  - Cross-event rooms (rooms must be tied to a specific event for lifecycle clarity)
  - Voice chat in rooms (out of scope for August; resist requests)
  - Tenant-wide global rooms (not building global community; raise as architecture decision before starting)
  - Rooms that survive event end (archived only; new event = new rooms)

---

## TIER 7 — Metrics module (sponsor + organizer reporting)

### T-055: Real-time tenant dashboard
- **Status:** BLOCKED-BY T-014
- **Track:** B · **Effort:** L · **Where:** v0 + Realtime subscription
- **Why:** Organizers see live numbers during their event. Sponsors get live readouts.
- **Acceptance:** Dashboard shows current viewers, ticket sales, top matches by engagement, trending clips, all updating in real-time.

### T-056: Sponsor report PDF generator
- **Status:** BLOCKED-BY T-055
- **Track:** B · **Effort:** L · **Where:** Server action + react-pdf or similar
- **Why:** Post-event PDF deliverable to sponsors. The "we got you 3,200 peak viewers and X impressions" report.
- **Acceptance:** Generate PDF for any past event; cached on disk; downloadable from organizer dashboard.

### T-057: Sponsor live API endpoint
- **Status:** BLOCKED-BY T-055, T-058
- **Track:** B · **Effort:** S · **Where:** Route handler + auth
- **Why:** Some sponsors want their own dashboard pulling live data.
- **Acceptance:** Authenticated API endpoint returns sponsor-relevant metrics in JSON; rate-limited.

---

## TIER 8 — Integrations module (the platform layer)

### T-058: Webhook subscription system
- **Status:** BLOCKED-BY T-014
- **Track:** A · **Effort:** L · **Where:** SQL + worker + admin UI
- **Why:** "Plug into your existing infrastructure" requires outbound webhooks for partner systems (e.g., Barbados venue's ticketing reconciliation, accounting system).
- **Acceptance:** Tenant configures webhook URL + event types; webhook fires within 60s of event; signed payload; retry on failure.

### T-059: Public API (read-only) for tenant data
- **Status:** BLOCKED-BY T-058
- **Track:** B · **Effort:** M · **Where:** Route handlers + API key auth
- **Why:** Allow Barbados to pull data into their own systems.
- **Acceptance:** API key auth via api_keys table; per-tenant data only; rate-limited per key.

### T-060: Stripe Connect onboarding flow
- **Status:** READY
- **Track:** B · **Effort:** M · **Where:** v0 + Stripe Connect API
- **Why:** Organizers need to onboard to Stripe Connect to receive payouts.
- **The prompt:** *(see PROMPTS.md)*
- **Acceptance:** Organizer completes Stripe-hosted onboarding; status tracked in profiles.stripe_connect_status; payouts blocked until 'complete'.

---

## TIER 9 — Operations + readiness

### T-064: Rate limiting on public endpoints
- **Status:** READY
- **Track:** A · **Effort:** S · **Where:** Middleware + Upstash Redis or Vercel Edge Config
- **Why:** contact_submissions, login attempts, registration attempts all need rate limiting.
- **Acceptance:** 5 req/min per IP for sensitive endpoints; gracefully degrades to in-memory if Redis unavailable.

### T-065: Error monitoring
- **Status:** READY
- **Track:** A · **Effort:** S · **Where:** Sentry or similar
- **Why:** When something breaks at 11pm in Barbados, you need to know without checking logs.
- **Acceptance:** All server errors reported; client errors captured; alerts to phone for critical paths.

### T-066: Logging + alerting on financial operations
- **Status:** BLOCKED-BY T-005, T-012, T-065
- **Track:** A · **Effort:** S · **Where:** Logging helper + Sentry rules
- **Why:** Every Stripe call, every payout, every refund logs structured events with intent_id for correlation.
- **Acceptance:** Can search logs by intent_id and see entire flow.

### T-067: Offline mode for venue check-in
- **Status:** BLOCKED-BY T-051
- **Track:** B · **Effort:** M · **Where:** PWA + IndexedDB
- **Why:** Convention venues have flaky wifi. Check-in must work offline and sync.
- **Acceptance:** Check-in works with no connection; syncs to offline_sync_queue when online; conflicts surfaced.

### T-068: Operational runbook (RUNBOOK.md)
- **Status:** READY (incremental)
- **Track:** A · **Effort:** XS each, ongoing · **Where:** RUNBOOK.md
- **Why:** Record every "what to do when X breaks" lesson as you encounter it.
- **Acceptance:** By August, RUNBOOK.md is 5+ pages.

### T-069: Tenant admin UI
- **Status:** BLOCKED-BY T-013
- **Track:** B · **Effort:** L · **Where:** v0
- **Why:** Tenant owners need to manage their feature flags, members, branding, integrations.
- **Acceptance:** Owner can toggle features (within their plan limits); add/remove members; configure webhooks.

### T-070: Tenant onboarding flow
- **Status:** BLOCKED-BY T-069
- **Track:** B · **Effort:** L · **Where:** v0
- **Why:** First time a new tenant signs up, they need a guided setup.
- **Acceptance:** New tenant: pick plan → set name + slug → configure features → invite team → first event/tournament wizard.

### T-071: Test in production with one real $20 tournament
- **Status:** BLOCKED-BY T-022 plus all TIER 2 tasks
- **Track:** A · **Effort:** L · **Where:** Production
- **Why:** Final validation before Barbados.
- **Acceptance:** Real tournament runs end-to-end with real Stripe in real production; you sit through it; nothing requires admin intervention.

---

## TIER C — Discovery (Barbados-specific, blocking on partner)

### T-080: Barbados partner discovery call
- **Status:** READY (you schedule this)
- **Track:** C · **Effort:** S · **Where:** Phone/Zoom
- **Blocks:** T-081, T-082, T-083, T-084
- **Why:** Until we know what they need, half of Phase 3 is guessing.
- **Questions to ask:**
  - Date(s) of event?
  - Expected attendance?
  - Are they selling tickets through MAJH or their own system?
  - Are they running F&B through MAJH or in-house?
  - How many tournaments? What formats?
  - Any sponsors and what's the deliverable to them?
  - What existing tech (POS, badges, registration system) needs integration?
  - Internet/wifi reliability at venue?
  - On-site staff with phones for check-in?
  - Day-before walkthrough possible?

### T-081: Barbados feature flag plan
- **Status:** BLOCKED-BY T-080
- **Track:** C · **Effort:** S · **Where:** Document
- **Why:** Document exactly which modules are on for this tenant.

### T-082: Barbados sponsor deliverable spec
- **Status:** BLOCKED-BY T-080
- **Track:** C · **Effort:** S · **Where:** Document
- **Why:** Specific format and metrics for the PDF/dashboard sponsors will see.

### T-083: Barbados integration spec
- **Status:** BLOCKED-BY T-080
- **Track:** C · **Effort:** S · **Where:** Document
- **Why:** Which webhooks they need, which APIs they're pulling.

### T-084: Barbados full dry run
- **Status:** BLOCKED-BY T-071, T-080, T-081
- **Track:** C · **Effort:** L · **Where:** Live test event
- **Why:** Run the entire Barbados shape end-to-end, in test mode, before traveling.

---

## STATUS TRACKER (update inline as you work)

TIER 0 (Triage) | T-001 | T-002 | T-003 | T-004 | T-005 | T-006 | T-007 | T-008 | _____ | _____ | _____ | _____ | _____ | _____ | _____ | _____ TIER 1 (Foundation) | T-010 | T-011 | T-012 | T-013 | T-014 | _____ | _____ | _____ | _____ | _____ TIER 2 (Tournament) | T-020 | T-021 | T-022 | T-023 | T-024 | T-025 | T-026 | T-027 | T-028 | T-029 | T-030 | _____ | _____ | _____ | _____ | _____ | _____ | _____ | _____ | _____ | _____ | _____ TIER 3 (Audience) | T-031 | T-032 | T-033 | T-034 | T-035 | T-036 | T-037 | _____ | _____ | _____ | _____ | _____ | _____ | _____ TIER 4 (Clips) | T-038 | T-039 | T-040 | T-041 | _____ | _____ | _____ | _____ TIER 5 (Feed) | T-045 | T-046 | T-047 | _____ | _____ | _____ TIER 6 (Venue) | T-050 | T-051 | T-052 | _____ | _____ | _____ TIER 7 (Metrics) | T-055 | T-056 | T-057 | _____ | _____ | _____ TIER 8 (Integrations) | T-058 | T-059 | T-060 | _____ | _____ | _____ TIER 9 (Ops + Ready) | T-064 | T-065 | T-066 | T-067 | T-068 | T-069 | T-070 | T-071 | _____ | _____ | _____ | _____ | _____ | _____ | _____ | _____ TIER C (Discovery) | T-080 | T-081 | T-082 | T-083 | T-084 | _____ | _____ | _____ | _____ | _____

Mark each cell: `OPEN` / `READY` / `WIP` / `DONE` / `BLOCKED:T-NNN`

That's 75 tasks. About 20 are READY right now. The rest open as their dependencies clear.

