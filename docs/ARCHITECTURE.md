# MAJH OS — Architecture

**Status:** Authoritative. This document is the technical source of truth for
the MAJH OS platform: the four-level hierarchy, universal primitives, module
system, financial spine, adapter framework, RLS strategy, and how it all fits
together. When code and this document disagree, the document is right and the
code is wrong.

**Last updated:** June 25, 2026

**Version:** 2.1.0 (UI surfaces section added; sections 14-17 renumbered)

**Supersedes:** `docs/ARCHITECTURE.md` v1.x (April 28, 2026). The prior
document remains in the repo as historical reference. Where it and this
document conflict, this document wins. Where it goes into operational detail
this document doesn't repeat (Stripe integration patterns, community surface
decisions, specific tech-stack rationale), the prior document remains
authoritative for that detail and is cross-referenced in-line below.

**Owner:** Founder (changes require explicit decision, not agent prompts)

**Review cadence:** Monthly, or whenever a substantial architectural
commitment is made.

---

## 1. What this document is (and is not)

This document describes:

- The technical architecture of MAJH OS: how the platform is structured at
  the database, application, and service layer
- How the four-level hierarchy (Platform → Tenant → Department → Location)
  is expressed in schema and enforced in RLS
- The six universal primitives that every tenant's data lives in
- The module system that layers vertical-specific capabilities on top of the
  substrate
- The financial spine (ledger, escrow, native finance module) and its
  compliance boundary
- The adapter framework for absorbing external tool data
- The event store and outbox for cross-module communication
- Where Ralph plugs into the architecture
- How sovereignty and portability are preserved in the tech stack
- What is built, what is designed, and what is not started

This document does NOT describe:

- The strategic why (see `docs/STRATEGIC_DIRECTION.md`)
- The substrate/module quick-reference decision tree (see
  `docs/CAPABILITY_MAP.md`)
- The specific SQL for Phase 1 substrate (see `docs/PHASE_1_SCHEMA.md`)
- The Ralph build sequence (see `docs/RALPH_BLUEPRINT.md`)
- Task-level tracking (see `docs/BACKLOG.md`)
- The multi-agent coordination workflow (see
  `docs/AGENT_COLLABORATION_PROTOCOL.md`)

## 2. Non-negotiable principles

These do not change based on convenience, time pressure, or agent
enthusiasm.

### 2.1 Financial integrity

The financial ledger is append-only, hash-chained, and immutable. Corrections
happen via balancing entries that reference the original transaction.
Application-level users cannot rewrite history.

Every ledger entry includes the cryptographic hash of the previous entry. If
the application layer attempts to write inconsistent data, the chain breaks
and the system flags it immediately. The hash chain is tamper-evident, not
tamper-proof: a database administrator with full storage access could
recompute hashes. The chain protects against accidental corruption, silent
application bugs, and honest mistakes.

Multi-factor authentication is required for any ledger amendment. The MFA
result is logged alongside the amendment. The platform operator (including
the founder) cannot unilaterally modify any tenant's ledger even with
database access — the application-layer write path requires tenant MFA.

Every payment-touching feature routes through the ledger. Module-specific
tables (`tournament_payments`, `ticket_orders`, F&B tabs, invoices from the
native finance module) are read models and operational tables, not sources
of truth. They exist for convenience and performance; they do not authorize
any movement of money.

### 2.2 Data sovereignty

Every tenant owns their data. Every tenant can export everything at any
time. Every tenant can request full deletion. We do not train
platform-wide AI on tenant data without explicit consent.

Cross-tenant queries are denied at the database level via RLS, not just at
the application level. A tenant cannot read or write another tenant's
records even if application code fails to filter correctly.

### 2.3 Security discipline

Row-Level Security is enabled on every user-facing table with explicit
policies. INSERT policies always have a `with_check` predicate that ties
inserted rows to the authenticated user; the pattern `with_check = true` is
forbidden except for policies scoped explicitly to service_role (which
bypasses RLS by design).

Service-role usage is restricted to:
- Webhook handlers (Stripe, Mux, external adapters)
- Scheduled jobs (cron endpoints, using `lib/cron-auth.ts` with both Bearer
  and Vercel Cron auth)
- Admin-only server actions where the calling user has been verified as
  staff via `organization_members`

A server action that takes user input and writes to a financial table using
the service-role key is a bug.

The append-only audit log has INSERT permitted to specific roles and
UPDATE/DELETE denied at the trigger level. To reverse a decision, insert a
compensating row. Never modify history.

### 2.4 Compliance boundary

**MAJH OS is a record-keeping, orchestration, and analysis tool. It is not
a financial institution.** The platform records business events, executes
software-defined workflows against external regulated services, and
provides operational analysis. It does not take custody of customer funds,
facilitate lending, provide advice, or certify statements.

**Fund custody.** MAJH OS does not take custody of customer funds.
Monetary assets remain under the control of regulated payment providers
(Stripe Connect and equivalents) or tenant-controlled financial accounts
(the tenant's own bank via Plaid when Phase 2 of the finance module ships,
manual settlement flows outside the platform). Where modules maintain
operational balances or ledger representations of value, those records are
**informational** — they represent the platform's view of what has
happened, not custody of the underlying money.

**Programmatic orchestration, not custody.** The platform's "escrow"
mechanism (see §7.2) is a state machine that tracks conditions and
triggers programmatic release instructions. Actual funds remain in the
regulated payment ecosystem at all times. MAJH OS provides the discipline
(state transitions, ledger entries, audit trail); the payment provider
provides the custody and settlement. The tenant assumes legal liability
for the regulatory compliance of their automated release structures.

**Not a lender.** MAJH OS does not facilitate loans, credit, buy-now-
pay-later, or any lending product. Where a tenant extends credit terms to
their own customers as part of their business (a construction firm
allowing 30-day payment terms on invoices, for example), that credit
relationship exists between the tenant and their customer — not between
the platform and anyone. The platform records the terms; the tenant bears
the credit risk.

**Not a money transmitter.** Stripe (and future payment providers)
handles payment processing under its own regulatory umbrella. MAJH OS
integrates with Stripe but does not become a payment facilitator itself.
Money flows tenant → Stripe → destination, not tenant → MAJH OS → Stripe
→ destination.

**Not an advisor.** MAJH OS does not provide accounting, tax, or legal
advice. The finance module provides operational tools; the tenant is
responsible for how they use them. Reports generated by MAJH OS are
operational documents, not audited financial statements. Turning them
into filings, statements, or certifications is the tenant's work,
typically in collaboration with the tenant's CPA or accountant.

**Trust boundary.** MAJH OS records, automates, and analyzes business
operations but does not establish legal truth. The platform assumes that
authenticated users and integrated external systems provide accurate
information. Where verification services exist (bank feed reconciliation,
Stripe transaction lookup, third-party audit), they augment — but do not
replace — the tenant's responsibility for the accuracy of their records.

**Data classification is the tenant's responsibility.** MAJH OS
guarantees logical multi-tenant isolation at the database layer via
Row-Level Security. The classification of data entered into the platform
is the tenant's duty. Tenants must not input regulated data (HIPAA-
covered Protected Health Information, PCI-scoped raw cardholder data)
into core substrate primitives, knowledge pools, or unstructured fields
unless a specific certified vertical module is explicitly activated for
that purpose. No such module currently exists; when one does, its
activation will require documented compliance certification.

**Audit responsibility is shared.** The platform provides immutable
ledger entries, an append-only audit log, and access records. The tenant
is responsible for reviewing those artifacts to detect internal fraud,
unauthorized employee access, or compliance breaches within their
organization. The platform does not monitor tenant behavior for
regulatory compliance on the tenant's behalf.

**Platform's own compliance responsibilities.** The platform is
responsible for compliance obligations attaching to *how the platform
operates*:

- Authentication and authorization discipline
- Encryption at rest and in transit
- Audit logging integrity
- Backup and disaster recovery
- Tenant isolation (RLS, tenant-scoped authorization, controlled data
  access)
- API security
- Privacy controls and data subject rights (GDPR/CCPA data export and
  deletion)
- Infrastructure monitoring
- Secure software development lifecycle
- Reasonable steps toward eventual SOC 2 readiness as revenue supports
  the audit process

**Tenant's own compliance responsibilities.** The tenant is responsible
for compliance obligations attaching to *how they run their business*:

- Tax filing and remittance in every jurisdiction they operate in
- Business licensing and permits
- Industry-specific regulation (HIPAA for healthcare, PCI DSS if the
  tenant handles cards directly outside of Stripe's environment, state
  and federal financial reporting)
