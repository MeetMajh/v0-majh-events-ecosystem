-- =========================================================================
-- T-102 + T-103: Fix complete_ticket_order parameter mismatch + revoke from authenticated
-- 
-- Audit findings: C4 (parameter name mismatch), C5 (granted to authenticated)
-- 
-- Three problems being fixed:
-- 1. Parameter names in webhook call don't match function signature
-- 2. Function only accepts 'pending' status, but v1 API moves orders to 
--    'processing' before payment, so v1-paid orders never complete
-- 3. Function granted to authenticated; should be service_role only
-- 
-- New signature: (p_order_id, p_stripe_session_id, p_stripe_payment_intent_id, 
--                 p_idempotency_key)
-- 
-- New behavior:
-- - Accepts both 'pending' and 'processing' as valid starting states
-- - Returns { success: true, duplicate: true } if order already paid (idempotent)
-- - Returns tickets_issued and total_cents in success response (for logging)
-- =========================================================================

-- Drop existing function and grants
DROP FUNCTION IF EXISTS complete_ticket_order(UUID, TEXT, TEXT);

-- Create new function with corrected signature
CREATE OR REPLACE FUNCTION complete_ticket_order(
  p_order_id UUID,
  p_stripe_session_id TEXT,
  p_stripe_payment_intent_id TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_order RECORD;
  v_clearing_account UUID;
  v_deferred_account UUID;
  v_fees_account UUID;
  v_entries JSONB;
  v_ledger_result JSON;
  v_tickets_count INT;
BEGIN
  -- Get and lock order
  SELECT * INTO v_order FROM ticket_orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Idempotent re-call: order already paid
  IF v_order.status = 'paid' THEN
    -- Count tickets for the response
    SELECT COUNT(*) INTO v_tickets_count
    FROM tickets WHERE order_id = p_order_id;
    
    RETURN json_build_object(
      'success', true,
      'duplicate', true,
      'order_id', p_order_id,
      'tickets_issued', v_tickets_count,
      'total_cents', v_order.total_cents
    );
  END IF;
  
  -- Reject if order is in a non-completable state
  IF v_order.status NOT IN ('pending', 'processing') THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Order cannot be completed (status: ' || v_order.status || ')'
    );
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
  
  -- Post to ledger (uses idempotency key from caller, falls back to deterministic key)
  SELECT post_ledger_transaction(
    v_order.tenant_id,
    'deposit',
    v_entries,
    p_order_id,
    'ticket_order',
    'Ticket purchase: ' || v_order.order_number,
    COALESCE(p_idempotency_key, 'ticket_order_' || p_order_id::text)
  ) INTO v_ledger_result;
  
  IF NOT (v_ledger_result->>'success')::boolean THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Ledger posting failed: ' || COALESCE(v_ledger_result->>'error', 'unknown')
    );
  END IF;
  
  -- Move reserved to sold
  UPDATE ticket_types tt
  SET 
    quantity_sold = quantity_sold + toi.quantity,
    quantity_reserved = quantity_reserved - toi.quantity
  FROM ticket_order_items toi
  WHERE toi.order_id = p_order_id AND tt.id = toi.ticket_type_id;
  
  -- Update order status to paid
  UPDATE ticket_orders SET
    status = 'paid',
    stripe_payment_intent_id = p_stripe_payment_intent_id,
    stripe_checkout_session_id = COALESCE(p_stripe_session_id, stripe_checkout_session_id),
    ledger_transaction_id = (v_ledger_result->>'transaction_id')::uuid,
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Count tickets issued
  SELECT COUNT(*) INTO v_tickets_count
  FROM tickets WHERE order_id = p_order_id;
  
  RETURN json_build_object(
    'success', true,
    'order_id', p_order_id,
    'ledger_transaction_id', v_ledger_result->>'transaction_id',
    'tickets_issued', v_tickets_count,
    'total_cents', v_order.total_cents
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants: service_role only (audit C5 — was previously granted to authenticated)
REVOKE ALL ON FUNCTION complete_ticket_order(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_ticket_order(UUID, TEXT, TEXT, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION complete_ticket_order(UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION complete_ticket_order(UUID, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION complete_ticket_order(UUID, TEXT, TEXT, TEXT) IS
  'Completes a ticket order after payment. Service-role only (called from 
   Stripe webhook). Accepts orders in pending or processing state. 
   Idempotent: returns success with duplicate=true if order already paid.';

-- =========================================================================
-- End of T-102 SQL migration
-- =========================================================================
