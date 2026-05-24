-- Add Stripe-related columns to financial_transactions table
-- for idempotency and tracking

-- Add columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financial_transactions' AND column_name = 'stripe_session_id'
  ) THEN
    ALTER TABLE financial_transactions ADD COLUMN stripe_session_id TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financial_transactions' AND column_name = 'stripe_payment_intent'
  ) THEN
    ALTER TABLE financial_transactions ADD COLUMN stripe_payment_intent TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financial_transactions' AND column_name = 'stripe_transfer_id'
  ) THEN
    ALTER TABLE financial_transactions ADD COLUMN stripe_transfer_id TEXT;
  END IF;
END $$;

-- Create index for idempotency checks
CREATE INDEX IF NOT EXISTS idx_financial_transactions_stripe_session 
ON financial_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
