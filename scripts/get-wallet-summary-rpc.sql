-- Get Wallet Summary RPC Function
-- Returns consolidated balance information from the double-entry ledger

DROP FUNCTION IF EXISTS get_wallet_summary(UUID);

CREATE OR REPLACE FUNCTION get_wallet_summary(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
  v_available BIGINT := 0;
  v_pending BIGINT := 0;
  v_escrow BIGINT := 0;
  v_total BIGINT := 0;
BEGIN
  -- Get available balance (user wallets)
  SELECT COALESCE(SUM(balance_cents), 0)
  INTO v_available
  FROM ledger_balances
  WHERE tenant_id = p_tenant_id
    AND account_type = 'user_wallet';

  -- Get pending withdrawals
  SELECT COALESCE(SUM(balance_cents), 0)
  INTO v_pending
  FROM ledger_balances
  WHERE tenant_id = p_tenant_id
    AND account_type = 'pending_withdrawals';

  -- Get escrow locked
  SELECT COALESCE(SUM(balance_cents), 0)
  INTO v_escrow
  FROM ledger_balances
  WHERE tenant_id = p_tenant_id
    AND account_type = 'escrow';

  v_total := v_available + v_pending + v_escrow;

  RETURN json_build_object(
    'balance', v_total,
    'available', v_available,
    'pending', v_pending,
    'escrow', v_escrow,
    'currency', 'usd'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_wallet_summary(UUID) TO authenticated;
