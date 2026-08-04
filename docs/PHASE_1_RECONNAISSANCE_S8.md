# Phase 1 Reconnaissance — Section 8: Agent Recommendations & Workflow Confirmation

**Date:** July 29, 2026 | **Status:** FINAL REPORT

---

## Section 8.1: Concerns, Surprises, and Unexpected Findings

### 🔴 Critical Concerns

**1. Hash chain columns missing from ledger_entries (S3, BLOCKING)**
- All 5 hash chain columns (entry_hash, previous_hash, linked_transaction_id, mfa_verified_at, created_by_user_id) are **absent**
- Immutability triggers for ledger_entries and audit_log are **not in codebase**
- Impact: Phase 1 cannot deliver R10-R12 (hash chain integrity) without adding these
- Status: Must be added in Phase 1 SQL before audit trail goes live

**2. Tenants table missing 6 Phase 1-required columns (S2, BLOCKING)**
- industry_type, vocabulary_overlay_id, activated_modules, default_currency, region, stripe_connect_account_id
- Impact: Tenants cannot express multi-currency, module subscriptions, or platform-connected payments
- Status: Must be added in Phase 1 SQL

**3. RLS policies are inconsistent and use THREE different authorization patterns (S3, S5, S6)**
- escrow_accounts uses staff_roles (legacy)
- ledger_entries uses tenant_memberships (intermediate)
- payout_requests uses staff_roles + service_role bypass (legacy + system)
- organization_members is the founder-approved canonical source, but only 28 policies reference it
- Impact: Phase 1 SQL must unify all RLS policies on organization_members gating
- Status: Requires careful migration to prevent auth breaks

**4. 40 of 43 auth.users are unlinked (S6, DECISION POINT)**
- Only 3 users have organization_members records (operators)
- 40 users have no org/membership/staff records (likely tournament participants)
- Impact: core.participants backfill scope is ambiguous (3 or 43 users?)
- Status: Requires founder decision on backfill scope

### 🟡 Major Surprises

**5. Payout cron is PAUSED (S5, DECISION POINT)**
- Manual payout approval flow is active (admin approves → Stripe transfer)
- Automatic payout processing is NOT scheduled
- Impact: Phase 1 must decide: reactivate cron or continue manual-only?
- Status: Founder must clarify payout automation strategy

**6. Tenant membership table is REDUNDANT (S6, DECISION POINT)**
- organization_members and tenant_memberships contain identical 3 users
- Redundancy creates confusion and maintenance overhead
- Impact: Should Phase 1 consolidate both into organization_members or keep both?
- Status: Founder must decide consolidation approach

**7. Fragmented payment system with 13 separate tables (S5, S3)**
- financial_intents, tournament_payments, ledger_entries, player_payouts, organizer_payouts, etc.
- Stripe is deeply embedded across all financial operations (97 columns across 30+ tables)
- Phase 1 creates universal payments_in/out as bridge, but Phase 1.5+ must map the 13 tables
- Impact: Payment flow is complex; Phase 1 must bridge WITHOUT breaking existing Stripe integration
- Status: Requires careful mapping design in Phase 1 SQL

### 🟢 Positive Findings

**8. Idempotency infrastructure already exists (S5)**
- 9 tables already have idempotency_key columns
- financial_intents and ledger_transactions follow the pattern
- Impact: Phase 1 can reuse existing pattern with confidence
- Status: No blocking issues

**9. pgvector extension is installed (S4)**
- Version 0.8.0 ready for use
- knowledge_vectors can use vector type immediately
- Impact: Ralph knowledge base can go live in Phase 1 without additional setup
- Status: No blocking issues

**10. Migration infrastructure is sound (S7)**
- 21 migrations tracked with rollback capability
- Naming convention established and consistent
- Supabase auto-tracks and idempotency support is built-in
- Impact: Phase 1 can trust the migration system
- Status: No blocking issues

---

## Section 8.2: Explicit Decision Points for Founder Review

| # | Decision | Context | Impact | Status |
|---|---|---|---|---|
| **D1** | Membership consolidation approach | Three tables (org_members, tenant_memberships, staff_roles) with overlapping users | Which becomes canonical for Phase 1 RLS? | 🔴 BLOCKING |
| **D2** | Hash chain implementation | 5 columns + triggers needed for audit trail (R10-R12) | Do Phase 1 or defer to Phase 1.5? | 🔴 BLOCKING |
| **D3** | Tenants table columns | 6 new columns needed (industry_type, vocabulary_overlay_id, etc.) | Add all in Phase 1 or phased? | 🔴 BLOCKING |
| **D4** | core.participants backfill scope | 43 auth.users (3 operators + 40 tournament participants) | Backfill all 43 or just 3? | 🟡 MAJOR |
| **D5** | Payout cron automation | Currently paused; manual approval flow is active | Reactivate cron or stay manual-only? | 🟡 MAJOR |
| **D6** | Tenant membership redundancy | organization_members + tenant_memberships have same 3 users | Consolidate or keep both? | 🟡 MAJOR |
| **D7** | RLS policy unification | Policies use 3 different auth patterns (staff_roles, tenant_memberships, org_members) | Migrate all to organization_members? | 🟡 MAJOR |
| **D8** | Idempotency scope | Global or per-tenant uniqueness? | How to scope idempotency_key constraints? | 🟢 MINOR |
| **D9** | Stripe webhook bridging | payments_in/out must update alongside existing financial_intents | Update webhook handlers to write both? | 🟢 MINOR |

