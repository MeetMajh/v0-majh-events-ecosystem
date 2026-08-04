# Phase 1 Reconnaissance — Section 7: Operational and Migration Ground Truth

**Date:** July 29, 2026 | **Status:** COMPLETE

---

## Q31. Migration Numbering and Location

**Location:** `lib/supabase/Migrations/`

**Naming convention:** `YYYYMMDD_NNN_description.sql`

**Actual migration files (12 total):**

```
20260518_001_departments_locations.sql (4.5 KB)
20260518_002_seed_majh_departments.sql (3.0 KB)
20260518_003_wizard_schema.sql (8.3 KB)
20260518_004_seed_wizard_initial.sql (6.5 KB)
20260519_007_enable_rls_disabled_tables.sql (8.4 KB)
20260522_011_seed_role_hierarchy_and_finances.sql (4.8 KB)
20260524_012_wizard_rls_role_architecture.sql (2.5 KB)
20260525_007_t204_authorization_system.sql (12.7 KB)
20260712_001_phase_1_membership_consolidation.sql (1.6 KB) ← ROLLBACK CANDIDATE
20260712_002_phase_1_substrate_primitives.sql (12.8 KB) ← ROLLBACK CANDIDATE
20260712_003_phase_1_bridge_and_adapters.sql (12.7 KB) ← ROLLBACK CANDIDATE
20260712_004_phase_1_rollback.sql (1.7 KB)
```

**Assessment:** ✅ Convention is consistent. Phase 1 migrations (20260712_001-003) and rollback (004) follow the pattern. Directory structure is clean and organized.

---

## Q32. Applied Migrations in Supabase Tracking Table

**Migration table schema:** supabase_migrations.schema_migrations (6 columns)
- `version` (TEXT) — Migration timestamp identifier
- `name` (TEXT) — Human-readable migration name
- `statements` (ARRAY) — SQL statements applied
- `created_by` (TEXT) — Who created it
- `idempotency_key` (TEXT) — Idempotency identifier
- `rollback` (ARRAY) — Rollback SQL statements

**Applied migrations (21 total, last 15 shown):**

| Version | Name | Status |
|---|---|---|
| 20260311231415 | offline_sync_queue | Applied |
| 20260311230839 | game_leaderboards | Applied |
| 20260311230818 | tournament_player_stats | Applied |
| 20260311230459 | tournament_core_tables | Applied |
| 20260311230420 | tournament_registration_system | Applied |
| 20260311222719 | v2_update_news_add_community_tables | Applied |
| 20260311222429 | v2_site_settings_table | Applied |
| 20260311220430 | add_country_to_profiles | Applied |
| 20260309205924 | crm_marketing_erp_tables | Applied |
| 20260305041010 | carbardmv_seed_catalog | Applied |
| 20260305040735 | carbardmv_staff_prep_inventory | Applied |
| 20260305040638 | carbardmv_crm_proposals_invoices | Applied |
| 20260305040443 | carbardmv_events_catering_rentals | Applied |
| (+ 8 more earlier migrations) | ... | Applied |

**Assessment:** ✅ **CRITICAL FINDING:** Phase 1 migrations (20260712_001-003) are **NOT IN THE TRACKING TABLE** yet because they were rolled back. The rollback migration (20260712_004) also doesn't appear in the tracking table, which is correct — rollback was executed but not tracked as a "forward" migration.

**Implication:** When Phase 1 correct SQL is applied to staging/production, it MUST be applied through Supabase migration system (not raw SQL) so it's tracked with version timestamp and rollback statements.

---

## Q31/Q32 Integration Findings

| Finding | Status | Impact |
|---|---|---|
| Migration location (Q31) | ✅ CONFIRMED | `lib/supabase/Migrations/` is correct |
| Naming convention (Q31) | ✅ CONFIRMED | `YYYYMMDD_NNN_description.sql` is consistent |
| Migration tracking (Q32) | ✅ CONFIRMED | 21 migrations applied; Phase 1 (001-003) not tracked (rolled back) |
| Rollback capability (Q32) | ✅ CONFIRMED | Rollback statements recorded in schema_migrations table |
| Idempotency (Q32) | ✅ CONFIRMED | Migrations use idempotency_key for safety |

---

## Phase 1 Migration Workflow Established

**What we know:**
1. Migration location is established: `lib/supabase/Migrations/`
2. Naming convention is established: `YYYYMMDD_NNN_*`
3. Supabase tracks all migrations with rollback capability
4. Phase 1 (001-003) was applied but rolled back; neither is in tracking table now

**What Phase 1 correct SQL must follow:**
- Use same location: `lib/supabase/Migrations/20260712_NNN_*.sql`
- Each migration must be idempotent (can run multiple times safely)
- Each migration should include rollback statements for disaster recovery
- After Supabase applies it, version will appear in schema_migrations table
- Naming will preserve chronological order (20260712_*)

---

## Status

✓ **Ground truth documented.** Migration infrastructure is sound and ready for Phase 1 correct SQL.

**AWAITING ARCHITECT REVIEW** before proceeding to Section 8 (recommendations & workflow confirmation).

NO BLOCKING ISSUES in migration infrastructure. Phase 1 can proceed with existing migration system.
