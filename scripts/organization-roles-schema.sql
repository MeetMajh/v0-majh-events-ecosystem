-- MAJH ORGANIZATION ROLES & PERMISSIONS SYSTEM
-- Granular role-based access control for multi-entity platform

-- ===========================================
-- PERMISSION DEFINITIONS
-- ===========================================
CREATE TABLE IF NOT EXISTS permission_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  is_sensitive BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Core permissions
INSERT INTO permission_definitions (key, name, description, category, is_sensitive) VALUES
  -- Financial permissions
  ('ledger.view', 'View Ledger', 'View financial transactions and balances', 'financial', true),
  ('ledger.export', 'Export Ledger', 'Export financial reports and statements', 'financial', true),
  ('payouts.view', 'View Payouts', 'View payout history and pending payouts', 'financial', true),
  ('payouts.manage', 'Manage Payouts', 'Initiate and approve payouts', 'financial', true),
  ('billing.view', 'View Billing', 'View subscription and billing info', 'financial', true),
  ('billing.manage', 'Manage Billing', 'Update payment methods and plans', 'financial', true),
  ('api_keys.view', 'View API Keys', 'View API keys (masked)', 'financial', true),
  ('api_keys.manage', 'Manage API Keys', 'Create, rotate, and revoke API keys', 'financial', true),
  
  -- Event permissions
  ('events.view', 'View Events', 'View event details and settings', 'events', false),
  ('events.create', 'Create Events', 'Create new events', 'events', false),
  ('events.edit', 'Edit Events', 'Modify event details', 'events', false),
  ('events.delete', 'Delete Events', 'Delete or cancel events', 'events', false),
  ('events.publish', 'Publish Events', 'Publish events to make them live', 'events', false),
  
  -- Ticketing permissions
  ('tickets.view', 'View Tickets', 'View ticket orders and attendees', 'ticketing', false),
  ('tickets.manage', 'Manage Tickets', 'Issue, transfer, and cancel tickets', 'ticketing', false),
  ('tickets.refund', 'Refund Tickets', 'Process ticket refunds', 'ticketing', true),
  ('checkin.perform', 'Perform Check-In', 'Check in attendees at events', 'ticketing', false),
  ('checkin.view', 'View Check-In Stats', 'View check-in statistics', 'ticketing', false),
  
  -- Team permissions
  ('team.view', 'View Team', 'View team members and roles', 'team', false),
  ('team.invite', 'Invite Members', 'Invite new team members', 'team', false),
  ('team.manage', 'Manage Team', 'Change roles and remove members', 'team', true),
  ('team.requests', 'Handle Requests', 'Approve or deny access requests', 'team', true),
  
  -- Analytics permissions
  ('analytics.basic', 'Basic Analytics', 'View basic event statistics', 'analytics', false),
  ('analytics.advanced', 'Advanced Analytics', 'View detailed analytics and reports', 'analytics', false),
  ('analytics.revenue', 'Revenue Analytics', 'View revenue breakdowns', 'analytics', true),
  
  -- Content permissions
  ('announcements.view', 'View Announcements', 'View event announcements', 'content', false),
  ('announcements.create', 'Create Announcements', 'Post event announcements', 'content', false),
  ('promo_codes.view', 'View Promo Codes', 'View promotional codes', 'content', false),
  ('promo_codes.manage', 'Manage Promo Codes', 'Create and edit promo codes', 'content', false),
  
  -- Sponsor/Partner permissions
  ('sponsorship.view', 'View Sponsorship', 'View sponsorship details for assigned events', 'partner', false),
  ('sponsorship.assets', 'Manage Assets', 'Upload and manage branding assets', 'partner', false),
  ('sponsorship.metrics', 'View Metrics', 'View engagement and impression metrics', 'partner', false),
  
  -- Venue permissions
  ('venue.view', 'View Venue Events', 'View events at assigned venue', 'partner', false),
  ('venue.capacity', 'View Capacity', 'View venue capacity and utilization', 'partner', false),
  ('venue.schedule', 'View Schedule', 'View event schedule at venue', 'partner', false)
ON CONFLICT (key) DO NOTHING;

