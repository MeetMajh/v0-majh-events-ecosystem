-- =====================================================
-- RECONCILIATION AUDIT SYSTEM
-- Tracks all financial corrections with full audit trail
-- =====================================================

-- 1. Audit log for all reconciliation actions
CREATE TABLE IF NOT EXISTS reconciliation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  user_id UUID,
  performed_by UUID NOT NULL,
  
  -- Financial details
  amount_cents INT,
  previous_balance_cents INT,
  new_balance_cents INT,
  
  -- Documentation (required for accounting)
  reason TEXT NOT NULL,
  documentation TEXT,
  
  -- Test vs Live tracking
  is_test_data BOOLEAN DEFAULT FALSE,
  environment TEXT DEFAULT 'live',
  
  -- Idempotency
  idempotency_key TEXT UNIQUE,
  
  -- Status tracking
  status TEXT DEFAULT 'completed',
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Reference to related records
  related_transaction_id UUID,
  stripe_session_id TEXT,
  stripe_event_id TEXT
);

-- 2. Add is_test flag to financial_transactions (each column separately)
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'live';
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS dismissed_by UUID;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS dismiss_reason TEXT;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS recovered_by UUID;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS recovery_source TEXT;

-- 3. Add is_test flag to escrow_accounts (each column separately)
ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'live';
ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS dismissed_by UUID;
ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS dismiss_reason TEXT;

-- 4. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON reconciliation_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON reconciliation_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_by ON reconciliation_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON reconciliation_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_idempotency ON reconciliation_audit_log(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_transactions_is_test ON financial_transactions(is_test);
CREATE INDEX IF NOT EXISTS idx_transactions_dismissed ON financial_transactions(dismissed_at);
CREATE INDEX IF NOT EXISTS idx_escrow_is_test ON escrow_accounts(is_test);

-- 5. Grant permissions  
GRANT SELECT, INSERT ON reconciliation_audit_log TO authenticated;
