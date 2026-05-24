-- ============================================================================
-- FINANCIAL INTENTS SECURITY FIXES - Priority 1
-- Addresses: Auth checks, idempotency race conditions, audit logging
-- ============================================================================

-- ============================================================================
-- FIX 1: create_financial_intent with auth check + race condition fix
-- ============================================================================
CREATE OR REPLACE FUNCTION create_financial_intent(
  p_idempotency_key TEXT,
  p_user_id UUID,
  p_intent_type TEXT,
  p_amount_cents INTEGER,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_existing RECORD;
  v_new_intent RECORD;
  v_caller_role TEXT;
BEGIN
  -- SECURITY: Get caller role
  v_caller_role := auth.role();
  
  -- SECURITY: Only service_role can create intents for other users
  -- Authenticated users can only create intents for themselves
  IF v_caller_role = 'authenticated' AND p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot create intent for another user';
  END IF;
  
  -- SECURITY: Anonymous users cannot create intents
  IF v_caller_role = 'anon' OR v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required';
  END IF;

  -- FIX: Use FOR UPDATE to prevent race conditions
  SELECT * INTO v_existing 
  FROM financial_intents 
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;
  
  IF FOUND THEN
    -- Idempotent return - same request returns same result
    RETURN jsonb_build_object(
      'success', true, 
      'idempotent', true, 
      'intent_id', v_existing.id, 
      'status', v_existing.status,
      'stripe_checkout_session_id', v_existing.stripe_checkout_session_id
    );
  END IF;
  
  -- Validate amount
  IF p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;
  
  -- Validate intent type
  IF p_intent_type NOT IN (
    'tournament_entry', 'wallet_deposit', 'escrow_fund', 'ticket_purchase',
    'subscription', 'payout', 'refund', 'prize_distribution'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid intent type');
  END IF;
  
  -- Insert new intent with conflict handling for extra safety
  INSERT INTO financial_intents (
    idempotency_key, 
    user_id, 
    tenant_id, 
    intent_type, 
    amount_cents, 
    reference_type, 
    reference_id, 
    metadata, 
    status
  )
  VALUES (
    p_idempotency_key, 
    p_user_id, 
    p_tenant_id, 
    p_intent_type, 
    p_amount_cents, 
    p_reference_type, 
    p_reference_id, 
    p_metadata, 
    'pending'
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET updated_at = NOW()
  RETURNING * INTO v_new_intent;
  
  -- Write audit log
  INSERT INTO audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    ip_address
  ) VALUES (
    p_user_id,
    'financial_intent_created',
    'financial_intent',
    v_new_intent.id,
    jsonb_build_object(
      'intent_type', p_intent_type,
      'amount_cents', p_amount_cents,
      'reference_type', p_reference_type,
      'reference_id', p_reference_id,
      'idempotency_key', p_idempotency_key
    ),
    NULL
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'idempotent', false, 
    'intent_id', v_new_intent.id, 
    'status', v_new_intent.status
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- FIX 2: update_intent_with_stripe with auth check
-- ============================================================================
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
  
  -- Get the intent first
  SELECT * INTO v_intent FROM financial_intents WHERE id = p_intent_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Intent not found');
  END IF;
  
  -- SECURITY: Only service_role or the intent owner can update
  IF v_caller_role = 'authenticated' AND v_intent.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update another user''s intent';
  END IF;
  
  IF v_caller_role = 'anon' OR v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required';
  END IF;
  
  -- Update the intent
  UPDATE financial_intents
  SET 
    stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
    stripe_checkout_session_id = COALESCE(p_stripe_checkout_session_id, stripe_checkout_session_id),
    status = p_status, 
    updated_at = NOW()
  WHERE id = p_intent_id
  RETURNING * INTO v_intent;
  
  -- Write audit log
  INSERT INTO audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    v_intent.user_id,
    'financial_intent_stripe_linked',
    'financial_intent',
    v_intent.id,
    jsonb_build_object(
      'stripe_session_id', p_stripe_checkout_session_id,
      'stripe_payment_intent_id', p_stripe_payment_intent_id,
      'new_status', p_status
    )
  );
  
  RETURN jsonb_build_object('success', true, 'intent_id', v_intent.id, 'status', v_intent.status);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- FIX 3: reconcile_financial_intent - SERVICE ROLE ONLY + double-entry ledger
-- ============================================================================
CREATE OR REPLACE FUNCTION reconcile_financial_intent(
  p_stripe_session_id TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'succeeded',
  p_stripe_charge_id TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE 
  v_intent RECORD; 
  v_ledger_id UUID;
  v_caller_role TEXT;
  v_ledger_result JSON;
BEGIN
  v_caller_role := auth.role();
  
  -- SECURITY: Only service_role can reconcile (called from webhooks)
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Reconciliation requires service_role';
  END IF;
  
  -- Find the intent with lock
  SELECT * INTO v_intent 
  FROM financial_intents
  WHERE (
    (p_stripe_session_id IS NOT NULL AND stripe_checkout_session_id = p_stripe_session_id) 
    OR 
    (p_stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = p_stripe_payment_intent_id)
  )
  AND reconciled = FALSE 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Not an error - might be a non-intent payment
    RETURN jsonb_build_object('success', false, 'error', 'No pending intent found', 'skip', true);
  END IF;
  
  -- Already reconciled - idempotent
  IF v_intent.reconciled THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'intent_id', v_intent.id);
  END IF;
  
  -- Update the intent status
  UPDATE financial_intents
  SET 
    status = p_status, 
    stripe_charge_id = COALESCE(p_stripe_charge_id, stripe_charge_id),
    error_code = p_error_code, 
    error_message = p_error_message,
    reconciled = (p_status = 'succeeded'), 
    reconciled_at = CASE WHEN p_status = 'succeeded' THEN NOW() ELSE NULL END,
    failure_count = CASE WHEN p_status = 'failed' THEN failure_count + 1 ELSE failure_count END,
    last_failure_at = CASE WHEN p_status = 'failed' THEN NOW() ELSE last_failure_at END,
    updated_at = NOW()
  WHERE id = v_intent.id;
  
  -- On success, write to double-entry ledger
  IF p_status = 'succeeded' THEN
    -- Check if we should use double-entry ledger based on intent type
    IF v_intent.intent_type = 'tournament_entry' THEN
      -- Tournament entry goes to escrow via double-entry
      SELECT post_ledger_transaction(
        v_intent.tenant_id,
        'deposit',
        jsonb_build_array(
          jsonb_build_object('account_id', get_or_create_ledger_account(v_intent.tenant_id, 'stripe_clearing', NULL, 'Stripe Clearing'), 'direction', 'debit', 'amount_cents', v_intent.amount_cents),
          jsonb_build_object('account_id', get_or_create_ledger_account(v_intent.tenant_id, 'tournament_escrow', v_intent.reference_id, 'Tournament Escrow'), 'direction', 'credit', 'amount_cents', v_intent.amount_cents)
        ),
        v_intent.reference_id,
        'tournament',
        'Tournament entry fee via Stripe',
        'reconcile_' || v_intent.id::TEXT
      ) INTO v_ledger_result;
      
      IF (v_ledger_result->>'success')::BOOLEAN THEN
        v_ledger_id := (v_ledger_result->>'transaction_id')::UUID;
      END IF;
      
    ELSIF v_intent.intent_type = 'ticket_purchase' THEN
      -- Use existing ticket ledger function
      SELECT ledger_ticket_sale(
        v_intent.tenant_id,
        v_intent.reference_id,
        v_intent.amount_cents,
        p_stripe_session_id,
        'reconcile_' || v_intent.id::TEXT
      ) INTO v_ledger_result;
      
      IF (v_ledger_result->>'success')::BOOLEAN THEN
        v_ledger_id := (v_ledger_result->>'transaction_id')::UUID;
      END IF;
      
    ELSE
      -- Default: Simple financial_transactions entry (single-entry fallback)
      INSERT INTO financial_transactions (
        user_id, 
        amount_cents, 
        type, 
        status, 
        description, 
        reference_type, 
        reference_id, 
        stripe_session_id, 
        stripe_payment_intent
      )
      VALUES (
        v_intent.user_id, 
        v_intent.amount_cents, 
        v_intent.intent_type, 
        'completed', 
        'Payment via Stripe', 
        v_intent.reference_type, 
        v_intent.reference_id, 
        p_stripe_session_id, 
        p_stripe_payment_intent_id
      )
      RETURNING id INTO v_ledger_id;
    END IF;
    
    -- Link ledger entry to intent
    UPDATE financial_intents SET ledger_entry_id = v_ledger_id WHERE id = v_intent.id;
  END IF;
  
  -- Write audit log
  INSERT INTO audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    v_intent.user_id,
    CASE 
      WHEN p_status = 'succeeded' THEN 'financial_intent_succeeded'
      WHEN p_status = 'failed' THEN 'financial_intent_failed'
      ELSE 'financial_intent_status_changed'
    END,
    'financial_intent',
    v_intent.id,
    jsonb_build_object(
      'status', p_status,
      'stripe_session_id', p_stripe_session_id,
      'stripe_charge_id', p_stripe_charge_id,
      'ledger_entry_id', v_ledger_id,
      'error_code', p_error_code,
      'error_message', p_error_message
    )
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'intent_id', v_intent.id, 
    'status', p_status, 
    'ledger_entry_id', v_ledger_id,
    'used_double_entry', (v_intent.intent_type IN ('tournament_entry', 'ticket_purchase'))
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error
  INSERT INTO audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    NULL,
    'financial_intent_reconcile_error',
    'financial_intent',
    NULL,
    jsonb_build_object(
      'stripe_session_id', p_stripe_session_id,
      'error', SQLERRM
    )
  );
  
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- FIX 4: Revoke direct EXECUTE from authenticated, require proper flow
-- ============================================================================
-- create_financial_intent can still be called by authenticated users (for their own intents)
-- but update and reconcile should be more restricted

-- Users can create intents for themselves
GRANT EXECUTE ON FUNCTION create_financial_intent(TEXT, UUID, TEXT, INTEGER, TEXT, UUID, UUID, JSONB) TO authenticated;

-- Users can update their own intents (function has internal auth check)
GRANT EXECUTE ON FUNCTION update_intent_with_stripe(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Reconcile is service_role ONLY (function enforces this internally, but we also restrict grant)
REVOKE EXECUTE ON FUNCTION reconcile_financial_intent(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION reconcile_financial_intent(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;


-- ============================================================================
-- FIX 5: Stale intent cleanup function (for scheduled job)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_stale_intents()
RETURNS JSONB AS $$
DECLARE
  v_expired_count INTEGER;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  
  -- Only service_role can run cleanup
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Cleanup requires service_role';
  END IF;
  
  -- Expire pending intents older than 24 hours
  WITH expired AS (
    UPDATE financial_intents
    SET 
      status = 'expired',
      updated_at = NOW()
    WHERE 
      status = 'pending'
      AND created_at < NOW() - INTERVAL '24 hours'
      AND reconciled = FALSE
    RETURNING id
  )
  SELECT COUNT(*) INTO v_expired_count FROM expired;
  
  -- Log cleanup
  INSERT INTO audit_log (
    user_id,
    action,
    resource_type,
    metadata
  ) VALUES (
    NULL,
    'stale_intents_cleanup',
    'financial_intent',
    jsonb_build_object('expired_count', v_expired_count)
  );
  
  RETURN jsonb_build_object('success', true, 'expired_count', v_expired_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_stale_intents() TO service_role;