- Employment law compliance (payroll, benefits, workers' compensation)
- Consumer protection obligations to their own customers
- Contract terms with their vendors, employees, and customers
- Data classification decisions about what they put into the platform

**Terms of service and privacy documents will explicitly disclaim
financial-institution status and codify this shared-responsibility
model.** Producing those documents is a legal task pending, not covered
by this document. Until they exist, platform operations proceed with the
architectural discipline described here.

### 2.5 Substrate/module boundary

Substrate is universal, vertical-agnostic, and serves every tenant. Modules
are vertical-specific, feature-flagged, and activated per tenant.

The substrate contains:

- The six universal primitives (`tenants`, `entities`, `participants`,
  `resources`, `payments_in`, `payments_out`)
- Auth and organization membership (`organization_members` as canonical
  source of truth)
- Financial ledger (append-only, hash-chained)
- Escrow accounts (with polymorphic source linkage)
- Knowledge pools (per-tenant vector storage)
- Vocabulary overlay system (the rendering pipeline)
- Adapter framework (the pattern; specific adapters are modules)
- Event store and outbox (message bus infrastructure)
- Module registry and feature flag system
- Audit log (append-only)

Modules contain everything else: bracket generation logic (tournament
module), sermon series planning (church module), invoicing and AR (finance
module), room block management (hospitality module), and so on.

Full detail and forbidden patterns in `docs/CAPABILITY_MAP.md`.

### 2.6 Honest documentation

Every architectural decision documented in a dated decision record. Every
gap between architecture and reality named explicitly (see §14). Every
commit message tells the truth about what was and wasn't done.

Documentation that describes capability as complete when it isn't is worse
than no documentation. If reality falls behind the document, either update
the document to reflect reality or update the code to match the document —
do not let the gap persist unnamed.

## 3. The four-level hierarchy

Every organization that could use MAJH OS operates in some version of this
hierarchy. The substrate expresses it in schema; the RLS system enforces it;
the application renders it.

```
Platform (MAJH OS)
    │
    ├── Tenant A (MAJH Events)
    │       │
    │       ├── Department A1 (MAJH Esports)
    │       │       └── Location A1a (Digital)
    │       │
    │       ├── Department A2 (CarBarDMV)
    │       │       └── Location A2a (DC Metro region)
    │       │
    │       ├── Department A3 (Tradewinds RB)
    │       │       ├── Location A3a (Barbados HQ)
    │       │       └── Location A3b (St. Lucia Hub)
    │       │
    │       └── Department A4 (TRS)
    │               └── Location A4a (Barbados Airport Kiosk)
    │
    ├── Tenant B (Construction firm, target)
    │       └── Departments and Locations per that tenant's needs
    │
    └── Tenant N (future tenants)
            └── Departments and Locations per those tenants' needs
```

### 3.1 Level definitions

**Platform:** MAJH OS itself. Configuration, module registry, cross-tenant
analytics for operator use, platform administration.

**Tenant:** An organization using the platform. Has a brand, an active
vocabulary overlay, a set of activated modules, a Stripe Connect account
(when finance module is active), and users organized via
`organization_members`.

**Department:** A unit within a tenant with its own P&L, staff, workflows,
and optionally its own set of activated modules. Departments are the
natural boundary for departmental reporting (a MAJH Events department can
have its own P&L; a construction tenant's Residential vs. Commercial
departments can have separate reporting).

**Location:** A physical or logical place where a department operates.
Locations carry geographic, regulatory, and inventory context. A department
can operate at multiple locations; a location belongs to exactly one
department.

### 3.2 Data scoping across the hierarchy

Every substrate primitive carries scope columns:

- `tenant_id` — required on every operational table
- `department_id` — required on tables where department-level scoping
  matters (entities, financial transactions, most operational data)
- `location_id` — required on tables where location matters (entities that
  happen somewhere, resources that live somewhere, financial transactions
  attributable to a location)

Some data is tenant-wide (participants, knowledge pool documents that apply
across departments, tenant-level configuration). Some data is
department-scoped (entities like a specific tournament, resources like a
specific streaming station, financial entries for a department's
transactions). Some data is location-scoped (physical inventory at a
specific kiosk, staff shifts at a specific location, entities that occur
at a specific location).

The `department_id` and `location_id` columns are nullable at the table
level; a NOT NULL constraint is enforced only where the scope must be
known. This lets tenant-wide records exist without department or location
attribution.

### 3.3 Reconciliation with the May 18 tenant model

The April `ARCHITECTURE.md` decision log records (May 18, 2026) that the
four-level model was schema-designed but not yet wired into application
authorization: *"Schema supports four-level model. Application
authorization currently checks tenant-scoped roles only; department and
location scoping is schema-ready but not wired."*

Task T-200 (Financial scoping) added `department_id` and `location_id` to
`ledger_transactions` and `ledger_entries` and rewrote `v_financial_summary`
to support department aggregation. This is confirmed complete per BACKLOG.

The application-layer authorization work to fully wire department-and-
location scoping is task T-204 (Authorization migration — checkPermission
function, page-by-page migration of 144 check points). This is not yet
complete. Until it is, department and location scoping is enforced by RLS
at the database level, but application logic may not check it consistently.

Any agent building new features must:
1. Include `department_id` and `location_id` on new operational tables
   where they're meaningful
2. Use the (forthcoming) `checkPermission` helper at API boundaries once
   T-204 lands
3. Ensure RLS policies check the four-level scope where appropriate

## 4. Universal primitives

Every tenant operates on the same six primitives. Domain-specific data
lives in JSONB columns adjacent to these primitives, not in the primitives
themselves. The relational core stays clean and universal.

Conceptual specs below. Actual SQL specification lives in
`docs/PHASE_1_SCHEMA.md`.

### 4.1 Tenant

The `tenants` table stores the organization itself. Core columns:

- `id` (UUID, primary key)
- `slug` (unique short identifier for URLs and internal references)
- `name` (display name)
- `industry_type` (enum or reference to the vocabulary overlay used by
  default: EVENTS, CONSTRUCTION, CHURCH, LABEL, HOSPITALITY,
  PROFESSIONAL_SERVICES, and extensible)
- `vocabulary_overlay` (JSONB — the overlay configuration, or a reference
  to a named overlay in a separate `vocabulary_overlays` table)
- `activated_modules` (array or JSONB — which modules are active for this
  tenant; drives feature flag behavior)
- `region` and `default_currency` (geographic and financial defaults)
- `stripe_connect_account_id` (when the tenant has completed Stripe
  onboarding; nullable)
- `plan_tier` (subscription tier for the tenant's platform subscription)
- Standard audit columns (`created_at`, `updated_at`, `deleted_at`)

### 4.2 Entity

`entities` holds anything a tenant is tracking. Universal at the
foundation; labeled at the surface via vocabulary overlay.

Core columns:

- `id` (UUID, primary key)
- `tenant_id` (required, FK to tenants)
- `department_id` (nullable, FK to departments)
- `location_id` (nullable, FK to locations)
- `type` (string — indicates which entity variant, e.g. `tournament`,
  `project`, `campaign`, `service_job`, `reservation`, `sale`, `broadcast`,
  `service` (as in worship service), `release`)
- `name` (display name)
- `status` (string — module-defined states; substrate does not enforce a
  specific state machine)
- `data` (JSONB — domain-specific attributes; bracket data for tournaments,
  milestone structure for construction projects, sermon series metadata
  for church services, etc.)
- `parent_entity_id` (nullable, self-referencing — allows entity hierarchy
  where useful; e.g. a season contains tournaments, a project contains
  phases)
- Standard audit columns

Modules define what `type` values they use and what shape the `data` JSONB
takes for entities of that type. The substrate does not enumerate valid
types; the module registry is where that lives.

### 4.3 Participant

`participants` holds anyone involved with a tenant's operations.

Core columns:

- `id` (UUID, primary key)
- `tenant_id` (required)
- `user_id` (nullable, FK to `auth.users` when the participant is a
  platform user; null when the participant is a person the tenant tracks
  who has no platform account)
- `role` (string — participant role, e.g. `player`, `crew_member`,
  `client`, `guest`, `congregant`, `artist`, `subcontractor`, `staff`)
- `contact_info` (JSONB — email, phone, address, per privacy needs)
- `data` (JSONB — role-specific attributes; player skill rating, client
  billing preferences, congregant volunteer availability)
- Standard audit columns

The `user_id` distinction matters: participants with platform accounts can
log in, receive Ralph queries, appear in the tenant's user management UI.
Participants without platform accounts are records only; the tenant tracks
them but they don't have access.

An `entity_participants` join table links participants to entities
(a player registered for a tournament, a crew member assigned to a
broadcast, a client on a construction project).

### 4.4 Resource

`resources` holds anything a tenant schedules, allocates, or consumes
against entities.

Core columns:

- `id` (UUID, primary key)
- `tenant_id` (required)
- `department_id` (nullable)
- `location_id` (nullable — resources often live at a specific location)
- `type` (string — e.g. `streaming_station`, `construction_equipment`,
  `sanctuary_room`, `hotel_room`, `staff_shift`, `studio_time`,
  `service_bay`, `kiosk`, `av_equipment`)
- `name` (display name)
- `capacity` (numeric — e.g. seats, hours, units; module interprets meaning)
- `availability_windows` (JSONB — when the resource is available; module
  interprets format)
- `data` (JSONB — resource-specific attributes)
- Standard audit columns

An `entity_resources` join table links resources to entities they're
allocated to, with time bounds (a streaming station allocated to a
tournament from 3pm to 7pm on a specific date).

### 4.5 Payment In

`payments_in` holds every incoming payment attribution. This is a read
model of the ledger for query convenience; the ledger remains source of
truth.

Core columns:

- `id` (UUID, primary key)
- `tenant_id` (required)
- `department_id` (nullable — for departmental revenue attribution)
- `location_id` (nullable — for location-level revenue attribution)
- `source_type` (polymorphic — e.g. `tournament_entry`, `ticket_purchase`,
  `service_invoice`, `tithe`, `merchandise_sale`, `event_deposit`,
  `royalty_receipt`)
- `source_id` (UUID — the ID of the underlying entity/transaction)
- `amount_cents` (integer, always in smallest currency unit)
- `currency` (three-letter code)
- `payer_id` (nullable, FK to participants — who paid, when known)
- `stripe_payment_intent_id` (nullable — for payments processed via
  Stripe)
- `ledger_entry_id` (FK to the ledger entry that is the source of truth
  for this payment)
- `received_at` (timestamp)
- Standard audit columns

### 4.6 Payment Out

`payments_out` holds every outgoing payment attribution. Mirror structure
to `payments_in`.

Core columns:

- `id` (UUID, primary key)
- `tenant_id` (required)
- `department_id` (nullable)
- `location_id` (nullable)
- `source_type` (polymorphic — e.g. `tournament_prize`, `subcontractor_draw`,
  `mission_support`, `royalty_payment`, `vendor_invoice_payment`,
  `staff_wage`)
- `source_id` (UUID)
- `amount_cents` (integer)
- `currency` (three-letter code)
- `payee_id` (nullable, FK to participants — who was paid, when known)
- `stripe_transfer_id` (nullable — for payouts processed via Stripe
  Connect)
- `ledger_entry_id` (FK to the ledger entry that is source of truth)
- `sent_at` (timestamp)
- Standard audit columns

### 4.7 What is NOT a primitive

The following are frequently mistaken for primitives but belong in modules:

- Tournaments (a type of Entity — the `type` column is `tournament` and
  the tournament module operates on entities of that type)
- Reservations (a type of Entity)
- Invoices (a construct of the finance module built on top of Payment In
  and Payment Out records)
- Escrow accounts (a substrate-level primitive but not one of the six
  above — see §7.2)
- Users (users belong to `auth.users` at the Supabase level and are
  linked to tenant-scoped records via `organization_members` and
  `participants.user_id`)

## 5. Vocabulary overlay

The vocabulary overlay is how the same substrate serves wildly different
verticals. The database never changes. The UI never hardcodes industry
nouns. The overlay does translation at render time.

### 5.1 What the overlay contains

Each tenant has a `vocabulary_overlay` configuration that maps:

- Universal primitives to industry nouns (Entity → "Project" for
  construction, "Tournament" for esports, "Campaign" for a label,
  "Service" for a church, "Booking" for hospitality)
- Universal statuses to industry states (a substrate status of `ACTIVE`
  might render as "In Progress" for construction and "Live" for a
  broadcast)
- Universal participant roles to industry roles (Participant with role
  `crew` renders as "Crew Member" for construction or "Broadcast Crew"
  for MAJH Studio)
- Universal payment nouns to industry nouns ("Deposit" and "Draw" for
  construction; "Tithe" and "Ministry Support" for a church; "Entry Fee"
  and "Prize" for esports)

Example overlay structure (subject to refinement in
`docs/PHASE_1_SCHEMA.md`):

```json
{
  "tenant_id": "uuid",
  "industry_type": "CONSTRUCTION",
  "vocabulary": {
    "entity_singular": "Project",
    "entity_plural": "Projects",
    "participant_singular": "Crew Member",
    "participant_plural": "Crew",
    "resource_singular": "Equipment",
    "payment_in_singular": "Deposit",
    "payment_out_singular": "Draw",
    "statuses": {
      "DRAFT": "Estimate",
      "ACTIVE": "In Progress",
      "COMPLETED": "Final Inspection"
    }
  }
}
```

### 5.2 Where overlays live

Overlays are stored in a `vocabulary_overlays` table (referenced from
`tenants.vocabulary_overlay_id`) rather than inline JSONB on each tenant
row. This lets multiple tenants share a base overlay (all construction
tenants use the same base construction overlay) while permitting
per-tenant customization (a specific construction tenant can override
labels their business uses differently).

Base overlays for each vertical are seeded when the platform ships. Custom
overlays are created per tenant on request.

### 5.3 How rendering works

The application layer has a `useVocabulary()` hook (or equivalent) that
resolves the current tenant's overlay and provides labels to components.
Components never hardcode strings like "Tournament" or "Project"; they
call `t('entity_singular')` and let the overlay decide the label.

Substrate code (auth, ledger, primitives) is fully vocabulary-agnostic.
Module code uses the overlay to render its UI in the tenant's language.

### 5.4 Relationship to Event Type Profiles

The vocabulary overlay lives at the **tenant** level and applies globally
to that tenant's UI. Event Type Profiles (Gaming, Church, Conference,
Music, Graduation, Corporate, Entertainment, Hospitality) live at the
**event** level within a tenant, provided by the MAJH Studio (broadcast)
module.

A construction tenant has a construction vocabulary overlay. That same
construction tenant might use MAJH Studio to broadcast a corporate event
kickoff — the Event Type Profile "Corporate" applies to that specific
event within the tenant. The two concepts coexist without conflict:

- Vocabulary overlay = "how does this tenant name things in general"
- Event Type Profile = "what template does this specific event use"

## 6. The module system

Substrate is small and universal. Modules are large and specific but
optional. New verticals require new modules; they do not require new
substrate.

### 6.1 What a module is, technically

A module is:

- A namespace in the code (`modules/{name}/` in the application repo)
- A schema in the database (`{name}.*` in Postgres — following the
  boundary discipline established in the April `ARCHITECTURE.md` §2.1)
- An entry in the module registry (`platform.modules` — the table that
  tracks all modules known to the platform)
- A per-tenant activation flag (`tenants.activated_modules` includes the
  module name when the tenant has it enabled)
- A set of documented dependencies on substrate and possibly on other
  modules

A module can define:

- Its own tables in its schema
- Its own API routes under `app/api/{module}/`
- Its own UI components under `modules/{module}/ui/`
- Its own Ralph prompts and tools under `modules/{module}/prompts/` and
  `modules/{module}/ralph_tools/`
- Its own vocabulary contributions (specialized labels for the module's
  UI beyond what the tenant overlay provides)
- Its own event types published to the event store
- Its own outbox handlers

A module cannot:

- Modify substrate table structure
- Query another tenant's data (RLS enforces this regardless)
- Grant itself privileges beyond what its activation flag permits
- Depend on another module that isn't activated for the tenant

### 6.2 The reconciled module taxonomy

Modules in MAJH OS represent durable business capabilities, not tenant-
specific features. Naming reflects long-term platform scope: `fleet`
rather than `vehicle_service` (auto shops today, plumbers and delivery
tomorrow), `retail` rather than `retail_kiosk` (a kiosk is one form
factor; retail is the capability), `hospitality` broadened to cover
F&B, lodging, tours, concierge, and transportation coordination as a
unified domain.

Where a module was initially developed to satisfy the operational needs
of a specific MAJH Events line of business, that context is noted. The
module itself is a platform capability available to any tenant that
activates it.

The April `ARCHITECTURE.md` defined 9 module schemas: core, tournament,
broadcast, audience, feed, clips, venue, metrics, integrations, plus
ops. The reconciled taxonomy below preserves institutional knowledge
from the April document while restructuring around the substrate/module
boundary this document formalizes.

**Substrate (not a module):**

- `core.*` schema — universal primitives, financial ledger, escrow,
  auth, audit log, event store, outbox, module registry, knowledge
  pools

**Cross-cutting capabilities (substrate services, not standalone
modules):**

- **Metrics and reporting** — the April document defined `metrics` as a
  module. In the reconciled taxonomy, general cross-module reporting is
  a substrate service (every tenant gets basic reports on their
  primitives). Module-specific reporting lives in modules. The finance
  module includes finance-specific reports; the tournament module
  includes tournament-specific reports; and so on.

- **Integrations** — the April document defined `integrations` as a
  module. In the reconciled taxonomy, the *adapter framework* is
  substrate (see §9). Specific adapters (Monday, QuickBooks, Stripe
  Connect onboarding, Plaid) are either module-owned (an adapter that
  serves one module lives in that module) or platform-owned (an adapter
  that serves multiple modules lives at the substrate level).

- **Ops** — internal tooling for platform operations (moderation, system
  alerts, deployment integrity). Not tenant-facing. Lives at the
  substrate level with restricted access.

**Currently in scope (built, partial, or actively planned for MAJH
Events tenant operations):**

- **`tournament`** — competition management (brackets, pairings,
  seeding, prize distribution). Initially developed to satisfy MAJH
  Esports operational requirements. Available to any tenant running
  competitive events.

- **`broadcast`** — live event production and streaming. Initially
  developed to satisfy MAJH Studio's operational requirements.
  Incorporates and supersedes the April document's `audience` (chat,
  reactions, presence), `feed` (content ranking, follows), and `clips`
  (clip jobs, highlights) as sub-capabilities of the broadcast
  experience. The April tech stack decisions (LiveKit Egress for
  composition, Mux for distribution, participant + source topology
  model — see April `ARCHITECTURE.md` §5 and decision log entries dated
  2026-05-04) remain authoritative for how broadcast is implemented.

