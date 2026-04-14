-- =============================================================================
-- ATOMIC FINANCIAL OPERATIONS
-- Production-grade RPC functions with row-level locking and full atomicity
-- =============================================================================

-- ============================================
-- 1. APPROVE WITHDRAWAL (Atomic)
-- ============================================
CREATE OR REPLACE FUNCTION approve_withdrawal(
  p_withdrawal_id UUID,
  p_admin_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_withdrawal RECORD;
  v_current_balance INT;
BEGIN
  -- Lock the withdrawal row
  SELECT * INTO v_withdrawal
  FROM financial_transactions
  WHERE id = p_withdrawal_id
  AND type = 'withdrawal'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  IF v_withdrawal.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal is not pending, current status: ' || v_withdrawal.status);
  END IF;

  -- Get current wallet balance
  SELECT balance_cents INTO v_current_balance
  FROM wallets
  WHERE user_id = v_withdrawal.user_id
  FOR UPDATE;

  -- Verify sufficient funds (should already be reserved, but double-check)
  IF v_current_balance < ABS(v_withdrawal.amount_cents) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient wallet balance');
  END IF;

  -- Update withdrawal status to processing
  UPDATE financial_transactions
  SET 
    status = 'processing',
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'approved_by', p_admin_id,
      'approved_at', NOW()
    )
  WHERE id = p_withdrawal_id;

  -- Log to audit
  INSERT INTO reconciliation_audit_log (
    action_type, target_type, target_id, performed_by,
    amount_cents, reason, status
  ) VALUES (
    'withdrawal_approve', 'transaction', p_withdrawal_id::TEXT, p_admin_id,
    v_withdrawal.amount_cents, 'Withdrawal approved by admin', 'completed'
  );

  RETURN json_build_object(
    'success', true,
    'withdrawal_id', p_withdrawal_id,
    'amount', v_withdrawal.amount_cents,
    'user_id', v_withdrawal.user_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 2. REJECT WITHDRAWAL (Atomic)
-- Returns funds to wallet
-- ============================================
CREATE OR REPLACE FUNCTION reject_withdrawal(
  p_withdrawal_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSON AS $$
DECLARE
  v_withdrawal RECORD;
  v_new_balance INT;
BEGIN
  -- Lock the withdrawal row
  SELECT * INTO v_withdrawal
  FROM financial_transactions
  WHERE id = p_withdrawal_id
  AND type = 'withdrawal'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  IF v_withdrawal.status NOT IN ('pending', 'processing') THEN
    RETURN json_build_object('success', false, 'error', 'Cannot reject withdrawal with status: ' || v_withdrawal.status);
  END IF;

  -- Update withdrawal status to rejected
  UPDATE financial_transactions
  SET 
    status = 'rejected',
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'rejected_by', p_admin_id,
      'rejected_at', NOW(),
      'rejection_reason', p_reason
    )
  WHERE id = p_withdrawal_id;

  -- Return funds to wallet (withdrawal amount is negative, so we subtract it to add back)
  UPDATE wallets
  SET 
    balance_cents = balance_cents - v_withdrawal.amount_cents,
    updated_at = NOW()
  WHERE user_id = v_withdrawal.user_id
  RETURNING balance_cents INTO v_new_balance;

  -- Create refund transaction
  INSERT INTO financial_transactions (
    user_id, type, amount_cents, status, description, metadata
  ) VALUES (
    v_withdrawal.user_id,
    'refund',
    ABS(v_withdrawal.amount_cents),
    'completed',
    'Withdrawal rejected: ' || p_reason,
    jsonb_build_object(
      'original_withdrawal_id', p_withdrawal_id,
      'rejection_reason', p_reason
    )
  );

  -- Log to audit
  INSERT INTO reconciliation_audit_log (
    action_type, target_type, target_id, user_id, performed_by,
    amount_cents, previous_balance_cents, new_balance_cents,
    reason, status
  ) VALUES (
    'withdrawal_reject', 'transaction', p_withdrawal_id::TEXT, v_withdrawal.user_id, p_admin_id,
    v_withdrawal.amount_cents, v_new_balance + v_withdrawal.amount_cents, v_new_balance,
    p_reason, 'completed'
  );

  RETURN json_build_object(
    'success', true,
    'withdrawal_id', p_withdrawal_id,
    'refunded_amount', ABS(v_withdrawal.amount_cents),
    'new_balance', v_new_balance
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 3. RELEASE ESCROW (Atomic)
-- ============================================
CREATE OR REPLACE FUNCTION release_escrow(
  p_escrow_id UUID,
  p_admin_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_escrow RECORD;
BEGIN
  -- Lock the escrow row
  SELECT * INTO v_escrow
  FROM escrow_accounts
  WHERE id = p_escrow_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Escrow account not found');
  END IF;

  IF v_escrow.status != 'funded' THEN
    RETURN json_build_object('success', false, 'error', 'Escrow must be funded to release, current status: ' || v_escrow.status);
  END IF;

  -- Update escrow status
  UPDATE escrow_accounts
  SET 
    status = 'released',
    released_at = NOW(),
    updated_at = NOW()
  WHERE id = p_escrow_id;

  -- Log to audit
  INSERT INTO reconciliation_audit_log (
    action_type, target_type, target_id, performed_by,
    amount_cents, reason, status
  ) VALUES (
    'escrow_release', 'escrow', p_escrow_id::TEXT, p_admin_id,
    v_escrow.funded_amount_cents, 'Escrow released by admin', 'completed'
  );

  RETURN json_build_object(
    'success', true,
    'escrow_id', p_escrow_id,
    'tournament_id', v_escrow.tournament_id,
    'released_amount', v_escrow.funded_amount_cents
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 4. PROCESS PAYOUT (Atomic)
-- Credits winnings to user wallet
-- ============================================
CREATE OR REPLACE FUNCTION process_payout(
  p_payout_id UUID,
  p_admin_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_payout RECORD;
  v_new_balance INT;
  v_tx_id UUID;
BEGIN
  -- Lock the payout row
  SELECT * INTO v_payout
  FROM tournament_payouts
  WHERE id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Payout not found');
  END IF;

  IF v_payout.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Payout already processed, status: ' || v_payout.status);
  END IF;

  -- Credit user wallet
  UPDATE wallets
  SET 
    balance_cents = balance_cents + v_payout.amount_cents,
    updated_at = NOW()
  WHERE user_id = v_payout.user_id
  RETURNING balance_cents INTO v_new_balance;

  -- If wallet doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, balance_cents)
    VALUES (v_payout.user_id, v_payout.amount_cents)
    RETURNING balance_cents INTO v_new_balance;
  END IF;

  -- Create prize transaction
  INSERT INTO financial_transactions (
    user_id, type, amount_cents, status, description,
    tournament_id, metadata
  ) VALUES (
    v_payout.user_id,
    'prize',
    v_payout.amount_cents,
    'completed',
    'Tournament prize - Position #' || v_payout.position,
    v_payout.tournament_id,
    jsonb_build_object(
      'payout_id', p_payout_id,
      'position', v_payout.position,
      'processed_by', p_admin_id
    )
  )
  RETURNING id INTO v_tx_id;

  -- Update payout status
  UPDATE tournament_payouts
  SET 
    status = 'paid',
    paid_at = NOW(),
    transaction_id = v_tx_id
  WHERE id = p_payout_id;

  -- Log to audit
  INSERT INTO reconciliation_audit_log (
    action_type, target_type, target_id, user_id, performed_by,
    amount_cents, new_balance_cents, reason, status, related_transaction_id
  ) VALUES (
    'payout_process', 'payout', p_payout_id::TEXT, v_payout.user_id, p_admin_id,
    v_payout.amount_cents, v_new_balance,
    'Tournament payout processed - Position #' || v_payout.position,
    'completed', v_tx_id
  );

  RETURN json_build_object(
    'success', true,
    'payout_id', p_payout_id,
    'user_id', v_payout.user_id,
    'amount', v_payout.amount_cents,
    'new_balance', v_new_balance,
    'transaction_id', v_tx_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 5. PROCESS ALL PENDING PAYOUTS (Batch Atomic)
-- ============================================
CREATE OR REPLACE FUNCTION process_all_pending_payouts(
  p_admin_id UUID,
  p_tournament_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_payout RECORD;
  v_processed INT := 0;
  v_failed INT := 0;
  v_total_amount INT := 0;
  v_result JSON;
BEGIN
  FOR v_payout IN 
    SELECT id FROM tournament_payouts
    WHERE status = 'pending'
    AND (p_tournament_id IS NULL OR tournament_id = p_tournament_id)
    ORDER BY position ASC
  LOOP
    SELECT process_payout(v_payout.id, p_admin_id) INTO v_result;
    
    IF (v_result->>'success')::BOOLEAN THEN
      v_processed := v_processed + 1;
      v_total_amount := v_total_amount + (v_result->>'amount')::INT;
    ELSE
      v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'processed', v_processed,
    'failed', v_failed,
    'total_amount', v_total_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM, 'processed', v_processed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 6. VOID TRANSACTION (Atomic)
-- ============================================
CREATE OR REPLACE FUNCTION void_transaction(
  p_transaction_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSON AS $$
DECLARE
  v_tx RECORD;
BEGIN
  -- Lock the transaction
  SELECT * INTO v_tx
  FROM financial_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  IF v_tx.status = 'voided' THEN
    RETURN json_build_object('success', false, 'error', 'Transaction already voided');
  END IF;

  -- Update status to voided
  UPDATE financial_transactions
  SET 
    status = 'voided',
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'voided_by', p_admin_id,
      'voided_at', NOW(),
      'void_reason', p_reason
    )
  WHERE id = p_transaction_id;

  -- Log to audit
  INSERT INTO reconciliation_audit_log (
    action_type, target_type, target_id, user_id, performed_by,
    amount_cents, reason, status
  ) VALUES (
    'void', 'transaction', p_transaction_id::TEXT, v_tx.user_id, p_admin_id,
    v_tx.amount_cents, p_reason, 'completed'
  );

  RETURN json_build_object(
    'success', true,
    'transaction_id', p_transaction_id,
    'voided_amount', v_tx.amount_cents
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 7. DAILY RECONCILIATION CHECK
-- Verifies wallet balances match transaction sums
-- ============================================
CREATE OR REPLACE FUNCTION run_daily_reconciliation()
RETURNS JSON AS $$
DECLARE
  v_mismatch RECORD;
  v_mismatches JSON[];
  v_count INT := 0;
BEGIN
  -- Find all wallet balance mismatches
  FOR v_mismatch IN
    SELECT 
      w.user_id,
      w.balance_cents as wallet_balance,
      COALESCE(SUM(
        CASE WHEN ft.status = 'completed' THEN ft.amount_cents ELSE 0 END
      ), 0) as transaction_sum,
      w.balance_cents - COALESCE(SUM(
        CASE WHEN ft.status = 'completed' THEN ft.amount_cents ELSE 0 END
      ), 0) as discrepancy
    FROM wallets w
    LEFT JOIN financial_transactions ft ON ft.user_id = w.user_id
    GROUP BY w.user_id, w.balance_cents
    HAVING w.balance_cents != COALESCE(SUM(
      CASE WHEN ft.status = 'completed' THEN ft.amount_cents ELSE 0 END
    ), 0)
  LOOP
    v_mismatches := array_append(v_mismatches, json_build_object(
      'user_id', v_mismatch.user_id,
      'wallet_balance', v_mismatch.wallet_balance,
      'transaction_sum', v_mismatch.transaction_sum,
      'discrepancy', v_mismatch.discrepancy
    ));
    v_count := v_count + 1;

    -- Log each mismatch to audit
    INSERT INTO reconciliation_audit_log (
      action_type, target_type, target_id, user_id,
      amount_cents, reason, status, documentation
    ) VALUES (
      'reconciliation_mismatch', 'wallet', v_mismatch.user_id::TEXT, v_mismatch.user_id,
      v_mismatch.discrepancy, 'Daily reconciliation found balance mismatch', 'flagged',
      format('Wallet: %s, Transactions: %s, Discrepancy: %s',
        v_mismatch.wallet_balance, v_mismatch.transaction_sum, v_mismatch.discrepancy)
    );
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'run_at', NOW(),
    'mismatches_found', v_count,
    'mismatches', COALESCE(v_mismatches, ARRAY[]::JSON[])
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 8. RISK FLAG DETECTION
-- Flags suspicious activity
-- ============================================
CREATE OR REPLACE FUNCTION check_risk_flags(
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_flags JSON[];
  v_user RECORD;
BEGIN
  -- Check for users with suspicious patterns
  FOR v_user IN
    SELECT 
      ft.user_id,
      COUNT(*) FILTER (WHERE ft.type = 'deposit' AND ft.created_at > NOW() - INTERVAL '24 hours') as deposits_24h,
      COUNT(*) FILTER (WHERE ft.type = 'withdrawal' AND ft.created_at > NOW() - INTERVAL '24 hours') as withdrawals_24h,
      COUNT(*) FILTER (WHERE ft.type = 'reversal' AND ft.created_at > NOW() - INTERVAL '7 days') as reversals_7d,
      SUM(CASE WHEN ft.type = 'deposit' AND ft.created_at > NOW() - INTERVAL '24 hours' THEN ft.amount_cents ELSE 0 END) as deposit_amount_24h,
      SUM(CASE WHEN ft.type = 'withdrawal' AND ft.created_at > NOW() - INTERVAL '24 hours' THEN ABS(ft.amount_cents) ELSE 0 END) as withdrawal_amount_24h
    FROM financial_transactions ft
    WHERE (p_user_id IS NULL OR ft.user_id = p_user_id)
    AND ft.status = 'completed'
    GROUP BY ft.user_id
    HAVING 
      -- Large single deposit (> $1000)
      MAX(CASE WHEN ft.type = 'deposit' AND ft.created_at > NOW() - INTERVAL '24 hours' THEN ft.amount_cents ELSE 0 END) > 100000
      -- Rapid withdrawals (> 3 in 24h)
      OR COUNT(*) FILTER (WHERE ft.type = 'withdrawal' AND ft.created_at > NOW() - INTERVAL '24 hours') > 3
      -- Multiple reversals (> 2 in 7 days)
      OR COUNT(*) FILTER (WHERE ft.type = 'reversal' AND ft.created_at > NOW() - INTERVAL '7 days') > 2
      -- High withdrawal velocity (> $500 in 24h)
      OR SUM(CASE WHEN ft.type = 'withdrawal' AND ft.created_at > NOW() - INTERVAL '24 hours' THEN ABS(ft.amount_cents) ELSE 0 END) > 50000
  LOOP
    v_flags := array_append(v_flags, json_build_object(
      'user_id', v_user.user_id,
      'deposits_24h', v_user.deposits_24h,
      'withdrawals_24h', v_user.withdrawals_24h,
      'reversals_7d', v_user.reversals_7d,
      'deposit_amount_24h', v_user.deposit_amount_24h,
      'withdrawal_amount_24h', v_user.withdrawal_amount_24h,
      'flags', ARRAY[
        CASE WHEN v_user.deposit_amount_24h > 100000 THEN 'large_deposit' END,
        CASE WHEN v_user.withdrawals_24h > 3 THEN 'rapid_withdrawals' END,
        CASE WHEN v_user.reversals_7d > 2 THEN 'multiple_reversals' END,
        CASE WHEN v_user.withdrawal_amount_24h > 50000 THEN 'high_withdrawal_velocity' END
      ]
    ));
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'checked_at', NOW(),
    'flagged_users', array_length(v_flags, 1),
    'flags', COALESCE(v_flags, ARRAY[]::JSON[])
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 9. SYSTEM CONTROLS TABLE
-- For circuit breakers and kill switches
-- ============================================
CREATE TABLE IF NOT EXISTS system_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_type TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  threshold_value INT,
  triggered_at TIMESTAMPTZ,
  triggered_by UUID,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default controls
INSERT INTO system_controls (control_type, is_enabled, threshold_value) VALUES
  ('withdrawals_enabled', true, NULL),
  ('deposits_enabled', true, NULL),
  ('payouts_enabled', true, NULL),
  ('daily_withdrawal_limit', true, 100000), -- $1000 default
  ('circuit_breaker_withdrawals', true, 500000) -- $5000 triggers circuit breaker
ON CONFLICT (control_type) DO NOTHING;


-- ============================================
-- 10. TOGGLE SYSTEM CONTROL
-- ============================================
CREATE OR REPLACE FUNCTION toggle_system_control(
  p_control_type TEXT,
  p_enabled BOOLEAN,
  p_admin_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_control RECORD;
BEGIN
  SELECT * INTO v_control
  FROM system_controls
  WHERE control_type = p_control_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Control type not found');
  END IF;

  UPDATE system_controls
  SET 
    is_enabled = p_enabled,
    triggered_at = NOW(),
    triggered_by = p_admin_id,
    reason = p_reason,
    updated_at = NOW()
  WHERE control_type = p_control_type;

  -- Log to audit
  INSERT INTO reconciliation_audit_log (
    action_type, target_type, target_id, performed_by,
    reason, status, documentation
  ) VALUES (
    'system_control', 'control', p_control_type, p_admin_id,
    COALESCE(p_reason, 'System control toggled'),
    'completed',
    format('Control %s set to %s', p_control_type, p_enabled)
  );

  RETURN json_build_object(
    'success', true,
    'control_type', p_control_type,
    'is_enabled', p_enabled
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 11. CHECK WITHDRAWAL ALLOWED
-- Circuit breaker check before withdrawals
-- ============================================
CREATE OR REPLACE FUNCTION check_withdrawal_allowed(
  p_user_id UUID,
  p_amount_cents INT
)
RETURNS JSON AS $$
DECLARE
  v_withdrawals_enabled BOOLEAN;
  v_daily_limit INT;
  v_circuit_breaker INT;
  v_user_daily_total INT;
  v_system_daily_total INT;
BEGIN
  -- Check if withdrawals are enabled
  SELECT is_enabled INTO v_withdrawals_enabled
  FROM system_controls WHERE control_type = 'withdrawals_enabled';

  IF NOT v_withdrawals_enabled THEN
    RETURN json_build_object('allowed', false, 'reason', 'Withdrawals are temporarily disabled');
  END IF;

  -- Get limits
  SELECT threshold_value INTO v_daily_limit
  FROM system_controls WHERE control_type = 'daily_withdrawal_limit';

  SELECT threshold_value INTO v_circuit_breaker
  FROM system_controls WHERE control_type = 'circuit_breaker_withdrawals';

  -- Check user daily total
  SELECT COALESCE(SUM(ABS(amount_cents)), 0) INTO v_user_daily_total
  FROM financial_transactions
  WHERE user_id = p_user_id
  AND type = 'withdrawal'
  AND status IN ('pending', 'processing', 'completed')
  AND created_at > NOW() - INTERVAL '24 hours';

  IF v_user_daily_total + p_amount_cents > v_daily_limit THEN
    RETURN json_build_object(
      'allowed', false, 
      'reason', 'Daily withdrawal limit exceeded',
      'daily_limit', v_daily_limit,
      'current_total', v_user_daily_total
    );
  END IF;

  -- Check system-wide circuit breaker
  SELECT COALESCE(SUM(ABS(amount_cents)), 0) INTO v_system_daily_total
  FROM financial_transactions
  WHERE type = 'withdrawal'
  AND status IN ('pending', 'processing', 'completed')
  AND created_at > NOW() - INTERVAL '24 hours';

  IF v_system_daily_total + p_amount_cents > v_circuit_breaker THEN
    -- Auto-disable withdrawals
    UPDATE system_controls
    SET is_enabled = false, triggered_at = NOW(), reason = 'Circuit breaker triggered'
    WHERE control_type = 'withdrawals_enabled';

    RETURN json_build_object(
      'allowed', false, 
      'reason', 'System circuit breaker triggered - withdrawals temporarily disabled',
      'circuit_breaker', v_circuit_breaker,
      'system_total', v_system_daily_total
    );
  END IF;

  RETURN json_build_object('allowed', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 12. FREEZE USER WALLET
-- ============================================
CREATE OR REPLACE FUNCTION freeze_user_wallet(
  p_user_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSON AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  UPDATE wallets
  SET 
    is_frozen = true,
    frozen_at = NOW(),
    frozen_by = p_admin_id,
    freeze_reason = p_reason,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log to audit
  INSERT INTO reconciliation_audit_log (
    action_type, target_type, target_id, user_id, performed_by,
    amount_cents, reason, status
  ) VALUES (
    'wallet_freeze', 'wallet', p_user_id::TEXT, p_user_id, p_admin_id,
    v_wallet.balance_cents, p_reason, 'completed'
  );

  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'balance_frozen', v_wallet.balance_cents
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 13. UNFREEZE USER WALLET
-- ============================================
CREATE OR REPLACE FUNCTION unfreeze_user_wallet(
  p_user_id UUID,
  p_admin_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF NOT v_wallet.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Wallet is not frozen');
  END IF;

  UPDATE wallets
  SET 
    is_frozen = false,
    frozen_at = NULL,
    frozen_by = NULL,
    freeze_reason = NULL,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log to audit
  INSERT INTO reconciliation_audit_log (
    action_type, target_type, target_id, user_id, performed_by,
    reason, status
  ) VALUES (
    'wallet_unfreeze', 'wallet', p_user_id::TEXT, p_user_id, p_admin_id,
    'Wallet unfrozen by admin', 'completed'
  );

  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- ADD WALLET FREEZE COLUMNS
-- ============================================
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS frozen_by UUID;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS freeze_reason TEXT;


-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION approve_withdrawal TO authenticated;
GRANT EXECUTE ON FUNCTION reject_withdrawal TO authenticated;
GRANT EXECUTE ON FUNCTION release_escrow TO authenticated;
GRANT EXECUTE ON FUNCTION process_payout TO authenticated;
GRANT EXECUTE ON FUNCTION process_all_pending_payouts TO authenticated;
GRANT EXECUTE ON FUNCTION void_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION run_daily_reconciliation TO authenticated;
GRANT EXECUTE ON FUNCTION check_risk_flags TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_system_control TO authenticated;
GRANT EXECUTE ON FUNCTION check_withdrawal_allowed TO authenticated;
GRANT EXECUTE ON FUNCTION freeze_user_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION unfreeze_user_wallet TO authenticated;
GRANT SELECT, UPDATE ON system_controls TO authenticated;
