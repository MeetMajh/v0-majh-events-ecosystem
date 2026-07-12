# MAJH OS vs. MAJH Events — Capability Map

**Every feature, every tool, every module: substrate or tenant?**

**Status:** Authoritative companion to `docs/STRATEGIC_DIRECTION.md` and
`docs/ARCHITECTURE.md`. Required reading for every agent before writing code.

**Last updated:** June 25, 2026

**Version:** 1.0.1 (naming normalization pass: MAJH Studio, MAJH Esports)

**Purpose:** Prevent substrate/module boundary violations. Provide a fast
lookup so any agent can determine which side of the line their work belongs
on without needing to read the full architecture document.

---

## 1. The one-sentence rule

**If a construction firm, a church, a record label, and a hotel would ALL need
it → it's SUBSTRATE.**

**If only MAJH Events (or a specific future tenant) would need it → it's a
MODULE.**

**If you're unsure → STOP and ask before writing code.**

---

## 2. The substrate (MAJH OS core)

These are universal. Every tenant gets them. They are not optional. They are
not feature-flagged.

### 2.1 Universal primitives (tables)

| Primitive | What it is | What it is NOT |
|---|---|---|
| `tenants` | The organization record | Not industry-specific data |
| `entities` | The thing being tracked (project, tournament, campaign, release, service call, worship service, booking, matter) | Not bracket generation logic, not sermon series planning, not milestone-unlock rules |
| `participants` | A person involved (crew, player, donor, artist, customer, congregant, guest, client) | Not player seeding algorithms, not volunteer scheduling logic |
| `resources` | Anything scheduled or allocated (equipment, streaming station, studio time, sanctuary room, hotel room, staff shift) | Not room block management, not equipment maintenance schedules |
| `payments_in` | Money entering the tenant's accounts | Not F&B minimum tracking, not tithe categorization, not royalty distribution splits |
| `payments_out` | Money leaving the tenant's accounts | Not subcontractor payment rules, not mission support allocation |

### 2.2 Platform services (every tenant gets these)

The **Implementation Status** column tells any agent what actually exists today
versus what is designed but not yet built. Do not assume any service is
production-ready unless the status says "Built."

| Service | Substrate function | Module extension | Implementation status |
|---|---|---|---|
| Auth & RLS | Login, `organization_members`, tenant isolation, role-based access | None — auth is universal | Partial (organization_members exists; ~19 API routes still on legacy patterns; ~50 RLS policies on deprecated auth. See BACKLOG T-011.) |
| Financial ledger | Append-only, hash-chained, immutable, tenant-scoped | Module: milestone-unlock escrow (construction), royalty distribution (label), F&B minimum tracking (hospitality) | Partial (two coexisting incomplete payout systems; unified spine pending. See BACKLOG T-005 and cron pause commit `13655a0`.) |
| Knowledge pools | Per-tenant vector storage, document upload, semantic search | Module: industry-specific knowledge templates (tournament runbooks, sermon series guides, construction SOPs) | Designed (specified in `ARCHITECTURE_VISION.md` v3; not yet built) |
| Vocabulary overlay | System that maps primitives to industry language at render time | Module: the overlay FILE itself (construction-vocab.json, hospitality-vocab.json, church-vocab.json) | Designed (rendering pipeline not built; overlay schema will be defined in `PHASE_1_SCHEMA.md`) |
| Adapter framework | Pattern for reading from external tools, webhook ingestion, sync scheduling | Module: specific adapter implementations (MondayAdapter, QuickBooksAdapter, PMSAdapter, PlanningCenterAdapter) | Designed (pattern documented; no adapters built yet) |
| Ralph (AI concierge) | Natural language interface to platform state, tool use, query generation | Module: industry-specific prompt templates, domain-specific tool sets | Partial (slash-command interface working; agent loop and grounding not yet built. See `RALPH_BLUEPRINT.md`.) |
| Event store / outbox | Message bus for cross-service communication, audit trail | None — infrastructure is universal | Partial (outbox table exists per April `ARCHITECTURE.md`; worker not built. See BACKLOG T-014.) |
| Module registry | Feature flag system, module activation/deactivation per tenant | None — the registry itself is substrate | Designed (concept defined; table and activation logic not built. See BACKLOG T-013.) |

### 2.3 What NEVER goes in substrate

The following are MODULE-ONLY. If you find yourself adding these to core
migrations, you are violating the boundary:

