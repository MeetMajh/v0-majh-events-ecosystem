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

**Last updated:** July 11, 2026

**Version:** 1.0.0

**Reading order for the drafting agent:**

1. This document (requirements)
2. `docs/ARCHITECTURE.md` v2.0.0 (technical source of truth,
   especially §2, §3, §4, §6, §7, §10, §12, §14)
3. `docs/CAPABILITY_MAP.md` v1.0.1 (substrate/module boundary)
4. `docs/STRATEGIC_DIRECTION.md` v1.1.1 (the "why" — MAJH Events
   sits on substrate; substrate serves every tenant)
5. `docs/ARCHITECTURE_OPEN_QUESTIONS.md` (what to explicitly NOT
   include; deferred items)

---

## 1. Scope of Phase 1

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
- **Membership table consolidation** → separate ticket (T-011
  continuation from April BACKLOG). Phase 1 uses
  `organization_members` for new substrate table RLS because it has
  the department_id and location_id columns needed for four-level
  scope. Consolidation of the three tables
  (`tenant_memberships`, `organization_members`, `staff_roles`)
  into a single canonical source is separate work.
- **Unified payout system** → T-005 from April BACKLOG. Phase 1
  provides `payments_out` as a substrate primitive; the
  consolidation of the dual `player_payouts` / `payout_requests`
  systems into it is a follow-up.
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

## 2. Reconciliation approach

### 2.1 Option 3a confirmed: substrate + module + bridge

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

### 2.2 Schema namespace decision required

**Decision needed before drafting SQL:** Are substrate tables placed
in a new `core` schema or in the existing `public` schema with
naming convention (`core_participants`, `core_payments_in`, etc.)?

**Recommendation:** Use `core` schema. Matches ARCHITECTURE.md v2
throughout. Cleaner separation. Easier RLS policy authoring.
Slightly more work to set up initially but pays back immediately.

**If `core` schema is used, the agent must:**

- Create the `core` schema explicitly
- Grant appropriate schema privileges to the necessary roles
- Update RLS policy references to include schema qualifier
- Update any Supabase-specific configuration that needs to know about
  a new schema

**If `public` schema is retained:**

- Prefix substrate tables consistently (recommend `core_` prefix)
- Note the deviation from ARCHITECTURE.md v2 naming
- Plan for future schema migration when application impact allows

### 2.3 Existing infrastructure to leverage

Phase 1 SHOULD leverage what exists rather than duplicate:

- `tenants` table (do not recreate; extend with new columns)
- `departments` table with `slug` column (do not recreate; extend if
  needed)
- `locations` table with `currency`, `timezone`, `tax_rate`,
  `department_id` (do not recreate; extend if needed)
- `entities` table (do not recreate; extend if columns are missing)
- `ledger_transactions` and `ledger_entries` (do not recreate; add
  hash chain columns and triggers)
- `audit_log` (do not recreate; add immutability trigger if not
  already enforced)
- `platform_config` (do not recreate; may inform platform-level
  settings)
- `organization_members` (do not recreate; use as-is for new RLS)
- `pgvector` extension (verify enabled; enable if not)

Phase 1 SHOULD create new tables for what doesn't exist:

- `core.participants`
- `core.resources`
- `core.payments_in`
- `core.payments_out`
- `core.event_store`
- `core.outbox`
- `core.ledger_accounts` (chart of accounts per tenant)
- `core.vocabulary_overlays`
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

