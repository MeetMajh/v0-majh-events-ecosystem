# MAJH OS — Strategic Direction

**Status:** Authoritative. Supersedes `docs/APRILSTRATEGICDIRECTION.md` (April 28,
2026) and any prior strategic documents where they conflict with this one.
Historical documents remain in the repo as context, not commitments.

**Last updated:** June 25, 2026 (Malchijah Harding)

**Version:** 1.1.1 (naming normalization pass: MAJH Studio, MAJH Esports)

**Review cadence:** Monthly, or whenever a strategic pivot occurs.

---

## 1. Executive summary

MAJH OS is a multi-tenant Service Operating System — a vertical-agnostic substrate
that operational businesses run on. Every organization that uses the platform sits
on the same core: universal primitives, financial spine, auth, RLS, knowledge
pools, adapters, Ralph. Industry-specific capabilities are delivered as modules
activated per tenant. New verticals require new modules, not new substrate.

MAJH Events is the active flagship tenant. It operates across events, esports,
gamestore, restaurant, bar, catering, transport, and concierge — the operational
lines of business (MAJH Esports, CarBarDMV, Tradewinds RB, TRS) that gave birth to
the platform. MAJH Events is not a demo. It is a real operating tenant generating
real operational data and real revenue while the platform matures.

Every feature MAJH Events needs becomes a module in MAJH OS's library, available
for any future tenant who activates it. This is the **flagship-feeds-substrate
principle**: MAJH Events development IS platform development. They are not
competing workstreams. They are the same workstream viewed from two angles.

Our commercial priorities are ordered:
1. **MAJH Events tenant operations** (continuous, ongoing revenue engine)
2. **Construction firm as first external MAJH OS tenant** (targeted paid pilot
   within 60-90 days)
3. **Additional external tenants** (opportunistic — record label, hospitality,
   religious, professional services — no urgency, no commitment)

Runway is approximately 6 months. External MAJH OS tenant revenue must
materialize before month 6, or the plan requires funding, cost reduction, or
strategic descope.

## 2. What has changed since April

In April 2026, the operating plan was a 14-week sprint toward the Barbados
convention in August 2026, with MAJH Events as the primary deliverable. Between
April and June, three things happened.

**The construction opportunity emerged.** A conversation with a construction firm
owner led to a real prospective revenue relationship. He is not waiting for a
demo. He is waiting for a fully functional product he can hire us to run his
operations on.

**The multi-tenant thesis crystallized.** The construction opportunity, combined
with prior conversations about record labels (Zach), churches, hospitality
operators, and the growing complexity of MAJH Events itself, made clear that
MAJH OS is not "MAJH Events with better architecture." It is a distinct product:
a vertical-agnostic substrate that any operational business can run on, with
vocabulary overlays and modules that make the same substrate work for wildly
different industries.

**Runway compression forced honesty about resources.** Six months of runway with
one founder splitting time across a full-time job, CarBarDMV operations Thursday-
Monday, MAJH Events site refinement, and MAJH OS platform development means we
cannot carry every commitment at full intensity. Something had to be prioritized.

The pivot: MAJH OS as substrate is now the primary product deliverable. MAJH
Events continues as active flagship tenant on that substrate. Construction is the
first target external tenant for platform revenue. Barbados remains a future
opportunity, but as a MAJH Events tenant sales motion (event coordination at
Barbados hotels), not as a MAJH OS deployment target.

## 3. The distinction between MAJH OS and MAJH Events

This distinction is the most important thing in this document. It has been
muddled in prior conversations and it must not be muddled going forward.

### MAJH OS is the substrate

MAJH OS is vertical-agnostic. It knows nothing about hospitality, esports,
construction, churches, or record labels. It provides:

- Six universal primitives (Tenant, Entity, Participant, Resource, Payment In,
  Payment Out)
- Vocabulary overlay system (renders primitives in industry-specific language)
- Financial ledger (immutable, hash-chained, tenant-scoped)
- Auth and organizational membership model
- Row-level security enforcing tenant isolation
- Knowledge pools (per-tenant operational memory)
- Adapter framework (absorbs data from external tools)
- Ralph as concierge (AI assistant native to the platform)
- Module registry and feature flag system