- Tournament bracket logic, Swiss pairings, seeding algorithms
- Room block management, F&B minimum tracking, housekeeping coordination
- Sermon series planning, small group management, mission trip coordination
- Milestone-based payment unlocks, permit tracking, subcontractor certification
- Release calendar coordination, royalty splits, playlist pitching
- Broadcast encoding, stream key management, clip production workflows
- Vehicle service scheduling, fleet maintenance schedules, service bay allocation
  (note: "DMV" in the CarBarDMV name refers to the DC/Maryland/Virginia service
  region — a geographic location, not the Department of Motor Vehicles. Do not
  build regulatory compliance features labeled "DMV" without founder
  clarification.)
- Retail kiosk UI, duty-free pricing rules, traveler loyalty programs

---

## 3. The modules (tenant-specific, feature-flagged)

### 3.1 Module naming convention

Modules exist at two levels:

**Code namespace:** `modules/{module_name}/` in the application repo, containing:

```
modules/{module_name}/
  ├── schema/          # Module-specific tables (if any)
  ├── api/             # Module-specific API routes
  ├── ui/              # Module-specific components
  ├── prompts/         # Module-specific Ralph prompts
  ├── adapters/        # Module-specific external integrations
  └── docs/            # Module documentation
```

**Database namespace:** Module-specific schemas in Postgres (e.g., `tournament.*`,
`broadcast.*`, `hospitality.*`). This aligns with the schema-boundary discipline
already established in the April `docs/ARCHITECTURE.md`. Modules that need their
own tables put them in their own schema. Modules that only need JSONB extensions
of substrate tables don't need their own schema.

Reconciliation with April `ARCHITECTURE.md`: the April document defined 9 module
schemas (core, tournament, broadcast, audience, feed, clips, venue, metrics,
integrations, ops). Some of those (tournament, broadcast) map directly to
modules in this document. Others (audience, feed, clips, venue) are event-and-
esports-specific and are best understood as sub-modules or peer modules serving
the MAJH Esports and MAJH Studio operational needs. `docs/ARCHITECTURE.md` v2 will
finalize the reconciled module taxonomy.

### 3.2 Current modules (built for MAJH Events, available to future tenants)

The following modules are being built to serve MAJH Events tenant operations.
Each will be available to any future tenant that activates it.

#### Module: `tournament` (MAJH Esports)

- **Built for:** MAJH Esports tournament operations
- **Available to:** Any future tenant running tournaments (esports leagues,
  community competitions, corporate gaming events)
- **Implementation status:** Partial. Tournament tables exist. Bracket logic
  and pairings pending T-020, T-027, T-028 in BACKLOG.

| Feature | Substrate foundation | Module layer |
|---|---|---|
| Tournament entity | `entities` supports "tournament" type with JSONB bracket data | Bracket generation, Swiss pairing, seeding logic, prize distribution |
| Player participant | `participants` supports "player" role | Player registration, skill rating, team formation |
| Streaming resource | `resources` supports "streaming_station" type | Stream key management, broadcast scheduling, clip production |
| Tournament payment | `payments_in/out` handle entry fees and prizes | Prize pool calculation, payout rules, winner verification |

#### Module: `broadcast` (MAJH Studio)

- **Built for:** MAJH Studio live event production
- **Available to:** Any tenant hosting broadcasts (churches streaming services,
  conferences with livestreams, corporate events)
- **Implementation status:** In flight. LiveKit + Mux architecture defined in
  April `ARCHITECTURE.md` §2.4 and §5. Caster Studio and Egress wiring scoped
  as T-118 (May 16). Actual current state should be verified against latest
  commits before agents extend this module.

| Feature | Substrate foundation | Module layer |
|---|---|---|
| Broadcast entity | `entities` supports "broadcast" type | Event Type Profiles (Gaming, Church, Conference, Music, etc.), A/V workflow templates |
| Crew participant | `participants` supports "crew" role | Crew scheduling, role assignments (camera, audio, director), call sheets |
| Equipment resource | `resources` supports "av_equipment" type | Equipment checkout, calibration tracking, transport logistics |
| Production payment | `payments_in/out` handle production costs | Budget tracking, vendor payment scheduling, cost-per-broadcast analytics |

#### Module: `vehicle_service` (CarBarDMV)

- **Built for:** CarBarDMV mobile vehicle service operations in the DC/Maryland/
  Virginia region
- **Available to:** Any tenant running a service fleet (auto shops, mobile
  services, delivery fleets)
- **Implementation status:** Not started. Operational needs currently handled
  outside the platform. Migration into MAJH OS scoped as future BACKLOG work
  (T-201 area in April BACKLOG).