## 3. Requirements (ordered)

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
Phase 1 creates the substrate table; bridge from `user_profiles`
follows separately.

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
- `contact_info` JSONB (email, phone, address, etc.)
- `data` JSONB (role-specific attributes)
- `is_active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()
- `deleted_at` TIMESTAMPTZ NULL (soft delete)

Indexes:

- Index on `(tenant_id)` for tenant-scoped queries
- Index on `(tenant_id, department_id)` for department-scoped
- Index on `(tenant_id, role)` for role-based filters
- Index on `(user_id)` where user_id IS NOT NULL for user
  lookups
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

**Reference:** ARCHITECTURE.md v2 §4.3, §12

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
`payment_requests`/`payment_events` and a bridge (per R23) copies
into `core.payments_in`.

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

**Reference:** ARCHITECTURE.md v2 §4.5

### R8: `core.payments_out` table with four-level scope and RLS

**Rationale:** Mirror of R7 for outgoing payments. ARCHITECTURE.md
v2 §4.6.

**Requirement:**

Create `core.payments_out` with parallel structure to
`core.payments_in`:

- Same columns except `payer_id` → `payee_id`,
  `stripe_payment_intent_id` → `stripe_transfer_id`
- Same constraints, indexes, and RLS pattern
- `received_at` → `sent_at`

**Acceptance criteria:** Same as R7 pattern.

**Verification query intent:** Same as R7 pattern.

**Reference:** ARCHITECTURE.md v2 §4.6

### R9: `entities` table extended for hierarchy and status normalization

**Rationale:** ARCHITECTURE.md v2 §4.2 specifies `entities` needs a
`parent_entity_id` for hierarchical entity relationships (seasons
containing tournaments, projects containing phases). Also
normalizes status field if not present.

**Requirement:**

Agent verifies current `entities` structure. Then, as needed:

- ADD COLUMN `parent_entity_id` UUID NULL, FK to `entities.id`
  (self-referencing)
- Verify `type` column exists (should)
- Verify `data` JSONB column exists (should)
- Verify `status` TEXT column exists; add if missing
- Verify `tenant_id`, `department_id`, `location_id` scoping columns
  exist per ARCHITECTURE.md v2 §3.2; add if missing
- Verify soft delete `deleted_at` column exists; add if missing

Index on `(parent_entity_id)` for hierarchy queries.

RLS verification: existing RLS should enforce tenant scope. If
department/location scoping is missing from policies, update.

**Acceptance criteria:**

- All required columns present with correct types
- Existing data intact
- Existing queries against `entities` continue to work
- New self-referencing FK doesn't create circular constraints
  problems

**Verification query intent:**

- Structural verification
- Sample query showing existing entities unaffected
- Test insert of parent + child entity works

**Reference:** ARCHITECTURE.md v2 §4.2

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

### R11: `ledger_entries` and `audit_log` immutability triggers

**Rationale:** ARCHITECTURE.md v2 §2.1 and §7.1 specify these
tables are append-only. Enforcement at the database level (not
just application) is required so that even if application code has
a bug, the database refuses to mutate history.

**Requirement:**

- Create BEFORE UPDATE trigger on `ledger_entries` that raises
  exception in all cases (blocks all updates)
- Create BEFORE DELETE trigger on `ledger_entries` that raises
  exception in all cases (blocks all deletes)
- Same triggers on `audit_log` if not already present
- Revoke any UPDATE and DELETE privileges on these tables from
  all roles except service_role (agent verifies existing state
  first; may already be revoked)
- Document that corrections require inserting compensating rows,
  not modifying original rows

**Acceptance criteria:**

- Attempting to UPDATE a `ledger_entries` row fails with expected
  error
- Attempting to DELETE a `ledger_entries` row fails with expected
  error
- Same for `audit_log`
- New INSERT still works

**Verification query intent:**

- Confirm triggers exist via `pg_trigger`
- Test UPDATE attempts and verify they fail
- Test DELETE attempts and verify they fail
- Test INSERT still works

**Reference:** ARCHITECTURE.md v2 §2.1, §7.1, §7.4

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

**Acceptance criteria:**

- Table exists with structure
- Six base overlays seeded
- MAJH Events tenant references `events-base`
- RLS works as specified
- FK on tenants.vocabulary_overlay_id enforced

**Verification query intent:**

- Structural verification
- Count of base overlays = 6
- MAJH Events `vocabulary_overlay_id` matches `events-base.id`
- Cross-tenant overlay isolation verified

**Reference:** ARCHITECTURE.md v2 §5

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

### R20: Backfill preparation — `organization_members` completeness check

**Rationale:** Per conversation, Phase 1 uses `organization_members`
for RLS on new tables. But `organization_members` may not have
complete rows for all humans who need access.

**Requirement:**

- Query `organization_members` for existing rows
- Compare to expected populations:
  - All three "Malchijah" user IDs should have PLATFORM_OWNER-
    level rows (or equivalent role) with department_id/location_id
    matching MAJH Events scope
  - Zach's user ID should have appropriate rows
  - Any test users should be identified and either included or
    excluded consistently
- If humans are missing, backfill `organization_members` with
  appropriate rows BEFORE any Phase 1 substrate table becomes
  authoritative
- Document who was added and why in the migration commit message

**Acceptance criteria:**

- Malchijah has organization_members coverage for MAJH Events
  tenant
- Zach has organization_members coverage for MAJH Events tenant
- Test users are handled consistently
- Post-backfill, all users can access their expected tenant data

**Verification query intent:**

- Query `organization_members` filtered by user_id for each
  known human
- Confirm expected rows exist with expected role_key values
- Test access from each user's context (if possible)

**Reference:** Conversation context; ARCHITECTURE.md v2 §12.2

### R21: Payment bridge — `payment_requests` → `core.payments_in`

**Rationale:** Option 3a. Existing MAJH Events payment flows write
to `payment_requests`, `payment_events`. A bridge copies relevant
data into `core.payments_in`.

**Requirement:**

- Design bridge trigger or function that fires on relevant state
  transitions in existing payment tables
- When a `payment_requests` row reaches a "paid" state (or
  equivalent), the bridge:
  - Creates a `core.payments_in` row with appropriate scope
    (tenant_id from payment_requests.tenant_id or joined from
    the underlying entity)
  - source_type = 'ticket_purchase' or 'event_registration' etc.
    (agent determines from existing schema semantics)
  - source_id = payment_requests.id
  - amount_cents, currency, received_at from payment_requests
  - ledger_entry_id = NULL initially (populated when the ledger
    entry is created, if not already)
- Backfill: agent decides whether to backfill historical
  payment_requests into `core.payments_in` or only bridge new
  activity going forward
- Recommendation: **do backfill historical rows** so the substrate
  is complete. Backfill script walks payment_requests in
  timestamp order, creates payments_in rows.

**Acceptance criteria:**

- Bridge exists (trigger or function)
- New payment_request → paid state creates a corresponding
  payments_in row
- Historical backfill completes
- Row counts match: `SELECT COUNT(*) FROM payment_requests WHERE
  <paid condition>` matches `SELECT COUNT(*) FROM core.payments_in
  WHERE source_type = 'ticket_purchase'` (or the appropriate
  source_type)

**Verification query intent:**

- Test end-to-end: create test payment_request, transition to
  paid, verify payments_in row created
- Historical backfill count reconciliation
- Sample specific payment_request and confirm the derived
  payments_in row matches expected fields

**Reference:** Option 3a (conversation); ARCHITECTURE.md v2 §4.5

### R22: Payout bridge — `payout_requests` → `core.payments_out`

**Rationale:** Same principle as R21 for outgoing payments.
Existing payout tables continue to work; bridge copies to
substrate primitive.

**Requirement:**

- Similar bridge for payout_requests (and possibly for
  player_payouts if it holds records not in payout_requests)
- Backfill decision same as R21

**Note:** The paused cron `cron/process-payouts` complicates this.
Agent must be careful not to accidentally trigger paused payout
processing during the bridge implementation. The bridge should
observe state transitions that have already completed, not
initiate new ones.

**Acceptance criteria:**

- Bridge exists
- Historical backfill completes
- Row counts reconcile
- The paused cron remains paused (no accidental resume)

**Verification query intent:**

- Same pattern as R21
- Explicitly verify `process-payouts` cron still returns 200 with
  paused message post-migration

**Reference:** Option 3a; ARCHITECTURE.md v2 §4.6; conversation
context on paused cron

### R23: Participant bridge — `user_profiles` → `core.participants`

**Rationale:** MAJH Events users exist in `user_profiles`. As
`core.participants` becomes authoritative, existing users need
participant records for the MAJH Events tenant.

**Requirement:**

- For each user in `user_profiles` who is a MAJH Events tenant
  member (per organization_members or tenant_memberships), create
  a corresponding `core.participants` row
- role = derived from tenant membership role (probably 'staff' for
  admins/owners; 'user' or 'attendee' for members)
- user_id = user_profiles.id (which is auth.users.id)
- tenant_id = MAJH Events tenant ID
- contact_info = derived from user_profiles email, phone etc.
- Backfill script: agent writes the SQL

**Acceptance criteria:**

- Every MAJH Events tenant member has a participant record
- No duplicate participant records for the same user in the same
  tenant
- New user registration going forward creates both user_profiles
  and participants rows (agent updates registration flow or
  documents that this is application-level work)

**Verification query intent:**

- Count of user_profiles who are MAJH Events members should equal
  count of MAJH Events participants
- No duplicates: `SELECT user_id, COUNT(*) FROM core.participants
  WHERE tenant_id = <majh_events_id> GROUP BY user_id HAVING
  COUNT(*) > 1` returns empty
- Sample user's participant record has expected values

**Reference:** Option 3a; ARCHITECTURE.md v2 §4.3

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
- Immutability constraints prevent UPDATE/DELETE on ledger and
  audit_log
- Module registry seeded correctly
- Base vocabulary overlays exist
- MAJH Events tenant has expected `vocabulary_overlay_id` and
  `activated_modules`

Recommend structuring the verification as a series of `SELECT`
statements each returning `PASS` or `FAIL` with details, or a
psql script that produces a summary at the end.

**Acceptance criteria:**

- Verification script exists as `docs/PHASE_1_VERIFICATION.sql`
  (or as an appendix to `docs/PHASE_1_SCHEMA.md`)
- Every requirement R1-R23 has at least one verification query
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

---

## 4. Order of application

Phase 1 SQL should be applied in the following order. This
respects dependencies and allows verification checkpoints.

**Phase 1a (schemas and extensions):**

1. R1 — `core` schema
2. R2 — `platform` schema
3. R3 — `pgvector` extension

**Verification checkpoint:** Confirm schemas and extensions exist.

**Phase 1b (extend existing tables):**

4. R4 — `tenants` columns
5. R9 — `entities` columns
6. R10 — `ledger_entries` hash chain columns

**Verification checkpoint:** Confirm columns exist; existing data
intact; existing queries still work.

**Phase 1c (create substrate primitives):**

7. R5 — `core.participants`
8. R6 — `core.resources` and `core.entity_resources`
9. R7 — `core.payments_in`
10. R8 — `core.payments_out`
11. R12 — `core.ledger_accounts` (chart of accounts)

**Verification checkpoint:** All primitive tables exist with RLS.

**Phase 1d (create infrastructure tables):**

12. R13 — `core.vocabulary_overlays` (and seed base overlays; add
    FK on tenants.vocabulary_overlay_id)
13. R14 — `platform.modules` (and seed module registry)
14. R15 — `core.tenant_has_module()` function
15. R16 — `core.event_store`
16. R17 — `core.outbox`
17. R18 — `core.knowledge_vectors`

**Verification checkpoint:** Infrastructure in place; module
registry seeded; overlays seeded.

**Phase 1e (triggers and enforcement):**

18. R10 (continued) — hash chain trigger
19. R11 — immutability triggers on ledger_entries and audit_log

**Verification checkpoint:** Triggers work; UPDATE/DELETE fail on
protected tables.

**Phase 1f (RLS pattern establishment):**

20. R19 — apply standard four-level RLS pattern to all new tables

**Verification checkpoint:** RLS policies enforce isolation.

**Phase 1g (data reconciliation and backfill):**

21. R20 — `organization_members` completeness check and backfill
22. R23 — participant backfill from user_profiles
23. R21 — payment_in backfill from payment_requests
24. R22 — payment_out backfill from payout_requests
25. R10 (continued) — ledger_entries hash chain backfill

**Verification checkpoint:** Data reconciled; row counts match
expectations.

**Phase 1h (bridges for ongoing data flow):**

26. R21 (continued) — bridge trigger/function activated for new
    payment_requests
27. R22 (continued) — bridge for new payout_requests

**Verification checkpoint:** New activity produces substrate
records.

**Phase 1i (verification suite and rollback):**

28. R24 — verification suite executed end-to-end
29. R25 — rollback plan documented and reviewed

---

## 5. Handoff to drafting agent

### 5.1 What the drafting agent produces

- `docs/PHASE_1_SCHEMA.md` — the full SQL specification with
  each requirement translated into concrete DDL and DML, organized
  by the order in §4 above
- `docs/PHASE_1_VERIFICATION.sql` — the verification script per
  R24
- `docs/PHASE_1_ROLLBACK.md` — the rollback plan per R25
- `docs/PHASE_1_BACKFILL.md` — separate document detailing the
  backfill scripts for R20-R23 (per founder's earlier decision
  that backfill is separate from schema)

### 5.2 What the drafting agent must do first

Before writing any SQL, answer the "Must answer before drafting"
questions from Section 2 of the founder-provided question list.
Specifically:

- Q1-Q9 (membership and existing primitives)
- Q10-Q12 (ledger structure)
- Q17-Q18 (substrate table existence, schema decision)
- Q26 (user_profiles structure)
- Q31-Q32 (migration numbering and location)

### 5.3 What the drafting agent must escalate

The following decisions need founder confirmation:

- Schema namespace (`core` schema vs. `public` with prefix) — R1-R2
- Hash backfill approach (recommended: compute retroactively) —
  R10
- Whether to backfill historical payment_requests / payout_requests
  into substrate (recommended: yes) — R21, R22
- Chart of accounts seed values for MAJH Events tenant — R12
- Vocabulary overlay seed values (which industries, which specific
  mappings) — R13

### 5.4 What the drafting agent must review with Claude
(architectural PM)

Before applying to production:

- Full draft of `docs/PHASE_1_SCHEMA.md`
- Full draft of `docs/PHASE_1_VERIFICATION.sql`
- Full draft of `docs/PHASE_1_BACKFILL.md`

Architectural review confirms:

- Universal primitives match ARCHITECTURE.md v2 §4
- Four-level RLS enforces intended scope
- Hash chain matches ARCHITECTURE.md v2 §7.1
- Substrate/module boundary is respected
- Bridge patterns match Option 3a
- Nothing forecloses future modules or verticals

### 5.5 What the drafting agent must do before applying to
production

- Apply to Supabase branch first
- Run verification suite in branch
- Confirm MAJH Events tenant data unaffected (spot check)
- Confirm all tests pass
- Get founder final approval
- Merge to production during low-usage window
- Run verification suite in production
- Document actual outcomes (any deviations from expected)

---

## 6. What Phase 1.5 will address

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

Phase 1.5 requirements will be documented separately after Phase 1
is applied and verified. Phase 1 sets the substrate foundation on
which Phase 1.5 escrow work can safely land.

---

## 7. Companion documents

- `docs/ARCHITECTURE.md` v2.0.0 — technical source of truth
- `docs/CAPABILITY_MAP.md` v1.0.1 — substrate/module boundary
- `docs/STRATEGIC_DIRECTION.md` v1.1.1 — strategic frame
- `docs/ARCHITECTURE_OPEN_QUESTIONS.md` — deferred items
- `docs/AGENT_COLLABORATION_PROTOCOL.md` — how agent operates
- `docs/RALPH_BLUEPRINT.md` — Ralph's dependency on knowledge
  pool
- `docs/BACKLOG.md` (April) — historical T-numbered task context

---

*Requirements are what Phase 1 must accomplish. SQL is how it does
it. Verification queries are how we know it worked. Rollback is
what saves us if it didn't. All four matter.*
