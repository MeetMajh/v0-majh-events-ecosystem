-- =============================================
-- AUTO-PAYOUT ENGINE + RESERVE SYSTEM + FINANCIAL HEALTH SCORING
-- =============================================

-- 1. Organizer Financial Health Scores
-- =============================================

CREATE TABLE IF NOT EXISTS organizer_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Core metrics (0-100 scale)
  overall_score INTEGER DEFAULT 50 CHECK (overall_score >= 0 AND overall_score <= 100),
  dispute_score INTEGER DEFAULT 100 CHECK (dispute_score >= 0 AND dispute_score <= 100),
  payout_score INTEGER DEFAULT 100 CHECK (payout_score >= 0 AND payout_score <= 100),
  volume_score INTEGER DEFAULT 50 CHECK (volume_score >= 0 AND volume_score <= 100),
  tenure_score INTEGER DEFAULT 0 CHECK (tenure_score >= 0 AND tenure_score <= 100),
  
  -- Raw metrics
  total_volume_cents BIGINT DEFAULT 0,
  total_payouts_cents BIGINT DEFAULT 0,
  total_disputes INTEGER DEFAULT 0,
  disputes_won INTEGER DEFAULT 0,
  disputes_lost INTEGER DEFAULT 0,
  total_refunds_cents BIGINT DEFAULT 0,
  failed_payouts INTEGER DEFAULT 0,
  successful_payouts INTEGER DEFAULT 0,
  
  -- Calculated rates
  dispute_rate DECIMAL(5,4) DEFAULT 0,
  refund_rate DECIMAL(5,4) DEFAULT 0,
  payout_success_rate DECIMAL(5,4) DEFAULT 1,
  
  -- Risk tier
  risk_tier TEXT DEFAULT 'standard' CHECK (risk_tier IN ('low', 'standard', 'elevated', 'high', 'critical')),
  
  -- Reserve settings
  reserve_rate DECIMAL(5,4) DEFAULT 0.10, -- 10% default
  min_reserve_cents BIGINT DEFAULT 0,
  current_reserve_cents BIGINT DEFAULT 0,
  
  -- Auto-payout settings
  auto_payout_enabled BOOLEAN DEFAULT FALSE,
  auto_payout_max_cents BIGINT DEFAULT 50000, -- $500 default
  auto_payout_delay_hours INTEGER DEFAULT 24,
  
  -- Timestamps
  first_transaction_at TIMESTAMPTZ,
  last_transaction_at TIMESTAMPTZ,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organizer_id)
);

CREATE INDEX IF NOT EXISTS idx_org_health_tenant ON organizer_health_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_health_risk ON organizer_health_scores(risk_tier);
CREATE INDEX IF NOT EXISTS idx_org_health_score ON organizer_health_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_org_health_auto ON organizer_health_scores(auto_payout_enabled) WHERE auto_payout_enabled = TRUE;

-- RLS
ALTER TABLE organizer_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can view own health score" ON organizer_health_scores
  FOR SELECT USING (organizer_id = auth.uid());

CREATE POLICY "Staff can view all health scores" ON organizer_health_scores
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'manager', 'finance')
  ));

CREATE POLICY "Service role manages health scores" ON organizer_health_scores
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- 2. Calculate Organizer Health Score
-- =============================================

