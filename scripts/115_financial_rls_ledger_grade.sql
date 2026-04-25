-- ============================================================================
-- PHASE 3: FINANCIAL TABLES - LEDGER-GRADE RLS
-- ============================================================================
-- Based on critical decisions:
-- 1. Users should NOT see raw financial_transactions (permission-based only)
-- 2. Payouts are SYSTEM-TRIGGERED only (not user insertable)
-- 3. financial_transactions is LEDGER-GRADE (immutable, append-only)
-- ============================================================================

-- ============================================================================
-- PART A: financial_transactions - IMMUTABLE LEDGER
-- ============================================================================

-- Step 1: Ensure RLS is enabled
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop any existing permissive policies that might exist
DROP POLICY IF EXISTS "Users can view own transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Public access" ON financial_transactions;

-- Step 3: Service role ONLY access (workers, webhooks, reconciler)
-- No direct user access - they see derived views only
CREATE POLICY "Service role full access"
ON financial_transactions
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Step 4: Staff read-only access (support, disputes, audits)
CREATE POLICY "Staff can view transactions"
ON financial_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_roles
    WHERE staff_roles.user_id = auth.uid()
      AND staff_roles.role IN ('owner', 'manager', 'finance')
  )
);

-- Step 5: CRITICAL - Enforce immutability at DB level (append-only)
CREATE OR REPLACE FUNCTION prevent_financial_transaction_mutations()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'financial_transactions is append-only. Updates and deletes are prohibited.';
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS no_update_delete_financial_transactions ON financial_transactions;

-- Create trigger to prevent UPDATE and DELETE
CREATE TRIGGER no_update_delete_financial_transactions
BEFORE UPDATE OR DELETE ON financial_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_financial_transaction_mutations();

-- ============================================================================
-- PART B: payout_requests - SYSTEM-TRIGGERED ONLY
-- ============================================================================

-- Step 1: Ensure RLS is enabled
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop any existing permissive policies
DROP POLICY IF EXISTS "Users can create payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Public access" ON payout_requests;

-- Step 3: NO public insert - system creates payout requests only
CREATE POLICY "System can create payout requests"
ON payout_requests
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Step 4: Users can VIEW their own payout requests (read-only visibility)
CREATE POLICY "Users can view own payout requests"
ON payout_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Step 5: Staff can manage payout requests (approve, reject, process)
CREATE POLICY "Staff can manage payout requests"
ON payout_requests
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM staff_roles
    WHERE staff_roles.user_id = auth.uid()
      AND staff_roles.role IN ('owner', 'manager', 'finance')
  )
);

-- ============================================================================
-- PART C: platform_revenue - INFRASTRUCTURE TABLE
-- ============================================================================

ALTER TABLE platform_revenue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON platform_revenue;

-- Service role only for writes
CREATE POLICY "Service role manages platform revenue"
ON platform_revenue
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Staff read-only for reporting
CREATE POLICY "Staff can view platform revenue"
ON platform_revenue
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_roles
    WHERE staff_roles.user_id = auth.uid()
      AND staff_roles.role IN ('owner', 'manager', 'finance')
  )
);

-- ============================================================================
-- PART D: reconciliation_audit_log - APPEND-ONLY AUDIT
-- ============================================================================

ALTER TABLE reconciliation_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON reconciliation_audit_log;

-- Service role only for inserts
CREATE POLICY "Service role inserts reconciliation logs"
ON reconciliation_audit_log
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Staff read-only for audits
CREATE POLICY "Staff can view reconciliation logs"
ON reconciliation_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_roles
    WHERE staff_roles.user_id = auth.uid()
      AND staff_roles.role IN ('owner', 'manager', 'finance')
  )
);

-- Enforce append-only on reconciliation_audit_log
CREATE OR REPLACE FUNCTION prevent_reconciliation_audit_mutations()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'reconciliation_audit_log is append-only. Updates and deletes are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_update_delete_reconciliation_audit ON reconciliation_audit_log;

CREATE TRIGGER no_update_delete_reconciliation_audit
BEFORE UPDATE OR DELETE ON reconciliation_audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_reconciliation_audit_mutations();

-- ============================================================================
-- PART E: aml_transaction_logs - COMPLIANCE (APPEND-ONLY)
-- ============================================================================

ALTER TABLE aml_transaction_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON aml_transaction_logs;

-- Service role only
CREATE POLICY "Service role manages AML logs"
ON aml_transaction_logs
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Compliance staff only can read
CREATE POLICY "Compliance staff can view AML logs"
ON aml_transaction_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_roles
    WHERE staff_roles.user_id = auth.uid()
      AND staff_roles.role IN ('owner', 'compliance')
  )
);

-- Enforce append-only
CREATE OR REPLACE FUNCTION prevent_aml_log_mutations()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'aml_transaction_logs is append-only. Updates and deletes are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_update_delete_aml_logs ON aml_transaction_logs;

CREATE TRIGGER no_update_delete_aml_logs
BEFORE UPDATE OR DELETE ON aml_transaction_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_aml_log_mutations();

-- ============================================================================
-- PART F: creator_earnings - USER READABLE, SYSTEM WRITABLE
-- ============================================================================

ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON creator_earnings;

-- Users can view their own earnings
CREATE POLICY "Users can view own earnings"
ON creator_earnings
FOR SELECT
USING (auth.uid() = user_id);

-- Only service role can insert/update earnings
CREATE POLICY "Service role manages earnings"
ON creator_earnings
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Staff can view all earnings for support
CREATE POLICY "Staff can view all earnings"
ON creator_earnings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_roles
    WHERE staff_roles.user_id = auth.uid()
      AND staff_roles.role IN ('owner', 'manager', 'finance', 'support')
  )
);

-- ============================================================================
-- VERIFICATION QUERY (Run after migration to confirm)
-- ============================================================================
-- SELECT tablename, policyname, cmd, permissive
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'financial_transactions',
--     'payout_requests',
--     'platform_revenue',
--     'reconciliation_audit_log',
--     'aml_transaction_logs',
--     'creator_earnings'
--   )
-- ORDER BY tablename, cmd;