-- ===========================================
-- ORGANIZATION ROLE TEMPLATES
-- ===========================================
CREATE TABLE IF NOT EXISTS organization_role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  is_internal BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO organization_role_templates (key, name, description, color, icon, is_internal, is_system, sort_order) VALUES
  ('owner', 'Owner', 'Full access to all organization features including financials and team management', '#dc2626', 'crown', true, true, 1),
  ('admin', 'Administrator', 'Full operational access without financial controls', '#ea580c', 'shield', true, false, 2),
  ('manager', 'Event Manager', 'Manage events, ticketing, and check-ins', '#ca8a04', 'calendar', true, false, 3),
  ('staff', 'Staff', 'Event operations and check-in access', '#16a34a', 'users', true, false, 4),
  ('member', 'Member', 'Basic read access to events', '#0284c7', 'user', true, false, 5),
  ('sponsor', 'Sponsor', 'View sponsored events and engagement metrics', '#7c3aed', 'megaphone', false, false, 6),
  ('venue', 'Venue Partner', 'View events and capacity at assigned venue', '#be185d', 'building', false, false, 7),
  ('vendor', 'Vendor', 'POS and sales access for assigned events', '#0891b2', 'store', false, false, 8),
  ('observer', 'Observer', 'Read-only access to specific areas', '#6b7280', 'eye', false, false, 9)
ON CONFLICT (key) DO NOTHING;

-- ===========================================
-- ROLE TEMPLATE PERMISSIONS (default permissions per role)
-- ===========================================
CREATE TABLE IF NOT EXISTS role_template_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key TEXT NOT NULL REFERENCES organization_role_templates(key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permission_definitions(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_key, permission_key)
);

-- Owner permissions (all)
INSERT INTO role_template_permissions (role_key, permission_key)
SELECT 'owner', key FROM permission_definitions
ON CONFLICT DO NOTHING;

-- Admin permissions (all except sensitive financial)
INSERT INTO role_template_permissions (role_key, permission_key)
SELECT 'admin', key FROM permission_definitions 
WHERE key NOT IN ('ledger.export', 'payouts.manage', 'billing.manage', 'api_keys.manage')
ON CONFLICT DO NOTHING;

-- Manager permissions
INSERT INTO role_template_permissions (role_key, permission_key) VALUES
  ('manager', 'events.view'), ('manager', 'events.create'), ('manager', 'events.edit'), ('manager', 'events.publish'),
  ('manager', 'tickets.view'), ('manager', 'tickets.manage'),
  ('manager', 'checkin.perform'), ('manager', 'checkin.view'),
  ('manager', 'analytics.basic'), ('manager', 'analytics.advanced'),
  ('manager', 'announcements.view'), ('manager', 'announcements.create'),
  ('manager', 'promo_codes.view'), ('manager', 'promo_codes.manage'),
  ('manager', 'team.view')
ON CONFLICT DO NOTHING;

-- Staff permissions
INSERT INTO role_template_permissions (role_key, permission_key) VALUES
  ('staff', 'events.view'),
  ('staff', 'tickets.view'),
  ('staff', 'checkin.perform'), ('staff', 'checkin.view'),
  ('staff', 'announcements.view')
ON CONFLICT DO NOTHING;

-- Member permissions
INSERT INTO role_template_permissions (role_key, permission_key) VALUES
  ('member', 'events.view'),
  ('member', 'announcements.view')
ON CONFLICT DO NOTHING;

-- Sponsor permissions
INSERT INTO role_template_permissions (role_key, permission_key) VALUES
  ('sponsor', 'events.view'),
  ('sponsor', 'sponsorship.view'), ('sponsor', 'sponsorship.assets'), ('sponsor', 'sponsorship.metrics'),
  ('sponsor', 'analytics.basic')
ON CONFLICT DO NOTHING;

-- Venue permissions
INSERT INTO role_template_permissions (role_key, permission_key) VALUES
  ('venue', 'events.view'),
  ('venue', 'venue.view'), ('venue', 'venue.capacity'), ('venue', 'venue.schedule'),
  ('venue', 'checkin.view'),
  ('venue', 'analytics.basic')
ON CONFLICT DO NOTHING;

-- Vendor permissions
INSERT INTO role_template_permissions (role_key, permission_key) VALUES
  ('vendor', 'events.view'),
  ('vendor', 'checkin.view')
ON CONFLICT DO NOTHING;

