# MAJH OS — Phase 1 Requirements Document

**Status:** Authoritative requirements specification for Phase 1 of
the MAJH OS substrate. Referenced by the (forthcoming)
`docs/PHASE_1_SCHEMA.md` implementation document.

**Purpose:** Give the drafting agent a precise, ordered list of what
Phase 1 must accomplish, with acceptance criteria per requirement,
so the agent can focus on SQL and verification queries rather than
translating architecture into scope.

**Owner:** Malchijah Harding (Founder)

**Drafting reviewer:** Claude (architectural PM, this conversation)

**Implementation agent:** Production-connected agent with direct
schema visibility

**Last updated:** August 1, 2026

**Version:** 1.1.0

**Changelog from v1.0.0:** This revision reframes Phase 1 around a
sharper thesis, arrived at after the Phase 1 rollback and a full
production reconnaissance: MAJH OS is only as valuable as its
ability to absorb a real tenant's fractured legacy conventions
without demanding the tenant clean itself up first. MAJH Events —
three membership tables with three different role vocabularies, a
dual payout system, fragmented payment tables, incomplete audit
trails — is not a problem to route around. It is the test case.
v1.1.0 adds:

- §2 (new): The Reconciliation Discipline — a standardized lineage
  pattern applied across `core.*` tables, and a semantic mapping
  mechanism for reconciling legacy vocabulary into substrate
  concepts
- R9 revised: `entities` moves into the `core` schema rather than
  staying in `public`
- R13 expanded: vocabulary overlays now carry semantic
  reconciliation (legacy term → substrate concept), not just UI
  label rendering
- R20 substantially reworked: membership reconciliation produces a
  coherent `core.participants` identity layer from all three
  legacy membership tables, rather than a one-row backfill
- R21, R22 revised: payment and payout bridges now correlate across
  multiple legacy tables per transaction and record full lineage
  rather than a 1:1 copy
- R26 (new): Reconciliation reporting — queryable coverage and
  conflict visibility
- R27 (new): Drift detection — periodic check that bridged
  substrate rows still match their legacy sources
- R28 (new): Mandatory "coherent identity" verification test,
  concretely specified against Malchijah's three login profiles and
  Zachary's three-table role history

**Reading order for the drafting agent:**

1. This document (requirements)
2. `docs/ARCHITECTURE.md` v2.1.0 (technical source of truth,
   especially §2, §3, §4, §6, §7, §10, §12, §14)
3. `docs/CAPABILITY_MAP.md` v1.0.1 (substrate/module boundary)
4. `docs/STRATEGIC_DIRECTION.md` v1.1.1 (the "why" — MAJH Events
   sits on substrate; substrate serves every tenant)
5. `docs/ARCHITECTURE_OPEN_QUESTIONS.md` (what to explicitly NOT
   include; deferred items)
6. `docs/PHASE_1_RECONNAISSANCE_INDEX.md` and the eight section
   reports it indexes (the production ground truth this revision is
   built against — read these before drafting any SQL, since
   several v1.0.0 assumptions were corrected by them)

---

## 1. Scope of Phase 1

### 1.0 The thesis this phase is testing

MAJH OS is not valuable because it has six universal primitives in
the abstract. It is valuable if those primitives can absorb a real
organization's accumulated mess — multiple teams building at
different times, conventions that changed, systems that were
half-migrated and never finished — and produce one coherent,
accurate, orderly operational picture without requiring the tenant
to clean up its own history first.

MAJH Events is that test case, not a special case to work around.
Production reconnaissance ahead of this revision found exactly the
kind of fracture every real organization eventually accumulates:

- Three membership tables (`organization_members`, `staff_roles`,
  `tenant_memberships`) with three different role vocabularies,
  none of which fully agrees with the others about who has what
  authority
- A dual payout system (`payout_requests` and `player_payouts`)
  that likely represents overlapping reality rather than two
  clean, distinct systems
- Payment tracking split across `payment_requests`,
  `payment_events`, and `payment_receipts` for what is probably one
  underlying transaction per set
- The founder himself represented by three separate login profiles,
  each a legitimate distinct working identity, not an error to
  merge away
- Zachary present in all three membership tables with three
  different role labels for what is operationally the same
  authority level

None of this is unusual. It is what real organizations look like.
A substrate that only works when the tenant's data is already tidy
is not a substrate — it is a schema that happens to fit one
greenfield case. Phase 1 has to prove the harder claim: that the
substrate can take this specific fractured reality and produce a
single coherent view of it, with full lineage back to every source
row, without silently discarding disagreement or forcing a
premature choice about which legacy source was "right."

This does not mean Phase 1 tries to fix MAJH Events' history. It
means Phase 1 builds the substrate's capacity to *hold* that
history coherently. Fixing — deciding that `tenant_memberships`
should retire, that role vocabularies should converge — remains
later work, tracked as such. What Phase 1 must deliver is the
substrate's ability to reconcile without erasing, and to make the
seams visible rather than papering over them.

Section 2 of this document specifies the mechanism (lineage
columns, semantic mapping) that makes this possible. Every
requirement in Section 4 that touches a legacy-adjacent table
inherits that mechanism.

### 1.1 What Phase 1 delivers

Phase 1 establishes the universal substrate for MAJH OS. When
Phase 1 is complete and verified in production:

- The six universal primitives exist (`entities`, `participants`,
  `resources`, `payments_in`, `payments_out`, plus `tenants` which
  already exists)
- The four-level hierarchy (Platform → Tenant → Department →
  Location) is expressed in schema and enforced by RLS on all
  substrate tables
- The financial ledger has hash chain integrity, immutability
  enforcement, and financial intents pattern support
- The module system has a registry and per-tenant activation
- The vocabulary overlay system has storage (rendering pipeline
  is separate, application-layer work)
- The event store and outbox are ready for cross-module
  communication and adapter integration
- MAJH Events (the flagship tenant) continues to operate without
  interruption

### 1.2 What Phase 1 does NOT deliver

Explicitly deferred, in the phase noted:

- **Escrow tables and state machine** → Phase 1.5. `escrow_accounts`,
  the state machine, MFA gate, opaque data contract, and the
  escrow-ledger bridge.
- **Finance module tables** → separate finance module implementation.
  `finance.invoices`, `finance.bills`, etc. Substrate provides
  the ledger and the primitives; finance module is a separate
  workstream.
- **Vocabulary overlay rendering pipeline** → application-layer
  work. Phase 1 provides storage; the React `useVocabulary()` hook
  and component contract are separate work.
- **Ralph knowledge pool population** → Ralph Phase 2 in
  `docs/RALPH_BLUEPRINT.md`. Phase 1 creates the `knowledge_vectors`
  table; ingestion and search are Ralph work.
- **Membership table *consolidation*** → separate ticket (T-011
  continuation from April BACKLOG). Consolidation means physically
  retiring `tenant_memberships` and/or `staff_roles` in favor of one
  table. That decision — and the application-code migration it
  requires — is separate work. Phase 1 uses `organization_members`
  for new substrate table *RLS gating* because it has the
  department_id and location_id columns four-level scope needs.
  **This is distinct from membership *reconciliation*, which IS in
  Phase 1 scope per R20:** producing a coherent `core.participants`
  identity layer from all three legacy tables, with lineage and
  conflict visibility, without retiring any of them. Reconciliation
  is how the substrate holds the fracture; consolidation is a later
  decision about whether to resolve it at the source.
- **Unified payout system *consolidation*** → T-005 from April
  BACKLOG. Consolidation means retiring the dual `player_payouts` /
  `payout_requests` tables in favor of one. That's separate work.
  Phase 1 provides `payments_out` as a substrate primitive AND
  bridges both legacy tables into it with lineage per R22 — the
  legacy tables keep running; the substrate holds a reconciled view
  alongside them.
- **GRI (Global Resource Identifier) system** → deferred per
  `ARCHITECTURE_OPEN_QUESTIONS.md` Q1. Phase 1 uses `source_type` +
  `source_id` UUID pairs for polymorphic linkage.
- **Per-module database migration tracking** → deferred per
  `ARCHITECTURE_OPEN_QUESTIONS.md` Q2. Phase 1 uses global
  migration tracking.
- **Dual-key RLS for knowledge pool** → deferred per
  `ARCHITECTURE_OPEN_QUESTIONS.md` Q3. Phase 1 creates the
  `knowledge_vectors` table with `origin_module` column so the
  future dual-key policy can be added later without table
  restructuring.

### 1.3 What Phase 1 preserves

MAJH Events is the flagship tenant. Phase 1 must not break MAJH
Events. Specifically:

- All existing tables continue to function
- All existing RLS policies continue to enforce their existing
  scope
- All existing application code paths continue to work
- User access is not disrupted
- Payment flows continue (both the working auto-payouts cron and
  the paused process-payouts cron; Phase 1 does not resume the
  paused cron)
- The three "Malchijah profiles" (all the founder's login accounts)
  continue to have appropriate access
- Zach's supervisor access (currently in `tenant_memberships` and
  `staff_roles`) is preserved

### 1.4 Application code impact

Phase 1 is primarily database work. Application code impact is
limited to:

- Bridge triggers or functions that copy MAJH Events payment
  activity into `core.payments_in` and `core.payments_out` on write
- Possibly minor changes to tenant provisioning to populate
  `vocabulary_overlay_id` and `activated_modules` on new tenant
  creation
- Ralph and knowledge pool code is not touched in Phase 1

Substantial application refactoring (moving all payment writes to
substrate, retiring legacy tables, consolidating membership tables)
is subsequent phase work.

---

## 2. The reconciliation discipline

This section defines the mechanism that makes §1.0's thesis
concrete. Every requirement in §4 that ingests, bridges, or
reconciles legacy data must use this pattern. It is defined once
here rather than repeated per-requirement so that it stays
consistent across every table that needs it.

### 2.1 The standard lineage pattern

Any `core.*` table whose rows are wholly or partly reconciled from
one or more legacy sources (as opposed to rows created fresh
through normal substrate operation) carries five standardized
columns:

- `provenance_source` JSONB NOT NULL DEFAULT `'[]'` — an array of
  the legacy tables (schema-qualified) that contributed to this
  row, e.g. `[{"schema": "public", "table": "payment_requests"},
  {"schema": "public", "table": "payment_events"}]`. Empty array
  means the row was created natively in the substrate, not
  reconciled from anything.
- `provenance_legacy_ids` JSONB NOT NULL DEFAULT `'[]'` — an array
  mapping each contributing legacy row precisely, e.g.
  `[{"table": "payment_requests", "id": "..."}, {"table":
  "payment_events", "id": "..."}]`. This is what makes a substrate
  row auditable back to its exact sources, not just its source
  tables.
- `provenance_bridge_version` TEXT NULL — identifies which version
  of the bridge/reconciliation logic produced this row (a simple
  string like `'2026.08.01-r1'` is sufficient; it does not need to
  be semver-strict). When bridge logic changes, this lets you find
  every row produced by the old logic and decide whether it needs
  re-reconciliation.
- `provenance_bridge_run_at` TIMESTAMPTZ NULL — when the bridge or
  reconciliation function last wrote or confirmed this row.
- `provenance_drift_checked_at` TIMESTAMPTZ NULL — when this row
  was last checked against its legacy sources for drift (per R27).
  Null means never checked, which is the expected state
  immediately after Phase 1 lands and before the first scheduled
  drift check runs.

**Which tables get this pattern:** `core.participants`,
`core.payments_in`, `core.payments_out`. These three are the tables
where Phase 1 is reconciling genuinely fractured legacy data. Other
`core.*` tables (`core.resources`, `core.ledger_accounts`,
`core.event_store`, `core.outbox`, `core.knowledge_vectors`,
`core.vocabulary_overlays`, `platform.modules`) do not need the
full pattern because they are not reconciliation targets in Phase
1 — they are created fresh or platform-curated. If a future phase
needs to reconcile one of them from some other legacy source, add
the pattern to that table at that time; do not add it speculatively
now.

**What this pattern does NOT do:** it does not attempt real-time
bidirectional sync between substrate and legacy sources. Phase 1
delivers one-time reconciliation at bridge-run time, plus the
capacity to periodically re-check for drift (R27). Real-time sync
in either direction is explicitly out of scope for Phase 1 — it is
meaningfully harder (it requires deciding what happens when
substrate and legacy disagree *after* both have been independently
written to) and should not be attempted until reconciliation itself
has been proven stable in production.

### 2.2 Semantic reconciliation: `core.legacy_semantic_mappings`

Lineage columns record *which* legacy rows contributed to a
substrate row. They do not resolve *disagreements* between legacy
sources about what a value means. That is a separate problem:
MAJH Events' three membership tables use `TENANT_MANAGER` (two
tables) and `admin` (one table) to describe what is operationally
the same authority level. A human reading all three knows they
mean roughly the same thing. The substrate needs an explicit,
queryable record of that same knowledge, not an implicit assumption
buried in bridge code.