- **`venue`** — physical locations, events, reservations, spaces,
  capacity, check-in, scheduling, and ticketing. Ticketing is included
  as a venue capability rather than a standalone module because it is
  primarily consumed in the venue context (ticketed events at physical
  spaces). Preserves the April document's community-scope decisions
  (event-scoped chat rooms bounded to event lifecycle; no persistent
  global rooms; no voice chat scope for the near term; see April
  `ARCHITECTURE.md` §8.1). Initially developed to satisfy MAJH Events
  venue operations.

- **`finance`** — operational finance built on the substrate ledger.
  Invoicing, AR/AP, reconciliation, reporting. See §8.

- **`fleet`** — mobile service and fleet operations for tenants
  managing service vehicles, crews, and dispatched work. Initially
  scoped for CarBarDMV; naturally extends to plumbers, HVAC,
  electricians, mobile healthcare, delivery, towing. Not yet started.

- **`hospitality`** — food service, bars, catering, lodging,
  reservations, guest services, tours, concierge, transportation
  coordination, and hospitality packages. Broadened from the earlier
  "F&B only" scope to reflect Tradewinds RB's actual operational
  breadth. Not yet started.

- **`retail`** — point-of-sale, inventory management, SKU tracking,
  pricing, fulfillment, and multiple form factors (kiosk, pop-up,
  storefront, e-commerce). Broadened from the earlier "kiosk only"
  scope. Initially scoped for TRS airport kiosk and MAJH Events
  gamestore. Not yet started.

**Illustrative future modules (target external tenants; scoped but not
prioritized until the platform is proven with current-scope modules):**

- **`construction`** — project-based operations with milestones,
  subcontractors, permits, and client portals. Target vertical for
  first external MAJH OS tenant per
  `docs/STRATEGIC_DIRECTION.md` §10.

- **`church`** — worship service planning, congregation management,
  giving, ministry coordination. Illustrative future vertical.

- **`label`** — release management, artist relations, royalty
  distribution, catalog management. Illustrative future vertical.

The illustrative modules are described to demonstrate that the substrate
and module system extend cleanly to unrelated verticals. Their appearance
in this document does not commit to build order or timing.

### 6.3 Module dependencies

Modules can depend on the substrate (always) and optionally on other
modules. A module cannot be activated for a tenant unless its
dependencies are also activated.

```
Substrate (always available)
    │
    ├── tournament
    │       ├── finance (optional — for prize distribution reporting)
    │       └── broadcast (optional — for streamed tournaments)
    │
    ├── broadcast
    │       └── venue (optional — for broadcasts tied to physical events)
    │
    ├── venue
    │       └── finance (optional — for ticket revenue reporting)
    │
    ├── finance
    │       (no module dependencies — depends only on substrate ledger)
    │
    ├── fleet
    │       └── finance (optional — for service invoice generation)
    │
    ├── hospitality
    │       ├── venue (optional — for lodging and event spaces)
    │       ├── finance (optional — for F&B and reservation revenue)
    │       └── retail (optional — for merchandise and gift shop)
    │
    ├── retail
    │       └── finance (optional — for sales revenue reporting)
    │
    └── (illustrative future modules follow the same pattern)
```

Optional dependencies mean: the module works without them, but activates
additional capabilities when they're also present. For example,
`tournament` can run without `finance` — it just won't generate
finance-native prize distribution reports. When both are active, the
tournament module registers ledger entries via the finance module's
service.

Required dependencies (currently: only substrate) mean the module cannot
function without them. The activation flow enforces this.

### 6.4 Module activation

The `platform.modules` registry table tracks:

- `module_name` (unique)
- `description`
- `substrate_dependencies` (list of substrate services the module
  requires — e.g. `ledger`, `event_store`, `knowledge_pools`)
- `module_dependencies` (list of other modules this depends on)
- `activation_requirements` (any tenant-side requirements — e.g. the
  finance module requires Stripe Connect onboarding be complete)
- `implementation_status` (matches CAPABILITY_MAP.md: `built`, `partial`,
  `designed`, `not_started`)
- `default_activated_for_industries` (JSONB array — industries whose
  tenants get this module activated by default)

The `tenants.activated_modules` column lists which modules are on for a
specific tenant. Combined with feature flag logic at the application
layer, this drives what UI and API routes are exposed to that tenant's
users.

Activating a module for a tenant:
1. Verifies substrate dependencies are met
2. Verifies module dependencies are met (dependent modules must also be
   activated)
3. Verifies tenant-side activation requirements (Stripe onboarding,
   admin approval, etc.)
4. Runs the module's activation hook (if defined) which may seed default
   data or configuration
5. Records the activation in the audit log
6. Updates `tenants.activated_modules`

Deactivating a module (rare):
1. Runs the module's deactivation hook if defined (data is not deleted,
   only hidden from UI)
2. Removes the module from `tenants.activated_modules`
3. UI and API routes for that module return "not activated for this
   tenant"
4. Audit log records the deactivation

### 6.5 RLS across the substrate/module boundary

Substrate tables have RLS that enforces the four-level hierarchy:
tenant-scope on every row, department and location scope where applicable.

Module tables have RLS that:
1. Enforces tenant-scope (same as substrate)
2. AND enforces that the tenant has the relevant module activated

The second predicate uses a helper function like
`core.tenant_has_module(tenant_id, module_name)` which reads
`tenants.activated_modules`. This ensures that even if application logic
fails to check module activation, the database will deny access to a
tenant that hasn't activated the module.

Detailed RLS strategy in §12. RLS-touching migrations require the
verification queries specified in `docs/RUNBOOK.md`.

## 7. The financial spine

The financial system is the most important part of the platform because it
is the part tenants trust us with directly. It must be correct. It must be
auditable. It must be tamper-evident. And it must operate within the
compliance boundary defined in §2.4.

### 7.1 The ledger

The `core.ledger_entries` table is the single source of truth for
every movement of money attributable to a tenant.

Core columns:

- `id` (UUID, primary key)
- `tenant_id` (required)
- `department_id` (nullable but strongly encouraged for departmental
  reporting — added via T-200 in April backlog)
- `location_id` (nullable — added via T-200)
- `entry_type` (`debit` or `credit`)
- `amount_cents` (integer, always in smallest currency unit)
- `currency` (three-letter code)
- `account_ref` (which ledger account this entry hits — see chart of
  accounts note below)
- `source_type` (polymorphic — what kind of business event caused this)
- `source_id` (UUID — the specific event)
- `linked_transaction_id` (UUID — groups debits and credits that
  balance to zero for a single business event)