MAJH OS is what a construction firm, a hotel, a record label, a church, or a
professional services firm all sign up for when they become MAJH OS tenants. They
all get the same substrate. They differ only in which modules they activate.

### MAJH Events is a tenant

MAJH Events is an organization that operates in the events, gaming, food-and-
beverage, and hospitality space. It has departments (MAJH Esports, CarBarDMV,
Tradewinds RB, TRS), locations (Digital, DC Metro, Barbados HQ, St. Lucia Hub,
Barbados Airport Kiosk), staff, customers, financial obligations, and vendor
relationships.

MAJH Events runs on MAJH OS the same way any tenant would. It uses the substrate,
activates modules relevant to its lines of business, and operates through
Ralph and the tenant-facing UI.

### Modules are how tenant needs become platform capabilities

When MAJH Events needs a tournament management system for MAJH Esports, the work
splits into two:

- **Substrate work:** Ensuring the Entity primitive supports a "tournament"
  entity type with bracket-shaped JSONB data, ensuring Participant supports a
  "player" role, ensuring Resource supports "streaming station" allocation.
- **Module work:** Bracket generation algorithms, Swiss pairings, seeding logic,
  tournament-specific admin UI, prize distribution rules.

The substrate work benefits every tenant immediately. The module work is
packaged as the "Tournaments" module, activated for MAJH Esports today, available
for any future tenant that wants tournaments (esports organizer, community
league, corporate event).

The same pattern applies to every MAJH Events business line:

- **MAJH Studio** becomes the "Live Events & Broadcast" module (for any tenant
  hosting broadcasts, from churches to conferences to gaming events)
- **CarBarDMV** operational needs become the "Vehicle Service Operations"
  module (for any tenant running a service fleet)
- **Tradewinds RB** operational needs become the "F&B and Hospitality" module
  (for any tenant running restaurants, bars, or hospitality)
- **TRS** operational needs become the "Retail Kiosk" module (for any tenant
  running point-of-sale retail)

Nothing MAJH Events builds is wasted. Everything MAJH Events builds becomes
future MAJH OS capability.

### The Barbados opportunity is a MAJH Events tenant opportunity

Kimi's July 2 hospitality memo (see `docs/context/kimi-hospitality-analysis.md`
if we retain it) is genuinely useful market analysis — for MAJH Events. It
describes how MAJH Events, as a tenant operating in the events and hospitality
space, could partner with Barbados hotels to run event series on top of their
existing infrastructure and provide unified data and reporting.

That is a valid revenue strategy for MAJH Events. It is not a strategic pivot
for MAJH OS. Hotels do not need to become MAJH OS tenants for MAJH Events to
deliver value at their properties; MAJH Events uses MAJH OS to deliver that
value. Later, if a hotel sees what's possible and wants the substrate for their
own use (not just as a host for MAJH Events productions), they can onboard as a
MAJH OS tenant themselves. That's the natural progression. But it is downstream
of MAJH Events succeeding in the market first.

## 4. The four-level architecture (thesis)

Every business that could use MAJH OS operates in some version of this hierarchy:

**Platform:** MAJH OS itself. One codebase, one substrate, shared services.

**Tenant:** An organization using the platform. MAJH Events today. A construction
firm, a hotel, a label, a church tomorrow. Tenants have branding, vocabulary
overlays, activated modules, and access to all platform services.

**Department:** A unit within a tenant with its own P&L, staff, and workflows.
Under MAJH Events today: MAJH Esports, CarBarDMV, Tradewinds RB, TRS. A construction
tenant might have: Residential, Commercial, Service. A church might have:
Worship, Missions, Education. Departments share tenant-level auth, CRM, and
knowledge; they maintain their own operational data.

**Location:** A physical or logical place where a department operates. DC Metro
for CarBarDMV. Barbados HQ and St. Lucia Hub for Tradewinds. Barbados Airport
Kiosk for TRS. Digital for MAJH Esports. Locations have geographic, regulatory,
and inventory context.