`core.legacy_semantic_mappings` — tenant-scoped table:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `tenant_id` UUID NOT NULL, FK to `tenants.id` — mappings are
  tenant-scoped because different tenants' legacy conventions will
  differ; a future messy tenant is not guaranteed to use the same
  terms MAJH Events does
- `legacy_source` TEXT NOT NULL — the legacy table this term comes
  from, e.g. `'staff_roles'`, `'tenant_memberships'`,
  `'organization_members'`
- `legacy_term` TEXT NOT NULL — the actual string found in that
  table, e.g. `'admin'`, `'TENANT_MANAGER'`, `'owner'`
- `substrate_concept` TEXT NOT NULL — the canonical substrate-level
  concept this term maps to, e.g. `'tenant_manager'`,
  `'tenant_owner'`, `'platform_owner'`. This vocabulary should be a
  small closed set the founder can review, not open-ended free text.
- `confidence` TEXT NOT NULL DEFAULT `'exact'` — `'exact'` (the
  terms clearly mean the same thing), `'approximate'` (reasonable
  inference, worth a human glance), or `'flagged'` (agent could not
  confidently map this and it needs founder review before
  reconciliation logic relies on it)
- `notes` TEXT NULL — free-text rationale, especially for
  `'approximate'` or `'flagged'` rows
- Standard audit columns (`created_at`, `updated_at`,
  `created_by_user_id`)

Constraint: `UNIQUE(tenant_id, legacy_source, legacy_term)`.

RLS: tenant-scoped, readable by tenant members, writable by
`TENANT_OWNER`/`PLATFORM_OWNER` and by `service_role` (so the
drafting agent's reconciliation function, running as service role,
can propose rows programmatically for founder review before they
are trusted — see R20).

This table is conceptually part of the vocabulary overlay system:
it is *semantic* reconciliation, the same discipline as vocabulary
overlays' *display* reconciliation ("entity" renders as "Tournament"
for this tenant), applied to meaning-resolution instead of
label-rendering. It is kept as its own table rather than folded
into `core.vocabulary_overlays`' JSONB blob because bridge logic
needs to query it reliably and JSONB blobs do not enforce the
uniqueness constraint that prevents contradictory mappings.

### 2.3 The reconciliation function pattern

Every reconciliation requirement in §4 (R20 for membership, R21 and
R22 for payments and payouts) follows the same shape:

1. **Idempotent and re-runnable.** Running the function twice
   produces the same result as running it once (subject to legacy
   source changes in between — that's drift, handled by R27, not a
   bug in the function). This is what makes drift-check re-runs safe.
2. **Never silently discards disagreement.** If two legacy sources
   disagree about a value after semantic mapping is applied, the
   function picks a resolved value using a documented precedence
   order (specified per-requirement) AND records that a conflict
   was detected. It does not average, does not pick arbitrarily
   without recording the choice, and does not drop the
   disagreement.
3. **Full lineage on every row it touches.** Every row the function
   creates or updates gets `provenance_source`,
   `provenance_legacy_ids`, `provenance_bridge_version`, and
   `provenance_bridge_run_at` populated correctly.
4. **Ambiguous correlation is flagged, not guessed.** Where the
   function needs to correlate rows across multiple legacy tables
   (e.g., matching a `payment_requests` row to its corresponding
   `payment_events` and `payment_receipts` rows) and cannot do so
   with confidence, it creates the substrate row anyway but sets an
   explicit ambiguity flag rather than picking a guess and hiding
   the uncertainty.

### 2.4 What "coherent" means, concretely

§1.0 says the substrate must produce "a single coherent view" of
fractured legacy data. This section makes that non-abstract: a
coherent view means that for any person or transaction, a single
query against substrate tables returns one row (or, where multiple
distinct real-world entities genuinely exist under one legacy
identity, one row per genuine distinct entity — see R28's treatment
of Malchijah's three login profiles, which are three real distinct
working identities, not a reconciliation error to merge away) with:

- All contributing legacy sources named
- All contributing legacy row IDs named
- A resolved value for anything the legacy sources disagreed about
- An explicit flag if disagreement was detected
- A timestamp for when reconciliation last ran and when drift was
  last checked

R28 makes this a mandatory, concrete verification test rather than
a design aspiration.

---

## 3. Reconciliation approach

### 3.1 Option 3a confirmed: substrate + module + bridge

Per conversation with founder, Phase 1 follows Option 3a for
payments and participants:

- New universal substrate tables in `core.*` schema
- Existing MAJH Events tables remain as module-owned (`venue.*`,
  `tournament.*`, or `public.*` if kept in public schema for now)
- Bridge triggers or functions copy relevant activity from module
  tables into substrate tables

This preserves MAJH Events flows entirely. New tenants use
substrate directly. Consolidation of module tables into substrate
is not required in Phase 1.

### 3.2 Schema namespace decision — LOCKED

**Decided by founder, confirmed twice** (once before the initial
Phase 1 attempt, reconfirmed explicitly after the rollback):
substrate tables live in the `core` schema; the module registry and
platform-level operational tables live in the `platform` schema.
This is not open for reinterpretation. The first Phase 1 attempt
placed tables in `public` instead of `core`/`platform` without
escalating the decision — that was a protocol violation, it was
rolled back, and it is the reason this decision is now stated as
locked rather than open.

**The agent must:**

- Create the `core` schema and the `platform` schema explicitly
- Grant appropriate schema privileges to the necessary roles
  (`authenticated`, `anon`, `service_role`)
- Qualify every substrate object with its schema in RLS policies,
  functions, and application code
- Confirm no Supabase-specific configuration silently assumes
  `public` (e.g., PostgREST schema exposure settings — `core` and
  `platform` may need to be added to the exposed schema list for
  Supabase's API layer to serve them; verify and document)

### 3.3 Existing infrastructure to leverage

Phase 1 SHOULD leverage what exists rather than duplicate. Ground
truth below reflects the production reconnaissance completed after
the rollback (`docs/PHASE_1_RECONNAISSANCE*.md`), not assumption:

- `tenants` table (do not recreate; extend with new columns; stays
  in `public` — it is genuinely platform/tenant metadata already
  shared, moving it is not required for Phase 1)
- `departments` table with `slug` column (do not recreate; extend if
  needed; stays in `public`)
- `locations` table with `currency`, `timezone`, `tax_rate`,
  `department_id` (do not recreate; extend if needed; stays in
  `public`)
- `entities` table — **do not recreate, but DO relocate.**
  Reconnaissance confirms `public.entities` already has the correct
  14-column shape (tenant/department/location scope, entity_type,
  status, metadata, soft delete). Per R9, move it into `core.entities`
  via `ALTER TABLE public.entities SET SCHEMA core;` rather than
  building `core.entities` fresh. Postgres preserves data, indexes,
  and foreign keys across a schema move; RLS policies must be
  re-verified against the new schema-qualified name.
- `ledger_transactions` and `ledger_entries` (do not recreate; add
  hash chain columns and triggers; these stay in `public` for Phase
  1 — moving the entire financial spine into `core` is a larger
  operation than Phase 1's timeline supports and is not required
  for the reconciliation thesis to hold)
- **`audit_log` does NOT exist as a generic substrate table.**
  Reconnaissance found only `access_audit_log` and
  `reconciliation_audit_log`, both pre-existing MAJH-Events-specific
  tables serving different purposes (access logging,
  reconciliation-run logging). Phase 1 CREATES `core.audit_log`
  fresh per R11 — it does not extend either existing table, and it
  does not replace them. All three coexist.
- `platform_config` (do not recreate; may inform platform-level
  settings)
- `organization_members` (do not recreate; use for new-table RLS
  *gating* per the founder's decision — see R20 for why this is a
  separate concern from the deeper identity reconciliation that
  also lives in Phase 1)
- `pgvector` extension (reconnaissance confirms version 0.8.0
  already installed; no action needed beyond referencing it in
  `core.knowledge_vectors`)

Phase 1 SHOULD create new tables for what doesn't exist:

- `core.participants` (with lineage columns per §2's reconciliation
  pattern)
- `core.resources`
- `core.payments_in` (with lineage columns)
- `core.payments_out` (with lineage columns)
- `core.event_store`
- `core.outbox`
- `core.ledger_accounts` (chart of accounts per tenant)
- `core.vocabulary_overlays`
- `core.legacy_semantic_mappings` (new — see §2.2; how legacy terms
  resolve to substrate concepts)
- `core.knowledge_vectors` (with `origin_module` column for future
  scoping)
- `platform.modules` (module registry, in a separate `platform`
  schema)

Phase 1 SHOULD add columns to existing tables where needed:

- `tenants` — `vocabulary_overlay_id`, `activated_modules` (array or
  JSONB), potentially `default_currency` if not present
- `ledger_entries` — `entry_hash`, `previous_hash`
- Existing tables MAY need `department_id`, `location_id` columns
  added where four-level scope is not yet present (agent verifies
  per-table)

---

## 4. Requirements (ordered)

Each requirement is stated as a specific, testable outcome. Each
has a rationale, acceptance criteria, verification query intent,
and reference to the architecture section it derives from.

### R1: `core` schema exists and is properly permissioned

**Rationale:** Substrate tables live in `core.*` per
ARCHITECTURE.md throughout. This schema must exist before any
other substrate work.

**Requirement:**

- Create `core` schema
- Grant `USAGE` on schema to `authenticated`, `anon`, and
  `service_role` as needed for Supabase
- Set default privileges for tables created in the schema
- Grant appropriate table-level privileges (specifics per RLS
  strategy in later requirements)

**Acceptance criteria:**

- `SELECT schema_name FROM information_schema.schemata WHERE
  schema_name = 'core'` returns one row
- `authenticated` role can access tables in `core` (subject to RLS)

**Verification query intent:**

- Query `information_schema.schemata` to confirm schema exists
- Query `information_schema.schema_privileges` to confirm grants
- Test SELECT from a `core` table as `authenticated` role succeeds
  (after tables exist per later requirements)

**Reference:** ARCHITECTURE.md v2 §2.5, §6.2

### R2: `platform` schema exists (for module registry)

**Rationale:** The module registry `platform.modules` lives in a
`platform` schema per ARCHITECTURE.md v2 §6.4. This separation
signals that platform-level operational tables (module registry,
platform configuration, cross-tenant analytics for operator use)
are distinct from substrate primitives (tenant-scoped operational
data).

**Requirement:**

- Create `platform` schema
- Grant `USAGE` on schema to `authenticated`, `anon`,
  `service_role`
- Restrict INSERT/UPDATE/DELETE on `platform.modules` to
  service_role and PLATFORM_OWNER role (per R14 module registry
  requirement below)

**Acceptance criteria:**

- Schema exists
- Only appropriate roles can modify `platform.modules`

**Verification query intent:**

- Same pattern as R1

**Reference:** ARCHITECTURE.md v2 §6.4

### R3: `pgvector` extension enabled

**Rationale:** The knowledge pool (`core.knowledge_vectors`)
requires pgvector. Ralph's Phase 2 build (per
`docs/RALPH_BLUEPRINT.md`) depends on the extension being
available.

**Requirement:**

- Verify `pgvector` is enabled in the Supabase project
- If not enabled, enable it (Supabase dashboard or SQL)
- No further action if already enabled

**Acceptance criteria:**

- `SELECT * FROM pg_extension WHERE extname = 'vector'` returns
  one row

**Verification query intent:**

- Query `pg_extension` to confirm

**Reference:** ARCHITECTURE.md v2 §11.3, `docs/RALPH_BLUEPRINT.md`
§3

### R4: `tenants` table extended for module activation and vocabulary

