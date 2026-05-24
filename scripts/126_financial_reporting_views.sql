-- =====================================================
-- FINANCIAL REPORTING VIEWS
-- Real-time financial visibility for platform and organizers
-- =====================================================

-- =====================================================
-- Platform-wide financial summary
-- =====================================================
CREATE OR REPLACE VIEW v_financial_summary AS
SELECT
  la.tenant_id,
  
  -- Gross volume (all incoming payments)
  COALESCE(SUM(le.amount_cents) FILTER (
    WHERE la.account_type = 'stripe_clearing' AND le.direction = 'debit'
  ), 0) AS gross_volume_cents,
  
  -- Platform revenue (fees collected)
  COALESCE(SUM(le.amount_cents) FILTER (
    WHERE la.account_type = 'platform_revenue' AND le.direction = 'credit'
  ), 0) AS platform_revenue_cents,
  
  -- Total refunds issued
  COALESCE(SUM(le.amount_cents) FILTER (
    WHERE la.account_type = 'refunds' AND le.direction = 'credit'
  ), 0) AS total_refunds_cents,
  
  -- Dispute losses
  COALESCE(SUM(le.amount_cents) FILTER (
    WHERE la.account_type = 'dispute_losses' AND le.direction = 'credit'
  ), 0) AS dispute_losses_cents,
  
  -- Total payouts sent
  COALESCE(SUM(le.amount_cents) FILTER (
    WHERE la.account_type = 'bank_transfers' AND le.direction = 'credit'
  ), 0) AS total_payouts_cents,
  
  -- Current escrow balance
  COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_cents
         WHEN le.direction = 'debit' THEN -le.amount_cents
         ELSE 0 END
  ) FILTER (WHERE la.account_type = 'escrow'), 0) AS escrow_balance_cents,
  
  -- Transaction counts
  COUNT(DISTINCT lt.id) FILTER (WHERE lt.transaction_type = 'deposit') AS deposit_count,
  COUNT(DISTINCT lt.id) FILTER (WHERE lt.transaction_type = 'refund') AS refund_count,
  COUNT(DISTINCT lt.id) FILTER (WHERE lt.transaction_type = 'payout') AS payout_count

FROM ledger_entries le
JOIN ledger_accounts la ON la.id = le.account_id
JOIN ledger_transactions lt ON lt.id = le.transaction_id
WHERE lt.status = 'posted'
GROUP BY la.tenant_id;

-- =====================================================
-- Tournament-level financials
-- =====================================================
CREATE OR REPLACE VIEW v_tournament_financials AS
SELECT
  t.id AS tournament_id,
  t.name AS tournament_name,
  t.tenant_id,
  t.organizer_id,
  t.status AS tournament_status,
  
  -- Gross entry fees collected
  COALESCE(SUM(le.amount_cents) FILTER (
    WHERE la.account_type = 'stripe_clearing' 
      AND le.direction = 'debit'
      AND lt.reference_type = 'tournament_entry'
  ), 0) AS gross_entries_cents,
  
  -- Platform fees taken
  COALESCE(SUM(le.amount_cents) FILTER (
    WHERE la.account_type = 'platform_revenue'
      AND le.direction = 'credit'
      AND lt.reference_type = 'tournament_entry'
  ), 0) AS platform_fees_cents,
  
  -- Current escrow balance (for this tournament)
  COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_cents
         WHEN le.direction = 'debit' THEN -le.amount_cents
         ELSE 0 END
  ) FILTER (WHERE la.account_type = 'escrow' AND la.reference_id = t.id), 0) AS escrow_balance_cents,
  
  -- Payouts executed
  COALESCE(SUM(le.amount_cents) FILTER (
    WHERE la.account_type = 'payout_clearing'
      AND le.direction = 'credit'
      AND lt.reference_type = 'tournament_payout'
  ), 0) AS payouts_executed_cents,
  
  -- Refunds issued
  COALESCE(SUM(le.amount_cents) FILTER (
    WHERE la.account_type = 'refunds'
      AND le.direction = 'credit'
      AND lt.reference_id::uuid = t.id
  ), 0) AS refunds_cents,
  
  -- Entry count
  COUNT(DISTINCT fi.id) FILTER (WHERE fi.intent_type = 'tournament_entry' AND fi.status = 'succeeded') AS entry_count,
  
  -- Refund count
  COUNT(DISTINCT fi.id) FILTER (WHERE fi.intent_type = 'refund' AND fi.status = 'succeeded') AS refund_count

