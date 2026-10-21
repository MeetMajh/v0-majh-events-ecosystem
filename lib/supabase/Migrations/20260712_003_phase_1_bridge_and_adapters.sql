-- Phase 1: Bridge Layer and External Adapter Scaffolding
-- Migration: 20260712_003_phase_1_bridge_and_adapters.sql
--
-- Purpose: Create infrastructure for external system adapters (Monday.com, QuickBooks, Square, POS)
--   1. external_field_mappings - Registry of how external system fields map to substrate
--   2. external_system_credentials - Secure storage for adapter API keys (structure only)
--   3. sync_queue - Event queue for external system syncs (structure only)
--   4. adapter_logs - Audit trail for adapter operations
--
-- These are scaffolding tables (structure created, data populated in Phase 1.5+ when adapters are built).
-- They enable the "shadow, augment, migrate" adapter pattern described in ARCHITECTURE.md §11.
--
-- Risk level: MINIMAL
-- - All tables are new (scaffolding)
-- - No data in Phase 1 (populated Phase 1.5+)
-- - RLS gates all access to tenant members
-- - Idempotent (IF NOT EXISTS guards)
--
-- Verification after apply:
--   SELECT table_name FROM information_schema.tables 
--   WHERE schema='public' AND table_name IN ('external_field_mappings', 'external_system_credentials', 'sync_queue', 'adapter_logs');
--   Expected: 4 rows

BEGIN;

-- =====================================================================
-- 1. EXTERNAL_FIELD_MAPPINGS - Registry of field mappings for adapters
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.external_field_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  external_system VARCHAR(50) NOT NULL,  -- ENUM-like: 'monday_com', 'quickbooks', 'square', 'custom_pos', etc.
  external_field_name TEXT NOT NULL,  -- Original field name in external system
  substrate_entity_type VARCHAR(50) NOT NULL,  -- Which substrate primitive: 'entity', 'participant', 'resource', etc.
  substrate_field_name TEXT NOT NULL,  -- Target field in substrate (e.g., 'entity.name', 'participant.role_key')
  data_type_mapping VARCHAR(100),  -- Type conversion spec: 'string → text', 'integer → int', etc.
  direction VARCHAR(20) DEFAULT 'read',  -- 'read' (external → substrate), 'write' (substrate → external), 'bidirectional'
  transformation_logic JSONB DEFAULT '{}',  -- Optional: { "type": "map", "values": {...} } or custom transform rules
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT external_field_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT external_field_mappings_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT external_field_mappings_unique UNIQUE (tenant_id, external_system, external_field_name, substrate_entity_type)
);

CREATE INDEX IF NOT EXISTS idx_external_field_mappings_tenant ON public.external_field_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_external_field_mappings_system ON public.external_field_mappings(external_system, is_active);
CREATE INDEX IF NOT EXISTS idx_external_field_mappings_entity_type ON public.external_field_mappings(substrate_entity_type);

ALTER TABLE public.external_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "external_field_mappings_select_tenant_manager" ON public.external_field_mappings FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "external_field_mappings_insert_tenant_manager" ON public.external_field_mappings FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "external_field_mappings_update_tenant_manager" ON public.external_field_mappings FOR UPDATE
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

CREATE POLICY "external_field_mappings_delete_tenant_manager" ON public.external_field_mappings FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

-- =====================================================================
-- 2. EXTERNAL_SYSTEM_CREDENTIALS - Secure storage for adapter API keys
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.external_system_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  external_system VARCHAR(50) NOT NULL,  -- 'monday_com', 'quickbooks', 'square', 'custom_pos', etc.
  credential_type VARCHAR(50) NOT NULL,  -- 'api_key', 'oauth_token', 'webhook_secret', 'custom_field_mapping', etc.
  credential_ref VARCHAR(500),  -- Pointer to secrets storage (e.g., 'vault://monday_com_api_key_prod', or empty if managed externally)
  verified_at TIMESTAMPTZ,  -- When the credential was last verified to work
  verification_status VARCHAR(50) DEFAULT 'unverified',  -- 'verified', 'expired', 'invalid', 'unverified'
  status VARCHAR(50) DEFAULT 'active',  -- 'active', 'inactive', 'revoked'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT external_system_credentials_pkey PRIMARY KEY (id),
  CONSTRAINT external_system_credentials_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT external_system_credentials_unique UNIQUE (tenant_id, external_system, credential_type)
);

