# Phase 1 Deployment Guide

**Status:** Ready for deployment
**Generated:** July 12, 2026
**Migrations:** 3 files, YYYYMMDD_NNN format
**Estimated impact:** Zero production impact during Phase 1 (new tables, RLS policies, Zachary backfill into existing table)
**Rollback:** Each migration is idempotent; can be re-run safely. Schema is additive only.

---

## Pre-Deployment Checklist

Before applying Phase 1 migrations to any branch (test or production), complete these steps:

### 1. Supabase Branching Setup (Choose One)

**Option A: Supabase Dashboard (Recommended)**
- Open https://app.supabase.com → your MAJH OS project
- Settings → Branching (ensure enabled)
- Click "Create branch" → name it `phase-1-schema-test`
- Branching is now active; get connection string from branch dashboard

**Option B: Supabase CLI (if installed)**
```bash
supabase branches create --parent main phase-1-schema-test
```

### 2. Production Backup

**Via Supabase Dashboard:**
- Settings → Backups → "Backup now"
- Wait for completion (shows in backup list with timestamp)
- This backup is retained for 30 days; used for rollback if needed

**CLI (if installed):**
```bash
supabase db push --dry-run  # Verify migration would succeed
```

### 3. Verify Test Branch Access

Connect to the branch DB and run a simple query:
```bash
# Get connection string from Supabase Dashboard (branch settings)
psql <connection_string> -c "SELECT version();"
```

Expected: PostgreSQL version returned (e.g., PostgreSQL 15.x).

---

## Migration Execution (Test Branch First)

### Phase 1 consists of 3 migrations (apply in order):

**Migration 1:** `20260712_001_phase_1_membership_consolidation.sql`
- **What:** Backfill Zachary into organization_members
- **Impact:** +1 row, no existing data modified
- **Time:** < 100ms
- **Idempotent:** Yes (ON CONFLICT DO NOTHING)

**Migration 2:** `20260712_002_phase_1_substrate_primitives.sql`
- **What:** Create 6 universal substrate tables (entities, participants, resources, resource_allocations, platform_events, modules)
- **Impact:** +6 tables, +15 RLS policies, +20 indexes
- **Time:** 1-2 seconds
- **Idempotent:** Yes (IF NOT EXISTS guards)

**Migration 3:** `20260712_003_phase_1_bridge_and_adapters.sql`
- **What:** Create 4 adapter scaffold tables (external_field_mappings, external_system_credentials, sync_queue, adapter_logs)
- **Impact:** +4 tables, +12 RLS policies, +8 indexes
- **Time:** 1-2 seconds
- **Idempotent:** Yes (IF NOT EXISTS guards)

### Execution (via psql or Supabase SQL Editor):

```bash
# Test branch connection
psql <test_branch_connection_string> -f lib/supabase/Migrations/20260712_001_phase_1_membership_consolidation.sql
psql <test_branch_connection_string> -f lib/supabase/Migrations/20260712_002_phase_1_substrate_primitives.sql
psql <test_branch_connection_string> -f lib/supabase/Migrations/20260712_003_phase_1_bridge_and_adapters.sql
```

Or via Supabase SQL Editor:
- Copy-paste each migration file into the editor
- Execute (order matters: 001 → 002 → 003)
- Check "Results" tab for success

---

## Post-Migration Verification (Test Branch)

### 1. Verify Schema Creation

```sql
-- Check all new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' AND table_name IN (
  'entities', 'participants', 'resources', 'resource_allocations', 
  'platform_events', 'modules',
  'external_field_mappings', 'external_system_credentials', 'sync_queue', 'adapter_logs'
)
ORDER BY table_name;

-- Expected: 10 rows
```

### 2. Verify RLS Policies

```sql
-- Check RLS is enabled on all new tables
SELECT tablename FROM pg_tables 
WHERE schemaname='public' AND tablename IN (
  'entities', 'participants', 'resources', 'resource_allocations', 
  'platform_events', 'modules',
  'external_field_mappings', 'external_system_credentials', 'sync_queue', 'adapter_logs'
)
ORDER BY tablename;

-- Check policies exist
SELECT COUNT(*) policy_count FROM pg_policies 
WHERE schemaname='public' AND tablename IN (
  'entities', 'participants', 'resources', 'resource_allocations', 
  'platform_events', 'modules',
  'external_field_mappings', 'external_system_credentials', 'sync_queue', 'adapter_logs'
);

-- Expected: ~40 policies (3-4 per table)
```

### 3. Verify Zachary Backfill

```sql
-- Check Zachary was inserted
SELECT id, user_id, role_key, tenant_id, is_active, created_at 
FROM public.organization_members 
WHERE user_id = 'be0f0132-14ed-4777-a4e5-59b13f99e805';

-- Expected: 1 row
--   user_id: be0f0132-14ed-4777-a4e5-59b13f99e805
--   role_key: TENANT_MANAGER
--   is_active: true
--   tenant_id: 8dd63bc0-1742-478e-8743-dc55ce2b7127 (MAJH Events)
```

