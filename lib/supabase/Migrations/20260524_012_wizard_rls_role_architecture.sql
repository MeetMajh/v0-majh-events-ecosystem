-- ==============================================================================
-- Migration: 20260524_012_wizard_rls_role_architecture
-- Purpose: Update Wizard schema RLS policies to use the new T-204 SCREAMING_SNAKE_CASE roles
--          and grant tenant admins access to manage tenant-specific guide content.
-- ==============================================================================

BEGIN;

-- 1. Drop old legacy 'owner' policies from the Wizard tables
DROP POLICY IF EXISTS "Tenant owners manage categories" ON public.guide_categories;
DROP POLICY IF EXISTS "Tenant owners manage articles" ON public.guide_articles;
DROP POLICY IF EXISTS "Tenant owners manage contexts" ON public.guide_ui_contexts;

-- 2. Create updated multi-tenant policies that respect the new Role Architecture.
-- This allows TENANT_OWNER, TENANT_SUPER_ADMIN, and TENANT_ADMIN to manage the Guide content
-- for their specific tenant. Platform-wide content (tenant_id IS NULL) remains protected.

CREATE POLICY "Tenant executives and admins manage categories"
    ON public.guide_categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.tenant_id = guide_categories.tenant_id
              AND om.user_id = auth.uid()
              AND om.role_key IN ('TENANT_OWNER', 'TENANT_SUPER_ADMIN', 'TENANT_ADMIN')
              AND om.is_active = true
        )
    );

CREATE POLICY "Tenant executives and admins manage articles"
    ON public.guide_articles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.guide_categories gc
            JOIN public.organization_members om ON om.tenant_id = gc.tenant_id
            WHERE gc.id = guide_articles.category_id
              AND om.user_id = auth.uid()
              AND om.role_key IN ('TENANT_OWNER', 'TENANT_SUPER_ADMIN', 'TENANT_ADMIN')
              AND om.is_active = true
        )
    );

CREATE POLICY "Tenant executives and admins manage UI contexts"
    ON public.guide_ui_contexts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.guide_articles ga
            JOIN public.guide_categories gc ON gc.id = ga.category_id
            JOIN public.organization_members om ON om.tenant_id = gc.tenant_id
            WHERE ga.id = guide_ui_contexts.article_id
              AND om.user_id = auth.uid()
              AND om.role_key IN ('TENANT_OWNER', 'TENANT_SUPER_ADMIN', 'TENANT_ADMIN')
              AND om.is_active = true
        )
    );

COMMIT;
