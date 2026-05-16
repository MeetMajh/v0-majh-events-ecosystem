-- Role Requests Table for MAJH Events
-- Users can request a role change from their profile page
-- Admins/owners can approve or deny requests

CREATE TABLE IF NOT EXISTS role_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_role TEXT,
  requested_role TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_role_requests_user_id ON role_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_requests_status ON role_requests(status, created_at DESC);

-- Enable RLS
ALTER TABLE role_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own role requests"
  ON role_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can submit role requests"
  ON role_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins/owners can view all requests
CREATE POLICY "Admins can view all role requests"
  ON role_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Admins/owners can update requests (approve/deny)
CREATE POLICY "Admins can update role requests"
  ON role_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_role_requests_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_role_requests_timestamp_trigger ON role_requests;
CREATE TRIGGER update_role_requests_timestamp_trigger
  BEFORE UPDATE ON role_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_role_requests_timestamp();
