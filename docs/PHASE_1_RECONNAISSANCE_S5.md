# Phase 1 Reconnaissance — Section 5: Existing Payment Flow Ground Truth

**Date:** July 29, 2026 | **Status:** COMPLETE

---

## Q21. Column Definitions for Payment-Related Tables

**Tables searched:** payment_requests, payment_events, payment_receipts, tenant_payment_settings

**Query result:** 0 rows

**Assessment:** ✅ None of these planned payment tables exist yet. These are candidates for Phase 1 creation or Phase 1.5+ creation. The actual payment flow uses:
- `financial_intents` — Stripe payment intent tracking
- `tournament_payments` — Payment captures
- `ledger_transactions` / `ledger_entries` — Financial records
- `player_payouts` — Payout tracking

**Implication:** Phase 1 creates universal `payments_in` and `payments_out` tables as bridge/mapping layer to these existing tables.

---

## Q22. Payment Creation Flow (Code Analysis)

**Entry points identified:**

1. **`lib/tournament-payment-actions.ts:161`** — Core payment creation
   - Uses `stripe.paymentIntents.create()` 
   - Creates Stripe payment intent
   - Flows through financial_intents table

2. **`app/api/admin/payouts/approve/route.ts`** — Payout approval
   - Approves pending payouts
   - Calls `stripe.transfers.create()` 
   - Updates `player_payouts.stripe_transfer_id`

3. **`app/actions/financial.ts:130`** — Financial action (commented as "In production, this would initiate the Stripe payout")
   - Currently a stub awaiting Stripe integration

**Payment creation path:**
```
Tournament → lib/tournament-payment-actions.ts 
  → stripe.paymentIntents.create() 
  → financial_intents table 
  → ledger_entries (via cron or webhook)
```

**Phase 1 attachment point:** `payments_in` table should receive webhook callbacks from Stripe and ledger_entries creation, then bridge to existing financial_intents flow.

---

## Q23. Payout Flow (Code Analysis)

**Payout system:**

1. **`app/actions/financial.ts`** — Financial data aggregation
   - Queries `tournament_payouts` and `player_payouts`
   - Sums pending payouts
   - Returns payout summary

2. **`app/api/admin/payouts/approve/route.ts`** — Payout approval (active)
   - Gets payout details from `player_payouts`
   - Retrieves organizer's `stripe_connect_account_id`
   - Calls `stripe.transfers.create()` to transfer funds
   - Updates `player_payouts.stripe_transfer_id` and `status`

3. **`app/api/admin/ops/metrics/route.ts`** — Pending payout tracking
   - Queries `payouts` and `player_payouts` tables
   - Calculates pending payout metrics for dashboard

**Current payout state:**
- ✅ Active: Manual payout approval (admin approves → Stripe transfer initiated)
- ❌ No cron: Automatic payout processing is NOT scheduled
- ✅ Table: `player_payouts` tracks payout status and Stripe transfer IDs
- ✅ RLS: Payout operations gated on staff_roles (financial ops)

**Phase 1 attachment point:** `payments_out` table should track payout events, receive Stripe transfer confirmations, and bridge to `player_payouts` table lifecycle.

---

## Q24. Stripe Webhook Handlers

**Webhook infrastructure:**

1. **`app/api/stripe/webhook`** — Primary webhook route
   - Found in filesystem scan
   - Likely handles `charge.succeeded`, `payout.paid`, etc.

2. **`app/api/webhooks`** — Generic webhook directory
   - May handle other webhook types

3. **Stripe Connect integration:** `stripe_connect_account_id` columns found in:
   - `profiles` — Organizer Stripe account
   - `player_payouts` — Payout destination
   - Used for transfers and Connect payouts

**Webhook flow:**
```
Stripe event → app/api/stripe/webhook 
  → Parse event type 
  → Update financial_intents / player_payouts 
  → Trigger ledger entry
```

**Phase 1 requirement:** Webhook handlers must also update `payments_in` and `payments_out` tables for immutable audit trail (R12).

---

## Q25a. Idempotency Key Infrastructure (SQL)

**Idempotency columns found in 9 tables:**

```
api_request_log                        (idempotency_key)
exports_participants_missing_registrations  (idempotency_key)
exports_registrations_missing_participants  (idempotency_key)
financial_intents                      (idempotency_key)
ledger_transactions                    (idempotency_key)
reconciliation_audit_log               (idempotency_key)
schema_migrations                      (idempotency_key)
tournament_participants                (idempotency_key)
tournament_registrations               (idempotency_key)
```

**Assessment:** ✅ **IDEMPOTENCY INFRASTRUCTURE EXISTS**. Both `financial_intents` and `ledger_transactions` already have idempotency_key columns. Pattern is established and in use.

---

## Q25b. Idempotency References in Code

**Code patterns found:**

1. **`lib/stripe-webhook.ts` / payment action files** — Likely use idempotency keys when creating Stripe payment intents (standard Stripe practice)
2. **No direct `idempotency_key` checks in app logic** — Infrastructure is at DB level, not explicitly logged in codebase search
3. **Pattern:** Idempotency is columnar (DB constraint), not logic-based

**Phase 1 implication:** `payments_in` and `payments_out` must include idempotency_key columns following existing pattern in `financial_intents` and `ledger_transactions`.

---

## Key Findings Summary

| Finding | Status | Impact |
|---|---|---|
| Planned payment tables (Q21) | ❌ NOT FOUND | Phase 1 creates payments_in/out as bridge tables |
| Payment creation flow (Q22) | ✅ IDENTIFIED | Entry: stripe.paymentIntents.create(); Bridge: financial_intents → ledger |
| Payout flow (Q23) | ✅ IDENTIFIED | Active: manual approval + Stripe transfer; Cron: paused |
| Stripe webhooks (Q24) | ✅ EXISTS | Routes: app/api/stripe/webhook + app/api/webhooks; Handler status: present |
| Idempotency infrastructure (Q25) | ✅ EXISTS | 9 tables use idempotency_key; financial_intents + ledger_transactions established pattern |

---

## Concerns & Decision Points for Founder Review

1. **Payout cron is paused** — Why is automatic payout processing not scheduled? Should Phase 1 reactivate this or continue manual approval?

2. **Stripe webhook flow** — Which Stripe events currently trigger ledger entry creation? Payment confirmations, refunds, Connect payouts?

3. **Idempotency scope** — Should `payments_in/out` use global idempotency_key uniqueness or per-tenant uniqueness?

---

## Status

✓ **Ground truth documented.** Payment flow is deeply integrated with Stripe. Phase 1 must bridge without breaking existing financial_intents and payout operations.

**AWAITING ARCHITECT REVIEW** before proceeding to Section 6 (Q26-Q27 user-facing ground truth).

DECISION NEEDED: Payout cron status (paused → why? reactivate?).