FROM tournaments t
LEFT JOIN financial_intents fi ON fi.reference_id = t.id AND fi.reference_type = 'tournament'
LEFT JOIN ledger_transactions lt ON lt.reference_id = t.id OR lt.reference_id = fi.id
LEFT JOIN ledger_entries le ON le.transaction_id = lt.id
LEFT JOIN ledger_accounts la ON la.id = le.account_id
GROUP BY t.id, t.name, t.tenant_id, t.organizer_id, t.status;

-- =====================================================
-- Dispute exposure view
-- =====================================================
CREATE OR REPLACE VIEW v_dispute_exposure AS
SELECT
  d.tenant_id,
  
  -- Active disputes
  COUNT(*) FILTER (WHERE d.status IN ('needs_response', 'under_review')) AS active_disputes,
  
  -- Amount at risk
  COALESCE(SUM(d.amount_cents) FILTER (WHERE d.status IN ('needs_response', 'under_review')), 0) AS at_risk_cents,
  
  -- Won disputes
  COUNT(*) FILTER (WHERE d.status = 'won') AS won_count,
  COALESCE(SUM(d.amount_cents) FILTER (WHERE d.status = 'won'), 0) AS won_amount_cents,
  
  -- Lost disputes
  COUNT(*) FILTER (WHERE d.status = 'lost') AS lost_count,
  COALESCE(SUM(d.amount_cents) FILTER (WHERE d.status = 'lost'), 0) AS lost_amount_cents,
  
  -- Win rate
  CASE 
    WHEN COUNT(*) FILTER (WHERE d.status IN ('won', 'lost')) > 0 
    THEN ROUND(100.0 * COUNT(*) FILTER (WHERE d.status = 'won') / 
               COUNT(*) FILTER (WHERE d.status IN ('won', 'lost')), 2)
    ELSE NULL 
  END AS win_rate_percent,
  
  -- Total organizer liability
  COALESCE(SUM(d.organizer_liability_cents), 0) AS total_organizer_liability_cents

FROM disputes d
GROUP BY d.tenant_id;

-- =====================================================
-- Payout status view
-- =====================================================
CREATE OR REPLACE VIEW v_payout_status AS
SELECT
  pr.tenant_id,
  
  -- By status
  COUNT(*) FILTER (WHERE pr.status = 'pending') AS pending_count,
  COALESCE(SUM(pr.amount_cents) FILTER (WHERE pr.status = 'pending'), 0) AS pending_amount_cents,
  
  COUNT(*) FILTER (WHERE pr.status = 'eligible') AS eligible_count,
  COALESCE(SUM(pr.amount_cents) FILTER (WHERE pr.status = 'eligible'), 0) AS eligible_amount_cents,
  
  COUNT(*) FILTER (WHERE pr.status = 'processing') AS processing_count,
  COALESCE(SUM(pr.amount_cents) FILTER (WHERE pr.status = 'processing'), 0) AS processing_amount_cents,
  
  COUNT(*) FILTER (WHERE pr.status = 'completed') AS completed_count,
  COALESCE(SUM(pr.amount_cents) FILTER (WHERE pr.status = 'completed'), 0) AS completed_amount_cents,
  
  COUNT(*) FILTER (WHERE pr.status = 'blocked') AS blocked_count,
  COALESCE(SUM(pr.amount_cents) FILTER (WHERE pr.status = 'blocked'), 0) AS blocked_amount_cents,
  
  -- Held payouts
  COUNT(*) FILTER (WHERE pr.is_on_hold = TRUE) AS held_count,
  COALESCE(SUM(pr.amount_cents) FILTER (WHERE pr.is_on_hold = TRUE), 0) AS held_amount_cents

