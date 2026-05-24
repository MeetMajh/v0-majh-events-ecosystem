BEGIN;

-- Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_tenant_department_slug UNIQUE (tenant_id, slug)
);

-- Create locations table
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    timezone TEXT DEFAULT 'UTC',
    tax_rate NUMERIC(5, 4) DEFAULT 0.0000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_department_location_slug UNIQUE (department_id, slug)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_departments_tenant ON public.departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_tenant ON public.locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_department ON public.locations(department_id);

-- Add scoping columns to role tables (Path B foundation)
ALTER TABLE public.organization_role_templates 
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE;

ALTER TABLE public.role_template_permissions 
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE;

-- Add scoping to organization_members
ALTER TABLE public.organization_members 
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- Indexes on the new FK columns for query performance
CREATE INDEX IF NOT EXISTS idx_org_role_templates_tenant ON public.organization_role_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_role_templates_dept ON public.organization_role_templates(department_id);
CREATE INDEX IF NOT EXISTS idx_role_template_perms_tenant ON public.role_template_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_template_perms_dept ON public.role_template_permissions(department_id);
CREATE INDEX IF NOT EXISTS idx_org_members_dept ON public.organization_members(department_id);
CREATE INDEX IF NOT EXISTS idx_org_members_location ON public.organization_members(location_id);

-- RLS for departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their tenant's departments"
    ON public.departments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.tenant_id = departments.tenant_id
              AND om.user_id = auth.uid()
              AND om.is_active = true
        )
    );

CREATE POLICY "Tenant owners can manage departments"
    ON public.departments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.tenant_id = departments.tenant_id
              AND om.user_id = auth.uid()
              AND om.role_key = 'owner'
              AND om.is_active = true
        )
    );

-- RLS for locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their tenant's locations"
    ON public.locations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.tenant_id = locations.tenant_id
              AND om.user_id = auth.uid()
              AND om.is_active = true
        )
    );

CREATE POLICY "Tenant owners can manage locations"
    ON public.locations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.tenant_id = locations.tenant_id
              AND om.user_id = auth.uid()
              AND om.role_key = 'owner'
              AND om.is_active = true
        )
    );

COMMIT;
