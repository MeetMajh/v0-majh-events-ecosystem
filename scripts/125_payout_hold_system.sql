-- =====================================================
-- PAYOUT HOLD SYSTEM
-- Prevents payouts during active disputes or manual holds
-- =====================================================

-- Step 1: Add HOLD fields to payout_requests
ALTER TABLE payout_requests
ADD COLUMN IF NOT EXISTS is_on_hold BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hold_reason TEXT,
ADD COLUMN IF NOT EXISTS hold_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hold_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hold_released_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hold_released_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_payout_requests_hold
ON payout_requests(is_on_hold, hold_until) WHERE is_on_hold = TRUE;

-- =====================================================
-- check_payout_eligibility: Pre-flight check before any payout
-- =====================================================
CREATE OR REPLACE FUNCTION check_payout_eligibility(
  p_payout_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_active_disputes INTEGER;
  v_tournament_disputes INTEGER;
BEGIN
  -- Get payout details
  SELECT pr.*, t.name as tournament_name
  INTO v_payout
  FROM payout_requests pr
  LEFT JOIN tournaments t ON t.id = pr.tournament_id
  WHERE pr.id = p_payout_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Payout not found');
  END IF;

  -- Check 1: Manual hold
  IF v_payout.is_on_hold = TRUE THEN
    IF v_payout.hold_until IS NOT NULL AND v_payout.hold_until <= NOW() THEN
      -- Hold expired, auto-release
      UPDATE payout_requests
      SET is_on_hold = FALSE, hold_released_at = NOW()
      WHERE id = p_payout_id;
    ELSE
      RETURN jsonb_build_object(
        'eligible', false,
        'reason', 'Payout is on hold',
        'hold_reason', v_payout.hold_reason,
        'hold_until', v_payout.hold_until
      );
    END IF;
  END IF;

  -- Check 2: Active disputes for this tournament
  SELECT COUNT(*) INTO v_tournament_disputes
  FROM disputes d
  JOIN financial_intents fi ON fi.id = d.original_intent_id
  WHERE fi.reference_id = v_payout.tournament_id
    AND d.status IN ('needs_response', 'under_review');

  IF v_tournament_disputes > 0 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Active disputes exist for this tournament',
      'dispute_count', v_tournament_disputes
    );
  END IF;

  -- Check 3: Tenant-wide dispute threshold (optional strict mode)
  SELECT COUNT(*) INTO v_active_disputes
  FROM disputes d
  WHERE d.tenant_id = v_payout.tenant_id
    AND d.status IN ('needs_response', 'under_review');

  -- Optional: Block ALL payouts if tenant has > X disputes
  -- Uncomment to enable strict mode:
  -- IF v_active_disputes >= 5 THEN
  --   RETURN jsonb_build_object(
  --     'eligible', false,
  --     'reason', 'Too many active disputes for tenant',
  --     'dispute_count', v_active_disputes
  --   );
  -- END IF;

  -- Check 4: User has completed Stripe Connect
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = v_payout.user_id
      AND p.stripe_connect_account_id IS NOT NULL
      AND p.stripe_connect_payouts_enabled = TRUE
  ) THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'User has not completed Stripe Connect setup'
    );
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'payout_id', p_payout_id,
    'amount_cents', v_payout.amount_cents,
    'user_id', v_payout.user_id,
    'tournament_id', v_payout.tournament_id,
    'active_tenant_disputes', v_active_disputes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- hold_payout: Manual admin hold
