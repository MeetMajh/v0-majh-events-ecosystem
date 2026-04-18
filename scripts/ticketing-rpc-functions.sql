-- MAJH TICKETING RPC FUNCTIONS
-- Part 2: Atomic Operations

-- ===========================================
-- ADD LEDGER ACCOUNT TYPE FOR TICKETING
-- ===========================================
ALTER TABLE ledger_accounts 
DROP CONSTRAINT IF EXISTS ledger_accounts_account_type_check;

ALTER TABLE ledger_accounts 
ADD CONSTRAINT ledger_accounts_account_type_check 
CHECK (account_type IN (
  'user_wallet',
  'escrow',
  'platform_revenue',
  'stripe_clearing',
  'pending_withdrawals',
  'payouts',
  'fees',
  'refunds',
  'deferred_revenue',
  'event_revenue',
  'ticket_sales'
));

-- ===========================================
-- GENERATE ORDER NUMBER
-- ===========================================
CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_count INT;
BEGIN
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_count
  FROM ticket_orders WHERE tenant_id = p_tenant_id;
  
  v_prefix := 'ORD';
  RETURN v_prefix || '-' || LPAD(v_count::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- GENERATE TICKET NUMBER
-- ===========================================
CREATE OR REPLACE FUNCTION generate_ticket_number(p_tenant_id UUID, p_event_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_event_slug TEXT;
  v_count INT;
BEGIN
  SELECT slug INTO v_event_slug FROM events WHERE id = p_event_id;
  
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_count
  FROM tickets WHERE tenant_id = p_tenant_id AND event_id = p_event_id;
  
  RETURN UPPER(SUBSTRING(v_event_slug FROM 1 FOR 4)) || '-' || LPAD(v_count::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- CHECK TICKET AVAILABILITY
-- ===========================================
CREATE OR REPLACE FUNCTION check_ticket_availability(
  p_ticket_type_id UUID,
  p_quantity INT
)
RETURNS JSON AS $$
DECLARE
  v_type RECORD;
  v_available INT;
BEGIN
  SELECT * INTO v_type FROM ticket_types WHERE id = p_ticket_type_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('available', false, 'error', 'Ticket type not found');
  END IF;
  
  v_available := v_type.quantity_total - v_type.quantity_sold - v_type.quantity_reserved;
  
  IF v_available < p_quantity THEN
    RETURN json_build_object(
      'available', false, 
      'error', 'Not enough tickets available',
      'requested', p_quantity,
      'remaining', v_available
    );
  END IF;
  
  IF v_type.sales_start_at IS NOT NULL AND NOW() < v_type.sales_start_at THEN
    RETURN json_build_object('available', false, 'error', 'Sales have not started');
  END IF;
  
  IF v_type.sales_end_at IS NOT NULL AND NOW() > v_type.sales_end_at THEN
    RETURN json_build_object('available', false, 'error', 'Sales have ended');
  END IF;
  
  IF p_quantity < v_type.min_per_order THEN
    RETURN json_build_object('available', false, 'error', 'Minimum order quantity is ' || v_type.min_per_order);
  END IF;
  
  IF p_quantity > v_type.max_per_order THEN
    RETURN json_build_object('available', false, 'error', 'Maximum order quantity is ' || v_type.max_per_order);
  END IF;
  
  RETURN json_build_object(
    'available', true,
    'ticket_type', v_type.name,
    'unit_price_cents', v_type.price_cents,
    'total_cents', v_type.price_cents * p_quantity,
    'remaining', v_available
  );
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- CREATE TICKET ORDER (ATOMIC)
-- ===========================================
CREATE OR REPLACE FUNCTION create_ticket_order(
  p_tenant_id UUID,
  p_event_id UUID,
  p_user_id UUID,
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_items JSONB, -- [{ticket_type_id, quantity}]
  p_promo_code TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_item JSONB;
  v_ticket_type RECORD;
  v_subtotal INT := 0;
  v_fees INT := 0;
  v_discount INT := 0;
  v_total INT := 0;
  v_promo RECORD;
  v_quantity INT;
  v_item_total INT;
  v_ticket_id UUID;
  v_existing_order UUID;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_order 
    FROM ticket_orders 
    WHERE tenant_id = p_tenant_id 
    AND metadata->>'idempotency_key' = p_idempotency_key;
    
    IF FOUND THEN
      RETURN json_build_object('success', true, 'duplicate', true, 'order_id', v_existing_order);
    END IF;
  END IF;

  -- Validate promo code if provided
  IF p_promo_code IS NOT NULL THEN
    SELECT * INTO v_promo 
    FROM promo_codes 
    WHERE tenant_id = p_tenant_id 
    AND code = UPPER(p_promo_code)
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until >= NOW())
    AND (max_uses IS NULL OR times_used < max_uses);
    
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Invalid promo code');
    END IF;
  END IF;

  -- Generate order number
  v_order_number := generate_order_number(p_tenant_id);
  
  -- Create order (pending)
  INSERT INTO ticket_orders (
    tenant_id, event_id, user_id, order_number, email, first_name, last_name,
    status, promo_code_id, metadata
  ) VALUES (
    p_tenant_id, p_event_id, p_user_id, v_order_number, p_email, p_first_name, p_last_name,
    'pending', v_promo.id, jsonb_build_object('idempotency_key', p_idempotency_key)
  ) RETURNING id INTO v_order_id;

  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::int;
    
    -- Lock and validate ticket type
    SELECT * INTO v_ticket_type 
    FROM ticket_types 
    WHERE id = (v_item->>'ticket_type_id')::uuid
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket type not found';
    END IF;
    
    IF v_ticket_type.quantity_total - v_ticket_type.quantity_sold - v_ticket_type.quantity_reserved < v_quantity THEN
      RAISE EXCEPTION 'Not enough tickets available for %', v_ticket_type.name;
    END IF;
    
    v_item_total := v_ticket_type.price_cents * v_quantity;
    v_subtotal := v_subtotal + v_item_total;
    
    -- Create order item
    INSERT INTO ticket_order_items (order_id, ticket_type_id, quantity, unit_price_cents, total_cents)
    VALUES (v_order_id, v_ticket_type.id, v_quantity, v_ticket_type.price_cents, v_item_total);
    
    -- Reserve tickets
    UPDATE ticket_types 
    SET quantity_reserved = quantity_reserved + v_quantity
    WHERE id = v_ticket_type.id;
    
    -- Create individual tickets
    FOR i IN 1..v_quantity LOOP
      INSERT INTO tickets (
        tenant_id, event_id, ticket_type_id, order_id, owner_user_id,
        attendee_email, attendee_first_name, attendee_last_name,
        ticket_number, qr_code, status
      ) VALUES (
        p_tenant_id, p_event_id, v_ticket_type.id, v_order_id, p_user_id,
        p_email, p_first_name, p_last_name,
        generate_ticket_number(p_tenant_id, p_event_id),
        encode(gen_random_bytes(16), 'hex'),
        'valid'
      );
    END LOOP;
  END LOOP;

  -- Calculate fees (3% platform fee)
  v_fees := CEIL(v_subtotal * 0.03);
  
  -- Apply discount
  IF v_promo.id IS NOT NULL THEN
    IF v_promo.discount_type = 'percentage' THEN
      v_discount := CEIL(v_subtotal * (v_promo.discount_value::numeric / 100));
    ELSE
      v_discount := LEAST(v_promo.discount_value, v_subtotal);
    END IF;
    
    -- Update promo usage
    UPDATE promo_codes SET times_used = times_used + 1 WHERE id = v_promo.id;
  END IF;
  
  v_total := v_subtotal + v_fees - v_discount;
  
  -- Update order totals
  UPDATE ticket_orders SET
    subtotal_cents = v_subtotal,
    fees_cents = v_fees,
    discount_cents = v_discount,
    total_cents = v_total,
    expires_at = NOW() + INTERVAL '15 minutes'
  WHERE id = v_order_id;

  RETURN json_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal_cents', v_subtotal,
    'fees_cents', v_fees,
    'discount_cents', v_discount,
    'total_cents', v_total
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- COMPLETE TICKET ORDER (After Payment)
-- ===========================================
CREATE OR REPLACE FUNCTION complete_ticket_order(
  p_order_id UUID,
  p_stripe_payment_intent_id TEXT,
  p_stripe_checkout_session_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_order RECORD;
  v_clearing_account UUID;
  v_deferred_account UUID;
  v_fees_account UUID;
  v_entries JSONB;
  v_ledger_result JSON;
BEGIN
  -- Get and lock order
  SELECT * INTO v_order FROM ticket_orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  IF v_order.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Order is not pending');
  END IF;
  
  -- Get or create ledger accounts
  v_clearing_account := get_or_create_ledger_account(v_order.tenant_id, 'stripe_clearing', NULL, 'Stripe Clearing');
  v_deferred_account := get_or_create_ledger_account(v_order.tenant_id, 'deferred_revenue', v_order.event_id, 'Event Deferred Revenue');
  v_fees_account := get_or_create_ledger_account(v_order.tenant_id, 'platform_revenue', NULL, 'Platform Revenue');
  
  -- Build ledger entries (double-entry)
  v_entries := jsonb_build_array(
    -- Debit clearing (money in)
    jsonb_build_object('account_id', v_clearing_account, 'direction', 'debit', 'amount_cents', v_order.total_cents),
    -- Credit deferred revenue (ticket sales - not yet earned)
    jsonb_build_object('account_id', v_deferred_account, 'direction', 'credit', 'amount_cents', v_order.subtotal_cents - v_order.discount_cents),
    -- Credit platform fees
    jsonb_build_object('account_id', v_fees_account, 'direction', 'credit', 'amount_cents', v_order.fees_cents)
  );
  
  -- Post to ledger
  SELECT post_ledger_transaction(
    v_order.tenant_id,
    'deposit',
    v_entries,
    p_order_id,
    'ticket_order',
    'Ticket purchase: ' || v_order.order_number,
    'ticket_order_' || p_order_id::text
  ) INTO v_ledger_result;
  
  IF NOT (v_ledger_result->>'success')::boolean THEN
    RETURN json_build_object('success', false, 'error', 'Ledger posting failed');
  END IF;
  
  -- Move reserved to sold
  UPDATE ticket_types tt
  SET 
    quantity_sold = quantity_sold + toi.quantity,
    quantity_reserved = quantity_reserved - toi.quantity
  FROM ticket_order_items toi
  WHERE toi.order_id = p_order_id AND tt.id = toi.ticket_type_id;
  
  -- Update order status
  UPDATE ticket_orders SET
    status = 'paid',
    stripe_payment_intent_id = p_stripe_payment_intent_id,
    stripe_checkout_session_id = p_stripe_checkout_session_id,
    ledger_transaction_id = (v_ledger_result->>'transaction_id')::uuid,
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN json_build_object(
    'success', true,
    'order_id', p_order_id,
    'ledger_transaction_id', v_ledger_result->>'transaction_id'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- REFUND TICKET ORDER
-- ===========================================
CREATE OR REPLACE FUNCTION refund_ticket_order(
  p_order_id UUID,
  p_refund_amount_cents INT DEFAULT NULL, -- NULL = full refund
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_order RECORD;
  v_refund_amount INT;
  v_clearing_account UUID;
  v_deferred_account UUID;
  v_fees_account UUID;
  v_entries JSONB;
BEGIN
  SELECT * INTO v_order FROM ticket_orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  IF v_order.status NOT IN ('paid', 'partially_refunded') THEN
    RETURN json_build_object('success', false, 'error', 'Order cannot be refunded');
  END IF;
  
  v_refund_amount := COALESCE(p_refund_amount_cents, v_order.total_cents - v_order.amount_refunded_cents);
  
  IF v_refund_amount > v_order.total_cents - v_order.amount_refunded_cents THEN
    RETURN json_build_object('success', false, 'error', 'Refund amount exceeds available');
  END IF;
  
  -- Get ledger accounts
  v_clearing_account := get_or_create_ledger_account(v_order.tenant_id, 'stripe_clearing', NULL);
  v_deferred_account := get_or_create_ledger_account(v_order.tenant_id, 'deferred_revenue', v_order.event_id);
  
  -- Reversal entries
  v_entries := jsonb_build_array(
    jsonb_build_object('account_id', v_deferred_account, 'direction', 'debit', 'amount_cents', v_refund_amount),
    jsonb_build_object('account_id', v_clearing_account, 'direction', 'credit', 'amount_cents', v_refund_amount)
  );
  
  -- Post reversal to ledger
  PERFORM post_ledger_transaction(
    v_order.tenant_id,
    'refund',
    v_entries,
    p_order_id,
    'ticket_refund',
    'Refund for order: ' || v_order.order_number,
    'ticket_refund_' || p_order_id::text || '_' || NOW()::text
  );
  
  -- Update order
  UPDATE ticket_orders SET
    amount_refunded_cents = amount_refunded_cents + v_refund_amount,
    status = CASE 
      WHEN amount_refunded_cents + v_refund_amount >= total_cents THEN 'refunded'
      ELSE 'partially_refunded'
    END,
    refunded_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Cancel tickets
  UPDATE tickets SET status = 'refunded' WHERE order_id = p_order_id;
  
  RETURN json_build_object(
    'success', true,
    'refund_amount_cents', v_refund_amount,
    'order_id', p_order_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- CHECK IN TICKET
-- ===========================================
CREATE OR REPLACE FUNCTION check_in_ticket(
  p_ticket_id UUID,
  p_performed_by UUID,
  p_location TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_ticket RECORD;
  v_event RECORD;
BEGIN
  SELECT t.*, e.starts_at, e.ends_at, e.name as event_name
  INTO v_ticket
  FROM tickets t
  JOIN events e ON e.id = t.event_id
  WHERE t.id = p_ticket_id
  FOR UPDATE OF t;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Ticket not found');
  END IF;
  
  IF v_ticket.status = 'checked_in' THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Already checked in',
      'checked_in_at', v_ticket.checked_in_at
    );
  END IF;
  
  IF v_ticket.status != 'valid' THEN
    RETURN json_build_object('success', false, 'error', 'Ticket is ' || v_ticket.status);
  END IF;
  
  -- Update ticket
  UPDATE tickets SET
    status = 'checked_in',
    checked_in_at = NOW(),
    checked_in_by = p_performed_by,
    check_in_location = p_location
  WHERE id = p_ticket_id;
  
  -- Log check-in
  INSERT INTO ticket_check_ins (tenant_id, ticket_id, event_id, action, performed_by, location)
  VALUES (v_ticket.tenant_id, p_ticket_id, v_ticket.event_id, 'check_in', p_performed_by, p_location);
  
  RETURN json_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'ticket_number', v_ticket.ticket_number,
    'attendee_name', v_ticket.attendee_first_name || ' ' || v_ticket.attendee_last_name,
    'event_name', v_ticket.event_name,
    'checked_in_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- SCAN TICKET BY QR
-- ===========================================
CREATE OR REPLACE FUNCTION scan_ticket_qr(
  p_qr_code TEXT,
  p_performed_by UUID,
  p_location TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  SELECT id INTO v_ticket_id FROM tickets WHERE qr_code = p_qr_code;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid QR code');
  END IF;
  
  RETURN check_in_ticket(v_ticket_id, p_performed_by, p_location);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- TRANSFER TICKET
-- ===========================================
CREATE OR REPLACE FUNCTION transfer_ticket(
  p_ticket_id UUID,
  p_new_owner_email TEXT,
  p_new_owner_user_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_ticket RECORD;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Ticket not found');
  END IF;
  
  IF v_ticket.status != 'valid' THEN
    RETURN json_build_object('success', false, 'error', 'Ticket cannot be transferred');
  END IF;
  
  IF v_ticket.transfer_count >= v_ticket.max_transfers THEN
    RETURN json_build_object('success', false, 'error', 'Maximum transfers reached');
  END IF;
  
  UPDATE tickets SET
    owner_user_id = p_new_owner_user_id,
    attendee_email = p_new_owner_email,
    transfer_count = transfer_count + 1,
    updated_at = NOW()
  WHERE id = p_ticket_id;
  
  RETURN json_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'new_owner_email', p_new_owner_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- EVENT STATISTICS
-- ===========================================
CREATE OR REPLACE FUNCTION get_event_stats(p_event_id UUID)
RETURNS JSON AS $$
DECLARE
  v_stats RECORD;
BEGIN
  SELECT
    COUNT(DISTINCT t.id) as total_tickets,
    COUNT(DISTINCT CASE WHEN t.status = 'valid' THEN t.id END) as valid_tickets,
    COUNT(DISTINCT CASE WHEN t.status = 'checked_in' THEN t.id END) as checked_in,
    COUNT(DISTINCT CASE WHEN t.status IN ('cancelled', 'refunded') THEN t.id END) as cancelled,
    COALESCE(SUM(CASE WHEN o.status = 'paid' THEN o.total_cents END), 0) as total_revenue_cents,
    COUNT(DISTINCT CASE WHEN o.status = 'paid' THEN o.id END) as total_orders,
    e.capacity
  INTO v_stats
  FROM events e
  LEFT JOIN tickets t ON t.event_id = e.id
  LEFT JOIN ticket_orders o ON o.event_id = e.id
  WHERE e.id = p_event_id
  GROUP BY e.id, e.capacity;
  
  RETURN json_build_object(
    'total_tickets', COALESCE(v_stats.total_tickets, 0),
    'valid_tickets', COALESCE(v_stats.valid_tickets, 0),
    'checked_in', COALESCE(v_stats.checked_in, 0),
    'cancelled', COALESCE(v_stats.cancelled, 0),
    'check_in_rate', CASE 
      WHEN v_stats.valid_tickets > 0 
      THEN ROUND((v_stats.checked_in::numeric / v_stats.valid_tickets * 100), 1)
      ELSE 0 
    END,
    'total_revenue_cents', COALESCE(v_stats.total_revenue_cents, 0),
    'total_orders', COALESCE(v_stats.total_orders, 0),
    'capacity', v_stats.capacity,
    'capacity_used', CASE 
      WHEN v_stats.capacity > 0 
      THEN ROUND((v_stats.valid_tickets::numeric / v_stats.capacity * 100), 1)
      ELSE 0 
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- COMPLETE EVENT (Revenue Recognition)
-- ===========================================
CREATE OR REPLACE FUNCTION complete_event_revenue(p_event_id UUID)
RETURNS JSON AS $$
DECLARE
  v_event RECORD;
  v_total_deferred BIGINT;
  v_deferred_account UUID;
  v_revenue_account UUID;
  v_entries JSONB;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Event not found');
  END IF;
  
  IF v_event.status != 'published' THEN
    RETURN json_build_object('success', false, 'error', 'Event is not in published state');
  END IF;
  
  -- Calculate total deferred revenue for this event
  v_deferred_account := get_or_create_ledger_account(v_event.tenant_id, 'deferred_revenue', p_event_id);
  v_revenue_account := get_or_create_ledger_account(v_event.tenant_id, 'event_revenue', p_event_id, 'Event Revenue');
  
  SELECT ABS(balance_cents) INTO v_total_deferred
  FROM ledger_balances
  WHERE account_id = v_deferred_account;
  
  IF COALESCE(v_total_deferred, 0) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No deferred revenue to recognize');
  END IF;
  
  -- Transfer from deferred to earned
  v_entries := jsonb_build_array(
    jsonb_build_object('account_id', v_deferred_account, 'direction', 'debit', 'amount_cents', v_total_deferred),
    jsonb_build_object('account_id', v_revenue_account, 'direction', 'credit', 'amount_cents', v_total_deferred)
  );
  
  PERFORM post_ledger_transaction(
    v_event.tenant_id,
    'adjustment',
    v_entries,
    p_event_id,
    'event_completion',
    'Revenue recognition for event: ' || v_event.name,
    'event_complete_' || p_event_id::text
  );
  
  -- Mark event complete
  UPDATE events SET status = 'completed', updated_at = NOW() WHERE id = p_event_id;
  
  RETURN json_build_object(
    'success', true,
    'event_id', p_event_id,
    'revenue_recognized_cents', v_total_deferred
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- GRANTS
-- ===========================================
GRANT EXECUTE ON FUNCTION generate_order_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_ticket_number(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_ticket_availability(UUID, INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_ticket_order(UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_ticket_order(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION refund_ticket_order(UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_in_ticket(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION scan_ticket_qr(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_ticket(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_event_revenue(UUID) TO authenticated;
