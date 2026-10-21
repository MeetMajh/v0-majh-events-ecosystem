# MAJH OS — Phase 1.5 Requirements Document

**Status:** Authoritative requirements specification for Phase 1.5
of the MAJH OS substrate. Follows Phase 1 (per
`docs/PHASE_1_REQUIREMENTS.md`).

**Purpose:** Establish escrow as a substrate primitive per
ARCHITECTURE.md v2 §7.2, with automatic ledger integration,
release authorization gate, and reconciliation of existing MAJH
Events escrow tables into the substrate/module boundary.

**Owner:** Malchijah Harding (Founder)

**Drafting reviewer:** Claude (architectural PM)

**Implementation agent:** Production-connected agent with direct
schema visibility

**Last updated:** July 12, 2026

**Version:** 1.0.0

**Blocked by:** Phase 1 applied and verified in production. Phase
1.5 SQL must NOT be applied until Phase 1 verification is complete.

**Reading order for the drafting agent:**

1. `docs/PHASE_1_REQUIREMENTS.md` v1.0.0 (context — Phase 1 is
   the substrate foundation this document extends)
2. This document (requirements)
3. `docs/ARCHITECTURE.md` v2.0.0 §7.2 (escrow specification — the
   technical source of truth for this phase)
4. `docs/ARCHITECTURE.md` v2.0.0 §7.1 (ledger, which escrow
   integrates with)
5. `docs/ARCHITECTURE.md` v2.0.0 §2.4 (compliance boundary — the
   operational-not-custodial framing critical to escrow)
6. `docs/CAPABILITY_MAP.md` v1.0.1 (substrate/module boundary)
7. `docs/ARCHITECTURE_OPEN_QUESTIONS.md` Q4 (module-registered
   account mapping context)

---

## 1. Scope of Phase 1.5

### 1.1 What Phase 1.5 delivers

Phase 1.5 establishes escrow as a substrate primitive. When Phase
1.5 is complete and verified in production:

- The `core.escrow_accounts` table exists per ARCHITECTURE.md v2
  §7.2 specification
- The seven-state state machine is enforced (created,
  awaiting_funding, funded, partially_released, fully_released,
  refunded, disputed, cancelled, closed)
- The opaque data payload contract is enforced (only the owning
  module reads/writes `data`; the `release_rule_module` field is
  immutable after creation)
- Automatic ledger integration on state transitions
  (escrow-ledger bridge generates balanced ledger entries)
- Release authorization gate (password re-authentication in this
  phase; upgrade path to real MFA specified for future work)
- Module-registered escrow account mapping enables modules to
  declare their preferred accounts at activation time
- Non-Stripe funding sources supported (`funding_provider` and
  `funding_reference` columns)
- Ten formal invariants verified by the verification suite
- Existing MAJH Events escrow tables reconciled: relocated to
  module namespace as legacy, with a bridge from the legacy
  tables into the substrate
- The three legacy `player_payouts` rows referenced in commit
  `13655a0` are resolved through the bridge (or explicitly
  documented as remaining outside substrate scope)

### 1.2 What Phase 1.5 does NOT deliver

Explicitly deferred:

- **Real MFA infrastructure via TOTP/WebAuthn.** Phase 1.5 ships
  with password re-authentication (Option 1.5c). Real MFA
  (Option 1.5a) is a separate milestone requiring Supabase MFA
  setup, TOTP enrollment UI, WebAuthn integration, and MFA
  recovery flow. Phase 1.5 leaves clean upgrade paths in the
  schema (columns and function signatures accommodate real MFA
  without restructuring).
- **UI for escrow management.** Phase 1.5 is database and
  substrate service work. Admin UI for viewing escrow accounts,
  authorizing releases, viewing state history is application-
  layer work that follows.
- **Escrow-related dashboards or reports.** Phase 3+ of the
  finance module per ARCHITECTURE.md v2 §8.10.
- **Auto-payout cron resumption.** The paused
  `cron/process-payouts` per commit `13655a0` remains paused
  after Phase 1.5. Resumption requires unified payout system per
  T-005 (separate work).
- **Full retirement of legacy MAJH Events escrow tables.**
  Legacy tables persist in module namespace. Retirement is
  post-Phase-1.5 work when application code no longer references
  them.
- **JSON Schema validation for opaque data payload.** Deferred
  per ARCHITECTURE_OPEN_QUESTIONS.md Q10. Modules declare their
  schemas as documentation; substrate does not enforce them.
- **Escrow-based lending or credit products.** Per
  ARCHITECTURE.md v2 §2.4 compliance boundary. MAJH OS is not a
  lender; escrow is a commitment record, not a credit
  instrument.

### 1.3 What Phase 1.5 preserves

MAJH Events continues to operate through Phase 1.5:

- All existing escrow logic in application code continues to
  function during and after migration
- Existing `escrow_accounts`, `escrow_deposits`,
  `escrow_transactions` remain queryable (relocated to module
  namespace, not deleted)
- The three legacy `player_payouts` rows and any associated
  escrow records remain accessible
- No production payment flows are interrupted
- The paused `cron/process-payouts` remains paused (not
  accidentally resumed)

### 1.4 Compliance boundary reminder

Per ARCHITECTURE.md v2 §2.4 and §7.2:

**MAJH OS is not an escrow agent.** The substrate's escrow
mechanism is an operational commitment record and state machine
that triggers programmatic release instructions to regulated
payment providers. Actual funds remain in the regulated payment
ecosystem at all times.

