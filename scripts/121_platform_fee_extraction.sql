-- ══════════════════════════════════════════════════════════════════════════════
-- PLATFORM FEE EXTRACTION - Phase 1
-- Implements: Fee config, Ledger accounts, Reconciliation with fee split
-- ══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. PLATFORM FEE CONFIGURATION TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS platform_fee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL DEFAULT 'percentage' CHECK (fee_type IN ('percentage', 'flat', 'hybrid')),
  default_fee_bps INTEGER NOT NULL DEFAULT 1000, -- 1000 = 10%
  flat_fee_cents INTEGER DEFAULT 0,
  min_fee_cents INTEGER DEFAULT 0,
  max_fee_cents INTEGER, -- NULL = no cap
  organizer_override_allowed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Insert default config
INSERT INTO platform_fee_config (tenant_id, fee_type, default_fee_bps, flat_fee_cents)
SELECT id, 'percentage', 1000, 0 FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Organizer-specific fee overrides
CREATE TABLE IF NOT EXISTS organizer_fee_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fee_bps INTEGER, -- NULL = use default
  flat_fee_cents INTEGER,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, organizer_id)
);

-- Tournament-specific fee overrides (for special events)
CREATE TABLE IF NOT EXISTS tournament_fee_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  fee_bps INTEGER,
  flat_fee_cents INTEGER,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id)
);

-- RLS for fee tables
ALTER TABLE platform_fee_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_fee_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_fee_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages fee config"
ON platform_fee_config FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Staff can view fee config"
ON platform_fee_config FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_roles
    WHERE staff_roles.user_id = auth.uid()
      AND staff_roles.role IN ('owner', 'manager', 'finance')
  )
);