CREATE OR REPLACE FUNCTION calculate_organizer_health_score(p_organizer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_health RECORD;
  v_tenant_id UUID;
  v_total_volume BIGINT;
  v_total_payouts BIGINT;
  v_total_disputes INTEGER;
  v_disputes_won INTEGER;
  v_disputes_lost INTEGER;
  v_total_refunds BIGINT;
  v_failed_payouts INTEGER;
  v_successful_payouts INTEGER;
  v_first_tx TIMESTAMPTZ;
  v_last_tx TIMESTAMPTZ;
  v_dispute_rate DECIMAL;
  v_refund_rate DECIMAL;
  v_payout_success_rate DECIMAL;
  v_dispute_score INTEGER;
  v_payout_score INTEGER;
  v_volume_score INTEGER;
  v_tenure_score INTEGER;
  v_overall_score INTEGER;
  v_risk_tier TEXT;
  v_reserve_rate DECIMAL;
  v_tenure_days INTEGER;
BEGIN
  -- Get tenant
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = p_organizer_id;
  
  -- Calculate volume from tournaments
  SELECT 
    COALESCE(SUM(fi.amount_cents), 0)
  INTO v_total_volume
  FROM financial_intents fi
  JOIN tournaments t ON t.id = fi.reference_id
  WHERE t.organizer_id = p_organizer_id
    AND fi.status = 'succeeded'
    AND fi.intent_type IN ('tournament_entry', 'ticket_purchase');
  
  -- Calculate payouts
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_cents ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO v_total_payouts, v_successful_payouts, v_failed_payouts
  FROM payout_requests
  WHERE user_id = p_organizer_id;
  
  -- Calculate disputes
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'won'),
    COUNT(*) FILTER (WHERE status = 'lost')
  INTO v_total_disputes, v_disputes_won, v_disputes_lost
  FROM disputes
  WHERE organizer_id = p_organizer_id;
  
  -- Calculate refunds
  SELECT COALESCE(SUM(amount_cents), 0)
  INTO v_total_refunds
  FROM financial_intents fi
  JOIN tournaments t ON t.id = fi.reference_id
  WHERE t.organizer_id = p_organizer_id
    AND fi.status = 'succeeded'
    AND fi.intent_type = 'refund';
  
  -- Get transaction dates
  SELECT MIN(created_at), MAX(created_at)
  INTO v_first_tx, v_last_tx
  FROM financial_intents fi
  JOIN tournaments t ON t.id = fi.reference_id
  WHERE t.organizer_id = p_organizer_id
    AND fi.status = 'succeeded';
  
  -- Calculate rates
  v_dispute_rate := CASE WHEN v_total_volume > 0 
    THEN (v_total_disputes::DECIMAL / GREATEST(v_total_volume / 10000, 1)) -- disputes per $100
    ELSE 0 END;
  
  v_refund_rate := CASE WHEN v_total_volume > 0 
    THEN (v_total_refunds::DECIMAL / v_total_volume)
    ELSE 0 END;
  
  v_payout_success_rate := CASE WHEN (v_successful_payouts + v_failed_payouts) > 0
    THEN (v_successful_payouts::DECIMAL / (v_successful_payouts + v_failed_payouts))
    ELSE 1 END;
  
  -- Calculate tenure in days
  v_tenure_days := CASE WHEN v_first_tx IS NOT NULL 
    THEN EXTRACT(DAY FROM NOW() - v_first_tx)::INTEGER
    ELSE 0 END;
  
  -- Score calculations (0-100)
  
  -- Dispute score: 100 = no disputes, decreases with disputes
  v_dispute_score := GREATEST(0, LEAST(100, 
    100 - (v_disputes_lost * 25) - (v_total_disputes * 5)
  ));
  
  -- Payout score: based on success rate
  v_payout_score := GREATEST(0, LEAST(100, 
    (v_payout_success_rate * 100)::INTEGER
  ));
  
  -- Volume score: higher volume = higher score (log scale)
  v_volume_score := CASE 
    WHEN v_total_volume = 0 THEN 0
    WHEN v_total_volume < 10000 THEN 20  -- < $100
    WHEN v_total_volume < 100000 THEN 40  -- < $1,000
    WHEN v_total_volume < 1000000 THEN 60  -- < $10,000
    WHEN v_total_volume < 10000000 THEN 80  -- < $100,000
    ELSE 100  -- >= $100,000
  END;
  
  -- Tenure score: longer = better
  v_tenure_score := CASE 
    WHEN v_tenure_days = 0 THEN 0
    WHEN v_tenure_days < 30 THEN 20
    WHEN v_tenure_days < 90 THEN 40
    WHEN v_tenure_days < 180 THEN 60
    WHEN v_tenure_days < 365 THEN 80
    ELSE 100
  END;
  
  -- Overall score: weighted average
  v_overall_score := (
    (v_dispute_score * 0.35) +  -- 35% weight
    (v_payout_score * 0.25) +   -- 25% weight
    (v_volume_score * 0.25) +   -- 25% weight
    (v_tenure_score * 0.15)     -- 15% weight
  )::INTEGER;
  
  -- Determine risk tier
  v_risk_tier := CASE 
    WHEN v_overall_score >= 85 THEN 'low'
    WHEN v_overall_score >= 70 THEN 'standard'
    WHEN v_overall_score >= 50 THEN 'elevated'
    WHEN v_overall_score >= 30 THEN 'high'
    ELSE 'critical'
  END;
  
  -- Determine reserve rate based on risk
  v_reserve_rate := CASE v_risk_tier
    WHEN 'low' THEN 0.05       -- 5%
    WHEN 'standard' THEN 0.10  -- 10%
    WHEN 'elevated' THEN 0.15  -- 15%
    WHEN 'high' THEN 0.25      -- 25%
    WHEN 'critical' THEN 0.50  -- 50%
    ELSE 0.10
  END;
  
  -- Upsert health score
  INSERT INTO organizer_health_scores (
    organizer_id, tenant_id,
    overall_score, dispute_score, payout_score, volume_score, tenure_score,
    total_volume_cents, total_payouts_cents,
    total_disputes, disputes_won, disputes_lost,
    total_refunds_cents, failed_payouts, successful_payouts,
    dispute_rate, refund_rate, payout_success_rate,
    risk_tier, reserve_rate,
    first_transaction_at, last_transaction_at,
    last_calculated_at, updated_at
  ) VALUES (
    p_organizer_id, v_tenant_id,
    v_overall_score, v_dispute_score, v_payout_score, v_volume_score, v_tenure_score,
    v_total_volume, v_total_payouts,
    v_total_disputes, v_disputes_won, v_disputes_lost,
    v_total_refunds, v_failed_payouts, v_successful_payouts,
    v_dispute_rate, v_refund_rate, v_payout_success_rate,
    v_risk_tier, v_reserve_rate,
    v_first_tx, v_last_tx,
    NOW(), NOW()
  )
  ON CONFLICT (organizer_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    overall_score = EXCLUDED.overall_score,
    dispute_score = EXCLUDED.dispute_score,
    payout_score = EXCLUDED.payout_score,
    volume_score = EXCLUDED.volume_score,
    tenure_score = EXCLUDED.tenure_score,
    total_volume_cents = EXCLUDED.total_volume_cents,
    total_payouts_cents = EXCLUDED.total_payouts_cents,
    total_disputes = EXCLUDED.total_disputes,
    disputes_won = EXCLUDED.disputes_won,
    disputes_lost = EXCLUDED.disputes_lost,
    total_refunds_cents = EXCLUDED.total_refunds_cents,
    failed_payouts = EXCLUDED.failed_payouts,
    successful_payouts = EXCLUDED.successful_payouts,
    dispute_rate = EXCLUDED.dispute_rate,
    refund_rate = EXCLUDED.refund_rate,
    payout_success_rate = EXCLUDED.payout_success_rate,
    risk_tier = EXCLUDED.risk_tier,
    reserve_rate = EXCLUDED.reserve_rate,
    first_transaction_at = EXCLUDED.first_transaction_at,
    last_transaction_at = EXCLUDED.last_transaction_at,
    last_calculated_at = NOW(),
    updated_at = NOW();
  
  RETURN jsonb_build_object(
    'success', true,
    'organizer_id', p_organizer_id,
    'overall_score', v_overall_score,
    'dispute_score', v_dispute_score,
    'payout_score', v_payout_score,
    'volume_score', v_volume_score,
    'tenure_score', v_tenure_score,
    'risk_tier', v_risk_tier,
    'reserve_rate', v_reserve_rate,
    'metrics', jsonb_build_object(
      'total_volume_cents', v_total_volume,
      'total_disputes', v_total_disputes,
      'disputes_lost', v_disputes_lost,
      'tenure_days', v_tenure_days
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 3. Auto-Payout Decision Engine
-- =============================================

CREATE OR REPLACE FUNCTION evaluate_auto_payout(p_payout_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_health RECORD;
  v_decision TEXT;
  v_reason TEXT;
  v_delay_hours INTEGER;
  v_risk_score INTEGER := 0;
  v_factors JSONB := '[]'::jsonb;
BEGIN
  -- Get payout details
  SELECT * INTO v_payout FROM payout_requests WHERE id = p_payout_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not found');
  END IF;
  
  -- Get organizer health score
  SELECT * INTO v_health FROM organizer_health_scores WHERE organizer_id = v_payout.user_id;
  
  -- If no health score, calculate it
  IF NOT FOUND THEN
    PERFORM calculate_organizer_health_score(v_payout.user_id);
    SELECT * INTO v_health FROM organizer_health_scores WHERE organizer_id = v_payout.user_id;
  END IF;
  
  -- Check if auto-payout is enabled for this organizer
  IF v_health IS NULL OR v_health.auto_payout_enabled = FALSE THEN
    RETURN jsonb_build_object(
      'success', true,
      'decision', 'manual',
      'reason', 'Auto-payout not enabled for this organizer'
    );
  END IF;
  
  -- Risk evaluation factors
  
  -- Factor 1: Amount check
  IF v_payout.amount_cents > v_health.auto_payout_max_cents THEN
    v_risk_score := v_risk_score + 50;
    v_factors := v_factors || jsonb_build_object('factor', 'amount_exceeds_limit', 'weight', 50);
  END IF;
  
  -- Factor 2: Health score check
  IF v_health.overall_score < 50 THEN
    v_risk_score := v_risk_score + 40;
    v_factors := v_factors || jsonb_build_object('factor', 'low_health_score', 'weight', 40, 'score', v_health.overall_score);
  ELSIF v_health.overall_score < 70 THEN
    v_risk_score := v_risk_score + 20;
    v_factors := v_factors || jsonb_build_object('factor', 'medium_health_score', 'weight', 20, 'score', v_health.overall_score);
  END IF;
  
  -- Factor 3: Risk tier check
  IF v_health.risk_tier IN ('high', 'critical') THEN
    v_risk_score := v_risk_score + 60;
    v_factors := v_factors || jsonb_build_object('factor', 'high_risk_tier', 'weight', 60, 'tier', v_health.risk_tier);
  ELSIF v_health.risk_tier = 'elevated' THEN
    v_risk_score := v_risk_score + 30;
    v_factors := v_factors || jsonb_build_object('factor', 'elevated_risk_tier', 'weight', 30);
  END IF;
  
  -- Factor 4: Fraud score on payout
  IF v_payout.fraud_score IS NOT NULL AND v_payout.fraud_score > 50 THEN
    v_risk_score := v_risk_score + v_payout.fraud_score;
    v_factors := v_factors || jsonb_build_object('factor', 'high_fraud_score', 'weight', v_payout.fraud_score);
  END IF;
  
  -- Factor 5: Recent disputes
  IF v_health.disputes_lost > 0 AND v_health.last_transaction_at > NOW() - INTERVAL '30 days' THEN
    v_risk_score := v_risk_score + (v_health.disputes_lost * 20);
    v_factors := v_factors || jsonb_build_object('factor', 'recent_dispute_losses', 'weight', v_health.disputes_lost * 20);
  END IF;
  
  -- Make decision
  IF v_risk_score >= 100 THEN
    v_decision := 'hold';
    v_reason := 'Risk score too high: ' || v_risk_score;
    v_delay_hours := NULL;
  ELSIF v_risk_score >= 50 THEN
    v_decision := 'delay';
    v_reason := 'Moderate risk: delayed payout';
    v_delay_hours := v_health.auto_payout_delay_hours * 2;
  ELSIF v_risk_score >= 25 THEN
    v_decision := 'approve_delayed';
    v_reason := 'Low-moderate risk: standard delay';
    v_delay_hours := v_health.auto_payout_delay_hours;
  ELSE
    v_decision := 'approve';
    v_reason := 'Low risk: auto-approved';
    v_delay_hours := 0;
  END IF;
  
  -- Update payout based on decision
  IF v_decision = 'hold' THEN
    UPDATE payout_requests 
    SET is_on_hold = TRUE, 
        hold_reason = 'Auto-held: ' || v_reason,
        hold_created_at = NOW(),
        fraud_score = GREATEST(COALESCE(fraud_score, 0), v_risk_score),
        updated_at = NOW()
    WHERE id = p_payout_id;
  ELSIF v_decision IN ('approve', 'approve_delayed') THEN
    UPDATE payout_requests 
    SET status = 'approved',
        fraud_score = v_risk_score,
        updated_at = NOW()
    WHERE id = p_payout_id AND status = 'pending';
  END IF;
  
  -- Log decision
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_payout.user_id, 
    'auto_payout_evaluated', 
    'payout_request', 
    p_payout_id,
    jsonb_build_object(
      'decision', v_decision,
      'risk_score', v_risk_score,
      'factors', v_factors,
      'health_score', v_health.overall_score,
      'risk_tier', v_health.risk_tier
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'payout_id', p_payout_id,
    'decision', v_decision,
    'reason', v_reason,
    'risk_score', v_risk_score,
    'delay_hours', v_delay_hours,
    'factors', v_factors,
    'organizer_health', jsonb_build_object(
      'overall_score', v_health.overall_score,
      'risk_tier', v_health.risk_tier,
      'auto_payout_max_cents', v_health.auto_payout_max_cents
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. Process Auto-Payouts (Batch)
-- =============================================

CREATE OR REPLACE FUNCTION process_auto_payouts(p_tenant_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_result JSONB;
  v_processed INTEGER := 0;
  v_approved INTEGER := 0;
  v_held INTEGER := 0;
  v_delayed INTEGER := 0;
  v_results JSONB := '[]'::jsonb;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Get pending payouts for organizers with auto-payout enabled
  FOR v_payout IN
    SELECT pr.* 
    FROM payout_requests pr
    JOIN organizer_health_scores ohs ON ohs.organizer_id = pr.user_id
    JOIN profiles p ON p.id = pr.user_id
    WHERE p.tenant_id = p_tenant_id
      AND pr.status = 'pending'
      AND pr.is_on_hold = FALSE
      AND ohs.auto_payout_enabled = TRUE
    ORDER BY pr.created_at ASC
    LIMIT p_limit
  LOOP
    v_result := evaluate_auto_payout(v_payout.id);
    v_processed := v_processed + 1;
    
    IF v_result->>'decision' = 'approve' THEN
      v_approved := v_approved + 1;
    ELSIF v_result->>'decision' = 'hold' THEN
      v_held := v_held + 1;
    ELSE
      v_delayed := v_delayed + 1;
    END IF;
    
    v_results := v_results || jsonb_build_object(
      'payout_id', v_payout.id,
      'decision', v_result->>'decision',
      'risk_score', v_result->'risk_score'
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'approved', v_approved,
    'held', v_held,
    'delayed', v_delayed,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. Reserve Management
-- =============================================

CREATE OR REPLACE FUNCTION calculate_organizer_reserve(p_organizer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_health RECORD;
  v_pending_payouts BIGINT;
  v_escrow_balance BIGINT;
  v_required_reserve BIGINT;
  v_current_reserve BIGINT;
  v_reserve_shortfall BIGINT;
BEGIN
  -- Get health score
  SELECT * INTO v_health FROM organizer_health_scores WHERE organizer_id = p_organizer_id;
  
  IF NOT FOUND THEN
    PERFORM calculate_organizer_health_score(p_organizer_id);
    SELECT * INTO v_health FROM organizer_health_scores WHERE organizer_id = p_organizer_id;
  END IF;
  
  -- Get pending payout total
  SELECT COALESCE(SUM(amount_cents), 0)
  INTO v_pending_payouts
  FROM payout_requests
  WHERE user_id = p_organizer_id
    AND status IN ('pending', 'eligible', 'approved', 'processing');
  
  -- Get escrow balance for organizer's tournaments
  SELECT COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_cents 
         WHEN le.direction = 'debit' THEN -le.amount_cents 
         ELSE 0 END
  ), 0)
  INTO v_escrow_balance
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  JOIN tournaments t ON t.id = la.reference_id
  WHERE la.account_type = 'escrow'
    AND t.organizer_id = p_organizer_id
    AND lt.status = 'posted';
  
  -- Calculate required reserve
  v_required_reserve := GREATEST(
    v_health.min_reserve_cents,
    (v_pending_payouts * v_health.reserve_rate)::BIGINT
  );
  
  v_current_reserve := v_health.current_reserve_cents;
  v_reserve_shortfall := GREATEST(0, v_required_reserve - v_current_reserve);
  
  -- Update health score with current calculations
  UPDATE organizer_health_scores
  SET current_reserve_cents = v_current_reserve,
      updated_at = NOW()
  WHERE organizer_id = p_organizer_id;
  
  RETURN jsonb_build_object(
    'organizer_id', p_organizer_id,
    'reserve_rate', v_health.reserve_rate,
    'risk_tier', v_health.risk_tier,
    'pending_payouts_cents', v_pending_payouts,
    'escrow_balance_cents', v_escrow_balance,
    'required_reserve_cents', v_required_reserve,
    'current_reserve_cents', v_current_reserve,
    'reserve_shortfall_cents', v_reserve_shortfall,
    'is_reserve_adequate', v_reserve_shortfall = 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. Admin Functions
-- =============================================

CREATE OR REPLACE FUNCTION get_organizer_health_scores(
  p_tenant_id UUID,
  p_risk_tier TEXT DEFAULT NULL,
  p_min_score INTEGER DEFAULT NULL,
  p_max_score INTEGER DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_scores JSONB;
  v_total INTEGER;
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'finance')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;
  
  SELECT COUNT(*) INTO v_total
  FROM organizer_health_scores ohs
  WHERE ohs.tenant_id = p_tenant_id
    AND (p_risk_tier IS NULL OR ohs.risk_tier = p_risk_tier)
    AND (p_min_score IS NULL OR ohs.overall_score >= p_min_score)
    AND (p_max_score IS NULL OR ohs.overall_score <= p_max_score);
  
  SELECT jsonb_agg(row_to_json(t)) INTO v_scores
  FROM (
    SELECT 
      ohs.*,
      p.display_name,
      p.email,
      p.avatar_url
    FROM organizer_health_scores ohs
    JOIN profiles p ON p.id = ohs.organizer_id
    WHERE ohs.tenant_id = p_tenant_id
      AND (p_risk_tier IS NULL OR ohs.risk_tier = p_risk_tier)
      AND (p_min_score IS NULL OR ohs.overall_score >= p_min_score)
      AND (p_max_score IS NULL OR ohs.overall_score <= p_max_score)
    ORDER BY ohs.overall_score ASC, ohs.total_volume_cents DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  
  RETURN jsonb_build_object(
    'scores', COALESCE(v_scores, '[]'::jsonb),
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_organizer_auto_payout_settings(
  p_organizer_id UUID,
  p_enabled BOOLEAN DEFAULT NULL,
  p_max_cents BIGINT DEFAULT NULL,
  p_delay_hours INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;
  
  UPDATE organizer_health_scores
  SET 
    auto_payout_enabled = COALESCE(p_enabled, auto_payout_enabled),
    auto_payout_max_cents = COALESCE(p_max_cents, auto_payout_max_cents),
    auto_payout_delay_hours = COALESCE(p_delay_hours, auto_payout_delay_hours),
    updated_at = NOW()
  WHERE organizer_id = p_organizer_id;
  
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (
    auth.uid(),
    'auto_payout_settings_updated',
    'organizer_health_score',
    p_organizer_id,
    jsonb_build_object(
      'enabled', p_enabled,
      'max_cents', p_max_cents,
      'delay_hours', p_delay_hours
    )
  );
  
  RETURN jsonb_build_object('success', true, 'organizer_id', p_organizer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 7. Recalculate All Health Scores (Batch)
-- =============================================

CREATE OR REPLACE FUNCTION recalculate_all_health_scores(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_organizer_id UUID;
  v_count INTEGER := 0;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  FOR v_organizer_id IN
    SELECT DISTINCT t.organizer_id
    FROM tournaments t
    JOIN profiles p ON p.id = t.organizer_id
    WHERE p.tenant_id = p_tenant_id
  LOOP
    PERFORM calculate_organizer_health_score(v_organizer_id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'recalculated', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 8. Permissions
-- =============================================

GRANT EXECUTE ON FUNCTION calculate_organizer_health_score(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION evaluate_auto_payout(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION process_auto_payouts(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION calculate_organizer_reserve(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_organizer_health_scores(UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_organizer_auto_payout_settings(UUID, BOOLEAN, BIGINT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_all_health_scores(UUID) TO service_role;
