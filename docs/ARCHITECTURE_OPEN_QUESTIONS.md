# MAJH OS — Architecture Open Questions

**Status:** Companion to `docs/ARCHITECTURE.md`. Captures architectural
concerns raised during review but deferred to future work because they
address problems that don't exist yet, address concerns that would be
premature to bake into the architecture, or represent implementation
detail that belongs in schema/module design docs rather than
architecture.

**Purpose:** Prevent legitimate concerns from being lost. When the
conditions that make each concern real emerge, this document is where
future-us and future-agents look to remember what was already considered.

**Last updated:** June 25, 2026

**Version:** 1.0.0

---

## How to read this document

Each open question includes:

- **Concern:** What the reviewer raised
- **Raised by:** Which reviewer (Kimi, ChatGPT, another AI, or founder)
- **Deferred because:** Why we chose not to bake it into current
  architecture
- **Revisit when:** The specific condition that would make it worth
  addressing
- **What to do when revisiting:** Concrete guidance for the future
  effort

Deferral is not rejection. Every item here represents a legitimate
concern. The question is timing.

---

## Q1: Global Resource Identifier (GRI) system for polymorphic linkage

**Concern:** The architecture uses `source_type` + `source_id` UUID
pairs for polymorphic linkage (escrow to its underlying entity,
financial intents to their source module event, etc.). This works but
lacks explicit format enforcement and cross-schema safety guarantees.

A reviewer proposed a Global Resource Identifier (GRI) system with
domain-constrained TEXT format like `gri:tenant_id:module:resource_id`,
enforced by Postgres domain constraints, with a central
`core.polymorphic_targets` registry table that the substrate references
instead of module tables directly.

**Raised by:** External AI reviewer (Google/Gemini variant), tightening
§7.2 escrow design.

**Deferred because:**

- UUID with `source_type` + `source_id` accomplishes the same job with
  less ceremony
- The GRI format would require every module to register its resource
  types in a global namespace before creating any records — additional
  coordination overhead for minimal near-term benefit
- The concern (substrate accidentally referencing a module's private
  table structure) is addressed by the opaque data payload contract in
  §7.2 and the RLS module activation predicate in §12.4
- Adopting GRI now means retrofitting when we build the schema; the
  cost is not trivial

**Revisit when:**

- Second external MAJH OS tenant is live and we see multiple modules
  needing to reference each other's records safely
- Or: an implementation bug traces back to substrate accidentally
  interpreting a module's `source_id` incorrectly
- Or: cross-module analytics require querying polymorphic linkages at
  scale

**What to do when revisiting:**

- Evaluate whether `source_type` string values are being used
  consistently
- If yes, consider a lighter approach: enum on `source_type`
  registered per module at activation time
- If GRI is still warranted, migrate `source_id` UUID columns to a
  domain-constrained TEXT column with `gri:tenant:module:uuid` format;
  add a `core.polymorphic_targets` registry

---

## Q2: Fully decoupled per-module database migrations

**Concern:** All migrations currently run through a single global
tracking table. A reviewer proposed isolating migrations per module
(each module has its own `modules/{name}/db/migrations/` folder and
its own `{module_name}._schema_migrations` tracking table), with a
platform CLI runner (`majh-cli migrate --module=tournament`) so a
change to the church module never touches the broadcast module's
database structure.

**Raised by:** External AI reviewer, tightening §6.

**Deferred because:**

- Current scale is one repo, one Supabase project, one migration path.
  Global tracking is sufficient
- Per-module migration isolation solves a real problem — but it's a
  problem at scale (many modules, many tenants, coordinated
  deployments), not a problem now
- Introducing it now means training every agent on the CLI, updating
  the multi-agent collaboration protocol, and adding CI complexity
  before any of it is needed
- Substrate/module boundary is already enforced at the schema
  namespace level, which gives us most of the isolation benefit

**Revisit when:**

- Number of active modules exceeds ~4 and migration coordination
  becomes visibly painful
- Or: a module change accidentally breaks another module's schema
- Or: tenant self-service module activation requires zero-downtime
  migration on demand

**What to do when revisiting:**

- Introduce module-scoped migration folders alongside global ones
- Add per-module tracking tables in each module's schema
- Update CI to run substrate migrations first, then modules in
  dependency order
- Update `AGENT_COLLABORATION_PROTOCOL.md` to reflect the new
  migration boundary
- Ensure rollback for a single module leaves substrate and other
  modules untouched

---

