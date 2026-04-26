# Prompt Library

The v0 system prompt + reusable task prompt templates.

---

## v0 system prompt (paste into Project Instructions)

You are working on MAJHEVENTS, a multi-tenant platform for live event production, tournament operation, and audience engagement. Target launch is the Barbados convention in August 2026.
Hard rules — never violate without explicit approval in the prompt
DO NOT create new database tables. The schema is intentionally frozen while consolidation is in progress. If a feature seems to need a new table, stop and ask. Propose the table; do not create it.
DO NOT create new RLS policies. If existing policies don't cover a use case, stop and surface that. Do not write CREATE POLICY statements.
DO NOT call existing tables, functions, or features by names that imply more capability than they have. Specifically: do not describe anything as "ML" unless there is a trained model. Do not describe anything as "AI-powered" unless an actual model inference is happening. Do not use marketing language like "investor-grade", "enterprise-grade", "Stripe-comparable", "elite", "world-class". Describe what the code actually does, in plain terms.
DO NOT add npm dependencies without naming them in the response and waiting for approval. The project already has too many.
DO NOT generate code that references tables, columns, functions, or features that don't exist. If you're not sure something exists, ask before generating.
The architecture (canonical reference: docs/ARCHITECTURE.md)
The platform has these modules, each in its own database schema:
core: tenants, profiles, memberships, audit log, ledger, financial intents, KYC, notifications. Cross-cutting concerns.
tournament: tournaments, registrations, matches, pairings, brackets, results.
broadcast: stream rooms, broadcast sessions, scenes/sources/outputs, Mux primary, LiveKit secondary.
audience: live match pages, reactions, viewer presence, predictions, hype/trending, chat.
feed: content items, feed ranking, embeddings, follows.
clips: clip jobs, highlight candidates, replay buffers.
venue: events (ticketed), ticket types, tickets, check-in.
metrics: sponsor-facing reports, real-time dashboards, organizer KPIs.
integrations: API keys, webhooks, partner OAuth.
(Disabled until post-August: ads, catering, commerce, creator)
Cross-module references go through core foreign keys (user_id, tenant_id) only. No tournament.matches FK to fnb.orders, etc.
Tech stack — do not deviate
Next.js 16 App Router, React 19, TypeScript strict
Supabase (Postgres + Auth + Realtime + Storage)
Stripe Connect for payments (Express accounts for organizers)
Mux for live streaming and VOD; LiveKit for in-room WebRTC
Tailwind + shadcn/ui
Vercel hosting + Vercel Cron for scheduled jobs
Vitest for tests
Financial code — extra rules
When working on anything that touches money:
Every Stripe call goes through the financial_intents pattern: insert intent row first, then call Stripe with intent.id as idempotency key, then reconcile via webhook
Never default a financial transaction status to 'completed'
Always produce a row in core.audit_log for state transitions
Do not write code that bypasses the ledger to update wallet balances directly
When you're done with a task
End every response with a short "What I changed" section listing:
New files created (with paths)
Files modified (with paths)
npm dependencies added (if any)
Tables/policies/migrations touched (should usually be none — see hard rule 1)
Anything I started to build but stopped because it needed approval
Do not include marketing summaries, capability claims, or comparisons to other platforms. Just describe what the code does.

---

## Task prompt: Tournament check-in page (T-023)
Build the tournament check-in page at: app/(tenant)/tournaments/[slug]/check-in/page.tsx
Use the existing tables in tournament.* schema:
tournament.tournaments (read for window times)
tournament.registrations (read for status, write to mark checked_in)
Behavior:
The page is for an authenticated user only. Redirect to sign-in if not.
Look up the tournament by slug. If not found, render a 404 page.
Check if the user has a registration row for this tournament.
If no registration: show "You're not registered for this tournament."
If registration.status = 'checked_in': show success state with their seed/table info if available.
If outside [check_in_opens_at, check_in_closes_at]: show clear message with the window times in the user's local timezone.
Otherwise: show a "Confirm check-in" button.
The check-in mutation is a server action that:
Verifies all preconditions atomically (in one transaction).
Updates registrations.status to 'checked_in' and check_in_at to now().
Writes to core.audit_log via the lib/audit.ts helper.
Returns success or specific error.
Use shadcn/ui for layout (Card, Button). Use react-hook-form only if form complexity warrants it; for a single button, a plain form action suffices.
Do not create new tables, policies, or dependencies.

---

## Task prompt: Tournament list page (T-029)
Build a public tournament list page at: app/tournaments/page.tsx
Use only tournament.tournaments and tournament.games tables.
Behavior:
Paginated list, 20 per page, ORDER BY start_date DESC.
Filter chips: status (registration / in_progress / completed), game,
 format (swiss / single_elimination / etc), prize range.
Each card shows: name, game icon, format, status badge, start date, entry fee, prize pool, registered count vs max.
Cards link to /tournaments/[slug].
Visible to logged-out users.
Do not create new tables, policies, or dependencies. Use shadcn/ui Card, Badge, Select.

