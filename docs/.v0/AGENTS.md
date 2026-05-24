MAJH Events Platform — Agent Context
Last updated: May 18, 2026
This document is the canonical brief for any AI agent (v0, Claude, contractor, future-self) working on this codebase. Read it before making changes. The repository is in active production use; mistakes have operational and financial consequences.
What this platform is
MAJH Events is a multi-tenant operating system ("MAJH OS") for experience-based commerce. The platform supports a four-level architecture:
Platform → Tenant → Department → Location

Platform: MAJH OS itself (the software)
Tenant: MAJH Events (currently the only tenant; external tenants like LGS, hotels coming later)
Department: Four MAJH-owned operating lines under the MAJH Events tenant — esports, carbadmv, tradewinds-rb, trs
Location: Geographic instances of departments — DC Metro (CarBadMV), Barbados HQ (Tradewinds), St. Lucia Hub (Tradewinds), Barbados Airport Kiosk (T.R.S.), Digital (Esports)

Each department must support independent reporting (P&L, staff, inventory) while sharing core infrastructure (auth, CRM, financial ledger, knowledge base).
Stack (authoritative)

Frontend: Next.js 15 (App Router), React 19, TypeScript strict, Tailwind, shadcn/ui
Backend: Next.js server actions + route handlers
Database: Postgres via Supabase (project incmgtdfabzesatzbziz)
Auth: Auth.js with Discord and Google providers only (no email/password)
Payments: Stripe Connect (Express accounts for organizers)
Hosting: Vercel
Realtime: Supabase Realtime
Video: Mux for ingest and VOD; LiveKit reserved for future browser-based broadcast
Object storage: Cloudflare R2

If a task suggests adding a technology outside this list, stop and ask first.
Critical schema facts
Multi-tenant structure (Phase 1 deployed May 18, 2026)

tenants table holds the top-level tenant. Currently one row: MAJH Events (8dd63bc0-1742-478e-8743-dc55ce2b7127).
departments table — 4 MAJH departments seeded.
locations table — 5 locations seeded, with currency/timezone/tax_rate at the location level.
organization_members is the membership table. Has tenant_id (required), and nullable department_id and location_id for scoping.
organization_role_templates and role_template_permissions have nullable tenant_id and department_id columns for tenant-scoped role definitions. Existing 9 system roles and 103 permission mappings have these as NULL (platform defaults).

Authorization (current state, NOT what schema suggests)
The application code uses three parallel single-tenant authorization patterns:

