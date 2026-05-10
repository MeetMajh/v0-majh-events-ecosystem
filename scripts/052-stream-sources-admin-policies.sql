-- Add admin-only RLS policies for stream sources management
-- This ensures only admins can modify stream source visibility

-- First, check if profiles table has role column (if not, create simple bypass for now)
-- For now, we'll create a policy that checks if user has ANY admin role

-- Drop existing unsafe update policies
DROP POLICY IF EXISTS "Users can update own sources" ON stream_sources;
DROP POLICY IF EXISTS "Anyone can update stream sources" ON stream_sources;

-- Add admin-only update policy
-- Note: This assumes your profiles table has a role column. Adjust if using different role system.
CREATE POLICY "Only admins can update stream sources" ON stream_sources
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' OR role = 'staff'
    )
  );

-- Add admin-only insert policy
CREATE POLICY "Only admins can insert stream sources" ON stream_sources
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' OR role = 'staff'
    )
  );

-- Public can still read stream sources
CREATE POLICY IF NOT EXISTS "Anyone can view stream sources" ON stream_sources
  FOR SELECT USING (true);
