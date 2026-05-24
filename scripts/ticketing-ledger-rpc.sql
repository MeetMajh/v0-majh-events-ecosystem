-- MAJH TICKETING LEDGER INTEGRATION
-- Records ticket sales in the double-entry ledger

-- ===========================================
-- LEDGER TICKET SALE (Stripe → Event Revenue)
-- ===========================================
DROP FUNCTION IF EXISTS ledger_ticket_sale(UUID, UUID, BIGINT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION ledger_ticket_sale(
  p_tenant_id UUID,
  p_order_id UUID,
  p_amount_cents BIGINT,
  p_stripe_session_id TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_clearing_account UUID;
  v_revenue_account UUID;
  v_platform_fee_account UUID;
  v_entries JSONB;
  v_platform_fee BIGINT;
  v_net_revenue BIGINT;
  v_order RECORD;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM ticket_orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Calculate platform fee (e.g., 5%)
  v_platform_fee := (p_amount_cents * 5) / 100;
  v_net_revenue := p_amount_cents - v_platform_fee;
  
  -- Get or create accounts
  v_clearing_account := get_or_create_ledger_account(p_tenant_id, 'stripe_clearing', NULL, 'Stripe Clearing');
  v_revenue_account := get_or_create_ledger_account(p_tenant_id, 'event_revenue', v_order.event_id, 'Event Revenue');
  v_platform_fee_account := get_or_create_ledger_account(p_tenant_id, 'platform_revenue', NULL, 'Platform Revenue');
  
  -- Double-entry: Debit clearing (asset increases), Credit revenue (revenue increases), Credit platform (fees)
  v_entries := jsonb_build_array(
    jsonb_build_object('account_id', v_clearing_account, 'direction', 'debit', 'amount_cents', p_amount_cents),
    jsonb_build_object('account_id', v_revenue_account, 'direction', 'credit', 'amount_cents', v_net_revenue),
    jsonb_build_object('account_id', v_platform_fee_account, 'direction', 'credit', 'amount_cents', v_platform_fee)
  );
  
  RETURN post_ledger_transaction(
    p_tenant_id,
    'deposit',
    v_entries,
    p_order_id,
    'ticket_order',
    'Ticket sale: ' || v_order.order_number || ' via Stripe',
    COALESCE(p_idempotency_key, 'ticket_sale_' || p_stripe_session_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- LEDGER TICKET REFUND
-- ===========================================
DROP FUNCTION IF EXISTS ledger_ticket_refund(UUID, UUID, BIGINT, TEXT);

CREATE OR REPLACE FUNCTION ledger_ticket_refund(
  p_tenant_id UUID,
  p_order_id UUID,
  p_refund_amount_cents BIGINT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_clearing_account UUID;
  v_revenue_account UUID;
  v_refunds_account UUID;
  v_entries JSONB;
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM ticket_orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Get accounts (reverses the sale)
  v_clearing_account := get_or_create_ledger_account(p_tenant_id, 'stripe_clearing', NULL, 'Stripe Clearing');
  v_revenue_account := get_or_create_ledger_account(p_tenant_id, 'event_revenue', v_order.event_id, 'Event Revenue');
  v_refunds_account := get_or_create_ledger_account(p_tenant_id, 'refunds', NULL, 'Refunds');
  
  -- Reverse entry: Credit clearing, Debit revenue, Debit refunds tracking
  v_entries := jsonb_build_array(
    jsonb_build_object('account_id', v_clearing_account, 'direction', 'credit', 'amount_cents', p_refund_amount_cents),
    jsonb_build_object('account_id', v_revenue_account, 'direction', 'debit', 'amount_cents', p_refund_amount_cents)
  );
  
  RETURN post_ledger_transaction(
    p_tenant_id,
    'refund',
    v_entries,
    p_order_id,
    'ticket_refund',
    'Ticket refund: ' || v_order.order_number,
    COALESCE(p_idempotency_key, 'ticket_refund_' || p_order_id::text || '_' || NOW()::text)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- GET EVENT REVENUE SUMMARY
-- ===========================================
DROP FUNCTION IF EXISTS get_event_revenue_summary(UUID, UUID);

CREATE OR REPLACE FUNCTION get_event_revenue_summary(
  p_tenant_id UUID,
  p_event_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_gross_revenue BIGINT;
  v_refunds BIGINT;
  v_net_revenue BIGINT;
  v_ticket_count INT;
  v_check_ins INT;
BEGIN
  -- Calculate from ledger
  SELECT COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_cents ELSE -le.amount_cents END
  ), 0) INTO v_gross_revenue
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'event_revenue'
    AND la.reference_id = p_event_id
    AND lt.status = 'posted';
  
  -- Calculate refunds
  SELECT COALESCE(SUM(le.amount_cents), 0) INTO v_refunds
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'event_revenue'
    AND la.reference_id = p_event_id
    AND lt.transaction_type = 'refund'
    AND lt.status = 'posted';
  
  v_net_revenue := v_gross_revenue;
  
  -- Get ticket stats
  SELECT COUNT(*) INTO v_ticket_count
  FROM tickets WHERE tenant_id = p_tenant_id AND event_id = p_event_id AND status != 'cancelled';
  
  SELECT COUNT(*) INTO v_check_ins
  FROM tickets WHERE tenant_id = p_tenant_id AND event_id = p_event_id AND status = 'used';
  
  RETURN json_build_object(
    'event_id', p_event_id,
    'gross_revenue_cents', v_gross_revenue + v_refunds,
    'refunds_cents', v_refunds,
    'net_revenue_cents', v_net_revenue,
    'tickets_sold', v_ticket_count,
    'tickets_checked_in', v_check_ins,
    'check_in_rate', CASE WHEN v_ticket_count > 0 THEN ROUND((v_check_ins::numeric / v_ticket_count) * 100, 1) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- GET TENANT TICKETING SUMMARY
-- ===========================================
DROP FUNCTION IF EXISTS get_tenant_ticketing_summary(UUID);

CREATE OR REPLACE FUNCTION get_tenant_ticketing_summary(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total_revenue BIGINT;
  v_total_tickets INT;
  v_total_events INT;
  v_active_events INT;
  v_upcoming_events INT;
BEGIN
  -- Revenue from ledger
  SELECT COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_cents ELSE -le.amount_cents END
  ), 0) INTO v_total_revenue
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'event_revenue'
    AND lt.status = 'posted';
  
  -- Ticket counts
  SELECT COUNT(*) INTO v_total_tickets
  FROM tickets WHERE tenant_id = p_tenant_id AND status != 'cancelled';
  
  -- Event counts
  SELECT COUNT(*) INTO v_total_events FROM events WHERE tenant_id = p_tenant_id;
  SELECT COUNT(*) INTO v_active_events FROM events WHERE tenant_id = p_tenant_id AND status = 'published';
  SELECT COUNT(*) INTO v_upcoming_events FROM events WHERE tenant_id = p_tenant_id AND status = 'published' AND start_date > NOW();
  
  RETURN json_build_object(
    'total_revenue_cents', v_total_revenue,
    'total_tickets_sold', v_total_tickets,
    'total_events', v_total_events,
    'active_events', v_active_events,
    'upcoming_events', v_upcoming_events
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- GRANTS
GRANT EXECUTE ON FUNCTION ledger_ticket_sale(UUID, UUID, BIGINT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION ledger_ticket_refund(UUID, UUID, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_revenue_summary(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_ticketing_summary(UUID) TO authenticated;