Phase 1.5 implementation must never use language, table names, or
documentation that implies MAJH OS takes custody of funds. All
substrate documentation must reflect the operational-not-custodial
framing:

- Table comment on `core.escrow_accounts`: "Operational commitment
  records and release state machine. NOT legal escrow custody.
  Actual funds remain in regulated payment providers (Stripe
  Connect and equivalents)."
- Function comments consistent with this framing throughout

### 1.5 Application code impact

Phase 1.5 requires more application code work than Phase 1
because:

- The password re-authentication gate is application-layer logic
  (Phase 1.5 provides the substrate function; the app must call it
  correctly)
- Modules that create escrow (tournament, venue, future
  construction) need to be updated to write through the substrate
  API rather than directly to their own tables
- Legacy escrow tables need to be relocated (`ALTER TABLE ... SET
  SCHEMA`) which may require application code updates for any
  references

Estimated application code impact: moderate. Founder should
allocate time for the application-layer work in the same window
as Phase 1.5 database work, not treat them as sequential phases.

---

## 2. Reconciliation approach

### 2.1 Option E-B confirmed: new substrate table, legacy relocated

Per conversation with founder, Phase 1.5 uses Option E-B:

- Create `core.escrow_accounts` fresh with full ARCHITECTURE.md
  §7.2 specification
- Relocate existing `escrow_accounts`, `escrow_deposits`, and
  `escrow_transactions` from their current schema (likely
  `public`) into a module namespace representing MAJH Events
  tournament escrow
- Bridge from legacy tables into substrate: new tournament
  escrow activity gets substrate representation; historical data
  backfilled where possible; documentation of anything not
  backfilled

### 2.2 Legacy escrow namespace decision

**Decision needed before drafting SQL:** Which module namespace
should legacy escrow tables be relocated into?

**Options:**

- `tournament` — if legacy escrow is primarily tournament-related
  (prize pool holds, player payouts pending distribution)
- `venue` — if legacy escrow is primarily event-related (deposit
  guarantees, event holds)
- A generic `legacy` schema — if the tables span multiple concerns
  and separating is not worth the migration effort now
- `majh_events` — if there's value in a tenant-flagship-specific
  namespace

**Recommendation:** `tournament` if the tables are primarily
tournament-related (the `player_payouts` reference in commit
`13655a0` suggests they are). If the tables span multiple
concerns, use `legacy` and accept the imprecision.

**Agent must determine the right namespace by examining the
existing tables' actual usage before implementing the relocation.**

### 2.3 Bridge design

The bridge from legacy tables to substrate follows the Option 3a
pattern established in Phase 1 for payments:

- On INSERT or state change in legacy escrow tables, a trigger or
  application-layer function creates or updates a corresponding
  `core.escrow_accounts` row
- `source_type` on `core.escrow_accounts` is `tournament_prize_pool`
  (or the appropriate legacy type based on actual usage)
- `source_id` on `core.escrow_accounts` points back to the legacy
  table row
- `release_rule_module` is `tournament` (or the appropriate module)
- The bridge is one-way for the transition period: legacy is
  source of truth; substrate is a read model
- Eventually (post-Phase-1.5), tournament module code is updated
  to write through the substrate; legacy tables become append-only
  archives and are eventually retired

### 2.4 Backfill of historical escrow data

Historical rows in `escrow_accounts`, `escrow_deposits`,
`escrow_transactions` should be backfilled into `core.escrow_accounts`
where possible. Agent decides backfill strategy:

- Every legacy escrow row becomes a substrate escrow row with
  best-effort state mapping (legacy "pending" → substrate
  `awaiting_funding` or `funded` depending on legacy semantics)
- Where legacy state does not map cleanly, agent uses the closest
  match and adds a `data.legacy_state` field to preserve the
  original state
- The three legacy `player_payouts` rows referenced in commit
  `13655a0` receive explicit treatment: either backfilled with
  clear provenance metadata, or explicitly excluded and documented
  in the backfill script

### 2.5 Ledger backfill for historical escrow

Phase 1 (per PHASE_1_REQUIREMENTS.md R10) backfilled hash chain
for historical `ledger_entries`. Phase 1.5 must handle escrow's
ledger integration for historical rows carefully:

- Do NOT retroactively generate ledger entries for historical
  escrow that already have corresponding ledger entries (would
  create duplicates)
- For historical escrow rows that lack corresponding ledger
  entries (should be rare but possible), agent decides whether to
  generate compensating entries or leave the gap documented
- New escrow activity post-Phase-1.5 always generates ledger
  entries automatically via the substrate bridge

---

## 3. Requirements (ordered)

### R1: `core.escrow_accounts` table with full specification

**Rationale:** ARCHITECTURE.md v2 §7.2 is the specification.
Phase 1.5 implements it faithfully.

**Requirement:**

Create `core.escrow_accounts` with columns:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `tenant_id` UUID NOT NULL, FK to `tenants.id`
- `department_id` UUID NULL, FK to `departments.id`
- `location_id` UUID NULL, FK to `locations.id`
- `source_type` TEXT NOT NULL (polymorphic; e.g.
  `tournament_prize_pool`, `construction_milestone`,
  `event_deposit_guarantee`, `royalty_advance`)
- `source_id` UUID NOT NULL (polymorphic — entity or transaction
  this escrow is against)
