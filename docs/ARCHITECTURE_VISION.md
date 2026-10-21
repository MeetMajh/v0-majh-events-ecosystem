# MAJH OS — Architecture Vision

**Status:** Foundational document. Captures the platform thesis,
architectural principles, and target verticals. Specifics live in
companion docs (forthcoming): SOVEREIGN_STACK.md, PHASE_1_SCHEMA.md,
TENANT_ONBOARDING.md, FINANCIAL_SPINE.md, ADAPTER_PATTERN.md,
KNOWLEDGE_POOLS.md.

**Last updated:** June 17, 2026 (Malchijah Harding)

**Version:** 3.0.0

---

## 1. Thesis

MAJH OS is the operational foundation that lets organizations focus
on serving their communities instead of wrestling with disconnected
software.

It is a multi-tenant **Service Operating System (SOS)** — the
infrastructure layer that services run on. Not a service desk. Not
a help ticket system. The foundation beneath every operational tool
a tenant uses, the way an operating system sits beneath every
application on a computer. Tenants log into the surface. The
substrate makes the surface possible.

Construction firms, churches, record labels, event venues, esports
organizers, conference producers, hospitality operators — they all
run their operations through it. Each one sees a platform that
speaks their vocabulary, wears their branding, and fits their
workflow. Underneath, every tenant uses the same primitives.

We are the technology layer beneath the operations. We don't
replace the tenant's existing tools — we sit between them, add the
features they can't get anywhere else, and absorb them when the
tenant is ready. The tenant keeps autonomy. The tenant keeps their
data. The tenant keeps their relationships with customers, staff,
and vendors. We provide the foundation that makes all of it run
together.

The first tenant is MAJH Events itself — the proof that the model
works. The second tenant is a construction firm — the proof that
the model travels and generates revenue. After that, churches,
labels, hospitality, and professional services follow.

This is a community-rooted project. Built by community members to
solve problems community members face. *No you, no me, but we.*

---

## 2. Frictionless Adoption

**MAJH OS earns replacement rather than requiring it.**

The platform creates value before requiring behavioral change. We
never ask a customer to abandon the tools they already use. They
keep Monday.com. They keep QuickBooks. They keep Stripe. They keep
their existing CRM, their existing accounting, their existing way
of doing things.

We connect alongside what they have. MAJH OS reads from their
tools, adds capabilities those tools cannot provide (financial
spine, customer-facing portals, AI cost analysis, milestone-unlock
escrow, knowledge pools), and gradually becomes the layer the
customer's operations run on.

When the customer is ready, we offer a full migration path that
loses nothing. Their existing data flows into the unified schema.
Their tools are imported as adapters. Their team members are
imported as participants. The vocabulary overlay is configured for
their industry. They keep working without disruption.

This is the anti-rip-and-replace pattern. It removes the largest
objection in B2B sales: "we already have something." Of course you
do. Keep it. We work with it. We earn the right to replace it.

The same pattern works across industries. A church already uses
Planning Center. We shadow it, add donor analytics and ministry
coordination Planning Center can't do, and migrate when the church
chooses. A record label already uses Sound Better. We shadow it,
add royalty distribution and tour finance the label can't get
elsewhere, and migrate when the label chooses. A hotel already uses
its property management system. We shadow it, add unified financial
spine and B2C customer portals it can't provide, and migrate when
the hotel chooses.

The substrate absorbs anything by translating it into universal
primitives.

---

## 3. The Moat: Composable Multi-Tenant Architecture

BuilderTrend wins on construction features. Planning Center wins on
church features. Sound Better wins on label features. None of them
sell what we sell: the infrastructure that runs underneath all of
them. We win on something they can't copy — the substrate beneath
the surface.

We win by being the substrate, not the surface.

This means: no domain-specific noun appears in the foundation
layer. Tournaments, projects, congregations, releases — these are
tenant-level labels mapped onto universal primitives. The same
record in the database could be a tournament for one tenant and a
project for another. The presentation layer translates it.

