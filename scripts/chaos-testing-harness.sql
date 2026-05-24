-- =============================================================================
-- CHAOS TESTING HARNESS
-- Automated integrity verification system for financial operations
-- =============================================================================

-- ============================================
-- CHAOS TEST RUNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chaos_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed', 'error')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  results JSONB,
  triggered_by UUID,
  environment TEXT DEFAULT 'test',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_chaos_test_runs_status ON chaos_test_runs(status);
CREATE INDEX IF NOT EXISTS idx_chaos_test_runs_created ON chaos_test_runs(started_at DESC);

ALTER TABLE chaos_test_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read chaos_test_runs" ON chaos_test_runs;
CREATE POLICY "Allow authenticated read chaos_test_runs" ON chaos_test_runs
  FOR SELECT TO authenticated USING (true);


-- ============================================
-- ADD CHAOS MODE TO SYSTEM CONTROLS
-- ============================================
INSERT INTO system_controls (control_type, is_enabled, threshold_value)
VALUES ('chaos_mode_enabled', false, NULL)
ON CONFLICT (control_type) DO NOTHING;


-- ============================================
-- TEST 1: WALLET CORRUPTION DETECTION
-- Injects balance corruption and verifies reconciliation detects it
-- ============================================
DROP FUNCTION IF EXISTS chaos_test_wallet_corruption(UUID);

CREATE OR REPLACE FUNCTION chaos_test_wallet_corruption(p_admin_id UUID)
RETURNS JSON AS $$
DECLARE
  v_test_wallet RECORD;
  v_original_balance INT;
  v_corruption_amount INT := 5000; -- $50 corruption
  v_recon_result JSON;
  v_detected BOOLEAN;
  v_test_passed BOOLEAN;
