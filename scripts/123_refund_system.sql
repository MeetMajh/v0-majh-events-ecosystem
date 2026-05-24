-- ============================================
-- 123_refund_system.sql
-- Phase 2: Refund Processing System
-- ============================================

-- Step 1: Extend financial_intents for refund linkage
ALTER TABLE financial_intents
ADD COLUMN IF NOT EXISTS original_intent_id UUID REFERENCES financial_intents(id);

CREATE INDEX IF NOT EXISTS idx_financial_intents_original
ON financial_intents(original_intent_id);

-- Step 2: Refund Eligibility Validation
CREATE OR REPLACE FUNCTION validate_refund(
  p_original_intent_id UUID,
  p_amount_cents INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_original RECORD;
  v_refunded_total INTEGER;
  v_payout_exists BOOLEAN;
BEGIN
  -- Get original intent
  SELECT * INTO v_original
  FROM financial_intents
  WHERE id = p_original_intent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Original intent not found');
  END IF;

  IF v_original.status != 'succeeded' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Original payment not completed');
  END IF;

  -- Check if payouts already executed (for tournament entries)
  IF v_original.intent_type = 'tournament_entry' AND v_original.reference_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM payout_requests
      WHERE tournament_id = v_original.reference_id
      AND status IN ('completed', 'processing')
    ) INTO v_payout_exists;

    IF v_payout_exists THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot refund: payouts already executed');
    END IF;
  END IF;

  -- Sum previous refunds for this original intent
  SELECT COALESCE(SUM(amount_cents), 0)
  INTO v_refunded_total
  FROM financial_intents
  WHERE original_intent_id = p_original_intent_id
    AND intent_type = 'refund'
    AND status = 'succeeded';

  IF (v_refunded_total + p_amount_cents) > v_original.amount_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Refund exceeds original amount',
      'original_amount', v_original.amount_cents,
      'already_refunded', v_refunded_total,
      'requested', p_amount_cents,
      'max_available', v_original.amount_cents - v_refunded_total
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'original_amount', v_original.amount_cents,
    'already_refunded', v_refunded_total,
    'max_available', v_original.amount_cents - v_refunded_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create Refund Intent