## Q3: Dual-key RLS for knowledge pool cross-module semantic isolation

**Concern:** The knowledge pool is a shared vector store. Without
strict per-module scoping, semantic search could return, say, a
finance document in response to a tournament question, causing
context bleed and potential data leakage.

A reviewer proposed a dual-key RLS policy that combines tenant
identity with an `origin_module` filter checked against
`current_setting('app.activated_modules')::text[]`, plus mandatory
`WHERE origin_module = 'tournament'` filters when Ralph invokes a
tournament tool.

**Raised by:** External AI reviewer, tightening §11.3 Ralph knowledge
pool access.

**Deferred because:**

- No knowledge pool built yet. The concern is real but not immediate.
- The `origin_module` column is already in the architecture (§11.3
  mentions filtering by it for Ralph)
- The dual-key RLS mechanism can be added when the knowledge pool is
  built without needing architectural commitment now

**Revisit when:**

- Knowledge pool is designed (imminent, per `RALPH_BLUEPRINT.md`
  Phase 6 or when the first module contributes documents beyond
  substrate defaults)
- Or: a Ralph query in testing returns cross-module content
  inappropriately

**What to do when revisiting:**

- Bake `origin_module` into the `core.knowledge_vectors` table
  schema
- Add the dual-key RLS policy as designed
- Ensure Ralph's tool implementations set the module context on the
  session before running vector searches
- Document the pattern in `docs/KNOWLEDGE_POOLS.md` when that doc is
  written

---

## Q4: Automatic module-specific escrow liability account codes

**Concern:** A reviewer proposed that the substrate auto-provision
module-specific escrow liability account codes (2200 general, 2201
tournament, 2202 construction, etc.) as part of tenant chart-of-
accounts default setup.

**Raised by:** External AI reviewer, tightening §7.2 escrow-ledger
integration.

**Deferred because:**

- Chart of accounts is inherently tenant-specific. Prescribing
  account codes at the substrate level assumes tenants want an
  accountant's chart structure. Some tenants (small business,
  non-accounting owners) explicitly don't
- Module-specific default account templates can be registered by
  modules at activation time (the architecture already supports
  this via §6.4 "module registers default templates")
- The specific numbering scheme (2200, 2201, 2202) is US-accounting-
  standard; not universal across jurisdictions

**Revisit when:**

- First finance module implementation needs a concrete decision on
  what defaults to use
- Or: multiple modules are activated for the same tenant and account
  code collisions occur

**What to do when revisiting:**

- Design the module escrow account mapping table
  (`platform.module_escrow_account_mapping`) as substrate schema
- Let modules register their preferred account name suffixes at
  activation
- Substrate assigns codes from a reserved range per module,
  preventing collisions
- Allow tenants to override the module-suggested codes and names via
  the finance module UI

---

## Q5: Renaming "escrow" to `commitment_accounts` or `reserved_funds`

**Concern:** "Escrow" has specific legal meaning as a service provided
by a licensed escrow agent. Using the term when we are not an escrow
agent risks legal confusion.

A reviewer proposed renaming the substrate mechanism entirely to
`commitment_accounts` or `reserved_funds` to avoid the terminological
overlap.

**Raised by:** ChatGPT review of §7.2.

**Deferred because:**

- Founder preference to keep "escrow" as the developer-facing
  abstraction with an explicit operational-not-custodial disclaimer
- The disclaimer is now prominent in §7.2 (the terminology
  clarification paragraph)
- Renaming would affect every substrate reference, every module
  reference, every doc — extensive churn for terminological
  precision that the disclaimer already provides
- Terms of service and legal documents will use precise language;
  the developer-facing term can remain

**Revisit when:**

- Terms of service drafting reveals the "escrow" terminology
  creates legal review complications
- Or: an actual regulatory inquiry references the term

**What to do when revisiting:**

- If renaming becomes necessary, do it as a comprehensive migration
  (all code, all docs, all comments) rather than partial
- Keep "escrow" as an alias in the module code for backward
  compatibility with any external integrations that may have adopted
  the term

---

## Q6: Approval workflows as a substrate service rather than finance
module feature

**Concern:** ChatGPT's review of §8 raised approval workflows (bill
above $5,000 requires manager + finance approval) as an operational
capability that could belong at the substrate level rather than as a
finance module feature.

**Raised by:** ChatGPT review of §8.

**Deferred because:**

- Only one module currently needs approval workflows (finance)
- Building substrate approval infrastructure for one consumer is
  over-engineering
