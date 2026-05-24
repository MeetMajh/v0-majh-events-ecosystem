-- ==============================================================================
-- Migration: 20260522_011_seed_role_hierarchy_and_finances
-- Purpose: T-200 Financial Scoping & T-204 Role Architecture implementation
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- PART 1: T-200 FINANCIAL SCOPING (Adding Department/Location to Ledgers)
-- ------------------------------------------------------------------------------
ALTER TABLE public.ledger_transactions 
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_tx_department ON public.ledger_transactions(department_id);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_location ON public.ledger_transactions(location_id);

ALTER TABLE public.ledger_entries 
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- PART 2: T-204 ROLE ARCHITECTURE (Migrating legacy roles to Target State)
-- ------------------------------------------------------------------------------

-- 2A: Seed the new SCREAMING_SNAKE_CASE role templates
INSERT INTO public.organization_role_templates (key, name, description, is_internal, is_system, sort_order)
VALUES 
    ('TENANT_OWNER', 'Tenant Owner', 'Total authority within tenant.', true, true, 10),
    ('TENANT_SUPER_ADMIN', 'Tenant Super Admin', 'Tenant-wide executive authority.', true, true, 11),
    ('TENANT_ADMIN', 'Tenant Admin', 'Admin within a tenant.', true, true, 12),
    ('TENANT_MANAGER', 'Tenant Manager', 'Manages tenant operations.', true, true, 13),
    ('TENANT_BILLING', 'Tenant Billing', 'Financial access only.', true, true, 14),
    ('TENANT_MEMBER', 'Tenant Member', 'Basic membership.', true, true, 15),
    ('DEPARTMENT_ADMIN', 'Department Admin', 'Full admin within one specific department.', true, true, 20),
    ('DEPARTMENT_MANAGER', 'Department Manager', 'Day-to-day department operations.', true, true, 21),
    ('DEPARTMENT_STAFF', 'Department Staff', 'Department-level staff.', true, true, 22),
    ('LOCATION_MANAGER', 'Location Manager', 'Runs the location.', true, true, 30),
    ('LOCATION_STAFF', 'Location Staff', 'Works at the location.', true, true, 31)
ON CONFLICT (key) DO NOTHING;

-- 2B: Migrate existing legacy rows in organization_members to the new SCREAMING_SNAKE_CASE
UPDATE public.organization_members SET role_key = 'TENANT_OWNER' WHERE role_key = 'owner' AND department_id IS NULL AND location_id IS NULL;
UPDATE public.organization_members SET role_key = 'TENANT_ADMIN' WHERE role_key = 'admin' AND department_id IS NULL AND location_id IS NULL;
UPDATE public.organization_members SET role_key = 'TENANT_MANAGER' WHERE role_key = 'manager' AND department_id IS NULL AND location_id IS NULL;
UPDATE public.organization_members SET role_key = 'TENANT_MEMBER' WHERE role_key = 'user' AND department_id IS NULL AND location_id IS NULL;
UPDATE public.organization_members SET role_key = 'TENANT_MEMBER' WHERE role_key = 'member' AND department_id IS NULL AND location_id IS NULL;
UPDATE public.organization_members SET role_key = 'DEPARTMENT_STAFF' WHERE role_key = 'staff' AND department_id IS NOT NULL;
UPDATE public.organization_members SET role_key = 'TENANT_MEMBER' WHERE role_key = 'staff' AND department_id IS NULL AND location_id IS NULL;

-- 2C: Update the RLS Policies that relied on the hardcoded lowercase 'owner'
DROP POLICY IF EXISTS "Tenant owners can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Tenant owners can manage locations" ON public.locations;

CREATE POLICY "Tenant executives can manage departments"
    ON public.departments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.tenant_id = departments.tenant_id
              AND om.user_id = auth.uid()
              AND om.role_key IN ('TENANT_OWNER', 'TENANT_SUPER_ADMIN')
              AND om.is_active = true
        )
    );

CREATE POLICY "Tenant executives can manage locations"
    ON public.locations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.tenant_id = locations.tenant_id
              AND om.user_id = auth.uid()
              AND om.role_key IN ('TENANT_OWNER', 'TENANT_SUPER_ADMIN')
              AND om.is_active = true
        )
    );

COMMIT;