requireRole() in lib/roles.ts — 25 places — queries staff_roles globally
Inline staff_roles queries — 107 places across /lib/*-actions.ts
profiles.role checks — 12 places (recent role-request system)

The schema supports tenant/department/location scoping. The code does NOT yet read those columns. Do not assume tenant-scoped authorization works. Do not "wire it up" without explicit instruction — that's a tracked migration (T-204) with its own plan.
Financial spine

Ledger uses proper double-entry: ledger_accounts, ledger_transactions, ledger_entries.
v_financial_summary view aggregates by tenant. Only 6 historical test transactions exist; no production financial volume yet.
Currently NO department_id or location_id on financial tables. Adding these is T-200 (next migration phase). Do not modify financial tables without explicit instruction.
All money in bigint cents. Never numeric or float. Currency stored as text ISO code.

Wizard (MAJH Guide) — schema deployed, no UI yet
Eight tables: guide_categories, guide_articles, guide_article_chunks, guide_ui_contexts, guide_conversations, guide_messages, guide_interactions_feedback, guide_tools. RLS on all of them. pgvector enabled.
3 starter articles, 4 UI context mappings, 3 read-only tool definitions seeded. UI does not exist. Embedding pipeline does not exist. Do not assume Wizard features work — only the data layer is ready.
See docs/wizard.md for full Wizard documentation.
Non-negotiables
These are hard rules. If a task seems to require violating one, stop and surface the concern before proceeding.
Atomicity on state transitions
Every match state transition, payment movement, and pairing write happens in a single transaction or Supabase RPC. No SELECT then UPDATE across separate queries without SELECT ... FOR UPDATE or equivalent locking.
RLS on every user-facing table
New tables holding user-owned data MUST include RLS policies in the same migration. No "we'll add RLS later." Service-role access from worker processes must be explicit and narrow.
Financial operations follow triple-guard pattern

Intent — write a financial_intents row with status='pending' BEFORE any external API call
Execute — call Stripe with intent UUID as idempotency key, store Stripe ID on intent
Reconcile — match Stripe webhook to intent, update status; reconciler sweeps stale pending intents

Never call Stripe from a request-response cycle without this pattern.
Audit log is append-only
audit_log has INSERT grant only — no UPDATE, no DELETE, for any role including service. Reversals happen via compensating rows, never modification.
Pairing algorithms use reference implementations
Do not hand-roll Swiss pairings. Use existing libraries or carefully-ported implementations with explicit DCI floor-rule test coverage.
Schema conventions

Snake_case table and column names
Every table has id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now()
Foreign keys always have explicit ON DELETE behavior. Prefer ON DELETE RESTRICT. No cascading deletes on user-owned data.
Soft deletes via deleted_at timestamptz null. RLS predicates include deleted_at IS NULL.
Money as bigint cents. Currency as text ISO code.

Repository structure

/app — Next.js App Router pages
/lib — server actions, business logic, Supabase clients
/components — React components (organized by domain)
/supabase/migrations — SQL migrations, ordered by timestamp prefix
/docs — canonical platform documentation

ARCHITECTURE.md — module boundaries, tenant model, reality-vs-target gaps
SCHEMA.md — every table tagged with status (KEEP/CONSOLIDATE/DROP/DEFER)
BACKLOG.md — task backlog with T-### identifiers
wizard.md — MAJH Guide subsystem reference


/scripts — diagnostic and migration helper SQL

Backlog priority order (May 18, 2026)
Current sequencing for major work streams:

T-200: Financial scoping — add department_id and location_id to ledger_transactions; update v_financial_summary for department aggregation. NEXT UP.
T-201: CarBadMV operational features — event booking, menu builder, food costing, staff scheduling. Replaces Total Party Planner.
T-202: Wizard UI (Phase C) — contextual help drawer, article rendering.
T-203: Wizard semantic search (Phase A) — embedding pipeline, vector search RPC.
T-204: Authorization migration — checkPermission() function, page-by-page migration of 144 single-tenant check points to tenant/department/location scoping.

Do not start T-201 work that writes to financial tables before T-200 completes. Department-scoped financial truth must exist before CarBadMV starts generating real ledger entries.
How to work
Before writing code

Read relevant files completely. Do not assume — look.
Check recent migrations in /supabase/migrations for naming conventions in actual use.
State your plan in 3-6 bullets before writing code.
Confirm with the user if the plan involves: money movement, RLS changes, pairing algorithm changes, or schema changes to existing tables.

Before merging schema changes

Migration file in /supabase/migrations with timestamp prefix
RLS policies in the same migration if user-facing data
A diagnostic query to verify state before changes
A verification query to confirm post-migration state
One paragraph in a human-readable changelog describing what an organizer or player would notice

When uncertain
Stop. Ask. Do not guess your way through ambiguity in financial code, pairing code, or RLS code.
Patterns that have caused production incidents
For your awareness — these have actually broken production in the past 30 days:

Missing icon imports — Radio was used in JSX without being imported from lucide-react. Crashed the dashboard. Always verify lucide-react imports include every icon used in the file.
Stale build cache — Vercel deployments showed "Ready" but served broken bundles. Force clean rebuild without cache when symptoms suggest stale code.
Fabricated column names — A previous agent wrote SQL referencing columns that didn't exist (financial_transactions.type = 'credit'). The actual schema uses ledger_entries.direction with ledger_accounts.account_type. Always run a reconnaissance query on information_schema.columns before writing SQL against unfamiliar tables.
PR scope expansion — Pull requests touching files unrelated to the stated task. Verify PR scope before merging. If a PR touches more than the stated change, ask why before approving.
Manual "I'm Streaming Now" toggle — Created false-live state in DB without Mux actually ingesting. Use Mux webhooks for stream status, not manual flags.

What NOT to do

Do not introduce new authorization patterns. Use existing requireRole() until T-204 lands.
Do not write to financial tables (ledger_*, financial_transactions, financial_intents, invoices, wallets, payouts) until T-200 completes.
Do not modify the audit_log table structure or any append-only triggers.
Do not change the four department slugs or five location slugs without explicit instruction (other code may reference them).
Do not add packages outside the stack list above without surfacing the addition.
Do not "fix" Radio imports or any other client-side errors without first reproducing the error in a fresh browser session and verifying with a console log.

Contact
Solo founder operates this platform. If you need product clarification, surface the question; do not invent answers. The cost of asking is one message; the cost of guessing wrong is a production incident.

End of file.
