-- ============================================
-- 128: Execute Payout Request Function
-- The ONLY place payouts actually execute
-- ============================================

-- Add missing columns if needed
ALTER TABLE payout_requests 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id),
ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS net_amount_cents BIGINT,
ADD COLUMN IF NOT EXISTS stripe_connected_account_id TEXT;

-- Backfill tenant_id from profiles
UPDATE payout_requests pr
SET tenant_id = p.tenant_id
FROM profiles p
WHERE pr.user_id = p.id AND pr.tenant_id IS NULL;

-- Backfill organizer_id (for tournament payouts, organizer = winner receiving payout)
UPDATE payout_requests pr
SET organizer_id = pr.user_id
WHERE pr.organizer_id IS NULL;

-- Backfill net_amount_cents (same as amount_cents if not set)
UPDATE payout_requests
SET net_amount_cents = amount_cents
WHERE net_amount_cents IS NULL;

-- Backfill stripe_connected_account_id from profiles
UPDATE payout_requests pr
SET stripe_connected_account_id = p.stripe_connect_account_id
FROM profiles p
WHERE pr.user_id = p.id AND pr.stripe_connected_account_id IS NULL;

-- Add 'approved' to status constraint if not present
ALTER TABLE payout_requests DROP CONSTRAINT IF EXISTS payout_requests_status_check;
ALTER TABLE payout_requests ADD CONSTRAINT payout_requests_status_check 
CHECK (status IN ('pending', 'approved', 'eligible', 'processing', 'completed', 'failed', 'blocked', 'canceled'));

-- ============================================
-- EXECUTE PAYOUT REQUEST
-- Single source of truth for payout execution
-- ============================================
CREATE OR REPLACE FUNCTION execute_payout_request(
  p_payout_request_id UUID,
  p_stripe_transfer_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_request RECORD;
  v_tenant_id UUID;
  v_entries JSONB;
  v_ledger_result JSON;
  v_tx_id UUID;
  v_escrow_account UUID;
  v_payout_clearing_account UUID;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();

  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service_role required';
  END IF;

  -- Lock payout request
  SELECT * INTO v_request
  FROM payout_requests
  WHERE id = p_payout_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout request not found');
  END IF;

  -- Already processed (idempotent)
  IF v_request.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'payout_request_id', v_request.id,
      'ledger_tx_id', v_request.ledger_tx_id
    );
  END IF;

  -- HOLD CHECK (CRITICAL)
  IF v_request.is_on_hold = TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payout is on hold',
      'hold_reason', v_request.hold_reason
    );
  END IF;

  -- Must be in valid state
  IF v_request.status NOT IN ('approved', 'eligible', 'processing') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid payout state: ' || v_request.status
    );
  END IF;

  -- Get tenant_id (from request or lookup)
  v_tenant_id := COALESCE(
    v_request.tenant_id,
    (SELECT tenant_id FROM profiles WHERE id = v_request.user_id),
    (SELECT id FROM tenants LIMIT 1)
  );

  -- Ledger Accounts
  v_escrow_account := get_or_create_ledger_account(
    v_tenant_id,
    'escrow',
    v_request.tournament_id,
    'Tournament Escrow'
  );

  v_payout_clearing_account := get_or_create_ledger_account(
    v_tenant_id,
    'payout_clearing',
    NULL,
    'Payout Clearing'
  );

  -- Ledger Movement: Escrow -> Payout Clearing
  v_entries := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_escrow_account,
      'direction', 'debit',
      'amount_cents', COALESCE(v_request.net_amount_cents, v_request.amount_cents)
    ),
    jsonb_build_object(
      'account_id', v_payout_clearing_account,
      'direction', 'credit',
      'amount_cents', COALESCE(v_request.net_amount_cents, v_request.amount_cents)
    )
  );

  v_ledger_result := post_ledger_transaction(
    v_tenant_id,
    'payout',
    v_entries,
    v_request.id,
    'payout_request',
    'Tournament payout: ' || COALESCE(v_request.tournament_id::text, 'unknown') || ' | User: ' || v_request.user_id::text || ' | Amount: $' || (COALESCE(v_request.net_amount_cents, v_request.amount_cents) / 100.0)::text,
    'payout_exec_' || v_request.id::text
  );

  IF v_ledger_result->>'success' != 'true' THEN
    UPDATE payout_requests
    SET status = 'failed',
        failure_reason = v_ledger_result->>'error',
        failure_count = failure_count + 1,
        last_failure_at = NOW(),
        updated_at = NOW()
    WHERE id = v_request.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ledger transaction failed: ' || (v_ledger_result->>'error')
    );
  END IF;

  v_tx_id := (v_ledger_result->>'transaction_id')::UUID;

  -- Finalize payout
  UPDATE payout_requests
  SET status = 'completed',
      stripe_transfer_id = COALESCE(p_stripe_transfer_id, stripe_transfer_id),
      ledger_tx_id = v_tx_id,
      processed_at = NOW(),
      updated_at = NOW()
  WHERE id = v_request.id;

  -- Audit log
  INSERT INTO audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    v_request.user_id,
    'payout_executed',
    'payout_request',
    v_request.id,
    jsonb_build_object(
      'amount_cents', COALESCE(v_request.net_amount_cents, v_request.amount_cents),
      'ledger_tx_id', v_tx_id,
      'stripe_transfer_id', p_stripe_transfer_id,
      'tournament_id', v_request.tournament_id,
      'placement', v_request.placement
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_request_id', v_request.id,
    'ledger_tx_id', v_tx_id,
    'amount_cents', COALESCE(v_request.net_amount_cents, v_request.amount_cents)
  );

EXCEPTION WHEN OTHERS THEN
  UPDATE payout_requests
  SET status = 'failed',
      failure_reason = SQLERRM,
      failure_count = failure_count + 1,
      last_failure_at = NOW(),
      updated_at = NOW()
  WHERE id = p_payout_request_id;

  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (NULL, 'payout_execution_error', 'payout_request', p_payout_request_id, 
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE));

  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
GRANT EXECUTE ON FUNCTION execute_payout_request(UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION execute_payout_request(UUID, TEXT) FROM PUBLIC;
