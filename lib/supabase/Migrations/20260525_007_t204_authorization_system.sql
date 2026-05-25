-- 20260525_007_t204_authorization_system.sql
-- T-204: Unified Authorization System Migration
-- 
-- This migration:
-- 1. Expands staff_roles to support T-204 role hierarchy
-- 2. Creates role_change_logs for audit trail
-- 3. Updates profiles.role to support new roles
-- 4. Adds permission helper functions
-- 5. Configures RLS policies for permission management

BEGIN;

-- ============================================================================
-- STEP 1: Update staff_roles table to support T-204 roles
-- ============================================================================

-- Drop existing constraint if it exists
ALTER TABLE staff_roles 
DROP CONSTRAINT IF EXISTS staff_roles_role_check;

-- Add new constraint supporting all T-204 roles
ALTER TABLE staff_roles 
ADD CONSTRAINT staff_roles_role_check 
CHECK (role IN (
  -- Platform level
  'PLATFORM_OWNER',
  'PLATFORM_ADMIN',
  -- Tenant level
  'TENANT_OWNER',
  'TENANT_SUPER_ADMIN',
  'TENANT_ADMIN',
  'TENANT_MANAGER',
  'TENANT_STAFF',
  -- Legacy roles (for backward compatibility)
  'owner',
  'manager',
  'staff',
  'organizer',
  'moderator'
));

-- Add tenant scoping to staff_roles if not exists
ALTER TABLE staff_roles
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Create index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_staff_roles_tenant_id ON staff_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_roles_role ON staff_roles(role);

-- ============================================================================
-- STEP 2: Create role_change_logs audit table
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_role TEXT,
  new_role TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('grant', 'revoke', 'modify')),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_role_change_logs_target_user ON role_change_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_role_change_logs_changed_by ON role_change_logs(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_role_change_logs_tenant ON role_change_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_change_logs_created_at ON role_change_logs(created_at DESC);

-- ============================================================================
-- STEP 3: Update profiles table to support new roles
-- ============================================================================

-- Drop existing constraint if it exists
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint supporting all profile roles
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN (
  'admin',
  'organizer', 
  'user',
  'staff',
  'moderator'
));

-- Add is_organizer column if not exists (for backward compatibility)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_organizer BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- STEP 4: Create permission helper functions
-- ============================================================================

-- Function to get a user's highest role level
CREATE OR REPLACE FUNCTION get_user_role_level(user_role TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE user_role
    WHEN 'PLATFORM_OWNER' THEN 100
    WHEN 'PLATFORM_ADMIN' THEN 90
    WHEN 'TENANT_OWNER' THEN 80
    WHEN 'TENANT_SUPER_ADMIN' THEN 75
    WHEN 'TENANT_ADMIN' THEN 70
    WHEN 'TENANT_MANAGER' THEN 60
    WHEN 'TENANT_STAFF' THEN 50
    WHEN 'owner' THEN 80
    WHEN 'manager' THEN 60
    WHEN 'staff' THEN 50
    WHEN 'admin' THEN 70
    WHEN 'organizer' THEN 40
    WHEN 'moderator' THEN 35
    WHEN 'user' THEN 10
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if user has minimum role level
CREATE OR REPLACE FUNCTION has_minimum_role(user_role TEXT, required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role_level(user_role) >= get_user_role_level(required_role);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if user is staff (TENANT_STAFF or higher)
CREATE OR REPLACE FUNCTION is_staff_role(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role_level(user_role) >= 50;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if user is manager (TENANT_MANAGER or higher)
CREATE OR REPLACE FUNCTION is_manager_role(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role_level(user_role) >= 60;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if user is admin (TENANT_ADMIN or higher)
CREATE OR REPLACE FUNCTION is_admin_role(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role_level(user_role) >= 70;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if user is owner (TENANT_OWNER or higher)
CREATE OR REPLACE FUNCTION is_owner_role(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role_level(user_role) >= 80;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if user is platform level
CREATE OR REPLACE FUNCTION is_platform_role(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role_level(user_role) >= 90;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get user's unified role (combines staff_roles and profiles)
CREATE OR REPLACE FUNCTION get_unified_role(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_staff_role TEXT;
  v_profile_role TEXT;
  v_staff_level INTEGER;
  v_profile_level INTEGER;
BEGIN
  -- Get staff role
  SELECT role INTO v_staff_role 
  FROM staff_roles 
  WHERE user_id = p_user_id;
  
  -- Get profile role
  SELECT role INTO v_profile_role 
  FROM profiles 
  WHERE id = p_user_id;
  
  -- Return the higher-level role
  v_staff_level := COALESCE(get_user_role_level(v_staff_role), 0);
  v_profile_level := COALESCE(get_user_role_level(v_profile_role), 0);
  
  IF v_staff_level >= v_profile_level THEN
    RETURN COALESCE(v_staff_role, v_profile_role, 'user');
  ELSE
    RETURN COALESCE(v_profile_role, 'user');
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- STEP 5: Enable RLS and create policies
-- ============================================================================

-- Enable RLS on role_change_logs
ALTER TABLE role_change_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own role change history
CREATE POLICY "Users can view own role changes"
ON role_change_logs FOR SELECT
USING (auth.uid() = target_user_id);

-- Policy: Admins can view all role changes in their tenant
CREATE POLICY "Admins can view tenant role changes"
ON role_change_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_roles sr
    WHERE sr.user_id = auth.uid()
    AND is_admin_role(sr.role)
    AND (sr.tenant_id = role_change_logs.tenant_id OR is_platform_role(sr.role))
  )
);

-- Policy: Admins can insert role change logs
CREATE POLICY "Admins can log role changes"
ON role_change_logs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff_roles sr
    WHERE sr.user_id = auth.uid()
    AND is_admin_role(sr.role)
  )
);

-- Update staff_roles RLS policies
DROP POLICY IF EXISTS "Users can view own staff role" ON staff_roles;
DROP POLICY IF EXISTS "Admins can view all staff roles" ON staff_roles;
DROP POLICY IF EXISTS "Admins can manage staff roles" ON staff_roles;

CREATE POLICY "Users can view own staff role"
ON staff_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all staff roles"
ON staff_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_roles sr
    WHERE sr.user_id = auth.uid()
    AND is_admin_role(sr.role)
  )
);

CREATE POLICY "Admins can manage staff roles"
ON staff_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM staff_roles sr
    WHERE sr.user_id = auth.uid()
    AND is_admin_role(sr.role)
  )
);

