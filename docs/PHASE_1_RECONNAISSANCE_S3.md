# Phase 1 Reconnaissance — Section 3: Financial Spine Ground Truth

**Date:** July 29, 2026 | **Status:** COMPLETE

---

## Q10. Column Definitions for ledger_transactions and ledger_entries

### ledger_entries (9 columns)
- `id` (uuid, NOT NULL) — Primary key
- `tenant_id` (uuid, NOT NULL) — Multi-tenant partition
- `transaction_id` (uuid, NOT NULL) — FK to ledger_transactions
- `account_id` (uuid, NOT NULL) — FK to ledger_accounts
- `direction` (text, NOT NULL) — 'debit' or 'credit'
- `amount_cents` (bigint, NOT NULL) — Amount in cents (multi-currency)
- `created_at` (timestamp, default now()) — Creation timestamp
- `department_id` (uuid, nullable) — Optional department scope
- `location_id` (uuid, nullable) — Optional location scope

### ledger_transactions (12 columns)
- `id` (uuid, NOT NULL, default gen_random_uuid()) — Primary key
- `tenant_id` (uuid, NOT NULL) — Multi-tenant partition
- `transaction_type` (text, NOT NULL) — Type of transaction
- `reference_id` (uuid, nullable) — External reference
- `reference_type` (text, nullable) — Type of reference
- `status` (text, NOT NULL, default 'posted') — Transaction status
- `description` (text, nullable) — Human-readable description
- `idempotency_key` (text, nullable) — Idempotency support
- `metadata` (jsonb, default '{}') — Flexible metadata
- `posted_at` (timestamp, nullable) — When transaction posted
- `created_at` (timestamp, default now()) — Creation timestamp
- `department_id` (uuid, nullable) — Optional department scope
- `location_id` (uuid, nullable) — Optional location scope

**Structure Assessment:** Well-designed transaction and entry architecture. Supports multi-tenant, multi-currency, and scoped operations.

---

## Q10b. Hash Chain Columns Check (Phase 1 Required)

**Required columns NOT found:**
- ❌ `entry_hash` — Missing (needed for hash chain integrity)
- ❌ `previous_hash` — Missing (needed for hash chain linkage)
- ❌ `linked_transaction_id` — Missing (cross-reference for amendments)
- ❌ `mfa_verified_at` — Missing (MFA audit trail)
- ❌ `created_by_user_id` — Missing (audit trail creator)

**CRITICAL FINDING:** Phase 1 must ADD all 5 hash chain columns to ledger_entries. This is a blocking requirement per PHASE_1_REQUIREMENTS.md R10-R12.

---

## Q11. UPDATE and DELETE Grants on ledger_entries

**Granted to 8 roles (overly permissive):**
```
anon        → DELETE, UPDATE
authenticated → DELETE, UPDATE
postgres    → DELETE, UPDATE
service_role → DELETE, UPDATE
```

**Codebase dependency check:** Searched `app/` and `lib/` for UPDATE/DELETE operations on ledger_entries:
- Result: 0 matches — No application code currently performs UPDATE/DELETE on ledger_entries
- Implication: These grants are legacy and safe to revoke in Phase 1

**Phase 1 Action:** Revoke UPDATE/DELETE on ledger_entries for anon and authenticated. Retain postgres and service_role for schema management only (trigger functions, internal operations).

---

## Q12. Row Counts for Financial Tables

| Table | Row Count | Notes |
|---|---|---|
| escrow_accounts | 2 | Small, safe for backfill |
| ledger_entries | 0 | Empty, new ledger spine |
| ledger_transactions | 0 | Empty, new ledger spine |
| payout_requests | 0 | Empty, new request system |
| player_payouts | 3 | Existing tournament payouts |

**Assessment:** All counts are small (< 10 rows). Backfill is straightforward. No large data migration required in Phase 1.

---

## Q13. RLS Policies on Financial Tables

### escrow_accounts (2 policies)
1. **"Organizers can view own escrow"** (SELECT)
   - Auth user = funded_by OR user = tournament creator
   - Pattern: User-scoped access
2. **"Staff can manage escrow"** (ALL)
   - Auth user has staff_roles with role='owner' OR role='manager'
   - Pattern: Role-based staff access

### ledger_entries (1 policy)
1. **"Tenant isolation ledger_entries"** (ALL)
   - Auth user is member of tenant (via tenant_memberships)
   - Pattern: Tenant-scoped isolation

### payout_requests (3 policies)
1. **"Staff can manage payout requests"** (ALL)
   - Auth user has staff_roles with role in ('owner', 'manager', 'finance')
   - Pattern: Financial role gating
2. **"System can create payout requests"** (INSERT)
   - Auth role = 'service_role' (internal system)
   - Pattern: Service role bypass for system operations
3. **"Users can view own payout requests"** (SELECT)
   - Auth user = user_id (owner access)
   - Pattern: User-scoped select

**Assessment:** RLS policies are inconsistent in their scoping approach:
- escrow_accounts uses staff_roles (legacy)
- ledger_entries uses tenant_memberships (intermediate)
- payout_requests uses staff_roles + service_role bypass (legacy + system)

Phase 1 must unify these on organization_members gating (TENANT_MANAGER+).

---

## Q14a. All Payment-Related Tables (13 total)

```
dismissed_stripe_payments
escrow_accounts
escrow_status
ledger_entries
ledger_transactions
organizer_payouts
payment_methods
payout_methods
payout_requests
player_payouts
tournament_payments
tournament_payouts
v_payout_status (view)
```

**Architecture Assessment:** Fragmented payment/payout system with 13 separate tables. Phase 1 creates universal payment primitives (payments_in, payments_out) to consolidate this.

---

## Q14b. Stripe Integration Surface (97 columns across 30+ tables)

**High-volume integration points:**
- `tournament_payments` (14 stripe columns) — Main payment capture
- `financial_intents` (5 stripe columns) — Intent tracking
- `payment_methods` (3 stripe columns) — Stored payment methods
- `profiles` (4 stripe columns) — Stripe Connect accounts
- `payout_requests` (3 stripe columns) — Payout routing
- `organizer_payouts` (1 stripe column) — Organizer transfers

**Platform dependencies:** Stripe is deeply embedded across financial operations. Phase 1 does NOT break Stripe integration; Phase 1.5+ will map Stripe columns to universal payment primitives.

---

## Key Findings Summary

| Finding | Impact | Phase 1 Action |
|---|---|---|
| Hash chain columns missing | BLOCKING | ADD all 5 hash chain columns to ledger_entries |
| UPDATE/DELETE grants overly permissive | MEDIUM | Revoke for anon/authenticated, retain for postgres/service_role |
| RLS policies inconsistent | MEDIUM | Unify on organization_members gating |
| No app code UPDATE/DELETE on ledger_entries | LOW | Safe to add immutability triggers |
| 13 fragmented payment tables | MEDIUM | Phase 1 creates universal primitives, maps in Phase 1.5+ |
| 97 Stripe integration columns | LOW | Stripe integration preserved; mapping happens Phase 1.5+ |

---

## Status

✓ **Ground truth documented.** All queries executed against production with literal output.

**AWAITING ARCHITECT REVIEW** before proceeding to Section 4 (Q15-Q18 adapter/integration ground truth).

DO NOT PROCEED to Phase 1 SQL drafting until architect confirms financial spine findings and hash chain column additions.
