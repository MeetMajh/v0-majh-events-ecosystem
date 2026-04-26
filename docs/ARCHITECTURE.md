# MAJHEVENTS Platform Architecture

**Status:** Authoritative. This document is the source of truth for module
boundaries, data ownership, and cross-module patterns. When code and this
document disagree, the document is right and the code is wrong.

**Last updated:** 2026-04-26  
**Owner:** Founder (changes require explicit decision, not v0 prompts)

---

## 1. What MAJHEVENTS is

MAJHEVENTS is a multi-tenant platform for live event production, tournament
operation, and audience engagement. It is positioned as the platform layer
beneath conventions, gaming events, and tournament organizers — not as a
SaaS for any single one of those audiences.

The platform's value proposition has two halves:

- **For organizers / venues / conventions:** Run your event end-to-end —
  registration, tickets, brackets, streaming, F&B, check-in, prize payouts —
  with one operating system that integrates into your existing infrastructure.
- **For audiences:** A live, dynamic, content-rich destination where matches
  are watchable, clippable, predictable, and discoverable. The audience
  surface is what convinces sponsors that the platform delivers reach.

The first paying customer is the Barbados convention in August 2026. The
second is positioned as a tournament-and-streaming-software customer
(Persona A). The architecture must serve both without code branching.

## 2. Hard architectural rules

These do not change based on convenience.

### 2.1 Module boundaries are enforced by Postgres schemas

Every table lives in exactly one module schema. Cross-module foreign keys
are restricted: a non-`core` module may only reference `core.*` tables by
foreign key. Two non-core modules may not have direct FKs to each other.

If `tournament` needs data from `feed`, it does so by emitting an event
that `feed` consumes — not by joining tables.

This rule exists because it lets us turn modules off per tenant without
breaking referential integrity, and because it lets the next contractor
or subagent reason about a single module without learning the whole system.

### 2.2 Money flows through one spine

There is exactly one financial spine, in `core`:

- `core.financial_intents` — every Stripe charge or transfer begins here.
  Status starts as `pending`. The intent's UUID is the Stripe idempotency
  key.
- `core.ledger_accounts`, `core.ledger_transactions`, `core.ledger_entries` —
  double-entry accounting. The source of truth for every balance.
- `core.audit_log` — append-only record of every state transition that
  matters. Enforced at the trigger level.

Every module that handles money creates intents and ledger entries through
this spine. Module-specific tables (`tournament_payments`, `ticket_orders`,
etc.) are read models, not sources of truth. They exist for convenience and
performance; they do not authorize any movement of money.

### 2.3 RLS is enforced at the database level

Every user-facing table has Row-Level Security enabled with explicit
policies. INSERT policies always have a `with_check` predicate that ties
inserted rows to the authenticated user; the pattern `with_check = true` is
forbidden.

The service-role key bypasses RLS by design. Code that uses the service-role
key is restricted to:
- Webhook handlers (Stripe, Mux, etc.)
- Scheduled jobs (Vercel Cron endpoints)
- Admin-only server actions where the calling user has been verified as
  staff via `core.organization_members`

A server action that takes user input and writes to a financial table using
the service-role key is a bug.

### 2.4 The audit log is append-only

`core.audit_log` has INSERT permitted to specific roles and UPDATE/DELETE
denied at the trigger level. To reverse a decision, insert a compensating
row. Never modify history.

### 2.5 Tenant feature flags gate access at the RLS layer

Every module-owned table includes a tenant-feature-flag check in its RLS
policies. A tenant that does not have `feature.fnb` enabled cannot read or
write `fnb.*` tables — not just hidden in the UI, but denied at the database.

This is what lets us pitch convention A "ticketing + tournaments" without
exposing them to F&B or catering features they didn't buy.

## 3. Module map

The platform is exactly these modules. Adding a module is an architectural
decision; do not let v0 invent new modules.

### 3.1 Active for Barbados (August 2026)

