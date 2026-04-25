-- ═══════════════════════════════════════════════════════════════════════════════
-- RECONCILIATION WORKER SETUP
-- Self-healing payment system - recovers missed webhooks and delayed Stripe events
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Get Stale Intents for Reconciliation
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_stale_financial_intents()
RETURNS SETOF financial_intents AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM financial_intents
  WHERE status IN ('pending', 'processing', 'requires_action')
    AND reconciled = FALSE
    AND created_at < NOW() - INTERVAL '5 minutes'
    AND failure_count < 5
    AND (stripe_checkout_session_id IS NOT NULL OR stripe_payment_intent_id IS NOT NULL)
  ORDER BY created_at ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_stale_financial_intents() TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Fix update_intent_with_stripe to explicitly allow service_role
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_intent_with_stripe(
  p_intent_id UUID,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_stripe_checkout_session_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'processing'
) RETURNS JSONB AS $$
DECLARE 
  v_intent RECORD;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  
  -- Fetch intent with lock
  SELECT * INTO v_intent FROM financial_intents WHERE id = p_intent_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Intent not found');
  END IF;
  
  -- Auth check: authenticated users can only update their own intents
  IF v_caller_role = 'authenticated' AND v_intent.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update another user''s intent';
  END IF;
  
  -- Explicitly allow only authenticated and service_role
  IF v_caller_role NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized: Invalid role';
  END IF;
  
  -- Update the intent
  UPDATE financial_intents
  SET stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
      stripe_checkout_session_id = COALESCE(p_stripe_checkout_session_id, stripe_checkout_session_id),
      status = p_status,
      updated_at = NOW()
  WHERE id = p_intent_id
  RETURNING * INTO v_intent;
  
  -- Audit log
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_intent.user_id,
    'financial_intent_stripe_linked',
    'financial_intent',
    v_intent.id,
    jsonb_build_object(
      'stripe_session_id', p_stripe_checkout_session_id,
      'stripe_payment_intent_id', p_stripe_payment_intent_id,
      'new_status', p_status,
      'caller_role', v_caller_role
    )
  );
  
  RETURN jsonb_build_object('success', true, 'intent_id', v_intent.id, 'status', v_intent.status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Verify and Fix Permissions (re-apply to be safe)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Revoke from public/authenticated first
REVOKE ALL ON FUNCTION reconcile_financial_intent(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION reconcile_financial_intent(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM authenticated;

-- Grant only to service_role
GRANT EXECUTE ON FUNCTION reconcile_financial_intent(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Mark Intent as Failed with Retry Tracking
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION mark_intent_failed(
  p_intent_id UUID,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE 
  v_intent RECORD;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service_role can mark failures';
  END IF;
  
  UPDATE financial_intents
  SET status = 'failed',
      error_code = p_error_code,
      error_message = p_error_message,
      failure_count = failure_count + 1,
      last_failure_at = NOW(),
      updated_at = NOW()
  WHERE id = p_intent_id
  RETURNING * INTO v_intent;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Intent not found');
  END IF;
  
  -- Audit log
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_intent.user_id,
    'financial_intent_failed',
    'financial_intent',
    v_intent.id,
    jsonb_build_object(
      'error_code', p_error_code,
      'error_message', p_error_message,
      'failure_count', v_intent.failure_count
    )
  );
  
  RETURN jsonb_build_object('success', true, 'intent_id', v_intent.id, 'failure_count', v_intent.failure_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_intent_failed(UUID, TEXT, TEXT) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Get Reconciliation Stats (for monitoring)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_reconciliation_stats()
RETURNS JSONB AS $$
DECLARE
  v_pending INTEGER;
  v_processing INTEGER;
  v_succeeded INTEGER;
  v_failed INTEGER;
  v_stale INTEGER;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  SELECT COUNT(*) INTO v_pending FROM financial_intents WHERE status = 'pending';
  SELECT COUNT(*) INTO v_processing FROM financial_intents WHERE status = 'processing';
  SELECT COUNT(*) INTO v_succeeded FROM financial_intents WHERE status = 'succeeded';
  SELECT COUNT(*) INTO v_failed FROM financial_intents WHERE status = 'failed';
  SELECT COUNT(*) INTO v_stale FROM financial_intents 
    WHERE status IN ('pending', 'processing') 
    AND created_at < NOW() - INTERVAL '1 hour'
    AND reconciled = FALSE;
  
  RETURN jsonb_build_object(
    'pending', v_pending,
    'processing', v_processing,
    'succeeded', v_succeeded,
    'failed', v_failed,
    'stale', v_stale,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_reconciliation_stats() TO service_role;