- `original_amount_cents` BIGINT NOT NULL CHECK
  (`original_amount_cents > 0`) — original commitment; never
  changes after funding
- `currency` VARCHAR(3) NOT NULL DEFAULT 'USD'
- `status` TEXT NOT NULL DEFAULT 'created' — state machine value
- `funding_provider` TEXT NULL — `stripe`, `manual`,
  `plaid_transfer`, `wire`, `other`
- `funding_reference` TEXT NULL — provider-specific reference
- `release_rule_module` TEXT NOT NULL — which module owns release
  rules (`tournament`, `venue`, `construction`, etc.); immutable
  after insert (enforced by trigger)
- `data` JSONB NOT NULL DEFAULT '{}' — opaque payload; only
  owning module reads/writes structure
- `last_release_authorized_by_user_id` UUID NULL, FK to
  `auth.users.id`
- `last_release_auth_verified_at` TIMESTAMPTZ NULL — set by
  password re-auth flow (upgrade path: renamed or extended for
  real MFA)
- `last_release_auth_method` TEXT NULL — `password_reauth` in
  Phase 1.5; `totp`, `webauthn` in future MFA phase; enables
  distinguishing gate strength retroactively
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `created_by_user_id` UUID NULL, FK to `auth.users.id`

Constraints:

- `status IN ('created', 'awaiting_funding', 'funded',
  'partially_released', 'fully_released', 'refunded', 'disputed',
  'cancelled', 'closed')` check constraint
- `original_amount_cents > 0` check constraint
- `currency` format validation (3 uppercase characters) — optional
  per agent judgment
- `funding_provider IN ('stripe', 'manual', 'plaid_transfer',
  'wire', 'other') OR funding_provider IS NULL` check constraint

Indexes:

- `(tenant_id, status)` for status-filtered queries
- `(tenant_id, source_type, source_id)` for polymorphic lookup
- `(release_rule_module)` for module-scoped queries
- `(funding_reference)` where non-null, for reconciliation

Table comment:

> "Operational commitment records and release state machine for
> conditional fund release. NOT legal escrow custody. Actual funds
> remain in regulated payment providers (Stripe Connect and
> equivalents). See ARCHITECTURE.md v2 §2.4 and §7.2."

RLS enabled with tenant-scoped policies (same pattern as Phase 1
R5).

**Acceptance criteria:**

- Table exists with all columns and constraints
- Check constraints enforce valid values
- RLS enforces tenant scope
- Table comment reflects operational-not-custodial framing
- Foreign keys work

**Verification query intent:**

- Structural verification via `information_schema.columns`
- Constraint verification via `pg_constraint`
- Test insert with invalid status → fails
- Test insert with negative amount → fails
- Test tenant isolation

**Reference:** ARCHITECTURE.md v2 §7.2

### R2: Immutable `release_rule_module` trigger

**Rationale:** ARCHITECTURE.md v2 §7.2 requires that
`release_rule_module` be immutable after escrow creation. This
prevents Module A from hijacking Module B's escrow by rewriting
the module assignment.

**Requirement:**

Create BEFORE UPDATE trigger on `core.escrow_accounts`:

- If `OLD.release_rule_module != NEW.release_rule_module`, raise
  exception
- Allow all other updates to proceed

**Acceptance criteria:**

- Attempting to change `release_rule_module` on an existing row
  fails with a specific error
- Other updates (status changes, data updates, etc.) proceed
  normally

**Verification query intent:**

- Test UPDATE attempting to change `release_rule_module` and
  confirm it fails
- Test UPDATE changing `status` and confirm it succeeds (subject
  to state machine validation from R3)

**Reference:** ARCHITECTURE.md v2 §7.2

### R3: State machine enforcement trigger

**Rationale:** ARCHITECTURE.md v2 §7.2 specifies allowed state
transitions. Enforcement at the database prevents modules from
inventing invalid transitions.

**Requirement:**

Create BEFORE UPDATE trigger on `core.escrow_accounts` that
validates state transitions:

Allowed transitions:

- `created` → `awaiting_funding`
- `created` → `cancelled` (edge case: created but immediately voided)
- `awaiting_funding` → `funded`
- `awaiting_funding` → `cancelled`
- `funded` → `partially_released`
- `funded` → `refunded`
- `funded` → `disputed`
- `partially_released` → `partially_released` (successive partial
  releases)
- `partially_released` → `fully_released`
- `disputed` → `funded` (dispute resolved in favor of continuation)
- `disputed` → `refunded` (dispute resolved in favor of refund)
- `disputed` → `fully_released` (dispute resolved in favor of release)
- Any state → `closed` (administrative closure; use with care)

Terminal states (no further transitions allowed except by
service_role administrative override):

- `fully_released`
- `refunded`
- `cancelled`
- `closed`

Invalid transitions raise exception with clear error message.

**Acceptance criteria:**

- All allowed transitions succeed
- Sample invalid transitions fail with expected errors:
  - `created` → `funded` (skips `awaiting_funding`) → fails
  - `fully_released` → `funded` (attempting to reverse) → fails
  - `refunded` → `partially_released` → fails
- Terminal states cannot be re-entered

**Verification query intent:**

- Test each allowed transition in isolation
- Test a representative set of invalid transitions
- Confirm terminal state protection

**Reference:** ARCHITECTURE.md v2 §7.2