| Feature | Substrate foundation | Module layer |
|---|---|---|
| Service entity | `entities` supports "service_job" type | Service scheduling, parts ordering, technician assignment |
| Customer participant | `participants` supports "customer" role | Customer vehicle history, service reminders, loyalty tracking |
| Bay resource | `resources` supports "service_bay" type | Bay scheduling, turnaround time optimization, capacity planning |
| Service payment | `payments_in/out` handle service fees and parts | Estimate-to-invoice workflow, parts markup tracking, warranty claims |

#### Module: `hospitality` (Tradewinds RB)

- **Built for:** Tradewinds restaurant, bar, and event catering at Barbados HQ
  and St. Lucia Hub
- **Available to:** Any tenant in F&B/hospitality (restaurants, bars, catering
  companies, hotel F&B departments)
- **Implementation status:** Not started. Operational needs currently handled
  outside the platform.

| Feature | Substrate foundation | Module layer |
|---|---|---|
| Reservation entity | `entities` supports "reservation" type | Table management, waitlist, seating optimization, group bookings |
| Guest participant | `participants` supports "guest" role | Guest preferences, dietary restrictions, visit history, VIP status |
| Table/kitchen resource | `resources` supports "table" or "kitchen_station" type | Table turn optimization, kitchen load balancing, catering equipment |
| F&B payment | `payments_in/out` handle checks and tabs | Split checks, gratuity distribution, F&B cost analysis, menu profitability |

#### Module: `retail_kiosk` (TRS)

- **Built for:** TRS retail kiosk at Barbados Airport
- **Available to:** Any tenant running POS retail (airport retail, pop-up shops,
  event merchandise)
- **Implementation status:** Not started.

| Feature | Substrate foundation | Module layer |
|---|---|---|
| Sale entity | `entities` supports "sale" type | Inventory management, SKU tracking, reorder points, shrinkage |
| Customer participant | `participants` supports "shopper" role | Purchase history, traveler loyalty, duty-free eligibility |
| Kiosk resource | `resources` supports "kiosk" or "shelf" type | Kiosk staffing, shelf allocation, display rotation |
| Retail payment | `payments_in/out` handle sales and refunds | Tax calculation, currency conversion, duty-free processing, daily reconciliation |

### 3.3 Future modules (not yet built, scoped for later verticals)

#### Module: `construction` (Target: Construction Firm Tenant)

| Feature | Substrate foundation | Module layer |
|---|---|---|
| Project entity | `entities` supports "project" type | Milestone tracking, Gantt views, permit workflows, subcontractor management |
| Client participant | `participants` supports "client" role | Client portal, change order tracking, payment schedule |
| Equipment resource | `resources` supports "construction_equipment" type | Equipment scheduling, maintenance logs, utilization rates |
| Project payment | `payments_in/out` handle deposits and draws | Milestone-unlock escrow, retainage tracking, lien waiver management |

**Design question flagged for `ARCHITECTURE.md` v2:** Escrow may be a substrate
primitive (holding funds against a condition, general across verticals) rather
than a module-specific feature. `ARCHITECTURE_VISION.md` v3 §7 names "escrow as
a holding primitive" at the substrate level. This document tentatively places
milestone-unlock escrow at the module level. The architecture doc will resolve
this — likely by having a general `escrow_accounts` substrate table with per-
module release-rule logic.

#### Module: `church` (Future Vertical)

| Feature | Substrate foundation | Module layer |
|---|---|---|
| Service entity | `entities` supports "service" type | Sermon series planning, liturgical calendar, small group scheduling |
| Congregant participant | `participants` supports "congregant" role | Membership directory, spiritual gifts tracking, volunteer scheduling |
| Room resource | `resources` supports "sanctuary" or "classroom" type | Room booking, setup/teardown coordination, A/V scheduling |
| Church payment | `payments_in/out` handle tithes and donations | Campaign tracking, tax receipts, mission fund allocation, pledge management |

#### Module: `label` (Future Vertical — Zach)

| Feature | Substrate foundation | Module layer |
|---|---|---|
| Release entity | `entities` supports "release" type | Release calendar, distribution timeline, marketing beat planning |
| Artist participant | `participants` supports "artist" role | Contract tracking, royalty rates, catalog management, tour logistics |
| Studio resource | `resources` supports "studio" or "venue_slot" type | Studio booking, engineer scheduling, session management |
| Label payment | `payments_in/out` handle advances and royalties | Royalty distribution, recoupment tracking, sync license payments |

---

## 4. The Barbados opportunity — mapped correctly

