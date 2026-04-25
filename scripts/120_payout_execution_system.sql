-- ═══════════════════════════════════════════════════════════════════════════════
-- PAYOUT EXECUTION SYSTEM
-- Complete payout pipeline: creation → eligibility → processing → completion
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- 1. Add status constraint if not exists
-- ─────────────────────────────────────────────────────────────────────────────────

-- First drop existing constraint if any
ALTER TABLE payout_requests DROP CONSTRAINT IF EXISTS payout_requests_status_check;

-- Add proper status flow constraint
ALTER TABLE payout_requests ADD CONSTRAINT payout_requests_status_check 
CHECK (status IN ('pending', 'eligible', 'processing', 'completed', 'failed', 'blocked', 'canceled'));

-- Add columns if not exists
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS stripe_payout_id TEXT;
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS ledger_tx_id UUID;
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ;
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS placement INTEGER;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 2. Create Tournament Payouts (System-triggered)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_tournament_payouts(
  p_tournament_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_tournament RECORD;
  v_standing RECORD;
  v_created_count INTEGER := 0;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service_role can create payouts';
  END IF;

  -- Validate tournament exists and is completed
  SELECT * INTO v_tournament 
  FROM tournaments 
  WHERE id = p_tournament_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tournament.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not yet completed', 'status', v_tournament.status);
  END IF;

  -- Check if payouts already created
  IF EXISTS (SELECT 1 FROM payout_requests WHERE tournament_id = p_tournament_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payouts already created for this tournament');
  END IF;

  -- Create payouts from standings/prize distribution
  FOR v_standing IN
    SELECT 
      ts.user_id,
      ts.placement,
      COALESCE(pd.amount_cents, 0) as prize_cents
    FROM tournament_standings ts
    LEFT JOIN prize_distributions pd 
      ON pd.tournament_id = ts.tournament_id 
      AND pd.placement = ts.placement
    WHERE ts.tournament_id = p_tournament_id
      AND COALESCE(pd.amount_cents, 0) > 0
    ORDER BY ts.placement ASC
  LOOP
    INSERT INTO payout_requests (
      user_id,
      tournament_id,
      amount_cents,
      placement,
      status,
      created_at
    ) VALUES (
      v_standing.user_id,
      p_tournament_id,
      v_standing.prize_cents,
      v_standing.placement,
      'pending',
      NOW()
    );
    
    v_created_count := v_created_count + 1;
  END LOOP;

  -- Log to audit
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    NULL, 
    'tournament_payouts_created', 
    'tournament', 
    p_tournament_id,
    jsonb_build_object('payouts_created', v_created_count, 'tournament_name', v_tournament.name)
  );

  RETURN jsonb_build_object(
    'success', true, 
    'payouts_created', v_created_count,
    'tournament_id', p_tournament_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 3. Mark Payouts Eligible (After Validation)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_payouts_eligible(
  p_tournament_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_eligible_count INTEGER := 0;
  v_blocked_count INTEGER := 0;
  v_payout RECORD;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service_role can mark eligibility';
  END IF;

  FOR v_payout IN
    SELECT pr.*, p.stripe_connect_account_id, p.stripe_connect_payouts_enabled
    FROM payout_requests pr
    JOIN profiles p ON p.id = pr.user_id
    WHERE pr.tournament_id = p_tournament_id
      AND pr.status = 'pending'
    FOR UPDATE OF pr
  LOOP
    -- Check eligibility criteria
    IF v_payout.stripe_connect_account_id IS NULL THEN
      -- Block: No Stripe Connect account
      UPDATE payout_requests 
      SET status = 'blocked', failure_reason = 'No Stripe Connect account configured'
      WHERE id = v_payout.id;
      v_blocked_count := v_blocked_count + 1;
      
    ELSIF v_payout.stripe_connect_payouts_enabled = false THEN
      -- Block: Payouts not enabled
      UPDATE payout_requests 
      SET status = 'blocked', failure_reason = 'Stripe Connect payouts not enabled'
      WHERE id = v_payout.id;
      v_blocked_count := v_blocked_count + 1;
      
    ELSE
      -- Eligible: All checks passed
      UPDATE payout_requests 
      SET status = 'eligible'
      WHERE id = v_payout.id;
      v_eligible_count := v_eligible_count + 1;
    END IF;
  END LOOP;

  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    NULL, 
    'payouts_eligibility_checked', 
    'tournament', 
    p_tournament_id,
    jsonb_build_object('eligible', v_eligible_count, 'blocked', v_blocked_count)
  );

  RETURN jsonb_build_object(
    'success', true,
    'eligible', v_eligible_count,
    'blocked', v_blocked_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 4. Get Eligible Payouts for Processing
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_eligible_payouts(
  p_limit INTEGER DEFAULT 25
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  tournament_id UUID,
  amount_cents BIGINT,
  placement INTEGER,
  stripe_connect_account_id TEXT,
  user_email TEXT,
  tournament_name TEXT,
  failure_count INTEGER
) AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    pr.id,
    pr.user_id,
    pr.tournament_id,
    pr.amount_cents,
    pr.placement,
    p.stripe_connect_account_id,
    p.email as user_email,
    t.name as tournament_name,
    pr.failure_count
  FROM payout_requests pr
  JOIN profiles p ON p.id = pr.user_id
  JOIN tournaments t ON t.id = pr.tournament_id
  WHERE pr.status = 'eligible'
    AND pr.failure_count < 5
    AND p.stripe_connect_account_id IS NOT NULL
    AND p.stripe_connect_payouts_enabled = true
  ORDER BY pr.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 5. Mark Payout Processing (Lock for Worker)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_payout_processing(
  p_payout_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_payout 
  FROM payout_requests 
  WHERE id = p_payout_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not found');
  END IF;

  IF v_payout.status != 'eligible' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not in eligible status', 'current_status', v_payout.status);
  END IF;

  UPDATE payout_requests 
  SET status = 'processing', updated_at = NOW()
  WHERE id = p_payout_id;

  RETURN jsonb_build_object('success', true, 'payout_id', p_payout_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 6. Complete Payout (After Stripe Transfer)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION complete_payout(
  p_payout_id UUID,
  p_stripe_transfer_id TEXT,
  p_ledger_tx_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_payout 
  FROM payout_requests 
  WHERE id = p_payout_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not found');
  END IF;

  IF v_payout.status = 'completed' THEN
    -- Idempotent: already completed
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'payout_id', p_payout_id);
  END IF;

  UPDATE payout_requests 
  SET 
    status = 'completed',
    stripe_transfer_id = p_stripe_transfer_id,
    ledger_tx_id = p_ledger_tx_id,
    processed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_payout_id;

  -- Audit log
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_payout.user_id, 
    'payout_completed', 
    'payout_request', 
    p_payout_id,
    jsonb_build_object(
      'amount_cents', v_payout.amount_cents, 
      'stripe_transfer_id', p_stripe_transfer_id,
      'tournament_id', v_payout.tournament_id
    )
  );

  RETURN jsonb_build_object('success', true, 'payout_id', p_payout_id, 'stripe_transfer_id', p_stripe_transfer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 7. Fail Payout (Retry Tracking)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fail_payout(
  p_payout_id UUID,
  p_reason TEXT,
  p_permanent BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_new_status TEXT;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_payout 
  FROM payout_requests 
  WHERE id = p_payout_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not found');
  END IF;

  -- Determine if we should block permanently or allow retry
  IF p_permanent OR v_payout.failure_count >= 4 THEN
    v_new_status := 'blocked';
  ELSE
    v_new_status := 'eligible'; -- Back to eligible for retry
  END IF;

  UPDATE payout_requests 
  SET 
    status = v_new_status,
    failure_count = failure_count + 1,
    last_failure_at = NOW(),
    failure_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_payout_id;

  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_payout.user_id, 
    'payout_failed', 
    'payout_request', 
    p_payout_id,
    jsonb_build_object(
      'reason', p_reason, 
      'failure_count', v_payout.failure_count + 1,
      'new_status', v_new_status,
      'permanent', p_permanent
    )
  );

  RETURN jsonb_build_object(
    'success', true, 
    'payout_id', p_payout_id, 
    'new_status', v_new_status,
    'failure_count', v_payout.failure_count + 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 8. Handle Transfer Webhook (Stripe Events)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_stripe_transfer_event(
  p_transfer_id TEXT,
  p_event_type TEXT,
  p_failure_code TEXT DEFAULT NULL,
  p_failure_message TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_payout
  FROM payout_requests
  WHERE stripe_transfer_id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No matching payout, might be a transfer we didn't create
    RETURN jsonb_build_object('success', false, 'error', 'No matching payout found', 'skip', true);
  END IF;

  CASE p_event_type
    WHEN 'transfer.paid' THEN
      -- Transfer successful (if not already completed)
      IF v_payout.status != 'completed' THEN
        UPDATE payout_requests 
        SET status = 'completed', processed_at = NOW(), updated_at = NOW()
        WHERE id = v_payout.id;
      END IF;
      
    WHEN 'transfer.failed' THEN
      -- Transfer failed
      PERFORM fail_payout(v_payout.id, COALESCE(p_failure_message, 'Stripe transfer failed'), false);
      
    WHEN 'transfer.reversed' THEN
      -- Transfer reversed - this is serious, needs manual review
      UPDATE payout_requests 
      SET status = 'blocked', failure_reason = 'Transfer was reversed: ' || COALESCE(p_failure_message, 'Unknown reason')
      WHERE id = v_payout.id;
      
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
      VALUES (v_payout.user_id, 'payout_reversed', 'payout_request', v_payout.id,
        jsonb_build_object('transfer_id', p_transfer_id, 'reason', p_failure_message));
      
    ELSE
      -- Unknown event type
      RETURN jsonb_build_object('success', false, 'error', 'Unknown event type', 'event_type', p_event_type);
  END CASE;

  RETURN jsonb_build_object('success', true, 'payout_id', v_payout.id, 'event_type', p_event_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 9. Payout Stats (Monitoring)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_payout_stats()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'eligible', COUNT(*) FILTER (WHERE status = 'eligible'),
    'processing', COUNT(*) FILTER (WHERE status = 'processing'),
    'completed', COUNT(*) FILTER (WHERE status = 'completed'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed'),
    'blocked', COUNT(*) FILTER (WHERE status = 'blocked'),
    'total_pending_cents', COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('pending', 'eligible', 'processing')), 0),
    'total_completed_cents', COALESCE(SUM(amount_cents) FILTER (WHERE status = 'completed'), 0),
    'timestamp', NOW()
  ) INTO v_stats
  FROM payout_requests;

  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 10. Permissions
-- ─────────────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION create_tournament_payouts(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION mark_payouts_eligible(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_eligible_payouts(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION mark_payout_processing(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION complete_payout(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fail_payout(UUID, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION handle_stripe_transfer_event(TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_payout_stats() TO service_role;
