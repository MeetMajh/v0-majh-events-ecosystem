-- MAJH FEATURE FLAGS SYSTEM
-- Per-tenant feature enablement for modular platform

-- ===========================================
-- FEATURE DEFINITIONS
-- ===========================================
CREATE TABLE IF NOT EXISTS feature_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_premium BOOLEAN DEFAULT FALSE,
  default_enabled BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert core feature definitions
INSERT INTO feature_definitions (key, name, description, category, is_premium, default_enabled) VALUES
  ('wallets', 'Digital Wallets', 'User wallet system for storing and managing funds', 'financial', false, true),
  ('tournaments', 'Tournament System', 'Create and manage competitive tournaments', 'events', false, true),
  ('ticketing', 'Event Ticketing', 'Sell tickets for events with QR check-in', 'events', false, true),
  ('escrow', 'Escrow Services', 'Hold funds in escrow for secure transactions', 'financial', true, false),
  ('payouts', 'Automated Payouts', 'Automated prize and revenue distribution', 'financial', true, false),
  ('api_access', 'API Access', 'External API access with API keys', 'platform', true, false),
  ('advanced_analytics', 'Advanced Analytics', 'Detailed analytics and reporting', 'platform', true, false),
  ('multi_currency', 'Multi-Currency Support', 'Support for multiple currencies', 'financial', true, false),
  ('white_label', 'White Label', 'Custom branding and domain', 'platform', true, false),
  ('webhook_events', 'Webhook Events', 'Real-time event notifications via webhooks', 'platform', true, false),
  ('venue_management', 'Venue Management', 'Manage venue layouts and seating', 'events', true, false),
  ('pos_integration', 'POS Integration', 'Point of sale integration for vendors', 'financial', true, false),
  ('staff_management', 'Staff Management', 'Manage event staff and volunteers', 'events', true, false),
  ('badge_printing', 'Badge Printing', 'Custom badge and credential printing', 'events', true, false)
ON CONFLICT (key) DO NOTHING;

-- ===========================================
-- TENANT FEATURES (which features each tenant has)
-- ===========================================
CREATE TABLE IF NOT EXISTS tenant_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL REFERENCES feature_definitions(key),
  is_enabled BOOLEAN DEFAULT TRUE,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  enabled_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ, -- For trial features
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant ON tenant_features(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_features_key ON tenant_features(feature_key);

-- ===========================================
-- FEATURE USAGE TRACKING
-- ===========================================
CREATE TABLE IF NOT EXISTS feature_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  feature_key TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_tenant ON feature_usage_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature ON feature_usage_log(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_usage_created ON feature_usage_log(created_at);

-- ===========================================
-- PRICING PLAN FEATURES (which features included in plans)
-- ===========================================
CREATE TABLE IF NOT EXISTS pricing_plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL REFERENCES feature_definitions(key),
  limit_value INT, -- NULL = unlimited, otherwise max count
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, feature_key)
);

