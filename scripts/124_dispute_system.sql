-- ============================================
-- 124_dispute_system.sql
-- Phase 3: Disputes + Payout Holds
-- ============================================

-- Step 1: Disputes Table
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID REFERENCES auth.users(id),
  tournament_id UUID REFERENCES tournaments(id),
  event_id UUID REFERENCES events(id),
  financial_intent_id UUID REFERENCES financial_intents(id),
  
  dispute_type TEXT NOT NULL CHECK (
    dispute_type IN ('payout', 'payment', 'match', 'chargeback', 'fraud')
  ),
  
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'under_review', 'escalated', 'resolved', 'rejected', 'won', 'lost')
  ),
  
  -- Hold controls
  hold_payout BOOLEAN DEFAULT TRUE,
  hold_escrow BOOLEAN DEFAULT TRUE,
  
  -- Stripe integration
  stripe_dispute_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  
  -- Amount in dispute
  amount_cents BIGINT,
  
  -- Resolution details
  resolution TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  
  -- Metadata
  reason TEXT,
  evidence JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_disputes_user ON disputes(user_id);
CREATE INDEX IF NOT EXISTS idx_disputes_tournament ON disputes(tournament_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_stripe ON disputes(stripe_dispute_id);
CREATE INDEX IF NOT EXISTS idx_disputes_intent ON disputes(financial_intent_id);

-- Step 2: RLS
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Users can view their own disputes
CREATE POLICY "users_view_own_disputes"
ON disputes FOR SELECT
USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "service_role_manages_disputes"
ON disputes FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Staff can view and manage disputes
CREATE POLICY "staff_manage_disputes"
ON disputes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM staff_roles
    WHERE staff_roles.user_id = auth.uid()
    AND staff_roles.role IN ('owner', 'manager', 'finance', 'support')
  )
);

-- Step 3: Add hold column to relevant tables
ALTER TABLE payout_requests
ADD COLUMN IF NOT EXISTS dispute_hold BOOLEAN DEFAULT FALSE;