**The moat is real only if we can prove it.** A new vertical is
ready when Ralph (our AI engineering assistant) can generate its
vocabulary overlay (JSON file), demo data (SQL seed script), and
adapter template (TypeScript interface) from a 10-minute
conversation with a domain expert. A human reviews, approves, and
commits. If Ralph needs to ask for a new database table to support
the new vertical, the foundation is wrong, and we fix the
foundation before adding the vertical.

The first tenant of any new vertical is a **co-creator**, not just a
customer. We interview their team, map their language to our
primitives, and Ralph generates the initial overlay. The tenant
reviews and approves. Subsequent tenants in the same vertical
inherit the overlay, with optional customization. The first
construction tenant shapes construction vocabulary for everyone who
follows. The first church tenant shapes church vocabulary. The
overlay becomes a community asset that compounds over time.

---

## 4. Universal Primitives

Every tenant operates on the same six primitives, regardless of
industry.

**Tenant.** The organization using the platform. Has branding,
region, plan tier, integrations. Owns all data scoped to its
tenant_id.

**Entity.** The thing being tracked. Tournament for esports.
Project for construction. Campaign for a label. Congregation drive
for a church. Conference for event production. Booking for
hospitality. Universal at the foundation, labeled at the surface.

**Participant.** A person involved in an entity. Player for
esports. Crew member for construction. Donor for church. Artist for
label. Attendee for conference. Guest for hospitality. One identity,
many roles.

**Resource.** Anything scheduled, allocated, or consumed against an
entity. Streaming stations for esports. Equipment, vehicles, and
materials for construction. Sanctuary rooms and ministry teams for
church. Studio time and tour buses for a label. Tables, judges, and
bartenders for events. Hotel rooms and staff shifts for hospitality.
The Resource primitive is what makes the platform handle service-
delivery workflows across every vertical — anywhere capacity meets
demand.

**Payment In.** Money entering the system. Entry fee for esports.
Milestone deposit for construction. Tithe for church. Ticket
purchase for event. Room reservation for hospitality. Always tracked
in cents. Always immutable.

**Payment Out.** Money leaving the system. Prize payout for esports.
Subcontractor draw for construction. Ministry support for church.
Royalty payment for label. Honorarium for conference speaker.
Vendor payment for hospitality.

Domain-specific data lives in JSONB columns adjacent to these
primitives, not in the primitives themselves. A construction project
stores its estimated and actual hours, materials, milestones in
JSONB. An esports tournament stores its bracket data, prize
structure, format in JSONB. The relational core stays clean and
universal.

---

## 5. The Vocabulary Overlay

This is the mechanism that makes one substrate work for any
industry.

Each tenant has a `vocabulary_overlay` configuration that maps
universal primitives to the language of their industry. The database
never changes. The UI never hardcodes industry-specific nouns. The
overlay does the translation at render time.

```json
{
  "tenant_id": "uuid",
  "industry_type": "CONSTRUCTION",
  "vocabulary": {
    "entity": "Project",
    "entity_plural": "Projects",
    "participant": "Crew Member",
    "participant_plural": "Crew",
    "resource": "Equipment",
    "payment_in": "Deposit",
    "payment_out": "Draw",
    "statuses": {
      "DRAFT": "Estimate",
      "ACTIVE": "In Progress",
      "COMPLETED": "Final Inspection"
    }
  }
}
```

A church tenant's overlay maps `entity` to "Campaign," `participant`
to "Donor," `resource` to "Ministry Team," `payment_in` to "Tithe,"
`payment_out` to "Ministry Support." A label tenant's overlay maps
`entity` to "Release," `participant` to "Artist," `resource` to
"Studio Time," `payment_in` to "Streaming Revenue," `payment_out`
to "Royalty Distribution."

Same underlying records. Different labels in the UI. New verticals
require a new overlay file, not new database tables.

---

## 6. Knowledge Pools

Each tenant accumulates reusable organizational knowledge that
becomes the operational memory of their business.

A construction firm's knowledge pool holds project templates, job
estimates, change-order workflows, subcontractor scorecards, safety
SOPs, customer interaction histories, AI-generated summaries of
past projects, marketing assets, pricing structures.

A church's knowledge pool holds ministry team rosters, donor
relationship histories, building campaign templates, sermon series
archives, volunteer coordination patterns, event playbooks.