### R4: `core.escrow_state_history` audit table (optional but recommended)

**Rationale:** ARCHITECTURE.md v2 §7.2 invariant 5: "Every state
transition is recorded in the audit log." The main `audit_log`
handles this generally, but a dedicated escrow state history
makes escrow-specific auditing simpler and faster.

**Requirement:**

Create `core.escrow_state_history` (append-only):

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `escrow_id` UUID NOT NULL, FK to `core.escrow_accounts.id`
- `tenant_id` UUID NOT NULL (denormalized for RLS efficiency)
- `from_status` TEXT NULL (null for initial creation)
- `to_status` TEXT NOT NULL
- `amount_cents` BIGINT NULL (release amount if applicable)
- `authorized_by_user_id` UUID NULL, FK to `auth.users.id`
- `auth_method` TEXT NULL (`password_reauth`, `totp`, etc.)
- `auth_verified_at` TIMESTAMPTZ NULL
- `notes` TEXT NULL
- `data` JSONB DEFAULT '{}'
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Append-only: BEFORE UPDATE and BEFORE DELETE triggers raising
exceptions (same pattern as `ledger_entries`).

Create AFTER UPDATE trigger on `core.escrow_accounts` that inserts
a row here for every state transition.

Also write to the main `audit_log` per invariant 5. Both places.
This is deliberate redundancy: `audit_log` is for platform-wide
audit; `escrow_state_history` is for escrow-specific querying.

RLS: tenant scope (same pattern as Phase 1 R5).

Indexes:

- `(escrow_id, created_at DESC)` for escrow-specific history
- `(tenant_id, created_at DESC)` for tenant-wide review

**Acceptance criteria:**

- Table exists
- Every escrow state transition creates a history row
- Every escrow state transition also creates an audit_log row
- Append-only enforced
- RLS enforces tenant scope

**Verification query intent:**

- Structural verification
- Test state transition → history row created + audit_log row
  created
- Test UPDATE on history row fails
- Test DELETE on history row fails

**Reference:** ARCHITECTURE.md v2 §7.2 invariant 5

### R5: `platform.module_escrow_account_mapping` table

**Rationale:** Option 1.5e confirmed. Modules register their
preferred escrow account codes at activation time. Substrate uses
this mapping when generating ledger entries. Per
ARCHITECTURE_OPEN_QUESTIONS.md Q4 (now being implemented in
Phase 1.5 rather than deferred further).

**Requirement:**

Create `platform.module_escrow_account_mapping` with columns:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `module_name` TEXT NOT NULL, FK to `platform.modules.module_name`
- `escrow_source_type` TEXT NOT NULL (e.g.
  `tournament_prize_pool`, `construction_milestone`)
- `liability_account_code_suggestion` TEXT NULL — suggested
  account code (e.g., '2200'); tenants may override
- `liability_account_name_suggestion` TEXT NULL — e.g., 'Tournament
  Prize Pool Liability'
- `target_account_code_suggestion` TEXT NULL — where funds go on
  release
- `target_account_name_suggestion` TEXT NULL
- `funding_source_account_code_suggestion` TEXT NULL — where
  funding comes from
- `funding_source_account_name_suggestion` TEXT NULL
- `data` JSONB DEFAULT '{}'
- Standard audit columns

Constraint: `UNIQUE(module_name, escrow_source_type)`.

RLS:

- SELECT: all authenticated users (informational; not confidential)
- INSERT/UPDATE/DELETE: only PLATFORM_OWNER role

Seed initial mappings for currently-known escrow types:

- `tournament` + `tournament_prize_pool`:
  - liability: '2200' / 'Tournament Prize Pool Liability'
  - target: '5100' / 'Prize Distribution Expense'
  - funding_source: '4200' / 'Tournament Entry Fee Revenue'

Agent adds more as identified from existing MAJH Events tournament
escrow data.

Also create `core.tenant_escrow_account_overrides` for tenant-level
customization:

- `id` UUID PRIMARY KEY
- `tenant_id` UUID NOT NULL, FK to `tenants.id`
- `module_name` TEXT NOT NULL
- `escrow_source_type` TEXT NOT NULL
- `liability_account_id` UUID NOT NULL, FK to
  `core.ledger_accounts.id` — the tenant's actual account for this
  purpose
- `target_account_id` UUID NOT NULL, FK to `core.ledger_accounts.id`
- `funding_source_account_id` UUID NOT NULL, FK to
  `core.ledger_accounts.id`
- Standard audit columns

Constraint: `UNIQUE(tenant_id, module_name, escrow_source_type)`.

RLS: tenant scope; only tenant admins can modify.

The substrate escrow-ledger bridge looks up tenant override first,
falls back to module mapping suggestions, falls back to error if
neither exists.

**Acceptance criteria:**

- Both tables exist with structure
- Initial module mappings seeded
- MAJH Events tenant has overrides configured for tournament
  escrow (using actual MAJH Events account codes)
- RLS enforces intended access
- Lookup function returns correct accounts for a given tenant +
  module + source_type

**Verification query intent:**

- Structural verification
- Test lookup: for MAJH Events + tournament + tournament_prize_pool
  → returns MAJH Events tenant override values
- Test lookup: for hypothetical new tenant + tournament +
  tournament_prize_pool → returns module suggestion (or error if
  no override yet)

**Reference:** ARCHITECTURE.md v2 §7.2 escrow-ledger integration;
ARCHITECTURE_OPEN_QUESTIONS.md Q4

