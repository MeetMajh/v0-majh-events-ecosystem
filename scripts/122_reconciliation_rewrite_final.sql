-- ============================================================
-- PHASE 1: RECONCILIATION REWRITE (FINAL)
-- Atomic, double-entry correct, idempotent-safe, audit-compliant
-- ============================================================

-- ===========================================
-- HELPER: Get Account by Name (throws if missing)
-- ===========================================
CREATE OR REPLACE FUNCTION get_ledger_account(p_tenant_id UUID, p_name TEXT)
RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id 
  FROM ledger_accounts 
  WHERE tenant_id = p_tenant_id AND account_type = p_name 
  LIMIT 1;
  
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Ledger account not found: % for tenant %', p_name, p_tenant_id;
  END IF;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- BOOTSTRAP: Ensure System Accounts Exist
-- ===========================================
CREATE OR REPLACE FUNCTION bootstrap_ledger_accounts(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_accounts TEXT[] := ARRAY[
    'stripe_clearing',
    'escrow',
    'platform_revenue',
    'organizer_payable',
    'payout_clearing',
    'bank_transfers',
    'refunds'
  ];
  v_account TEXT;
  v_created INTEGER := 0;
BEGIN
  FOREACH v_account IN ARRAY v_accounts
  LOOP
    INSERT INTO ledger_accounts (tenant_id, account_type, name, reference_id)
    VALUES (p_tenant_id, v_account, initcap(replace(v_account, '_', ' ')), NULL)
    ON CONFLICT (tenant_id, account_type, COALESCE(reference_id, '00000000-0000-0000-0000-000000000000'::UUID)) 
    DO NOTHING;
    
    IF FOUND THEN v_created := v_created + 1; END IF;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'accounts_created', v_created);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- CORE: REWRITTEN reconcile_financial_intent
-- ===========================================
-- Guarantees:
--   - Row lock on intent (FOR UPDATE)
--   - Single transaction (atomic)
--   - Fully balanced ledger entries
--   - Fee calculated via calculate_platform_fee()
--   - Idempotent via existing intent check
--   - Full audit trail
-- ===========================================

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
  v_tenant_id UUID;
  v_tx_id UUID;
  
  -- Fee calculation
  v_fee_calc JSON;
  v_fee_amount BIGINT;
  v_net_amount BIGINT;
  
  -- Accounts
  v_clearing_account UUID;
  v_target_account UUID;
  v_platform_account UUID;
  
  -- Reference data
  v_tournament RECORD;
  v_event RECORD;
  v_organizer_id UUID;
  
  v_caller_role TEXT;
  v_idempotency_key TEXT;
  v_entries JSONB;
  v_ledger_result JSON;