- The concern that multiple modules will eventually need approvals
  (construction change orders, tournament payout releases, retail
  inventory adjustments) is real but not present-tense

**Revisit when:**

- Second module (probably construction or tournament) needs approval
  workflows and the pattern from finance would need to be duplicated
- Or: cross-module approval flows are required (a construction change
  order that requires both project manager and finance approval)

**What to do when revisiting:**

- Extract the approval workflow pattern from the finance module into
  a substrate service (`core.approval_workflows` table, generic
  approval state machine, module-registered approval requirements)
- Migrate finance module bills to use the substrate service
- Enable construction, tournament, and others to consume the same
  service

---

## Q7: Purchase orders and fixed assets in finance module

**Concern:** ChatGPT's review of §8 flagged Purchase Orders (PO →
Goods Received → Vendor Bill → Payment) and Fixed Assets (depreciation,
asset register) as operational finance capabilities eventually needed
for hospitality, construction, and retail tenants.

**Raised by:** ChatGPT review of §8.

**Deferred because:**

- Not needed for Phase 1 (invoice + AR is enough for MAJH Events
  tenant operations)
- Not needed for Phase 2 (AP + reconciliation is the next-tier need)
- Purchase orders naturally fit Phase 3 or 4 when a tenant needs
  formal purchasing controls
- Fixed assets fit Phase 4 or 5 when construction or hospitality
  tenants have operational depth requiring depreciation tracking

**Revisit when:**

- Construction tenant onboards and formal purchasing controls become
  a requirement
- Or: hospitality tenant needs equipment depreciation tracking
- Or: tax capabilities in Phase 5 require asset schedules

**What to do when revisiting:**

- Add as Phase 3+ additions to §8 of the architecture doc
- Purchase orders extend the bill workflow with a pre-bill approval
  and receipt stage
- Fixed assets is its own module submodule with depreciation
  schedules

---

## Q8: Transactional stored procedure for atomic escrow release

**Concern:** A reviewer proposed a specific PostgreSQL stored
procedure (`core.pr_execute_escrow_release`) that atomically updates
escrow state, writes balanced ledger entries, and queues an outbox
instruction to Stripe — all within a single database transaction.

**Raised by:** External AI reviewer, tightening §7.2.

**Deferred because:**

- Architecture doc describes what the escrow-ledger bridge does
  (§7.2). The specific implementation (stored procedure vs.
  application-layer transaction with careful ordering) belongs in
  `docs/PHASE_1_SCHEMA.md` or the escrow service implementation
- The stored procedure pattern is a valid implementation but not the
  only one; application-layer transactions with proper isolation
  levels achieve the same guarantees
- Committing to a specific implementation pattern in architecture
  constrains future refactoring

**Revisit when:**

- Building the escrow-ledger bridge implementation
- Choosing between stored procedure and application-layer
  transactional patterns

**What to do when revisiting:**

- Evaluate stored procedure vs. application-layer approach against
  team familiarity with pl/pgsql, testability requirements, and
  ORM/query-builder integration
- Document the choice in `docs/PHASE_1_SCHEMA.md`
- Ensure the chosen approach satisfies the ten escrow invariants in
  §7.2

---

## Q9: Multi-currency exchange rate service

**Concern:** ChatGPT's review of §8 flagged that Barbados + US
operations require real multi-currency handling: exchange rates,
reporting currency, transaction currency, revaluation.

**Raised by:** ChatGPT review of §8. Founder also flagged this
implicitly by mentioning "Given Barbados + US operations."

**Deferred because:**

- Phase 1 records native currency correctly, which is sufficient for
  Phase 1 reporting (single-currency P&L per department, per
  location)
- Phase 2 or 3 adds manual exchange rate entry
- Phase 4 adds automatic rate fetching
- Full multi-currency handling (revaluation, unrealized gains/losses)
  fits Phase 4 or 5

**Revisit when:**

- Tenant needs cross-currency reporting in a single view
- Or: automated rate fetching is planned for implementation

**What to do when revisiting:**

- Design an exchange rate service that fetches from a public source
  (Open Exchange Rates, ECB, similar) with tenant override capability
- Store historical rates so retroactive reporting produces stable
  numbers
- Add currency revaluation workflow for period-end close

---

## Q10: JSON Schema validation for escrow `data` payload

**Concern:** Kimi's tightening of §7.2 proposed that modules register
JSON Schema for their `data` payload and the substrate validate
against it. Currently the architecture describes `data` as an opaque
payload that only the owning module reads.