Every user in the system exists at some level of this hierarchy with a defined
role. Every entity, participant, resource, and payment is scoped to a level.
The substrate makes this hierarchy universal.

## 5. Universal primitives and vocabulary overlay

Six primitives every tenant operates on:

- **Tenant** — the organization
- **Entity** — the thing being tracked (project, tournament, campaign, release,
  service call, worship service, booking, matter)
- **Participant** — a person involved (crew, player, donor, artist, customer,
  congregant, guest, client)
- **Resource** — anything scheduled or allocated (equipment, streaming station,
  studio time, sanctuary room, hotel room, staff shift)
- **Payment In** — money entering the tenant's accounts
- **Payment Out** — money leaving the tenant's accounts

Domain-specific data lives in JSONB fields adjacent to these primitives, not in
the primitives themselves. The relational core stays universal.

Each tenant has a `vocabulary_overlay` configuration that maps primitives to
their industry vocabulary at render time. The database doesn't change per
vertical. Only the UI translation layer changes. New verticals require a new
overlay file, not new tables.

Separately, **MAJH Studio** provides Event Type Profiles (Gaming, Church,
Conference, Music, Graduation, Corporate, Entertainment, Hospitality) for the
broadcast and live-event layer. Vocabulary overlays live at the tenant level.
Event Type Profiles live at the event level within a tenant. Both concepts
coexist. MAJH Studio is a module (built for MAJH Events, available to any tenant
that activates it).

## 6. The flagship-feeds-substrate principle

**Every MAJH Events feature is a future MAJH OS module.**

This is the discipline that makes it possible to build MAJH OS and MAJH Events
simultaneously without going insane. It has three parts:

**Substrate versus module boundary must be crisp.** When we build anything for
MAJH Events, we identify what belongs in substrate (universal, benefits every
tenant) versus what belongs in a module (specific, activated per tenant). This
distinction is made explicitly at design time, before code is written. If we
can't tell whether something is substrate or module, we stop and figure it out
before proceeding.

**Substrate work is committed to core migrations and shared code paths.** It
lands in the `core.*` namespace (or its evolution), enters production for every
tenant immediately, and is documented as substrate. Substrate changes are
architectural events and require review against this document and
`ARCHITECTURE.md`.

**Module work is committed to module-scoped code and gated by feature flags.**
It lands in module namespaces (`tournament.*`, `broadcast.*`, `hospitality.*`,
`construction.*`, etc.), activates only when a tenant enables that module, and
carries documentation about its dependencies, target verticals, and vocabulary
mapping.

**Discipline holds when we say no.** If MAJH Events needs a feature that would
require baking hospitality-specific logic into substrate, we don't. We refactor
so the substrate stays universal and the specific logic lands in a module.
Slower in the moment, safer for everything downstream.

## 7. Adapters are the moat

Native operations (a working CRM, financial ledger, resource scheduler, customer
portal, tournament system, broadcast tools) are table stakes. They must exist
for the platform to stand on its own. But they are not what wins external
customers.

Adapters are what wins customers. A construction firm already uses Monday.com
and QuickBooks. A church already uses Planning Center. A label already uses
distribution platforms. A hotel already uses its property management system.
None of them want to abandon their existing tools to try ours.

Our thesis: MAJH OS reads from their existing tools, adds capabilities those
tools cannot provide (unified financial spine, milestone-unlock escrow,
customer-facing portals, AI concierge, knowledge pools that compound across
time), and earns the right to become their operating layer over time. We do
not require rip-and-replace. We shadow, augment, and absorb.

The first adapters we build target Monday.com and QuickBooks, using our own
accounts as the demonstration surface (never a prospect's sensitive data
without their explicit invitation). Adapter patterns generalize: what works for
Monday works for Asana, ClickUp, Notion. What works for QuickBooks works for
Xero, Wave, FreshBooks. What works for a hotel PMS (later) works for other
PMSes.

## 8. Sovereignty as risk management