**Rationale:** ARCHITECTURE.md v2 §4.1 specifies that tenants
carry `vocabulary_overlay_id` (reference to their active overlay)
and `activated_modules` (which modules they've enabled). Phase 1
must add these columns without breaking existing functionality.

**Requirement:**

- ADD COLUMN `vocabulary_overlay_id UUID` to `tenants` (nullable
  initially; FK to `core.vocabulary_overlays.id` after R13 creates
  that table)
- ADD COLUMN `activated_modules TEXT[]` to `tenants` (default `{}`)
- ADD COLUMN `default_currency VARCHAR(3)` to `tenants` if not
  present (default 'USD'; agent verifies existence first)
- ADD COLUMN `region TEXT` to `tenants` if not present (nullable;
  informational)
- Backfill `activated_modules` for MAJH Events tenant with modules
  actively in use (agent determines actual list; likely includes
  `tournament`, `broadcast`, `venue` at minimum)
- Backfill `default_currency` for MAJH Events tenant to 'USD' (or
  founder-confirmed value)

**Acceptance criteria:**

- Columns exist with correct types and defaults
- MAJH Events tenant row has `activated_modules` populated
- Existing tenant queries continue to work
- No existing RLS policies broken by column additions

**Verification query intent:**

- Confirm columns exist via `information_schema.columns`
- Confirm MAJH Events row has expected values
- Sample existing SELECT query against `tenants` returns same data
  it did before

**Reference:** ARCHITECTURE.md v2 §4.1, §6.4

### R5: `core.participants` table with four-level scope and RLS

**Rationale:** ARCHITECTURE.md v2 §4.3 defines `participants` as a
universal primitive. Every tenant has participants (players, crew,
clients, congregants, guests, artists, subcontractors, staff).

This requirement creates the table structure only. Populating it is
a separate, larger concern handled by R20 (one-time reconciliation
of all existing `auth.users` across the three legacy membership
tables) and R23 (forward-going creation on new registration). Note
that v1.0.0 of this document assumed a `user_profiles` table would
be the population source; reconnaissance confirmed no such table
exists in production, and `auth.users` is the actual source — see
R23.

**Requirement:**

Create `core.participants` with columns:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `tenant_id` UUID NOT NULL, FK to `tenants.id`
- `department_id` UUID NULL, FK to `departments.id`
- `location_id` UUID NULL, FK to `locations.id`
- `user_id` UUID NULL, FK to `auth.users.id` (nullable — some
  participants are records the tenant tracks who don't have
  platform accounts)
- `role` TEXT NOT NULL (module-defined; substrate doesn't enforce
  enum)
- `resolved_role` TEXT NULL — for participants reconciled from
  membership-adjacent legacy sources (see R20), the substrate-level
  canonical role after semantic mapping and conflict resolution.
  Null for participants that were never subject to reconciliation
  (e.g., a tournament player with no operator role at all).
- `role_conflict_detected` BOOLEAN NOT NULL DEFAULT false — true if
  reconciliation found legacy sources disagreeing about this
  participant's role even after semantic mapping. Never silently
  false-negatived: if reconciliation ran and found agreement, this
  is explicitly false; if reconciliation never ran, it stays at its
  default (false) and `provenance_bridge_run_at` being null is what
  distinguishes "not yet reconciled" from "reconciled, no conflict."
- `contact_info` JSONB (email, phone, address, etc.)
- `data` JSONB (role-specific attributes)
- `is_active` BOOLEAN DEFAULT true
- `provenance_source` JSONB NOT NULL DEFAULT '[]' — per §2.1
- `provenance_legacy_ids` JSONB NOT NULL DEFAULT '[]' — per §2.1
- `provenance_bridge_version` TEXT NULL — per §2.1
- `provenance_bridge_run_at` TIMESTAMPTZ NULL — per §2.1
- `provenance_drift_checked_at` TIMESTAMPTZ NULL — per §2.1
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()
- `deleted_at` TIMESTAMPTZ NULL (soft delete)

Indexes:

- Index on `(tenant_id)` for tenant-scoped queries
- Index on `(tenant_id, department_id)` for department-scoped
- Index on `(tenant_id, role)` for role-based filters
- Index on `(user_id)` where user_id IS NOT NULL for user
  lookups
- Index on `(tenant_id, role_conflict_detected)` where
  `role_conflict_detected = true`, for the reconciliation report
  in R26 to find conflicts quickly
- Consider partial index on `is_active = true` if query patterns
  warrant

RLS enabled with policies:

- SELECT: user can see participants in tenants where they are a
  member (via `organization_members.tenant_id`)
- INSERT: user with role permitting can create participants in
  their tenant scope
- UPDATE: same as INSERT with additional check on updated row
- DELETE: soft delete only; hard delete restricted to
  `service_role`

**Acceptance criteria:**

- Table exists with all columns and constraints
- RLS enabled
- Policies enforce tenant scope
- A `service_role` insert succeeds
- An `authenticated` user in the MAJH Events tenant can SELECT
  MAJH Events participants
- The same user cannot SELECT participants from a different tenant
  (test with a second test tenant)
- Foreign key constraints work correctly

**Verification query intent:**

- Structural: query `information_schema.columns` for table
  structure
- RLS presence: query `pg_policies` for expected policies
- Isolation: from `authenticated` context, INSERT a participant
  with a foreign tenant_id and confirm it fails
- Isolation: from `authenticated` context, SELECT participants
  across tenants and confirm only own tenant returned

**Reference:** ARCHITECTURE.md v2 §4.3, §12; §2.1 of this document
(lineage columns)

### R6: `core.resources` table with four-level scope and RLS

**Rationale:** ARCHITECTURE.md v2 §4.4 defines `resources` as a
universal primitive for anything scheduled, allocated, or
consumed (streaming stations, equipment, rooms, kiosks, staff
shifts).

**Requirement:**

Create `core.resources` with columns:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `tenant_id` UUID NOT NULL, FK to `tenants.id`
- `department_id` UUID NULL, FK to `departments.id`
- `location_id` UUID NULL, FK to `locations.id`
- `type` TEXT NOT NULL (module-defined)
- `name` TEXT NOT NULL
- `capacity` NUMERIC NULL (module interprets meaning)
- `availability_windows` JSONB NULL (module interprets format)
- `data` JSONB DEFAULT '{}'
- `is_active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()
- `deleted_at` TIMESTAMPTZ NULL

Indexes:

- Index on `(tenant_id)`
- Index on `(tenant_id, type)`
- Index on `(tenant_id, location_id)` where four-level scope
  matters

RLS: same pattern as `core.participants` (R5).

Also create join table `core.entity_resources` for linking
resources to entities:

- `id` UUID PRIMARY KEY
- `entity_id` UUID NOT NULL, FK to `entities.id`
- `resource_id` UUID NOT NULL, FK to `core.resources.id`
- `tenant_id` UUID NOT NULL (denormalized for RLS efficiency)
- `allocated_from` TIMESTAMPTZ NULL
- `allocated_to` TIMESTAMPTZ NULL
- `data` JSONB
- Standard audit columns

**Acceptance criteria:**

- Both tables exist with correct structure
- RLS enforces tenant scope on both
- Foreign keys work
- Isolation testing succeeds

**Verification query intent:**

- Same pattern as R5

**Reference:** ARCHITECTURE.md v2 §4.4

### R7: `core.payments_in` table with four-level scope and RLS

**Rationale:** ARCHITECTURE.md v2 §4.5 defines `payments_in` as a
universal read-model primitive over incoming payments. Universal
tenants use it directly; MAJH Events tenant continues to write to
its existing `payment_requests` / `payment_events` /
`payment_receipts` tables, and the bridge in R21 correlates across
all three to produce reconciled `core.payments_in` rows with full
lineage.

**Requirement:**

Create `core.payments_in` with columns:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `tenant_id` UUID NOT NULL, FK to `tenants.id`
- `department_id` UUID NULL, FK to `departments.id`
- `location_id` UUID NULL, FK to `locations.id`
- `source_type` TEXT NOT NULL (e.g. `tournament_entry`,
  `ticket_purchase`, `service_invoice`, `tithe`,
  `merchandise_sale`, `event_deposit`, `royalty_receipt`)
- `source_id` UUID NOT NULL (polymorphic — ID of underlying record)
- `amount_cents` BIGINT NOT NULL (positive)
- `currency` VARCHAR(3) NOT NULL DEFAULT 'USD'
- `payer_id` UUID NULL, FK to `core.participants.id`
- `stripe_payment_intent_id` TEXT NULL
- `ledger_entry_id` UUID NULL, FK to `ledger_entries.id`
  (nullable until the ledger entry is created; the bridge
  populates this)
- `received_at` TIMESTAMPTZ NOT NULL
- `reconciliation_ambiguous` BOOLEAN NOT NULL DEFAULT false — true
  if the bridge (R21) could not confidently correlate this row's
  legacy sources (e.g., could not confirm which
  `payment_events`/`payment_receipts` rows belong to which
  `payment_requests` row) and needs human review before the row is
  trusted for reporting
- `provenance_source` JSONB NOT NULL DEFAULT '[]' — per §2.1
- `provenance_legacy_ids` JSONB NOT NULL DEFAULT '[]' — per §2.1
- `provenance_bridge_version` TEXT NULL — per §2.1
- `provenance_bridge_run_at` TIMESTAMPTZ NULL — per §2.1
- `provenance_drift_checked_at` TIMESTAMPTZ NULL — per §2.1
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()

Constraints:

- `amount_cents > 0` check constraint
- Currency code format validation (3 characters, uppercase) —
  optional, agent decides based on data quality preference

Indexes:

- `(tenant_id, received_at DESC)` for recent payment queries
- `(tenant_id, source_type, source_id)` for polymorphic lookup
- `(stripe_payment_intent_id)` where non-null, for webhook
  correlation
- `(tenant_id, reconciliation_ambiguous)` where
  `reconciliation_ambiguous = true`, for the reconciliation report
  in R26

RLS: tenant scope enforced (same pattern as R5).

**Acceptance criteria:**

- Table exists with all columns and constraints
- RLS enforces tenant scope
- Amount constraint prevents negative values
- Foreign keys work
- Isolation testing succeeds

**Verification query intent:**

- Same pattern as R5, plus:
- INSERT with `amount_cents = -100` fails
- INSERT with valid data succeeds

**Reference:** ARCHITECTURE.md v2 §4.5; §2.1 of this document
(lineage columns)

### R8: `core.payments_out` table with four-level scope and RLS

**Rationale:** Mirror of R7 for outgoing payments. ARCHITECTURE.md
v2 §4.6.

**Requirement:**

Create `core.payments_out` with parallel structure to
`core.payments_in`, **including all five lineage columns and the
`reconciliation_ambiguous` flag** — this table is reconciling the
dual `payout_requests`/`player_payouts` legacy system (per R22) and
needs the same auditability `core.payments_in` gets:

- Same columns except `payer_id` → `payee_id`,
  `stripe_payment_intent_id` → `stripe_transfer_id`
- Same constraints, indexes, and RLS pattern
- `received_at` → `sent_at`
- Same `reconciliation_ambiguous` and five `provenance_*` columns
  per §2.1, populated for the same reason: two legacy tables likely
  represent overlapping reality and correlating them precisely is
  not always possible with confidence

**Acceptance criteria:** Same as R7 pattern.

**Verification query intent:** Same as R7 pattern.

**Reference:** ARCHITECTURE.md v2 §4.6; §2.1 of this document

### R9: `entities` relocated to `core` schema, extended for hierarchy

**Rationale:** ARCHITECTURE.md v2 §4.2 specifies `entities` as a
`core.*` substrate primitive. Reconnaissance after the rollback
confirmed `public.entities` already has the correct 14-column
shape and 4 correct RLS policies gating on `organization_members`
— the table itself does not need to be rebuilt, only relocated and
lightly extended. This is NOT a legacy-reconciliation target the
way `core.participants` or `core.payments_in` are: `entities` has
one clean source (itself), not multiple disagreeing legacy tables,
so it does not carry the §2.1 lineage columns.

**Requirement:**

1. **Relocate:** `ALTER TABLE public.entities SET SCHEMA core;`
   Postgres preserves data, indexes, constraints, and foreign keys
   across this move. RLS policies attached to the table move with
   it, but the agent must verify the policy definitions'
   `organization_members` reference still resolves correctly
   (`organization_members` stays in `public`, so the policy's
   subquery becomes a cross-schema reference — this works in
   Postgres without modification, but verify it explicitly rather
   than assuming).
2. **Check for application code references to `public.entities`**
   (Supabase client calls, raw SQL, any ORM-style queries) and flag
   every one that needs updating to `core.entities`. This is real
   but bounded application code impact — list every call site found.
3. Then, as needed, extend the relocated `core.entities`:
   - ADD COLUMN `parent_entity_id` UUID NULL, FK to
     `core.entities.id` (self-referencing) for hierarchical entity
     relationships (seasons containing tournaments, projects
     containing phases)
   - Verify `entity_type` column exists (confirmed present per
     reconnaissance)
   - Verify `metadata` JSONB column exists (confirmed present,
     named `metadata` not `data` — do not rename; rename would
     break existing MAJH Events code with no benefit)
   - Verify `status` TEXT column exists (confirmed present)
   - Verify `tenant_id`, `department_id`, `location_id` scoping
     columns exist (confirmed present)
   - Verify soft delete `deleted_at` column exists (confirmed
     present)

Index on `(parent_entity_id)` for hierarchy queries.

**Acceptance criteria:**

- Table exists at `core.entities`, not `public.entities`
- All 14 pre-existing columns intact plus `parent_entity_id`
- Existing data intact (row count before === row count after)
- Existing RLS policies still enforce tenant scope correctly at the
  new schema location
- Every application code reference to `public.entities` has been
  identified and updated (or the drafting agent has explicitly
  confirmed none exist)
- New self-referencing FK doesn't create circular constraint
  problems

**Verification query intent:**

- Confirm `public.entities` no longer exists;
  `core.entities` does, via `information_schema.tables`
- Row count comparison before/after the move
- Sample query showing existing entities unaffected
- Test insert of parent + child entity works
- Grep the codebase for `public.entities` / `.from('entities')`
  style references and confirm each has been addressed

**Reference:** ARCHITECTURE.md v2 §4.2;
`docs/PHASE_1_RECONNAISSANCE_S2.md` Q6-Q7 (ground truth this
requirement is built against)

### R10: `ledger_entries` hash chain columns and trigger

**Rationale:** ARCHITECTURE.md v2 §2.1 and §7.1 specify that every
ledger entry has a cryptographic hash of the previous entry,
forming a tamper-evident chain. This is one of the most important
requirements in Phase 1 because financial integrity depends on it.

**Requirement:**

- ADD COLUMN `entry_hash` BYTEA (or TEXT if preferred format)
- ADD COLUMN `previous_hash` BYTEA (or TEXT)
- ADD COLUMN `linked_transaction_id` UUID NULL (groups entries
  that balance to zero for a single business event; check if
  already present)
- Create hash chain trigger: BEFORE INSERT, computes `entry_hash`
  from a canonical serialization of the entry's fields, sets
  `previous_hash` to the previous entry's `entry_hash` (per
  tenant scope, since hash chain is tenant-scoped)
- The canonical serialization function is deterministic and
  ordered
- Backfill existing entries: agent must decide backfill strategy.
  Options:
  - Backfill with computed hashes based on existing data (agent
    computes retroactively; existing entries get hashes)
  - Mark existing entries with a sentinel hash indicating
    pre-Phase-1
  - Genesis approach: first Phase-1-era entry has null
    previous_hash; earlier entries stay null

Recommended approach: **backfill with computed hashes**. This
gives every entry a hash and future queries can verify the chain
end-to-end. Requires the backfill script to walk entries in
insertion order (tenant-scoped) and compute hashes iteratively.

- MFA verification column: `mfa_verified_at` TIMESTAMPTZ NULL,
  `created_by_user_id` UUID NULL (per ARCHITECTURE.md v2 §7.1);
  add if not present

**Acceptance criteria:**

- New columns exist
- Insert new entry via application flow → `entry_hash` populated,
  `previous_hash` correctly points to previous entry
- Multiple entries in sequence produce a coherent chain
- Backfill completes without errors
- After backfill, chain integrity verifiable end-to-end

**Verification query intent:**

- Structural verification
- Chain integrity check: for each entry, compute hash from stored
  data and compare to `entry_hash`; every previous_hash matches
  the previous row's entry_hash (tenant-scoped)
- Insert a new entry post-migration and verify chain continues

**Reference:** ARCHITECTURE.md v2 §2.1, §7.1

### R11: `core.audit_log` created fresh, plus immutability triggers on it and `ledger_entries`

**Rationale:** ARCHITECTURE.md v2 §2.1 and §7.1 specify a
platform-wide append-only audit log. Reconnaissance
(`docs/PHASE_1_RECONNAISSANCE_S4.md` Q17) confirmed **no generic
`audit_log` table exists in production** — only
`public.access_audit_log` and `public.reconciliation_audit_log`,
both pre-existing MAJH-Events-specific tables with narrower,
different purposes (access logging and reconciliation-run logging
respectively). v1.0.0 of this document incorrectly assumed a
generic `audit_log` already existed and only needed a trigger. It
does not. This revision creates it.

**`core.audit_log` is not the same thing as `core.event_store`**
(R16), even though the two tables end up structurally similar.
`core.event_store` is the substrate's message bus for cross-module
business events that other modules and Ralph subscribe to.
`core.audit_log` is specifically for compliance and security
accountability — who did what, when, tied to the financial spine's
append-only guarantee. Do not merge them. Do not replace or migrate
`access_audit_log` / `reconciliation_audit_log` — those keep
serving their existing narrower purposes; `core.audit_log` is a new,
additional, platform-wide layer.

**Requirement:**

Create `core.audit_log` with columns:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `tenant_id` UUID NULL (null = platform-level event; non-null =
  tenant-scoped)
- `actor_type` TEXT NOT NULL (`user`, `service`, `agent`)
- `actor_id` UUID NULL, FK to `auth.users.id`
- `action` TEXT NOT NULL (namespaced, e.g.
  `participant.role_changed`, `escrow.released`,
  `tenant.module_activated`)
- `resource_type` TEXT NULL
- `resource_id` UUID NULL
- `before_state` JSONB NULL
- `after_state` JSONB NULL
- `metadata` JSONB DEFAULT '{}'
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Indexes:

- `(tenant_id, created_at DESC)`
- `(actor_id, created_at DESC)`
- `(resource_type, resource_id)`

RLS: SELECT restricted to `TENANT_OWNER`/`PLATFORM_OWNER` for
tenant-scoped rows, `PLATFORM_OWNER` only for platform-level rows
(`tenant_id IS NULL`); INSERT restricted to `service_role`.

Then, append-only enforcement:

- Create BEFORE UPDATE trigger on `core.audit_log` that raises
  exception in all cases (blocks all updates)
- Create BEFORE DELETE trigger on `core.audit_log` that raises
  exception in all cases (blocks all deletes)
- Same two triggers on `ledger_entries`
- Revoke any UPDATE and DELETE privileges on `ledger_entries` from
  all roles except `service_role` (agent verifies existing state
  first — reconnaissance found these grants currently exist for
  `authenticated` and `anon`, which is a real gap this requirement
  closes)
- Document that corrections require inserting compensating rows,
  not modifying original rows

**Acceptance criteria:**

- `core.audit_log` exists with the structure above
- Attempting to UPDATE a `core.audit_log` row fails with expected
  error
- Attempting to DELETE a `core.audit_log` row fails with expected
  error
- Same for `ledger_entries`
- New INSERT still works on both
- `access_audit_log` and `reconciliation_audit_log` are untouched

**Verification query intent:**

- Confirm `core.audit_log` structure via `information_schema.columns`
- Confirm triggers exist via `pg_trigger` on both tables
- Test UPDATE attempts and verify they fail on both tables
- Test DELETE attempts and verify they fail on both tables
- Test INSERT still works on both
- Confirm `access_audit_log` and `reconciliation_audit_log` row
  counts are unchanged by this migration

**Reference:** ARCHITECTURE.md v2 §2.1, §7.1, §7.4;
`docs/PHASE_1_RECONNAISSANCE_S4.md` Q17 (ground truth)

### R12: `core.ledger_accounts` chart of accounts per tenant

**Rationale:** ARCHITECTURE.md v2 §7.1 specifies each tenant has a
chart of accounts. Ledger entries reference accounts via `account_ref`.

**Requirement:**

Create `core.ledger_accounts` with columns:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `tenant_id` UUID NOT NULL, FK to `tenants.id`
- `account_code` TEXT NOT NULL (tenant-defined; typically numeric
  string like '1000', '4000', etc.)
- `account_name` TEXT NOT NULL
- `account_type` TEXT NOT NULL (`asset`, `liability`, `equity`,
  `revenue`, `expense`)
- `parent_account_id` UUID NULL, FK to `core.ledger_accounts.id`
  (self-referencing for hierarchical charts)
- `is_active` BOOLEAN DEFAULT true
- `data` JSONB DEFAULT '{}' (module-specific metadata; finance
  module may store tax categories, etc.)
- Standard audit columns

Constraints:

- `UNIQUE(tenant_id, account_code)` — account codes unique within a
  tenant
- `account_type IN ('asset', 'liability', 'equity', 'revenue',
  'expense')` check constraint

Indexes:

- `(tenant_id, account_code)`
- `(tenant_id, account_type)`

RLS: tenant scope, same pattern as R5.

Seed default chart of accounts for MAJH Events tenant with basic
accounts (agent works with founder to determine specifics):

- 1000 Cash (asset)
- 1100 Accounts Receivable (asset)
- 2000 Accounts Payable (liability)
- 3000 Owner Equity (equity)
- 4000 Revenue (revenue)
- 5000 Expenses (expense)

Additional accounts (event-specific, department-specific) can be
added per MAJH Events actual usage; agent confirms with founder.

**Acceptance criteria:**

- Table exists with structure and constraints
- Default chart exists for MAJH Events tenant
- RLS enforces tenant scope
- Isolation testing succeeds

**Verification query intent:**

- Same pattern as R5
- Query MAJH Events chart of accounts and confirm expected rows

**Reference:** ARCHITECTURE.md v2 §7.1

### R13: `core.vocabulary_overlays` table

**Rationale:** ARCHITECTURE.md v2 §5 specifies vocabulary overlays
are stored in a table (referenced from `tenants.vocabulary_overlay_id`)
rather than inline on each tenant row. Enables sharing overlays
across tenants of the same vertical.

**Requirement:**

Create `core.vocabulary_overlays` with columns:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `slug` TEXT NOT NULL UNIQUE (e.g., 'events-base',
  'construction-base', 'church-base')
- `name` TEXT NOT NULL (display name, e.g., 'Events Base
  Overlay')
- `industry_type` TEXT NOT NULL
- `vocabulary` JSONB NOT NULL DEFAULT '{}' (the actual mappings)
- `is_base` BOOLEAN DEFAULT false (true for platform-provided
  base overlays; false for tenant-customized)
- `parent_overlay_id` UUID NULL, FK to `core.vocabulary_overlays.id`
  (customized overlays reference their base)
- `tenant_id` UUID NULL, FK to `tenants.id` (null for base
  overlays; tenant-scoped for customized overlays)
- Standard audit columns

RLS:

- Base overlays (`is_base = true`, `tenant_id IS NULL`) are readable
  by all authenticated users
- Tenant-scoped overlays visible only to that tenant's members
- Only PLATFORM_OWNER can create/modify base overlays
- Tenant admins can create/modify their own tenant-scoped overlays

Seed the initial base overlays. Structure per ARCHITECTURE.md
§5.1 example:

- `events-base` — MAJH Events / events-and-esports vocabulary
- `construction-base` — construction vocabulary (project, crew,
  milestone, draw, etc.)
- `church-base` — church vocabulary (service, congregant, ministry,
  etc.)
- `label-base` — label vocabulary (release, artist, royalty, etc.)
- `hospitality-base` — hospitality vocabulary (guest, reservation,
  tab, etc.)
- `professional-services-base` — professional services vocabulary
  (client, matter, engagement, etc.)

Then update MAJH Events tenant to reference `events-base` via
`vocabulary_overlay_id`.

Then create the FK constraint on `tenants.vocabulary_overlay_id`
→ `core.vocabulary_overlays.id` (deferred from R4 until this table
exists).

**Seeding decision (founder-confirmed):** `events-base` is seeded
with MAJH Events' actual terminology, not placeholder content —
it's the one overlay with a live tenant to get right. The other
five (`construction-base`, `church-base`, `label-base`,
`hospitality-base`, `professional-services-base`) are seeded with
minimal stub content (industry_type set, vocabulary JSONB
containing only the handful of terms already referenced elsewhere
in this document, e.g. "project"/"crew"/"milestone" for
construction) and are expected to be fleshed out when the first
tenant in each vertical is actually being onboarded. Do not invest
drafting effort making the five stubs comprehensive.

**R13b — Semantic reconciliation: `core.legacy_semantic_mappings`**

Per §2.2 of this document, vocabulary overlay's responsibility
extends beyond UI label rendering to semantic reconciliation of
legacy terms into substrate concepts. This is what makes R20's
membership reconciliation legible rather than a black box.

Create `core.legacy_semantic_mappings` exactly per §2.2's column
specification (`tenant_id`, `legacy_source`, `legacy_term`,
`substrate_concept`, `confidence`, `notes`, audit columns, with the
`UNIQUE(tenant_id, legacy_source, legacy_term)` constraint and the
RLS pattern described there).

Seed it for MAJH Events using the actual role vocabulary
reconnaissance found (`docs/PHASE_1_RECONNAISSANCE.md` Q4):

| legacy_source | legacy_term | substrate_concept | confidence |
|---|---|---|---|
| `organization_members` | `PLATFORM_OWNER` | `platform_owner` | exact |
| `organization_members` | `TENANT_OWNER` | `tenant_owner` | exact |
| `staff_roles` | `PLATFORM_OWNER` | `platform_owner` | exact |
| `staff_roles` | `TENANT_MANAGER` | `tenant_manager` | exact |
| `tenant_memberships` | `owner` | `tenant_owner` | approximate |
| `tenant_memberships` | `admin` | `tenant_manager` | approximate |

The `tenant_memberships` rows are marked `approximate` rather than
`exact` deliberately: "owner"/"admin" are generic terms without the
`organization_members`/`staff_roles` tables' more specific
`PLATFORM_OWNER`/`TENANT_OWNER`/`TENANT_MANAGER` vocabulary, so the
mapping is a reasonable inference, not a confirmed exact match. The
substrate concept vocabulary itself (`platform_owner`,
`tenant_owner`, `tenant_manager`) should be treated by the agent as
the canonical closed set for Phase 1 — do not invent additional
substrate concepts without founder confirmation.

Any legacy role value found during R20's reconciliation that is
NOT in this table gets a row auto-created with `confidence =
'flagged'` and a null `substrate_concept` guess (or the agent's
best inference, clearly marked) — the reconciliation function does
not block on an unmapped term, but it does not guess silently
either. Report unmapped terms in the reconciliation report (R26).

**Acceptance criteria:**

- `core.vocabulary_overlays` table exists with structure
- Six base overlays seeded; `events-base` has real MAJH Events
  terminology, the other five have minimal stubs
- MAJH Events tenant references `events-base`
- RLS works as specified
- FK on tenants.vocabulary_overlay_id enforced
- `core.legacy_semantic_mappings` exists with structure per §2.2
- The six seed rows above exist with correct confidence levels

**Verification query intent:**

- Structural verification for both tables
- Count of base overlays = 6
- MAJH Events `vocabulary_overlay_id` matches `events-base.id`
- Cross-tenant overlay isolation verified
- Query `core.legacy_semantic_mappings` for MAJH Events tenant_id
  and confirm all six seed rows present with correct
  `substrate_concept` and `confidence` values

**Reference:** ARCHITECTURE.md v2 §5; §2.2 of this document;
`docs/PHASE_1_RECONNAISSANCE.md` Q4 (ground truth for the seed
mappings)

### R14: `platform.modules` module registry

**Rationale:** ARCHITECTURE.md v2 §6.4 specifies a registry table
that tracks all modules known to the platform, their dependencies,
and activation requirements.

**Requirement:**

Create `platform.modules` with columns:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `module_name` TEXT NOT NULL UNIQUE
- `description` TEXT
- `substrate_dependencies` TEXT[] DEFAULT '{}' (list of substrate
  services required — `ledger`, `event_store`, `knowledge_pools`)
- `module_dependencies` TEXT[] DEFAULT '{}' (list of other module
  names)
- `activation_requirements` JSONB DEFAULT '{}' (tenant-side
  requirements)
- `implementation_status` TEXT NOT NULL DEFAULT 'not_started'
  (values: `built`, `partial`, `designed`, `not_started`)
- `default_activated_for_industries` TEXT[] DEFAULT '{}'
- `data` JSONB DEFAULT '{}' (metadata)
- Standard audit columns

Constraint: `implementation_status IN ('built', 'partial',
'designed', 'not_started')`

RLS:

- SELECT: all authenticated users (module list is not confidential)
- INSERT/UPDATE/DELETE: only PLATFORM_OWNER role

Seed with current modules per ARCHITECTURE.md v2 §6.2 taxonomy:

- `tournament` — partial (per CAPABILITY_MAP §2.2)
- `broadcast` — partial
- `venue` — designed
- `finance` — designed
- `fleet` — not_started
- `hospitality` — not_started
- `retail` — not_started
- `construction` — not_started
- `church` — not_started
- `label` — not_started

Set substrate_dependencies and module_dependencies per
ARCHITECTURE.md v2 §6.3 dependency diagram.

Set implementation_status honestly. Do not upgrade to `built`
until CAPABILITY_MAP.md §2.2 verifies the actual state.

**Acceptance criteria:**

- Table exists
- Ten modules seeded
- Statuses match CAPABILITY_MAP.md v1.0.1 §2.2
- RLS enforced
- Only PLATFORM_OWNER can modify

**Verification query intent:**

- Structural verification
- Count of modules = 10
- Attempt to modify from non-PLATFORM_OWNER role fails
- Dependencies match the diagram

**Reference:** ARCHITECTURE.md v2 §6.2, §6.3, §6.4;
CAPABILITY_MAP.md §2.2

### R15: `core.tenant_has_module()` RLS helper function

**Rationale:** ARCHITECTURE.md v2 §6.5 specifies module tables use
`tenant_has_module(tenant_id, module_name)` in their RLS policies
as a defense-in-depth check.

**Requirement:**

Create function:

```sql
CREATE OR REPLACE FUNCTION core.tenant_has_module(
  p_tenant_id UUID,
  p_module_name TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT p_module_name = ANY(activated_modules)
  FROM tenants
  WHERE id = p_tenant_id;
$$;
```

`SECURITY DEFINER` runs with the function creator's privileges
(allowing it to read `tenants.activated_modules` even from an
RLS-scoped context).

Grant `EXECUTE` on the function to `authenticated`, `service_role`.

**Acceptance criteria:**

- Function exists
- Returns true for a module in tenant's `activated_modules` array
- Returns false otherwise
- Callable from RLS policies

**Verification query intent:**

- Query `pg_proc` to confirm function exists
- Test call: `SELECT core.tenant_has_module('<majh_events_id>',
  'tournament')` → expect true (if tournament is in
  activated_modules)
- Test call: `SELECT core.tenant_has_module('<majh_events_id>',
  'construction')` → expect false

**Reference:** ARCHITECTURE.md v2 §6.5

### R16: `core.event_store` table

**Rationale:** ARCHITECTURE.md v2 §10.1 specifies the substrate's
message bus for business events. Modules emit events; other
modules and Ralph subscribe.

**Requirement:**

Create `core.event_store` with columns:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `tenant_id` UUID NOT NULL, FK to `tenants.id`
- `event_type` TEXT NOT NULL (namespaced: `finance.invoice.sent`,
  `tournament.bracket.finalized`, etc.)
- `source_module` TEXT NOT NULL (`finance`, `tournament`, `substrate`,
  etc.)
- `source_id` UUID NULL (polymorphic; nullable because some events
  don't have a single source record)
- `payload` JSONB NOT NULL DEFAULT '{}'
- `occurred_at` TIMESTAMPTZ NOT NULL (when the event happened in
  the real world)
- `recorded_at` TIMESTAMPTZ NOT NULL DEFAULT now() (when it was
  written to the store)
- `data` JSONB DEFAULT '{}' (auxiliary metadata)

Indexes:

- `(tenant_id, recorded_at DESC)` for recent events queries
- `(tenant_id, event_type, recorded_at DESC)` for type-filtered
- `(source_module, source_id)` for polymorphic lookup

Append-only: BEFORE UPDATE and BEFORE DELETE triggers raising
exceptions.

RLS: tenant scope; same pattern as `core.participants`.

**Acceptance criteria:**

- Table exists
- Indexes present
- Append-only enforced
- RLS enforces tenant scope

**Verification query intent:**

- Structural verification
- Attempt UPDATE fails, attempt DELETE fails, INSERT succeeds
- Tenant isolation verified

**Reference:** ARCHITECTURE.md v2 §10.1

### R17: `core.outbox` table for asynchronous side effects

**Rationale:** ARCHITECTURE.md v2 §10.2 specifies the outbox
pattern. Modules write to outbox in same transaction as their
state changes; a worker consumes and dispatches to handlers
(Stripe, external APIs, email, webhooks).

**Requirement:**

Create `core.outbox` with columns:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `tenant_id` UUID NOT NULL, FK to `tenants.id`
- `idempotency_key` UUID NOT NULL UNIQUE (used as Stripe
  idempotency key or equivalent for other services)
- `target_service` TEXT NOT NULL (`stripe`, `adapter.monday`,
  `email`, `webhook`, etc.)
- `endpoint` TEXT NOT NULL (`transfer.create`, `board.update`,
  `send`, etc.)
- `payload` JSONB NOT NULL
- `delivery_status` TEXT NOT NULL DEFAULT 'pending' (values:
  `pending`, `processing`, `completed`, `failed_retriable`,
  `failed_fatal`)
- `retry_count` INTEGER NOT NULL DEFAULT 0
- `max_retries` INTEGER NOT NULL DEFAULT 5
- `last_error` TEXT NULL
- `execute_after` TIMESTAMPTZ NOT NULL DEFAULT now()
- `processed_at` TIMESTAMPTZ NULL
- Standard audit columns

Constraints:

- `delivery_status IN ('pending', 'processing', 'completed',
  'failed_retriable', 'failed_fatal')`

Indexes:

- `(delivery_status, execute_after)` for worker polling (find
  pending rows ready to process)
- `(tenant_id, delivery_status)`
- `(idempotency_key)` (unique already indexed)

RLS: tenant scope; same pattern as R5.

**Acceptance criteria:**

- Table exists
- Indexes present
- Unique constraint on idempotency_key
- RLS enforces tenant scope

**Verification query intent:**

- Structural verification
- Attempt duplicate idempotency_key insert fails
- Tenant isolation verified
- Worker-style query using `FOR UPDATE SKIP LOCKED` works
  (optional; validates readiness for worker implementation)

**Reference:** ARCHITECTURE.md v2 §10.2

### R18: `core.knowledge_vectors` table for Ralph knowledge pool

**Rationale:** `docs/RALPH_BLUEPRINT.md` Phase 2 requires
knowledge_vectors to exist. Phase 1 creates the table; Ralph
Phase 2 populates it.

**Requirement:**

Create `core.knowledge_vectors` with columns:

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `tenant_id` UUID NULL (null = platform-level; non-null =
  tenant-scoped)
- `origin_module` TEXT NULL (which module the content came from,
  if any; enables future dual-key RLS per
  `ARCHITECTURE_OPEN_QUESTIONS.md` Q3)
- `content` TEXT NOT NULL (the text chunk)
- `embedding` vector(1536) NULL (OpenAI ada-002 dimension; adjust
  if using different embedding model)
- `source_uri` TEXT NOT NULL (where this chunk came from — file
  path, doc ID)
- `chunk_index` INTEGER NOT NULL DEFAULT 0 (position within
  source)
- `data` JSONB DEFAULT '{}' (metadata: chunk size, tokens, etc.)
- Standard audit columns

Indexes:

- `(tenant_id, origin_module)` for filtered retrieval
- Vector index using `ivfflat` or `hnsw` (agent decides based on
  pgvector version and expected volume)
- `(source_uri)` for re-embedding operations

RLS:

- SELECT for `tenant_id IS NULL` (platform-level chunks): all
  authenticated users
- SELECT for `tenant_id IS NOT NULL`: user is member of that
  tenant
- INSERT/UPDATE/DELETE: service_role only (embedding pipeline
  runs as service_role)

**Acceptance criteria:**

- Table exists
- Vector column type is `vector` from pgvector extension
- Indexes present (including at least one vector index)
- RLS enforces platform vs. tenant visibility
- Test insert of a chunk succeeds (from service_role)
- Test vector similarity query works

**Verification query intent:**

- Structural verification
- Confirm `vector` type is used correctly
- Test similarity query pattern
- Platform-level chunk visible to any authenticated user
- Tenant-level chunk visible only to that tenant

**Reference:** `docs/RALPH_BLUEPRINT.md` §6.2;
`ARCHITECTURE_OPEN_QUESTIONS.md` Q3

### R19: Standard four-level RLS pattern documented and applied

**Rationale:** ARCHITECTURE.md v2 §12 specifies the RLS strategy.
Phase 1 must establish a consistent pattern that all substrate
tables follow, and that new tables can copy.

**Requirement:**

The pattern for a tenant-scoped substrate table:

```sql
ALTER TABLE core.<table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_select_own_tenant"
  ON core.<table>
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM organization_members
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

CREATE POLICY "<table>_insert_own_tenant"
  ON core.<table>
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM organization_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role_key IN ('<permitted_roles>')
    )
  );

