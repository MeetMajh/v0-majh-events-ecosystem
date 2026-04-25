-- MAJH DOUBLE-ENTRY LEDGER INTEGRATION
-- Wires financial_intents reconciliation into the ledger system
-- Tournament entry fees, escrow, platform fees, payouts

-- ══════════════════════════════════════════════════════════════════════════════
-- ACCOUNT TYPE CONSTANTS
-- ══════════════════════════════════════════════════════════════════════════════
-- platform_revenue    - MAJH platform fees
-- escrow             - Tournament prize pools (per tournament)
-- user_wallet        - User balances (future)
-- stripe_clearing    - Pending Stripe settlements
-- payout_clearing    - Pending payouts

-- ══════════════════════════════════════════════════════════════════════════════
-- TOURNAMENT ENTRY FEE LEDGER TRANSACTION
-- User pays entry → Escrow + Platform Fee
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ledger_tournament_entry(
  p_tenant_id UUID,
  p_user_id UUID,
  p_tournament_id UUID,
  p_amount_cents BIGINT,
  p_platform_fee_percent NUMERIC DEFAULT 10,
  p_stripe_session_id TEXT DEFAULT NULL,
  p_intent_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_clearing_account UUID;
  v_escrow_account UUID;
  v_platform_fee_account UUID;
  v_entries JSONB;
  v_platform_fee BIGINT;
  v_escrow_amount BIGINT;
  v_tournament RECORD;
  v_idempotency_key TEXT;
BEGIN
  -- Get tournament details
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;
  
  -- Calculate platform fee and escrow amount
  v_platform_fee := (p_amount_cents * p_platform_fee_percent) / 100;
  v_escrow_amount := p_amount_cents - v_platform_fee;
  
  -- Get or create accounts
  v_clearing_account := get_or_create_ledger_account(
    p_tenant_id, 'stripe_clearing', NULL, 'Stripe Clearing'
  );
  v_escrow_account := get_or_create_ledger_account(
    p_tenant_id, 'escrow', p_tournament_id, 'Tournament Escrow: ' || v_tournament.name
  );
  v_platform_fee_account := get_or_create_ledger_account(
    p_tenant_id, 'platform_revenue', NULL, 'Platform Revenue'
  );
  
  -- Double-entry bookkeeping:
  -- Debit: Stripe Clearing (asset increases - money coming in)
  -- Credit: Escrow (liability increases - we owe this to winners)
  -- Credit: Platform Revenue (revenue increases - our fee)
  v_entries := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_clearing_account,
      'direction', 'debit',
      'amount_cents', p_amount_cents
    ),
    jsonb_build_object(
      'account_id', v_escrow_account,
      'direction', 'credit',
      'amount_cents', v_escrow_amount
    ),
    jsonb_build_object(
      'account_id', v_platform_fee_account,
      'direction', 'credit',
      'amount_cents', v_platform_fee
    )
  );
  
  -- Generate idempotency key
  v_idempotency_key := COALESCE(
    'intent_' || p_intent_id::text,
    'tournament_entry_' || p_tournament_id::text || '_' || p_user_id::text || '_' || p_stripe_session_id
  );
  
  RETURN post_ledger_transaction(
    p_tenant_id,
    'deposit',
    v_entries,
    p_tournament_id,
    'tournament_entry',
    'Tournament entry: ' || v_tournament.name || ' by user ' || p_user_id::text,
    v_idempotency_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- TOURNAMENT PAYOUT LEDGER TRANSACTION
-- Escrow → User (prize distribution)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ledger_tournament_payout(
  p_tenant_id UUID,
  p_tournament_id UUID,
  p_user_id UUID,
  p_amount_cents BIGINT,
  p_placement INTEGER,
  p_payout_request_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_escrow_account UUID;
  v_payout_clearing_account UUID;
  v_entries JSONB;
  v_tournament RECORD;
  v_idempotency_key TEXT;
BEGIN
  -- Get tournament details
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;
  
  -- Get accounts
  v_escrow_account := get_or_create_ledger_account(
    p_tenant_id, 'escrow', p_tournament_id, 'Tournament Escrow: ' || v_tournament.name
  );
  v_payout_clearing_account := get_or_create_ledger_account(
    p_tenant_id, 'payout_clearing', NULL, 'Payout Clearing'
  );
  
  -- Double-entry:
  -- Debit: Escrow (liability decreases - we're paying out)
  -- Credit: Payout Clearing (pending transfer to user)
  v_entries := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_escrow_account,
      'direction', 'debit',
      'amount_cents', p_amount_cents
    ),
    jsonb_build_object(
      'account_id', v_payout_clearing_account,
      'direction', 'credit',
      'amount_cents', p_amount_cents
    )
  );
  
  v_idempotency_key := 'payout_' || COALESCE(p_payout_request_id::text, p_tournament_id::text || '_' || p_user_id::text || '_' || p_placement::text);
  
  RETURN post_ledger_transaction(
    p_tenant_id,
    'payout',
    v_entries,
    p_payout_request_id,
    'tournament_payout',
    'Tournament payout: ' || v_tournament.name || ' - Place #' || p_placement || ' to user ' || p_user_id::text,
    v_idempotency_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- PAYOUT COMPLETED (Stripe transfer confirmed)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ledger_payout_completed(
  p_tenant_id UUID,
  p_payout_request_id UUID,
  p_stripe_transfer_id TEXT
)
RETURNS JSON AS $$
DECLARE
  v_payout_clearing_account UUID;
  v_bank_account UUID;
  v_payout RECORD;
  v_entries JSONB;
BEGIN
  -- Get payout details
  SELECT * INTO v_payout FROM payout_requests WHERE id = p_payout_request_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Payout request not found');
  END IF;
  
  -- Get accounts
  v_payout_clearing_account := get_or_create_ledger_account(
    p_tenant_id, 'payout_clearing', NULL, 'Payout Clearing'
  );
  v_bank_account := get_or_create_ledger_account(
    p_tenant_id, 'bank_transfers', NULL, 'Bank Transfers (Stripe Connect)'
  );
  
  -- Double-entry:
  -- Debit: Payout Clearing (clearing the pending payout)
  -- Credit: Bank Transfers (money left the system)
  v_entries := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_payout_clearing_account,
      'direction', 'debit',
      'amount_cents', v_payout.amount_cents
    ),
    jsonb_build_object(
      'account_id', v_bank_account,
      'direction', 'credit',
      'amount_cents', v_payout.amount_cents
    )
  );
  
  RETURN post_ledger_transaction(
    p_tenant_id,
    'transfer',
    v_entries,
    p_payout_request_id,
    'payout_transfer',
    'Stripe transfer completed: ' || p_stripe_transfer_id,
    'transfer_' || p_stripe_transfer_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- UPDATED RECONCILE FUNCTION - Now creates ledger entries
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION reconcile_financial_intent(
  p_stripe_session_id TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'succeeded',
  p_stripe_charge_id TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE 
  v_intent RECORD;
  v_ledger_result JSON;
  v_ledger_tx_id UUID;
  v_caller_role TEXT;
  v_tenant_id UUID;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Reconciliation requires service_role';
  END IF;

  -- Find the intent with row lock
  SELECT * INTO v_intent FROM financial_intents
  WHERE (
    (p_stripe_session_id IS NOT NULL AND stripe_checkout_session_id = p_stripe_session_id) 
    OR (p_stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = p_stripe_payment_intent_id)
  )
  AND reconciled = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending intent found', 'skip', true);
  END IF;

  -- Already reconciled (idempotent)
  IF v_intent.reconciled THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'intent_id', v_intent.id);
  END IF;

  -- Update intent status
  UPDATE financial_intents
  SET status = p_status,
      stripe_charge_id = COALESCE(p_stripe_charge_id, stripe_charge_id),
      error_code = p_error_code,
      error_message = p_error_message,
      reconciled = (p_status = 'succeeded'),
      reconciled_at = CASE WHEN p_status = 'succeeded' THEN NOW() ELSE NULL END,
      failure_count = CASE WHEN p_status = 'failed' THEN failure_count + 1 ELSE failure_count END,
      last_failure_at = CASE WHEN p_status = 'failed' THEN NOW() ELSE last_failure_at END,
      updated_at = NOW()
  WHERE id = v_intent.id;

  -- On success, create ledger entries
  IF p_status = 'succeeded' THEN
    -- Get tenant_id (use from intent or default)
    v_tenant_id := COALESCE(v_intent.tenant_id, (SELECT id FROM tenants LIMIT 1));
    
    -- Route to appropriate ledger function based on intent type
    CASE v_intent.intent_type
      WHEN 'tournament_entry' THEN
        v_ledger_result := ledger_tournament_entry(
          v_tenant_id,
          v_intent.user_id,
          v_intent.reference_id,
          v_intent.amount_cents,
          10, -- 10% platform fee
          p_stripe_session_id,
          v_intent.id
        );
        
      WHEN 'ticket_purchase' THEN
        v_ledger_result := ledger_ticket_sale(
          v_tenant_id,
          v_intent.reference_id,
          v_intent.amount_cents,
          p_stripe_session_id,
          'intent_' || v_intent.id::text
        );
        
      WHEN 'wallet_deposit' THEN
        -- Future: user wallet deposits
        v_ledger_result := json_build_object('success', true, 'note', 'wallet_deposit_not_implemented');
        
      ELSE
        -- Generic financial transaction (fallback)
        INSERT INTO financial_transactions (
          user_id, amount_cents, type, status, description,
          reference_type, reference_id, stripe_session_id, stripe_payment_intent
        ) VALUES (
          v_intent.user_id, v_intent.amount_cents, v_intent.intent_type, 'completed',
          'Payment via Stripe', v_intent.reference_type, v_intent.reference_id,
          p_stripe_session_id, p_stripe_payment_intent_id
        );
        v_ledger_result := json_build_object('success', true, 'fallback', true);
    END CASE;
    
    -- Extract ledger transaction ID if available
    IF v_ledger_result->>'success' = 'true' AND v_ledger_result->>'transaction_id' IS NOT NULL THEN
      v_ledger_tx_id := (v_ledger_result->>'transaction_id')::UUID;
      UPDATE financial_intents SET ledger_entry_id = v_ledger_tx_id WHERE id = v_intent.id;
    END IF;
  END IF;

  -- Audit log
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_intent.user_id,
    CASE 
      WHEN p_status = 'succeeded' THEN 'financial_intent_succeeded'
      WHEN p_status = 'failed' THEN 'financial_intent_failed'
      ELSE 'financial_intent_status_changed'
    END,
    'financial_intent',
    v_intent.id,
    jsonb_build_object(
      'status', p_status,
      'stripe_session_id', p_stripe_session_id,
      'ledger_result', v_ledger_result,
      'intent_type', v_intent.intent_type
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'intent_id', v_intent.id,
    'status', p_status,
    'ledger_tx_id', v_ledger_tx_id,
    'ledger_result', v_ledger_result
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail silently
  INSERT INTO audit_log (user_id, action, resource_type, metadata)
  VALUES (NULL, 'financial_intent_reconcile_error', 'financial_intent',
    jsonb_build_object('stripe_session_id', p_stripe_session_id, 'error', SQLERRM));
  
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- IMMUTABILITY TRIGGERS ON LEDGER TABLES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_ledger_mutations()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable. Updates and deletes are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_update_delete_ledger_entries ON ledger_entries;
CREATE TRIGGER no_update_delete_ledger_entries
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_mutations();

DROP TRIGGER IF EXISTS no_update_delete_ledger_transactions ON ledger_transactions;
CREATE TRIGGER no_update_delete_ledger_transactions
BEFORE UPDATE OR DELETE ON ledger_transactions
FOR EACH ROW
WHEN (OLD.status = 'posted')
EXECUTE FUNCTION prevent_ledger_mutations();

-- ══════════════════════════════════════════════════════════════════════════════
-- ESCROW BALANCE QUERY
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_tournament_escrow_balance(
  p_tenant_id UUID,
  p_tournament_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_escrow_account UUID;
  v_balance BIGINT;
  v_entries_count INT;
BEGIN
  -- Find the escrow account
  SELECT id INTO v_escrow_account
  FROM ledger_accounts
  WHERE tenant_id = p_tenant_id
    AND account_type = 'escrow'
    AND reference_id = p_tournament_id;
  
  IF v_escrow_account IS NULL THEN
    RETURN json_build_object(
      'tournament_id', p_tournament_id,
      'balance_cents', 0,
      'entries_count', 0,
      'account_exists', false
    );
  END IF;
  
  -- Calculate balance (credits - debits)
  SELECT 
    COALESCE(SUM(
      CASE WHEN direction = 'credit' THEN amount_cents ELSE -amount_cents END
    ), 0),
    COUNT(*)
  INTO v_balance, v_entries_count
  FROM ledger_entries le
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE le.account_id = v_escrow_account
    AND lt.status = 'posted';
  
  RETURN json_build_object(
    'tournament_id', p_tournament_id,
    'balance_cents', v_balance,
    'entries_count', v_entries_count,
    'account_exists', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- PLATFORM REVENUE SUMMARY
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_platform_revenue_summary(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total_revenue BIGINT;
  v_tournament_fees BIGINT;
  v_ticket_fees BIGINT;
  v_pending_payouts BIGINT;
BEGIN
  -- Total platform revenue
  SELECT COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_cents ELSE -le.amount_cents END
  ), 0) INTO v_total_revenue
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'platform_revenue'
    AND lt.status = 'posted';
  
  -- Tournament fees specifically
  SELECT COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_cents ELSE -le.amount_cents END
  ), 0) INTO v_tournament_fees
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'platform_revenue'
    AND lt.reference_type = 'tournament_entry'
    AND lt.status = 'posted';
  
  -- Ticket fees
  SELECT COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_cents ELSE -le.amount_cents END
  ), 0) INTO v_ticket_fees
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'platform_revenue'
    AND lt.reference_type = 'ticket_order'
    AND lt.status = 'posted';
  
  -- Pending payouts
  SELECT COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_cents ELSE -le.amount_cents END
  ), 0) INTO v_pending_payouts
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'payout_clearing'
    AND lt.status = 'posted';
  
  RETURN json_build_object(
    'total_revenue_cents', v_total_revenue,
    'tournament_fees_cents', v_tournament_fees,
    'ticket_fees_cents', v_ticket_fees,
    'pending_payouts_cents', v_pending_payouts,
    'net_position_cents', v_total_revenue - v_pending_payouts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ══════════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION ledger_tournament_entry(UUID, UUID, UUID, BIGINT, NUMERIC, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION ledger_tournament_payout(UUID, UUID, UUID, BIGINT, INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION ledger_payout_completed(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_tournament_escrow_balance(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_revenue_summary(UUID) TO authenticated;