CREATE POLICY "Service role manages organizer overrides"
ON organizer_fee_overrides FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role manages tournament overrides"
ON tournament_fee_overrides FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. FEE CALCULATION FUNCTION (Deterministic, Auditable)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION calculate_platform_fee(
  p_tenant_id UUID,
  p_amount_cents BIGINT,
  p_tournament_id UUID DEFAULT NULL,
  p_organizer_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_config RECORD;
  v_override_bps INTEGER;
  v_override_flat INTEGER;
  v_fee_bps INTEGER;
  v_flat_fee INTEGER;
  v_percentage_fee BIGINT;
  v_total_fee BIGINT;
BEGIN
  -- Get base config
  SELECT * INTO v_config 
  FROM platform_fee_config 
  WHERE tenant_id = p_tenant_id;
  
  IF NOT FOUND THEN
    -- Default fallback
    v_fee_bps := 1000;
    v_flat_fee := 0;
  ELSE
    v_fee_bps := v_config.default_fee_bps;
    v_flat_fee := COALESCE(v_config.flat_fee_cents, 0);
  END IF;

  -- Check tournament override first (highest priority)
  IF p_tournament_id IS NOT NULL THEN
    SELECT fee_bps, flat_fee_cents INTO v_override_bps, v_override_flat
    FROM tournament_fee_overrides
    WHERE tournament_id = p_tournament_id;
    
    IF FOUND THEN
      v_fee_bps := COALESCE(v_override_bps, v_fee_bps);
      v_flat_fee := COALESCE(v_override_flat, v_flat_fee);
    END IF;
  END IF;

  -- Check organizer override (if no tournament override)
  IF p_organizer_id IS NOT NULL AND v_override_bps IS NULL THEN
    SELECT fee_bps, flat_fee_cents INTO v_override_bps, v_override_flat
    FROM organizer_fee_overrides
    WHERE tenant_id = p_tenant_id
      AND organizer_id = p_organizer_id
      AND (valid_until IS NULL OR valid_until > NOW());
    
    IF FOUND THEN
      v_fee_bps := COALESCE(v_override_bps, v_fee_bps);
      v_flat_fee := COALESCE(v_override_flat, v_flat_fee);
    END IF;
  END IF;

  -- Calculate fee
  v_percentage_fee := (p_amount_cents * v_fee_bps) / 10000;
  v_total_fee := v_percentage_fee + v_flat_fee;

  -- Apply min/max caps
  IF v_config.min_fee_cents IS NOT NULL AND v_total_fee < v_config.min_fee_cents THEN
    v_total_fee := v_config.min_fee_cents;
  END IF;
  
  IF v_config.max_fee_cents IS NOT NULL AND v_total_fee > v_config.max_fee_cents THEN
    v_total_fee := v_config.max_fee_cents;
  END IF;

  -- Never charge more than the payment
  IF v_total_fee > p_amount_cents THEN
    v_total_fee := p_amount_cents;
  END IF;

  RETURN json_build_object(
    'gross_amount_cents', p_amount_cents,
    'fee_amount_cents', v_total_fee,
    'net_amount_cents', p_amount_cents - v_total_fee,
    'fee_bps_applied', v_fee_bps,
    'flat_fee_applied', v_flat_fee,
    'percentage_component', v_percentage_fee,
    'has_override', v_override_bps IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. UPDATED RECONCILE FUNCTION WITH FEE SPLIT (ATOMIC)
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
  v_fee_calc JSON;
  v_tournament RECORD;
  v_organizer_id UUID;
BEGIN
  -- Security check
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Reconciliation requires service_role';
  END IF;

  -- Find and lock intent
  SELECT * INTO v_intent 
  FROM financial_intents
  WHERE ((p_stripe_session_id IS NOT NULL AND stripe_checkout_session_id = p_stripe_session_id)
      OR (p_stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = p_stripe_payment_intent_id))
    AND reconciled = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending intent found', 'skip', true);
  END IF;

  -- Idempotency check
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

  -- Process successful payments
  IF p_status = 'succeeded' THEN
    v_tenant_id := COALESCE(v_intent.tenant_id, (SELECT id FROM tenants LIMIT 1));

    -- Route to appropriate ledger function based on intent type
    CASE v_intent.intent_type
      WHEN 'tournament_entry' THEN
        -- Get tournament and organizer for fee calculation
        SELECT t.*, t.organizer_id INTO v_tournament
        FROM tournaments t
        WHERE t.id = v_intent.reference_id;
        
        v_organizer_id := v_tournament.organizer_id;
        
        -- Calculate platform fee
        v_fee_calc := calculate_platform_fee(
          v_tenant_id,
          v_intent.amount_cents,
          v_intent.reference_id,
          v_organizer_id
        );
        
        -- Create ledger entries with fee split
        v_ledger_result := ledger_tournament_entry_with_fee(
          v_tenant_id,
          v_intent.user_id,
          v_intent.reference_id,
          v_intent.amount_cents,
          (v_fee_calc->>'fee_amount_cents')::BIGINT,
          p_stripe_session_id,
          v_intent.id
        );

      WHEN 'ticket_purchase' THEN
        -- Calculate fee for ticket purchases
        v_fee_calc := calculate_platform_fee(
          v_tenant_id,
          v_intent.amount_cents,
          NULL,
          (SELECT organizer_id FROM events WHERE id = v_intent.reference_id)
        );
        
        v_ledger_result := ledger_ticket_sale_with_fee(
          v_tenant_id,
          v_intent.reference_id,
          v_intent.amount_cents,
          (v_fee_calc->>'fee_amount_cents')::BIGINT,
          p_stripe_session_id,
          'intent_' || v_intent.id::text
        );

      ELSE
        -- Fallback for other types
        INSERT INTO financial_transactions (
          user_id, amount_cents, type, status, description,
          reference_type, reference_id, stripe_session_id, stripe_payment_intent
        ) VALUES (
          v_intent.user_id, v_intent.amount_cents, v_intent.intent_type, 'completed',
          'Payment via Stripe', v_intent.reference_type, v_intent.reference_id,
          p_stripe_session_id, p_stripe_payment_intent_id
        );
        v_ledger_result := json_build_object('success', true, 'fallback', true);
        v_fee_calc := json_build_object('fee_amount_cents', 0);
    END CASE;

    -- Link ledger transaction to intent
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
      'fee_calculation', v_fee_calc,
      'intent_type', v_intent.intent_type
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'intent_id', v_intent.id,
    'status', p_status,
    'ledger_tx_id', v_ledger_tx_id,
    'ledger_result', v_ledger_result,
    'fee_calculation', v_fee_calc
  );

EXCEPTION WHEN OTHERS THEN
  INSERT INTO audit_log (user_id, action, resource_type, metadata)
  VALUES (NULL, 'financial_intent_reconcile_error', 'financial_intent',
    jsonb_build_object('stripe_session_id', p_stripe_session_id, 'error', SQLERRM));
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. LEDGER ENTRY WITH FEE SPLIT (DOUBLE-ENTRY)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ledger_tournament_entry_with_fee(
  p_tenant_id UUID,
  p_user_id UUID,
  p_tournament_id UUID,
  p_gross_amount_cents BIGINT,
  p_fee_amount_cents BIGINT,
  p_stripe_session_id TEXT DEFAULT NULL,
  p_intent_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_clearing_account UUID;
  v_escrow_account UUID;
  v_platform_fee_account UUID;
  v_entries JSONB;
  v_net_amount BIGINT;
  v_tournament RECORD;
  v_idempotency_key TEXT;
BEGIN
  -- Get tournament details
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  v_net_amount := p_gross_amount_cents - p_fee_amount_cents;

  -- Get or create ledger accounts
  v_clearing_account := get_or_create_ledger_account(
    p_tenant_id, 'stripe_clearing', NULL, 'Stripe Clearing'
  );
  v_escrow_account := get_or_create_ledger_account(
    p_tenant_id, 'escrow', p_tournament_id, 'Tournament Escrow: ' || v_tournament.name
  );
  v_platform_fee_account := get_or_create_ledger_account(
    p_tenant_id, 'platform_revenue', NULL, 'Platform Revenue'
  );

  -- Build double-entry ledger entries:
  -- 1. Debit Clearing (money came in from Stripe)
  -- 2. Credit Escrow (prize pool portion)
  -- 3. Credit Platform Revenue (fee portion)
  v_entries := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_clearing_account,
      'direction', 'debit',
      'amount_cents', p_gross_amount_cents
    ),
    jsonb_build_object(
      'account_id', v_escrow_account,
      'direction', 'credit',
      'amount_cents', v_net_amount
    ),
    jsonb_build_object(
      'account_id', v_platform_fee_account,
      'direction', 'credit',
      'amount_cents', p_fee_amount_cents
    )
  );

  -- Idempotency key
  v_idempotency_key := COALESCE(
    'intent_' || p_intent_id::text,
    'tournament_entry_' || p_tournament_id::text || '_' || p_user_id::text || '_' || p_stripe_session_id
  );

  -- Post the transaction
  RETURN post_ledger_transaction(
    p_tenant_id,
    'deposit',
    v_entries,
    p_tournament_id,
    'tournament_entry',
    'Tournament entry: ' || v_tournament.name || ' | User: ' || p_user_id::text || 
      ' | Gross: $' || (p_gross_amount_cents / 100.0)::text || 
      ' | Fee: $' || (p_fee_amount_cents / 100.0)::text ||
      ' | Net to escrow: $' || (v_net_amount / 100.0)::text,
    v_idempotency_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. TICKET SALE WITH FEE SPLIT
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ledger_ticket_sale_with_fee(
  p_tenant_id UUID,
  p_order_id UUID,
  p_gross_amount_cents BIGINT,
  p_fee_amount_cents BIGINT,
  p_stripe_session_id TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_clearing_account UUID;
  v_organizer_payable_account UUID;
  v_platform_fee_account UUID;
  v_entries JSONB;
  v_net_amount BIGINT;
  v_order RECORD;
  v_event RECORD;
BEGIN
  -- Get order and event details
  SELECT * INTO v_order FROM ticket_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  SELECT * INTO v_event FROM events WHERE id = v_order.event_id;

  v_net_amount := p_gross_amount_cents - p_fee_amount_cents;

  -- Get or create accounts
  v_clearing_account := get_or_create_ledger_account(
    p_tenant_id, 'stripe_clearing', NULL, 'Stripe Clearing'
  );
  v_organizer_payable_account := get_or_create_ledger_account(
    p_tenant_id, 'organizer_payable', v_event.organizer_id, 'Organizer Payable: ' || COALESCE(v_event.organizer_id::text, 'Unknown')
  );
  v_platform_fee_account := get_or_create_ledger_account(
    p_tenant_id, 'platform_revenue', NULL, 'Platform Revenue'
  );

  v_entries := jsonb_build_array(
    jsonb_build_object('account_id', v_clearing_account, 'direction', 'debit', 'amount_cents', p_gross_amount_cents),
    jsonb_build_object('account_id', v_organizer_payable_account, 'direction', 'credit', 'amount_cents', v_net_amount),
    jsonb_build_object('account_id', v_platform_fee_account, 'direction', 'credit', 'amount_cents', p_fee_amount_cents)
  );

  RETURN post_ledger_transaction(
    p_tenant_id,
    'ticket_sale',
    v_entries,
    p_order_id,
    'ticket_order',
    'Ticket sale: Order ' || p_order_id::text || 
      ' | Gross: $' || (p_gross_amount_cents / 100.0)::text ||
      ' | Fee: $' || (p_fee_amount_cents / 100.0)::text,
    COALESCE(p_idempotency_key, 'ticket_' || p_order_id::text || '_' || p_stripe_session_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. FEE REPORTING FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_platform_fee_summary(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_total_revenue BIGINT;
  v_tournament_fees BIGINT;
  v_ticket_fees BIGINT;
  v_other_fees BIGINT;
  v_transaction_count INTEGER;
BEGIN
  -- Only staff can view
  IF NOT EXISTS (
    SELECT 1 FROM staff_roles
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager', 'finance')
  ) AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT 
    COALESCE(SUM(CASE WHEN le.direction = 'credit' THEN le.amount_cents ELSE 0 END), 0),
    COUNT(DISTINCT lt.id)
  INTO v_total_revenue, v_transaction_count
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'platform_revenue'
    AND lt.status = 'posted'
    AND (p_start_date IS NULL OR lt.created_at >= p_start_date)
    AND (p_end_date IS NULL OR lt.created_at <= p_end_date);

  SELECT COALESCE(SUM(le.amount_cents), 0)
  INTO v_tournament_fees
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'platform_revenue'
    AND lt.reference_type = 'tournament_entry'
    AND le.direction = 'credit'
    AND lt.status = 'posted'
    AND (p_start_date IS NULL OR lt.created_at >= p_start_date)
    AND (p_end_date IS NULL OR lt.created_at <= p_end_date);

  SELECT COALESCE(SUM(le.amount_cents), 0)
  INTO v_ticket_fees
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'platform_revenue'
    AND lt.reference_type = 'ticket_order'
    AND le.direction = 'credit'
    AND lt.status = 'posted'
    AND (p_start_date IS NULL OR lt.created_at >= p_start_date)
    AND (p_end_date IS NULL OR lt.created_at <= p_end_date);

  v_other_fees := v_total_revenue - v_tournament_fees - v_ticket_fees;

  RETURN json_build_object(
    'total_revenue_cents', v_total_revenue,
    'tournament_fees_cents', v_tournament_fees,
    'ticket_fees_cents', v_ticket_fees,
    'other_fees_cents', v_other_fees,
    'transaction_count', v_transaction_count,
    'period_start', p_start_date,
    'period_end', p_end_date,
    'generated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. PERMISSIONS
-- ══════════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION calculate_platform_fee(UUID, BIGINT, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION ledger_tournament_entry_with_fee(UUID, UUID, UUID, BIGINT, BIGINT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION ledger_ticket_sale_with_fee(UUID, UUID, BIGINT, BIGINT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_platform_fee_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