- `entry_hash` (SHA-256 hash of this entry's canonical form)
- `previous_hash` (SHA-256 hash of the previous entry's `entry_hash`;
  builds the hash chain)
- `created_at` (timestamp; append-only means this never changes)
- `created_by_user_id` (who caused the entry to be created; nullable
  when the source is a webhook or automated process)
- `mfa_verified_at` (nullable timestamp; populated when the entry is a
  correction that required MFA)

The ledger is append-only, enforced by a trigger that blocks UPDATE and
DELETE on this table. Corrections are new entries that reference the
original entry via `linked_transaction_id`. To reverse a $100 charge,
insert two new entries totaling $100 in the opposite direction, linked
to the original transaction. The original entries stay.

Every business event that moves money creates a set of balanced entries
(debits and credits that sum to zero, following double-entry accounting).
The `linked_transaction_id` groups them.

**Chart of accounts:** Each tenant has a chart of accounts (in a
`core.ledger_accounts` table, scoped by `tenant_id`) that defines what
accounts exist for that tenant. This is populated with defaults on tenant
provisioning and customized as the tenant's finance module grows. The
substrate does not enumerate a global chart of accounts; each tenant's
chart reflects their own business structure.

### 7.2 Escrow as substrate primitive

Per the resolution of the design question flagged in
`docs/CAPABILITY_MAP.md`: **escrow is a substrate primitive.** Modules
provide their release-rule logic; the substrate provides the escrow
mechanism.

**Terminology clarification.** Throughout this document, "escrow" refers
to an operational commitment record and release workflow. It does not
imply that MAJH OS acts as a regulated escrow agent or custodian of
funds. Per §2.4, actual funds remain in the regulated payment ecosystem
(Stripe Connect and equivalents) at all times. The substrate's escrow
mechanism is a state machine that tracks commitments and generates
programmatic release instructions; it is not custody. This is a critical
distinction and the term "escrow" is retained only because it is the
clearest available developer-facing abstraction for the pattern being
implemented. Terms of service and legal documents will use more precise
language reflecting the operational-not-custodial nature.

#### The escrow record

The `core.escrow_accounts` table holds:

- `id` (UUID, primary key)
- `tenant_id` (required)
- `department_id` (nullable)
- `location_id` (nullable)
- `source_type` (polymorphic — what kind of thing this escrow is against;
  e.g. `tournament_prize_pool`, `construction_milestone`,
  `event_deposit_guarantee`, `royalty_advance`)
- `source_id` (UUID — the entity or transaction this escrow is against)
- `original_amount_cents` (integer — the amount originally committed;
  never changes after funding)
- `currency` (three-letter code)
- `status` (state machine below)
- `funding_provider` (string — `stripe`, `manual`, `plaid_transfer`,
  `wire`, `other`; permits non-Stripe funding without schema change)
- `funding_reference` (string — provider-specific reference:
  Stripe payment intent ID, wire confirmation number, manual receipt
  number)
- `release_rule_module` (which module owns the release rules for this
  escrow — e.g. `tournament`, `construction`, `venue`; immutable after
  creation)
- `data` (JSONB — module-specific release rule state; see the opaque
  payload contract below)
- Standard audit columns

Note: the *remaining* balance is derived from the ledger (sum of
outstanding escrow liability entries), not stored on the escrow row.
This is consistent with the substrate's principle that the ledger is
the source of truth for balances.

#### State machine

Allowed states and transitions:

```
created ─────► awaiting_funding ─────► funded
                    │                     │
                    │                     ├─► partially_released
                    │                     │       │
                    │                     │       └─► fully_released
                    │                     │
                    │                     ├─► refunded
                    │                     │
                    │                     ├─► disputed
                    │                     │       │
                    │                     │       ├─► funded (dispute resolved)
                    │                     │       ├─► refunded (dispute resolved)
                    │                     │       └─► fully_released (dispute resolved)
                    │                     │
                    ▼                     ▼
              cancelled              closed (terminal)
```

`created` → `awaiting_funding`: escrow record exists; funding
instruction issued.

`awaiting_funding` → `funded`: funding confirmed via provider webhook or
manual reconciliation.

`awaiting_funding` → `cancelled`: funding never completed and escrow was
voided (e.g., counterparty backed out).

`funded` → `partially_released`: some portion released per module release
rules.

`partially_released` → `fully_released` or back to `partially_released`
with new release.

`funded` → `refunded`: full amount returned to funder.

`funded` → `disputed`: contested; no money movement until resolution.

`disputed` → any resolution state depending on how the dispute is
resolved.

Any terminal state (`fully_released`, `refunded`, `cancelled`, `closed`)
prevents further transitions.

State transitions are enforced by substrate code (an escrow service or
database trigger). Modules cannot invent invalid transitions.

#### The opaque data payload contract

The `data` JSONB field is the single intentional exception to substrate's
module-agnosticism. Substrate treats `data` as an opaque, uninterpreted
payload:

- Substrate does not query into `data`, validate its structure, or
  include it in universal reports
- Only the module named in `release_rule_module` may read or write
  `data`'s structure
- If a module is deactivated, its `data` blobs remain in escrow records
  for audit purposes but are treated as frozen historical artifacts —
  the deactivated module's code no longer executes against them
- The `release_rule_module` field is immutable after creation (enforced
  by trigger). This prevents module A from hijacking module B's escrow
  by rewriting the module assignment.

Modules should declare a JSON Schema for their `data` payload in the
module registry (`platform.module_escrow_schemas`, forthcoming). The
substrate does not enforce this schema — that would require substrate to
understand module semantics. The schema serves documentation and
migration-planning purposes.

#### Ledger integration (automatic)

Every escrow state transition that affects money commitment
automatically generates balanced ledger entries via a substrate service
(the escrow-ledger bridge). Modules never write to `core.ledger_entries`
for escrow operations.

The substrate provides the accounting mechanics (which accounts get
debited and credited, in what direction, with what
`linked_transaction_id` grouping). The module provides the trigger
(when the state transition should occur). The pattern:

- **Funding** (`awaiting_funding` → `funded`): Debit the tenant's
  designated cash/asset account. Credit an escrow liability account.
  Amount = original commitment.

- **Partial release** (`funded` → `partially_released` or successive
  partial releases): Debit the escrow liability account for the release
  amount. Credit the module-specified target account (prize expense for
  tournament, subcontractor payable for construction, etc.).

- **Full release** (`funded` → `fully_released`): Same pattern as
  partial, for the remaining liability.

- **Refund** (`funded` → `refunded`): Debit the escrow liability
  account. Credit the original funding source account. Amount = full
  remaining liability.

- **Disputed** transitions: No automatic ledger entry. Dispute is a
  legal/operational state; entries resume upon resolution.

The specific chart-of-accounts codes used are tenant-configured (per
§7.1's chart of accounts) with module-specified defaults registered at
module activation time. The substrate provides the double-entry
mechanics; the tenant provides the account structure.

All entries generated by a single state transition share a
`linked_transaction_id` UUID so the transition is auditable as an
atomic financial event.

#### Release authorization gate (MFA)

Escrow releases move money. The substrate enforces multi-factor
authentication for all state transitions that reduce committed
liability: `funded` → `partially_released`, `funded` → `fully_released`,
and `funded` → `refunded`.

The module provides eligibility rules (who is permitted to request a
release). The substrate enforces authentication (MFA verification
before executing the transition).

The flow:

1. A user requests a release via the module's UI
2. The module's release-rule code evaluates business conditions
   (bracket final complete? milestone inspection passed?) and returns
   an eligibility recommendation (approve, deny, or hold-for-condition)
3. If the module approves, the substrate escrow service validates:
   - The requesting user is in the module's eligible-authorizer set
   - The user has completed MFA within the last 10 minutes
   - The transition is valid per the state machine
   - The release amount does not exceed the funded balance
4. Only then does the substrate execute the transition, generate
   ledger entries, and log to audit

The `core.escrow_accounts` table records the release authorization:
- `last_release_authorized_by_user_id` (UUID, nullable)
- `last_release_mfa_verified_at` (timestamp, nullable)

Every release attempt (successful or denied) generates an audit log
entry. The module cannot bypass MFA by returning approve — the
substrate gate is mandatory and module-agnostic.

#### Non-Stripe funding sources

The `funding_provider` and `funding_reference` columns accommodate
non-Stripe funding without schema changes. When a tenant funds an
escrow via manual wire transfer, the provider is `manual` and the
reference is a receipt number the tenant records. When Plaid ACH
becomes available in the Phase 2 finance module, the provider is
`plaid_transfer` and the reference is the Plaid transaction ID.

The substrate does not verify funding independently — it trusts what
the tenant records, consistent with the trust boundary in §2.4. The
tenant's reconciliation workflow (Phase 2 of the finance module) is
where funding claims get matched against actual bank movements.

#### Escrow invariants

The following invariants apply to every escrow account. Implementers
verify these hold; auditors can rely on them.

1. Every escrow account belongs to exactly one tenant.
2. Every funding event produces balanced ledger entries.
3. Every release produces balanced ledger entries.
4. Total releases may never exceed funded amount.
5. Every state transition is recorded in the audit log.
6. Only the owning module (`release_rule_module`) may evaluate release
   conditions.
7. Only authorized actors (per module eligibility + substrate MFA gate)
   may execute releases.
8. Escrow records are append-only except for permitted state
   transitions.
9. The `release_rule_module` field is immutable after escrow creation.
10. Actual custody of funds always remains with an external regulated
    financial account. The escrow record is a commitment structure, not
    custody.

If any invariant is violated in production, it is a platform bug
requiring immediate remediation. Modules or code paths that would
require violating an invariant must be redesigned.

### 7.3 Financial intents pattern

Preserved from April `ARCHITECTURE.md` §7. Every payment-touching feature
routes through this pattern:

1. **Intent:** Insert a `core.financial_intents` row with status `pending`,
   generated UUID as idempotency key
2. **Execute:** Call Stripe (or other payment provider) with the intent's
   UUID as the Stripe idempotency key, update intent to `submitted`
3. **Reconcile:** Webhook handler matches by Stripe object ID, finds the
   intent, updates status to `succeeded` or `failed`, writes ledger
   entries, writes audit log

A scheduled reconciler runs every 15 minutes and sweeps any intent in
`submitted` state older than 1 hour, querying Stripe directly for status.
This catches lost webhooks and network failures.

This pattern is currently incomplete in the running codebase (see April
`ARCHITECTURE.md` §8.2 "Reality vs Target State" and BACKLOG T-005). The
current pause on `cron/process-payouts` (commit `13655a0`) is part of the
work to consolidate two coexisting incomplete payout systems into this
unified pattern. Any new payment work must follow this pattern; existing
code paths that don't will be migrated as T-005 completes.

### 7.4 Audit log

The `core.audit_log` table records every state transition that matters.
Append-only, enforced at the trigger level. INSERT permitted to specific
roles; UPDATE/DELETE denied.

Columns:

- `id` (UUID, primary key)
- `tenant_id` (required)
- `actor_user_id` (who did this thing, when known)
- `actor_type` (`user`, `system`, `webhook`, `cron`, `agent`)
- `event_type` (e.g. `entity_created`, `payment_intent_submitted`,
  `escrow_released`, `mfa_verified`, `module_activated`)
- `entity_type`, `entity_id` (what was affected)
- `before` (JSONB — state before change, when applicable)
- `after` (JSONB — state after change, when applicable)
- `metadata` (JSONB — additional context; IP address, user agent,
  MFA method, etc.)
- `created_at`

The audit log is queryable via a scoped view (`v_audit_log`) that RLS
restricts to the tenant's own entries. Platform operators have
platform-wide visibility for support and debugging; this access is
itself audited.

The canonical `audit_log` table did not exist in migrations as of the
April audit (finding H14). Task T-113 addresses this. Once that lands,
every SQL function and application-layer helper that writes to
`audit_log` must match the canonical schema.

## 8. The finance module

The finance module operationalizes the substrate financial spine by
providing workflows for receivables, payables, reconciliation,
reporting, planning, and financial analysis. The immutable ledger
remains the source of truth. The finance module provides the user-facing
operational processes built upon it.

### 8.1 Compliance framing (recap of §2.4)

The finance module is a record-keeping, orchestration, and analysis
tool. It does NOT:

- Hold funds (custody stays with regulated payment providers or the
  tenant's own bank)
- Facilitate lending or credit (tenants extending credit to their own
  customers do so as a business relationship the tenant owns)
- Provide accounting, tax, or legal advice
- Certify financial statements
- Assume responsibility for tenant tax filing, business licensing, or
  industry-specific regulatory obligations

The finance module renders operational reports that inform the tenant's
own decisions and support their own reporting obligations. What the
tenant does with those reports — file them, submit them to auditors,
show them to investors, hand them to their CPA — is the tenant's work.

### 8.2 Adapter strategy (foundational to every phase)

Adapter strategy is presented before the build phases because it shapes
every phase of the finance module. Adoption is the platform's magic
trick: MAJH OS earns replacement rather than requiring it. The
adapter strategy is what makes this true for finance.

**Three modes of finance module use:**

1. **Native only.** The tenant runs finances entirely on MAJH OS. No
   external accounting tool. The finance module is the tenant's book of
   record. Best for new tenants without an established accounting stack
   or tenants who have chosen to migrate fully.

2. **Adapter only.** The tenant keeps QuickBooks (or Xero, Wave, etc.)
   as their book of record. MAJH OS reads from the external tool via
   adapter for reporting, insight, and cross-module orchestration, but
   does not write ledger entries for the external tool's transactions.
   Best for tenants with mature accounting stacks who want operational
   integration without switching.

3. **Dual-run (deliberate).** The tenant uses both. This requires
   explicit configuration: the tenant designates *one system as the
   ledger source of truth per account category*. Without this
   designation, both systems could record the same revenue or expense,
   producing double entries. The finance module refuses to activate
   dual-run mode without this configuration recorded.

**Adapter data flow:**

Adapters read external system data and either:

- Populate the tenant's MAJH OS chart of accounts as a starting point
  (one-time on activation)
- Provide historical data to reports for prior-period comparison
- Sync ongoing transactions for reporting purposes (in adapter-only
  mode, these are the tenant's real transactions; in dual-run mode,
  they are informational for the accounts the external system owns)

**Boundary rule:** The adapter framework never writes to
`core.ledger_entries` on behalf of external system data unless the
tenant has explicitly designated that external system as the source of
truth for the account category in question. The default is
informational-only sync.

**Migration path:** A tenant on QuickBooks who eventually wants to
migrate to native MAJH OS finance can do so gradually. The tenant
switches source-of-truth designation account category by account
category as they gain confidence. The adapter continues to sync
historical data for continuity. No forced cutover.

### 8.3 Financial intents (how finance module writes to the ledger)

The finance module never writes directly to `core.ledger_entries`. All
money-movement events flow through the substrate's financial intents
pattern (preserving the April `ARCHITECTURE.md` §7 pattern and closing
the audit finding that not every payment path uses it).

**The pattern:**

1. Finance module event occurs (invoice sent, payment received, bill
   paid, refund issued)
2. Finance module creates a `core.financial_intents` row with status
   `pending`
3. Substrate ledger service processes the pending intent:
   - Validates the intent (accounts exist, amounts balance, MFA where
     required)
   - Generates balanced `core.ledger_entries` grouped by
     `linked_transaction_id`
   - Updates intent status to `executed`
   - Emits an event to the event store (§10)
4. Finance module reads back the `linked_transaction_id` and updates
   its own operational tables (invoice status, payment record) to
   reflect the executed state
5. On failure, intent goes to `failed` state; the finance module reads
   the failure reason and surfaces it in the UI

The financial intents table:

- `id` (UUID)
- `tenant_id`
- `intent_type` (e.g. `invoice_payment`, `bill_payment`, `refund`,
  `manual_journal`)
- `source_module` (`finance`, `tournament`, `venue`, etc.)
- `source_id` (UUID of the module-owned entity that triggered the
  intent — invoice ID, bill ID, escrow release request, etc.)
- `amount_cents`, `currency`
- `status` (`pending`, `validated`, `executed`, `failed`, `cancelled`)
- `linked_transaction_id` (nullable until executed; UUID that will
  group the resulting ledger entries)
- `mfa_verified_at` (nullable; required for high-risk intents)
- `failure_reason` (nullable, populated on failure)
- Standard audit columns

This pattern ensures:

- No module writes ledger entries directly
- Every money movement is auditable end-to-end (source module → intent
  → ledger → back to source module)
- Failed intents don't corrupt the ledger (nothing gets written until
  validation passes)
- The finance module gets the same discipline every other module gets,
  no special privileges

### 8.4 Multi-currency handling

Ledger entries, invoices, bills, and payments retain their original
currency (the `currency` column on `core.ledger_entries` and finance
module tables). Reports default to the tenant's base currency.

- **Phase 1:** Invoices, bills, and ledger entries record their native
  currency. Reports render in the currency the transactions occurred
  in; multi-currency reports show line-item currency and totals in the
  tenant's base currency using a manually-entered exchange rate.
- **Phase 2 or 3:** Manual exchange rate entry for period-end
  reporting.
- **Phase 4:** Automatic exchange rate fetching from a public source
  (with tenant override).

This scope is important given Barbados (BBD/XCD) and US (USD)
operations across MAJH Events. Full automatic multi-currency handling
is not a Phase 1 commitment, but Phase 1 does record currency
correctly so future phases can operate on complete data.

### 8.5 Vocabulary integration

The finance module registers vocabulary contributions via the substrate
vocabulary overlay API. Default labels are module-provided; tenant-
specific overrides are stored in the tenant overlay.

Examples:

- "Invoice" (default) becomes "Statement" for a construction tenant,
  "Ticket" for a hospitality F&B tab, "Draw Request" for a
  construction subcontractor
- "Bill" (default) becomes "PO Invoice" for a tenant with formal
  purchasing
- "Customer" (default) becomes "Client" for construction, "Guest" for
  hospitality, "Attendee" for events

The finance module UI never hardcodes strings. It calls the vocabulary
overlay for every user-facing label.

### 8.6 Audit trail for finance module operations

All invoice, bill, and payment mutations generate `core.audit_log`
entries via the substrate audit service (§7.4). The finance module does
not maintain a separate audit trail.

High-risk operations require MFA verification:

- Voiding a sent invoice
- Modifying a line item on a sent invoice
- Approving a bill payment above a tenant-configured threshold
- Manual journal entries (Phase 2+)
- Deleting a payment record

These MFA requirements mirror the ledger's correction policy in §7.1.

### 8.7 Escrow integration

The finance module and the substrate escrow mechanism interact through
well-defined patterns:

- **Invoices can reference escrow accounts.** An invoice line item may
  represent a deposit that funds an escrow (`event_deposit_guarantee`,
  `construction_milestone`, `tournament_entry_fee`). The line item's
  `data` JSONB records the linkage; on payment, the substrate escrow
  service opens the corresponding escrow account.

- **Escrow releases can generate invoices.** When a construction
  milestone is approved and the escrow releases funds to a
  subcontractor, the construction module can request the finance
  module generate a vendor invoice (or bill) to record the payment
  operationally. The escrow → ledger entries happen via the substrate
  bridge (§7.2); the invoice is an operational overlay for the tenant's
  workflow.

- **The finance module does not control escrow release.** Release
  triggers are module-owned per §7.2. The finance module records the
  operational consequences.

### 8.8 Phase 1 — Operational Finance

The following capabilities ship as Phase 1 of the finance module. Real
operational visibility from Day 1.

- **Invoice creation.** Native invoicing: create an invoice for a
  participant (customer), track its status (`draft`, `sent`,
  `partial_paid`, `paid`, `overdue`, `voided`), record payment against
  it. Invoices are entities of type `invoice`; line items live in a
  module table (`finance.invoice_line_items`); payments received against
  an invoice generate financial intents that the substrate ledger
  service executes (§8.3).

- **Payment recording.** Manual entry (check, cash, wire) supported in
  Phase 1. Stripe payment link generation supported when the tenant has
  Stripe Connect configured. Plaid ACH and reconciliation follow in
  Phase 2.

- **Accounts receivable summary.** Outstanding invoices for a tenant,
  aged by days outstanding (0-30, 31-60, 61-90, 90+). Filterable by
  department and location.

- **Operational reports** (available from Phase 1, not deferred):
  - Revenue by department and location
  - Cash received by period
  - Outstanding receivables
  - Basic ledger activity view
  - Department-scoped profit and loss report

  These reports use ledger entries and the tenant's chart of accounts.
  Department-scoped P&L is the differentiator versus QuickBooks — native
  four-level scoping built in rather than bolted on via Class Tracking
  workarounds.

- **Chart of accounts.** Tenant's chart of accounts (in
  `core.ledger_accounts` per §7.1) populated with defaults on tenant
  provisioning. The finance module registers default templates with the
  substrate provisioning system; tenants customize via UI, with writes
  routed through the substrate API.

- **Vocabulary integration.** Per §8.5.

- **Ralph capability at Phase 1:**
  - "What invoices are overdue?"
  - "Show me AR aging for Department X"
  - "How much revenue did MAJH Esports book last month?"

### 8.9 Phase 2 — Operational Accounting (built when Phase 1 is complete
and stable)