-- Step 4: Check if dispute exists for tournament/event
CREATE OR REPLACE FUNCTION has_active_dispute(
  p_tournament_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_financial_intent_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM disputes
    WHERE (
      (p_tournament_id IS NOT NULL AND tournament_id = p_tournament_id) OR
      (p_event_id IS NOT NULL AND event_id = p_event_id) OR
      (p_financial_intent_id IS NOT NULL AND financial_intent_id = p_financial_intent_id)
    )
    AND status IN ('open', 'under_review', 'escalated')
    AND (hold_payout = TRUE OR hold_escrow = TRUE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create Dispute (Atomic with holds)
CREATE OR REPLACE FUNCTION create_dispute(
  p_user_id UUID,
  p_dispute_type TEXT,
  p_tournament_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_financial_intent_id UUID DEFAULT NULL,
  p_amount_cents BIGINT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_stripe_dispute_id TEXT DEFAULT NULL,
  p_stripe_charge_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_dispute_id UUID;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service_role required';
  END IF;

  -- Check for existing dispute with same stripe_dispute_id (idempotency)
  IF p_stripe_dispute_id IS NOT NULL THEN
    SELECT id INTO v_dispute_id
    FROM disputes
    WHERE stripe_dispute_id = p_stripe_dispute_id;
    
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'dispute_id', v_dispute_id
      );
    END IF;
  END IF;

  -- Create dispute
  INSERT INTO disputes (
    user_id,
    tournament_id,
    event_id,
    financial_intent_id,
    dispute_type,
    amount_cents,
    reason,
    stripe_dispute_id,
    stripe_charge_id,
    metadata,
    hold_payout,
    hold_escrow
  )
  VALUES (
    p_user_id,
    p_tournament_id,
    p_event_id,
    p_financial_intent_id,
    p_dispute_type,
    p_amount_cents,
    p_reason,
    p_stripe_dispute_id,
    p_stripe_charge_id,
    p_metadata,
    TRUE,
    TRUE
  )
  RETURNING id INTO v_dispute_id;

  -- Apply payout hold for tournament
  IF p_tournament_id IS NOT NULL THEN
    UPDATE payout_requests
    SET dispute_hold = TRUE,
        updated_at = NOW()
    WHERE tournament_id = p_tournament_id
      AND status IN ('pending', 'eligible');
  END IF;

  -- Audit
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    p_user_id,
    'dispute_created',
    'dispute',
    v_dispute_id,
    jsonb_build_object(
      'type', p_dispute_type,
      'tournament_id', p_tournament_id,
      'event_id', p_event_id,
      'amount_cents', p_amount_cents,
      'stripe_dispute_id', p_stripe_dispute_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'dispute_id', v_dispute_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Resolve Dispute
CREATE OR REPLACE FUNCTION resolve_dispute(
  p_dispute_id UUID,
  p_status TEXT,
  p_resolution TEXT DEFAULT NULL,
  p_resolved_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_dispute RECORD;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' AND NOT EXISTS (
    SELECT 1 FROM staff_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'manager', 'finance')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Lock dispute
  SELECT * INTO v_dispute
  FROM disputes
  WHERE id = p_dispute_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute not found');
  END IF;

  -- Update dispute
  UPDATE disputes
  SET status = p_status,
      resolution = COALESCE(p_resolution, resolution),
      resolved_by = COALESCE(p_resolved_by, auth.uid()),
      resolved_at = NOW(),
      hold_payout = CASE WHEN p_status IN ('resolved', 'rejected', 'won') THEN FALSE ELSE hold_payout END,
      hold_escrow = CASE WHEN p_status IN ('resolved', 'rejected', 'won') THEN FALSE ELSE hold_escrow END,
      updated_at = NOW()
  WHERE id = p_dispute_id;

  -- Release payout holds if resolved favorably
  IF p_status IN ('resolved', 'rejected', 'won') THEN
    IF v_dispute.tournament_id IS NOT NULL THEN
      UPDATE payout_requests
      SET dispute_hold = FALSE,
          updated_at = NOW()
      WHERE tournament_id = v_dispute.tournament_id
        AND dispute_hold = TRUE;
    END IF;
  END IF;

  -- Audit
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    COALESCE(p_resolved_by, auth.uid()),
    'dispute_resolved',
    'dispute',
    p_dispute_id,
    jsonb_build_object(
      'new_status', p_status,
      'resolution', p_resolution,
      'holds_released', p_status IN ('resolved', 'rejected', 'won')
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'dispute_id', p_dispute_id,
    'status', p_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Update get_eligible_payouts to respect dispute holds
CREATE OR REPLACE FUNCTION get_eligible_payouts(p_limit INTEGER DEFAULT 25)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  tournament_id UUID,
  amount_cents BIGINT,
  placement INTEGER,
  stripe_connect_account_id TEXT,
  user_email TEXT,
  tournament_name TEXT,
  failure_count INTEGER
) AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    pr.id,
    pr.user_id,
    pr.tournament_id,
    pr.amount_cents,
    pr.placement,
    p.stripe_connect_account_id,
    p.email as user_email,
    t.name as tournament_name,
    pr.failure_count
  FROM payout_requests pr
  JOIN profiles p ON p.id = pr.user_id
  JOIN tournaments t ON t.id = pr.tournament_id
  WHERE pr.status = 'eligible'
    AND pr.failure_count < 5
    AND pr.dispute_hold = FALSE  -- NEW: Block if dispute hold
    AND p.stripe_connect_account_id IS NOT NULL
    AND p.stripe_connect_payouts_enabled = true
    -- Check no active disputes on tournament
    AND NOT has_active_dispute(pr.tournament_id, NULL, NULL)
  ORDER BY pr.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Handle Stripe Dispute Webhook
CREATE OR REPLACE FUNCTION handle_stripe_dispute(
  p_stripe_dispute_id TEXT,
  p_stripe_charge_id TEXT,
  p_event_type TEXT,
  p_amount_cents BIGINT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_intent RECORD;
  v_dispute_id UUID;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Find the related financial intent
  SELECT * INTO v_intent
  FROM financial_intents
  WHERE stripe_charge_id = p_stripe_charge_id
     OR stripe_payment_intent_id IN (
       SELECT pi.id FROM stripe_charges sc 
       WHERE sc.charge_id = p_stripe_charge_id
     );

  CASE p_event_type
    WHEN 'charge.dispute.created' THEN
      -- Create dispute
      RETURN create_dispute(
        p_user_id := v_intent.user_id,
        p_dispute_type := 'chargeback',
        p_tournament_id := CASE WHEN v_intent.reference_type = 'tournament' THEN v_intent.reference_id ELSE NULL END,
        p_event_id := CASE WHEN v_intent.reference_type = 'event' THEN v_intent.reference_id ELSE NULL END,
        p_financial_intent_id := v_intent.id,
        p_amount_cents := COALESCE(p_amount_cents, v_intent.amount_cents),
        p_reason := p_reason,
        p_stripe_dispute_id := p_stripe_dispute_id,
        p_stripe_charge_id := p_stripe_charge_id,
        p_metadata := jsonb_build_object('source', 'stripe_webhook', 'event_type', p_event_type)
      );

    WHEN 'charge.dispute.closed' THEN
      -- Find existing dispute
      SELECT id INTO v_dispute_id
      FROM disputes
      WHERE stripe_dispute_id = p_stripe_dispute_id;

      IF FOUND THEN
        -- Determine outcome based on reason (Stripe sends status in metadata)
        RETURN resolve_dispute(
          p_dispute_id := v_dispute_id,
          p_status := CASE 
            WHEN p_reason = 'won' THEN 'won'
            WHEN p_reason = 'lost' THEN 'lost'
            ELSE 'resolved'
          END,
          p_resolution := 'Stripe dispute closed: ' || COALESCE(p_reason, 'unknown')
        );
      END IF;

    WHEN 'charge.dispute.updated' THEN
      -- Update dispute metadata
      UPDATE disputes
      SET metadata = metadata || jsonb_build_object('last_update', NOW(), 'update_reason', p_reason),
          updated_at = NOW()
      WHERE stripe_dispute_id = p_stripe_dispute_id;

      RETURN jsonb_build_object('success', true, 'action', 'updated');
  END CASE;

  RETURN jsonb_build_object('success', false, 'error', 'Unhandled event type');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Get Dispute Stats
CREATE OR REPLACE FUNCTION get_dispute_stats()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' AND NOT EXISTS (
    SELECT 1 FROM staff_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'manager', 'finance')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'open', COUNT(*) FILTER (WHERE status = 'open'),
    'under_review', COUNT(*) FILTER (WHERE status = 'under_review'),
    'escalated', COUNT(*) FILTER (WHERE status = 'escalated'),
    'resolved', COUNT(*) FILTER (WHERE status = 'resolved'),
    'won', COUNT(*) FILTER (WHERE status = 'won'),
    'lost', COUNT(*) FILTER (WHERE status = 'lost'),
    'total_disputed_cents', COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('open', 'under_review', 'escalated')), 0),
    'chargebacks', COUNT(*) FILTER (WHERE dispute_type = 'chargeback'),
    'timestamp', NOW()
  ) INTO v_stats
  FROM disputes;

  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Permissions
GRANT EXECUTE ON FUNCTION has_active_dispute(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION create_dispute(UUID, TEXT, UUID, UUID, UUID, BIGINT, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION resolve_dispute(UUID, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION resolve_dispute(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_stripe_dispute(TEXT, TEXT, TEXT, BIGINT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_dispute_stats() TO service_role;
GRANT EXECUTE ON FUNCTION get_dispute_stats() TO authenticated;

REVOKE ALL ON FUNCTION create_dispute(UUID, TEXT, UUID, UUID, UUID, BIGINT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION handle_stripe_dispute(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;