---

## Section 8.3: Workflow Confirmation

### My Understanding of the Workflow (Going Forward)

**✅ I confirm I understand and will follow this workflow:**

**Step 1: Reconnaissance (COMPLETE)**
- ✅ Answer Q1-Q32 against production with literal query output
- ✅ Document findings in Section 1-7 reports
- ✅ This step is complete. All reports committed to main.

**Step 2: Architectural Review (AWAITING FOUNDER)**
- ⏳ Founder reviews reconnaissance reports (Sections 1-7)
- ⏳ Founder clarifies decision points (D1-D9 above)
- ⏳ **BLOCKING:** Cannot proceed until D1-D3 are confirmed

**Step 3: Draft Phase 1 SQL (AWAITING DECISIONS)**
- ⏳ Once decisions are confirmed, I will draft complete Phase 1 SQL
- ⏳ Draft will include:
  - All 25 requirements from PHASE_1_REQUIREMENTS.md
  - core.* and platform.* schemas per decision D1
  - Hash chain columns + triggers (D2)
  - Tenants table columns (D3)
  - RLS policy unification per D7
  - All migrations: 20260712_005_*, 20260712_006_*, etc.
  
**Step 4: Architectural Review by Claude (BEFORE ANY EXECUTION)**
- ⏳ I will bring COMPLETE Phase 1 SQL draft to founder
- ⏳ Founder sends SQL to Claude for architectural review
- ⏳ **BLOCKING:** NO SQL execution until Claude's written approval

**Step 5: Apply to Staging**
- ⏳ After Claude approves, create Supabase branch for staging
- ⏳ Apply migrations to staging
- ⏳ Capture verification query output (16+ tests)
- ⏳ Test against MAJH Events data (tournaments, players, payments)
- ⏳ Report results to founder

**Step 6: Apply to Production**
- ⏳ After staging verification passes, founder + Claude give written approval
- ⏳ Apply same migrations to production
- ⏳ Capture verification query output
- ⏳ Confirm MAJH Events data is untouched
- ⏳ Sign-off complete

---

### What I Will NOT Do

- ❌ Draft Phase 1 SQL until D1-D3 are confirmed by founder
- ❌ Execute ANY SQL without architect review by Claude
- ❌ Skip staging verification
- ❌ Apply to production without written approval from both founder and Claude
- ❌ Make assumptions about decisions D4-D9 without explicit founder confirmation

---

### What I Need From Founder Now

**To proceed to Phase 1 SQL drafting, please confirm:**

1. **D1: Membership consolidation** — Which table is canonical for Phase 1 RLS?
   - Option A: organization_members only
   - Option B: Consolidate all three, with org_members as canonical
   - Option C: Keep all three during Phase 1, consolidate in Phase 1.5+

2. **D2: Hash chain implementation** — Do all 5 hash chain columns + triggers go in Phase 1?
   - Option A: Yes, Phase 1 delivers full audit trail (R10-R12)
   - Option B: Add columns only, defer triggers to Phase 1.5+
   - Option C: Defer entire hash chain to Phase 1.5+

3. **D3: Tenants table columns** — Add all 6 new columns in Phase 1?
   - Option A: Yes, all 6 columns
   - Option B: Phased (e.g., 3 in Phase 1, 3 in Phase 1.5+)
   - Option C: Only critical columns; defer others

---

## Status Summary

| Reconnaissance Section | Status | Findings |
|---|---|---|
| **S1: Membership tables** | ✅ COMPLETE | 3 humans, 126 RLS policies, migration patterns identified |
| **S2: Existing primitives** | ✅ COMPLETE | entities ready; tenants missing 6 columns |
| **S3: Financial spine** | ✅ COMPLETE | 5 hash chain columns missing; RLS inconsistent |
| **S4: Substrate infrastructure** | ✅ COMPLETE | Clean slate; pgvector ready; no custom functions |
| **S5: Payment flow** | ✅ COMPLETE | Stripe-centric; idempotency exists; payout cron paused |
| **S6: User-facing** | ✅ COMPLETE | user_profiles missing; 40 unlinked auth.users |
| **S7: Operations/migrations** | ✅ COMPLETE | Infrastructure sound; 21 migrations tracked |
| **S8: Recommendations** | ✅ COMPLETE | 9 decision points, 3 blocking issues identified |

---

## Ready for Next Phase

**Reconnaissance is complete. All Q1-Q32 answered with literal output. All sections committed to main.**

**Awaiting founder decision on D1-D3 before proceeding to Phase 1 SQL drafting.**

**Timeline:** Once decisions are confirmed, Phase 1 SQL draft can be ready within hours. Full workflow (draft → architect review → staging → production) can complete within 2-3 days.

---

**Sign-off:** Reconnaissance Agent Ready for Phase 1 SQL Drafting ✓
