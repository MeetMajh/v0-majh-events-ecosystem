-- Reconciliation Audit Log
-- Tracks all reconciliation actions to prevent duplicates and provide audit trail

CREATE TABLE IF NOT EXISTS reconciliation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was reconciled
  reference_type TEXT NOT NULL CHECK (reference_type IN (
    'stripe_session',      -- Missing Stripe payment recovered
    'transaction_void',    -- Transaction voided
    'transaction_reversal', -- Transaction reversed
    'wallet_rebalance',    -- Wallet balance corrected
    'escrow_adjustment',   -- Escrow account adjusted
    'test_data_dismissed'  -- Test data acknowledged and dismissed
  )),
  reference_id TEXT NOT NULL,           -- ID of the affected record (stripe_session_id, transaction_id, etc.)
  
  -- Action details
  action TEXT NOT NULL CHECK (action IN (
    'recovered',           -- Missing record created
    'voided',              -- Marked as invalid
    'reversed',            -- Created offsetting entry
    'rebalanced',          -- Balance corrected
    'dismissed',           -- Test data acknowledged
    'adjusted'             -- General adjustment
  )),
  
  -- Environment tracking
  is_test_mode BOOLEAN NOT NULL DEFAULT false,  -- Was this test/sandbox data?
  environment TEXT CHECK (environment IN ('test', 'live', 'unknown')),
  
  -- Financial impact
  amount_cents INTEGER,                  -- Amount involved (if applicable)
  previous_value TEXT,                   -- Previous state (JSON or simple value)
  new_value TEXT,                        -- New state (JSON or simple value)
  net_impact_cents INTEGER DEFAULT 0,   -- Net change to platform finances
  
  -- Affected entities
  affected_user_id UUID REFERENCES profiles(id),
  affected_wallet_id UUID,
  affected_transaction_id UUID,
  
  -- Audit trail
  reason TEXT NOT NULL,                  -- Why this action was taken
  performed_by UUID NOT NULL REFERENCES profiles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicates
  idempotency_key TEXT UNIQUE,           -- Unique key to prevent duplicate actions
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,    -- Extra context (stripe data, error info, etc.)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_reference 
ON reconciliation_audit_log (reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_user 
ON reconciliation_audit_log (affected_user_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_date 
ON reconciliation_audit_log (performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_environment 
ON reconciliation_audit_log (environment, is_test_mode);

-- Comments for documentation
COMMENT ON TABLE reconciliation_audit_log IS 'Audit trail for all reconciliation actions - prevents duplicates and provides accounting documentation';
COMMENT ON COLUMN reconciliation_audit_log.is_test_mode IS 'True if this involves test/sandbox data (not real money)';
COMMENT ON COLUMN reconciliation_audit_log.idempotency_key IS 'Unique key to prevent the same action being performed twice';
COMMENT ON COLUMN reconciliation_audit_log.net_impact_cents IS 'Net financial impact - positive = money in, negative = money out, 0 = neutral';

-- Add is_test_mode column to financial_transactions if not exists
ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS is_test_mode BOOLEAN DEFAULT false;

ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS environment TEXT CHECK (environment IN ('test', 'live', 'unknown'));

-- Add is_test_mode to escrow_accounts
ALTER TABLE escrow_accounts 
ADD COLUMN IF NOT EXISTS is_test_mode BOOLEAN DEFAULT false;

-- Create view for reconciliation summary (useful for dashboards)
CREATE OR REPLACE VIEW reconciliation_summary AS
SELECT 
  reference_type,
  action,
  environment,
  COUNT(*) as action_count,
  SUM(CASE WHEN is_test_mode THEN 1 ELSE 0 END) as test_count,
  SUM(CASE WHEN NOT is_test_mode THEN 1 ELSE 0 END) as live_count,
  SUM(amount_cents) as total_amount_cents,
  SUM(net_impact_cents) as total_net_impact_cents,
  MIN(performed_at) as first_action,
  MAX(performed_at) as last_action
FROM reconciliation_audit_log
GROUP BY reference_type, action, environment;
