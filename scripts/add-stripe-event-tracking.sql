-- Add stripe_event_id for idempotency and reconciliation
-- This column tracks the Stripe webhook event ID that created each transaction
-- The unique constraint prevents duplicate credits from webhook retries

-- Add the column if it doesn't exist
ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;

-- Add unique constraint (allows NULL for non-Stripe transactions)
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_stripe_event_id 
ON financial_transactions (stripe_event_id) 
WHERE stripe_event_id IS NOT NULL;

-- Add index for faster reconciliation queries
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type_status_created 
ON financial_transactions (type, status, created_at);

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'financial_transactions' 
AND column_name = 'stripe_event_id';