CREATE OR REPLACE FUNCTION create_refund_intent(
  p_original_intent_id UUID,
  p_amount_cents INTEGER,
  p_reason TEXT DEFAULT 'Customer requested refund',
  p_initiated_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_original RECORD;
  v_validation JSONB;
  v_refund_intent_id UUID;
  v_idempotency_key TEXT;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service_role required';
  END IF;

  -- Validate refund eligibility
  v_validation := validate_refund(p_original_intent_id, p_amount_cents);
  IF (v_validation->>'success')::boolean = false THEN
    RETURN v_validation;
  END IF;

  -- Get original intent
  SELECT * INTO v_original FROM financial_intents WHERE id = p_original_intent_id;

  -- Create idempotency key
  v_idempotency_key := 'refund_' || p_original_intent_id::text || '_' || p_amount_cents::text || '_' || COALESCE(p_reason, '');

  -- Check for existing refund intent with same idempotency
  SELECT id INTO v_refund_intent_id
  FROM financial_intents
  WHERE idempotency_key = v_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'refund_intent_id', v_refund_intent_id
    );
  END IF;

  -- Create refund intent
  INSERT INTO financial_intents (
    idempotency_key,
    user_id,
    tenant_id,
    intent_type,
    amount_cents,
    reference_type,
    reference_id,
    original_intent_id,
    status,
    metadata
  )
  VALUES (
    v_idempotency_key,
    v_original.user_id,
    v_original.tenant_id,
    'refund',
    p_amount_cents,
    v_original.reference_type,
    v_original.reference_id,
    p_original_intent_id,
    'pending',
    jsonb_build_object(
      'reason', p_reason,
      'initiated_by', p_initiated_by,
      'original_stripe_session', v_original.stripe_checkout_session_id,
      'original_stripe_pi', v_original.stripe_payment_intent_id
    )
  )
  RETURNING id INTO v_refund_intent_id;

  -- Audit
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    COALESCE(p_initiated_by, v_original.user_id),
    'refund_intent_created',
    'financial_intent',
    v_refund_intent_id,
    jsonb_build_object(
      'original_intent_id', p_original_intent_id,
      'amount_cents', p_amount_cents,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'refund_intent_id', v_refund_intent_id,
    'original_intent_id', p_original_intent_id,
    'amount_cents', p_amount_cents
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Process Refund (after Stripe confirms)
CREATE OR REPLACE FUNCTION process_refund_intent(
  p_refund_intent_id UUID,
  p_stripe_refund_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_intent RECORD;
  v_original RECORD;
  v_tx_id UUID;
  v_tenant_id UUID;
  v_fee_calc JSON;
  v_fee_amount BIGINT;
  v_net_amount BIGINT;
  v_clearing_account UUID;
  v_target_account UUID;
  v_platform_account UUID;
  v_refunds_account UUID;
  v_entries JSONB;
  v_ledger_result JSON;
  v_idempotency_key TEXT;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service_role required';
  END IF;

  -- Lock refund intent
  SELECT * INTO v_intent
  FROM financial_intents
  WHERE id = p_refund_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund intent not found');
  END IF;

  IF v_intent.intent_type != 'refund' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a refund intent');
  END IF;

  -- Idempotency check
  IF v_intent.status = 'succeeded' AND v_intent.reconciled THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'refund_intent_id', v_intent.id,
      'ledger_tx_id', v_intent.ledger_entry_id
    );
  END IF;

  IF v_intent.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid refund state: ' || v_intent.status);
  END IF;

  -- Get original intent
  SELECT * INTO v_original
  FROM financial_intents
  WHERE id = v_intent.original_intent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Original intent not found');
  END IF;

  -- Update refund intent to processing
  UPDATE financial_intents
  SET status = 'processing',
      stripe_refund_id = COALESCE(p_stripe_refund_id, stripe_refund_id),
      updated_at = NOW()
  WHERE id = p_refund_intent_id;

  -- Calculate fee reversal (same rate as original)
  v_tenant_id := COALESCE(v_intent.tenant_id, (SELECT id FROM tenants LIMIT 1));
  v_fee_calc := calculate_platform_fee(v_tenant_id, v_intent.amount_cents, v_original.reference_id, NULL);
  v_fee_amount := (v_fee_calc->>'fee_amount_cents')::BIGINT;
  v_net_amount := (v_fee_calc->>'net_amount_cents')::BIGINT;

  -- Get accounts
  v_clearing_account := get_or_create_ledger_account(v_tenant_id, 'stripe_clearing', NULL, 'Stripe Clearing');
  v_platform_account := get_or_create_ledger_account(v_tenant_id, 'platform_revenue', NULL, 'Platform Revenue');
  v_refunds_account := get_or_create_ledger_account(v_tenant_id, 'refunds', NULL, 'Refunds');

  -- Determine target account based on original intent type
  CASE v_original.intent_type
    WHEN 'tournament_entry' THEN
      v_target_account := get_or_create_ledger_account(v_tenant_id, 'escrow', v_original.reference_id, 'Tournament Escrow');
    WHEN 'ticket_purchase' THEN
      v_target_account := get_or_create_ledger_account(v_tenant_id, 'organizer_payable', 
        (SELECT organizer_id FROM events WHERE id = v_original.reference_id), 'Organizer Payable');
    ELSE
      v_target_account := get_or_create_ledger_account(v_tenant_id, 'user_wallet', v_original.user_id, 'User Wallet');
  END CASE;

  -- Build reversal entries (opposite of original flow)
  -- Original: Clearing (debit) -> Target (credit net) + Platform (credit fee)
  -- Refund:   Target (debit net) + Platform (debit fee) -> Refunds (credit total)
  v_entries := jsonb_build_array(
    -- Debit from target account (reverse the credit)
    jsonb_build_object('account_id', v_target_account, 'direction', 'debit', 'amount_cents', v_net_amount),
    -- Debit from platform revenue (reverse the fee)
    jsonb_build_object('account_id', v_platform_account, 'direction', 'debit', 'amount_cents', v_fee_amount),
    -- Credit to refunds account (money going back to customer)
    jsonb_build_object('account_id', v_refunds_account, 'direction', 'credit', 'amount_cents', v_intent.amount_cents)
  );

  v_idempotency_key := 'refund_ledger_' || v_intent.id::text;

  -- Post ledger transaction
  v_ledger_result := post_ledger_transaction(
    v_tenant_id,
    'refund',
    v_entries,
    v_intent.id,
    'refund',
    'Refund for intent ' || v_original.id::text || ' | Amount: $' || (v_intent.amount_cents / 100.0)::text || ' | Fee reversed: $' || (v_fee_amount / 100.0)::text,
    v_idempotency_key
  );

  IF v_ledger_result->>'success' != 'true' THEN
    UPDATE financial_intents
    SET status = 'failed',
        error_message = v_ledger_result->>'error',
        failure_count = failure_count + 1,
        last_failure_at = NOW(),
        updated_at = NOW()
    WHERE id = p_refund_intent_id;

    RETURN jsonb_build_object('success', false, 'error', 'Ledger transaction failed: ' || (v_ledger_result->>'error'));
  END IF;

  v_tx_id := (v_ledger_result->>'transaction_id')::UUID;

  -- Mark refund as succeeded
  UPDATE financial_intents
  SET status = 'succeeded',
      reconciled = TRUE,
      reconciled_at = NOW(),
      ledger_entry_id = v_tx_id,
      updated_at = NOW()
  WHERE id = p_refund_intent_id;

  -- Audit
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_intent.user_id,
    'refund_processed',
    'financial_intent',
    v_intent.id,
    jsonb_build_object(
      'original_intent_id', v_original.id,
      'amount_cents', v_intent.amount_cents,
      'fee_reversed', v_fee_amount,
      'net_reversed', v_net_amount,
      'ledger_tx_id', v_tx_id,
      'stripe_refund_id', p_stripe_refund_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'refund_intent_id', v_intent.id,
    'ledger_tx_id', v_tx_id,
    'amount_refunded', v_intent.amount_cents,
    'fee_reversed', v_fee_amount
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_intent.user_id,
    'refund_process_error',
    'financial_intent',
    p_refund_intent_id,
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
  );

  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Permissions
GRANT EXECUTE ON FUNCTION validate_refund(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION create_refund_intent(UUID, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION process_refund_intent(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION validate_refund(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_refund_intent(UUID, INTEGER, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION process_refund_intent(UUID, TEXT) FROM PUBLIC;