- **Bill management.** Record incoming bills (accounts payable) with
  due dates, vendor references, and expected payment method. Track
  status and schedule payment.

- **Accounts payable summary.** Report showing outstanding bills aged
  by due date.

- **Vendor management.** Vendors as participants with payment terms,
  preferred payment methods, purchase history, and vendor contacts.

- **Approval workflows.** Bills above a tenant-configured threshold
  require approval before payment. Approval logic is operational
  workflow (which is what Ralph and the substrate exist to enable);
  the finance module renders the workflow UI and writes to the audit
  log.

- **Bank feed integration.** Plaid integration to pull tenant bank
  transactions. These enter the reconciliation workflow.

- **Reconciliation UI.** A workflow for matching bank transactions,
  Stripe transactions, and ledger entries; flagging discrepancies;
  running month-end close.

- **Manual journal entries.** For adjustments not tied to an invoice
  or payment (accruals, corrections, opening balances). All manual
  journal entries require MFA and route through the financial intents
  pattern like every other ledger write.

- **Ralph capability at Phase 2:**
  - "Reconcile this bank transaction against my ledger"
  - "What bills are due this week?"
  - "Which vendors are we overdue with?"

### 8.10 Phase 3 — Financial Reporting (built when Phase 2 is complete)

- **Balance sheet report.** Native balance sheet for a specific date,
  scoped as with P&L.

- **Cash flow statement.** Cash flow report for a date range.

- **Budget entry and variance.** Enter budgeted amounts per account,
  per period. Compare actual ledger activity to budget.

- **Dashboards.** Tenant admin dashboards summarizing key financial
  metrics with drill-down.

- **Period locking.** Month-end close workflow that locks a period
  against further changes (with unlock capability for authorized
  users). Necessary operational governance even with an immutable
  ledger, because the finance module's operational tables and reports
  need known-good period boundaries.

- **Ralph capability at Phase 3:**
  - "Generate a P&L for last quarter"
  - "What's our cash position across all departments?"
  - "How are we tracking against budget for Q3?"

### 8.11 Phase 4 — Planning and Analysis (built when Phase 3 is
complete)

- **Simple forecasting.** Project revenue and expenses forward based
  on historical trends. Confidence intervals disclosed.

- **Cohort analysis** (for tenants with customer data). Cohort
  retention, cohort revenue.

- **Custom report builder.** UI for tenants to construct their own
  report definitions.

- **AI-assisted insights.** Ralph proactively surfaces anomalies and
  patterns (unusual expense growth, at-risk receivables, revenue
  concentration risks).

- **Ralph capability at Phase 4:**
  - "Forecast our revenue for next quarter based on current pipeline"
  - "Which customers show the strongest retention?"
  - "What's driving the margin decline we saw last month?"

### 8.12 Phase 5 — Compliance Support (built when Phase 4 is complete)