### R6: `core.escrow_service` function — funding workflow

**Rationale:** The substrate provides a service function that
modules call to fund an escrow. The service handles ledger entry
generation, state transition, audit logging, and validation.

**Requirement:**

Create function `core.escrow_fund(...)`:

Parameters:

- `p_escrow_id` UUID — the escrow being funded
- `p_funding_provider` TEXT — `stripe`, `manual`, etc.
- `p_funding_reference` TEXT — provider-specific reference
- `p_authorized_by_user_id` UUID — who initiated

Behavior:

1. Verify escrow is in `awaiting_funding` state (raise error if not)
2. Look up the tenant's escrow account mapping (per R5)
3. Generate balanced ledger entries via financial intents pattern:
   - Debit cash/asset account (funding_source_account)
   - Credit escrow liability account (liability_account)
   - Amount = `original_amount_cents`
   - Grouped by a new `linked_transaction_id` UUID
4. Update escrow status to `funded`
5. Update `funding_provider` and `funding_reference` on escrow row
6. State machine trigger (R3) validates transition
7. State history trigger (R4) creates history row + audit_log row

Return: the new `linked_transaction_id` UUID for the module to
reference.

Language: `plpgsql`, `SECURITY DEFINER` (to bypass RLS for ledger
entry writes; carefully audited).

Grant EXECUTE to appropriate roles.

**Acceptance criteria:**

- Function exists
- Test call: fund an escrow → escrow becomes `funded`, ledger
  entries created, history row created, audit_log row created
- Test call on escrow already funded → fails with clear error
- Test call on non-existent escrow → fails
- Function respects tenant scope (cannot fund an escrow from
  another tenant even if user has the escrow_id)

**Verification query intent:**

- Test happy path: create escrow, fund it, verify all rows
  created correctly
- Test error path: attempt double-fund
- Test error path: attempt cross-tenant funding

**Reference:** ARCHITECTURE.md v2 §7.2 funding logic

### R7: `core.escrow_service` function — release workflow with password re-auth gate (1.5c)

**Rationale:** ARCHITECTURE.md v2 §7.2 requires MFA verification
for all state transitions that reduce committed liability. Phase
1.5 uses password re-authentication (Option 1.5c) as the gate,
with clean upgrade path to real MFA later.

**Requirement:**

Create function `core.escrow_release(...)`:

Parameters:

- `p_escrow_id` UUID
- `p_release_amount_cents` BIGINT — amount to release (may be
  partial)
- `p_release_type` TEXT — `full`, `partial`, `refund` (drives
  target account selection)
- `p_authorized_by_user_id` UUID
- `p_password_verified_within_seconds` INTEGER — how recently
  the user re-authenticated (application must have verified
  password within this window and passed the value; substrate
  enforces the ceiling)
- `p_notes` TEXT — optional notes for history

Behavior:

1. Verify escrow exists and belongs to the caller's tenant scope
2. Verify current escrow status permits the requested release
   (e.g., `partially_released` from `funded` or successive
   `partially_released`; `fully_released` from `funded` or
   `partially_released`)
3. Verify `p_release_amount_cents` does not exceed remaining
   funded balance (per invariant 4)
4. Verify authorization gate:
   - `p_password_verified_within_seconds` must be <= 600 (10
     minutes)
   - `p_authorized_by_user_id` must exist and be a MAJH Events
     tenant member with appropriate role
5. Look up tenant's escrow account mapping (per R5)
6. Generate balanced ledger entries per release type:
   - **Partial or full release:** Debit escrow liability, credit
     target account (module-specified via mapping)
   - **Refund:** Debit escrow liability, credit funding source
     account
7. Update escrow status per state machine (partial/full/refund)
8. Update `last_release_authorized_by_user_id`,
   `last_release_auth_verified_at` = now(),
   `last_release_auth_method` = 'password_reauth'
9. State machine trigger validates transition
10. State history row created with `auth_method = 'password_reauth'`
    and `auth_verified_at` = now()
11. audit_log row created

Return: the new `linked_transaction_id` UUID.

**Application layer responsibility (documented, not in substrate):**

The application must:
- Show a password re-entry prompt to the user
- Verify the password via Supabase Auth
- Compute the seconds since re-authentication
- Pass that value to `core.escrow_release`

The substrate function trusts the caller's `p_password_verified_within_seconds`
value. This is deliberate: substrate cannot query Supabase Auth
mid-function. Instead, application must be trusted for the value,
and this trust is enforced by application-layer code review and
by the audit trail.

**Upgrade path to real MFA (Option 1.5a) documented in schema
comments:**

When real MFA is available:

- Rename `last_release_auth_method` and `auth_method` columns to
  reflect broader auth semantics (or add explicit MFA columns)
- Application flow changes from "password re-entry" to
  "TOTP challenge" or "WebAuthn assertion"
- Substrate function signature can remain the same
  (`p_password_verified_within_seconds` becomes
  `p_mfa_verified_within_seconds`)
- Historical rows retain their `auth_method = 'password_reauth'`
  values, providing an audit trail of the gate strength at time
  of release

**Acceptance criteria:**

- Function exists
- Test call: release from funded escrow → status changes
  correctly, ledger entries created, history row logs the
  release with method
- Test call with `p_password_verified_within_seconds > 600` →
  fails with authorization error