### What MAJH Events does in Barbados (tenant business)

MAJH Events, as a tenant on MAJH OS, partners with Barbados hotels to:

- Produce event series (gaming tournaments, live music, corporate events) at
  hotel venues
- Use hotel infrastructure (ballrooms, F&B, housekeeping, AV) rather than
  duplicating it
- Deliver unified data and reporting to the hotel it wouldn't otherwise have
- Leave hotel infrastructure intact, but smarter and better-informed

**This is MAJH Events revenue.** See `docs/majh_events/BARBADOS_SALES_MOTION.md`
for the operational playbook.

### What MAJH OS enables (platform value)

MAJH OS provides the substrate that makes this partnership possible:

- Shared entity tracking (events, bookings, resources)
- Unified financials (event revenue in one view)
- Knowledge pools (what worked, what didn't, customer preferences)
- Adapter framework (reads from hotel PMS if the hotel is willing and if we've
  built that adapter)
- Ralph as concierge for MAJH Events operational staff

**This is platform capability, not tenant business.**

### The natural progression

1. **Now:** MAJH Events uses MAJH OS to deliver value to Barbados hotels as an
   event producer / venue partner
2. **Later:** Hotels see what's possible and may want MAJH OS for their own
   operations
3. **Then:** Hotels onboard as MAJH OS tenants themselves, activating the
   `hospitality` module
4. **Result:** Two-sided value — MAJH Events (producer) and hotels (venue) both
   operating on MAJH OS

The hotel does not need to be a MAJH OS tenant for MAJH Events to deliver value.
MAJH Events delivering value is what could convince the hotel to become a
tenant. The MAJH OS sale is downstream of the MAJH Events success, not a
prerequisite for it.

---

## 5. Agent work assignment rules

### Before any agent writes code

1. Read this document. Identify whether your task is substrate or module.
2. Check the BACKLOG. Is your ticket labeled `substrate` or `module:{name}`?
3. If substrate: your code goes in `core.*` namespaces. It must work for every
   tenant. It must not contain industry-specific logic.
4. If module: your code goes in `modules/{name}.*` namespaces. It must be
   feature-flagged. It must declare its substrate dependencies.
5. If unsure: ask in the agent coordination channel. Do not guess.

### Code review checklist

| Question | Substrate | Module |
|---|---|---|
| Would this work for a construction firm? | YES (required) | N/A (module-specific) |
| Does it modify universal primitives? | Only to extend, never to specialize | No — uses primitives as-is |
| Is it behind a feature flag? | NO | YES |
| Does it require vocabulary overlay? | NO (substrate is language-agnostic) | YES (module provides overlay file) |
| Can it be deactivated without breaking other tenants? | N/A (always on) | YES (must deactivate cleanly) |
| Does it have module-specific tables? | NO | YES (in `modules/{name}/schema/`) |

### Forbidden patterns (will be rejected in code review)

- Adding `tournament_bracket` column to the `entities` table (belongs in module
  JSONB or module table)
- Hard-coding "player" or "guest" or "client" into substrate auth logic
- Adding hotel-specific fields to `resources` table (use JSONB or module table)
- Building Ralph prompts that assume hospitality context in substrate code
- Creating adapter logic that only works with Monday.com in the adapter
  framework itself (framework must be generic; Monday specifics live in the
  Monday adapter)
- Adding F&B minimum tracking to the financial ledger (ledger is universal;
  F&B tracking is module)
- Cross-tenant queries anywhere except explicitly-designed platform admin tools
- New auth-checking patterns not going through `organization_members`

---

## 6. The flagship-feeds-substrate principle in practice

### Example: building tournament support for MAJH Esports

**Week 1: Substrate work**
- Extend `entities` table to support "tournament" entity type with JSONB
  bracket data
- Extend `participants` table to support "player" role
- Extend `resources` table to support "streaming_station" type
- Update vocabulary overlay system to render "tournament" and "player" in UI
- Result: every tenant can now track tournaments, players, and streaming
  stations conceptually (with appropriate module activated)

**Week 2: Module work**
- Build `modules/tournament/bracket.ts` — bracket generation algorithms
- Build `modules/tournament/seeding.ts` — Swiss pairing, seeding logic
- Build `modules/tournament/prizes.ts` — prize pool calculation, payout rules
- Build `modules/tournament/ui/BracketView.tsx` — tournament-specific UI
- Build `modules/tournament/prompts/ralph-tournament.md` — Ralph prompts
- Result: MAJH Esports gets tournament management. Future tenants can activate it.

**Week 3: Integration**
- Wire module into MAJH Events tenant config (feature flag: `tournament: true`)
- Test with real MAJH Esports data
- Document module dependencies and activation process
- Result: MAJH Esports operates. MAJH OS gains a tournament module.

### What this prevents

Without this discipline:
- `entities` table grows 50 columns for every vertical
- Auth logic hard-codes hospitality assumptions
- Financial ledger becomes F&B-specific
- Ralph only understands events, not projects or services
- New vertical onboarding requires schema migration, not just module activation

With this discipline:
- `entities` table stays lean (`id`, `tenant_id`, `type`, `name`, `status`,
  `jsonb_data`, timestamps)
- Auth is universal (user → `organization_members` → role → permissions)
- Ledger is universal (every transaction is a `payment_in` or `payment_out`)
- Ralph speaks every vertical's language via vocabulary overlay + module prompts
- New vertical onboarding = new overlay file + activate relevant modules

---

## 7. MAJH Events is not a demo

### What MAJH Events actually is

- **MAJH Esports:** Real tournaments, real players, real prize pools, real
  streaming (implementation status per module table above)
- **CarBarDMV:** Real vehicle service operations, real customers, real revenue
  (active Thursday-Monday)
- **Tradewinds RB:** Real restaurant and bar, real F&B operations, real
  catering (operational; not yet on platform)
- **TRS:** Real retail kiosk at Barbados Airport, real sales, real inventory
  (operational; not yet on platform)
- **Gamestore return:** Real pop-up and permanent gamestore operations under
  the MAJH Events banner (planned relaunch)
- **MAJH Studio:** Broadcast production infrastructure in flight per April
  `ARCHITECTURE.md` §2.4. Actual current state should be verified against
  latest commits before agents assume feature completeness.
- **Barbados hotel partnerships:** Sales motion in early conversations. See
  `docs/majh_events/BARBADOS_SALES_MOTION.md`.

### What MAJH Events generates for MAJH OS

- **Operational data:** Real transactions, real entities, real participants,
  real payments — the input for the platform's own knowledge accumulation
- **Feature requirements:** What actually breaks, what users actually need,
  what generates revenue
- **Module templates:** Every feature becomes a reusable module
- **Case studies:** "How MAJH Esports runs tournaments on MAJH OS" → "How your
  esports league can too"
- **Revenue:** Cash flow that extends runway while external MAJH OS tenants
  are being signed

### What MAJH Events does NOT do

- It does not prove the platform works for construction (that's the
  construction pilot)
- It does not replace external MAJH OS tenant revenue (that's the construction
  pilot + future tenants)
- It does not make MAJH OS a "hospitality platform" (substrate remains
  vertical-agnostic)

---

## 8. Quick reference: substrate vs. module decision tree

```
Is this feature needed by EVERY tenant (construction, church, label, hotel)?
  ├── YES → SUBSTRATE
  │     └── Examples: auth, ledger, RLS, knowledge pools,
  │         vocabulary overlay system, adapter framework,
  │         Ralph core, universal primitives
  │
  └── NO → Is it needed by MAJH Events specifically?
        ├── YES → MODULE (built for MAJH Events, available to future tenants)
        │     └── Examples: tournament brackets, broadcast encoding,
        │         F&B tracking, vehicle service scheduling,
        │         retail kiosk UI
        │
        └── NO → Is it needed by a specific future vertical?
              ├── YES → MODULE (scoped for that vertical, not built yet)
              │     └── Examples: sermon series planning,
              │         milestone unlock escrow, royalty distribution,
              │         permit tracking
              │
              └── NO → STOP. Why are you building this?
                      Define the tenant first.
```

---

## 9. Companion documents

- `docs/STRATEGIC_DIRECTION.md` — strategic frame, commercial priorities, why
  we're building what we're building
- `docs/ARCHITECTURE.md` — technical architecture, four-level model, module
  taxonomy reconciliation
- `docs/PHASE_1_SCHEMA.md` — SQL for the substrate foundation
- `docs/RALPH_BLUEPRINT.md` — realistic Ralph build plan
- `docs/BACKLOG.md` — task queue with substrate/module labels
- `docs/AGENT_COLLABORATION_PROTOCOL.md` — how multiple agents coordinate
- `docs/ARCHITECTURE.md` (April 2026) — historical module list; reconciled
  with the taxonomy in this document by `ARCHITECTURE.md` v2

---

*The substrate is boring by design. The modules are where the industry-specific
magic happens. Boring substrate + rich modules = scalable platform.*
