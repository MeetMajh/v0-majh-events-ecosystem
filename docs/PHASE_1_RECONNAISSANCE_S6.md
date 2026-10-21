# Phase 1 Reconnaissance — Section 6: User-Facing Ground Truth

**Date:** July 29, 2026 | **Status:** COMPLETE

---

## Q26. Complete user_profiles Structure and Row Count

**Query result:** Table does NOT exist

**Assessment:** ❌ user_profiles table not found. Phase 1 must create it as the universal user profile table (R19, part of core.participants bridge).

**Implication:** Phase 1 creates `core.participants` table to replace scattered user identity data. `user_profiles` might be a legacy name; `core.participants` is the Phase 1 canonical table.

---

## Q27. How Users Link to Tenants Today

### User Distribution Across Membership Tables

| Source | Distinct Users | Notes |
|---|---|---|
| **organization_members** | 3 | Canonical: meetmajh (TENANT_OWNER), malchijah (PLATFORM_OWNER), zachary (TENANT_MANAGER) |
| **tenant_memberships** | 3 | Same 3 users (legacy redundancy) |
| **staff_roles** | 2 | meetmajh + malchijah (no Zachary) |
| **auth.users** | 43 | Total auth accounts in system |

### Backfill Delta

```
Auth users: 43 total
  ├─ organization_members: 3 users
  ├─ tenant_memberships: 3 users (REDUNDANT)
  ├─ staff_roles: 2 users (SUBSET)
  └─ UNLINKED: 40 users (97% have no org/membership/staff records)
```

### User Linking Architecture Today

```
Auth.users (43 total)
  └─ FKs to:
     ├─ organization_members (3) ← CANONICAL for Phase 1
     ├─ tenant_memberships (3) ← REDUNDANT (legacy)
     ├─ staff_roles (2) ← SUBSET (financial ops only)
     └─ other tables (user_profiles if existed)
```

**Current linking logic:**
- **Auth as source:** All users start in auth.users
- **Organization membership as filter:** Only 3 of 43 are in organization_members (operators)
- **Staff roles as specialized subset:** Only 2 have financial operations roles
- **Tenant memberships as redundancy:** Same 3 as org_members (why?)

### Phase 1 Implication

**Backfill scope for core.participants:**
- Must create participant records for all 43 auth.users (not just 3 org members)
- Each participant gets tenant_id (MAJH Events by default, extensible for Phase 1.5+)
- Each participant links to auth.users via user_id (immutable)
- Role (TENANT_USER, TENANT_MANAGER, etc.) flows from organization_members initially, null for unlinked users

**Backfill query template:**
```sql
INSERT INTO core.participants (tenant_id, user_id, auth_email, is_active, created_at)
SELECT '8dd63bc0-1742-478e-8743-dc55ce2b7127', id, email, true, NOW()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM core.participants);
```

---

## Key Findings Summary

| Finding | Status | Impact |
|---|---|---|
| user_profiles table (Q26) | ❌ NOT FOUND | Phase 1 creates core.participants instead |
| Organization member users (Q27) | ✅ 3 users | meetmajh, malchijah, zachary (all in org_members) |
| Tenant membership users (Q27) | ✅ 3 users | REDUNDANT with organization_members (why?) |
| Staff role users (Q27) | ✅ 2 users | SUBSET of org_members (meetmajh + malchijah) |
| Unlinked auth.users | ⚠️ 40 users | 97% of auth.users have no org record (tournament participants?) |

---

## Concerns & Decision Points for Founder Review

1. **Tenant membership redundancy** — organization_members and tenant_memberships both contain the same 3 users. Why the duplication? Keep both during Phase 1 or consolidate immediately?

2. **40 unlinked auth users** — Who are these 40 users? Tournament participants? API test accounts? Should core.participants backfill all 43 or only the 3 operators?

3. **Role mapping** — organization_members has roles (TENANT_OWNER, PLATFORM_OWNER, TENANT_MANAGER). Staff_roles has different roles (owner, manager, finance). Should core.participants adopt organization_members roles or create new canonical role set?

---

## Status

✓ **Ground truth documented.** User identity is fragmented across 3 membership tables with significant unreferenced auth.users (40 of 43).

**AWAITING ARCHITECT REVIEW** before proceeding to Section 7 (Q31-Q32 operational/migration ground truth).

DECISION NEEDED: Backfill scope for core.participants (all 43 auth.users or just 3 operators?).