---

## Task prompt: Tournament detail / registration (T-030)
Build the public tournament detail page at: app/tournaments/[slug]/page.tsx
Read from tournament.tournaments, tournament.games, tournament.sponsors, tournament.prize_distributions, tournament.registrations (count only).
The page shows:
Hero with tournament name, dates, prize pool, entry fee
Game + format
Description (rich text)
Schedule (registration deadline, check-in window, start time)
Prize breakdown
Sponsors (if any)
Register button (logic below)
Register button behavior:
If not authenticated: redirect to sign-in, return URL = this page
If past registration_deadline: show "Registration closed"
If at max_participants: show "Tournament full"
If already registered: show "You're registered" + link to check-in
If entry_fee_cents = 0: server action creates registration row + audit_log entry, atomic
If entry_fee_cents > 0: redirect to /tournaments/[slug]/pay (T-021's payment page, which uses the financial_intents pattern)
Do not create new tables, policies, or dependencies. Use shadcn/ui throughout.

---

## Task prompt: Follows + follower count (T-046)
Add follow/unfollow capability between profiles.
Use the existing feed.follows table. Do not modify its schema.
Build:
Server action: toggleFollow(targetUserId) — inserts or deletes row
Component: <FollowButton targetUserId={...} /> — handles state, optimistic update, toast on error
Update profile page to show follower / following counts (read from profiles.follower_count and profiles.following_count which are maintained by triggers)
Do NOT add a trigger to update those counts — they should already exist. If they don't, stop and surface that as a separate task.
Do not create new tables, policies, or dependencies.

---

## Task prompt: Stripe Connect organizer onboarding (T-060)
Build the organizer Stripe Connect onboarding flow.
Pages: app/(dashboard)/organizer/payouts/setup/page.tsx (start) app/(dashboard)/organizer/payouts/setup/return/page.tsx (return) app/(dashboard)/organizer/payouts/setup/refresh/page.tsx (refresh)
Server actions:
createConnectAccount(): if profile.stripe_connect_account_id is null, create a Stripe Express account, save id to profile
createOnboardingLink(): create a Stripe AccountLink with our return and refresh URLs, return the URL
syncConnectStatus(): call Stripe accounts.retrieve, update profile.stripe_connect_status and stripe_connect_payouts_enabled
The setup page:
If status = 'complete' and payouts_enabled: show "You're set up" with link to dashboard
If status = 'pending' or 'incomplete': show "Continue Stripe onboarding" button → calls createOnboardingLink, redirects to Stripe-hosted URL
If status = 'not_started': show "Start" button → calls createConnectAccount then createOnboardingLink
Return page:
Calls syncConnectStatus, then redirects to setup page
Refresh page:
Calls createOnboardingLink, redirects
Do not store any Stripe-sensitive data beyond what's already in the profiles table. Do not create new tables.

---

## Reusable templates

### Template: A new public-facing page
Build a public page at app/<route>/page.tsx.
Read from <list specific tables in schema.module form>.
Behavior:
<bullet list of behaviors>
Visibility: <public | authenticated | tenant member | staff>
Use shadcn/ui components: <list>. Do not create new tables, policies, or dependencies.

### Template: A new server action
Add a server action at app/(...)/actions.ts called <name>.
It does:
<step>
<step>
Writes to core.audit_log via lib/audit.ts.
Preconditions (verify atomically): <list>.
Returns: <success shape> or { error: string }.
Use the financial_intents pattern if money is involved (see ARCHITECTURE.md §7).
Do not create new tables.

### Template: A new dashboard widget
Build a dashboard widget component at: components/dashboard/<Name>.tsx
It reads from <tables>.
It displays: <description>.
It updates via: ☐ static (data fetched on page load) ☐ polling every <N> seconds ☐ Supabase Realtime subscription on <channel>
Use shadcn/ui Card. Use recharts if charting. Do not create new tables.

---

## Anti-patterns to refuse if v0 produces them

If v0's response includes any of these, push back in the same session
before merging:

1. **New tables.** Stop. Why does this need a table?
2. **CREATE POLICY statements.** Stop. RLS isn't your job in this PR.
3. **New npm dependencies.** Why? What's the alternative with what we already have?
4. **Marketing language.** "Investor-grade", "enterprise-grade", "elite", "AI-powered" (when there's no AI), etc. Strip it.
5. **References to tables/columns that don't exist.** Stop and ask the user to verify.
6. **Catch-all admin endpoints with no permission check.** Every admin action must verify the caller is staff.
7. **Direct Stripe calls outside the financial_intents pattern.** Stop.
8. **Default status='completed'/'success' on financial rows.** Stop.
9. **Missing "What I changed" summary at the end.** Ask for it.
10. **A page bigger than ~300 lines.** Probably doing too much; ask for decomposition.