BEGIN
  -- Find a wallet to test with
  SELECT user_id, balance_cents INTO v_test_wallet
  FROM wallets
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'test', 'wallet_corruption',
      'passed', false,
      'reason', 'No wallets found to test'
    );
  END IF;

  -- Store original balance
  v_original_balance := v_test_wallet.balance_cents;

  -- Inject corruption
  UPDATE wallets
  SET balance_cents = balance_cents + v_corruption_amount
  WHERE user_id = v_test_wallet.user_id;

  -- Run reconciliation
  v_recon_result := run_daily_reconciliation();

  -- Check if mismatch was detected
  v_detected := (v_recon_result->>'mismatches_found')::int > 0;

  -- Restore original state IMMEDIATELY
  UPDATE wallets
  SET balance_cents = v_original_balance
  WHERE user_id = v_test_wallet.user_id;

  -- Test passes if corruption was detected
  v_test_passed := v_detected;

  RETURN json_build_object(
    'test', 'wallet_corruption',
    'passed', v_test_passed,
    'detected', v_detected,
    'corruption_amount', v_corruption_amount,
    'user_id', v_test_wallet.user_id,
    'reconciliation_result', v_recon_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- TEST 2: LOCKDOWN ENFORCEMENT
-- Triggers lockdown and verifies operations are blocked
-- ============================================
DROP FUNCTION IF EXISTS chaos_test_lockdown_enforcement(UUID);

CREATE OR REPLACE FUNCTION chaos_test_lockdown_enforcement(p_admin_id UUID)
RETURNS JSON AS $$
DECLARE
  v_test_user_id UUID;
  v_check_result JSON;
  v_operations_blocked BOOLEAN;
  v_test_passed BOOLEAN;
  v_original_states JSONB;
BEGIN
  -- Store original control states
  SELECT jsonb_object_agg(control_type, is_enabled) INTO v_original_states
  FROM system_controls
  WHERE control_type IN ('withdrawals_enabled', 'deposits_enabled', 'payouts_enabled', 'escrow_enabled');

  -- Get a test user
  SELECT user_id INTO v_test_user_id FROM wallets LIMIT 1;

  IF v_test_user_id IS NULL THEN
    RETURN json_build_object(
      'test', 'lockdown_enforcement',
      'passed', false,
      'reason', 'No users found to test'
    );
  END IF;

  -- Trigger lockdown
  PERFORM trigger_emergency_lockdown(p_admin_id, 'Chaos test - lockdown enforcement verification');

  -- Try withdrawal - should be blocked
  v_check_result := check_withdrawal_allowed(v_test_user_id, 1000);
  v_operations_blocked := (v_check_result->>'allowed')::boolean = false;

  -- Lift lockdown and restore
  PERFORM lift_emergency_lockdown(p_admin_id, 'Chaos test complete - restoring operations');

  -- Restore original states if they were different
  -- (lift_emergency_lockdown already re-enables everything)

  v_test_passed := v_operations_blocked;

  RETURN json_build_object(
    'test', 'lockdown_enforcement',
    'passed', v_test_passed,
    'operations_blocked', v_operations_blocked,
    'check_result', v_check_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- TEST 3: RISK FLAG DETECTION
-- Injects suspicious activity and verifies risk engine flags it
-- ============================================
DROP FUNCTION IF EXISTS chaos_test_risk_detection(UUID);

CREATE OR REPLACE FUNCTION chaos_test_risk_detection(p_admin_id UUID)
RETURNS JSON AS $$
DECLARE
  v_test_user_id UUID;
  v_injected_ids UUID[];
  v_risk_result JSON;
  v_flags_detected BOOLEAN;
  v_test_passed BOOLEAN;
BEGIN
  -- Use admin as test user
  v_test_user_id := p_admin_id;

  -- Inject rapid withdrawals (suspicious pattern)
  INSERT INTO financial_transactions (user_id, type, amount_cents, status, created_at)
  VALUES
    (v_test_user_id, 'withdrawal', -25000, 'completed', NOW()),
    (v_test_user_id, 'withdrawal', -25000, 'completed', NOW()),
    (v_test_user_id, 'withdrawal', -25000, 'completed', NOW()),
    (v_test_user_id, 'withdrawal', -25000, 'completed', NOW()),
    (v_test_user_id, 'withdrawal', -25000, 'completed', NOW())
  RETURNING id INTO v_injected_ids;

  -- Check risk flags
  v_risk_result := check_risk_flags(v_test_user_id);

  -- Clean up injected test data
  DELETE FROM financial_transactions
  WHERE user_id = v_test_user_id
    AND type = 'withdrawal'
    AND amount_cents = -25000
    AND created_at > NOW() - INTERVAL '1 minute';

  -- Check if flags were detected
  v_flags_detected := (v_risk_result->>'flagged_users')::int > 0;
  v_test_passed := v_flags_detected;

  RETURN json_build_object(
    'test', 'risk_detection',
    'passed', v_test_passed,
    'flags_detected', v_flags_detected,
    'risk_result', v_risk_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- TEST 4: ALERT PIPELINE
-- Logs an alert and verifies it reaches the audit log
-- ============================================
DROP FUNCTION IF EXISTS chaos_test_alert_pipeline(UUID);

CREATE OR REPLACE FUNCTION chaos_test_alert_pipeline(p_admin_id UUID)
RETURNS JSON AS $$
DECLARE
  v_alert_result JSON;
  v_alert_id UUID;
  v_audit_exists BOOLEAN;
  v_test_passed BOOLEAN;
BEGIN
  -- Log a test alert
  v_alert_result := log_system_alert(
    'integrity_failure',
    'critical',
    'chaos_test',
    'Chaos test - alert pipeline verification',
    jsonb_build_object('test', true, 'timestamp', NOW()),
    p_admin_id
  );

  v_alert_id := (v_alert_result->>'alert_id')::uuid;

  -- Check if it reached audit log
  SELECT EXISTS(
    SELECT 1 FROM reconciliation_audit_log
    WHERE target_id = v_alert_id::TEXT
      AND action_type = 'system_alert'
  ) INTO v_audit_exists;

  -- Clean up test alert
  DELETE FROM system_alerts WHERE id = v_alert_id;
  DELETE FROM reconciliation_audit_log WHERE target_id = v_alert_id::TEXT;

  v_test_passed := v_audit_exists;

  RETURN json_build_object(
    'test', 'alert_pipeline',
    'passed', v_test_passed,
    'alert_logged', v_alert_result->>'success' = 'true',
    'audit_logged', v_audit_exists,
    'alert_id', v_alert_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- TEST 5: IDEMPOTENCY CHECK
-- Verifies duplicate operations are rejected
-- ============================================
DROP FUNCTION IF EXISTS chaos_test_idempotency(UUID);

CREATE OR REPLACE FUNCTION chaos_test_idempotency(p_admin_id UUID)
RETURNS JSON AS $$
DECLARE
  v_test_passed BOOLEAN := true;
  v_idempotency_key TEXT;
  v_first_insert BOOLEAN;
  v_second_insert BOOLEAN;
BEGIN
  v_idempotency_key := 'chaos_test_' || gen_random_uuid()::text;

  -- First insert with idempotency key
  BEGIN
    INSERT INTO reconciliation_audit_log (
      action_type, target_type, target_id, performed_by,
      reason, status, idempotency_key
    ) VALUES (
      'chaos_test', 'test', 'idempotency_check', p_admin_id,
      'First insert', 'completed', v_idempotency_key
    );
    v_first_insert := true;
  EXCEPTION WHEN OTHERS THEN
    v_first_insert := false;
  END;

  -- Second insert with same idempotency key (should fail or be ignored)
  BEGIN
    INSERT INTO reconciliation_audit_log (
      action_type, target_type, target_id, performed_by,
      reason, status, idempotency_key
    ) VALUES (
      'chaos_test', 'test', 'idempotency_check', p_admin_id,
      'Duplicate insert', 'completed', v_idempotency_key
    );
    v_second_insert := true;
  EXCEPTION WHEN unique_violation THEN
    v_second_insert := false;
  EXCEPTION WHEN OTHERS THEN
    v_second_insert := true; -- Unexpected - test fails
  END;

  -- Clean up
  DELETE FROM reconciliation_audit_log WHERE idempotency_key = v_idempotency_key;

  -- Test passes if first succeeded and second was rejected
  v_test_passed := v_first_insert AND NOT v_second_insert;

  RETURN json_build_object(
    'test', 'idempotency',
    'passed', v_test_passed,
    'first_insert_succeeded', v_first_insert,
    'duplicate_rejected', NOT v_second_insert,
    'note', CASE 
      WHEN NOT v_first_insert THEN 'First insert failed'
      WHEN v_second_insert THEN 'Duplicate was NOT rejected - idempotency missing'
      ELSE 'Idempotency working correctly'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- TEST 6: WALLET FREEZE ENFORCEMENT
-- Verifies frozen wallets cannot perform withdrawals
-- ============================================
DROP FUNCTION IF EXISTS chaos_test_wallet_freeze(UUID);

CREATE OR REPLACE FUNCTION chaos_test_wallet_freeze(p_admin_id UUID)
RETURNS JSON AS $$
DECLARE
  v_test_wallet RECORD;
  v_check_before JSON;
  v_check_after JSON;
  v_blocked_when_frozen BOOLEAN;
  v_allowed_when_unfrozen BOOLEAN;
  v_test_passed BOOLEAN;
BEGIN
  -- Find a wallet
  SELECT user_id, is_frozen INTO v_test_wallet
  FROM wallets
  WHERE is_frozen = false OR is_frozen IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'test', 'wallet_freeze',
      'passed', false,
      'reason', 'No unfrozen wallets found to test'
    );
  END IF;

  -- Check withdrawal allowed before freeze
  v_check_before := check_withdrawal_allowed(v_test_wallet.user_id, 1000);

  -- Freeze the wallet
  PERFORM freeze_user_wallet(v_test_wallet.user_id, p_admin_id, 'Chaos test - freeze enforcement');

  -- Check withdrawal blocked after freeze
  v_check_after := check_withdrawal_allowed(v_test_wallet.user_id, 1000);

  -- Unfreeze
  PERFORM unfreeze_user_wallet(v_test_wallet.user_id, p_admin_id);

  v_blocked_when_frozen := (v_check_after->>'allowed')::boolean = false;
  v_allowed_when_unfrozen := (v_check_before->>'allowed')::boolean = true;

  v_test_passed := v_blocked_when_frozen;

  RETURN json_build_object(
    'test', 'wallet_freeze',
    'passed', v_test_passed,
    'allowed_before_freeze', v_check_before->>'allowed',
    'blocked_after_freeze', v_blocked_when_frozen,
    'user_id', v_test_wallet.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- MASTER CHAOS ORCHESTRATOR
-- Runs all tests sequentially and reports results
-- ============================================
DROP FUNCTION IF EXISTS run_chaos_suite(UUID);

CREATE OR REPLACE FUNCTION run_chaos_suite(p_admin_id UUID)
RETURNS JSON AS $$
DECLARE
  v_run_id UUID;
  v_results JSONB := '[]'::jsonb;
  v_test JSON;
  v_all_passed BOOLEAN := true;
  v_test_count INT := 0;
  v_pass_count INT := 0;
BEGIN
  -- Check if chaos mode is enabled
  IF NOT EXISTS (
    SELECT 1 FROM system_controls 
    WHERE control_type = 'chaos_mode_enabled' AND is_enabled = true
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Chaos mode is not enabled. Enable it in System Controls first.'
    );
  END IF;

  -- Create run record
  INSERT INTO chaos_test_runs (test_type, status, triggered_by, environment)
  VALUES ('full_suite', 'running', p_admin_id, 'test')
  RETURNING id INTO v_run_id;

  -- TEST 1: Wallet Corruption
  BEGIN
    v_test := chaos_test_wallet_corruption(p_admin_id);
    v_results := v_results || jsonb_build_array(v_test);
    v_test_count := v_test_count + 1;
    IF (v_test->>'passed')::boolean THEN v_pass_count := v_pass_count + 1; END IF;
    v_all_passed := v_all_passed AND (v_test->>'passed')::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(json_build_object('test', 'wallet_corruption', 'passed', false, 'error', SQLERRM));
    v_all_passed := false;
    v_test_count := v_test_count + 1;
  END;

  -- TEST 2: Lockdown Enforcement
  BEGIN
    v_test := chaos_test_lockdown_enforcement(p_admin_id);
    v_results := v_results || jsonb_build_array(v_test);
    v_test_count := v_test_count + 1;
    IF (v_test->>'passed')::boolean THEN v_pass_count := v_pass_count + 1; END IF;
    v_all_passed := v_all_passed AND (v_test->>'passed')::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(json_build_object('test', 'lockdown_enforcement', 'passed', false, 'error', SQLERRM));
    v_all_passed := false;
    v_test_count := v_test_count + 1;
  END;

  -- TEST 3: Risk Detection
  BEGIN
    v_test := chaos_test_risk_detection(p_admin_id);
    v_results := v_results || jsonb_build_array(v_test);
    v_test_count := v_test_count + 1;
    IF (v_test->>'passed')::boolean THEN v_pass_count := v_pass_count + 1; END IF;
    v_all_passed := v_all_passed AND (v_test->>'passed')::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(json_build_object('test', 'risk_detection', 'passed', false, 'error', SQLERRM));
    v_all_passed := false;
    v_test_count := v_test_count + 1;
  END;

  -- TEST 4: Alert Pipeline
  BEGIN
    v_test := chaos_test_alert_pipeline(p_admin_id);
    v_results := v_results || jsonb_build_array(v_test);
    v_test_count := v_test_count + 1;
    IF (v_test->>'passed')::boolean THEN v_pass_count := v_pass_count + 1; END IF;
    v_all_passed := v_all_passed AND (v_test->>'passed')::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(json_build_object('test', 'alert_pipeline', 'passed', false, 'error', SQLERRM));
    v_all_passed := false;
    v_test_count := v_test_count + 1;
  END;

  -- TEST 5: Idempotency
  BEGIN
    v_test := chaos_test_idempotency(p_admin_id);
    v_results := v_results || jsonb_build_array(v_test);
    v_test_count := v_test_count + 1;
    IF (v_test->>'passed')::boolean THEN v_pass_count := v_pass_count + 1; END IF;
    v_all_passed := v_all_passed AND (v_test->>'passed')::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(json_build_object('test', 'idempotency', 'passed', false, 'error', SQLERRM));
    v_all_passed := false;
    v_test_count := v_test_count + 1;
  END;

  -- TEST 6: Wallet Freeze
  BEGIN
    v_test := chaos_test_wallet_freeze(p_admin_id);
    v_results := v_results || jsonb_build_array(v_test);
    v_test_count := v_test_count + 1;
    IF (v_test->>'passed')::boolean THEN v_pass_count := v_pass_count + 1; END IF;
    v_all_passed := v_all_passed AND (v_test->>'passed')::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(json_build_object('test', 'wallet_freeze', 'passed', false, 'error', SQLERRM));
    v_all_passed := false;
    v_test_count := v_test_count + 1;
  END;

  -- Update run record
  UPDATE chaos_test_runs
  SET 
    status = CASE WHEN v_all_passed THEN 'passed' ELSE 'failed' END,
    completed_at = NOW(),
    results = v_results
  WHERE id = v_run_id;

  -- Log to system alerts
  INSERT INTO system_alerts (
    alert_type, severity, source, message, details
  ) VALUES (
    'manual_alert',
    CASE WHEN v_all_passed THEN 'info' ELSE 'warning' END,
    'chaos_test_suite',
    format('Chaos test suite completed: %s/%s tests passed', v_pass_count, v_test_count),
    jsonb_build_object('run_id', v_run_id, 'results', v_results)
  );

  RETURN json_build_object(
    'success', true,
    'run_id', v_run_id,
    'all_passed', v_all_passed,
    'tests_run', v_test_count,
    'tests_passed', v_pass_count,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- GET CHAOS TEST HISTORY
-- ============================================
DROP FUNCTION IF EXISTS get_chaos_test_history(INT);

CREATE OR REPLACE FUNCTION get_chaos_test_history(p_limit INT DEFAULT 10)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(r))
    FROM (
      SELECT 
        id,
        test_type,
        status,
        started_at,
        completed_at,
        results,
        triggered_by
      FROM chaos_test_runs
      ORDER BY started_at DESC
      LIMIT p_limit
    ) r
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION chaos_test_wallet_corruption(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION chaos_test_lockdown_enforcement(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION chaos_test_risk_detection(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION chaos_test_alert_pipeline(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION chaos_test_idempotency(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION chaos_test_wallet_freeze(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION run_chaos_suite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_chaos_test_history(INT) TO authenticated;
GRANT SELECT ON chaos_test_runs TO authenticated;