- Test partial release then full release completes correctly
- Test release amount exceeding balance → fails with clear error
- Test cross-tenant release attempt → fails

**Verification query intent:**

- Happy path testing
- Edge case testing (partial then full, refund)
- Authorization gate testing (recent vs. stale password)
- Amount validation testing
- Cross-tenant isolation testing

**Reference:** ARCHITECTURE.md v2 §7.2 release authorization gate;
Option 1.5c founder decision

### R8: `core.escrow_service` function — dispute workflow

**Rationale:** Disputes are a real state per ARCHITECTURE.md v2
§7.2. No money movement until resolution. Substrate must support
transitioning to and from disputed state.

**Requirement:**

Create function `core.escrow_dispute(...)`:

Parameters:

- `p_escrow_id` UUID
- `p_authorized_by_user_id` UUID
- `p_notes` TEXT — reason for dispute

Behavior:

1. Verify escrow is currently in `funded` state
2. Transition to `disputed`
3. Do NOT generate ledger entries (disputes are legal/operational
   state; entries resume on resolution)
4. State history row and audit_log row created

Create function `core.escrow_resolve_dispute(...)`:

Parameters:

- `p_escrow_id` UUID
- `p_resolution` TEXT — `funded` (return to funded),
  `refunded` (full refund), `fully_released` (release to target)
- `p_release_amount_cents` BIGINT NULL — only if resolution is
  `fully_released` or `partially_released`
- `p_authorized_by_user_id` UUID
- `p_password_verified_within_seconds` INTEGER — same auth gate
  as R7
- `p_notes` TEXT

Behavior: Depending on resolution, invoke the appropriate release
logic (per R7) or refund logic, or simply transition back to
`funded` if the dispute was resolved without money movement.

**Acceptance criteria:**

- Both functions exist
- Dispute transition works
- Resolution to each of the three possible states works
- Auth gate applied to resolutions that move money
- State history logs both dispute and resolution

**Verification query intent:**

- Happy path: fund → dispute → resolve to each of three states
- Verify no ledger movement during dispute; movement on resolution

**Reference:** ARCHITECTURE.md v2 §7.2 disputed state handling

### R9: Legacy escrow table relocation

**Rationale:** Option E-B. Existing `escrow_accounts`,
`escrow_deposits`, `escrow_transactions` relocated to module
namespace as legacy tables.

**Requirement:**

Agent determines correct target module namespace per §2.2 above.
Assumed here as `tournament` schema; adjust based on actual
usage.

- Create `tournament` schema if it does not exist (create
  privileges same pattern as `core` and `platform`)