We own our stack. Two external dependencies are acceptable: Stripe for payment
processing (PCI compliance is not our problem to solve) and a domain registrar
(ICANN requires accredited registrars). Everything else is open source,
self-hostable, and replaceable.

Currently we run on Vercel (Next.js hosting) and Supabase (Postgres, Auth,
Storage, Realtime, pgvector). Both are excellent for current scale. Both are
also replaceable. Vercel can be replaced with self-hosted Next.js on Hetzner or
with Railway/Render/Fly.io. Supabase can be replaced with self-hosted Postgres +
GoTrue + MinIO. We do not build features that lock us to either.

Ralph (our AI concierge) runs on models we can host ourselves when needed.
Cloud inference (Claude API for reasoning-heavy tasks) is a burst-only
fallback. We do not architect Ralph such that Anthropic being available forever
is required for the platform to function.

## 9. Non-negotiables

Some things do not compromise for any reason.

**Financial integrity.** The ledger is append-only, hash-chained, and immutable.
Corrections happen via balancing entries. MFA is required for amendments. No
platform employee (including the founder) can unilaterally modify a tenant's
ledger. RLS enforces tenant isolation at the database level.

**Data sovereignty.** Every tenant owns their data. Every tenant can export
everything at any time. Every tenant can request full deletion. We do not train
platform-wide AI on tenant data without explicit consent. Cross-tenant queries
are denied at the database level, not just at the application level.

**Security discipline.** Row-Level Security on every user-facing table. Service
role keys only in webhooks, crons, and verified admin actions. Every write
action audited. No untrusted input reaches the database without validation.

**Honest documentation.** Every major decision documented in a dated decision
record. Every gap between architecture and reality named explicitly. Every
commit message tells the truth about what was and wasn't done.

**The substrate/module boundary.** Substrate stays universal. Vertical logic
lives in modules. When in doubt, we stop and figure out which side of the line
something belongs on before we ship it.

## 10. Commercial priorities

Commercial priorities describe where revenue comes from and where sales effort
goes. This is different from the substrate's technical capabilities (which
serve every vertical universally).

### Priority 1: MAJH Events tenant operations (continuous)

MAJH Events is an active operating tenant generating operational data and
revenue across:

- **MAJH Esports:** Tournament management, streaming (MAJH Studio), player payouts,
  content and clip production, audience engagement
- **CarBarDMV:** Vehicle service operations in the DC Metro area (Thursday-
  Monday active, generates near-term cash flow)
- **Tradewinds RB:** Restaurant and bar operations at Barbados HQ and St. Lucia
  Hub (F&B, event catering, hospitality)
- **TRS:** Retail kiosk at Barbados Airport (point-of-sale, traveler retail)
- **Gamestore return:** Pop-up and permanent gamestore operations under the MAJH
  Events banner (planned relaunch)
- **majhevents.com:** Site refinement and feature completion for the flagship
  user-facing surface
- **Barbados hotel partnership motion:** MAJH Events as an event producer
  partnering with Barbados hotels for event series (uses Kimi's July 2
  hospitality analysis as market intelligence)

Every improvement here is both operational MAJH Events value and future MAJH OS
module value, per the flagship-feeds-substrate principle.

### Priority 2: Construction firm as first external MAJH OS tenant

Target: paid pilot signed within 60-90 days. Terms: to be scoped based on the
prospect's actual needs during a discovery conversation. Structure: 60-90 day
paid evaluation, at end of which the prospect either takes on MAJH OS for a
production workflow or walks away with what was built.

Success criteria:
- Signed pilot agreement with real terms
- Real project data flowing through the platform (native entry, adapter sync,
  or both)
- A customer-facing portal available to their B2C clients
- A credible plan for taking them fully live within the pilot period

This proves multi-tenancy commercially, proves the vocabulary overlay works
for a non-events vertical, and generates non-MAJH-Events revenue that extends
runway.

### Priority 3: Additional external tenants (opportunistic)

- Zach's record label: bootstrapping like us; not a near-term revenue priority
  but a valuable co-development relationship that helps prove vocabulary
  overlay for a third vertical
