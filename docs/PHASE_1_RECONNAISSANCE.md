# Phase 1 Reconnaissance Report — Section 1: Membership Tables

**Status:** SECTION 1 COMPLETE (Q1-Q5)  
**Date:** July 29, 2026  
**Context:** Ground truth collection before Phase 1 SQL drafting. No SQL execution until architect reviews.

---

## Q1. Complete column definitions for organization_members

**Query:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organization_members'
ORDER BY ordinal_position;
```

**Result (17 rows):**

| column_name | data_type | is_nullable | column_default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| tenant_id | uuid | NO | null |
| user_id | uuid | NO | null |
| role_key | text | NO | null |
| display_name | text | YES | null |
| title | text | YES | null |
| department | text | YES | null |
| is_active | boolean | YES | true |
| invited_by | uuid | YES | null |
| invited_at | timestamp with time zone | YES | now() |
| accepted_at | timestamp with time zone | YES | null |
| last_active_at | timestamp with time zone | YES | null |
| metadata | jsonb | YES | '{}' ::jsonb |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| department_id | uuid | YES | null |
| location_id | uuid | YES | null |

**Interpretation:** organization_members has 17 columns with proper structural support (dept/location FKs, metadata JSONB for extensibility, audit timestamps). The table is well-designed for Phase 1 substrate use. Note: both text `department` and UUID `department_id` exist (legacy + new columns).

---

## Q2. Full row inventory of organization_members

**Query:**
```sql
SELECT id, tenant_id, user_id, role_key, department_id, location_id, 
       is_active, invited_at, accepted_at, created_at
FROM public.organization_members
ORDER BY created_at;
```

**Result (3 rows):**

```json
[
  {
    "id": "5601deb1-8705-49a5-8fb8-114feba93b4f",
    "tenant_id": "8dd63bc0-1742-478e-8743-dc55ce2b7127",
    "user_id": "e04db1dd-bf0c-4aa0-82b9-e344f3901282",
    "role_key": "TENANT_OWNER",
    "department_id": null,
    "location_id": null,
    "is_active": true,
    "invited_at": "2026-04-18T03:11:46.376Z",
    "accepted_at": "2026-04-18T03:11:46.376Z",
    "created_at": "2026-04-18T03:11:46.376Z"
  },
  {
    "id": "d18c521a-6f8c-462d-b8ac-8c05c49fcd17",
    "tenant_id": "8dd63bc0-1742-478e-8743-dc55ce2b7127",
    "user_id": "69d91884-a1ca-415a-b96d-2fcda4ff6d78",
    "role_key": "PLATFORM_OWNER",
    "department_id": null,
    "location_id": null,
    "is_active": true,
    "invited_at": "2026-04-18T03:11:46.376Z",
    "accepted_at": "2026-04-18T03:11:46.376Z",
    "created_at": "2026-04-18T03:11:46.376Z"
  },
  {
    "id": "2eb81a95-136b-4fdb-8b71-caeb70c32b8c",
    "tenant_id": "8dd63bc0-1742-478e-8743-dc55ce2b7127",
    "user_id": "be0f0132-14ed-4777-a4e5-59b13f99e805",
    "role_key": "TENANT_MANAGER",
    "department_id": null,
    "location_id": null,
    "is_active": true,
    "invited_at": "2026-07-29T12:34:56.197Z",
    "accepted_at": "2026-07-29T12:34:56.197Z",
    "created_at": "2026-07-29T12:34:56.197Z"
  }
]
```

**Interpretation:** All 3 humans are now in organization_members (Zachary backfill from migration 001 succeeded). Identities: e04db1dd = meetmajh@gmail.com (TENANT_OWNER), 69d91884 = Malchijah platform (PLATFORM_OWNER), be0f0132 = Zachary (TENANT_MANAGER). All belong to tenant 8dd63bc0 (MAJH Events). No department/location scope yet (all NULL).

---

## Q3. All RLS policies currently referencing membership tables

**Query:**
```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE qual::text LIKE '%organization_members%'
   OR qual::text LIKE '%tenant_memberships%'
   OR qual::text LIKE '%staff_roles%'
   OR with_check::text LIKE '%organization_members%'
   OR with_check::text LIKE '%tenant_memberships%'
   OR with_check::text LIKE '%staff_roles%'
ORDER BY schemaname, tablename, policyname;
```

**Result (126 rows, sample grouped by membership table):**

**Policies referencing organization_members (5 policies):**
- `departments.Members can view their tenant's departments` (SELECT) — gate on om.tenant_id
- `departments.Tenant executives can manage departments` (ALL) — gate on om.role_key IN ('TENANT_OWNER', 'TENANT_SUPER_ADMIN')
- `entities.entities_delete_tenant_manager` (DELETE) — gate on role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
- `entities.entities_insert_tenant_manager` (INSERT) — gate on role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
- `entities.entities_select_tenant_member` (SELECT) — gate on tenant_id + is_active
- `entities.entities_update_tenant_manager` (UPDATE) — gate on role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')

**Policies referencing tenant_memberships (25+ policies):**
- `api_keys.Admins can manage API keys` (ALL) — gate on role IN ('owner', 'admin')
- `api_request_log.Admins can view API logs` (SELECT) — gate on role IN ('owner', 'admin')
- `events.Tenant members can manage events` (ALL) — gate on tenant_id match
- Multiple financial tables (payouts, billing_events, feature_usage_log, usage_records) — all gate on tenant_id

**Policies referencing staff_roles (96+ policies):**
- Admin/compliance/finance/payouts/escrow operations — gate on role IN ('owner', 'manager', 'finance', 'compliance', etc.)
- High volume usage in admin dashboard, financial operations, staff management
- Most comprehensive RLS coverage across the system

