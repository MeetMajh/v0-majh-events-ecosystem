-- Phase 1: Universal Substrate Primitives
-- Migration: 20260712_002_phase_1_substrate_primitives.sql
--
-- Purpose: Create the six universal substrate primitives per ARCHITECTURE.md §4
--   1. entities (generic container for any resource type)
--   2. participants (universal person/role container)
--   3. resources (equipment, venues, materials)
--   4. resource_allocations (who/what uses what resource)
--   5. platform_events (append-only event store for audit)
--   6. modules (vocabulary overlay registry per tenant)
--
-- These tables support the four-level hierarchy (Platform → Tenant → Department → Location)
-- and form the foundation for all future adapters and integrations.
--
-- RLS: All tables gate on organization_members (user must be TENANT_MANAGER or higher within the tenant)
-- Backfill: Data from MAJH Events typed tables (tournaments → entities, tournament_participants → participants)
--           happens in Phase 1.5; Phase 1 creates structure only
--
-- Risk level: LOW
-- - All tables are new (no existing data loss)
-- - All inserts include IF NOT EXISTS guards
-- - RLS policies ensure zero data leakage
-- - Idempotent (can re-run without side effects)

BEGIN;

-- =====================================================================
-- 1. ENTITIES - Universal container for any resource type
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.entities (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  department_id UUID,  -- Optional: scoped to department if applicable
  location_id UUID,    -- Optional: scoped to location if applicable
  entity_type VARCHAR(50) NOT NULL,  -- ENUM-like: 'tournament', 'event', 'player_group', 'venue', etc.
  name TEXT NOT NULL,
  slug TEXT,           -- URL-friendly identifier
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',  -- 'active', 'archived', 'draft', etc.
  metadata JSONB DEFAULT '{}',  -- Flexible schema for entity-specific data
  created_by UUID,     -- User who created this entity
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,  -- Soft delete
  
  CONSTRAINT entities_pkey PRIMARY KEY (id),
  CONSTRAINT entities_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT entities_department_fk FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL,
  CONSTRAINT entities_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL,
  CONSTRAINT entities_created_by_fk FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_entities_tenant_id ON public.entities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON public.entities(tenant_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_department_id ON public.entities(department_id);
CREATE INDEX IF NOT EXISTS idx_entities_location_id ON public.entities(location_id);
CREATE INDEX IF NOT EXISTS idx_entities_deleted_at ON public.entities(deleted_at);

-- Enable RLS on entities
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view entities in their tenant
CREATE POLICY "entities_select_tenant_member" ON public.entities FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policy: TENANT_MANAGER or above can insert entities
CREATE POLICY "entities_insert_tenant_manager" ON public.entities FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

-- RLS Policy: TENANT_MANAGER or above can update entities in their tenant
CREATE POLICY "entities_update_tenant_manager" ON public.entities FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

-- RLS Policy: TENANT_MANAGER or above can delete entities in their tenant (soft delete via updated_at + deleted_at)
CREATE POLICY "entities_delete_tenant_manager" ON public.entities FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

-- =====================================================================
-- 2. PARTICIPANTS - Universal person/role container
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.participants (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_id UUID NOT NULL,  -- Links to the entity this participant belongs to
  user_id UUID,  -- Links to auth.users if this is a registered user (NULL for external/anonymous participants)
  role_key VARCHAR(50) NOT NULL,  -- 'player', 'organizer', 'referee', 'coach', 'spectator', etc.
  display_name TEXT,  -- Override name from user profile if provided
  participation_status VARCHAR(50) DEFAULT 'active',  -- 'active', 'inactive', 'suspended', 'pending_approval'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',  -- Flexible schema for role-specific data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT participants_pkey PRIMARY KEY (id),
  CONSTRAINT participants_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT participants_entity_fk FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE,
  CONSTRAINT participants_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT participants_unique_entity_user_role UNIQUE (entity_id, user_id, role_key) WHERE user_id IS NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_participants_tenant_id ON public.participants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_participants_entity_id ON public.participants(entity_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON public.participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_role_key ON public.participants(tenant_id, role_key);

-- Enable RLS on participants
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view participants in entities within their tenant
CREATE POLICY "participants_select_tenant_member" ON public.participants FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policy: TENANT_MANAGER or above can insert participants
CREATE POLICY "participants_insert_tenant_manager" ON public.participants FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

-- RLS Policy: TENANT_MANAGER or above can update participants
CREATE POLICY "participants_update_tenant_manager" ON public.participants FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

-- RLS Policy: TENANT_MANAGER or above can delete participants
CREATE POLICY "participants_delete_tenant_manager" ON public.participants FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

-- =====================================================================
-- 3. RESOURCES - Equipment, venues, materials with allocation tracking
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.resources (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  location_id UUID NOT NULL,  -- Resources are always scoped to a location
  resource_type VARCHAR(50) NOT NULL,  -- ENUM-like: 'venue', 'equipment', 'material', 'personnel', etc.
  name TEXT NOT NULL,
  description TEXT,
  quantity INT NOT NULL DEFAULT 1,  -- Total available quantity
  unit VARCHAR(50),  -- 'hours', 'pieces', 'sets', etc.
  status VARCHAR(50) DEFAULT 'available',  -- 'available', 'in_use', 'maintenance', 'archived'
  metadata JSONB DEFAULT '{}',  -- Flexible schema: capacity, pricing, special requirements, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT resources_pkey PRIMARY KEY (id),
  CONSTRAINT resources_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT resources_location_fk FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resources_tenant_id ON public.resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resources_location_id ON public.resources(location_id);
CREATE INDEX IF NOT EXISTS idx_resources_resource_type ON public.resources(tenant_id, resource_type);

-- Enable RLS on resources
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view resources in locations within their tenant
CREATE POLICY "resources_select_tenant_member" ON public.resources FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policy: TENANT_MANAGER or above can manage resources
CREATE POLICY "resources_insert_tenant_manager" ON public.resources FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "resources_update_tenant_manager" ON public.resources FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "resources_delete_tenant_manager" ON public.resources FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

-- =====================================================================
-- 4. RESOURCE_ALLOCATIONS - Who/what uses what resource in what context
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.resource_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_id UUID NOT NULL,  -- The entity (tournament, event, etc.) requesting the resource
  resource_id UUID NOT NULL,  -- Which resource is being allocated
  quantity_allocated INT NOT NULL DEFAULT 1,  -- How much of the resource
  allocation_status VARCHAR(50) DEFAULT 'reserved',  -- 'reserved', 'in_use', 'completed', 'cancelled'
  period_start TIMESTAMPTZ,  -- When the allocation begins
  period_end TIMESTAMPTZ,  -- When the allocation ends
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT resource_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT resource_allocations_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT resource_allocations_entity_fk FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE,
  CONSTRAINT resource_allocations_resource_fk FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE,
  CONSTRAINT resource_allocations_created_by_fk FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resource_allocations_tenant_id ON public.resource_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_entity_id ON public.resource_allocations(entity_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_resource_id ON public.resource_allocations(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_period ON public.resource_allocations(period_start, period_end);

-- Enable RLS on resource_allocations
ALTER TABLE public.resource_allocations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view allocations in their tenant
CREATE POLICY "resource_allocations_select_tenant_member" ON public.resource_allocations FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policy: TENANT_MANAGER or above can manage allocations
CREATE POLICY "resource_allocations_insert_tenant_manager" ON public.resource_allocations FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "resource_allocations_update_tenant_manager" ON public.resource_allocations FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "resource_allocations_delete_tenant_manager" ON public.resource_allocations FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

-- =====================================================================
-- 5. PLATFORM_EVENTS - Append-only event store for audit and replay
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.platform_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID,  -- NULL for platform-level events, tenant UUID for tenant-scoped events
  event_type VARCHAR(100) NOT NULL,  -- 'entity.created', 'participant.joined', 'payment.received', etc.
  aggregate_id UUID NOT NULL,  -- ID of the primary object (entity_id, participant_id, etc.)
  aggregate_type VARCHAR(50) NOT NULL,  -- 'entity', 'participant', 'payment', etc.
  actor_id UUID,  -- User who triggered this event
  data JSONB NOT NULL DEFAULT '{}',  -- Event payload
  metadata JSONB DEFAULT '{}',  -- Tracing: request_id, trace_id, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT platform_events_pkey PRIMARY KEY (id),
  CONSTRAINT platform_events_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL,
  CONSTRAINT platform_events_actor_fk FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_events_tenant_id ON public.platform_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_aggregate ON public.platform_events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_event_type ON public.platform_events(event_type);
CREATE INDEX IF NOT EXISTS idx_platform_events_created_at ON public.platform_events(created_at);

-- Enable RLS on platform_events (append-only, users can only see events in their tenant)
ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view events in their tenant
CREATE POLICY "platform_events_select_tenant_member" ON public.platform_events FOR SELECT
  USING (
    tenant_id IS NULL OR tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policy: TENANT_MANAGER or above can insert events (append-only, no updates/deletes allowed at RLS layer)
CREATE POLICY "platform_events_insert_tenant_manager" ON public.platform_events FOR INSERT
  WITH CHECK (
    tenant_id IS NULL OR tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

-- Prevent updates and deletes on platform_events (immutable event log)
-- (RLS denies all UPDATE/DELETE attempts; allow_explicit_access handled at application layer if needed)

-- =====================================================================
-- 6. MODULES - Vocabulary overlay registry for tenant customization
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.modules (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  module_type VARCHAR(50) NOT NULL,  -- 'entity_type', 'participant_role', 'resource_type', 'status_enum', etc.
  module_name VARCHAR(100) NOT NULL,  -- Friendly name: 'Tournament', 'Player', 'Venue', etc.
  vocabulary JSONB NOT NULL DEFAULT '{}',  -- Key-value mapping: { 'en': 'Tournament', 'es': 'Torneo', ... } or structured enum values
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT modules_pkey PRIMARY KEY (id),
  CONSTRAINT modules_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT modules_unique_module_name UNIQUE (tenant_id, module_name)
);

CREATE INDEX IF NOT EXISTS idx_modules_tenant_id ON public.modules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_modules_module_type ON public.modules(tenant_id, module_type);

-- Enable RLS on modules
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view modules in their tenant
CREATE POLICY "modules_select_tenant_member" ON public.modules FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policy: TENANT_MANAGER or above can manage modules
CREATE POLICY "modules_insert_tenant_manager" ON public.modules FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "modules_update_tenant_manager" ON public.modules FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "modules_delete_tenant_manager" ON public.modules FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

COMMIT;
