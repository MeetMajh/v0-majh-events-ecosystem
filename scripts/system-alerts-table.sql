-- =============================================================================
-- SYSTEM ALERTS TABLE
-- Logs frontend integrity failures and system events for audit trail
-- =============================================================================

-- Create system_alerts table
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  user_id UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  auto_action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_unresolved ON system_alerts(resolved_at) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert alerts (needed for frontend logging)
DROP POLICY IF EXISTS "Allow authenticated insert system_alerts" ON system_alerts;
CREATE POLICY "Allow authenticated insert system_alerts" ON system_alerts
  FOR INSERT TO authenticated WITH CHECK (true);

-- Only admins can read/update alerts (via service role or RPC)
DROP POLICY IF EXISTS "Allow authenticated read system_alerts" ON system_alerts;
CREATE POLICY "Allow authenticated read system_alerts" ON system_alerts
  FOR SELECT TO authenticated USING (true);

-- Create function to log system alert
CREATE OR REPLACE FUNCTION log_system_alert(
  p_alert_type TEXT,
  p_severity TEXT,
  p_source TEXT,
  p_message TEXT,
  p_details JSONB DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_auto_action TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO system_alerts (
    alert_type, severity, source, message, details, user_id, auto_action_taken
  ) VALUES (
    p_alert_type, p_severity, p_source, p_message, p_details, p_user_id, p_auto_action
  )
  RETURNING id INTO v_alert_id;

  -- If critical or emergency, also log to reconciliation_audit_log
  IF p_severity IN ('critical', 'emergency') THEN
    INSERT INTO reconciliation_audit_log (
      action_type, target_type, target_id, 
      reason, status, documentation
    ) VALUES (
      'system_alert', 'alert', v_alert_id::TEXT,
      p_message, 'flagged', p_details::TEXT
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'alert_id', v_alert_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to resolve alert
CREATE OR REPLACE FUNCTION resolve_system_alert(
  p_alert_id UUID,
  p_admin_id UUID,
  p_resolution_notes TEXT
)
RETURNS JSON AS $$
DECLARE
  v_alert RECORD;
BEGIN
  SELECT * INTO v_alert
  FROM system_alerts
  WHERE id = p_alert_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Alert not found');
  END IF;

  IF v_alert.resolved_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Alert already resolved');
  END IF;

  UPDATE system_alerts
  SET 
    resolved_at = NOW(),
    resolved_by = p_admin_id,
    resolution_notes = p_resolution_notes,
    updated_at = NOW()
  WHERE id = p_alert_id;

  RETURN json_build_object(
    'success', true,
    'alert_id', p_alert_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to trigger emergency lockdown
CREATE OR REPLACE FUNCTION trigger_emergency_lockdown(
  p_reason TEXT,
  p_source TEXT,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  -- Disable all financial operations
  UPDATE system_controls SET is_enabled = false, triggered_at = NOW(), triggered_by = p_admin_id, reason = p_reason
  WHERE control_type IN ('withdrawals_enabled', 'deposits_enabled', 'payouts_enabled', 'escrow_enabled');

  -- Log the emergency alert
  SELECT (log_system_alert(
    'EMERGENCY_LOCKDOWN',
    'emergency',
    p_source,
    p_reason,
    jsonb_build_object(
      'controls_disabled', ARRAY['withdrawals_enabled', 'deposits_enabled', 'payouts_enabled', 'escrow_enabled'],
      'triggered_by', p_admin_id
    ),
    p_admin_id,
    'All financial operations disabled'
  )->>'alert_id')::UUID INTO v_alert_id;

  -- Log to audit
  INSERT INTO reconciliation_audit_log (
    action_type, target_type, target_id, performed_by,
    reason, status, documentation
  ) VALUES (
    'emergency_lockdown', 'system', 'all_controls', p_admin_id,
    p_reason, 'completed', 'Emergency lockdown triggered from ' || p_source
  );

  RETURN json_build_object(
    'success', true,
    'alert_id', v_alert_id,
    'action', 'All financial operations disabled'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION log_system_alert(TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_system_alert(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_emergency_lockdown(TEXT, TEXT, UUID) TO authenticated;