Tax and regulatory support is the last phase because it is the most
jurisdiction-dependent and the least standardizable across verticals.
Nothing in this phase makes MAJH OS a tax preparer or filing agent —
the tenant remains responsible for tax filing and compliance.

- **Expense categorization for tax purposes.** Tag ledger entries with
  tax categories per the tenant's jurisdiction.

- **1099 tracking.** Track contractor payments and generate 1099
  summaries for US tenants.

- **VAT/GST tracking.** For non-US tenants (Barbados operations use
  VAT); record VAT collected and paid.

- **Sales tax collection tracking.** Record sales tax collected and
  remitted. NOT filing sales tax returns — that remains the tenant's
  responsibility.

- **Export to accountant.** Structured export in formats accountants
  and CPA tools can consume (CSV, QBO import, standard journal entry
  formats).

- **Ralph capability at Phase 5:**
  - "Generate a 1099 summary for last year"
  - "Export our books for our accountant"
  - "What VAT do we owe this quarter?"

## 9. The adapter framework

The adapter framework is the substrate pattern for absorbing external
tool data into MAJH OS primitives.

### 9.1 What an adapter does

An adapter connects to an external system (Monday.com, QuickBooks, a
hotel PMS, a church management system like Planning Center), reads data
according to a defined schedule or in response to webhooks, translates
that data into MAJH OS primitives, and stores the results in the
appropriate substrate or module tables.

Adapters are one-way (external → MAJH OS) by default. Bidirectional
adapters (MAJH OS → external) are supported but require explicit
configuration because writes to external systems have failure modes and
authorization needs that reads don't.

### 9.2 Adapter architecture

Every adapter implements a common interface:

- `authenticate()` — establish credentials with the external system
  (OAuth flow, API key, whatever the external system requires)
- `describe()` — enumerate what data types this adapter can pull
- `sync(scope)` — pull data for a specified scope (a specific Monday
  board, a QuickBooks account, a date range) and produce records
- `translate(external_record)` — convert an external record into MAJH OS
  primitives (Monday item → Entity of type `project` or `task`;
  QuickBooks invoice → Entity of type `invoice` plus payments_in
  entries and ledger activity)
- `store(translated_record)` — persist the translated record with
  appropriate tenant, department, and location scoping
- `handle_webhook(payload)` — process a webhook from the external
  system (Monday's real-time updates, QuickBooks's change notifications)

The framework provides:
- Sync scheduling (cron-driven periodic sync)
- Webhook routing (incoming webhooks routed to the correct adapter)
- Error handling and retry logic
- Audit logging of sync activity
- Rate limiting to respect external system limits
- Credential storage (encrypted, RLS-scoped)

### 9.3 Adapter data flow via event store

Adapter reads write to the event store (§10) rather than directly to
substrate primitives. This means:

1. Adapter pulls an external record
2. Adapter translates and writes an event to `core.event_store`
3. Event handlers (which may live in substrate or in modules) consume
   the event and produce the actual writes to primitives and module
   tables

This indirection lets multiple consumers react to the same external
event (a new Monday task might update the tournament module AND write
to the knowledge pool AND notify Ralph), and it provides a natural
replay/reprocessing capability if translation logic is later corrected.

### 9.4 First adapters

The first adapters we build target Monday.com and QuickBooks, using the
founder's own accounts as the demonstration surface per the
"no prospect data without invitation" discipline in
`docs/STRATEGIC_DIRECTION.md`.

- **Monday.com adapter:** Read-only sync of a specified Monday board.
  Each Monday item becomes an Entity with `type` matching the board's
  purpose (project, task, opportunity). The board columns become JSONB
  data on the entity. Board changes trigger webhook-based updates.

- **QuickBooks adapter:** Read-only sync of accounts, customers,
  vendors, and transactions. Populates chart of accounts, participants
  (customers/vendors), and payment records for reporting purposes.
  Historical data flows into the finance module's reports.

Additional adapters (Stripe Connect onboarding, Plaid bank feeds,
hospitality PMS, Planning Center for church tenants) follow when the
first vertical needing them activates.

## 10. Event store and outbox

The event store and outbox are the substrate's message bus. They enable
cross-module communication without direct coupling, provide an audit
trail of what happened when, and let adapters and Ralph react to
platform events without polling.

### 10.1 The event store

`core.event_store` is an append-only table of business events that
have occurred. Every module (and the substrate) emits events into it.
Every module (and Ralph) can subscribe to events from it.

Columns:

- `id` (UUID, primary key)
- `tenant_id` (required)
- `event_type` (namespaced string: `finance.invoice.sent`,
  `tournament.bracket.finalized`, `escrow.funded`,
  `venue.checkin.completed`, `adapter.monday.item_updated`)
- `source_module` (`finance`, `tournament`, `substrate`, etc.)
- `source_id` (UUID of the thing that generated the event)
- `payload` (JSONB — event-specific data; consumers interpret per
  event type)
- `occurred_at` (timestamp — when the event happened in the real
  world, which may differ from record insert time for retroactively
  imported events)
- `recorded_at` (timestamp — when the event was written to the store)
- Standard audit columns

Events are append-only. Corrections are new events (`invoice.voided`
follows `invoice.sent` rather than deleting the original event).

### 10.2 The outbox pattern

Modules that need to trigger side effects (send an email, call
Stripe, update an external adapter, notify Ralph) write to
`core.outbox` in the same database transaction as their state change.
A worker consumes the outbox asynchronously and dispatches to
handlers.

This gives us:

- **Atomicity:** the state change and the side-effect instruction
  land together or neither lands
- **Retry safety:** the worker can retry failed handlers without
  re-running the state change
- **Idempotency keys:** every outbox row has an idempotency key used
  by external calls (Stripe, external adapters) to prevent double
  execution
- **Auditability:** every side effect that ever occurred (or failed)
  is recorded

Outbox columns:

- `id`, `tenant_id`
- `idempotency_key` (UUID, unique — used as the Stripe idempotency
  key or equivalent for other external services)
- `target_service` (`stripe`, `adapter.monday`, `email`, `webhook`)
- `endpoint` (which action on the target service — `transfer.create`,
  `board.update`, `send`)
- `payload` (JSONB — everything needed to execute)
- `delivery_status` (`pending`, `processing`, `completed`,
  `failed_retriable`, `failed_fatal`)
- `retry_count` (integer, bounded — typically capped at 5)
- `last_error` (nullable text)
- `execute_after` (timestamp for backoff scheduling)
- `processed_at` (nullable timestamp)
- Standard audit columns

The worker uses `FOR UPDATE SKIP LOCKED` to safely process rows in
parallel across multiple worker instances without collision. Failed
retriable errors get exponential backoff. Failed fatal errors surface
to the tenant admin for manual resolution.

### 10.3 Cross-module reactions

Modules subscribe to events they care about via handler registration.
The subscription happens at module activation; the handler code lives
in the module.

Examples:

- Finance module subscribes to `escrow.funded` to record the funding
  in AR (if the escrow was fed by an invoice)
- Venue module subscribes to `finance.invoice.paid` to update event
  attendee registration status
- Ralph subscribes to `*.anomaly.*` events to surface issues to
  tenant admins

The subscription registry is a substrate table
(`platform.event_subscriptions`) that maps event types to module
handlers. Modules cannot subscribe to another tenant's events (RLS
enforces this).

## 11. Ralph integration points

This document describes where Ralph plugs into the architecture. The
build sequence for Ralph itself is in `docs/RALPH_BLUEPRINT.md`.

### 11.1 Ralph's substrate access

Ralph is a substrate-level service. Ralph has read access to
substrate primitives (scoped by RLS per the current user's tenant
and role) and can invoke module tools that are registered as
Ralph-callable.

Ralph's substrate access:

- Read: entities, participants, resources, payments_in, payments_out,
  ledger entries (scoped), escrow accounts (scoped), event store
  entries (scoped)
- Read: knowledge pool contents (scoped)
- Invoke: any module tool registered in the Ralph tool registry
- Never write: substrate tables directly. All writes go through the
  same financial intents pattern or module APIs any user would use.

### 11.2 Module tool registration

Each module declares Ralph-callable tools by placing them in
`modules/{module}/ralph_tools/`. Tools have a manifest (name,
description, parameters, permissions) and an implementation.

Ralph loads the tool manifests at conversation start (filtered by
which modules the tenant has activated and what the current user's
role permits). Ralph invokes tools based on the conversation
context.

The finance module registers tools like `get_ar_aging`,
`generate_pnl_report`, `create_invoice`. The tournament module
registers tools like `get_bracket_status`, `list_upcoming_matches`.

### 11.3 Knowledge pool access

Ralph queries per-tenant knowledge pools (substrate) via semantic
search. Retrieval is scoped to the current tenant and, where
appropriate, filtered by `origin_module` to prevent cross-module
semantic pollution (a finance question shouldn't retrieve tournament
knowledge to answer it, and vice versa).

Full knowledge pool design in `docs/RALPH_BLUEPRINT.md` and the
forthcoming `docs/KNOWLEDGE_POOLS.md`.

### 11.4 Ralph does not violate the compliance boundary

Ralph does not:

- Move money without going through the same financial intents pattern
  and MFA gates a human user would
- Provide accounting, tax, or legal advice (Ralph responses to
  finance questions include disclaimers where warranted)
- Certify financial statements
- Cross tenant boundaries

Ralph responses are logged to the audit log. High-risk Ralph actions
(anything that writes state) require the same authorization checks as
if a user performed them.

## 12. RLS strategy across the four-level hierarchy

RLS is the mechanism that enforces every isolation guarantee in this
document. It is not optional and it is not a defense-in-depth layer —
it is the primary defense.

### 12.1 The four scope levels

Every operational table's RLS policies check some subset of:

- **Tenant scope:** `tenant_id = current_setting('app.current_tenant_id')`
- **Department scope:** `department_id IN (
  SELECT department_id FROM organization_members
  WHERE user_id = auth.uid() AND is_active = true)`
- **Location scope:** (similar pattern)
- **Role scope:** the user's role in `organization_members` permits
  the operation

Substrate tables enforce tenant scope minimum. Financial and
sensitive tables also check role. Module tables additionally check
`tenant_has_module(tenant_id, module_name)` — a helper function that
reads `tenants.activated_modules`.

### 12.2 Application-layer complement

Application code uses the `checkPermission()` helper (T-204 in April
BACKLOG) at API boundaries to check the same conditions RLS enforces.
This provides defense in depth: even if a bug slips through RLS, the
application layer denies unauthorized operations.

The `checkPermission()` helper is not yet built. Until it is, RLS is
the primary enforcement. Application code should still check
authorization, but the enforcement of last resort is at the database.

### 12.3 Cross-tenant queries are impossible

By design, no query in the application can return data from two
tenants simultaneously. This is enforced by:

- Setting `app.current_tenant_id` at the start of every request
- RLS policies that filter by this setting
- The absence of any application code path that unsets or changes
  the setting mid-query

The service_role bypass exists for webhooks, crons, and platform
administration. Any service_role code that reads across tenants must
be reviewed carefully. See April `ARCHITECTURE.md` §2.3 for the
canonical service_role discipline.

### 12.4 Module activation as an RLS predicate

Module tables include `tenant_has_module(tenant_id, module_name)` in
their RLS. This means:

- A tenant that has not activated the finance module cannot read or
  write finance module tables, even if their user is authenticated
  and has an org_member row
- Deactivating a module for a tenant makes its data immediately
  invisible (soft — the data still exists, just inaccessible via
  normal queries)
- Re-activating restores access

This is a stronger guarantee than application-layer feature flags
alone.