**Raised by:** Kimi review of §7.2.

**Deferred because:**

- Substrate validating module-specific JSON Schema would require
  substrate to understand module semantics — a boundary violation
- Modules validating their own `data` before writing achieves the
  same integrity guarantee without cross-boundary coupling
- The schema registration mechanism (§7.2 mentions
  `platform.module_escrow_schemas` as forthcoming) can be
  documentation-only for now; enforcement can come later if
  needed

**Revisit when:**

- A module's `data` payload structure changes in a breaking way and
  migration coordination is needed
- Or: cross-module analytics need to query escrow `data` fields
  safely

**What to do when revisiting:**

- Build `platform.module_escrow_schemas` as a registry
- Allow modules to publish their `data` schemas
- Provide a substrate helper `validate_escrow_data(module_name,
  data)` that modules can call before writes
- Do not enforce validation at the substrate row-write level —
  keep it as a module-side discipline

---

## Q11: Financial intents pattern audit-log integration

**Concern:** The financial intents pattern (§8.3) mentions audit log
integration implicitly (via the substrate ledger service writing to
the audit log). This could be more explicit.

**Raised by:** Kimi review of §8.

**Deferred because:**

- The pattern description in §8.3 covers the essential flow
- Detailed audit integration is implementation detail for the
  substrate ledger service, not architecture

**Revisit when:**

- Building the substrate ledger service implementation
- Or: audit requirements from a tenant compliance need mandate a
  specific format

**What to do when revisiting:**

- Document the audit event types generated by financial intents
  (`intent.created`, `intent.validated`, `intent.executed`,
  `intent.failed`)
- Ensure MFA verification is captured on intents that required it
- Include the linked_transaction_id in audit events for traceability

---

## Q12: Period locking as a substrate primitive

**Concern:** Phase 3 of the finance module includes period locking
(month-end close). ChatGPT's review noted this is important
operational governance. The question is whether period locking is
a finance module feature or a substrate primitive that other modules
might also need (locking a fiscal period, an event window, a
production run).

**Raised by:** ChatGPT review of §8.

**Deferred because:**

- Only finance module needs it in Phase 3
- Substrate-level period locking would be over-engineering for one
  consumer
- Can be extracted later if other modules need similar patterns

**Revisit when:**

- Second module needs period locking (construction closing project
  cost centers, tournament closing season windows)

**What to do when revisiting:**

- Extract the period locking mechanism into a substrate service
  (`core.locked_periods` with scope: tenant, department, module,
  date range)
- Migrate finance to use the substrate service

---

## Q13: Formal invariants for other substrate primitives

**Concern:** §7.2 introduces an invariants list for escrow. A
reviewer suggested every substrate primitive should have similar
formal invariants documented.

**Raised by:** ChatGPT review of §7.2.

**Deferred because:**

- Escrow's invariants are particularly important because it involves
  money and complex state
- Other primitives (Entity, Participant, Resource) have simpler
  discipline that's implicit in the RLS strategy and substrate/module
  boundary
- Writing formal invariants for every primitive is valuable but not
  urgent

**Revisit when:**

- Preparing for a serious security or compliance audit that expects
  formal invariants
- Or: implementing critical primitive-level tests

**What to do when revisiting:**

- Add invariant sections to §4 (universal primitives) covering
  Entity, Participant, Resource, Payment In, Payment Out
- Add invariants to §7.1 (ledger) covering append-only, hash chain,
  balance requirements
- Consider a test suite that verifies invariants hold across
  operations

---

## How this document evolves

- New concerns get added as they're raised in review
- When a concern is addressed (either by architecture change or by
  implementing the deferred item), it moves to a resolved section at
  the bottom with a note about when and how
- If a concern is decided to be permanently out of scope (not just
  deferred), it moves to a rejected section with the rationale

Nothing gets deleted from this document. Deferred, resolved, or
rejected — all history stays for future context.

---

## Companion documents

- `docs/ARCHITECTURE.md` — the current architectural commitments
- `docs/STRATEGIC_DIRECTION.md` — the strategic frame these
  concerns exist within
- `docs/CAPABILITY_MAP.md` — the substrate/module boundary these
  concerns are bounded by
- `docs/AGENT_COLLABORATION_PROTOCOL.md` — how new concerns should
  be raised, evaluated, and either addressed or added here

---

*Some concerns are urgent. Others are legitimate but not urgent.
This document is where the not-urgent-yet lives, so it doesn't
become the wasn't-considered-at-all.*
