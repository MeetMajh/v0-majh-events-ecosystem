-- Migration: 20260712_004_phase_1_rollback.sql
-- Purpose: Roll back incomplete Phase 1 implementation (002 & 003 only)
-- Scope: Drop tables created in 002 & 003, preserve Zachary backfill from 001
-- Risk: LOW (new tables only, no existing MAJH Events data affected)
-- Author: Claude (architectural reset per founder directive)
-- Status: REQUIRES FOUNDER REVIEW & APPROVAL BEFORE EXECUTION

BEGIN;

-- Drop adapter tables from migration 003 (if they exist)
DROP TABLE IF EXISTS public.adapter_logs CASCADE;
DROP TABLE IF EXISTS public.sync_queue CASCADE;
DROP TABLE IF EXISTS public.external_system_credentials CASCADE;
DROP TABLE IF EXISTS public.external_field_mappings CASCADE;

-- Drop incomplete substrate tables from migration 002 (if they exist)
DROP TABLE IF EXISTS public.modules CASCADE;
DROP TABLE IF EXISTS public.ledger_accounts CASCADE;
DROP TABLE IF EXISTS public.outbox CASCADE;
DROP TABLE IF EXISTS public.resources CASCADE;
DROP TABLE IF EXISTS public.participants CASCADE;

-- Preserve migration 001 (Zachary backfill to organization_members)
-- This work was correct and should remain

COMMIT;

-- Verification after rollback:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema='public' AND table_name IN 
--   ('participants','resources','outbox','ledger_accounts','modules',
--    'external_field_mappings','external_system_credentials','sync_queue','adapter_logs')
-- LIMIT 10;
-- Expected result: 0 rows (all rollback tables removed)

-- Verification that Zachary backfill is preserved:
-- SELECT user_id, role_key FROM public.organization_members 
-- WHERE user_id = 'be0f0132-14ed-4777-a4e5-59b13f99e805';
-- Expected result: 1 row with role_key='TENANT_MANAGER'