## 13. Tech stack

Preserved from April `ARCHITECTURE.md` §5 with sovereignty notes
attached.

### 13.1 Current stack

- **Frontend:** Next.js 16 App Router, React 19, TypeScript strict
  mode, Tailwind, shadcn/ui
- **Backend:** Next.js server actions for mutations, route handlers
  for webhooks and external API surfaces, Vercel Cron for scheduled
  jobs
- **Database:** Supabase Postgres with pgvector extension for
  knowledge pool embeddings
- **Auth:** Supabase Auth with Discord and Google OAuth providers
- **Payments:** Stripe Connect (Express accounts for tenants); we
  never handle card data directly
- **Live video (composition):** LiveKit for WebRTC ingest and Room
  Composite Egress for RTMP output (see April doc §5 for full
  rationale)
- **Live video (distribution):** Mux for ABR transcoding, HLS
  playback, VOD, clips, and simulcast to third-party RTMP
- **Object storage:** Vercel Blob (interim); migration to Cloudflare
  R2 planned
- **Email:** Resend
- **Hosting:** Vercel for the Next.js app; Supabase-hosted Postgres

### 13.2 Sovereignty and portability

Two external dependencies are structural and acceptable: Stripe (PCI
compliance is not our problem to solve) and a domain registrar (ICANN
requires accredited registrars). Everything else is replaceable.

**Replacement paths:**

- **Vercel → self-hosted Next.js** (on Hetzner or similar) if scale
  or cost demands it. Vercel-specific features to avoid: proprietary
  Edge functions where standard Node middleware works, Vercel Blob
  when Cloudflare R2 is available, Vercel-specific analytics.
- **Supabase → self-hosted Postgres + GoTrue + Realtime + MinIO** if
  a tenant contract requires sovereign hosting or platform costs
  require it. This is a significant migration but architecturally
  possible because Supabase is fundamentally open-source.
- **Mux → alternate CDN with HLS + a self-hosted composition
  service** is possible but expensive; not planned near-term.
- **LiveKit** is open-source and self-hostable already; if LiveKit
  Cloud costs become prohibitive, self-hosting is a supported path.
- **Anthropic API (for Ralph reasoning-heavy tasks) → self-hosted
  models** for burst-only fallback. Ralph's baseline reasoning runs
  on models we can host; cloud inference is optional.
- **Stripe → alternate payment provider** (Adyen, PayPal, Square) if
  Stripe deprecates Connect or terms change. This is operational,
  not existential — migration takes weeks, not years, because our
  payment code goes through a small adapter surface.

Sovereignty is not ideology. It is risk management. Every vendor we
depend on is a future failure mode. By keeping the stack ours where
possible, we make tenant promises we can actually keep.

**Migration triggers (when we act on the sovereignty principle):**

The sovereignty principle is aspirational until we specify what
conditions trigger acting on it. The following are the specific
concrete triggers.

Vercel migration is planned (not executed) when any of these become
true:

- Monthly Vercel bill exceeds approximately $300-500 sustainably
- A tenant contract explicitly requires non-Vercel hosting
- Vercel changes pricing or terms in ways that materially harm
  platform economics
- Platform needs long-running processes Vercel does not support well
  (Ralph running continuously, complex background jobs, dedicated
  WebSocket servers)
- Platform outgrows Vercel Cron and needs a real job queue with
  reliability guarantees Vercel Cron cannot provide

Supabase migration is planned (not executed) when any of these become
true:

- Monthly Supabase bill exceeds approximately $500-1,000 sustainably
- A tenant contract requires sovereign database hosting
- Platform needs Postgres features Supabase does not expose (custom
  extensions, direct replication control, custom pgbouncer
  configuration)
- Row-level security enforcement conflicts with Supabase's
  architecture in ways that cannot be worked around
- Ralph needs local model inference and it makes sense to co-locate
  the database with the models

When any single trigger fires, revisit and evaluate whether the
concrete cost of migration outweighs the concrete cost of staying.
When any two fire, plan migration seriously. When more than two fire,
migration is likely already overdue.

**Portable Vercel + Supabase discipline (what we do while we're on
this stack):**

To keep migration possible when triggers fire, current development
discipline includes:

- Standard Next.js middleware wherever possible; Vercel Edge functions
  only when necessary and wrapped in a shim
- Cron authentication via `lib/cron-auth.ts` (already implemented per
  T-108) that accepts both Bearer secrets and the Vercel-specific
  `x-vercel-cron` header, so route handlers do not change if we move
  off Vercel Cron
- Object storage: Cloudflare R2 for new file uploads (S3-compatible,
  runnable anywhere); Vercel Blob only for legacy paths
- Database: standard Postgres features first; Supabase-specific
  features (their auth schema, realtime channels) used deliberately
  and with awareness that they become migration friction
- Environment variables tracked in `.env.example` and Vercel's
  dashboard, not in Vercel-proprietary integration configurations
- DNS on Cloudflare or Namecheap; the domain layer stays sovereign
  independent of the app hosting layer

### 13.3 Worker model

For current scale, Vercel Cron plus the outbox worker is sufficient.
Scheduled jobs run as authenticated route handlers under
`app/api/cron/*` using `lib/cron-auth.ts` (which accepts both Bearer
CRON_SECRET and `x-vercel-cron: 1`, closing April audit finding
T-108/C10).

When scale demands it (real-time clip generation, feed ranking, or
event volume beyond cron-frequency), consider BullMQ on Upstash Redis
or a similar dedicated worker layer. This is a future decision, not
current.

## 14. UI surfaces

MAJH OS is a multi-tenant platform. Different users see different
surfaces of it depending on their role and scope. This section names
the surfaces explicitly because their existence — or non-existence —
has architectural consequences for how RLS is designed, how modules
declare their UI contributions, and how the platform's own operation
is distinguished from the operation of any specific tenant.

Three UI surfaces exist in the architecture:

### 14.1 Platform admin surface

**Who uses it:** MAJH OS platform operator (currently the founder;
eventually may include trusted platform-level staff or delegated
operators).

**What it is:** The root-level operator interface. Non-tenant-scoped.
The platform-as-product surface.

**What it does:**

- Tenant lifecycle management: provision new tenants, deactivate
  tenants, view all tenants across the platform
- Module registry management: mark modules as `built` / `partial` /
  `designed` / `not_started`; declare substrate and module
  dependencies; add new modules to the registry
- Base vocabulary overlay management: create, edit, and version
  the platform-provided base overlays (events, construction,
  church, label, hospitality, professional services)
- Platform-level configuration: settings that apply across all
  tenants (feature flags, default values, platform-wide policies)
- Cross-tenant observability: aggregate metrics for platform
  operation (total transaction volume, aggregate error rates,
  aggregate tenant count) — never row-level tenant data without
  explicit purpose
- Ralph approval queue for platform-level actions: when Ralph
  proposes changes at the substrate or platform level, they land
  here for operator review
- Audit log review at platform scope: platform-wide operational
  events, security events, and deployment integrity checks

**What it does NOT do:**

- Read or modify individual tenant operational data (that's the
  tenant admin surface's job, and cross-tenant reads violate the
  data sovereignty principle in §2.2)
- Bypass RLS for convenience: even the platform operator queries
  tenant data through the tenant admin surface, not through this
  surface
- Provide a "god mode" that lets the operator impersonate a tenant
  admin without an audit trail (impersonation, when needed for
  support, is a separate audited flow, not a UI-level shortcut)

**Access control:**

- Only users with a `PLATFORM_OWNER` role (or equivalent per
  membership consolidation resolution) can access this surface
- Access requires MFA (Option 1.5a when real MFA lands; password
  re-authentication in the interim per Option 1.5c)
- Every action taken on this surface writes to `audit_log` with
  actor_type = `user` and metadata identifying it as a platform
  admin action

**Implementation status:** Not yet built. Currently platform admin
tasks are performed via direct database access or via founder-only
routes embedded in the main application. Extracting to a distinct
surface is post-Phase-1 work.

**Location in code:** Recommend `app/(platform)/*` route group in
the Next.js app, with layout enforcing `PLATFORM_OWNER` role.
Separated from `app/(tenant)/*` (tenant admin) and `app/(public)/*`
(tenant user) route groups. Middleware enforces the boundary.

### 14.2 Tenant admin surface

**Who uses it:** Users with admin-level roles within a specific
tenant. For MAJH Events today, this includes the founder as owner
plus any users the founder promotes to admin. For future tenants,
each tenant designates their own admins.

**What it is:** The tenant-scoped operator interface. Everything an
admin needs to run their tenant.

**What it does:**

- Department and location management within the tenant
- User and participant management: invite users, assign roles,
  manage participant records for non-user participants
- Module configuration: for modules the tenant has activated, admin
  configures module-specific settings (tournament defaults,
  broadcast layouts, F&B menus, service scheduling rules)
- Financial management via the finance module UI (when active):
  chart of accounts, invoicing, AR/AP, reports
- Vocabulary customization: override specific base overlay labels
  where the tenant's language differs from the base
- Escrow management: view escrow accounts, authorize releases
  (subject to the auth gate in §7.2)
- Ralph interaction: chat with Ralph in tenant scope; view Ralph's
  proposals in the tenant-scoped approval queue
- Audit log review at tenant scope
- Adapter configuration: connect external systems (Monday,
  QuickBooks, Plaid, PMS) and manage sync

**What it does NOT do:**

- View or modify other tenants' data (RLS enforces this at the
  database)
- Modify substrate configuration (that's platform admin's job)
- Access modules the tenant has not activated

**Access control:**

- Users must be in `organization_members` for the tenant with an
  appropriate role
- Some actions (financial releases, escrow authorization, user
  role changes) require the auth gate
- Every action writes to tenant-scoped audit log

**Implementation status:** Partially built. MAJH Events today has
tenant admin functionality mixed into the main application (T-204
authorization migration in progress). Extraction to a distinct
tenant admin surface is progressive: as modules mature, their admin
UIs get organized into the tenant admin surface.

**Location in code:** Recommend `app/(tenant)/*` route group with
layout enforcing tenant membership and admin role. Sub-routes
per module (`app/(tenant)/finance/*`, `app/(tenant)/tournament/*`,
etc.), with feature-flag gating so only activated modules render.

### 14.3 Tenant user surface

**Who uses it:** End users of a tenant's operational business.
Players in MAJH Esports tournaments. Ticket buyers for MAJH Studio
events. Guests booking Tradewinds RB. Customers at TRS. For future
tenants, whatever their user population looks like.

**What it is:** The tenant's public-and-user-facing product. This
is what most people think of when they think of "MAJH Events" —
the actual application people register on, buy tickets on, play
tournaments on.

**What it does:**

- Whatever the tenant's activated modules provide to end users
- Registration and account management
- Tenant-specific branded experience with vocabulary overlay
  applied
- Payment flows (via the substrate financial primitives and the
  finance module or module-specific payment flows)
- User-facing views of tenant operations (tournament brackets,
  event tickets, service bookings, retail products, etc.)
- Notifications and communications
- Support and help resources

**What it does NOT do:**

- Expose admin functionality (RLS and role-based UI hides admin
  routes from regular users)
- Show data from other tenants (RLS enforces at database; UI
  respects tenant context)
- Modify substrate configuration
- Modify module configuration

**Access control:**

- Anyone can access the public-facing parts (registration pages,
  tournament pages that are marked public, etc.)
- Authenticated users see their own data plus tenant public data
- RLS ensures a user in Tenant A cannot see Tenant B's data even
  if they somehow navigate there

**Implementation status:** This is what's currently in production
as `www.majhevents.com`. Substantially built. The primary surface
users have interacted with since MAJH Events launched.