- Verify what depends on the existing tables (RLS policies,
  application code, other tables' foreign keys)
- Relocate tables using `ALTER TABLE public.escrow_accounts SET
  SCHEMA tournament` (and similarly for the other two)
- Update any RLS policies that reference the old schema-qualified
  names
- Update application code references (this is application-layer
  work; agent identifies the files that need update; founder or
  agent updates them)
- Preserve foreign key relationships

Alternative if `ALTER TABLE SET SCHEMA` is complex due to
dependencies: create views in `tournament.*` that alias to
`public.*` for a transition period; retire when application code
is updated.

**Acceptance criteria:**

- Relocated tables exist in `tournament` schema (or chosen
  alternative)
- Existing data intact
- Existing RLS policies still enforce correctly
- Application code paths that reference the tables either updated
  or documented as needing update
- No data loss

**Verification query intent:**

- Confirm tables exist in new schema
- Confirm row counts match pre-relocation counts
- Sample queries return same data
- RLS still isolates correctly

**Reference:** Option E-B (founder decision); ARCHITECTURE.md v2
§6

### R10: Legacy-to-substrate bridge for escrow

**Rationale:** Option E-B pattern. Bridge from legacy escrow
tables to substrate `core.escrow_accounts`.

**Requirement:**

Design bridge trigger or function:

- On INSERT to legacy escrow table, create corresponding
  `core.escrow_accounts` row with:
  - `source_type` = `tournament_prize_pool` (or as appropriate)
  - `source_id` = legacy row's `id`
  - `original_amount_cents` = derived from legacy amount fields
  - `status` = mapped from legacy status (agent determines
    mapping; e.g., legacy 'pending' → substrate `awaiting_funding`,
    legacy 'held' → substrate `funded`)
  - `release_rule_module` = `tournament` (or as appropriate)
  - `data` JSONB includes `legacy_id` for traceability
- On UPDATE to legacy escrow row status, update corresponding
  substrate row status via bridge

Backfill: walk existing legacy escrow rows and create
substrate rows for each. Handle the three legacy `player_payouts`
rows per commit `13655a0` with explicit provenance metadata (e.g.,
`data.legacy_reference = 'player_payouts row X, migrated
2026-Y-Z'`).

Alternative: If the bridge triggers create complexity or if legacy
tables are being retired soon, do a one-time backfill and forgo
ongoing bidirectional sync. New tournament escrow activity writes
directly to substrate via updated application code.

Agent decides based on how much longer legacy tables will remain
in use.

**Acceptance criteria:**

- Bridge exists (trigger, function, or documented one-time
  backfill)
- Historical rows backfilled with clear provenance
- New escrow activity produces substrate rows
- The three legacy `player_payouts` rows have documented handling
- No data loss

**Verification query intent:**

- Row count comparison: legacy count matches substrate count for
  the tournament source_type
- Sample lookups from either side return matching records
- The three legacy `player_payouts` rows are queryable in
  substrate with provenance metadata

**Reference:** Option E-B bridge design

### R11: Ten escrow invariants verification suite

**Rationale:** ARCHITECTURE.md v2 §7.2 documents ten formal
invariants. Phase 1.5 must include a verification suite that
confirms each invariant holds after implementation.

**Requirement:**

Create verification queries for each of the ten invariants:

1. **Every escrow account belongs to exactly one tenant.**
   Query: `SELECT COUNT(*) FROM core.escrow_accounts WHERE
   tenant_id IS NULL` should be 0.

2. **Every funding event produces balanced ledger entries.**
   Query: For each funding event, sum debits and credits by
   `linked_transaction_id`; should be zero.

3. **Every release produces balanced ledger entries.**
   Same pattern for release events.

4. **Total releases may never exceed funded amount.**
   Query: For each escrow, sum of release amounts should not
   exceed `original_amount_cents`.

5. **Every state transition is recorded in the audit log.**
   Query: Count of escrow state changes should match count of
   related audit_log entries.

6. **Only the owning module may evaluate release conditions.**
   (Enforced by application code and R7 function; verify by
   inspection of module registrations.)

7. **Only authorized actors may execute releases.**
   Query: Every release in escrow_state_history has non-null
   `authorized_by_user_id`.

8. **Escrow records are append-only except for permitted state
   transitions.**
   (Enforced by R2, R3 triggers; verified by attempting
   forbidden UPDATEs.)

9. **The `release_rule_module` field is immutable after escrow
   creation.**
   (Enforced by R2 trigger; verified by attempting to change.)

10. **Actual custody of funds always remains with an external
    regulated financial account.**
    (Architectural — verified by inspection; no funds pool
    exists in substrate schema. Verify: no table named
    `platform_holding_account` or similar exists.)

Package all ten as a single verification suite runnable from psql.

**Acceptance criteria:**

- All ten queries exist
- All ten pass on freshly-migrated production
- Suite runs to completion
- Any failure is clearly attributed to specific invariant

**Verification query intent:**

- The suite itself

**Reference:** ARCHITECTURE.md v2 §7.2 ten invariants

### R12: Real MFA upgrade path documented

**Rationale:** Phase 1.5 ships with password re-auth (Option
1.5c). Real MFA (Option 1.5a) is a future milestone. Phase 1.5
must document the upgrade path so the future work is well-scoped.

**Requirement:**

Create `docs/ESCROW_MFA_UPGRADE.md` describing:

- Current state (Phase 1.5): password re-authentication gate
- Target state (Phase 1.6 or later): TOTP or WebAuthn MFA
- Required Supabase changes: enable MFA feature, configure
  factors
- Required application changes: enrollment flow, factor
  management, challenge flow
- Required schema changes (if any): may just rename columns for
  clarity, or add new columns for MFA-specific state
- Migration approach: application-code first, then substrate
  function signatures, then column renames
- Backward compatibility: historical rows with
  `auth_method = 'password_reauth'` retain audit trail integrity

Estimated effort: this is scoping only. Actual implementation
is separate work post-Phase-1.5.

**Acceptance criteria:**

- Document exists in `docs/`
- Covers the required upgrade areas
- Clear on what stays the same vs. what changes

**Verification query intent:**

- Not applicable; document delivery.

**Reference:** Founder decision on 1.5c with 1.5a upgrade path

### R13: Verification suite integration with Phase 1

**Rationale:** Phase 1.5 depends on Phase 1's substrate. The
verification suite should confirm Phase 1's foundation is still
sound after Phase 1.5 changes.

**Requirement:**

Extend `docs/PHASE_1_VERIFICATION.sql` (or create
`docs/PHASE_1.5_VERIFICATION.sql` that runs alongside):

- All Phase 1 verification queries still pass
- Ten escrow invariant queries pass (per R11)
- Bridge queries pass (row counts reconcile)
- State machine tests pass
- Authorization gate tests pass

**Acceptance criteria:**

- Verification script exists
- All queries pass on freshly-migrated production
- Any failure clearly attributed

**Verification query intent:**

- The suite itself

**Reference:** Testing discipline

### R14: Rollback plan for Phase 1.5

**Rationale:** Per Phase 1 R25, rollback plan is required.

**Requirement:**

Document rollback plan in `docs/PHASE_1.5_ROLLBACK.md`:

- DROP `core.escrow_accounts` (in dependency order)
- DROP `core.escrow_state_history`
- DROP `platform.module_escrow_account_mapping`
- DROP `core.tenant_escrow_account_overrides`
- DROP created functions
- DROP created triggers
- Reverse table relocation: move relocated tables back to public
  schema
- Data preservation notes: substrate escrow data lost; legacy
  data preserved throughout
- Bridge data preservation notes

**Acceptance criteria:**

- Document exists
- Rollback SQL is executable
- Data implications clear

**Verification query intent:**

- Not applicable; document delivery.

**Reference:** Standard migration hygiene

---

## 4. Order of application

Phase 1.5 SQL should be applied in the following order. Phase 1.5
requires Phase 1 to be fully applied and verified first.

**Prerequisite verification (before Phase 1.5 begins):**

- Phase 1 fully applied to production
- Phase 1 verification suite passes
- Phase 1 has been in production long enough to reveal any
  latent issues (recommend at least 7 days)
- Founder confirms Phase 1.5 readiness

**Phase 1.5a (schemas and mapping infrastructure):**

1. R5 — `platform.module_escrow_account_mapping` and
   `core.tenant_escrow_account_overrides` (creating first because
   R6/R7 functions depend on this)

**Verification checkpoint:** Mapping infrastructure exists;
substrate lookup function works.

**Phase 1.5b (create escrow tables):**

2. R1 — `core.escrow_accounts`
3. R4 — `core.escrow_state_history`

**Verification checkpoint:** Tables exist; RLS enforces isolation.

**Phase 1.5c (state machine enforcement):**

4. R2 — immutable release_rule_module trigger
5. R3 — state machine trigger

**Verification checkpoint:** Triggers reject invalid transitions.

**Phase 1.5d (substrate service functions):**

6. R6 — funding function
7. R7 — release function with auth gate
8. R8 — dispute functions

**Verification checkpoint:** Test each function end-to-end.

**Phase 1.5e (legacy reconciliation):**

9. R9 — legacy escrow table relocation
10. R10 — legacy-to-substrate bridge and backfill

**Verification checkpoint:** Legacy tables relocated; substrate
mirrors legacy; historical data backfilled.

**Phase 1.5f (verification and documentation):**

11. R11 — ten invariants verification suite
12. R12 — MFA upgrade path documentation
13. R13 — integrated Phase 1 + 1.5 verification
14. R14 — rollback plan documentation

**Final verification checkpoint:** All ten invariants pass; all
verifications succeed.

---

## 5. Handoff to drafting agent

### 5.1 What the drafting agent produces

- `docs/PHASE_1.5_SCHEMA.md` — full SQL specification
- `docs/PHASE_1.5_VERIFICATION.sql` — verification queries
  including the ten invariants
- `docs/PHASE_1.5_BACKFILL.md` — legacy escrow backfill scripts
- `docs/PHASE_1.5_ROLLBACK.md` — rollback plan
- `docs/ESCROW_MFA_UPGRADE.md` — upgrade path for real MFA

### 5.2 What the drafting agent must do first

Before writing SQL:

- Confirm Phase 1 is fully applied and verified in production
- Query existing `escrow_accounts`, `escrow_deposits`,
  `escrow_transactions` to understand actual current state,
  data volume, and dependencies
- Identify which module namespace legacy escrow should relocate
  to (§2.2)
- Identify current MAJH Events chart of accounts entries that
  correspond to escrow-related accounts
- Answer relevant reconnaissance questions from the 48-question
  list that pertain to escrow (Q13, Q14, Q15 specifically)

### 5.3 What the drafting agent must escalate

The following decisions need founder confirmation:

- Legacy escrow namespace (`tournament`, `venue`, `legacy`, or
  other) per §2.2
- Backfill scope decision for the three legacy `player_payouts`
  rows (backfill with provenance vs. document as excluded)
- Whether ongoing bidirectional sync between legacy and substrate
  is required, or a one-time backfill is sufficient
- Actual MAJH Events chart of accounts codes for the tournament
  escrow mapping (R5 override)
- Approval to proceed with Phase 1.5 application after Phase 1
  verification

### 5.4 What the drafting agent must review with Claude (architectural PM)

Before applying to production:

- Full draft of all five Phase 1.5 documents
- Especially: the ten invariants queries, the state machine
  logic, the auth gate implementation

Architectural review confirms:

- Escrow implementation matches ARCHITECTURE.md v2 §7.2 exactly
- Compliance boundary (§2.4) is maintained throughout
- No custody language in table comments or code
- Ten invariants are correctly translated to queries
- Legacy reconciliation follows Option E-B
- Bridge preserves data integrity

### 5.5 What the drafting agent must do before applying to
production

Same discipline as Phase 1:

- Apply to Supabase branch first
- Run full verification (Phase 1 + Phase 1.5)
- Spot-check MAJH Events tournament data
- Confirm all invariants pass
- Get founder final approval
- Merge to production during low-usage window
- Run verification in production
- Document actual outcomes

---

## 6. What comes after Phase 1.5

For context:

- **Real MFA implementation (Phase 1.6 or later):** per R12 upgrade
  path
- **Legacy escrow table retirement:** post-Phase-1.5 when
  application code fully migrated
- **Unified payout system (T-005):** consolidates the dual
  `player_payouts` / `payout_requests` systems into
  `core.payments_out` per Phase 1
- **Auto-payout cron resumption:** requires unified payout system
- **Finance module Phase 1:** invoicing, AR summary, department-
  scoped P&L (per ARCHITECTURE.md v2 §8.8)

Phase 1.5 does not block or enable any of these directly. Each
follows its own critical path.

---

## 7. Companion documents

- `docs/PHASE_1_REQUIREMENTS.md` — the substrate foundation
  Phase 1.5 builds on
- `docs/ARCHITECTURE.md` v2.0.0 — technical source of truth
- `docs/CAPABILITY_MAP.md` v1.0.1 — substrate/module boundary
- `docs/STRATEGIC_DIRECTION.md` v1.1.1 — strategic frame
- `docs/ARCHITECTURE_OPEN_QUESTIONS.md` — related deferred items
  (Q4, Q10 relevant here)
- `docs/AGENT_COLLABORATION_PROTOCOL.md` — how agent operates

---

*Escrow is where compliance meets commitment. Get both right or
neither works.*