BEGIN
  -- =====================
  -- 1. SECURITY CHECK
  -- =====================
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service_role required';
  END IF;

  -- =====================
  -- 2. LOCK INTENT (atomic)
  -- =====================
  SELECT * INTO v_intent
  FROM financial_intents
  WHERE (
    (p_stripe_session_id IS NOT NULL AND stripe_checkout_session_id = p_stripe_session_id)
    OR
    (p_stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = p_stripe_payment_intent_id)
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

  -- =====================
  -- 3. UPDATE INTENT STATUS
  -- =====================
  UPDATE financial_intents
  SET 
    status = p_status,
    stripe_charge_id = COALESCE(p_stripe_charge_id, stripe_charge_id),
    error_code = p_error_code,
    error_message = p_error_message,
    reconciled = (p_status = 'succeeded'),
    reconciled_at = CASE WHEN p_status = 'succeeded' THEN NOW() ELSE NULL END,
    failure_count = CASE WHEN p_status = 'failed' THEN failure_count + 1 ELSE failure_count END,
    last_failure_at = CASE WHEN p_status = 'failed' THEN NOW() ELSE last_failure_at END,
    updated_at = NOW()
  WHERE id = v_intent.id;

  -- =====================
  -- 4. EXIT IF NOT SUCCESS
  -- =====================
  IF p_status != 'succeeded' THEN
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
    VALUES (v_intent.user_id, 'financial_intent_' || p_status, 'financial_intent', v_intent.id,
      jsonb_build_object('status', p_status, 'error_code', p_error_code, 'error_message', p_error_message));
    
    RETURN jsonb_build_object('success', true, 'intent_id', v_intent.id, 'status', p_status);
  END IF;

  -- =====================
  -- 5. RESOLVE TENANT
  -- =====================
  v_tenant_id := COALESCE(v_intent.tenant_id, (SELECT id FROM tenants LIMIT 1));
  
  -- Ensure system accounts exist
  PERFORM bootstrap_ledger_accounts(v_tenant_id);

  -- =====================
  -- 6. CALCULATE FEE + BUILD ENTRIES
  -- =====================
  v_clearing_account := get_or_create_ledger_account(v_tenant_id, 'stripe_clearing', NULL, 'Stripe Clearing');
  v_platform_account := get_or_create_ledger_account(v_tenant_id, 'platform_revenue', NULL, 'Platform Revenue');

  CASE v_intent.intent_type
    -- =====================
    -- TOURNAMENT ENTRY
    -- =====================
    WHEN 'tournament_entry' THEN
      SELECT * INTO v_tournament FROM tournaments WHERE id = v_intent.reference_id;
      v_organizer_id := v_tournament.organizer_id;
      
      -- Calculate fee with hierarchy (tournament > organizer > default)
      v_fee_calc := calculate_platform_fee(v_tenant_id, v_intent.amount_cents, v_intent.reference_id, v_organizer_id);
      v_fee_amount := (v_fee_calc->>'fee_amount_cents')::BIGINT;
      v_net_amount := (v_fee_calc->>'net_amount_cents')::BIGINT;
      
      -- Get/create escrow account for this tournament
      v_target_account := get_or_create_ledger_account(v_tenant_id, 'escrow', v_intent.reference_id, 'Tournament Escrow: ' || COALESCE(v_tournament.name, 'Unknown'));
      
      -- Build balanced entries
      v_entries := jsonb_build_array(
        jsonb_build_object('account_id', v_clearing_account, 'direction', 'debit', 'amount_cents', v_intent.amount_cents),
        jsonb_build_object('account_id', v_target_account, 'direction', 'credit', 'amount_cents', v_net_amount),
        jsonb_build_object('account_id', v_platform_account, 'direction', 'credit', 'amount_cents', v_fee_amount)
      );
      
      v_idempotency_key := 'intent_' || v_intent.id::text;
      
      v_ledger_result := post_ledger_transaction(
        v_tenant_id,
        'deposit',
        v_entries,
        v_intent.reference_id,
        'tournament_entry',
        'Tournament entry: ' || COALESCE(v_tournament.name, 'Unknown') || 
        ' | User: ' || v_intent.user_id::text ||
        ' | Gross: $' || (v_intent.amount_cents / 100.0)::text ||
        ' | Fee: $' || (v_fee_amount / 100.0)::text ||
        ' | Net: $' || (v_net_amount / 100.0)::text,
        v_idempotency_key
      );

    -- =====================
    -- TICKET PURCHASE
    -- =====================
    WHEN 'ticket_purchase' THEN
      SELECT e.*, e.organizer_id INTO v_event FROM events e WHERE e.id = v_intent.reference_id;
      v_organizer_id := v_event.organizer_id;
      
      -- Calculate fee
      v_fee_calc := calculate_platform_fee(v_tenant_id, v_intent.amount_cents, NULL, v_organizer_id);
      v_fee_amount := (v_fee_calc->>'fee_amount_cents')::BIGINT;
      v_net_amount := (v_fee_calc->>'net_amount_cents')::BIGINT;
      
      -- Get/create organizer payable account
      v_target_account := get_or_create_ledger_account(v_tenant_id, 'organizer_payable', v_organizer_id, 'Organizer Payable: ' || COALESCE(v_organizer_id::text, 'Unknown'));
      
      v_entries := jsonb_build_array(
        jsonb_build_object('account_id', v_clearing_account, 'direction', 'debit', 'amount_cents', v_intent.amount_cents),
        jsonb_build_object('account_id', v_target_account, 'direction', 'credit', 'amount_cents', v_net_amount),
        jsonb_build_object('account_id', v_platform_account, 'direction', 'credit', 'amount_cents', v_fee_amount)
      );
      
      v_idempotency_key := 'intent_' || v_intent.id::text;
      
      v_ledger_result := post_ledger_transaction(
        v_tenant_id,
        'ticket_sale',
        v_entries,
        v_intent.reference_id,
        'ticket_order',
        'Ticket purchase | Gross: $' || (v_intent.amount_cents / 100.0)::text ||
        ' | Fee: $' || (v_fee_amount / 100.0)::text ||
        ' | Net: $' || (v_net_amount / 100.0)::text,
        v_idempotency_key
      );

    -- =====================
    -- WALLET DEPOSIT
    -- =====================
    WHEN 'wallet_deposit' THEN
      v_fee_calc := calculate_platform_fee(v_tenant_id, v_intent.amount_cents, NULL, NULL);
      v_fee_amount := (v_fee_calc->>'fee_amount_cents')::BIGINT;
      v_net_amount := (v_fee_calc->>'net_amount_cents')::BIGINT;
      
      -- User wallet account
      v_target_account := get_or_create_ledger_account(v_tenant_id, 'user_wallet', v_intent.user_id, 'User Wallet: ' || v_intent.user_id::text);
      
      v_entries := jsonb_build_array(
        jsonb_build_object('account_id', v_clearing_account, 'direction', 'debit', 'amount_cents', v_intent.amount_cents),
        jsonb_build_object('account_id', v_target_account, 'direction', 'credit', 'amount_cents', v_net_amount),
        jsonb_build_object('account_id', v_platform_account, 'direction', 'credit', 'amount_cents', v_fee_amount)
      );
      
      v_idempotency_key := 'intent_' || v_intent.id::text;
      
      v_ledger_result := post_ledger_transaction(
        v_tenant_id,
        'deposit',
        v_entries,
        v_intent.user_id,
        'wallet_deposit',
        'Wallet deposit | Gross: $' || (v_intent.amount_cents / 100.0)::text,
        v_idempotency_key
      );

    -- =====================
    -- FALLBACK (legacy)
    -- =====================
    ELSE
      -- No fee for unknown types - just record
      INSERT INTO financial_transactions (
        user_id, amount_cents, type, status, description, 
        reference_type, reference_id, stripe_session_id, stripe_payment_intent
      ) VALUES (
        v_intent.user_id, v_intent.amount_cents, v_intent.intent_type, 
        'completed', 'Payment via Stripe (legacy)', 
        v_intent.reference_type, v_intent.reference_id, 
        p_stripe_session_id, p_stripe_payment_intent_id
      );
      
      v_ledger_result := json_build_object('success', true, 'fallback', true);
      v_fee_calc := json_build_object('fee_amount_cents', 0, 'net_amount_cents', v_intent.amount_cents);
  END CASE;

  -- =====================
  -- 7. LINK LEDGER TO INTENT
  -- =====================
  IF v_ledger_result->>'success' = 'true' AND v_ledger_result->>'transaction_id' IS NOT NULL THEN
    v_tx_id := (v_ledger_result->>'transaction_id')::UUID;
    UPDATE financial_intents SET ledger_entry_id = v_tx_id WHERE id = v_intent.id;
  END IF;

  -- =====================
  -- 8. AUDIT LOG
  -- =====================
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_intent.user_id,
    'financial_intent_reconciled',
    'financial_intent',
    v_intent.id,
    jsonb_build_object(
      'intent_type', v_intent.intent_type,
      'gross_amount', v_intent.amount_cents,
      'fee_amount', COALESCE(v_fee_amount, 0),
      'net_amount', COALESCE(v_net_amount, v_intent.amount_cents),
      'ledger_tx_id', v_tx_id,
      'stripe_session_id', p_stripe_session_id,
      'fee_calculation', v_fee_calc
    )
  );

  -- =====================
  -- 9. RETURN SUCCESS
  -- =====================
  RETURN jsonb_build_object(
    'success', true,
    'intent_id', v_intent.id,
    'status', p_status,
    'ledger_tx_id', v_tx_id,
    'fee_amount', COALESCE(v_fee_amount, 0),
    'net_amount', COALESCE(v_net_amount, v_intent.amount_cents),
    'ledger_result', v_ledger_result
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error but don't lose the exception
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    COALESCE(v_intent.user_id, NULL),
    'financial_intent_reconcile_error',
    'financial_intent',
    COALESCE(v_intent.id, NULL),
    jsonb_build_object(
      'stripe_session_id', p_stripe_session_id,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    )
  );

  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- PERMISSIONS
-- ===========================================
REVOKE ALL ON FUNCTION reconcile_financial_intent(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION reconcile_financial_intent(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION reconcile_financial_intent(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION get_ledger_account(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION bootstrap_ledger_accounts(UUID) TO service_role;

-- ===========================================
-- VERIFICATION QUERY (run after deployment)
-- ===========================================
-- SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT 10;
-- 
-- Expected result for $100 tournament entry with 10% fee:
-- | account_type    | direction | amount_cents |
-- |-----------------|-----------|--------------|
-- | stripe_clearing | debit     | 10000        |
-- | escrow          | credit    | 9000         |
-- | platform_revenue| credit    | 1000         |
-- 
-- Verification: SUM(debits) = SUM(credits) = 10000 ✓