FROM payout_requests pr
GROUP BY pr.tenant_id;

-- =====================================================
-- Organizer financials view
-- =====================================================
CREATE OR REPLACE VIEW v_organizer_financials AS
SELECT
  p.id AS organizer_id,
  p.display_name AS organizer_name,
  p.email AS organizer_email,
  t.tenant_id,
  
  -- Tournament counts
  COUNT(DISTINCT t.id) AS total_tournaments,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed') AS completed_tournaments,
  
  -- Revenue generated
  COALESCE(SUM(tf.gross_entries_cents), 0) AS gross_volume_cents,
  COALESCE(SUM(tf.platform_fees_cents), 0) AS fees_paid_cents,
  COALESCE(SUM(tf.gross_entries_cents - tf.platform_fees_cents), 0) AS net_to_escrow_cents,
  
  -- Payouts
  COALESCE(SUM(tf.payouts_executed_cents), 0) AS total_payouts_cents,
  
  -- Refunds
  COALESCE(SUM(tf.refunds_cents), 0) AS total_refunds_cents,
  
  -- Disputes
  COUNT(DISTINCT d.id) AS total_disputes,
  COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'lost') AS lost_disputes,
  COALESCE(SUM(d.organizer_liability_cents), 0) AS liability_cents

FROM profiles p
JOIN tournaments t ON t.organizer_id = p.id
LEFT JOIN v_tournament_financials tf ON tf.tournament_id = t.id
LEFT JOIN disputes d ON d.organizer_id = p.id
GROUP BY p.id, p.display_name, p.email, t.tenant_id;

-- =====================================================
-- RPC: get_financial_dashboard (for authenticated users)
-- =====================================================
CREATE OR REPLACE FUNCTION get_financial_dashboard(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_summary RECORD;
  v_disputes RECORD;
  v_payouts RECORD;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  
  -- Only staff or service_role can access
  IF v_caller_role != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'manager', 'finance')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- Get financial summary
  SELECT * INTO v_summary
  FROM v_financial_summary
  WHERE tenant_id = p_tenant_id;

  -- Get dispute exposure
  SELECT * INTO v_disputes
  FROM v_dispute_exposure
  WHERE tenant_id = p_tenant_id;

  -- Get payout status
  SELECT * INTO v_payouts
  FROM v_payout_status
  WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'gross_volume_cents', COALESCE(v_summary.gross_volume_cents, 0),
      'platform_revenue_cents', COALESCE(v_summary.platform_revenue_cents, 0),
      'total_refunds_cents', COALESCE(v_summary.total_refunds_cents, 0),
      'dispute_losses_cents', COALESCE(v_summary.dispute_losses_cents, 0),
      'total_payouts_cents', COALESCE(v_summary.total_payouts_cents, 0),
      'escrow_balance_cents', COALESCE(v_summary.escrow_balance_cents, 0),
      'net_revenue_cents', COALESCE(v_summary.platform_revenue_cents, 0) - COALESCE(v_summary.dispute_losses_cents, 0)
    ),
    'disputes', jsonb_build_object(
      'active_count', COALESCE(v_disputes.active_disputes, 0),
      'at_risk_cents', COALESCE(v_disputes.at_risk_cents, 0),
      'won_count', COALESCE(v_disputes.won_count, 0),
      'lost_count', COALESCE(v_disputes.lost_count, 0),
      'win_rate_percent', v_disputes.win_rate_percent
    ),
    'payouts', jsonb_build_object(
      'pending_count', COALESCE(v_payouts.pending_count, 0),
      'pending_cents', COALESCE(v_payouts.pending_amount_cents, 0),
      'eligible_count', COALESCE(v_payouts.eligible_count, 0),
      'eligible_cents', COALESCE(v_payouts.eligible_amount_cents, 0),
      'processing_count', COALESCE(v_payouts.processing_count, 0),
      'completed_count', COALESCE(v_payouts.completed_count, 0),
      'completed_cents', COALESCE(v_payouts.completed_amount_cents, 0),
      'held_count', COALESCE(v_payouts.held_count, 0),
      'held_cents', COALESCE(v_payouts.held_amount_cents, 0)
    ),
    'generated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RPC: get_organizer_dashboard (for organizers)