-- ===========================================
-- RPC: CHECK IF TENANT HAS FEATURE
-- ===========================================
CREATE OR REPLACE FUNCTION has_feature(p_tenant_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_enabled BOOLEAN;
  v_expires TIMESTAMPTZ;
BEGIN
  -- Check tenant-specific override first
  SELECT is_enabled, expires_at 
  INTO v_enabled, v_expires
  FROM tenant_features
  WHERE tenant_id = p_tenant_id AND feature_key = p_feature_key;
  
  IF FOUND THEN
    -- Check if not expired
    IF v_expires IS NOT NULL AND v_expires < NOW() THEN
      RETURN FALSE;
    END IF;
    RETURN v_enabled;
  END IF;
  
  -- Check if feature is included in tenant's subscription plan
  SELECT TRUE INTO v_enabled
  FROM tenant_subscriptions ts
  JOIN pricing_plan_features ppf ON ppf.plan_id = ts.plan_id
  WHERE ts.tenant_id = p_tenant_id 
    AND ppf.feature_key = p_feature_key
    AND ts.status = 'active';
  
  IF FOUND THEN
    RETURN TRUE;
  END IF;
  
  -- Fall back to feature default
  SELECT default_enabled INTO v_enabled
  FROM feature_definitions
  WHERE key = p_feature_key;
  
  RETURN COALESCE(v_enabled, FALSE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================
-- RPC: GET ALL FEATURES FOR TENANT
-- ===========================================
CREATE OR REPLACE FUNCTION get_tenant_features(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
  v_features JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'key', fd.key,
      'name', fd.name,
      'description', fd.description,
      'category', fd.category,
      'is_premium', fd.is_premium,
      'is_enabled', has_feature(p_tenant_id, fd.key),
      'expires_at', tf.expires_at
    ) ORDER BY fd.category, fd.name
  ) INTO v_features
  FROM feature_definitions fd
  LEFT JOIN tenant_features tf ON tf.tenant_id = p_tenant_id AND tf.feature_key = fd.key;
  
  RETURN COALESCE(v_features, '[]'::json);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================
-- RPC: ENABLE FEATURE FOR TENANT
-- ===========================================
CREATE OR REPLACE FUNCTION enable_tenant_feature(
  p_tenant_id UUID,
  p_feature_key TEXT,
  p_enabled_by UUID,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  INSERT INTO tenant_features (tenant_id, feature_key, is_enabled, enabled_by, expires_at)
  VALUES (p_tenant_id, p_feature_key, TRUE, p_enabled_by, p_expires_at)
  ON CONFLICT (tenant_id, feature_key) 
  DO UPDATE SET 
    is_enabled = TRUE,
    enabled_by = p_enabled_by,
    expires_at = COALESCE(p_expires_at, tenant_features.expires_at),
    updated_at = NOW();
  
  -- Log the action
  INSERT INTO feature_usage_log (tenant_id, feature_key, action, user_id)
  VALUES (p_tenant_id, p_feature_key, 'enabled', p_enabled_by);
  
  RETURN json_build_object('success', true, 'feature', p_feature_key, 'enabled', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- RPC: DISABLE FEATURE FOR TENANT
-- ===========================================
CREATE OR REPLACE FUNCTION disable_tenant_feature(
  p_tenant_id UUID,
  p_feature_key TEXT,
  p_disabled_by UUID
)
RETURNS JSON AS $$
BEGIN
  UPDATE tenant_features 
  SET is_enabled = FALSE, updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND feature_key = p_feature_key;
  
  -- Log the action
  INSERT INTO feature_usage_log (tenant_id, feature_key, action, user_id)
  VALUES (p_tenant_id, p_feature_key, 'disabled', p_disabled_by);
  
  RETURN json_build_object('success', true, 'feature', p_feature_key, 'enabled', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- MIDDLEWARE FUNCTION FOR API FEATURE CHECKS
-- ===========================================
CREATE OR REPLACE FUNCTION require_feature(p_tenant_id UUID, p_feature_key TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT has_feature(p_tenant_id, p_feature_key) THEN
    RAISE EXCEPTION 'Feature % is not enabled for this tenant. Upgrade required.', p_feature_key
      USING ERRCODE = 'feature_required';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- RLS POLICIES
-- ===========================================
ALTER TABLE feature_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_plan_features ENABLE ROW LEVEL SECURITY;

-- Feature definitions readable by all authenticated users
DROP POLICY IF EXISTS "Anyone can view feature definitions" ON feature_definitions;
CREATE POLICY "Anyone can view feature definitions" ON feature_definitions
  FOR SELECT USING (true);

-- Tenant features only visible to tenant members
DROP POLICY IF EXISTS "Tenant members can view their features" ON tenant_features;
CREATE POLICY "Tenant members can view their features" ON tenant_features
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid())
  );

-- Feature usage only visible to tenant admins
DROP POLICY IF EXISTS "Tenant admins can view feature usage" ON feature_usage_log;
CREATE POLICY "Tenant admins can view feature usage" ON feature_usage_log
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Pricing plan features readable by all
DROP POLICY IF EXISTS "Anyone can view plan features" ON pricing_plan_features;
CREATE POLICY "Anyone can view plan features" ON pricing_plan_features
  FOR SELECT USING (true);

-- ===========================================
-- GRANTS
-- ===========================================
GRANT SELECT ON feature_definitions TO authenticated, anon;
GRANT SELECT ON tenant_features TO authenticated;
GRANT SELECT ON feature_usage_log TO authenticated;
GRANT SELECT ON pricing_plan_features TO authenticated, anon;

GRANT EXECUTE ON FUNCTION has_feature(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_features(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION enable_tenant_feature(UUID, TEXT, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION disable_tenant_feature(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION require_feature(UUID, TEXT) TO authenticated;