- Hotels as MAJH OS tenants (rather than partners to MAJH Events): downstream
  of MAJH Events hotel partnership motion succeeding
- Churches: post-revenue; large market but requires volunteer-friendly UX we
  don't yet have
- Professional services: post-revenue and post-second-vertical success

## 11. What we are not building

To prevent scope creep and prevent AI-agent-driven feature invention:

- **A 5,000-agent AI platform.** Ralph is one agent with a defined tool set. AI
  capabilities grow incrementally as revenue supports them.
- **A general-purpose CRM/ERP competitor.** We compete on multi-tenant substrate
  and vocabulary overlay, not on feature-completeness vs. Salesforce or
  NetSuite.
- **An advertising platform.** Sponsor relationships are direct-sold, not
  self-serve.
- **A creator economy platform.** Deferred until a paying customer demands it.
- **A general-purpose event platform for non-tenants.** MAJH Studio serves tenants
  who need event capability, not standalone event organizers we haven't
  onboarded.
- **A social network.** No persistent global community rooms. Match/event chat
  bounded to event lifecycle.
- **A pure-play hospitality platform.** MAJH OS is not competing with Cvent or
  Oracle Hospitality. MAJH Events, as a tenant, may compete with event
  producers who use those platforms. Different products.

## 12. Runway and capacity constraints

**Runway:** Approximately 6 months at current burn. External MAJH OS tenant
revenue must materialize before month 6, or the plan requires funding, cost
reduction, or strategic descope.

**Capacity:**
- Founder (Malchijah): 20-35 hours/week available for MAJH OS platform work.
  Full-time job, active CarBarDMV operations Thursday-Monday, MAJH Events site
  refinement, MAJH Events gamestore return planning, Tradewinds and TRS
  operational oversight all compete for time.
- No paid engineering hires possible without pre-revenue funding.
- AI agent assistance (Claude, v0, Cursor, Kimi) available and being used as
  force multiplier.
- Friends/family occasional assistance possible for specific tasks.

**Timeline discipline:** Every commitment on the calendar must respect the
20-35 hour ceiling. Multi-agent workflow is designed to multiply throughput
within this constraint, not to require additional founder hours we don't have.

## 13. Revenue targets (working assumptions, not commitments)

Targets are working assumptions to test decisions against, not promises to
external stakeholders.

**Continuous:** MAJH Events tenant operations generate ongoing revenue across
CarBarDMV, Tradewinds RB, TRS, MAJH Esports, and the gamestore return. This is
the primary near-term revenue base while external MAJH OS tenants are being
signed.

**Month 2 (August 2026):** Construction pilot in advanced negotiation or
signed. Terms scoped from actual construction firm discovery.

**Month 3-4 (September-October 2026):** Construction pilot active. First real
non-MAJH-Events data flowing through platform. Second external tenant
conversation started (Zach, hotel-as-tenant, or unknown).

**Month 6 (December 2026):** At least one external MAJH OS tenant paying.
Monthly recurring revenue from external tenants sufficient to meaningfully
extend runway. MAJH Events tenant operations continuing to provide base
revenue.

If Month 2 target is missed by more than 30 days, revisit strategy. If Month
6 target is missed (no paying external tenant), escalate to funding or major
descope decisions.

## 14. Multi-agent operating model

We use a project-manager-plus-specialist-agents pattern:

- **Founder as operational PM.** Reviews all agent output, approves all merges
  to main, makes strategic decisions, coordinates between agents.
- **Claude (in this conversation) as architectural PM.** Writes specs, reviews
  code diffs, arbitrates architectural questions, owns coherence of the
  platform across agents. Enforces substrate/module boundary.
- **Specialist agents (v0, Cursor, additional Claude instances, Kimi for
  specific analyses) as engineers.** Each owns a well-defined scope. Works
  from clear specs. Commits to feature branches. Never merges to main directly.

Substrate work versus module work must be labeled at the spec level so agents
know which regime they're operating in. Substrate work requires stricter
review; module work has more latitude because it can be feature-flagged off
if it turns out to be wrong.