CREATE INDEX IF NOT EXISTS idx_external_system_credentials_tenant ON public.external_system_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_external_system_credentials_system ON public.external_system_credentials(external_system, status);

ALTER TABLE public.external_system_credentials ENABLE ROW LEVEL SECURITY;

-- RLS: Only PLATFORM_OWNER or TENANT_OWNER can view credentials (sensitive!)
CREATE POLICY "external_system_credentials_select_owner_only" ON public.external_system_credentials FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "external_system_credentials_insert_owner_only" ON public.external_system_credentials FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "external_system_credentials_update_owner_only" ON public.external_system_credentials FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_OWNER', 'PLATFORM_OWNER')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "external_system_credentials_delete_owner_only" ON public.external_system_credentials FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

-- =====================================================================
-- 3. SYNC_QUEUE - Event queue for external system syncs
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.sync_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  external_system VARCHAR(50) NOT NULL,
  sync_direction VARCHAR(20) NOT NULL,  -- 'inbound' (external → substrate) or 'outbound' (substrate → external)
  entity_id UUID,  -- Which substrate entity (if applicable)
  entity_type VARCHAR(50),  -- What type of entity
  external_record_id TEXT,  -- ID in the external system
  change_type VARCHAR(50),  -- 'create', 'update', 'delete', 'sync_full'
  change_payload JSONB,  -- What changed (delta or full payload)
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed', 'skipped'
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  attempted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retry_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT sync_queue_pkey PRIMARY KEY (id),
  CONSTRAINT sync_queue_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT sync_queue_entity_fk FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_tenant ON public.sync_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON public.sync_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_external_system ON public.sync_queue(external_system, sync_direction);

ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_queue_select_tenant_member" ON public.sync_queue FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "sync_queue_insert_system" ON public.sync_queue FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "sync_queue_update_system" ON public.sync_queue FOR UPDATE
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

-- =====================================================================
-- 4. ADAPTER_LOGS - Audit trail for adapter operations
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.adapter_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID,  -- NULL for platform-level adapter logs
  adapter_name VARCHAR(100) NOT NULL,  -- 'monday_com_sync', 'quickbooks_export', etc.
  operation VARCHAR(100) NOT NULL,  -- 'authenticate', 'fetch_items', 'push_update', 'sync_start', 'sync_end', etc.
  status VARCHAR(50),  -- 'success', 'failed', 'warning', 'partial'
  details JSONB DEFAULT '{}',  -- { "records_synced": 42, "errors": [...], "duration_ms": 1234 }
  error_message TEXT,
  error_code TEXT,
  actor_id UUID,  -- Who triggered this (if user-initiated)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT adapter_logs_pkey PRIMARY KEY (id),
  CONSTRAINT adapter_logs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL,
  CONSTRAINT adapter_logs_actor_fk FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_adapter_logs_tenant ON public.adapter_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_adapter_logs_adapter_name ON public.adapter_logs(adapter_name, status);
CREATE INDEX IF NOT EXISTS idx_adapter_logs_created_at ON public.adapter_logs(created_at DESC);

ALTER TABLE public.adapter_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adapter_logs_select_tenant_manager" ON public.adapter_logs FOR SELECT
  USING (
    tenant_id IS NULL OR tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

CREATE POLICY "adapter_logs_insert_system_only" ON public.adapter_logs FOR INSERT
  WITH CHECK (
    -- Only system (service role) can insert; application code enforces this
    auth.uid() IS NULL OR tenant_id IN (
      SELECT tenant_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('TENANT_MANAGER', 'TENANT_OWNER', 'PLATFORM_OWNER')
    )
  );

COMMIT;