-- =====================================================
CREATE OR REPLACE FUNCTION hold_payout(
  p_payout_id UUID,
  p_reason TEXT,
  p_hold_until TIMESTAMPTZ DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();

  -- Only service_role or staff can hold
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'manager', 'finance')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only staff can hold payouts';
    END IF;
  END IF;

  SELECT * INTO v_payout FROM payout_requests WHERE id = p_payout_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not found');
  END IF;

  UPDATE payout_requests
  SET is_on_hold = TRUE,
      hold_reason = p_reason,
      hold_until = p_hold_until,
      hold_created_at = NOW(),
      hold_released_at = NULL,
      hold_released_by = NULL,
      updated_at = NOW()
  WHERE id = p_payout_id;

  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    COALESCE(p_admin_id, auth.uid()),
    'payout_held',
    'payout_request',
    p_payout_id,
    jsonb_build_object(
      'reason', p_reason,
      'hold_until', p_hold_until,
      'amount_cents', v_payout.amount_cents
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', p_payout_id,
    'held', true,
    'reason', p_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- release_payout_hold: Remove manual hold
-- =====================================================
CREATE OR REPLACE FUNCTION release_payout_hold(
  p_payout_id UUID,
  p_admin_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();

  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'manager', 'finance')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only staff can release holds';
    END IF;
  END IF;

  SELECT * INTO v_payout FROM payout_requests WHERE id = p_payout_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not found');
  END IF;

  IF v_payout.is_on_hold = FALSE THEN
    RETURN jsonb_build_object('success', true, 'already_released', true);
  END IF;

  UPDATE payout_requests
  SET is_on_hold = FALSE,
      hold_released_at = NOW(),
      hold_released_by = COALESCE(p_admin_id, auth.uid()),
      updated_at = NOW()
  WHERE id = p_payout_id;

  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    COALESCE(p_admin_id, auth.uid()),
    'payout_hold_released',
    'payout_request',
    p_payout_id,
    jsonb_build_object(
      'original_reason', v_payout.hold_reason,
      'amount_cents', v_payout.amount_cents
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', p_payout_id,
    'released', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- auto_hold_payouts_for_dispute: Called when dispute created
-- =====================================================
CREATE OR REPLACE FUNCTION auto_hold_payouts_for_dispute(
  p_dispute_id UUID,
  p_tenant_id UUID,
  p_tournament_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_held_count INTEGER := 0;
  v_dispute RECORD;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_dispute FROM disputes WHERE id = p_dispute_id;

  -- Hold all pending/eligible payouts for this tournament
  IF p_tournament_id IS NOT NULL THEN
    UPDATE payout_requests
    SET is_on_hold = TRUE,
        hold_reason = 'Auto-hold: Active dispute ' || v_dispute.stripe_dispute_id,
        hold_created_at = NOW(),
        updated_at = NOW()
    WHERE tournament_id = p_tournament_id
      AND status IN ('pending', 'eligible')
      AND is_on_hold = FALSE;

    GET DIAGNOSTICS v_held_count = ROW_COUNT;
  END IF;

  IF v_held_count > 0 THEN
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
    VALUES (
      NULL,
      'payouts_auto_held_for_dispute',
      'dispute',
      p_dispute_id,
      jsonb_build_object(
        'payouts_held', v_held_count,
        'tournament_id', p_tournament_id,
        'stripe_dispute_id', v_dispute.stripe_dispute_id
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payouts_held', v_held_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Update get_eligible_payouts to respect holds
-- =====================================================
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
    AND p.stripe_connect_account_id IS NOT NULL
    AND p.stripe_connect_payouts_enabled = true
    -- NEW: Exclude held payouts
    AND (pr.is_on_hold = FALSE OR (pr.hold_until IS NOT NULL AND pr.hold_until <= NOW()))
    -- NEW: Exclude if tournament has active disputes
    AND NOT EXISTS (
      SELECT 1 FROM disputes d
      JOIN financial_intents fi ON fi.id = d.original_intent_id
      WHERE fi.reference_id = pr.tournament_id
        AND d.status IN ('needs_response', 'under_review')
    )
  ORDER BY pr.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION check_payout_eligibility(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION hold_payout(UUID, TEXT, TIMESTAMPTZ, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION hold_payout(UUID, TEXT, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION release_payout_hold(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION release_payout_hold(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_hold_payouts_for_dispute(UUID, UUID, UUID) TO service_role;
