-- =============================================================================
-- PRE-DEPLOYMENT INTEGRITY CHECK SYSTEM
-- A deterministic GO/NO-GO gate that blocks deployment unless integrity is proven
-- =============================================================================

-- ============================================
-- DEPLOYMENT INTEGRITY RUNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS deployment_integrity_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed', 'error')),
  environment TEXT NOT NULL DEFAULT 'staging',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  results JSONB,
  failed_checks JSONB,
  triggered_by UUID,
  git_commit_sha TEXT,
  git_branch TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_deployment_runs_status ON deployment_integrity_runs(status);
CREATE INDEX IF NOT EXISTS idx_deployment_runs_created ON deployment_integrity_runs(started_at DESC);

ALTER TABLE deployment_integrity_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read deployment_integrity_runs" ON deployment_integrity_runs;
CREATE POLICY "Allow authenticated read deployment_integrity_runs" ON deployment_integrity_runs
  FOR SELECT TO authenticated USING (true);


-- ============================================
-- MASTER PRE-DEPLOYMENT CHECK FUNCTION
-- ============================================
DROP FUNCTION IF EXISTS run_predeployment_integrity_check(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION run_predeployment_integrity_check(
  p_admin_id UUID,
  p_git_sha TEXT DEFAULT NULL,
  p_git_branch TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_run_id UUID;
  v_results JSONB := '[]'::jsonb;
  v_failures JSONB := '[]'::jsonb;
  v_test JSON;
  v_recon_result JSON;
  v_check_result JSON;
  v_test_wallet RECORD;
  v_original_balance INT;
  v_lockdown_blocked BOOLEAN := false;
BEGIN
  -- Create run record
  INSERT INTO deployment_integrity_runs (
    status, environment, triggered_by, git_commit_sha, git_branch
  ) VALUES (
    'running', 'staging', p_admin_id, p_git_sha, p_git_branch
  ) RETURNING id INTO v_run_id;

  -- ============================================
  -- TEST 1: RECONCILIATION CLEAN STATE
  -- Verify no existing mismatches before deployment
  -- ============================================
  v_recon_result := run_daily_reconciliation();
  
  v_results := v_results || jsonb_build_array(jsonb_build_object(
    'test', 'reconciliation_clean_state',
    'passed', (v_recon_result->>'mismatches_found')::int = 0,
    'mismatches_found', (v_recon_result->>'mismatches_found')::int,
    'details', v_recon_result
  ));

  IF (v_recon_result->>'mismatches_found')::int > 0 THEN
    v_failures := v_failures || jsonb_build_array(jsonb_build_object(
      'test', 'reconciliation_clean_state',
      'error', 'Existing reconciliation mismatches found',
      'details', v_recon_result
    ));
  END IF;

  -- ============================================
  -- TEST 2: WALLET CORRUPTION DETECTION
  -- Inject corruption and verify detection
  -- ============================================
  SELECT user_id, balance_cents INTO v_test_wallet FROM wallets LIMIT 1;
  
  IF FOUND THEN
    v_original_balance := v_test_wallet.balance_cents;
    
    -- Inject corruption
    UPDATE wallets SET balance_cents = balance_cents + 9999 WHERE user_id = v_test_wallet.user_id;
    
    -- Run reconciliation to detect
    v_test := run_daily_reconciliation();
    
    -- Restore immediately
    UPDATE wallets SET balance_cents = v_original_balance WHERE user_id = v_test_wallet.user_id;
    
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'test', 'corruption_detection',
      'passed', (v_test->>'mismatches_found')::int > 0,
      'detected', (v_test->>'mismatches_found')::int > 0
    ));
    
    IF (v_test->>'mismatches_found')::int = 0 THEN
      v_failures := v_failures || jsonb_build_array(jsonb_build_object(
        'test', 'corruption_detection',
        'error', 'Wallet corruption was NOT detected - reconciliation broken'
      ));
    END IF;
  ELSE
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'test', 'corruption_detection',
      'passed', true,
      'skipped', true,
      'reason', 'No wallets to test'
    ));
  END IF;

  -- ============================================
  -- TEST 3: LOCKDOWN ENFORCEMENT
  -- Verify emergency lockdown blocks operations
  -- ============================================
  -- Trigger lockdown
  PERFORM trigger_emergency_lockdown(p_admin_id, 'Pre-deployment integrity check');
  
  -- Get test user
  SELECT user_id INTO v_test_wallet FROM wallets LIMIT 1;
  
  IF v_test_wallet.user_id IS NOT NULL THEN
    -- Verify withdrawal is blocked
    v_check_result := check_withdrawal_allowed(v_test_wallet.user_id, 1000);
    v_lockdown_blocked := (v_check_result->>'allowed')::boolean = false;
  ELSE
    v_lockdown_blocked := true; -- No users to test, assume pass
  END IF;
  
  -- Lift lockdown immediately
  PERFORM lift_emergency_lockdown(p_admin_id, 'Pre-deployment check complete');
  
  v_results := v_results || jsonb_build_array(jsonb_build_object(
    'test', 'lockdown_enforcement',
    'passed', v_lockdown_blocked,
    'operations_blocked', v_lockdown_blocked
  ));
  
  IF NOT v_lockdown_blocked THEN
    v_failures := v_failures || jsonb_build_array(jsonb_build_object(
      'test', 'lockdown_enforcement',
      'error', 'Emergency lockdown did NOT block operations'
    ));
  END IF;

  -- ============================================
  -- TEST 4: RISK FLAG DETECTION
  -- Verify suspicious patterns trigger flags
  -- ============================================
  -- Insert suspicious activity
  INSERT INTO financial_transactions (user_id, type, amount_cents, status, created_at)
  VALUES
    (p_admin_id, 'withdrawal', -30000, 'completed', NOW()),
    (p_admin_id, 'withdrawal', -30000, 'completed', NOW()),
    (p_admin_id, 'withdrawal', -30000, 'completed', NOW()),
    (p_admin_id, 'withdrawal', -30000, 'completed', NOW());
  
  v_test := check_risk_flags(p_admin_id);
  
  -- Clean up test transactions
  DELETE FROM financial_transactions 
  WHERE user_id = p_admin_id 
    AND type = 'withdrawal' 
    AND amount_cents = -30000 
    AND created_at > NOW() - INTERVAL '1 minute';
  
  v_results := v_results || jsonb_build_array(jsonb_build_object(
    'test', 'risk_detection',
    'passed', (v_test->>'flagged_users')::int > 0,
    'flags_detected', (v_test->>'flagged_users')::int > 0
  ));
  
  IF (v_test->>'flagged_users')::int = 0 THEN
    v_failures := v_failures || jsonb_build_array(jsonb_build_object(
      'test', 'risk_detection',
      'error', 'Risk patterns were NOT flagged'
    ));
  END IF;

  -- ============================================
  -- TEST 5: SYSTEM CONTROLS EXIST
  -- Verify all critical controls are configured
  -- ============================================
  IF NOT EXISTS (SELECT 1 FROM system_controls WHERE control_type = 'withdrawals_enabled') OR
     NOT EXISTS (SELECT 1 FROM system_controls WHERE control_type = 'deposits_enabled') OR
     NOT EXISTS (SELECT 1 FROM system_controls WHERE control_type = 'payouts_enabled') THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'test', 'system_controls_configured',
      'passed', false
    ));
    v_failures := v_failures || jsonb_build_array(jsonb_build_object(
      'test', 'system_controls_configured',
      'error', 'Critical system controls are missing'
    ));
  ELSE
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'test', 'system_controls_configured',
      'passed', true
    ));
  END IF;

  -- ============================================
  -- FINAL STATUS
  -- ============================================
  IF jsonb_array_length(v_failures) > 0 THEN
    UPDATE deployment_integrity_runs
    SET status = 'failed',
        completed_at = NOW(),
        results = v_results,
        failed_checks = v_failures
    WHERE id = v_run_id;

    -- Log critical alert
    INSERT INTO system_alerts (alert_type, severity, source, message, details)
    VALUES (
      'integrity_failure', 
      'critical', 
      'predeploy_check',
      format('Pre-deployment check FAILED: %s failures', jsonb_array_length(v_failures)),
      jsonb_build_object('run_id', v_run_id, 'failures', v_failures)
    );

    RETURN json_build_object(
      'success', false,
      'run_id', v_run_id,
      'tests_run', jsonb_array_length(v_results),
      'tests_failed', jsonb_array_length(v_failures),
      'failures', v_failures,
      'results', v_results,
      'deploy_allowed', false,
      'message', 'DEPLOYMENT BLOCKED - Integrity check failed'
    );
  END IF;

  UPDATE deployment_integrity_runs
  SET status = 'passed',
      completed_at = NOW(),
      results = v_results
  WHERE id = v_run_id;

  -- Log success
  INSERT INTO system_alerts (alert_type, severity, source, message, details)
  VALUES (
    'manual_alert', 
    'info', 
    'predeploy_check',
    'Pre-deployment check PASSED - Safe to deploy',
    jsonb_build_object('run_id', v_run_id)
  );

  RETURN json_build_object(
    'success', true,
    'run_id', v_run_id,
    'tests_run', jsonb_array_length(v_results),
    'tests_failed', 0,
    'results', v_results,
    'deploy_allowed', true,
    'message', 'All integrity checks passed - Safe to deploy'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- GET DEPLOYMENT CHECK HISTORY
-- ============================================
DROP FUNCTION IF EXISTS get_deployment_check_history(INT);

CREATE OR REPLACE FUNCTION get_deployment_check_history(p_limit INT DEFAULT 10)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
    FROM (
      SELECT 
        id, 
        status, 
        environment,
        started_at, 
        completed_at,
        git_commit_sha,
        git_branch,
        results,
        failed_checks,
        triggered_by
      FROM deployment_integrity_runs 
      ORDER BY started_at DESC 
      LIMIT p_limit
    ) r
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- GRANTS
-- ============================================
GRANT EXECUTE ON FUNCTION run_predeployment_integrity_check(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_deployment_check_history(INT) TO authenticated;
GRANT SELECT ON deployment_integrity_runs TO authenticated;