**Location in code:** `app/(public)/*` and non-grouped root
routes. Tenant identification via subdomain (future) or path
prefix (current, since MAJH Events is currently the only tenant
on the domain).

### 14.4 The three surfaces on one platform

All three surfaces run on the same MAJH OS platform, on the same
Vercel deployment, backed by the same Supabase database. They are
route groups within a single Next.js app, not separate applications.

**Why one app, not three:**

- Shared authentication (a user with multiple roles across
  surfaces has one login)
- Shared database with RLS as the primary boundary (rather than
  network-level isolation)
- Shared component library (a chart of accounts editor may appear
  on both tenant admin and platform admin surfaces with slight
  variations)
- Simpler deployment and monitoring
- Lower operational overhead for a founder-run platform

**Why route groups matter:**

- Route groups make the surface distinction visible in code
  organization
- Layouts per route group enforce role checks at the layout level,
  not at every page
- Middleware can enforce group-level access control declaratively
- Future extraction to separate apps (if scale or contract
  requirements demand it) is a well-scoped refactor

**Cross-surface features:**

Some capabilities span multiple surfaces:

- Ralph's approval queue exists in both tenant admin scope (for
  tenant-affecting proposals) and platform admin scope (for
  platform-level proposals). Different UIs; same substrate table.
- Audit log review exists on all three surfaces but shows
  different subsets: tenant admin sees tenant-scoped events;
  platform admin sees platform-scoped events; tenant users don't
  see audit log at all (they see their own activity in narrower
  views like order history).
- Adapter management exists in tenant admin scope (tenants
  configure their own external integrations) but adapter framework
  configuration is platform admin scope.

### 14.5 The platform admin surface as a distinct concern

The most important architectural point in this section: **the
platform admin surface must exist as a distinct concern, not as a
special mode of the tenant admin surface.**

This matters because:

**Compliance and audit clarity.** When you're operating on the
platform (activating a module, managing tenants), that action is
categorically different from operating on a specific tenant's data.
Mixing them makes audit trails harder to interpret and creates
opportunities for accidental cross-tenant contamination.

**Substrate/module boundary in UI.** Platform admin operates on
substrate configuration (module registry, base overlays, tenant
provisioning). Tenant admin operates on module features scoped to
their tenant. The surface separation reinforces the substrate/module
discipline documented in §2.5 and §6.

**Future delegation.** As the platform grows, some platform-level
operations may be delegated to trusted staff who are not tenant
admins for any specific tenant. A dedicated platform admin surface
makes this delegation possible without granting cross-tenant access.

**Product identity.** MAJH OS as a product needs its own surface.
The construction firm evaluating MAJH OS as their operational
platform should be able to see "here's what MAJH OS looks like as
a platform" without conflating it with "here's what MAJH Events
looks like as a tenant on MAJH OS." The platform admin surface,
when built, becomes part of that product identity.

### 14.6 Build sequence for platform admin surface

Not Phase 1 work. But the sequence is worth naming so it doesn't
get lost:

**Prerequisite:** Phase 1 substrate landed (universal primitives,
module registry, vocabulary overlays exist). Without Phase 1, the
platform admin surface has nothing to administer.

**First iteration:** Simple pages under `app/(platform)/*` for the
most-needed operator actions. Not designed. Not polished. Functional
tables and forms. Purpose: extract platform admin work out of ad-hoc
database queries into a real UI, even if the UI is minimal.

**Second iteration:** Add observability. Aggregate metrics. Module
registry visualization. Tenant list with health indicators. Ralph
approval queue for platform-level proposals.

**Third iteration:** Design pass. This is when the platform admin
surface becomes a product demonstration surface as well as an
operator tool. Construction firm evaluating MAJH OS as their
platform sees this.

**Fourth iteration:** Delegation, if needed. Support for platform
admin roles beyond the founder. Fine-grained platform-level
permissions. Not needed until the operator team grows beyond one
person.

Each iteration is a distinct workstream. Total effort probably
comparable to building one substantial module (weeks, not days).

### 14.7 Related documents and open questions

- `docs/RALPH_BLUEPRINT.md` — Ralph interacts with different
  surfaces per phase (founder-facing in Phase 5, tenant-facing in
  Phase 6)
- `docs/CAPABILITY_MAP.md` §5 — the substrate/module boundary
  discipline that the surface separation reinforces
- `docs/ARCHITECTURE_OPEN_QUESTIONS.md` — no current entry for
  platform admin surface implementation approach; add if this
  becomes a live question during Phase 1.5 or later

## 15. What's built vs. designed vs. not started

Honest accounting as of June 25, 2026. This section exists because
the April audit documented a real gap between architecture and
reality; naming that gap explicitly is how it gets closed.

### 15.1 Built and working

- MAJH Events platform live at www.majhevents.com with 25 users,
  11 verified, 2 staff
- Multi-tenant schema with `tenant_id` discrimination on most
  tables
- Supabase Auth with OAuth and email/password
- Stripe integration for event registration payments
- Row-Level Security on the majority of operational tables
- Auto-payouts cron (running fixed in production since June 11)
- Tournament management, registration flow, match reporting,
  announcement system
- Financial scoping (`department_id`, `location_id` added to
  `ledger_transactions` and `ledger_entries` per T-200, May 18)
- Cron auth helper (`lib/cron-auth.ts`) supporting Bearer and
  Vercel Cron (T-108, April 30)
- `addFundsToWallet` deletion (T-100 Part A, April 30 — closing
  critical audit C1)
- Wallet RLS lockdown interim (T-101, April 30)

### 15.2 Partial

- Payout system consolidation. Two coexisting incomplete systems.
  `cron/process-payouts` paused since June 17 (commit `13655a0`)
  pending unified financial spine design. T-005 in April BACKLOG
  is the resolution.
- Auth model consolidation. `organization_members` exists but
  ~19 API routes still on legacy auth patterns; ~50 RLS policies
  reference deprecated patterns. T-011 in April BACKLOG.
- Broadcast infrastructure. LiveKit + Mux architecture defined
  per April doc §5. Caster Studio and Egress wiring scoped as
  T-118. Actual state should be verified against latest commits
  before extending.
- Ralph. Slash-command interface working; agent loop and grounding
  not yet built. See `docs/RALPH_BLUEPRINT.md`.

### 15.3 Designed but not built

- Universal financial spine unified pattern (T-005 target)
- Vocabulary overlay rendering pipeline
- Knowledge pools (JSONB + pgvector storage; per-tenant scoped)
- Module registry and feature flag activation system
- Tenant onboarding flow (new tenants currently manually
  provisioned)
- White-label custom domain routing
- Monday.com and QuickBooks adapters
- Customer-facing portal (B2C dashboard)
- Native finance module (Phase 1 not started)
- Escrow-ledger bridge (§7.2) automatic entry generation
- Financial intents pattern (referenced in this doc; not yet
  implemented)
- Multi-currency exchange rate handling
- Native four-level dashboards (Platform → Tenant → Department →
  Location)

### 15.4 Not started

- Fleet module
- Hospitality module
- Retail module
- Construction module (target external tenant vertical)
- Church module
- Label module
- Ralph Phase 2 through 5 per `docs/RALPH_BLUEPRINT.md`
- Terms of service and privacy documents codifying the compliance
  boundary in §2.4

### 15.5 Why this section matters

Every agent working on the codebase reads this section before
committing to a new feature. If the feature depends on something in
§14.3 or §14.4, the dependency has to be built first or the feature
scoped to work without it.

Docs must be kept honest as work lands. When Phase 1 of the finance
module ships, it moves from §14.3 to §14.1. When the module registry
is built, it moves. This section is a living inventory, not a
retrospective.

## 16. Decision log

Architecture-specific decisions. Strategic decisions live in
`docs/STRATEGIC_DIRECTION.md`.

- **June 25, 2026:** ARCHITECTURE.md v2.0.0 authored. Preserves and
  reconciles April `ARCHITECTURE.md` v1.x with the substrate/module
  discipline formalized in `docs/CAPABILITY_MAP.md`, the four-level
  hierarchy from the MAJH Studio transcript, and the strategic pivot
  documented in `docs/STRATEGIC_DIRECTION.md` v1.1.1.

- **June 25, 2026:** Module taxonomy reconciled. April's audience,
  feed, and clips modules absorbed as sub-capabilities of broadcast.
  April's metrics, integrations, and ops reclassified as substrate
  services rather than modules. New modules named to reflect
  long-term platform scope (Fleet not vehicle_service, Retail not
  retail_kiosk, Hospitality broadened).

- **June 25, 2026:** Compliance boundary formalized. MAJH OS is
  record-keeping, orchestration, and analysis; not a financial
  institution. Programmatic orchestration replaces custody. Data
  classification is the tenant's responsibility. Trust boundary
  explicit.

- **June 25, 2026:** Escrow as substrate primitive confirmed.
  Terminology clarified as operational-not-custodial. State machine
  expanded (created, awaiting_funding, cancelled, closed added).
  Automatic ledger integration specified (escrow-ledger bridge).
  MFA gate for release authorization enforced at substrate.
  Ten invariants documented.

- **June 25, 2026:** Finance module structured as five phases:
  Operational Finance → Operational Accounting → Financial Reporting
  → Planning and Analysis → Compliance Support. Adapter strategy
  elevated to §8.2 (foundational, not afterthought). Financial
  intents pattern defined (finance module never writes ledger
  directly). Dual-run guardrails specified. Multi-currency
  acknowledged.

- **June 25, 2026:** Module dependency diagram introduced (§6.3).
  Modules can depend on substrate (always) and optionally on other
  modules. Activation flow validates dependencies.

- **July 12, 2026:** UI surfaces section added (§14). Three surfaces
  named explicitly: platform admin (operator-facing, non-tenant-
  scoped, currently unbuilt), tenant admin (tenant operator-facing,
  partial), tenant user (end-user-facing, substantially built as
  MAJH Events). Platform admin surface identified as distinct
  architectural concern that must not be conflated with tenant admin.
  Build sequence for platform admin surface documented as post-Phase-1
  work with prerequisites and iteration path. Sections 15 (formerly
  14) through 17 (formerly 16) renumbered accordingly.

## 17. Related documents

- `docs/STRATEGIC_DIRECTION.md` (v1.1.1) — strategic frame,
  commercial priorities, MAJH OS vs. MAJH Events distinction
- `docs/CAPABILITY_MAP.md` (v1.0.1) — substrate vs. module quick
  reference and decision tree
- `docs/AGENT_COLLABORATION_PROTOCOL.md` (v1.0.0) — multi-agent
  coordination
- `docs/majh_events/BARBADOS_SALES_MOTION.md` (v1.0.0) — MAJH Events
  tenant business (not MAJH OS strategy)
- `docs/ARCHITECTURE_OPEN_QUESTIONS.md` (v1.0.0) — deferred
  architectural concerns and open design questions
- `docs/ARCHITECTURE.md` (April 2026, historical) — preserved as
  reference for operational patterns not repeated here (outbox
  pattern implementation detail, community surface framing, Stripe
  integration specifics)
- `docs/PHASE_1_SCHEMA.md` (forthcoming) — SQL specification for the
  substrate foundation
- `docs/RALPH_BLUEPRINT.md` (forthcoming) — realistic Ralph build
  plan
- `docs/BACKLOG.md` — task queue with substrate/module labels
- `docs/RUNBOOK.md` — operational procedures and verification queries
- `docs/audits/2026-04-28-codebase-audit.md` — audit findings this
  architecture addresses

---

*Substrate universal. Modules composable. Compliance passthrough.
Every tenant sovereign. One codebase, many surfaces, all true.*