-- Observer permissions
INSERT INTO role_template_permissions (role_key, permission_key) VALUES
  ('observer', 'events.view'),
  ('observer', 'analytics.basic')
ON CONFLICT DO NOTHING;

-- ===========================================
-- ORGANIZATION MEMBERS (replaces tenant_memberships for richer model)
-- ===========================================
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL REFERENCES organization_role_templates(key),
  display_name TEXT,
  title TEXT,
  department TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_tenant ON organization_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role_key);

-- ===========================================
-- CUSTOM MEMBER PERMISSIONS (overrides/additions)
-- ===========================================
CREATE TABLE IF NOT EXISTS member_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permission_definitions(key),
  is_granted BOOLEAN NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, permission_key)
);

-- ===========================================
-- SCOPED ACCESS (limit access to specific resources)
-- ===========================================
CREATE TABLE IF NOT EXISTS member_resource_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('event', 'venue', 'tournament', 'all')),
  resource_id UUID,
  granted_by UUID REFERENCES auth.users(id),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_scopes_member ON member_resource_scopes(member_id);
CREATE INDEX IF NOT EXISTS idx_resource_scopes_resource ON member_resource_scopes(resource_type, resource_id);

-- ===========================================
-- ACCESS REQUESTS
-- ===========================================
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id),
  requester_email TEXT NOT NULL,
  requester_name TEXT,
  requested_role TEXT NOT NULL REFERENCES organization_role_templates(key),
  entity_type TEXT CHECK (entity_type IN ('individual', 'sponsor', 'venue', 'vendor', 'organization')),
  entity_name TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_requests_tenant ON access_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_requester ON access_requests(requester_user_id);

-- ===========================================
-- INVITATIONS
-- ===========================================
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_key TEXT NOT NULL REFERENCES organization_role_templates(key),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  message TEXT,
  resource_scopes JSONB DEFAULT '[]',
  custom_permissions JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email, status)
);

CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON organization_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON organization_invitations(token);

-- ===========================================
-- AUDIT LOG FOR ACCESS CHANGES
-- ===========================================
CREATE TABLE IF NOT EXISTS access_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  target_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_audit_tenant ON access_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_created ON access_audit_log(created_at);

-- ===========================================
-- RLS POLICIES
-- ===========================================
ALTER TABLE permission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_template_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_resource_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_audit_log ENABLE ROW LEVEL SECURITY;

-- Public read for definitions
CREATE POLICY "Anyone can view permission definitions" ON permission_definitions FOR SELECT USING (true);
CREATE POLICY "Anyone can view role templates" ON organization_role_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can view role template permissions" ON role_template_permissions FOR SELECT USING (true);

-- Organization members can view their org's members
CREATE POLICY "Members can view org members" ON organization_members
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM organization_members WHERE user_id = auth.uid() AND is_active = true)
  );

-- Only admins/owners can manage members
CREATE POLICY "Admins can manage org members" ON organization_members
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('owner', 'admin') AND is_active = true
    )
  );

-- Access requests
CREATE POLICY "Users can view own requests" ON access_requests
  FOR SELECT USING (requester_user_id = auth.uid());

CREATE POLICY "Users can create requests" ON access_requests
  FOR INSERT WITH CHECK (requester_user_id = auth.uid());

CREATE POLICY "Admins can manage requests" ON access_requests
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('owner', 'admin') AND is_active = true
    )
  );

-- Invitations
CREATE POLICY "Admins can manage invitations" ON organization_invitations
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM organization_members 
      WHERE user_id = auth.uid() AND role_key IN ('owner', 'admin') AND is_active = true
    )
  );

-- Audit log
CREATE POLICY "Owners can view audit log" ON access_audit_log
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM organization_members 
      WHERE user_id = auth.uid() AND role_key = 'owner' AND is_active = true
    )
  );

-- ===========================================
-- GRANTS
-- ===========================================
GRANT SELECT ON permission_definitions TO authenticated, anon;
GRANT SELECT ON organization_role_templates TO authenticated, anon;
GRANT SELECT ON role_template_permissions TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON member_permission_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON member_resource_scopes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON access_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON organization_invitations TO authenticated;
GRANT SELECT, INSERT ON access_audit_log TO authenticated;