-- Similar patterns for UPDATE and DELETE with role restrictions
```

Where department/location scoping is required (per table needs),
extend the pattern:

```sql
CREATE POLICY "<table>_select_own_department"
  ON core.<table>
  FOR SELECT
  USING (
    (tenant_id, department_id) IN (
      SELECT tenant_id, department_id
      FROM organization_members
      WHERE user_id = auth.uid()
        AND is_active = true
    )
    -- OR department_id IS NULL for tenant-wide records
  );
```

Apply this pattern to all Phase 1 new substrate tables (R5, R6,
R7, R8, R12, R13, R14, R16, R17, R18).

**Acceptance criteria:**

- Every new substrate table has RLS enabled
- Every new substrate table has policies matching the pattern
- Policies enforce the intended scope
- No substrate table has `WITH CHECK (true)` (which would bypass
  scope check)

**Verification query intent:**

- Query `pg_policies` to enumerate policies on each new table
- Confirm each has expected policies
- Confirm no `WITH CHECK (true)` on user-facing tables
- Test isolation from `authenticated` context across all new tables

**Reference:** ARCHITECTURE.md v2 §12

### R20: Membership reconciliation — the `core.participants` identity layer

**Rationale:** This is the requirement §1.0 and §2 exist to set up.
Reconnaissance found what real fracture actually looks like:
`organization_members`, `staff_roles`, and `tenant_memberships`
each have a partial, differently-worded view of who has what
authority. Malchijah operates through three separate auth
profiles — a deliberate working pattern, not an error. Of the 43
total `auth.users`, only 3 appear in any operator-facing membership
table; the other 40 are real participants (players, attendees) who
were never operators, which is the ordinary shape of a real tenant,
not a data quality problem.

**Two distinct concerns, kept separate on purpose:**

1. **RLS gating** (mechanical, pragmatic): new substrate tables
   gate their RLS on `organization_members` because it is the one
   of the three legacy tables with the `department_id`/`location_id`
   columns four-level scope requires. This is an implementation
   detail, decided already, not reopened here.
2. **Identity reconciliation** (the substrate's actual job): every
   human in the system — operator or not — gets one coherent
   `core.participants` record per distinct `auth.users` identity,
   with role authority resolved across all three legacy sources
   where they exist, full lineage back to every contributing row,
   and disagreement surfaced rather than hidden.

These can use different tables internally without contradiction:
RLS asks "is this session allowed to do X," which only needs to be
right for the actor issuing the request. Identity reconciliation
asks "who is this participant and what does the full legacy record
say about them," which needs to be right for anyone looking at the
data later, including during an audit or a dispute.

**Requirement — Part A: RLS gating backfill**

- Re-verify current state of `organization_members` against
  production (do not assume the pre-rollback backfill state
  persisted through the rollback — confirm fresh)
- Ensure all three "Malchijah" `auth.users` IDs have appropriate
  rows with `department_id`/`location_id` matching MAJH Events scope
- Ensure Zachary's `auth.users` ID has an appropriate row
- Document any rows added in the migration commit message

**Requirement — Part B: Identity reconciliation function**

Create `core.reconcile_participants(p_tenant_id UUID)` following
the reconciliation function pattern in §2.3:

1. For the given tenant, enumerate every `auth.users` row
   associated with it. For Phase 1, with MAJH Events as the only
   live tenant, this means all 43 current `auth.users` rows are
   treated as MAJH Events participants — the 40 without an operator
   role are not "unlinked" in a problem sense, they are ordinary
   non-operator participants (this resolves reconnaissance's D4
   decision point: backfill scope is *all* auth.users, not just the
   3 operators, because a coherent identity substrate needs to
   represent everyone the tenant has, not only the people with
   elevated authority).
2. For each user, look up their row (if any) in each of
   `organization_members`, `staff_roles`, `tenant_memberships`.
3. For each legacy role value found, resolve it to a substrate
   concept via `core.legacy_semantic_mappings` (R13b). If a legacy
   term has no mapping row yet, auto-create one with `confidence =
   'flagged'` rather than blocking.
4. If all resolved substrate concepts agree → `resolved_role` =
   that value, `role_conflict_detected` = false.
5. If they disagree → `resolved_role` = the highest-privilege value
   using this precedence (proposed default, escalate to founder if
   disagreement is found that this order doesn't obviously resolve):
   `platform_owner` > `tenant_owner` > `tenant_manager` > (no
   operator role) → `role_conflict_detected` = true.
6. For users with no row in any of the three membership tables,
   `resolved_role` = `NULL`, `role` = `'participant'` (generic;
   modules refine further), `role_conflict_detected` = false (there
   was nothing to conflict).
7. Upsert into `core.participants` (one row per `auth.users` id —
   Malchijah's three profiles produce three separate
   `core.participants` rows, each correctly scoped to whichever
   legacy rows actually reference that specific `auth.users` id;
   this is not an identity-merge operation and must not become one).
8. Populate all five `provenance_*` columns per §2.1:
   `provenance_source` lists every membership table actually
   checked (even ones where no matching row was found — record that
   absence was confirmed, which is different from never checking);
   `provenance_legacy_ids` lists the exact row IDs that contributed;
   `provenance_bridge_version` and `provenance_bridge_run_at` are
   set on every write.
9. Function is idempotent — safe to re-run, which is what R27's
   drift check relies on.

**Acceptance criteria:**

- Every one of the 43 `auth.users` has exactly one
  `core.participants` row for the MAJH Events tenant
- Malchijah's three profiles produce three distinct
  `core.participants` rows, not one merged row
- Zachary's `core.participants` row has `role_conflict_detected =
  true` if his three legacy sources disagree after semantic
  mapping, `false` if they agree — verify which is actually true
  against production rather than assuming
- Every `core.participants` row's lineage columns are populated and
  traceable back to real legacy rows
- Re-running `core.reconcile_participants` produces no changes on a
  second run against unchanged legacy data (idempotency)
- All three "Malchijah" auth IDs and Zachary continue to have
  working RLS-gated access via `organization_members` (Part A)

**Verification query intent:**

- Count check: `SELECT COUNT(*) FROM core.participants WHERE
  tenant_id = <majh_events_id>` equals 43
- Malchijah check: three distinct `core.participants` rows for his
  three `auth.users` ids, each with correct lineage
- Zachary check: one `core.participants` row, lineage showing all
  three membership tables checked, `role_conflict_detected` value
  matching whatever the actual semantic-mapped comparison produces
- Conflict scan: `SELECT * FROM core.participants WHERE tenant_id =
  <majh_events_id> AND role_conflict_detected = true` — review the
  full list, not just Zachary, since reconnaissance's Q4 findings
  may extend beyond the specific rows already discussed
- Idempotency check: run the function twice, diff `updated_at`
  timestamps — should be unchanged on the second run (or, if the
  agent's implementation always touches `updated_at`, confirm the
  *content* is unchanged, which is the property that actually
  matters)
- Query `organization_members` for the RLS-gating check per Part A

**Reference:** §1.0, §2 of this document (the reconciliation
thesis and discipline); ARCHITECTURE.md v2 §12.2;
`docs/PHASE_1_RECONNAISSANCE.md` Q1-Q5 and
`docs/PHASE_1_RECONNAISSANCE_S6.md` Q26-Q27 (ground truth)

### R21: Payment bridge — `payment_requests`/`payment_events`/`payment_receipts` → `core.payments_in`

**Rationale:** Reconnaissance corrected an assumption in v1.0.0:
MAJH Events' incoming-payment reality is not one clean
`payment_requests` table but three tables
(`payment_requests`, `payment_events`, `payment_receipts`) that
together describe roughly 3 actual transactions. A bridge that
naively copies `payment_requests` rows 1:1 would miss what the
other two tables know about those same transactions, and would
misrepresent the "coherent view" thesis by producing an
incompletely-informed substrate row.

**Requirement:**

1. **Correlate before creating.** For each distinct underlying
   payment event, identify which rows across all three legacy
   tables belong to it. Use whatever natural correlation key the
   schema provides (a shared reference id, or a best-effort match
   on tournament/participant/amount/near-in-time heuristics if no
   clean key exists — the agent must actually inspect the three
   tables' columns to determine which correlation strategy applies;
   do not assume a specific key without checking).
2. **Where correlation is confident:** create one `core.payments_in`
   row representing the full picture from all contributing legacy
   rows. Populate `source_type`, `source_id` (pointing at the
   `payment_requests` row as the primary anchor), `amount_cents`,
   `currency`, `received_at` from the most authoritative
   available source. Populate all five `provenance_*` columns,
   listing all three legacy tables and every specific contributing
   row ID.
3. **Where correlation is NOT confident:** still create the
   `core.payments_in` row (do not drop data), but set
   `reconciliation_ambiguous = true` and record in `data`/metadata
   why correlation was uncertain. This row surfaces in R26's
   reconciliation report for human review — it does not silently
   become "probably fine."
4. **Bridge mechanism going forward:** a trigger or function fires
   on relevant state transitions in the legacy tables so that new
   activity is bridged automatically, not just historical data.
5. **Backfill:** given reconnaissance found only ~3 rows per legacy
   table, backfill all historical rows — the volume makes this
   trivial, there is no reason to defer any of it.

**Acceptance criteria:**

- Every legacy payment row across all three tables is accounted
  for in some `core.payments_in` row's `provenance_legacy_ids`
- No legacy row is silently dropped or duplicated across multiple
  `core.payments_in` rows without `reconciliation_ambiguous` being
  set to explain why
- New activity going forward produces new `core.payments_in` rows
  automatically via the bridge
- Lineage is complete and queryable for every bridged row

**Verification query intent:**

- Coverage check: every row in `payment_requests`,
  `payment_events`, `payment_receipts` appears in at least one
  `core.payments_in` row's `provenance_legacy_ids` array
- Ambiguity scan: `SELECT * FROM core.payments_in WHERE
  reconciliation_ambiguous = true` reviewed against the actual
  legacy data to confirm the flag is warranted, not lazy
- Sample specific payment across all three legacy tables and
  confirm the derived `core.payments_in` row's lineage names every
  contributing row correctly
- Test end-to-end: new payment activity produces a new
  `core.payments_in` row with correct lineage

**Reference:** §2 of this document (reconciliation discipline);
ARCHITECTURE.md v2 §4.5; `docs/PHASE_1_RECONNAISSANCE_S5.md` Q21-Q22
(ground truth on the three-table payment reality)

### R22: Payout bridge — `payout_requests`/`player_payouts` → `core.payments_out`

**Rationale:** Same correlation problem as R21, on the outgoing
side. Reconnaissance confirms `payout_requests` and
`player_payouts` are a dual system likely representing overlapping
reality rather than two clean, distinct systems — exactly the kind
of fracture §1.0 says the substrate must hold coherently rather
than pretend doesn't exist.

**Requirement:**

- Same correlation-first approach as R21, applied across
  `payout_requests` and `player_payouts`
- Same `reconciliation_ambiguous` flag where correlation between
  the two tables cannot be confidently established for a given
  payout
- Same full lineage requirement, same backfill-everything decision
  given the small row counts reconnaissance found

**Note:** The paused cron `cron/process-payouts` complicates this.
Agent must be careful not to accidentally trigger paused payout
processing during the bridge implementation. The bridge should
observe state transitions that have already completed, not
initiate new ones. Reconnaissance's D5 decision point (whether to
reactivate the cron) is explicitly NOT resolved by this
requirement — the bridge works whether the cron stays paused or is
reactivated later; do not couple the two decisions.

**Acceptance criteria:**

- Same pattern as R21, applied to the payout side
- The paused cron remains paused (no accidental resume)

**Verification query intent:**

- Same pattern as R21
- Explicitly verify `process-payouts` cron still returns 200 with
  paused message post-migration

**Reference:** §2 of this document; ARCHITECTURE.md v2 §4.6;
`docs/PHASE_1_RECONNAISSANCE_S5.md` Q23 (ground truth); conversation
context on paused cron

### R23: Forward-going participant creation on new registration

**Rationale:** R20 handles the one-time reconciliation of existing
`auth.users`. Once Phase 1 lands, new users registering need a
`core.participants` row created going forward without waiting for
the next reconciliation run — otherwise the substrate immediately
starts drifting from reality the moment a new person signs up.

Note this requirement's scope narrowed from v1.0.0: there is no
`user_profiles` table (reconnaissance confirmed it does not exist
in production — v1.0.0 assumed it did). The source of truth for new
users is `auth.users` directly, via Supabase's `on_auth_user_created`
trigger pattern if one already exists, or a new one if not.

**Requirement:**

- Check whether an existing trigger fires on `auth.users` insert
  (reconnaissance's Q5 codebase search should reveal this; if not
  yet confirmed, the agent confirms before drafting)
- Extend or create a trigger/function so that new user creation
  also creates a corresponding `core.participants` row for the
  tenant context the registration occurred in, with `role =
  'participant'`, no legacy sources (fresh row, `provenance_source
  = '[]'`, `provenance_bridge_run_at = now()` to distinguish
  "created directly by the substrate" from "backfilled from
  legacy")
- Document this as the one piece of Phase 1 that is genuinely new
  application-layer-adjacent code (a database trigger, not a
  Next.js code change) rather than pure backfill

**Acceptance criteria:**

- New user registration produces a `core.participants` row without
  manual intervention or waiting for `core.reconcile_participants`
  to run again
- No duplicate participant records for the same user
- Existing registration flow is not broken by the new trigger

**Verification query intent:**

- Test: create a test `auth.users` row, confirm a corresponding
  `core.participants` row appears automatically
- No duplicates: `SELECT user_id, COUNT(*) FROM core.participants
  WHERE tenant_id = <majh_events_id> GROUP BY user_id HAVING
  COUNT(*) > 1` returns empty
- Confirm existing registration flow (signup, email confirmation,
  etc.) still works end-to-end after the trigger is added

**Reference:** ARCHITECTURE.md v2 §4.3;
`docs/PHASE_1_RECONNAISSANCE_S6.md` Q26 (ground truth correcting
the v1.0.0 `user_profiles` assumption)

### R24: Migration verification suite

**Rationale:** After all Phase 1 SQL is applied, we need a
comprehensive verification pass to confirm nothing broke and
everything specified is in place.

**Requirement:**

A verification query set (SQL script) that outputs a report
including:

- All new tables exist with expected structure
- All extended tables have new columns
- All triggers exist
- All indexes exist
- All RLS policies exist
- Row counts on backfilled tables match expectations
- Sample queries from `authenticated` context succeed with
  expected results
- Sample cross-tenant queries fail with expected errors
- Hash chain integrity check passes (per R10)
- Immutability constraints prevent UPDATE/DELETE on `ledger_entries`
  and `core.audit_log` (per R11 — note the schema-qualified name;
  `core.audit_log` did not exist before this migration)
- Module registry seeded correctly
- Base vocabulary overlays exist
- MAJH Events tenant has expected `vocabulary_overlay_id` and
  `activated_modules`
- Reconciliation coverage report (R26) shows no unexpected gaps
- The mandatory coherent-identity test (R28) passes

Recommend structuring the verification as a series of `SELECT`
statements each returning `PASS` or `FAIL` with details, or a
psql script that produces a summary at the end.

**Acceptance criteria:**

- Verification script exists as `docs/PHASE_1_VERIFICATION.sql`
  (or as an appendix to `docs/PHASE_1_SCHEMA.md`)
- Every requirement R1-R23, R26, R27 has at least one verification
  query
- R28's coherent-identity test is included and passes — this is not
  optional; Phase 1 is not considered complete without it
- The script runs to completion without errors
- All expected results are returned

**Verification query intent:**

- This IS the verification query intent — the meta-requirement

**Reference:** Testing discipline; ARCHITECTURE.md v2 §14

### R25: Rollback plan documented

**Rationale:** If any Phase 1 step fails or produces unexpected
production behavior, we need to be able to roll back.

**Requirement:**

A rollback plan documented alongside Phase 1 SQL. Includes:

- For each new table: DROP TABLE statement (in reverse dependency
  order so foreign keys don't block)
- For each ALTER TABLE ADD COLUMN: DROP COLUMN (or accept that
  new columns remain but are ignored)
- For each new trigger: DROP TRIGGER
- For each new function: DROP FUNCTION
- For each new policy: DROP POLICY
- Notes on data preservation: rollback loses substrate data
  written since Phase 1 apply (but existing table data is
  untouched)

The rollback plan is not the same as "rerunning the migration
would break." A well-designed migration can be rolled back cleanly
if the plan is documented up front.

**Acceptance criteria:**

- Rollback SQL exists (in `docs/PHASE_1_ROLLBACK.md` or as
  appendix)
- Rollback can be executed if needed
- Notes explain data implications

**Verification query intent:**

- Not a verification query per se; rollback is a documented
  procedure

**Reference:** ARCHITECTURE.md v2 §14 discipline; standard
migration hygiene

### R26: Reconciliation reporting

**Rationale:** Lineage columns (§2.1) make individual rows
auditable. They do not, by themselves, give anyone a way to see
the *overall* state of reconciliation across a tenant — how much
legacy data has been absorbed, how much is still ambiguous, how
many role conflicts exist, how many legacy terms are unmapped.
Without a report, the reconciliation discipline is real but
invisible. This requirement makes it visible and queryable.

**Requirement:**

Create `core.reconciliation_report(p_tenant_id UUID)` — a function
or view — that returns, for the given tenant:

- **Coverage:** for each reconciled table (`core.participants`,
  `core.payments_in`, `core.payments_out`), the count of rows with
  non-empty `provenance_source` (bridged from legacy) versus empty
  (created natively in the substrate), and the count of rows never
  drift-checked (`provenance_drift_checked_at IS NULL`)
- **Conflicts:** count and list of `core.participants` rows where
  `role_conflict_detected = true`
- **Ambiguity:** count and list of `core.payments_in` /
  `core.payments_out` rows where `reconciliation_ambiguous = true`
- **Unmapped terms:** count and list of `core.legacy_semantic_mappings`
  rows with `confidence = 'flagged'` — legacy vocabulary the
  reconciliation function encountered but could not confidently
  resolve
- **Orphan check:** any row in a legacy source table (the three
  membership tables, the three payment tables, the two payout
  tables) that does not appear in any substrate row's
  `provenance_legacy_ids` — this catches legacy data the bridges
  missed entirely, which is different from data that was bridged
  ambiguously

**Acceptance criteria:**

- Function/view exists and is queryable
- Running it against MAJH Events tenant post-Phase-1 produces a
  report that is honest about the actual state — if conflicts or
  ambiguity exist, the report shows them, it does not hide them to
  look cleaner
- Orphan check returns zero for all legacy tables Phase 1 bridges
  (if it doesn't, that's a real gap to fix before Phase 1 is
  considered complete, not something to note and move past)

**Verification query intent:**

- Call `core.reconciliation_report('<majh_events_tenant_id>')` and
  inspect every section
- Cross-check the conflict list against the actual
  `core.legacy_semantic_mappings` data manually for at least the
  Zachary case, to confirm the report's conflict detection logic is
  actually correct and not just structurally present

**Reference:** §2.4 of this document (what "coherent" means
concretely)

### R27: Drift detection

**Rationale:** Reconciliation happens once at bridge-run time.
Legacy tables do not stop being written to — someone could still
edit a `tenant_memberships` row directly, or a new
`payment_events` row could arrive for a `payment_requests` row that
was already bridged. Phase 1 does not attempt real-time
bidirectional sync (§2.1 is explicit about this), but it does need
the capacity to detect when a bridged substrate row has fallen out
of sync with its legacy sources, so that drift is visible rather
than silently accumulating.

**Requirement:**

Create `core.check_drift(p_tenant_id UUID)` — a function, callable
on demand or via a scheduled job (scheduling itself is
application-layer/cron work, out of scope for this SQL requirement;
this requirement delivers the function the cron would call):

- For every row in `core.participants`, `core.payments_in`,
  `core.payments_out` with non-empty `provenance_legacy_ids`,
  re-fetch the named legacy rows and compare their current state to
  what would be produced if reconciliation ran again right now
- If unchanged: update `provenance_drift_checked_at = now()`, no
  other change
- If changed: do NOT silently overwrite the substrate row. Instead,
  flag it (a `drift_detected` marker — either a boolean column
  added alongside the lineage pattern, or a row written to
  `core.audit_log` with `action = 'substrate.drift_detected'` and
  full before/after state — the agent chooses whichever mechanism
  is simpler to implement correctly, but the drift must be visible
  in `core.reconciliation_report`, R26, either way)
- This is explicitly a detection-and-flag function, not an
  auto-heal function. Phase 1 does not decide what to do when drift
  is found beyond making it visible — resolving detected drift
  (re-running reconciliation, or accepting the substrate's existing
  value, or some other resolution) is a founder decision made per
  incident, not something Phase 1 automates.

**Acceptance criteria:**

- Function exists and is callable
- Running it against unchanged legacy data updates
  `provenance_drift_checked_at` and reports no drift
- Test: manually change a legacy row's value after bridging
  (e.g., edit a `tenant_memberships` role), re-run `check_drift`,
  confirm it is detected and surfaced rather than silently ignored
  or silently overwritten

**Verification query intent:**

- Baseline call with no legacy changes — confirm
  `provenance_drift_checked_at` updates, no drift flagged
- Controlled test: change one legacy row, re-run, confirm drift is
  flagged and visible in `core.reconciliation_report`
- Confirm the substrate row's `resolved_role`/`amount_cents`/etc.
  was NOT silently overwritten by the drift check itself

**Reference:** §2.1 of this document (why real-time sync is
explicitly out of scope, and what drift detection delivers instead)

### R28: Mandatory verification — the coherent identity test

**Rationale:** §1.0 states the substrate's actual value
proposition: producing one coherent, accurate view of fractured
legacy reality. That claim is worthless if it isn't tested
concretely. This requirement makes it a specific, mandatory,
non-optional part of the Phase 1 verification suite (R24)
rather than an aspiration in prose. Phase 1 is not complete until
this passes — it is not an optional nice-to-have verification, it
is the test of whether Phase 1 actually did what it set out to do.

**Requirement — the Malchijah test:**

Query `core.participants` filtered to Malchijah's three known
`auth.users` IDs. Confirm:

- Exactly three distinct `core.participants` rows exist (not one
  merged row, not fewer than three, not more)
- Each row's `provenance_legacy_ids` correctly names only the
  legacy rows that actually reference that specific `auth.users`
  ID — no cross-contamination between the three profiles
- Each row's `resolved_role` and `role_conflict_detected` are
  correct for that specific profile's actual legacy data (which may
  differ across the three profiles, since they may appear in
  different membership tables with different roles — verify against
  actual production data, do not assume symmetry across the three)

**Requirement — the Zachary test:**

Query `core.participants` filtered to Zachary's `auth.users` ID.
Confirm:

- Exactly one `core.participants` row exists
- `provenance_source` lists all three membership tables as checked
  (`organization_members`, `staff_roles`, `tenant_memberships`),
  regardless of whether each one had a matching row
- `provenance_legacy_ids` names the specific row(s) found in
  whichever tables actually had a Zachary row
- `role_conflict_detected` correctly reflects whether his three
  legacy sources agree after semantic mapping is applied — the
  agent must compute this against actual reconnaissance data
  (`docs/PHASE_1_RECONNAISSANCE.md` Q2 and Q4) rather than assume an
  answer; document the actual finding in the verification output

**Requirement — the payment coherence test:**

Pick one payment that has rows across all three legacy payment
tables (`payment_requests`, `payment_events`, `payment_receipts`).
Confirm:

- Exactly one `core.payments_in` row represents it (or, if the
  agent's correlation logic could not confidently merge them,
  confirm `reconciliation_ambiguous = true` with a documented
  reason — either outcome is acceptable, but the row must exist and
  the lineage must be complete)
- `provenance_legacy_ids` names every contributing row across all
  three legacy tables correctly

**Acceptance criteria:**

- All three tests above pass against actual production data (or
  actual staging data mirroring production, if run pre-production)
- Test results are included, verbatim with actual query output, in
  the Phase 1 completion report — not summarized as "passed," shown
  with the real rows returned
- If any test reveals a surprise (e.g., Zachary's sources agree when
  reconnaissance suggested they might not, or vice versa), the
  completion report states the actual finding rather than the
  expected one

**Verification query intent:**

- The three queries described above, run for real, with real
  output pasted into the verification record

**Reference:** §1.0 and §2.4 of this document — this requirement
exists to make those sections falsifiable rather than aspirational

---

## 5. Order of application

Phase 1 SQL should be applied in the following order. This
respects dependencies and allows verification checkpoints. v1.1.0
adds a schema-relocation step, a semantic-mapping step ahead of
membership reconciliation, and a final mandatory reconciliation
verification phase that does not exist in a "normal" schema
migration but is not optional here.

**Phase 1a (schemas and extensions):**

1. R1 — `core` schema
2. R2 — `platform` schema
3. R3 — `pgvector` extension

**Verification checkpoint:** Confirm schemas and extensions exist.

**Phase 1b (relocate and extend existing tables):**

4. R9 — `entities` relocated from `public` to `core`, then extended
   with `parent_entity_id` (relocated early because later steps —
   R6's `entity_resources`, anything referencing entities —
   should reference `core.entities` from the start, not `public`)
5. R4 — `tenants` columns
6. R10 — `ledger_entries` hash chain columns

**Verification checkpoint:** Confirm `core.entities` exists,
`public.entities` does not; row counts match pre-move counts;
columns exist on `tenants` and `ledger_entries`; existing data
intact; existing queries still work (including any application
code updated per R9 to reference the new schema).

**Phase 1c (create substrate primitives, with lineage columns):**

7. R5 — `core.participants` (with `resolved_role`,
   `role_conflict_detected`, and the five `provenance_*` columns)
8. R6 — `core.resources` and `core.entity_resources`
9. R7 — `core.payments_in` (with `reconciliation_ambiguous` and
   the five `provenance_*` columns)
10. R8 — `core.payments_out` (same lineage columns as R7)
11. R12 — `core.ledger_accounts` (chart of accounts)

**Verification checkpoint:** All primitive tables exist with RLS
and, where specified, lineage columns.

**Phase 1d (create infrastructure tables, including semantic mapping):**

12. R13 — `core.vocabulary_overlays` (seed `events-base` with real
    MAJH Events terminology, stub the other five; add FK on
    tenants.vocabulary_overlay_id)
13. R13b — `core.legacy_semantic_mappings` (seed the six known role
    mappings from `docs/PHASE_1_RECONNAISSANCE.md` Q4 — this MUST
    land before R20, since R20's reconciliation function depends on
    it)
14. R14 — `platform.modules` (and seed module registry)
15. R15 — `core.tenant_has_module()` function
16. R16 — `core.event_store`
17. R17 — `core.outbox`
18. R18 — `core.knowledge_vectors`
19. R11 (create) — `core.audit_log` created fresh (structure only,
    trigger comes in phase 1e)

**Verification checkpoint:** Infrastructure in place; module
registry seeded; overlays seeded; semantic mappings seeded;
`core.audit_log` exists.

**Phase 1e (triggers and enforcement):**

20. R10 (continued) — hash chain trigger
21. R11 (continued) — immutability triggers on `ledger_entries` and
    `core.audit_log`; revoke stale UPDATE/DELETE grants on
    `ledger_entries`

**Verification checkpoint:** Triggers work; UPDATE/DELETE fail on
protected tables; stale grants confirmed revoked.

**Phase 1f (RLS pattern establishment):**

22. R19 — apply standard four-level RLS pattern to all new tables

**Verification checkpoint:** RLS policies enforce isolation.

**Phase 1g (reconciliation — the part this revision exists for):**

23. R20 Part A — `organization_members` RLS-gating completeness
    re-verified and backfilled if needed
24. R20 Part B — `core.reconcile_participants()` function created
    and run for MAJH Events tenant (all 43 `auth.users`)
25. R21 — `core.payments_in` correlation and backfill across all
    three legacy payment tables
26. R22 — `core.payments_out` correlation and backfill across the
    dual payout tables
27. R10 (continued) — `ledger_entries` hash chain backfill

**Verification checkpoint:** Data reconciled; row counts match
expectations; `core.reconciliation_report` (R26, run manually here
even though its own creation is phase 1i) shows the actual coverage
and conflict state — review this before proceeding, since phase 1h
and 1i depend on reconciliation actually having landed correctly.

**Phase 1h (bridges for ongoing data flow):**

28. R21 (continued) — bridge trigger/function activated for new
    payment activity
29. R22 (continued) — bridge for new payout activity
30. R23 — forward-going `core.participants` creation on new user
    registration

**Verification checkpoint:** New activity produces substrate
records with correct lineage.

**Phase 1i (reconciliation tooling, verification suite, and rollback):**

31. R26 — `core.reconciliation_report()` function created; run
    against MAJH Events tenant; results reviewed
32. R27 — `core.check_drift()` function created; run once as a
    baseline (expect no drift immediately after Phase 1 lands,
    since nothing has had time to diverge yet — this run mainly
    confirms the function executes correctly)
33. R28 — **the mandatory coherent-identity test.** Run the
    Malchijah test, the Zachary test, and the payment coherence
    test. This does not pass by construction just because R20-R22
    ran without error — it must be run and its actual output
    reviewed.
34. R24 — full verification suite executed end-to-end, incorporating
    R26-R28's results
35. R25 — rollback plan documented and reviewed

**Final gate:** Phase 1 is not complete until R28 has been run with
real output reviewed by the founder and Claude. A migration that
applied without SQL errors but whose coherent-identity test was
never actually run is not Phase 1 complete — it is Phase 1 applied,
which is exactly the gap that produced the rollback this revision
is responding to.

---

## 6. Handoff to drafting agent

**Status note (read before anything else in this section):** an
earlier Phase 1 attempt was applied to production without Claude's
architectural review, without staging verification, and with a
completion report that claimed 100% delivery against roughly 30-35%
actual delivery. It was rolled back. Production is currently back
to its pre-Phase-1 state (except the correct Zachary
`organization_members` backfill, which was preserved). A full
production reconnaissance was completed after the rollback and is
committed as `docs/PHASE_1_RECONNAISSANCE.md` through
`docs/PHASE_1_RECONNAISSANCE_S8.md` plus
`docs/PHASE_1_RECONNAISSANCE_INDEX.md`. This section reflects that
reality — reconnaissance is done, several decisions that were open
in v1.0.0 are now resolved in this document's requirements
themselves, and the review discipline described below is not a
formality; it is the specific gap the previous attempt skipped.

### 6.1 What the drafting agent produces

- `docs/PHASE_1_SCHEMA.md` — the full SQL specification with
  each requirement translated into concrete DDL and DML, organized
  by the order in §5 above
- `docs/PHASE_1_VERIFICATION.sql` — the verification script per
  R24, including R26's reconciliation report query, R27's drift
  check query, and R28's three coherent-identity test queries with
  their actual expected output documented
- `docs/PHASE_1_ROLLBACK.md` — the rollback plan per R25
- `docs/PHASE_1_BACKFILL.md` — separate document detailing the
  backfill scripts for R20-R23 (per founder's earlier decision
  that backfill is separate from schema)

### 6.2 What the drafting agent must do first

Reconnaissance is complete for most of what Phase 1 needs, but
review of the reconnaissance found specific gaps that must be
closed before SQL drafting begins — these are gaps in the
reconnaissance itself, not open founder decisions:

- **Re-run Q2** (`docs/PHASE_1_RECONNAISSANCE.md` §1.2,
  `organization_members` full row inventory) against current
  production state. The reconnaissance as delivered does not show
  Zachary's row, but the post-rollback verification confirmed his
  row exists with `TENANT_MANAGER`. Reconcile this discrepancy
  before R20 is drafted — it directly affects R20's correctness.
- **Fill Q5** (which application code paths write to which
  membership table) — read the actual code, not just infer from
  schema. This affects whether R23's forward-going trigger
  conflicts with existing registration code.
- **Fill Q11** (UPDATE/DELETE grant check on `ledger_entries`) with
  an actual query result, not an inference — R11 revokes these
  grants and needs to know what currently holds them.
- **Fill Q22 and Q23's code traces properly** — the reconnaissance
  noted these as "opaque without more codebase digging." The agent
  has codebase access via Vercel; use it. R21 and R22's correlation
  logic depends on understanding the actual payment/payout code
  paths, not just the schema shapes.
- **Fill Q25** (idempotency infrastructure) with the actual query
  result — referenced in the reconnaissance summary but the raw
  output was not shown.

### 6.3 Decisions already resolved in this document (do not re-litigate)

These were open in v1.0.0 or surfaced by reconnaissance as needing
founder input; v1.1.0 resolves them directly in the requirements
above. The agent implements per the requirement text, it does not
ask the founder to re-decide:

- **Membership consolidation approach** → R20: `organization_members`
  for RLS gating (mechanical), full three-source reconciliation
  into `core.participants` for identity (the substrate's actual
  job). Not "pick one canonical table" — reconcile all three.
- **Bridge design specifics** → R21, R22: correlate across all
  contributing legacy tables before creating a substrate row; flag
  ambiguity rather than guess; backfill everything (row counts are
  small enough that deferring any of it has no benefit).
- **Chart of accounts default values** → R12: minimal generic chart
  (five accounts), expand later when finance module needs grow.
- **Vocabulary overlay seed values** → R13: `events-base` gets real
  MAJH Events terminology; the other five base overlays get minimal
  stubs, filled in when each vertical gets its first real tenant.
- **Schema namespace** → §3.2 (locked): `core` and `platform`.

### 6.4 What the drafting agent must still escalate

- If Q2's discrepancy (above) reveals something more complicated
  than a simple timing issue, escalate before proceeding — do not
  guess at what state `organization_members` is actually in.
- If the precedence order proposed in R20 (`platform_owner` >
  `tenant_owner` > `tenant_manager`) produces a conflict resolution
  that looks wrong for a specific real row once the agent sees
  actual data, flag it rather than applying the precedence
  mechanically. The precedence order is a reasonable default, not a
  guarantee it's right for every case reconnaissance didn't
  specifically examine.
- If R21/R22's correlation logic cannot find *any* reasonable
  correlation strategy across the legacy payment/payout tables
  (as opposed to finding one but being unconfident in specific
  cases, which is what `reconciliation_ambiguous` is for), escalate
  before inventing one — this would mean the tables don't actually
  relate the way this document assumes, which would be a real
  surprise worth stopping for.

### 6.5 What the drafting agent must review with Claude
(architectural PM) — mandatory, not optional

This is the step the previous Phase 1 attempt skipped, and skipping
it is why that attempt was rolled back. Before applying anywhere —
staging included, not just production:

- Full draft of `docs/PHASE_1_SCHEMA.md`
- Full draft of `docs/PHASE_1_VERIFICATION.sql`, including the R26,
  R27, and R28 queries specifically
- Full draft of `docs/PHASE_1_BACKFILL.md`

Architectural review confirms:

- Universal primitives match ARCHITECTURE.md v2 §4, with lineage
  columns per §2.1 where specified
- Four-level RLS enforces intended scope
- Hash chain matches ARCHITECTURE.md v2 §7.1
- `core.audit_log` is created correctly and distinctly from
  `core.event_store` and the two pre-existing MAJH-Events-specific
  audit tables (R11)
- Substrate/module boundary is respected
- Bridge patterns match Option 3a and the correlation-first
  discipline in §2.3
- The semantic mapping table (R13b) and reconciliation function
  (R20) actually implement §1.0's thesis, not just its vocabulary
- R28's test queries are concrete and will actually produce
  verifiable pass/fail output, not vague assertions
- Nothing forecloses future modules or verticals

Claude's review response is written and specific: either "approved
to apply to staging" or a list of what needs revision. A verbal
"looks fine" in conversation is not the review; a written response
against this specific SQL draft is.

### 6.6 What the drafting agent must do before applying to
production

- Apply to Supabase branch (staging: `gyyswaidsfjstterckrc`) first
  — not skipped, not treated as optional under time pressure
- Run the full verification suite in staging, including R28's
  coherent-identity tests, with actual output captured
- Confirm MAJH Events tenant data unaffected (spot check against
  real staging data, not assumption)
- Get founder final approval — a specific, written "Claude has
  reviewed and approved, apply to production" from the founder,
  not an inferred green light from general conversation momentum
- Merge to production during low-usage window
- Run the full verification suite in production, including R28
- Document actual outcomes with real query output — not "all tests
  passed," the actual rows returned

---

## 7. What Phase 1.5 will address

For context, so the drafting agent understands the shape of the
next migration:

- Escrow tables (`escrow_accounts`, related tables) reshaping per
  ARCHITECTURE.md v2 §7.2
- Escrow state machine and MFA gate
- Escrow-ledger bridge (automatic ledger entries on escrow
  transitions)
- Opaque data payload contract enforcement
- Migration of existing escrow data (three legacy `player_payouts`
  rows per commit `13655a0`)
- Ten escrow invariants verification suite

**Note added in v1.1.0:** Phase 1.5's escrow reconciliation
(existing `escrow_accounts` and related legacy tables into
`core.escrow_accounts`) is a legacy-reconciliation problem exactly
like R21/R22 — the existing `PHASE_1.5_REQUIREMENTS.md` predates
this document's §2 discipline and should be revised to require the
same lineage columns, the same correlation-before-creation
approach, and the same drift-detection capability before its SQL is
drafted. Do not draft Phase 1.5 SQL against the un-revised
requirements document.

Phase 1.5 requirements will be finalized after Phase 1 is applied
and verified, including this reconciliation-discipline update.
Phase 1 sets the substrate foundation — including the reconciliation
mechanism itself — on which Phase 1.5 escrow work can safely land.

---

## 8. Companion documents

- `docs/ARCHITECTURE.md` v2.1.0 — technical source of truth
  (includes §14 UI surfaces)
- `docs/CAPABILITY_MAP.md` v1.0.1 — substrate/module boundary
- `docs/STRATEGIC_DIRECTION.md` v1.1.1 — strategic frame
- `docs/ARCHITECTURE_OPEN_QUESTIONS.md` — deferred items
- `docs/AGENT_COLLABORATION_PROTOCOL.md` — how agent operates
- `docs/RALPH_BLUEPRINT.md` — Ralph's dependency on knowledge
  pool
- `docs/PHASE_1.5_REQUIREMENTS.md` — escrow substrate work that
  follows Phase 1; needs the reconciliation-discipline revision
  noted above before its SQL is drafted
- `docs/PHASE_1_RECONNAISSANCE.md` through
  `docs/PHASE_1_RECONNAISSANCE_S8.md`, and
  `docs/PHASE_1_RECONNAISSANCE_INDEX.md` — the production ground
  truth this revision is built against
- `docs/BACKLOG.md` (April) — historical T-numbered task context

---

*Requirements are what Phase 1 must accomplish. SQL is how it does
it. Verification queries are how we know it worked. Rollback is
what saves us if it didn't. All four matter.*
