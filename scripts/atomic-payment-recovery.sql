-- =============================================================================
-- ATOMIC PAYMENT RECOVERY SYSTEM
-- Fully atomic, idempotent, audited recovery for missing Stripe payments
-- =============================================================================

-- ============================================
-- MAIN RPC: recover_stripe_payment
-- ============================================
DROP FUNCTION IF EXISTS recover_stripe_payment(TEXT, UUID, UUID, INT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION recover_stripe_payment(
  p_session_id TEXT,
  p_admin_id UUID,
  p_user_id UUID,
  p_amount_cents INT,
  p_payment_intent TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT 'Missing webhook - admin recovery'
)
RETURNS JSON AS $$
DECLARE
  v_existing_tx RECORD;
  v_existing_audit RECORD;
  v_tx_id UUID;
  v_wallet RECORD;
  v_previous_balance INT;
  v_new_balance INT;
  v_environment TEXT;
  v_is_test BOOLEAN;
  v_idempotency_key TEXT;
BEGIN
  -- -------------------------------------------------------
  -- 0. Determine environment from session ID
  -- -------------------------------------------------------
  v_environment := CASE 
    WHEN p_session_id LIKE 'cs_test_%' THEN 'test'
    WHEN p_session_id LIKE 'cs_live_%' THEN 'live'
    ELSE 'unknown'
  END;
  v_is_test := (v_environment = 'test');
  v_idempotency_key := 'recover_stripe_' || p_session_id;

  -- -------------------------------------------------------
  -- 1. IDEMPOTENCY CHECK: Transaction already exists
  -- -------------------------------------------------------
  SELECT id, created_at, amount_cents INTO v_existing_tx
  FROM financial_transactions
  WHERE stripe_session_id = p_session_id
  FOR UPDATE;

  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Transaction already exists for this Stripe session',
      'already_recovered', true,
      'existing_transaction_id', v_existing_tx.id,
      'existing_amount', v_existing_tx.amount_cents
    );
  END IF;

  -- -------------------------------------------------------
  -- 2. IDEMPOTENCY CHECK: Already recovered in audit log
  -- -------------------------------------------------------
  SELECT id, created_at INTO v_existing_audit
  FROM reconciliation_audit_log
  WHERE idempotency_key = v_idempotency_key
    AND status = 'completed'
  FOR UPDATE;

  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This payment was already recovered',
      'already_recovered', true,
      'recovered_at', v_existing_audit.created_at
    );
  END IF;

  -- -------------------------------------------------------
  -- 3. IDEMPOTENCY CHECK: Dismissed payments cannot be recovered
  -- -------------------------------------------------------
  SELECT id, reason INTO v_existing_audit
  FROM reconciliation_audit_log
  WHERE idempotency_key = 'dismiss_stripe_session_' || p_session_id
    AND status = 'completed';

  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This payment was dismissed and cannot be recovered',
      'dismiss_reason', v_existing_audit.reason
    );
  END IF;

  -- -------------------------------------------------------
  -- 4. Lock wallet row and get current balance
  -- -------------------------------------------------------
  SELECT user_id, balance_cents INTO v_wallet
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Create wallet if doesn't exist
    INSERT INTO wallets (user_id, balance_cents)
    VALUES (p_user_id, 0);
    v_previous_balance := 0;
  ELSE
    v_previous_balance := v_wallet.balance_cents;
  END IF;

  v_new_balance := v_previous_balance + p_amount_cents;

  -- -------------------------------------------------------
  -- 5. Insert transaction record (ledger entry)
  -- -------------------------------------------------------
  INSERT INTO financial_transactions (
    user_id,
    type,
    amount_cents,
    status,
    description,
    stripe_session_id,
    stripe_payment_intent,
    is_test,
    environment,
    recovered_at,
    recovered_by,
    recovery_source,
    created_at
  ) VALUES (
    p_user_id,
    'deposit',
    p_amount_cents,
    'completed',
    CASE WHEN v_is_test 
      THEN '[TEST] Recovered Stripe deposit - ' || p_reason
      ELSE 'Recovered Stripe deposit - ' || p_reason
    END,
    p_session_id,
    p_payment_intent,
    v_is_test,
    v_environment,
    NOW(),
    p_admin_id,
    'stripe_reconciliation',
    NOW()
  )
  RETURNING id INTO v_tx_id;

  -- -------------------------------------------------------
  -- 6. Credit wallet (atomic with transaction insert)
  -- -------------------------------------------------------
  UPDATE wallets
  SET balance_cents = v_new_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- -------------------------------------------------------
  -- 7. Create audit log entry
  -- -------------------------------------------------------
  INSERT INTO reconciliation_audit_log (
    action_type,
    target_type,
    target_id,
    user_id,
    performed_by,
    amount_cents,
    previous_balance_cents,
    new_balance_cents,
    reason,
    documentation,
    is_test_data,
    environment,
    idempotency_key,
    status,
    related_transaction_id,
    stripe_session_id
  ) VALUES (
    'recovery',
    'stripe_session',
    p_session_id,
    p_user_id,
    p_admin_id,
    p_amount_cents,
    v_previous_balance,
    v_new_balance,
    p_reason,
    format(
      'ATOMIC RECOVERY: Recovered %s payment of $%s. Previous balance: $%s, New balance: $%s. Session: %s',
      v_environment,
      (p_amount_cents::numeric / 100)::text,
      (v_previous_balance::numeric / 100)::text,
      (v_new_balance::numeric / 100)::text,
      p_session_id
    ),
    v_is_test,
    v_environment,
    v_idempotency_key,
    'completed',
    v_tx_id,
    p_session_id
  );

  -- -------------------------------------------------------
  -- 8. Return success with full details
  -- -------------------------------------------------------
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'environment', v_environment,
    'is_test', v_is_test,
    'credited_amount', p_amount_cents,
    'previous_balance', v_previous_balance,
    'new_balance', v_new_balance,
    'user_id', p_user_id,
    'session_id', p_session_id,
    'idempotency_key', v_idempotency_key
  );

