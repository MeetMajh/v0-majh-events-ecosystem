-- Phase 1: Membership Consolidation
-- Migration: 20260712_001_phase_1_membership_consolidation.sql
-- 
-- Purpose: Backfill Zachary into organization_members to ensure consistent membership
--          state across all three human users before Phase 1 substrate tables land
--
-- Change: INSERT Zachary (be0f0132-14ed-4777-a4e5-59b13f99e805) with role TENANT_MANAGER
--         This resolves the membership gap where Zachary was in tenant_memberships + staff_roles
--         but missing from organization_members (which Phase 1 uses as canonical for RLS)
--
-- Risk level: MINIMAL
-- - Single row insert, no modification of existing data
-- - Idempotent (ON CONFLICT DO NOTHING)
-- - No impact on MAJH Events production (existing RLS unchanged)
-- - No dependency on other Phase 1 migrations
--
-- Verification after apply:
--   SELECT id, user_id, role_key, tenant_id, created_at FROM organization_members 
--   WHERE user_id = 'be0f0132-14ed-4777-a4e5-59b13f99e805';
--   Expected: 1 row, role_key='TENANT_MANAGER', is_active=true

BEGIN;

-- Backfill Zachary into organization_members with TENANT_MANAGER role
-- Tenant ID: 8dd63bc0-1742-478e-8743-dc55ce2b7127 (MAJH Events)
-- User ID: be0f0132-14ed-4777-a4e5-59b13f99e805 (Zachary)
INSERT INTO public.organization_members 
  (tenant_id, user_id, role_key, is_active, invited_at, accepted_at, created_at, updated_at)
VALUES 
  (
    '8dd63bc0-1742-478e-8743-dc55ce2b7127',
    'be0f0132-14ed-4777-a4e5-59b13f99e805',
    'TENANT_MANAGER',
    true,
    NOW(),
    NOW(),
    NOW(),
    NOW()
  )
ON CONFLICT (tenant_id, user_id) DO NOTHING;

COMMIT;