-- ============================================================================
-- STEP 6: Create view for user permissions (for easier querying)
-- ============================================================================

CREATE OR REPLACE VIEW v_user_permissions AS
SELECT
  u.id AS user_id,
  u.email,
  p.display_name,
  p.avatar_url,
  sr.role AS staff_role,
  p.role AS profile_role,
  get_unified_role(u.id) AS unified_role,
  get_user_role_level(get_unified_role(u.id)) AS role_level,
  is_platform_role(get_unified_role(u.id)) AS is_platform_level,
  is_owner_role(get_unified_role(u.id)) AS is_owner,
  is_admin_role(get_unified_role(u.id)) AS is_admin,
  is_manager_role(get_unified_role(u.id)) AS is_manager,
  is_staff_role(get_unified_role(u.id)) AS is_staff,
  COALESCE(p.is_organizer, FALSE) OR get_user_role_level(get_unified_role(u.id)) >= 40 AS can_organize,
  sr.tenant_id,
  p.created_at,
  p.updated_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN staff_roles sr ON sr.user_id = u.id;

-- Grant select on view to authenticated users (with RLS on underlying tables)
GRANT SELECT ON v_user_permissions TO authenticated;

-- ============================================================================
-- STEP 7: Migrate existing roles to T-204 format (optional, run manually if needed)
-- ============================================================================

-- Uncomment and run these if you want to migrate existing roles:
-- 
-- UPDATE staff_roles SET role = 'TENANT_OWNER' WHERE role = 'owner';
-- UPDATE staff_roles SET role = 'TENANT_MANAGER' WHERE role = 'manager';
-- UPDATE staff_roles SET role = 'TENANT_STAFF' WHERE role = 'staff';

-- ============================================================================
-- STEP 8: Add triggers for audit logging
-- ============================================================================

-- Trigger function to auto-log role changes
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO role_change_logs (target_user_id, changed_by_user_id, previous_role, new_role, change_type, tenant_id)
    VALUES (NEW.user_id, auth.uid(), NULL, NEW.role, 'grant', NEW.tenant_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO role_change_logs (target_user_id, changed_by_user_id, previous_role, new_role, change_type, tenant_id)
    VALUES (NEW.user_id, auth.uid(), OLD.role, NEW.role, 'modify', NEW.tenant_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO role_change_logs (target_user_id, changed_by_user_id, previous_role, new_role, change_type, tenant_id)
    VALUES (OLD.user_id, auth.uid(), OLD.role, 'user', 'revoke', OLD.tenant_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on staff_roles
DROP TRIGGER IF EXISTS tr_staff_roles_audit ON staff_roles;
CREATE TRIGGER tr_staff_roles_audit
AFTER INSERT OR UPDATE OR DELETE ON staff_roles
FOR EACH ROW EXECUTE FUNCTION log_role_change();

-- ============================================================================
-- STEP 9: Seed default platform owner (run once during setup)
-- ============================================================================

-- This is a placeholder - replace with actual user ID during setup:
-- INSERT INTO staff_roles (user_id, role) 
-- VALUES ('YOUR_USER_ID', 'PLATFORM_OWNER')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'PLATFORM_OWNER';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES (run manually to verify)
-- ============================================================================

-- Check staff_roles structure:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'staff_roles';

-- Check role_change_logs was created:
-- SELECT * FROM role_change_logs LIMIT 5;

-- Check helper functions work:
-- SELECT get_user_role_level('PLATFORM_OWNER'); -- Should return 100
-- SELECT has_minimum_role('TENANT_ADMIN', 'TENANT_STAFF'); -- Should return true
-- SELECT is_staff_role('TENANT_MANAGER'); -- Should return true

-- Check v_user_permissions view:
-- SELECT * FROM v_user_permissions WHERE is_staff = true LIMIT 10;
