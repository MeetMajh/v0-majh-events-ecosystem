-- =====================================================
-- RECONCILIATION AUDIT SYSTEM
-- Tracks all financial corrections with full audit trail
-- =====================================================

-- 1. Audit log for all reconciliation actions
CREATE TABLE IF NOT EXISTS reconciliation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'void', 'reversal', 'recovery', 'dismiss', 'wallet_sync', 'manual_credit'
  )),
  target_type TEXT NOT NULL CHECK (target_type IN (
    'transaction', 'wallet', 'escrow', 'stripe_session'
  )),
  target_id TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id),  -- The user whose account was affected
  performed_by UUID NOT NULL REFERENCES profiles(id),  -- Admin who performed action
  
  -- Financial details
  amount_cents INT,
  previous_balance_cents INT,
  new_balance_cents INT,
  
  -- Documentation (required for accounting)
  reason TEXT NOT NULL,
  documentation TEXT,  -- Extended notes/justification
  
  -- Test vs Live tracking
  is_test_data BOOLEAN DEFAULT FALSE,
  environment TEXT DEFAULT 'live' CHECK (environment IN ('test', 'live', 'unknown')),
  
  -- Idempotency
  idempotency_key TEXT UNIQUE,  -- Prevents duplicate operations
  
  -- Status tracking
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Reference to related records
  related_transaction_id UUID,
  stripe_session_id TEXT,
  stripe_event_id TEXT
);

-- 2. Add is_test flag to financial_transactions
ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'live' CHECK (environment IN ('test', 'live', 'unknown')),
ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dismissed_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS dismiss_reason TEXT;

-- 3. Add is_test flag to escrow_accounts
ALTER TABLE escrow_accounts 
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'live' CHECK (environment IN ('test', 'live', 'unknown')),
ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dismissed_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS dismiss_reason TEXT;

-- 4. Add recovery tracking to financial_transactions
ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS recovered_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS recovery_source TEXT;  -- 'stripe_reconciliation', 'manual', etc.

-- 5. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON reconciliation_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON reconciliation_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_by ON reconciliation_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON reconciliation_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_idempotency ON reconciliation_audit_log(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_is_test ON financial_transactions(is_test) WHERE is_test = TRUE;
CREATE INDEX IF NOT EXISTS idx_transactions_dismissed ON financial_transactions(dismissed_at) WHERE dismissed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_escrow_is_test ON escrow_accounts(is_test) WHERE is_test = TRUE;

-- 6. View for easy audit reporting
CREATE OR REPLACE VIEW v_reconciliation_audit_summary AS
SELECT 
  ral.id,
  ral.action_type,
  ral.target_type,
  ral.amount_cents,
  ral.reason,
  ral.is_test_data,
  ral.environment,
  ral.status,
  ral.created_at,
  p_affected.email as affected_user_email,
  p_admin.email as performed_by_email
FROM reconciliation_audit_log ral
LEFT JOIN profiles p_affected ON ral.user_id = p_affected.id
LEFT JOIN profiles p_admin ON ral.performed_by = p_admin.id
ORDER BY ral.created_at DESC;

-- 7. Function to check idempotency before reconciliation action
CREATE OR REPLACE FUNCTION check_reconciliation_idempotency(p_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM reconciliation_audit_log 
    WHERE idempotency_key = p_key 
    AND status = 'completed'
  );
END;
$$ LANGUAGE plpgsql;

-- 8. Grant permissions
GRANT SELECT, INSERT ON reconciliation_audit_log TO authenticated;
GRANT SELECT ON v_reconciliation_audit_summary TO authenticated;