An esports organizer's knowledge pool holds tournament rule sets,
venue layouts, registration templates, prize distribution
structures, sponsor relationships, livestream production checklists.

**Storage and retrieval.** Knowledge pools are stored as structured
JSONB records in PostgreSQL, indexed by tenant_id and entity_type.
Each record carries a content field (text), a source field (which
system it came from — Monday.com, manual entry, AI generation), and
an embedding field (vector for semantic search via pgvector).
Subsystems query the pool through standard SQL joins for structured
retrieval, and through cosine similarity for semantic retrieval. The
CRM joins participant records against knowledge pool entries for
relationship context. The AI features retrieve top-k relevant
entries during workflow assistance. The reporting engine queries by
source and date for audit trails. The customer portal queries by
public-visibility flag for FAQ generation.

**Compounding generational value.** A competitor's blank installation
has none of this. A tenant who has used MAJH OS for two years has
thousands of structured records — project templates, pricing
structures, vendor scorecards, customer interaction patterns — that
their operations depend on. Exporting raw data is possible. Exporting
operational intelligence is not.

What looks like switching cost from a vendor lens looks like
**generational value** from a tenant lens. A church that uses the
platform across a 10-year succession of pastoral leadership inherits
a decade of accumulated congregation knowledge. A construction firm
that passes from founder to second-generation owner transfers the
entire operational memory of the business along with the books. A
record label that signs a new general manager inherits decade-old
artist relationship patterns and royalty structures.

This is legacy infrastructure, not just SaaS. The yield compounds
up and down the ecosystem. Two years on MAJH OS builds organizational
intelligence that would take ten years to assemble from scratch.

---

## 7. The Financial Spine

The financial system is the most important part of the platform
because it is the part customers trust us with directly. It must be
correct. It must be auditable. It must be tamper-evident.

This is also where the platform's broader thesis lives: **financial
indemnity as freedom.** Organizations that have clear, true insight
into their financial state can direct their resources toward the
end goal they actually exist to serve. Businesses serve customers
better. Churches serve their congregations better. Labels serve
their artists better. The financial spine is not bureaucracy. It is
the clarity layer that lets the mission breathe.

**Append-only.** No financial record is ever updated or deleted.
Corrections happen via balancing entries that reference the original
transaction. Application-level users cannot rewrite history;
corrections are represented as new events linked to prior entries.
The history is complete and visible to anyone with audit access.

**Hash-chained.** Each ledger entry includes the cryptographic hash
of the previous entry. If the application layer attempts to write
inconsistent data, the chain breaks and the system flags it
immediately.

The hash chain is **tamper-evident, not tamper-proof.** A database
administrator with full access to the storage layer can recompute
hashes. The chain protects against accidental corruption, silent
application bugs, and honest mistakes — not nation-state
adversaries. For higher-grade tamper-proofing, we would need
append-only write-ahead logs with cryptographic signatures stored
on a separate audit server. That is a Phase 2 feature for tenants
who require it (regulated industries, large-volume financial
flows).

**Escrow as a holding primitive.** Money can be held against a
thing — a tournament prize pool, a construction milestone, an event
ticket guarantee — and released when conditions are met. Escrow
accounts are universal; what triggers their release is per-domain.

**Polymorphic source linkage.** Payments Out reference a
`source_type` (e.g., `tournament_placement`, `project_milestone`,
`payroll_period`, `royalty_period`) and a `source_id` (the UUID of
the underlying entity). One disbursement pipeline serves all
verticals. Escrow holds release according to source-type-specific
rules.

**Funds originate from the tenant, not the platform.** Payments Out
flow from the tenant's own financial accounts (Stripe Connect
account, QBO-linked checking) to the recipient. The platform
records the transaction, enforces the release rules, but never
holds the funds. This keeps us a software company, not a money
transmitter. This is a legal moat as much as a technical one.

**MFA on amendments.** Any correction to the ledger requires the
tenant's designated financial officer to pass a multi-factor
challenge. The challenge result is logged alongside the amendment.
The platform operator cannot unilaterally modify any tenant's
ledger even with database access — the application-layer write
path requires tenant MFA.