| Module | Schema | Owns | Depends on |
|---|---|---|---|
| Core | `core` | tenants, profiles, memberships, audit log, ledger, financial intents, KYC, notifications | nothing |
| Tournament | `tournament` | tournaments, registrations, matches, pairings, brackets, results | core |
| Broadcast | `broadcast` | stream rooms, broadcast sessions, scenes/sources/outputs, Mux integration, LiveKit integration | core |
| Audience | `audience` | live match pages, match chat (live, with moderation, locked after match), reactions, viewer presence, predictions, hype/trending, chat | core, tournament, broadcast |
| Feed | `feed` | content items, feed ranking, embeddings, follows | core, clips |
| Clips | `clips` | clip jobs, highlight candidates, replay buffers, manual + auto clipping | core, broadcast |
| Venue | `venue` | events (ticketed), ticket types, tickets, check-in, event-scoped chat rooms (lifecycle-bound to event) | core |
| Metrics | `metrics` | sponsor reports, real-time dashboards, organizer KPIs, cohort analysis | core (reads from many modules' read models) |
| Integrations | `integrations` | API keys, webhooks, partner OAuth, outbound events | core |

### 3.2 Disabled until post-August

These modules' tables stay in the codebase but are feature-flagged off and
do not load in any tenant's UI:

- **Ads** — advertiser self-serve, campaign management, ad serving
- **Catering** — the `cb_*` business: bookings, proposals, invoices, prep tasks
- **Commerce** — F&B menu, orders, inventory, points (separate from venue ticketing)
- **Creator** — creator earnings, payouts, monetization (separate from clips)
- **Community** — forums, community rooms (replaced by tournament/event-scoped chat for now)

These modules do not get developer attention until a paying customer
explicitly needs them. Re-enabling each one is a scoped post-Barbados project.

### 3.3 Operational

Not customer-facing modules; internal tooling:

- **Ops** — moderation actions/reports, system alerts, deployment integrity, chaos tests

## 4. Cross-module communication patterns

### 4.1 Outbox pattern

When a module's state change matters to another module, it writes to
`core.outbox` in the same transaction as the state change. A scheduled job
reads from `outbox`, fans out to consumers, marks the row processed.

Examples:
- `tournament` writes outbox row when match completes → `clips` worker
  considers the match for highlight clipping, `metrics` updates aggregates,
  `audience` invalidates cached match page
- `venue` writes outbox row when ticket is purchased → `metrics` updates
  ticket sales count, `core.notifications` sends confirmation email

Direct cross-module function calls or table joins to push state are forbidden.

### 4.2 Read models

A module that frequently needs another module's data may maintain a local
read model — a denormalized table that the consumer module owns and
populates from outbox events. The consumer's read model is read-only from
the producer's perspective.

Example: `audience.match_summary` denormalizes data from `tournament.matches`
+ `broadcast.stream_rooms` so the live match page can render in one query.
`audience` populates this from outbox events; `tournament` doesn't know it exists.

### 4.3 Real-time

Real-time updates flow through Supabase Realtime channels keyed by module
+ entity. Example: `audience:match:{match_id}` for live reactions and
viewer counts. Consumers subscribe; producers publish via the appropriate
realtime helper.

LiveKit handles WebRTC; Mux handles RTMP/HLS. Realtime carries metadata
(reactions, chat, viewer counts), not video.

## 5. Tech stack — frozen

Changes to this list require explicit decision. v0 does not get to add
dependencies.

- **Frontend**: Next.js 16 App Router, React 19, TypeScript strict mode,
  Tailwind, shadcn/ui
- **Backend**: Next.js server actions for mutations, route handlers for
  webhooks and external API surfaces, Vercel Cron for scheduled jobs
- **Database**: Supabase Postgres, schema-namespaced as above
- **Auth**: Supabase Auth with Discord and Google OAuth providers
- **Payments**: Stripe Connect (Express accounts for organizers); never
  handle card data directly
- **Live video**: Mux primary (RTMP ingest, HLS playback, VOD, clips API);
  LiveKit secondary (WebRTC for in-room player streams)
- **Object storage**: Vercel Blob (interim); migrate to Cloudflare R2 if
  storage costs justify
- **Email**: Resend
- **Hosting**: Vercel for the Next.js app; Supabase-hosted Postgres
- **Mobile**: Capacitor wrappers for iOS/Android (post-Barbados priority)

### 5.1 Worker model

For the Barbados scale (one tenant, ~thousands of attendees, dozens of
matches), Vercel Cron is sufficient. Scheduled jobs run as authenticated
route handlers under `app/api/cron/*` and use the service-role key.

Workers added when needed (post-Barbados): consider BullMQ on Upstash
Redis if real-time clip generation or feed ranking requires more than
cron-frequency processing.

## 6. Authentication and authorization model

Single source of truth: `core.organization_members`. A user is staff or
owner of a tenant if and only if a row exists in `core.organization_members`
with `is_active = true`.

Other authorization tables are deprecated and being migrated:
- `staff_roles` → migrate to `organization_members` with role_key mapping
- `tenant_memberships` → consolidate into `organization_members`
- `profiles.is_admin` → derive from membership in the platform-owner tenant
- `profiles.role` → drop

Every RLS policy that checks "is this user staff" must use
`core.organization_members` and only `core.organization_members`.

## 7. Financial spine pattern (canonical)

This is the pattern every payment-touching feature must follow. No
exceptions.

### 7.1 Intent

INSERT INTO core.financial_intents ( id, tenant_id, user_id, intent_type, amount_cents, currency, reference_type, reference_id, status, created_at ) VALUES ( gen_random_uuid(), :tenant, :user, :type, :amount, 'usd', :ref_type, :ref_id, 'pending', now() ) RETURNING id;

The returned ID is used as the Stripe idempotency key. The intent row is
the audit trail.

### 7.2 Execute
const stripeResult = await stripe.paymentIntents.create({ amount: intent.amount_cents, currency: intent.currency, application_fee_amount: intent.platform_fee_cents, on_behalf_of: organizerStripeAccountId, transfer_data: { destination: organizerStripeAccountId }, }, { idempotencyKey: intent.id });
await db.financialIntents.update(intent.id, { stripe_object_id: stripeResult.id, status: 'submitted' });

### 7.3 Reconcile

Stripe webhook handler matches event by `stripeResult.id`, finds the
corresponding intent, updates status to `succeeded` or `failed`, writes
the ledger entries, writes the audit log row.

A scheduled reconciler runs every 15 minutes and sweeps any intent in
`submitted` state older than 1 hour, querying Stripe directly for status.

### 7.4 What this prevents

- Double-charges (idempotency key per intent)
- Lost charges from missed webhooks (reconciler sweeper)
- Untraceable payments (every Stripe object has a corresponding intent row)
- Status drift (one source of truth: the intent's status)

## 8. What is NOT MAJHEVENTS

To prevent scope creep and v0-driven feature invention, the platform is
explicitly not:

- A general-purpose ML platform. Risk scoring, fraud detection, and
  recommendations are rules engines or simple statistics until proven
  otherwise. Do not name anything `ml_*` unless a trained model exists.
- An advertising platform. Convention sponsors are sold direct, not
  through a self-serve buying interface. The `ads.*` schema exists but
  does not load.
- A creator economy platform. Clip creators do not earn money on this
  platform until the creator module is explicitly enabled post-Barbados.
- A POS system. The `commerce.*` schema exists for venues that explicitly
  buy F&B add-ons; it is not the system's default surface.
- A CRM. The `catering.*` (`cb_*`) schema is a separate business that
  happens to share auth; it does not load for Barbados or platform tenants.

### 8.1 Community surface — what we build, what we don't

The platform has chat surfaces, but it is not a community platform. The
distinction matters because community products carry a moderation cost
that scales with persistence and surface area, not with user count, and
the major TCG and esports apps have correctly concluded that running
permanent community surfaces is not worth it.

**What we build:**

- **Match chat** (audience module). Tied to a specific match while it's
  live. Locked read-only 30 minutes after match completion. Twitch model.
  Bounded surface, contextual content, organizer-as-moderator. Core
  product because co-watching is what makes the live experience feel like
  an event.

- **Event-scoped rooms** (venue module). Rooms exist for the duration of
  a specific event (e.g., a 3-day convention). Auto-created when the
  event publishes; archived to read-only when the event ends. Multiple
  rooms per event for different topics (general, matches, vendors,
  help). Convention staff are auto-moderators. Bounded by event lifecycle.

**What we don't build (at all, or not yet):**

- **Persistent topic-based forums** (`forum_threads`, `forum_replies`).
  Long-form indexed content that lives forever. Carries the highest
  moderation cost. Deferred until after Barbados; a deliberate
  build-or-not decision in September based on retention data. If the
  feed is doing its job for between-event retention, forums stay deferred.

- **Persistent global community rooms** (Discord-style "MAJHEVENTS
  Community" general server). Not building, possibly ever. Discord has
  10 years of moderation tooling, social graph, voice infrastructure,
  and mobile clients we will not match. Every tournament organizer and
  convention attendee already has a Discord. Competing with Discord
  loses; integrating with Discord (post-Barbados, in `integrations`)
  is the strategic move.

- **Voice chat in rooms.** LiveKit can technically support it. Resist
  for August. Voice content cannot be moderated in real time, scaling
  the moderation problem by an order of magnitude. Reconsider only with
  a paying customer asking for it and a plan for how to moderate it.

**The strategic frame:**

MAJHEVENTS is alive when events are running. During an event, chat is
loud, reactions are flying, clips are being made, event rooms are
active. Between events, the feed is a slower passive surface where
clips and VODs accumulate, but the live energy is gone — and that's
correct, because the live energy belongs to the next event. People
come back when the next event happens.

This frame is defensible product positioning and it concentrates the
moderation burden into known time windows. A platform that promises
24/7 community must moderate 24/7. A platform that promises live event
experience must moderate during events. The second is achievable for
a small team; the first is not.

**Moderation toolkit, common to both surfaces:**

- Slow mode (configurable per match / per room)
- Soft-delete (no hard deletes; audit trail preserved)
- Timeouts via `core.user_restrictions` with metadata identifying scope
- AutoMod (server-side blocklist; tenant-customizable)
- Caster/moderator badges visible inline
- Server-side enforcement only (never trust client filtering)
- Read-only state after lifecycle ends (match completion + 30 min;
  event end immediately)

When a future feature request asks "should this be a community
feature," the answer is one of: bind it to live content (audience),
bind it to an event lifecycle (venue), or refuse and point to Discord.



## 9. Decision log

When an architectural decision is made, append it here with date and
rationale. This document is read by future-you and future contractors;
they need to understand *why*.

- 2026-04-26: Adopted 8-module + 1-ops architecture (this document's V1)
- 2026-04-26: Mux is primary video; LiveKit is secondary for in-room WebRTC only
- 2026-04-26: Catering / commerce / creator / ads modules deferred until post-Barbados
- 2026-04-26: `organization_members` chosen as canonical authorization table
- 2026-04-26: Community scope decision. Match chat (audience) and event-scoped rooms (venue) are first-class for August. Persistent forums deferred until post-launch with explicit retention review. Global community rooms not built; Discord integration replaces them long-term. Voice chat out of scope for August.

