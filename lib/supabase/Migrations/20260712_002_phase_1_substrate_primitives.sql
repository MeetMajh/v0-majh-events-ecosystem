-- Phase 1: Universal Substrate Primitives
-- Migration: 20260712_002_phase_1_substrate_primitives.sql
-- Date: 2026-07-12
-- Purpose: Create the six universal substrate primitives per ARCHITECTURE.md §4
--   1. entities (generic container for any resource type)
--   2. participants (universal person/role container)
--   3. resources (equipment, venues, materials)
--   4. resource_allocations (who/what uses what resource)
--   5. platform_events (append-only event store for audit)
--   6. modules (vocabulary overlay registry per tenant)
-- RLS: All tables gate on organization_members (TENANT_MANAGER+ within tenant)

BEGIN;

-- 1. ENTITIES - Universal container for any resource type
CREATE TABLE IF NOT EXISTS public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  entity_type VARCHAR(50) NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_entities_tenant_id ON public.entities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON public.entities(tenant_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_department_id ON public.entities(department_id);
CREATE INDEX IF NOT EXISTS idx_entities_location_id ON public.entities(location_id);
CREATE INDEX IF NOT EXISTS idx_entities_deleted_at ON public.entities(deleted_at);

ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entities_select_tenant_member" ON public.entities FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "entities_insert_tenant_manager" ON public.entities FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')));

CREATE POLICY "entities_update_tenant_manager" ON public.entities FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')));

CREATE POLICY "entities_delete_tenant_manager" ON public.entities FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')));

-- 2. PARTICIPANTS - Universal person/role container
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  participant_type VARCHAR(50) NOT NULL,
  role VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participants_tenant_id ON public.participants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_participants_entity_id ON public.participants(entity_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON public.participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_participant_type ON public.participants(tenant_id, participant_type);

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants_select_tenant_member" ON public.participants FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "participants_insert_tenant_manager" ON public.participants FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')));

CREATE POLICY "participants_update_tenant_manager" ON public.participants FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')));

CREATE POLICY "participants_delete_tenant_manager" ON public.participants FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')));

-- 3. RESOURCES - Equipment, venues, materials
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity INT DEFAULT 1,
  unit VARCHAR(50),
  status VARCHAR(50) DEFAULT 'available',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_tenant_id ON public.resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resources_location_id ON public.resources(location_id);
CREATE INDEX IF NOT EXISTS idx_resources_resource_type ON public.resources(tenant_id, resource_type);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resources_select_tenant_member" ON public.resources FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "resources_insert_tenant_manager" ON public.resources FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')));

CREATE POLICY "resources_update_tenant_manager" ON public.resources FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')));

CREATE POLICY "resources_delete_tenant_manager" ON public.resources FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')));

-- 4. RESOURCE_ALLOCATIONS - Who/what uses what resource
CREATE TABLE IF NOT EXISTS public.resource_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
  allocation_type VARCHAR(50) NOT NULL,
  quantity_allocated INT DEFAULT 1,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_allocations_tenant_id ON public.resource_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_resource_id ON public.resource_allocations(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_entity_id ON public.resource_allocations(entity_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_participant_id ON public.resource_allocations(participant_id);

ALTER TABLE public.resource_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resource_allocations_select_tenant_member" ON public.resource_allocations FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "resource_allocations_insert_tenant_manager" ON public.resource_allocations FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')));

CREATE POLICY "resource_allocations_update_tenant_manager" ON public.resource_allocations FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')));

CREATE POLICY "resource_allocations_delete_tenant_manager" ON public.resource_allocations FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')));

-- 5. PLATFORM_EVENTS - Append-only event store (immutable)
CREATE TABLE IF NOT EXISTS public.platform_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role VARCHAR(50),
  before_state JSONB,
  after_state JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_tenant_id ON public.platform_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_event_type ON public.platform_events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_platform_events_resource_id ON public.platform_events(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_created_at ON public.platform_events(created_at DESC);

ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_events_select_tenant_member" ON public.platform_events FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "platform_events_insert_service_role" ON public.platform_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 6. MODULES - Vocabulary overlay registry per tenant
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key VARCHAR(50) NOT NULL,
  module_name TEXT NOT NULL,
  module_version VARCHAR(20) DEFAULT '1.0.0',
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_modules_tenant_id ON public.modules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_modules_module_key ON public.modules(tenant_id, module_key);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modules_select_tenant_member" ON public.modules FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "modules_insert_tenant_owner" ON public.modules FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_OWNER', 'PLATFORM_OWNER')));

CREATE POLICY "modules_update_tenant_owner" ON public.modules FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_OWNER', 'PLATFORM_OWNER')))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_OWNER', 'PLATFORM_OWNER')));

CREATE POLICY "modules_delete_tenant_owner" ON public.modules FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.organization_members WHERE user_id = auth.uid() AND role_key IN ('TENANT_OWNER', 'PLATFORM_OWNER')));

COMMIT;