### 4. Test Against MAJH Events Data

```sql
-- Verify existing MAJH Events data is untouched
SELECT COUNT(*) tournament_count FROM public.tournaments;
-- Expected: 15

SELECT COUNT(*) player_count FROM public.tournament_participants;
-- Expected: 56

-- Verify Zachary can now query substrate tables (RLS test)
-- (Run as Zachary's user; if using service role key, this is automatic)
SELECT COUNT(*) FROM public.entities;  -- Should return 0 (no data yet)

SELECT COUNT(*) FROM public.participants;  -- Should return 0 (no data yet)
```

### 5. Check for Errors

```sql
-- If any migration failed, you'll see errors in the Results tab
-- Common issues:
-- - "relation already exists" — migration was run twice (safe, idempotent)
-- - "syntax error" — copy-paste issue; re-run migration
-- - "permission denied" — schema ownership issue; use service role key
```

---

## Promotion to Production

### Once Test Branch Verification Passes:

**1. Delete Test Branch**
```bash
# Via Dashboard: Settings → Branching → delete "phase-1-schema-test"
# Or via CLI: supabase branches delete phase-1-schema-test
```

**2. Apply to Production**
```bash
# Connect to main DB (production connection string)
psql <production_connection_string> -f lib/supabase/Migrations/20260712_001_phase_1_membership_consolidation.sql
psql <production_connection_string> -f lib/supabase/Migrations/20260712_002_phase_1_substrate_primitives.sql
psql <production_connection_string> -f lib/supabase/Migrations/20260712_003_phase_1_bridge_and_adapters.sql
```

**3. Verify Production**
- Re-run all verification queries from "Post-Migration Verification" section
- Confirm Zachary can log in and access substrate tables
- Confirm MAJH Events tournaments/players still visible and unchanged

---

## Rollback Procedure (If Needed)

### Automatic Rollback (Supabase Backup)

If Phase 1 deployment causes issues:
1. Open Supabase Dashboard → Backups
2. Find the backup taken before Phase 1 (timestamp)
3. Click "Restore" → confirm
4. Supabase restores the entire DB (5-15 minutes depending on size)

### Manual Rollback (Not Recommended, but possible)

If you need to drop Phase 1 tables and start over:

```sql
-- WARNING: This deletes all Phase 1 schema
-- Only run if backup restore is not available

BEGIN;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.adapter_logs CASCADE;
DROP TABLE IF EXISTS public.sync_queue CASCADE;
DROP TABLE IF EXISTS public.external_system_credentials CASCADE;
DROP TABLE IF EXISTS public.external_field_mappings CASCADE;
DROP TABLE IF EXISTS public.modules CASCADE;
DROP TABLE IF EXISTS public.platform_events CASCADE;
DROP TABLE IF EXISTS public.resource_allocations CASCADE;
DROP TABLE IF EXISTS public.resources CASCADE;
DROP TABLE IF EXISTS public.participants CASCADE;
DROP TABLE IF EXISTS public.entities CASCADE;

-- Remove Zachary backfill (if needed)
DELETE FROM public.organization_members 
WHERE user_id = 'be0f0132-14ed-4777-a4e5-59b13f99e805' 
  AND tenant_id = '8dd63bc0-1742-478e-8743-dc55ce2b7127';

COMMIT;
```

---

## What's Next After Phase 1

Once Phase 1 lands and is verified in production:

1. **Phase 1.5:** Escrow as substrate primitive (separate ticket)
   - Design 7-state escrow machine
   - Add escrow table and ledger integration
   - Create escrow reconciliation job

2. **Phase 1.5+ Backfill:** Data migration from MAJH Events typed tables to substrate
   - Tournaments → entities
   - Tournament_participants → participants
   - Build FK pointers for gradual cutover

3. **Platform Admin Surface:** Build the MAJH OS operator UI
   - Dashboard for MAJH OS platform admins
   - Tenant management interface
   - Module + vocabulary registry management

4. **Phase 1.5+ Adapters:** Monday.com, QuickBooks, Square integration
   - Use external_field_mappings and sync_queue for orchestration
   - Implement "shadow, augment, migrate" pattern

---

## Key Contacts & Support

- **Founder approval:** Malchijah Harding
- **Production access:** Vercel project (v0 agent connected)
- **Issues during deployment:** Check PHASE_1_DECISIONS.md for decision rationale
- **Architecture questions:** Reference ARCHITECTURE.md v2.1.0

---

## Deployment Sign-Off

- [ ] Test branch created and verified
- [ ] All 3 migrations executed successfully on test branch
- [ ] Post-migration verification queries all pass
- [ ] MAJH Events data verified (tournaments/players untouched)
- [ ] Zachary backfill verified
- [ ] RLS policies verified
- [ ] Test branch deleted
- [ ] All 3 migrations executed on production
- [ ] Production verification complete
- [ ] Founder approval obtained

**Deployed by:** _______________  
**Deployment date:** _______________  
**Verification date:** _______________
