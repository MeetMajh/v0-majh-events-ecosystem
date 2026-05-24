-- =====================================================
-- 129: Admin Finance Dashboard Functions
-- Operator cockpit for financial oversight
-- =====================================================

-- 1. Global financial KPIs
CREATE OR REPLACE FUNCTION get_admin_financial_kpis(p_tenant_id UUID, p_start_date TIMESTAMPTZ DEFAULT NULL, p_end_date TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_gmv BIGINT;
  v_platform_revenue BIGINT;
  v_refunds BIGINT;
  v_dispute_losses BIGINT;
  v_active_holds BIGINT;
  v_held_count INTEGER;
  v_disputes_at_risk BIGINT;
  v_disputes_count INTEGER;
  v_pending_payouts BIGINT;
  v_pending_payout_count INTEGER;
  v_escrow_balance BIGINT;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'finance')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  v_start := COALESCE(p_start_date, date_trunc('month', NOW()));
  v_end := COALESCE(p_end_date, NOW());

  -- GMV (Gross Merchandise Volume) - total payment volume
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_gmv
  FROM financial_intents
  WHERE tenant_id = p_tenant_id
    AND status = 'succeeded'
    AND intent_type IN ('tournament_entry', 'ticket_purchase', 'wallet_deposit')
    AND created_at BETWEEN v_start AND v_end;

  -- Platform revenue from ledger
  SELECT COALESCE(SUM(le.amount_cents), 0) INTO v_platform_revenue
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'platform_revenue'
    AND le.direction = 'credit'
    AND lt.status = 'posted'
    AND lt.created_at BETWEEN v_start AND v_end;

  -- Refunds
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_refunds
  FROM financial_intents
  WHERE tenant_id = p_tenant_id
    AND status = 'succeeded'
    AND intent_type = 'refund'
    AND created_at BETWEEN v_start AND v_end;

  -- Dispute losses
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_dispute_losses
  FROM disputes
  WHERE tenant_id = p_tenant_id
    AND status = 'lost'
    AND updated_at BETWEEN v_start AND v_end;

  -- Active holds
  SELECT COUNT(*), COALESCE(SUM(amount_cents), 0) INTO v_held_count, v_active_holds
  FROM payout_requests pr
  JOIN profiles p ON p.id = pr.user_id
  WHERE p.tenant_id = p_tenant_id
    AND pr.is_on_hold = TRUE;

  -- Disputes at risk
  SELECT COUNT(*), COALESCE(SUM(amount_cents), 0) INTO v_disputes_count, v_disputes_at_risk
  FROM disputes
  WHERE tenant_id = p_tenant_id
    AND status IN ('needs_response', 'under_review');

  -- Pending payouts
  SELECT COUNT(*), COALESCE(SUM(amount_cents), 0) INTO v_pending_payout_count, v_pending_payouts
  FROM payout_requests pr
  JOIN profiles p ON p.id = pr.user_id
  WHERE p.tenant_id = p_tenant_id
    AND pr.status IN ('pending', 'eligible', 'approved');

  -- Escrow balance
  SELECT COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_cents
         WHEN le.direction = 'debit' THEN -le.amount_cents
         ELSE 0 END
  ), 0) INTO v_escrow_balance
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'escrow'
    AND lt.status = 'posted';

  RETURN jsonb_build_object(
    'period', jsonb_build_object('start', v_start, 'end', v_end),
    'gmv_cents', v_gmv,
    'platform_revenue_cents', v_platform_revenue,
    'refunds_cents', v_refunds,
    'dispute_losses_cents', v_dispute_losses,
    'net_revenue_cents', v_platform_revenue - v_dispute_losses,
    'active_holds', jsonb_build_object('count', v_held_count, 'amount_cents', v_active_holds),
    'disputes_at_risk', jsonb_build_object('count', v_disputes_count, 'amount_cents', v_disputes_at_risk),
    'pending_payouts', jsonb_build_object('count', v_pending_payout_count, 'amount_cents', v_pending_payouts),
    'escrow_balance_cents', v_escrow_balance,
    'generated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Get all payouts with filters
CREATE OR REPLACE FUNCTION get_admin_payouts(
  p_tenant_id UUID,
  p_status TEXT DEFAULT NULL,
  p_is_held BOOLEAN DEFAULT NULL,
  p_min_amount INTEGER DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_payouts JSONB;
  v_total INTEGER;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'finance')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM payout_requests pr
  JOIN profiles p ON p.id = pr.user_id
  WHERE p.tenant_id = p_tenant_id
    AND (p_status IS NULL OR pr.status = p_status)
    AND (p_is_held IS NULL OR pr.is_on_hold = p_is_held)
    AND (p_min_amount IS NULL OR pr.amount_cents >= p_min_amount);

  SELECT jsonb_agg(row_to_json(t)) INTO v_payouts
  FROM (
    SELECT
      pr.id,
      pr.user_id,
      pr.tournament_id,
      pr.amount_cents,
      pr.net_amount_cents,
      pr.placement,
      pr.status,
      pr.is_on_hold,
      pr.hold_reason,
      pr.hold_until,
      pr.failure_count,
      pr.failure_reason,
      pr.stripe_transfer_id,
      pr.created_at,
      pr.processed_at,
      p.display_name AS user_display_name,
      p.email AS user_email,
      p.stripe_connect_account_id,
      p.stripe_connect_payouts_enabled,
      t.name AS tournament_name
    FROM payout_requests pr
    JOIN profiles p ON p.id = pr.user_id
    LEFT JOIN tournaments t ON t.id = pr.tournament_id
    WHERE p.tenant_id = p_tenant_id
      AND (p_status IS NULL OR pr.status = p_status)
      AND (p_is_held IS NULL OR pr.is_on_hold = p_is_held)
      AND (p_min_amount IS NULL OR pr.amount_cents >= p_min_amount)
    ORDER BY
      CASE WHEN pr.is_on_hold = TRUE THEN 0 ELSE 1 END,
      CASE pr.status
        WHEN 'pending' THEN 0
        WHEN 'eligible' THEN 1
        WHEN 'approved' THEN 2
        WHEN 'processing' THEN 3
        WHEN 'blocked' THEN 4
        WHEN 'failed' THEN 5
        ELSE 6
      END,
      pr.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'payouts', COALESCE(v_payouts, '[]'::jsonb),
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Get all disputes with filters
CREATE OR REPLACE FUNCTION get_admin_disputes(
  p_tenant_id UUID,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_disputes JSONB;
  v_total INTEGER;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'finance')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM disputes
  WHERE tenant_id = p_tenant_id
    AND (p_status IS NULL OR status = p_status);

  SELECT jsonb_agg(row_to_json(t)) INTO v_disputes
  FROM (
    SELECT
      d.id,
      d.stripe_dispute_id,
      d.stripe_charge_id,
      d.original_intent_id,
      d.user_id,
      d.organizer_id,
      d.amount_cents,
      d.reason,
      d.status,
      d.evidence_submitted,
      d.evidence_due_by,
      d.resolution,
      d.organizer_liability_cents,
      d.liability_collected,
      d.created_at,
      d.updated_at,
      p.display_name AS user_display_name,
      p.email AS user_email,
      op.display_name AS organizer_display_name,
      fi.intent_type AS original_intent_type,
      fi.reference_id,
      fi.reference_type
    FROM disputes d
    LEFT JOIN profiles p ON p.id = d.user_id
    LEFT JOIN profiles op ON op.id = d.organizer_id
    LEFT JOIN financial_intents fi ON fi.id = d.original_intent_id
    WHERE d.tenant_id = p_tenant_id
      AND (p_status IS NULL OR d.status = p_status)
    ORDER BY
      CASE d.status
        WHEN 'needs_response' THEN 0
        WHEN 'under_review' THEN 1
        ELSE 2
      END,
      d.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'disputes', COALESCE(v_disputes, '[]'::jsonb),
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Get all refunds with filters
CREATE OR REPLACE FUNCTION get_admin_refunds(
  p_tenant_id UUID,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_refunds JSONB;
  v_total INTEGER;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'finance')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM financial_intents
  WHERE tenant_id = p_tenant_id
    AND intent_type = 'refund'
    AND (p_status IS NULL OR status = p_status);

  SELECT jsonb_agg(row_to_json(t)) INTO v_refunds
  FROM (
    SELECT
      fi.id,
      fi.user_id,
      fi.amount_cents,
      fi.status,
      fi.original_intent_id,
      fi.reference_type,
      fi.reference_id,
      fi.stripe_refund_id,
      fi.created_at,
      fi.reconciled_at,
      fi.metadata->>'reason' AS reason,
      fi.metadata->>'initiated_by' AS initiated_by,
      p.display_name AS user_display_name,
      p.email AS user_email,
      orig.amount_cents AS original_amount_cents,
      orig.intent_type AS original_intent_type
    FROM financial_intents fi
    LEFT JOIN profiles p ON p.id = fi.user_id
    LEFT JOIN financial_intents orig ON orig.id = fi.original_intent_id
    WHERE fi.tenant_id = p_tenant_id
      AND fi.intent_type = 'refund'
      AND (p_status IS NULL OR fi.status = p_status)
    ORDER BY fi.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'refunds', COALESCE(v_refunds, '[]'::jsonb),
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Admin action: Approve payout
CREATE OR REPLACE FUNCTION admin_approve_payout(p_payout_id UUID, p_admin_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'finance')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT * INTO v_payout FROM payout_requests WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not found');
  END IF;

  IF v_payout.status NOT IN ('pending', 'eligible') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not in approvable state: ' || v_payout.status);
  END IF;

  IF v_payout.is_on_hold = TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout is on hold: ' || COALESCE(v_payout.hold_reason, 'Unknown reason'));
  END IF;

  UPDATE payout_requests
  SET status = 'approved', updated_at = NOW()
  WHERE id = p_payout_id;

  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (COALESCE(p_admin_id, auth.uid()), 'admin_payout_approved', 'payout_request', p_payout_id,
    jsonb_build_object('amount_cents', v_payout.amount_cents, 'user_id', v_payout.user_id));

  RETURN jsonb_build_object('success', true, 'payout_id', p_payout_id, 'new_status', 'approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Admin action: Reject payout
CREATE OR REPLACE FUNCTION admin_reject_payout(p_payout_id UUID, p_reason TEXT, p_admin_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'finance')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT * INTO v_payout FROM payout_requests WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not found');
  END IF;

  UPDATE payout_requests
  SET status = 'blocked', failure_reason = p_reason, updated_at = NOW()
  WHERE id = p_payout_id;

  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (COALESCE(p_admin_id, auth.uid()), 'admin_payout_rejected', 'payout_request', p_payout_id,
    jsonb_build_object('reason', p_reason, 'amount_cents', v_payout.amount_cents, 'user_id', v_payout.user_id));

  RETURN jsonb_build_object('success', true, 'payout_id', p_payout_id, 'new_status', 'blocked');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Admin action: Mark dispute evidence submitted
CREATE OR REPLACE FUNCTION admin_submit_dispute_evidence(p_dispute_id UUID, p_admin_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_dispute RECORD;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'finance')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT * INTO v_dispute FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute not found');
  END IF;

  UPDATE disputes
  SET evidence_submitted = TRUE, status = 'under_review', updated_at = NOW()
  WHERE id = p_dispute_id;

  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (COALESCE(p_admin_id, auth.uid()), 'admin_dispute_evidence_submitted', 'dispute', p_dispute_id,
    jsonb_build_object('stripe_dispute_id', v_dispute.stripe_dispute_id, 'amount_cents', v_dispute.amount_cents));

  RETURN jsonb_build_object('success', true, 'dispute_id', p_dispute_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Admin action: Force refund
CREATE OR REPLACE FUNCTION admin_force_refund(p_intent_id UUID, p_amount_cents INTEGER, p_reason TEXT, p_admin_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_refund_result JSONB;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager')) THEN
      RAISE EXCEPTION 'Unauthorized: Only owner/manager can force refunds';
    END IF;
  END IF;

  v_refund_result := create_refund_intent(p_intent_id, p_amount_cents, 'Admin forced: ' || p_reason, COALESCE(p_admin_id, auth.uid()));

  IF (v_refund_result->>'success')::boolean = true THEN
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
    VALUES (COALESCE(p_admin_id, auth.uid()), 'admin_force_refund', 'financial_intent', p_intent_id,
      jsonb_build_object('amount_cents', p_amount_cents, 'reason', p_reason, 'refund_intent_id', v_refund_result->>'refund_intent_id'));
  END IF;

  RETURN v_refund_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
GRANT EXECUTE ON FUNCTION get_admin_financial_kpis(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_payouts(UUID, TEXT, BOOLEAN, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_disputes(UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_refunds(UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_approve_payout(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reject_payout(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_submit_dispute_evidence(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_force_refund(UUID, INTEGER, TEXT, UUID) TO authenticated;
