-- =====================================================
-- ORGANIZER LIABILITY TRACKING
-- Track who caused financial losses for accountability
-- =====================================================

-- Step 1: Add organizer tracking to disputes
ALTER TABLE disputes
ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS organizer_liability_cents BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS liability_assessed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS liability_collected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS liability_collected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_disputes_organizer ON disputes(organizer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_liability ON disputes(organizer_liability_cents) WHERE organizer_liability_cents > 0;

-- =====================================================
-- Update handle_stripe_dispute to capture organizer
-- =====================================================
CREATE OR REPLACE FUNCTION handle_stripe_dispute(
  p_stripe_dispute_id TEXT,
  p_stripe_charge_id TEXT,
  p_event_type TEXT,
  p_amount_cents BIGINT,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_dispute RECORD;
  v_intent RECORD;
  v_tournament RECORD;
  v_tenant_id UUID;
  v_organizer_id UUID;
  v_reserve_tx_id UUID;
  v_resolution_tx_id UUID;
  v_reserve_account UUID;
  v_platform_account UUID;
  v_entries JSONB;
  v_ledger_result JSON;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service_role required';
  END IF;

  SELECT * INTO v_dispute FROM disputes WHERE stripe_dispute_id = p_stripe_dispute_id FOR UPDATE;

  IF p_event_type = 'charge.dispute.created' THEN
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'dispute_id', v_dispute.id);
    END IF;

    -- Find the original intent
    SELECT * INTO v_intent
    FROM financial_intents
    WHERE stripe_charge_id = p_stripe_charge_id
       OR stripe_payment_intent_id IN (
         SELECT payment_intent FROM (
           SELECT metadata->>'payment_intent' as payment_intent
           FROM financial_intents
           WHERE stripe_checkout_session_id IS NOT NULL
         ) sub
       )
    LIMIT 1;

    v_tenant_id := COALESCE(v_intent.tenant_id, (SELECT id FROM tenants LIMIT 1));

    -- Find the organizer responsible
    IF v_intent.reference_type = 'tournament' OR v_intent.intent_type = 'tournament_entry' THEN
      SELECT t.*, t.organizer_id INTO v_tournament
      FROM tournaments t
      WHERE t.id = v_intent.reference_id;
      
      v_organizer_id := v_tournament.organizer_id;
    ELSIF v_intent.reference_type = 'event' OR v_intent.intent_type = 'ticket_purchase' THEN
      SELECT e.organizer_id INTO v_organizer_id
      FROM events e
      WHERE e.id = v_intent.reference_id;
    END IF;

    -- Create dispute record with organizer
    INSERT INTO disputes (
      tenant_id,
      stripe_dispute_id,
      stripe_charge_id,
      original_intent_id,
      user_id,
      organizer_id,
      amount_cents,
      reason,
      status,
      stripe_metadata
    )
    VALUES (
      v_tenant_id,
      p_stripe_dispute_id,
      p_stripe_charge_id,
      v_intent.id,
      v_intent.user_id,
      v_organizer_id,
      p_amount_cents,
      p_reason,
      'needs_response',
      jsonb_build_object('event_type', p_event_type, 'created_at', NOW())
    )
    RETURNING * INTO v_dispute;

    -- Create reserve entry
    v_reserve_account := get_or_create_ledger_account(v_tenant_id, 'dispute_reserve', NULL, 'Dispute Reserve');
    v_platform_account := get_or_create_ledger_account(v_tenant_id, 'platform_revenue', NULL, 'Platform Revenue');

    v_entries := jsonb_build_array(
      jsonb_build_object('account_id', v_platform_account, 'direction', 'debit', 'amount_cents', p_amount_cents),
      jsonb_build_object('account_id', v_reserve_account, 'direction', 'credit', 'amount_cents', p_amount_cents)
    );

    v_ledger_result := post_ledger_transaction(
      v_tenant_id,
      'dispute_reserve',
      v_entries,
      v_dispute.id,
      'dispute',
      'Dispute reserve for ' || p_stripe_dispute_id || ' | Organizer: ' || COALESCE(v_organizer_id::text, 'Unknown'),
      'dispute_reserve_' || p_stripe_dispute_id
    );

    IF v_ledger_result->>'success' = 'true' THEN
      v_reserve_tx_id := (v_ledger_result->>'transaction_id')::UUID;
      UPDATE disputes SET ledger_reserve_tx_id = v_reserve_tx_id WHERE id = v_dispute.id;
    END IF;

    -- Auto-hold related payouts
    IF v_intent.reference_id IS NOT NULL THEN
      PERFORM auto_hold_payouts_for_dispute(v_dispute.id, v_tenant_id, v_intent.reference_id);
    END IF;

    INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
    VALUES (
      v_intent.user_id,
      'dispute_created',
      'dispute',
      v_dispute.id,
      jsonb_build_object(
        'stripe_dispute_id', p_stripe_dispute_id,
        'amount_cents', p_amount_cents,
        'reason', p_reason,
        'organizer_id', v_organizer_id
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'dispute_id', v_dispute.id,
      'reserve_tx_id', v_reserve_tx_id,
      'organizer_id', v_organizer_id
    );

  ELSIF p_event_type = 'charge.dispute.updated' THEN
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Dispute not found');
    END IF;

    UPDATE disputes
    SET status = 'under_review',
        stripe_metadata = stripe_metadata || jsonb_build_object('updated_at', NOW(), 'last_reason', p_reason),
        updated_at = NOW()
    WHERE id = v_dispute.id;

    RETURN jsonb_build_object('success', true, 'dispute_id', v_dispute.id, 'status', 'under_review');

  ELSIF p_event_type = 'charge.dispute.closed' THEN
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Dispute not found');
    END IF;

    v_tenant_id := v_dispute.tenant_id;
    v_reserve_account := get_or_create_ledger_account(v_tenant_id, 'dispute_reserve', NULL, 'Dispute Reserve');
    v_platform_account := get_or_create_ledger_account(v_tenant_id, 'platform_revenue', NULL, 'Platform Revenue');

    IF p_reason = 'won' THEN
      -- Release reserve back to platform revenue
      v_entries := jsonb_build_array(
        jsonb_build_object('account_id', v_reserve_account, 'direction', 'debit', 'amount_cents', v_dispute.amount_cents),
        jsonb_build_object('account_id', v_platform_account, 'direction', 'credit', 'amount_cents', v_dispute.amount_cents)
      );
      v_ledger_result := post_ledger_transaction(
        v_tenant_id, 'dispute_won', v_entries, v_dispute.id, 'dispute',
        'Dispute won - reserve released: ' || p_stripe_dispute_id,
        'dispute_won_' || p_stripe_dispute_id
      );

      -- No organizer liability
      UPDATE disputes
      SET organizer_liability_cents = 0,
          liability_assessed_at = NOW()
      WHERE id = v_dispute.id;

    ELSIF p_reason = 'lost' THEN
      -- Write off to dispute losses
      v_entries := jsonb_build_array(
        jsonb_build_object('account_id', v_reserve_account, 'direction', 'debit', 'amount_cents', v_dispute.amount_cents),
        jsonb_build_object('account_id', get_or_create_ledger_account(v_tenant_id, 'dispute_losses', NULL, 'Dispute Losses'), 'direction', 'credit', 'amount_cents', v_dispute.amount_cents)
      );
      v_ledger_result := post_ledger_transaction(
        v_tenant_id, 'dispute_lost', v_entries, v_dispute.id, 'dispute',
        'Dispute lost - reserve written off: ' || p_stripe_dispute_id,
        'dispute_lost_' || p_stripe_dispute_id
      );

      -- Assign full liability to organizer
      UPDATE disputes
      SET organizer_liability_cents = v_dispute.amount_cents,
          liability_assessed_at = NOW()
      WHERE id = v_dispute.id;

      -- Log organizer liability
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
      VALUES (
        v_dispute.organizer_id,
        'organizer_liability_assessed',
        'dispute',
        v_dispute.id,
        jsonb_build_object(
          'liability_cents', v_dispute.amount_cents,
          'dispute_reason', v_dispute.reason
        )
      );

    ELSE
      -- Generic resolution - release reserve
      v_entries := jsonb_build_array(
        jsonb_build_object('account_id', v_reserve_account, 'direction', 'debit', 'amount_cents', v_dispute.amount_cents),
        jsonb_build_object('account_id', v_platform_account, 'direction', 'credit', 'amount_cents', v_dispute.amount_cents)
      );
      v_ledger_result := post_ledger_transaction(
        v_tenant_id, 'dispute_resolved', v_entries, v_dispute.id, 'dispute',
        'Dispute resolved: ' || p_stripe_dispute_id,
        'dispute_resolved_' || p_stripe_dispute_id
      );
    END IF;

    IF v_ledger_result->>'success' = 'true' THEN
      v_resolution_tx_id := (v_ledger_result->>'transaction_id')::UUID;
    END IF;

    UPDATE disputes
    SET status = p_reason,
        resolution = p_reason,
        ledger_resolution_tx_id = v_resolution_tx_id,
        updated_at = NOW()
    WHERE id = v_dispute.id;

    INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
    VALUES (
      v_dispute.user_id,
      'dispute_closed',
      'dispute',
      v_dispute.id,
      jsonb_build_object(
        'resolution', p_reason,
        'amount_cents', v_dispute.amount_cents,
        'resolution_tx_id', v_resolution_tx_id,
        'organizer_liability_cents', CASE WHEN p_reason = 'lost' THEN v_dispute.amount_cents ELSE 0 END
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'dispute_id', v_dispute.id,
      'resolution', p_reason,
      'resolution_tx_id', v_resolution_tx_id
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Unknown event type');

EXCEPTION WHEN OTHERS THEN
  INSERT INTO audit_log (user_id, action, resource_type, metadata)
  VALUES (NULL, 'dispute_handle_error', 'dispute', jsonb_build_object(
    'stripe_dispute_id', p_stripe_dispute_id,
    'error', SQLERRM
  ));
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- get_organizer_liability_summary
-- =====================================================
CREATE OR REPLACE FUNCTION get_organizer_liability_summary(p_organizer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_liability BIGINT;
  v_collected_liability BIGINT;
  v_outstanding_liability BIGINT;
  v_dispute_count INTEGER;
  v_lost_count INTEGER;
BEGIN
  -- Verify access
  IF auth.role() != 'service_role' THEN
    IF auth.uid() != p_organizer_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM staff_roles
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'manager', 'finance')
      ) THEN
        RAISE EXCEPTION 'Unauthorized';
      END IF;
    END IF;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'lost'),
    COALESCE(SUM(organizer_liability_cents), 0),
    COALESCE(SUM(organizer_liability_cents) FILTER (WHERE liability_collected = TRUE), 0)
  INTO v_dispute_count, v_lost_count, v_total_liability, v_collected_liability
  FROM disputes
  WHERE organizer_id = p_organizer_id;

  v_outstanding_liability := v_total_liability - v_collected_liability;

  RETURN jsonb_build_object(
    'organizer_id', p_organizer_id,
    'total_disputes', v_dispute_count,
    'lost_disputes', v_lost_count,
    'total_liability_cents', v_total_liability,
    'collected_cents', v_collected_liability,
    'outstanding_cents', v_outstanding_liability,
    'generated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- collect_organizer_liability (offset from future payouts)
-- =====================================================
CREATE OR REPLACE FUNCTION collect_organizer_liability(
  p_dispute_id UUID,
  p_collection_method TEXT DEFAULT 'payout_offset'
) RETURNS JSONB AS $$
DECLARE
  v_dispute RECORD;
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.role();
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service_role can collect liability';
  END IF;

  SELECT * INTO v_dispute FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute not found');
  END IF;

  IF v_dispute.liability_collected = TRUE THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'already_collected', true);
  END IF;

  IF v_dispute.organizer_liability_cents = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No liability to collect');
  END IF;

  -- Mark as collected (actual collection happens in payout flow)
  UPDATE disputes
  SET liability_collected = TRUE,
      liability_collected_at = NOW(),
      stripe_metadata = stripe_metadata || jsonb_build_object('collection_method', p_collection_method)
  WHERE id = p_dispute_id;

  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_dispute.organizer_id,
    'organizer_liability_collected',
    'dispute',
    p_dispute_id,
    jsonb_build_object(
      'amount_cents', v_dispute.organizer_liability_cents,
      'collection_method', p_collection_method
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'dispute_id', p_dispute_id,
    'organizer_id', v_dispute.organizer_id,
    'amount_collected_cents', v_dispute.organizer_liability_cents,
    'collection_method', p_collection_method
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION get_organizer_liability_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION collect_organizer_liability(UUID, TEXT) TO service_role;
