-- =============================================================================
-- FINANCIAL SAFEGUARDS AND REVERSALS
-- Comprehensive constraints, reversal system, and audit infrastructure
-- =============================================================================

-- ============================================
-- 1. STRIPE IDEMPOTENCY CONSTRAINT
-- Prevents duplicate Stripe session processing
-- ============================================

-- Add unique constraint on stripe_session_id (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_stripe_session_unique 
ON financial_transactions (stripe_session_id) 
WHERE stripe_session_id IS NOT NULL AND status != 'voided';

-- ============================================
-- 2. TEST/LIVE ENVIRONMENT TRACKING
-- ============================================

-- Add environment column to track test vs live
ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'live' 
CHECK (environment IN ('test', 'live', 'unknown'));

-- Auto-detect environment from stripe_session_id
CREATE OR REPLACE FUNCTION detect_stripe_environment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stripe_session_id IS NOT NULL THEN
    IF NEW.stripe_session_id LIKE 'cs_test_%' THEN
      NEW.environment := 'test';
      NEW.is_test := true;
    ELSIF NEW.stripe_session_id LIKE 'cs_live_%' THEN
      NEW.environment := 'live';
      NEW.is_test := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_detect_stripe_environment ON financial_transactions;
CREATE TRIGGER tr_detect_stripe_environment
  BEFORE INSERT OR UPDATE ON financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION detect_stripe_environment();

-- ============================================
-- 3. REVERSAL TRANSACTION TYPE
-- ============================================

-- Add reversal tracking columns
ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS reversal_of UUID REFERENCES financial_transactions(id);

ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES financial_transactions(id);

ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

-- Index for fast reversal lookups
CREATE INDEX IF NOT EXISTS idx_transactions_reversal_of 
ON financial_transactions (reversal_of) WHERE reversal_of IS NOT NULL;

-- ============================================
-- 4. REVERSAL RPC FUNCTION
-- Atomic reversal with wallet adjustment
-- ============================================

CREATE OR REPLACE FUNCTION perform_reversal(
  p_transaction_id UUID,
  p_reason TEXT,
  p_admin_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_original RECORD;
  v_reversal_id UUID;
  v_new_balance INT;
  v_result JSON;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_reversal_id 
    FROM financial_transactions 
    WHERE metadata->>'idempotency_key' = p_idempotency_key;
    
    IF v_reversal_id IS NOT NULL THEN
      RETURN json_build_object(
        'success', true,
        'already_processed', true,
        'reversal_id', v_reversal_id,
        'message', 'Reversal already processed'
      );
    END IF;
  END IF;

  -- Lock and fetch original transaction
  SELECT * INTO v_original 
  FROM financial_transactions 
  WHERE id = p_transaction_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;
  
  -- Check if already reversed
  IF v_original.reversed_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Transaction already reversed');
  END IF;
  
  -- Check if this is itself a reversal (can't reverse a reversal)
  IF v_original.reversal_of IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cannot reverse a reversal transaction');
  END IF;
  
  -- Create reversal transaction
  INSERT INTO financial_transactions (
    user_id,
    type,
    amount_cents,
    status,
    description,
    reversal_of,
    reversal_reason,
    is_test,
    environment,
    metadata
  ) VALUES (
    v_original.user_id,
    'reversal',
    -v_original.amount_cents,
    'completed',
    'Reversal: ' || COALESCE(p_reason, 'Administrative reversal'),
    p_transaction_id,
    p_reason,
    v_original.is_test,
    v_original.environment,
    jsonb_build_object(
      'original_transaction_id', p_transaction_id,
      'original_type', v_original.type,
      'original_amount', v_original.amount_cents,
      'reversed_by_admin', p_admin_id,
      'idempotency_key', p_idempotency_key
    )
  )
  RETURNING id INTO v_reversal_id;
  
  -- Mark original as reversed
  UPDATE financial_transactions 
  SET 
    reversed_by = v_reversal_id,
    reversed_at = NOW(),
    reversal_reason = p_reason
  WHERE id = p_transaction_id;
  
  -- Adjust wallet balance (subtract the original amount)
  UPDATE wallets 
  SET 
    balance_cents = balance_cents - v_original.amount_cents,
    updated_at = NOW()
  WHERE user_id = v_original.user_id
  RETURNING balance_cents INTO v_new_balance;
  
  -- Log to audit
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
    related_transaction_id
  ) VALUES (
    'reversal',
    'transaction',
    p_transaction_id::TEXT,
    v_original.user_id,
    p_admin_id,
    v_original.amount_cents,
    v_new_balance + v_original.amount_cents,
    v_new_balance,
    p_reason,
    format('Reversed transaction %s (%s) of %s cents. New wallet balance: %s cents.',
      p_transaction_id, v_original.type, v_original.amount_cents, v_new_balance),
    v_original.is_test,
    v_original.environment,
    p_idempotency_key,
    'completed',
    v_reversal_id
  );
  
  RETURN json_build_object(
    'success', true,
    'reversal_id', v_reversal_id,
    'original_amount', v_original.amount_cents,
    'new_balance', v_new_balance,
    'user_id', v_original.user_id
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log failed attempt
  INSERT INTO reconciliation_audit_log (
    action_type, target_type, target_id, performed_by,
    reason, status, error_message
  ) VALUES (
    'reversal', 'transaction', p_transaction_id::TEXT, p_admin_id,
    p_reason, 'failed', SQLERRM
  );
  
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. FINANCIAL HEALTH SUMMARY VIEW
-- ============================================

CREATE OR REPLACE VIEW financial_health_summary AS
SELECT
  -- Live totals
  COALESCE(SUM(CASE WHEN environment = 'live' AND type = 'deposit' AND status = 'completed' THEN amount_cents ELSE 0 END), 0) as live_deposits,
  COALESCE(SUM(CASE WHEN environment = 'live' AND type = 'withdrawal' AND status = 'completed' THEN amount_cents ELSE 0 END), 0) as live_withdrawals,
  COALESCE(SUM(CASE WHEN environment = 'live' AND type = 'reversal' AND status = 'completed' THEN amount_cents ELSE 0 END), 0) as live_reversals,
  
  -- Test totals
  COALESCE(SUM(CASE WHEN environment = 'test' AND type = 'deposit' AND status = 'completed' THEN amount_cents ELSE 0 END), 0) as test_deposits,
  COALESCE(SUM(CASE WHEN environment = 'test' AND type = 'withdrawal' AND status = 'completed' THEN amount_cents ELSE 0 END), 0) as test_withdrawals,
  
  -- Voided/dismissed
  COALESCE(SUM(CASE WHEN status = 'voided' THEN amount_cents ELSE 0 END), 0) as voided_total,
  
  -- Counts
  COUNT(*) FILTER (WHERE environment = 'live' AND status = 'completed') as live_transaction_count,
  COUNT(*) FILTER (WHERE environment = 'test') as test_transaction_count,
  COUNT(*) FILTER (WHERE status = 'voided') as voided_count,
  COUNT(*) FILTER (WHERE reversed_at IS NOT NULL) as reversed_count,
  
  -- Unreconciled (missing stripe data or environment unknown)
  COUNT(*) FILTER (WHERE environment = 'unknown' OR (type = 'deposit' AND stripe_session_id IS NULL)) as unreconciled_count
  
FROM financial_transactions;

-- ============================================
-- 6. PREVENT DOUBLE PROCESSING FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION check_stripe_idempotency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stripe_session_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM financial_transactions 
      WHERE stripe_session_id = NEW.stripe_session_id 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND status != 'voided'
    ) THEN
      RAISE EXCEPTION 'Stripe session % already processed', NEW.stripe_session_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_stripe_idempotency ON financial_transactions;
CREATE TRIGGER tr_check_stripe_idempotency
  BEFORE INSERT ON financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_stripe_idempotency();

-- ============================================
-- 7. AUDIT LOG INTEGRITY
-- ============================================

-- Prevent modification of audit logs
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_prevent_audit_update ON reconciliation_audit_log;
CREATE TRIGGER tr_prevent_audit_update
  BEFORE UPDATE OR DELETE ON reconciliation_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION perform_reversal TO authenticated;
GRANT SELECT ON financial_health_summary TO authenticated;