Full protocol in `docs/AGENT_COLLABORATION_PROTOCOL.md`.

## 15. Decision log

- **June 23, 2026:** Strategic pivot from event-platform-with-Barbados to
  multi-tenant-OS-with-construction-as-target-external-tenant. Barbados
  deprioritized as future opportunity, not near-term platform commitment.
  Construction firm reframed from "sales prospect awaiting demo" to "target
  external tenant awaiting real product."
- **June 24, 2026:** Vocabulary overlay + Event Type Profile dual-concept
  confirmed. Both needed; different layers.
- **June 24, 2026:** Ralph scope calibrated. Kimi's "5,000-agent legion"
  rejected as over-scoped for capacity and runway. Adopted realistic Ralph
  plan: single agent with 5-10 tools, ~$300-500/month operational cost, 8-12
  week build.
- **June 25, 2026:** Multi-agent workflow adopted. This doc + companion docs
  (`ARCHITECTURE.md`, `AGENT_COLLABORATION_PROTOCOL.md`, `PHASE_1_SCHEMA.md`,
  `RALPH_BLUEPRINT.md`, `BACKLOG.md`) drafted as shared source of truth.
- **June 25, 2026:** MAJH OS vs. MAJH Events distinction formalized. MAJH OS
  is the vertical-agnostic substrate. MAJH Events is the active flagship
  tenant operating in events/hospitality. Kimi's July 2 hospitality analysis
  clarified as valuable MAJH Events market intelligence, not a MAJH OS
  strategic pivot.
- **June 25, 2026:** Flagship-feeds-substrate principle formalized. Every
  MAJH Events feature becomes a future MAJH OS module. Substrate/module
  boundary elevated to non-negotiable architectural discipline.
- **June 25, 2026:** Naming convention normalized. Canonical forms are
  MAJH OS, MAJH Events, MAJH Studio, MAJH Esports. Non-canonical short
  forms (MajStudio, MajEsports) removed from all docs to prevent agent
  confusion.
- **June 25, 2026:** Compliance boundary formalized. MAJH OS is a
  record-keeping and analysis tool, not a financial institution. Does not
  hold funds, facilitate loans, or provide accounting/tax/legal advice.
  Tenants are responsible for their own regulatory compliance. Platform
  responsible only for compliance obligations attaching to the platform
  itself (data handling, security). Detail in `ARCHITECTURE.md` and
  `docs/modules/finance/README.md`.
- **June 25, 2026:** Native operational finance adopted as a module (not
  substrate). Substrate provides the immutable ledger. `finance` module
  provides invoicing, AR/AP, reporting, reconciliation on top of the
  ledger. Phased rollout: Phase 1 minimum viable (invoicing, AR summary,
  department-scoped P&L); subsequent phases when Phase 1 is complete and
  stable. Tenants may use native finance, adapter to external tool
  (QuickBooks, Xero), or dual-run.

## 16. Related documents

- `docs/ARCHITECTURE.md` — technical architecture reflecting the four-level
  model, universal primitives, module boundaries, and substrate/module
  separation
- `docs/ARCHITECTURE_VISION.md` — long-form vision document (v3.0.0, June 17,
  2026); this doc's philosophical companion
- `docs/AGENT_COLLABORATION_PROTOCOL.md` — how multiple AI agents coordinate
  on the codebase
- `docs/PHASE_1_SCHEMA.md` — SQL specification for the four-level substrate
- `docs/RALPH_BLUEPRINT.md` — realistic Ralph build plan
- `docs/BACKLOG.md` — task queue with priority tiers
- `docs/context/kimi-hospitality-analysis.md` — Kimi's July 2 market analysis
  of hospitality for MAJH Events tenant (retained as market intelligence,
  not as MAJH OS strategy)
- `docs/APRILSTRATEGICDIRECTION.md` — historical context (April 28, 2026
  plan), now superseded but retained for reference

---

*The substrate is universal. The flagship feeds it. Every tenant makes it
richer.*