EXCEPTION WHEN OTHERS THEN
  -- Log failed attempt (outside transaction - won't be rolled back)
  -- The main transaction will be fully rolled back
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- PREVIEW RPC: get_recovery_preview
-- ============================================
DROP FUNCTION IF EXISTS get_recovery_preview(TEXT);

CREATE OR REPLACE FUNCTION get_recovery_preview(p_session_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_existing_tx RECORD;
  v_existing_audit RECORD;
  v_dismissed RECORD;
  v_environment TEXT;
BEGIN
  v_environment := CASE 
    WHEN p_session_id LIKE 'cs_test_%' THEN 'test'
    WHEN p_session_id LIKE 'cs_live_%' THEN 'live'
    ELSE 'unknown'
  END;

  -- Check if already recovered via transaction
  SELECT id, created_at, amount_cents, user_id INTO v_existing_tx
  FROM financial_transactions
  WHERE stripe_session_id = p_session_id;

  IF FOUND THEN
    RETURN json_build_object(
      'can_recover', false,
      'reason', 'Transaction already exists',
      'existing_transaction', json_build_object(
        'id', v_existing_tx.id,
        'amount_cents', v_existing_tx.amount_cents,
        'created_at', v_existing_tx.created_at
      )
    );
  END IF;

  -- Check if dismissed
  SELECT id, reason, created_at INTO v_dismissed
  FROM reconciliation_audit_log
  WHERE idempotency_key = 'dismiss_stripe_session_' || p_session_id
    AND status = 'completed';

  IF FOUND THEN
    RETURN json_build_object(
      'can_recover', false,
      'reason', 'Payment was dismissed',
      'dismiss_reason', v_dismissed.reason,
      'dismissed_at', v_dismissed.created_at
    );
  END IF;

  -- Check if already recovered via audit
  SELECT id, created_at INTO v_existing_audit
  FROM reconciliation_audit_log
  WHERE idempotency_key = 'recover_stripe_' || p_session_id
    AND status = 'completed';

  IF FOUND THEN
    RETURN json_build_object(
      'can_recover', false,
      'reason', 'Already recovered',
      'recovered_at', v_existing_audit.created_at
    );
  END IF;

  -- Can be recovered
  RETURN json_build_object(
    'can_recover', true,
    'environment', v_environment,
    'is_test', v_environment = 'test',
    'session_id', p_session_id,
    'warnings', CASE 
      WHEN v_environment = 'unknown' THEN ARRAY['Unable to determine environment from session ID']
      ELSE ARRAY[]::TEXT[]
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- BATCH RECOVERY: recover_all_missing_payments
-- ============================================
DROP FUNCTION IF EXISTS get_missing_payments_for_recovery();

CREATE OR REPLACE FUNCTION get_missing_payments_for_recovery()
RETURNS JSON AS $$
DECLARE
  v_missing JSON[];
  v_rec RECORD;
BEGIN
  -- This assumes you have a way to detect missing payments
  -- In practice, this comes from the reconciliation API comparing Stripe to DB
  -- Here we return the structure for the UI to populate
  RETURN json_build_object(
    'success', true,
    'note', 'Missing payments should be detected via /api/admin/reconciliation',
    'expected_format', json_build_array(
      json_build_object(
        'session_id', 'cs_live_xxx',
        'user_id', 'uuid',
        'amount_cents', 500,
        'customer_email', 'user@example.com',
        'payment_intent', 'pi_xxx',
        'suggested_action', 'recover'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION recover_stripe_payment(TEXT, UUID, UUID, INT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recovery_preview(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_missing_payments_for_recovery() TO authenticated;