**Tenant isolation via Row-Level Security.** Every query is scoped
to a tenant_id via Postgres RLS, enforced at the database level
rather than the application level. A tenant cannot read or write
another tenant's records, even if application code fails to filter
correctly. RLS coverage is universal in the foundation layer; the
exact count of policies on legacy tables is documented in
`docs/RLS_AUDIT.md` (forthcoming) with a remediation plan for any
gaps.

The financial spine is the part of the platform we will not
compromise on for speed. Every other layer can be rebuilt. The
ledger is forever.

---

## 8. Stack Philosophy: Sovereignty

We own our stack. Two external dependencies are acceptable: Stripe
for payments (PCI compliance is not a problem we solve ourselves)
and a domain registrar (ICANN requires accredited registrars).
Everything else is open source, self-hostable, and replaceable.

PostgreSQL for the database. Next.js for the application.
Self-hosted deployment infrastructure when we outgrow Vercel.
Open-source identity, open-source file storage, open-source
observability. Models for AI features run on our hardware where
they can; cloud inference is a burst-only fallback, never a default.

**Domain registrar mitigation.** We use a standard registrar
(Namecheap, Porkbun, or Cloudflare Registrar). DNS is self-hosted.
If the registrar fails, we transfer domains to a replacement in
under 48 hours. The registrar holds no operational data.

**Stripe mitigation.** We use Stripe Connect, which means tenant
funds flow through tenant-controlled Stripe accounts, not ours. If
Stripe deprecates the platform model, we have 90 days to migrate
to Adyen, Square, or PayPal under similar terms. The migration is
operational, not existential.

Sovereignty isn't ideology. It's risk management. Every vendor we
depend on is a future failure mode. By keeping the stack ours, we
make tenant promises we can actually keep.

This philosophy is documented in detail in
`docs/SOVEREIGN_STACK.md` (forthcoming).

---

## 9. Target Verticals

Six verticals over the next twelve months. Each one pressure-tests
a different part of the foundation.

**Events / Esports / Conferences.** MAJH Events itself is the
flagship tenant. The platform was born from this vertical. It is
where we have the most real-world experience. Pop-up tournaments,
scheduled conferences, gaming events, livestreams, ticket sales,
prize distribution, sponsor management. The universal primitives
were designed to fit this vertical first.

**Construction.** First paying B2B tenant target. The construction
client we are meeting with represents a $750K+ B2B contract pipeline
moving toward higher-margin B2C work. They need milestone-unlock
escrow, customer-facing project portals, real-vs-estimated variance
tracking, and integration with their existing Monday.com and
QuickBooks. This vertical pressure-tests the financial spine harder
than esports does — milestone-based escrow is a real differentiator
neither Monday.com nor QuickBooks offer.

Events is the flagship — the proof that the model works in
production with real users. Construction is the first paying B2B
tenant — the proof that the model generates revenue and travels
across industries. We sequence construction second in the vision
because the foundation must be proven before we sell it. In
practice, construction revenue funds the foundation work.

**Religious / Community.** Churches, ministries, community centers.
Donor management, tithe tracking, building campaign progress,
ministry team coordination, event scheduling. This vertical
pressure-tests the vocabulary overlay system — the same Entity
record is a "tournament" for one tenant and a "campaign" for
another. If this works for churches, the multi-tenant polymorphism
is proven.

**Media / Labels / Entertainment.** Record labels, artist management
firms, touring operations. Royalty distribution, artist roster
management, release campaign tracking, tour financial spine. This
vertical pressure-tests the disbursement pipeline — royalty splits
across multiple participants per payment cycle, recurring scheduled
distributions, complex source-of-funds tracing.

**Hospitality.** Hotels, venues, restaurants, event spaces. Room
management, staff scheduling, F&B operations, guest experience.
This vertical pressure-tests the Resource primitive — capacity,
allocation, time-based scheduling at scale.

**Professional Services.** Law firms, agencies, consultancies.
Matter management, billable hours, client portals, retainer
accounting. This vertical pressure-tests the time-based billing
flows and the customer-facing portal abstraction.

The architecture should not require fundamental changes for any
vertical we can name. If it does, the foundation is wrong, and we
fix the foundation before adding the vertical.