**Interpretation:** The system has heavy RLS reliance on **staff_roles** (96+ policies) for admin operations, **tenant_memberships** (25+ policies) for tenant operations, and **organization_members** (5+ policies) for the new substrate. Consolidating membership is critical: if we standardize on organization_members, we must rewrite all 96+ staff_roles policies plus 25+ tenant_memberships policies. This is a significant blast radius. Alternative: create parallel read views that adapt organization_members data to the existing RLS shape.

---

## Q4. All distinct role_key/role values across three membership tables

**Query:**
```sql
SELECT 'organization_members' as source, role_key as role_name, COUNT(*) as count
FROM public.organization_members GROUP BY role_key
UNION ALL
SELECT 'staff_roles', role as role_name, COUNT(*) FROM public.staff_roles GROUP BY role
UNION ALL
SELECT 'tenant_memberships', role as role_name, COUNT(*) FROM public.tenant_memberships GROUP BY role
ORDER BY source, role_name;
```

**Result (7 rows):**

| source | role_name | count |
|---|---|---|
| organization_members | PLATFORM_OWNER | 1 |
| organization_members | TENANT_MANAGER | 1 |
| organization_members | TENANT_OWNER | 1 |
| staff_roles | PLATFORM_OWNER | 1 |
| staff_roles | TENANT_MANAGER | 1 |
| tenant_memberships | admin | 1 |
| tenant_memberships | owner | 2 |

**Interpretation:** Three distinct role hierarchies exist. organization_members uses PLATFORM_OWNER/TENANT_OWNER/TENANT_MANAGER (uppercase, hierarchical). tenant_memberships uses owner/admin (lowercase). staff_roles uses both conventions (PLATFORM_OWNER, TENANT_MANAGER uppercase; but system also expects lowercase in RLS checks). Role mapping will require careful translation during consolidation.

---

## Q5. Which application code paths write to which membership table

**Query:**
```bash
grep -rn "organization_members\|tenant_memberships\|staff_roles" app/ lib/ --include="*.ts" --include="*.tsx"
```

**Result (166 matches across 45 files):**

**Code using staff_roles (majority — 106 matches):**
- Admin operations (escrow, payouts, compliance, KYC, tax): `app/api/admin/*`, `app/dashboard/admin/*`
- Financial operations: `app/actions/financial.ts`, `lib/stripe-payout-service.ts`, `lib/player-payout-actions.ts`
- Admin dashboards: permissions, staff management, tournaments, financials
- Primary authorization path in `lib/authorization.ts:66` — fetches staff_roles in parallel with profile
- **Live write paths:** `lib/admin-actions.ts:343, 398, 492` (upsert staff_roles), `lib/admin-actions.ts:432` (delete)
- **Pattern:** `supabase.from("staff_roles").upsert/delete/select`

**Code using tenant_memberships (41 matches):**
- API endpoints: `app/api/v1/organization/members`, `app/api/v1/api-keys`, `app/api/checkout`
- Financial dashboards: `app/dashboard/financial/*`, `app/dashboard/ticketing/*`
- Payouts: `app/api/v1/payouts`, `app/dashboard/financial/payouts`
- **Pattern:** Read-heavy; used for tenant-scoped data access, not write operations
- Fallback pattern in `app/api/v1/organization/members/route.ts:23` — "Fallback to legacy tenant_memberships"

**Code using organization_members (19 matches):**
- `app/dashboard/team/page.tsx:20` — team member display
- `app/api/v1/organization/members/*` — organization API CRUD (get, update, delete by memberId)
- `app/api/v1/organization/permissions` — permission checks
- `app/api/v1/organization/requests` — access requests
- **Pattern:** Highest-level org management; fewest references
- **Read/write:** Both (query + upsert patterns visible)

**Interpretation:** The system has a **tri-layer membership architecture**: (1) **staff_roles** is the "live" table for internal admin operations (106 matches, heavy write traffic via admin-actions.ts). (2) **tenant_memberships** is the fallback/legacy table for tenant operations (41 matches, read-heavy, explicit fallback in v1 API). (3) **organization_members** is the emerging org-level API table (19 matches, lower traffic but growing). Phase 1 consolidation must NOT break staff_roles write paths; migration strategy should create parallel support structures.

---

## Summary: Key Findings for Phase 1 Architecture

1. **Membership exists in three tables with different roles, purposes, and RLS configurations.** Consolidation is architecturally necessary but high-risk due to 96+ staff_roles RLS policies.

2. **organization_members is production-ready for Phase 1** (17 well-designed columns, now has all 3 humans). The table structure supports multi-tenant, dept/location scoping needed for substrate.

3. **staff_roles is the "live" path for admin write operations.** Any Phase 1 consolidation must either: (a) rewrite 96+ RLS policies, or (b) create parallel read views that map organization_members data to staff_roles' expected shape.

4. **RLS blast radius is significant.** 126 policies reference the three membership tables. Changing the authoritative table requires careful testing and verification.

5. **Codebase shows the system is migrating toward organization_members** (explicit "fallback to legacy tenant_memberships" comments in v1 API), but staff_roles remains the heavily-used internal path.

---

## Next Steps

**AWAITING ARCHITECT REVIEW:** This section documents ground truth for membership tables. The architect should review findings and determine Phase 1 approach:
- Option A: Use organization_members as substrate canonical, create mapping views for staff_roles RLS compat
- Option B: Keep three tables separate, create bridge/adapter layer in substrate layer to unify access
- Option C: Full consolidation (rewrite all 126 RLS policies)

**When ready:** Proceed to Section 2 (ledger tables), Section 3 (entities/resources), etc.