-- =====================================================
CREATE OR REPLACE FUNCTION get_organizer_dashboard(p_organizer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tournaments JSONB;
  v_totals RECORD;
  v_disputes RECORD;
BEGIN
  -- Verify caller is the organizer or staff
  IF auth.role() != 'service_role' THEN
    IF auth.uid() != p_organizer_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM staff_roles
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'manager')
      ) THEN
        RAISE EXCEPTION 'Unauthorized';
      END IF;
    END IF;
  END IF;

  -- Get tournament list with financials
  SELECT jsonb_agg(
    jsonb_build_object(
      'tournament_id', tf.tournament_id,
      'tournament_name', tf.tournament_name,
      'status', tf.tournament_status,
      'gross_entries_cents', tf.gross_entries_cents,
      'platform_fees_cents', tf.platform_fees_cents,
      'escrow_balance_cents', tf.escrow_balance_cents,
      'payouts_executed_cents', tf.payouts_executed_cents,
      'entry_count', tf.entry_count,
      'refund_count', tf.refund_count
    )
  ) INTO v_tournaments
  FROM v_tournament_financials tf
  WHERE tf.organizer_id = p_organizer_id
  ORDER BY tf.tournament_id DESC
  LIMIT 20;

  -- Get totals
  SELECT
    COALESCE(SUM(gross_entries_cents), 0) as gross,
    COALESCE(SUM(platform_fees_cents), 0) as fees,
    COALESCE(SUM(payouts_executed_cents), 0) as payouts,
    COALESCE(SUM(refunds_cents), 0) as refunds,
    COUNT(*) as tournament_count
  INTO v_totals
  FROM v_tournament_financials
  WHERE organizer_id = p_organizer_id;

  -- Get dispute info
  SELECT
    COUNT(*) FILTER (WHERE status IN ('needs_response', 'under_review')) as active,
    COUNT(*) FILTER (WHERE status = 'lost') as lost,
    COALESCE(SUM(organizer_liability_cents), 0) as liability
  INTO v_disputes
  FROM disputes
  WHERE organizer_id = p_organizer_id;

  RETURN jsonb_build_object(
    'organizer_id', p_organizer_id,
    'totals', jsonb_build_object(
      'gross_volume_cents', v_totals.gross,
      'fees_paid_cents', v_totals.fees,
      'net_earned_cents', v_totals.gross - v_totals.fees,
      'payouts_received_cents', v_totals.payouts,
      'refunds_issued_cents', v_totals.refunds,
      'tournament_count', v_totals.tournament_count
    ),
    'disputes', jsonb_build_object(
      'active_count', COALESCE(v_disputes.active, 0),
      'lost_count', COALESCE(v_disputes.lost, 0),
      'liability_cents', COALESCE(v_disputes.liability, 0)
    ),
    'tournaments', COALESCE(v_tournaments, '[]'::jsonb),
    'generated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Permissions
-- =====================================================
GRANT SELECT ON v_financial_summary TO authenticated;
GRANT SELECT ON v_tournament_financials TO authenticated;
GRANT SELECT ON v_dispute_exposure TO authenticated;
GRANT SELECT ON v_payout_status TO authenticated;
GRANT SELECT ON v_organizer_financials TO authenticated;

GRANT EXECUTE ON FUNCTION get_financial_dashboard(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_organizer_dashboard(UUID) TO authenticated;