---

## 10. North Star Metrics

How we know the platform is working. These are targets, not
commitments. We expect to miss them initially and converge over
time. The metric is meaningful if it forces us to simplify the
foundation until the target becomes achievable.

**Time to onboard a new vertical.** Adding a new industry should
take days, not months. Realistically: 2-3 weeks for vertical #2
(construction), under a week for vertical #3, and days for vertical
#4 and beyond. If we cannot stand up a new vertical's vocabulary
overlay and demo data in under a week by vertical #3, the
foundation needs work.

**Time to demo a new tenant during a sales meeting.** During a live
meeting with a prospect, we should be able to spin up their company
as a tenant, populate it with realistic demo data, and walk them
through their dashboard in under fifteen minutes. This requires
Ralph (or scripted automation) to generate the demo data on demand.
If we cannot, the onboarding flow needs work.

**Infrastructure cost per small tenant.** Under $5/month at Hetzner
pricing for a tenant with under 100 users and under 1000 entities.
This is COGS (server, database, bandwidth) only — it excludes Stripe
payment processing fees (passed through to the tenant), domain
costs (passed through), and AI inference costs (variable, pricing
tier dependent). Our gross margin comes from SaaS subscription
tiers, not infrastructure arbitrage.

**Ledger integrity.** Zero unexplained gaps in the hash chain across
all tenants. Zero amendments without MFA verification. Zero cases
of tenant data leaking across tenant boundaries. These are binary
and auditable.

---

## 11. What's Built vs. What's Vision

Honest accounting as of June 17, 2026.

**Built and working:**
- MAJH Events platform with real users (25 users, 11 verified, 2
  staff) on www.majhevents.com
- Multi-tenant schema with tenant_id discrimination on most tables
- Stripe integration for event registration payments
- Supabase Auth with OAuth and email/password
- Row-Level Security on the majority of operational tables
- Auto-payouts cron (separate from process-payouts) — running fixed
  in production since June 11
- Tournament management, registration flow, match reporting,
  announcement system

**Designed but not yet built:**
- Universal financial spine (the unified ledger with hash chain
  and MFA — currently two incompatible payout systems coexist)
- Vocabulary overlay system (today everything reads as
  tournament/player/organizer)
- Knowledge pools (concept defined; storage and retrieval not yet
  implemented)
- Tenant onboarding flow (today new tenants are manually
  provisioned)
- White-label custom domain routing (today all tenants are on the
  main domain)
- Adapter pattern for Monday.com and QuickBooks (today no external
  system integration)
- Customer-facing portal (today no B2C dashboard exists)

**Partial / under review:**
- Payout architecture (cron paused June 16; see commit for context)
- Two incompatible payout systems coexist in the database;
  consolidation pending construction-client requirements input

The cron pause on June 16 is illustrative of how we operate. The
cron had been failing every 5 minutes for 5 days. No real money
was being affected. We documented what was broken, why, and what
conditions need to be met before we re-enable. We did not pretend
it worked. We did not paper over it. We paused, documented, and
moved on to the foundational work.

This is how trust gets built — with tenants, with collaborators,
with ourselves three months from now.

---

## 12. Related Documents

Forthcoming companions to this vision:

- **`docs/SOVEREIGN_STACK.md`** — specific technology choices, why
  we picked each component, replacement plan for each
- **`docs/PHASE_1_SCHEMA.md`** — the universal schema with seed
  data for the four target verticals
- **`docs/TENANT_ONBOARDING.md`** — the flow for provisioning a new
  tenant from sign-up to live data
- **`docs/FINANCIAL_SPINE.md`** — detailed design of the unified
  ledger, hash chain, escrow, and disbursement pipeline
- **`docs/ADAPTER_PATTERN.md`** — how external systems (Monday,
  QuickBooks, Stripe Connect) connect to the universal primitives
- **`docs/KNOWLEDGE_POOLS.md`** — design of the per-tenant
  operational memory store

This document is the north star. The companions are the
implementation detail. When this document and a companion disagree,
this document wins, and the companion gets updated.

---

*One substrate. Many surfaces. All true.*
