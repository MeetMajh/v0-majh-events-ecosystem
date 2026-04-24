-- ═══════════════════════════════════════════════════════════════════════════════
-- FINANCIAL INTENTS - STRIPE IDEMPOTENCY & RECONCILIATION
-- ═══════════════════════════════════════════════════════════════════════════════
-- Purpose:
-- 1. Track payment intent BEFORE calling Stripe (idempotency)
-- 2. Reconcile webhook responses with original intent
-- 3. Prevent duplicate payments and double-credits
-- 4. Audit trail for financial compliance
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: FINANCIAL INTENTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Idempotency key (unique per operation)
  idempotency_key TEXT UNIQUE NOT NULL,
  
  -- User context
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- Intent type
  intent_type TEXT NOT NULL CHECK (intent_type IN (
    'tournament_entry',
    'wallet_deposit',
    'escrow_fund',
    'ticket_purchase',
    'subscription',
    'payout',
    'refund',
    'prize_distribution'
  )),
  
  -- Amount
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Reference to what this payment is for
  reference_type TEXT CHECK (reference_type IN (
    'tournament', 'event', 'ticket_order', 'subscription', 'wallet', 'escrow', 'payout_request'
  )),
  reference_id UUID,
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',          -- Created, not yet sent to Stripe
    'processing',       -- Sent to Stripe, awaiting response
    'requires_action',  -- 3DS or additional auth needed
    'succeeded',        -- Stripe confirmed success
    'failed',           -- Stripe or system failure
    'canceled',         -- User or system canceled
    'refunded',         -- Full or partial refund
    'expired'           -- TTL expired without completion
  )),
  
  -- Stripe references
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_charge_id TEXT,
  stripe_refund_id TEXT,
  stripe_transfer_id TEXT,
  
  -- Metadata for debugging/audit
  metadata JSONB DEFAULT '{}',
  
  -- Error tracking
  error_code TEXT,
  error_message TEXT,
  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  
  -- Reconciliation
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES auth.users(id),
  ledger_entry_id UUID,  -- Reference to financial_transactions
  
  -- Timestamps
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financial_intents_idempotency ON financial_intents(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_financial_intents_user ON financial_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_intents_status ON financial_intents(status);
CREATE INDEX IF NOT EXISTS idx_financial_intents_stripe_pi ON financial_intents(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_financial_intents_stripe_session ON financial_intents(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_financial_intents_reference ON financial_intents(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_financial_intents_pending ON financial_intents(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_financial_intents_expires ON financial_intents(expires_at) WHERE status = 'pending';

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: RLS - SERVICE ROLE ONLY (LEDGER GRADE)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE financial_intents ENABLE ROW LEVEL SECURITY;

-- Only service role can manage intents
CREATE POLICY "Service role manages intents"
ON financial_intents
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Users can view their own intent status (read-only)
CREATE POLICY "Users can view own intents"
ON financial_intents
FOR SELECT
USING (auth.uid() = user_id);

-- Staff can view all for support
CREATE POLICY "Staff can view intents"
ON financial_intents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_roles
    WHERE staff_roles.user_id = auth.uid()
      AND staff_roles.role IN ('owner', 'manager', 'finance', 'support')
  )
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: CREATE INTENT FUNCTION (ATOMIC, IDEMPOTENT)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_financial_intent(
  p_idempotency_key TEXT,
  p_user_id UUID,
  p_intent_type TEXT,
  p_amount_cents INTEGER,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_existing RECORD;
  v_new_intent RECORD;
BEGIN
  -- 1. Check for existing intent with same idempotency key
  SELECT * INTO v_existing
  FROM financial_intents
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    -- Return existing intent (idempotent response)
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'intent_id', v_existing.id,
      'status', v_existing.status,
      'stripe_payment_intent_id', v_existing.stripe_payment_intent_id,
      'stripe_checkout_session_id', v_existing.stripe_checkout_session_id
    );
  END IF;

  -- 2. Validate amount
  IF p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- 3. Create new intent
  INSERT INTO financial_intents (
    idempotency_key,
    user_id,
    tenant_id,
    intent_type,
    amount_cents,
    reference_type,
    reference_id,
    metadata,
    status
  ) VALUES (
    p_idempotency_key,
    p_user_id,
    p_tenant_id,
    p_intent_type,
    p_amount_cents,
    p_reference_type,
    p_reference_id,
    p_metadata,
    'pending'
  )
  RETURNING * INTO v_new_intent;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'intent_id', v_new_intent.id,
    'status', v_new_intent.status
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: UPDATE INTENT WITH STRIPE RESPONSE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_intent_with_stripe(
  p_intent_id UUID,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_stripe_checkout_session_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'processing'
) RETURNS JSONB AS $$
DECLARE
  v_intent RECORD;
BEGIN
  UPDATE financial_intents
  SET 
    stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
    stripe_checkout_session_id = COALESCE(p_stripe_checkout_session_id, stripe_checkout_session_id),
    status = p_status,
    updated_at = NOW()
  WHERE id = p_intent_id
  RETURNING * INTO v_intent;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Intent not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'intent_id', v_intent.id,
    'status', v_intent.status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: RECONCILE INTENT FROM WEBHOOK
-- ═══════════════════════════════════════════════════════════════════════════════

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
  v_ledger_id UUID;
BEGIN
  -- Find intent by Stripe IDs
  SELECT * INTO v_intent
  FROM financial_intents
  WHERE (stripe_checkout_session_id = p_stripe_session_id 
         OR stripe_payment_intent_id = p_stripe_payment_intent_id)
    AND reconciled = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No matching intent - this could be a direct Stripe payment
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No pending intent found for reconciliation',
      'stripe_session_id', p_stripe_session_id,
      'stripe_payment_intent_id', p_stripe_payment_intent_id
    );
  END IF;

  -- Already reconciled?
  IF v_intent.reconciled THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'intent_id', v_intent.id,
      'message', 'Already reconciled'
    );
  END IF;

  -- Update intent status
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

  -- If succeeded, create ledger entry
  IF p_status = 'succeeded' THEN
    INSERT INTO financial_transactions (
      user_id,
      amount_cents,
      type,
      status,
      description,
      reference_type,
      reference_id,
      stripe_session_id,
      stripe_payment_intent
    ) VALUES (
      v_intent.user_id,
      v_intent.amount_cents,
      v_intent.intent_type,
      'completed',
      'Payment for ' || v_intent.intent_type || ' via Stripe',
      v_intent.reference_type,
      v_intent.reference_id,
      p_stripe_session_id,
      p_stripe_payment_intent_id
    )
    RETURNING id INTO v_ledger_id;

    -- Link ledger entry to intent
    UPDATE financial_intents
    SET ledger_entry_id = v_ledger_id
    WHERE id = v_intent.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'intent_id', v_intent.id,
    'status', p_status,
    'ledger_entry_id', v_ledger_id,
    'user_id', v_intent.user_id,
    'amount_cents', v_intent.amount_cents,
    'intent_type', v_intent.intent_type
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: EXPIRE STALE INTENTS (CRON JOB TARGET)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION expire_stale_intents()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE financial_intents
  SET 
    status = 'expired',
    updated_at = NOW()
  WHERE status IN ('pending', 'processing')
    AND expires_at < NOW()
    AND reconciled = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 7: GET PENDING INTENTS FOR RECONCILIATION
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_unreconciled_intents(
  p_older_than_minutes INTEGER DEFAULT 30
) RETURNS TABLE (
  id UUID,
  idempotency_key TEXT,
  user_id UUID,
  intent_type TEXT,
  amount_cents INTEGER,
  status TEXT,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fi.id,
    fi.idempotency_key,
    fi.user_id,
    fi.intent_type,
    fi.amount_cents,
    fi.status,
    fi.stripe_payment_intent_id,
    fi.stripe_checkout_session_id,
    fi.created_at
  FROM financial_intents fi
  WHERE fi.reconciled = FALSE
    AND fi.status IN ('processing', 'pending')
    AND fi.created_at < (NOW() - (p_older_than_minutes || ' minutes')::INTERVAL)
  ORDER BY fi.created_at ASC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 8: IMMUTABILITY TRIGGER (LEDGER GRADE)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Prevent status from going backwards
CREATE OR REPLACE FUNCTION enforce_intent_status_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_valid_transitions JSONB := '{
    "pending": ["processing", "canceled", "expired"],
    "processing": ["succeeded", "failed", "requires_action", "canceled"],
    "requires_action": ["succeeded", "failed", "canceled", "expired"],
    "succeeded": ["refunded"],
    "failed": ["pending"],
    "canceled": [],
    "expired": [],
    "refunded": []
  }'::JSONB;
  v_allowed TEXT[];
BEGIN
  -- Allow same status (idempotent updates)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get allowed transitions
  v_allowed := ARRAY(SELECT jsonb_array_elements_text(v_valid_transitions -> OLD.status));

  -- Check if transition is valid
  IF NOT (NEW.status = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_intent_status ON financial_intents;
CREATE TRIGGER enforce_intent_status
BEFORE UPDATE ON financial_intents
FOR EACH ROW
EXECUTE FUNCTION enforce_intent_status_flow();

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 9: GRANT PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION create_financial_intent(TEXT, UUID, TEXT, INTEGER, TEXT, UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_intent_with_stripe(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reconcile_financial_intent(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION expire_stale_intents() TO authenticated;
GRANT EXECUTE ON FUNCTION get_unreconciled_intents(INTEGER) TO authenticated;
