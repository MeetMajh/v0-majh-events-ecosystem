-- =====================================================
-- PREDICTIVE RISK + DYNAMIC FEES + CAPITAL SYSTEM
-- Full fintech infrastructure layer
-- =====================================================

-- =====================================================
-- 1. PREDICTIVE RISK SIGNALS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'rapid_withdrawal', 'unusual_amount', 'new_account_high_value',
    'dispute_pattern', 'refund_pattern', 'velocity_spike',
    'geographic_anomaly', 'device_anomaly', 'time_anomaly',
    'behavior_change', 'linked_account_risk'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  score_impact INTEGER DEFAULT 0,
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_signals_user ON risk_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_signals_type ON risk_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_risk_signals_active ON risk_signals(user_id, resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_risk_signals_expires ON risk_signals(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE risk_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view risk signals" ON risk_signals;
CREATE POLICY "Staff can view risk signals" ON risk_signals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM staff_roles 
    WHERE staff_roles.user_id = auth.uid() 
    AND staff_roles.role IN ('owner', 'manager', 'finance')
  ));

DROP POLICY IF EXISTS "Service role manages risk signals" ON risk_signals;
CREATE POLICY "Service role manages risk signals" ON risk_signals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 2. DYNAMIC FEE TIERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS organizer_fee_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Fee percentages (in basis points, e.g., 500 = 5%)
  platform_fee_bps INTEGER DEFAULT 500,
  processing_fee_bps INTEGER DEFAULT 290,
  payout_fee_bps INTEGER DEFAULT 25,
  
  -- Fee tier
  tier TEXT DEFAULT 'standard' CHECK (tier IN ('preferred', 'standard', 'elevated', 'high_risk')),
  
  -- Tier determination factors
  health_score_at_calculation INTEGER,
  dispute_rate_at_calculation DECIMAL(5,4),
  volume_at_calculation BIGINT,
  
  -- Discount/premium multiplier (1.0 = no change, 0.9 = 10% discount, 1.2 = 20% premium)
  fee_multiplier DECIMAL(4,2) DEFAULT 1.0,
  
  -- Volume discounts
  volume_discount_bps INTEGER DEFAULT 0,
  
  -- Override (admin set)
  is_override BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  override_by UUID REFERENCES profiles(id),
  override_expires_at TIMESTAMPTZ,
  
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organizer_id)
);

CREATE INDEX IF NOT EXISTS idx_fee_tiers_tenant ON organizer_fee_tiers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fee_tiers_tier ON organizer_fee_tiers(tier);

ALTER TABLE organizer_fee_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organizers can view own fees" ON organizer_fee_tiers;
CREATE POLICY "Organizers can view own fees" ON organizer_fee_tiers FOR SELECT
  USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Staff can manage fee tiers" ON organizer_fee_tiers;
CREATE POLICY "Staff can manage fee tiers" ON organizer_fee_tiers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM staff_roles 
    WHERE staff_roles.user_id = auth.uid() 
    AND staff_roles.role IN ('owner', 'manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM staff_roles 
    WHERE staff_roles.user_id = auth.uid() 
    AND staff_roles.role IN ('owner', 'manager')
  ));

-- =====================================================
-- 3. CAPITAL ADVANCES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS capital_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Advance details
  advance_amount_cents BIGINT NOT NULL,
  fee_amount_cents BIGINT NOT NULL,
  total_repayment_cents BIGINT NOT NULL,
  
  -- Terms
  fee_rate_bps INTEGER NOT NULL, -- e.g., 800 = 8%
  repayment_rate_bps INTEGER NOT NULL, -- % of each payout taken, e.g., 1500 = 15%
  max_repayment_days INTEGER DEFAULT 90,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'active', 'repaying', 'paid_off', 
    'defaulted', 'cancelled', 'rejected'
  )),
  
  -- Repayment tracking
  amount_repaid_cents BIGINT DEFAULT 0,
  remaining_balance_cents BIGINT,
  last_repayment_at TIMESTAMPTZ,
  repayment_count INTEGER DEFAULT 0,
  
  -- Risk assessment at approval
  health_score_at_approval INTEGER,
  projected_monthly_volume_cents BIGINT,
  risk_tier_at_approval TEXT,
  
  -- Approval/rejection
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Disbursement
  disbursed_at TIMESTAMPTZ,
  stripe_transfer_id TEXT,
  
  -- Ledger
  ledger_advance_tx_id UUID,
  ledger_fee_tx_id UUID,
  
  -- Default handling
  defaulted_at TIMESTAMPTZ,
  default_reason TEXT,
  collections_status TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capital_advances_organizer ON capital_advances(organizer_id);
CREATE INDEX IF NOT EXISTS idx_capital_advances_status ON capital_advances(status);
CREATE INDEX IF NOT EXISTS idx_capital_advances_active ON capital_advances(organizer_id, status) WHERE status IN ('active', 'repaying');

ALTER TABLE capital_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organizers can view own advances" ON capital_advances;
CREATE POLICY "Organizers can view own advances" ON capital_advances FOR SELECT
  USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Staff can manage advances" ON capital_advances;
CREATE POLICY "Staff can manage advances" ON capital_advances FOR ALL
  USING (EXISTS (
    SELECT 1 FROM staff_roles 
    WHERE staff_roles.user_id = auth.uid() 
    AND staff_roles.role IN ('owner', 'manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM staff_roles 
    WHERE staff_roles.user_id = auth.uid() 
    AND staff_roles.role IN ('owner', 'manager')
  ));

-- =====================================================
-- 4. PREDICTIVE RISK FUNCTIONS
-- =====================================================

-- Detect risk signals for a user
CREATE OR REPLACE FUNCTION detect_risk_signals(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_health RECORD;
  v_signals JSONB := '[]'::jsonb;
  v_recent_payouts BIGINT;
  v_avg_payout BIGINT;
  v_last_payout RECORD;
  v_account_age INTEGER;
  v_recent_disputes INTEGER;
  v_recent_refunds INTEGER;
BEGIN
  -- Get tenant
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = p_user_id;
  
  -- Get health score
  SELECT * INTO v_health FROM organizer_health_scores WHERE organizer_id = p_user_id;
  
  -- Get account age in days
  SELECT EXTRACT(DAY FROM NOW() - created_at)::INTEGER INTO v_account_age
  FROM profiles WHERE id = p_user_id;
  
  -- Get recent payout stats (last 7 days)
  SELECT 
    COALESCE(SUM(amount_cents), 0),
    COALESCE(AVG(amount_cents), 0)::BIGINT
  INTO v_recent_payouts, v_avg_payout
  FROM payout_requests
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '7 days';
  
  -- Get last payout
  SELECT * INTO v_last_payout
  FROM payout_requests
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Get recent disputes (30 days)
  SELECT COUNT(*) INTO v_recent_disputes
  FROM disputes
  WHERE organizer_id = p_user_id
    AND created_at > NOW() - INTERVAL '30 days';
  
  -- Get recent refunds (30 days)
  SELECT COUNT(*) INTO v_recent_refunds
  FROM financial_intents fi
  JOIN tournaments t ON t.id = fi.reference_id
  WHERE t.organizer_id = p_user_id
    AND fi.intent_type = 'refund'
    AND fi.created_at > NOW() - INTERVAL '30 days';
  
  -- SIGNAL 1: New account with high value
  IF v_account_age < 30 AND v_recent_payouts > 500000 THEN
    v_signals := v_signals || jsonb_build_object(
      'type', 'new_account_high_value',
      'severity', 'high',
      'score_impact', 30,
      'details', jsonb_build_object('account_age_days', v_account_age, 'recent_payouts_cents', v_recent_payouts)
    );
    
    INSERT INTO risk_signals (tenant_id, user_id, signal_type, severity, score_impact, metadata, expires_at)
    VALUES (v_tenant_id, p_user_id, 'new_account_high_value', 'high', 30, 
      jsonb_build_object('account_age_days', v_account_age, 'recent_payouts_cents', v_recent_payouts),
      NOW() + INTERVAL '30 days'
    ) ON CONFLICT DO NOTHING;
  END IF;
  
  -- SIGNAL 2: Rapid withdrawal (velocity spike)
  IF v_recent_payouts > v_avg_payout * 5 AND v_avg_payout > 0 THEN
    v_signals := v_signals || jsonb_build_object(
      'type', 'velocity_spike',
      'severity', 'medium',
      'score_impact', 20,
      'details', jsonb_build_object('recent_total', v_recent_payouts, 'avg_payout', v_avg_payout)
    );
    
    INSERT INTO risk_signals (tenant_id, user_id, signal_type, severity, score_impact, metadata, expires_at)
    VALUES (v_tenant_id, p_user_id, 'velocity_spike', 'medium', 20,
      jsonb_build_object('recent_total', v_recent_payouts, 'avg_payout', v_avg_payout),
      NOW() + INTERVAL '7 days'
    ) ON CONFLICT DO NOTHING;
  END IF;
  
  -- SIGNAL 3: Dispute pattern
  IF v_recent_disputes >= 2 THEN
    v_signals := v_signals || jsonb_build_object(
      'type', 'dispute_pattern',
      'severity', CASE WHEN v_recent_disputes >= 3 THEN 'critical' ELSE 'high' END,
      'score_impact', v_recent_disputes * 15,
      'details', jsonb_build_object('recent_disputes', v_recent_disputes)
    );
    
    INSERT INTO risk_signals (tenant_id, user_id, signal_type, severity, score_impact, metadata, expires_at)
    VALUES (v_tenant_id, p_user_id, 'dispute_pattern', 
      CASE WHEN v_recent_disputes >= 3 THEN 'critical' ELSE 'high' END,
      v_recent_disputes * 15,
      jsonb_build_object('recent_disputes', v_recent_disputes),
      NOW() + INTERVAL '60 days'
    ) ON CONFLICT DO NOTHING;
  END IF;
  
  -- SIGNAL 4: Refund pattern
  IF v_recent_refunds >= 5 THEN
    v_signals := v_signals || jsonb_build_object(
      'type', 'refund_pattern',
      'severity', 'medium',
      'score_impact', 15,
      'details', jsonb_build_object('recent_refunds', v_recent_refunds)
    );
    
    INSERT INTO risk_signals (tenant_id, user_id, signal_type, severity, score_impact, metadata, expires_at)
    VALUES (v_tenant_id, p_user_id, 'refund_pattern', 'medium', 15,
      jsonb_build_object('recent_refunds', v_recent_refunds),
      NOW() + INTERVAL '30 days'
    ) ON CONFLICT DO NOTHING;
  END IF;
  
  -- SIGNAL 5: Behavior change (sudden drop in health score)
  IF v_health IS NOT NULL AND v_health.overall_score < 50 AND v_health.total_volume_cents > 100000 THEN
    v_signals := v_signals || jsonb_build_object(
      'type', 'behavior_change',
      'severity', 'high',
      'score_impact', 25,
      'details', jsonb_build_object('health_score', v_health.overall_score, 'previous_volume', v_health.total_volume_cents)
    );
    
    INSERT INTO risk_signals (tenant_id, user_id, signal_type, severity, score_impact, metadata, expires_at)
    VALUES (v_tenant_id, p_user_id, 'behavior_change', 'high', 25,
      jsonb_build_object('health_score', v_health.overall_score, 'volume', v_health.total_volume_cents),
      NOW() + INTERVAL '30 days'
    ) ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'signals_detected', jsonb_array_length(v_signals),
    'signals', v_signals,
    'total_risk_impact', (SELECT COALESCE(SUM((s->>'score_impact')::INTEGER), 0) FROM jsonb_array_elements(v_signals) s)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get predictive risk score for a payout
CREATE OR REPLACE FUNCTION get_predictive_risk_score(p_payout_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_base_score INTEGER := 0;
  v_signal_score INTEGER := 0;
  v_health_score INTEGER;
  v_active_signals JSONB;
  v_risk_factors JSONB := '[]'::jsonb;
  v_recommendation TEXT;
  v_delay_hours INTEGER := 0;
BEGIN
  SELECT * INTO v_payout FROM payout_requests WHERE id = p_payout_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not found');
  END IF;
  
  -- Get health score
  SELECT overall_score INTO v_health_score
  FROM organizer_health_scores WHERE organizer_id = v_payout.user_id;
  v_health_score := COALESCE(v_health_score, 50);
  
  -- Get active risk signals
  SELECT jsonb_agg(jsonb_build_object(
    'type', signal_type,
    'severity', severity,
    'impact', score_impact
  )) INTO v_active_signals
  FROM risk_signals
  WHERE user_id = v_payout.user_id
    AND resolved = FALSE
    AND (expires_at IS NULL OR expires_at > NOW());
  
  v_active_signals := COALESCE(v_active_signals, '[]'::jsonb);
  
  -- Calculate signal impact
  SELECT COALESCE(SUM(score_impact), 0) INTO v_signal_score
  FROM risk_signals
  WHERE user_id = v_payout.user_id
    AND resolved = FALSE
    AND (expires_at IS NULL OR expires_at > NOW());
  
  -- Base score from health
  v_base_score := 100 - v_health_score;
  
  -- Add signal score
  v_base_score := v_base_score + v_signal_score;
  
  -- Add factors
  IF v_payout.amount_cents > 100000 THEN
    v_base_score := v_base_score + 15;
    v_risk_factors := v_risk_factors || jsonb_build_object('factor', 'large_amount', 'impact', 15);
  END IF;
  
  IF v_payout.fraud_score IS NOT NULL AND v_payout.fraud_score > 30 THEN
    v_base_score := v_base_score + v_payout.fraud_score;
    v_risk_factors := v_risk_factors || jsonb_build_object('factor', 'fraud_score', 'impact', v_payout.fraud_score);
  END IF;
  
  -- Cap at 100
  v_base_score := LEAST(100, v_base_score);
  
  -- Determine recommendation
  IF v_base_score >= 70 THEN
    v_recommendation := 'hold_for_review';
    v_delay_hours := 72;
  ELSIF v_base_score >= 50 THEN
    v_recommendation := 'delay_48h';
    v_delay_hours := 48;
  ELSIF v_base_score >= 30 THEN
    v_recommendation := 'delay_24h';
    v_delay_hours := 24;
  ELSE
    v_recommendation := 'approve';
    v_delay_hours := 0;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'payout_id', p_payout_id,
    'predictive_risk_score', v_base_score,
    'health_score', v_health_score,
    'signal_impact', v_signal_score,
    'active_signals', v_active_signals,
    'risk_factors', v_risk_factors,
    'recommendation', v_recommendation,
    'recommended_delay_hours', v_delay_hours
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. DYNAMIC FEE FUNCTIONS
-- =====================================================

-- Calculate dynamic fees for an organizer
CREATE OR REPLACE FUNCTION calculate_dynamic_fees(p_organizer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_health RECORD;
  v_tier TEXT;
  v_platform_fee_bps INTEGER;
  v_processing_fee_bps INTEGER;
  v_payout_fee_bps INTEGER;
  v_multiplier DECIMAL;
  v_volume_discount_bps INTEGER := 0;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = p_organizer_id;
  
  -- Get health score
  SELECT * INTO v_health FROM organizer_health_scores WHERE organizer_id = p_organizer_id;
  
  -- Determine tier based on health
  IF v_health IS NULL THEN
    v_tier := 'standard';
    v_multiplier := 1.0;
  ELSIF v_health.overall_score >= 85 AND v_health.disputes_lost = 0 THEN
    v_tier := 'preferred';
    v_multiplier := 0.85; -- 15% discount
  ELSIF v_health.overall_score >= 70 THEN
    v_tier := 'standard';
    v_multiplier := 1.0;
  ELSIF v_health.overall_score >= 50 THEN
    v_tier := 'elevated';
    v_multiplier := 1.15; -- 15% premium
  ELSE
    v_tier := 'high_risk';
    v_multiplier := 1.35; -- 35% premium
  END IF;
  
  -- Volume discounts
  IF v_health IS NOT NULL THEN
    IF v_health.total_volume_cents >= 10000000 THEN -- $100k+
      v_volume_discount_bps := 50; -- 0.5% discount
    ELSIF v_health.total_volume_cents >= 1000000 THEN -- $10k+
      v_volume_discount_bps := 25; -- 0.25% discount
    END IF;
  END IF;
  
  -- Base fees (in basis points)
  v_platform_fee_bps := 500; -- 5%
  v_processing_fee_bps := 290; -- 2.9%
  v_payout_fee_bps := 25; -- 0.25%
  
  -- Apply multiplier to platform fee
  v_platform_fee_bps := (v_platform_fee_bps * v_multiplier)::INTEGER;
  
  -- Apply volume discount
  v_platform_fee_bps := GREATEST(200, v_platform_fee_bps - v_volume_discount_bps); -- Min 2%
  
  -- Upsert fee tier
  INSERT INTO organizer_fee_tiers (
    organizer_id, tenant_id, platform_fee_bps, processing_fee_bps, payout_fee_bps,
    tier, fee_multiplier, volume_discount_bps,
    health_score_at_calculation, dispute_rate_at_calculation, volume_at_calculation
  ) VALUES (
    p_organizer_id, v_tenant_id, v_platform_fee_bps, v_processing_fee_bps, v_payout_fee_bps,
    v_tier, v_multiplier, v_volume_discount_bps,
    COALESCE(v_health.overall_score, 50),
    COALESCE(v_health.dispute_rate, 0),
    COALESCE(v_health.total_volume_cents, 0)
  )
  ON CONFLICT (organizer_id) DO UPDATE SET
    platform_fee_bps = EXCLUDED.platform_fee_bps,
    processing_fee_bps = EXCLUDED.processing_fee_bps,
    payout_fee_bps = EXCLUDED.payout_fee_bps,
    tier = EXCLUDED.tier,
    fee_multiplier = EXCLUDED.fee_multiplier,
    volume_discount_bps = EXCLUDED.volume_discount_bps,
    health_score_at_calculation = EXCLUDED.health_score_at_calculation,
    dispute_rate_at_calculation = EXCLUDED.dispute_rate_at_calculation,
    volume_at_calculation = EXCLUDED.volume_at_calculation,
    updated_at = NOW()
  WHERE organizer_fee_tiers.is_override = FALSE;
  
  RETURN jsonb_build_object(
    'success', true,
    'organizer_id', p_organizer_id,
    'tier', v_tier,
    'fees', jsonb_build_object(
      'platform_fee_bps', v_platform_fee_bps,
      'platform_fee_percent', v_platform_fee_bps / 100.0,
      'processing_fee_bps', v_processing_fee_bps,
      'processing_fee_percent', v_processing_fee_bps / 100.0,
      'payout_fee_bps', v_payout_fee_bps,
      'payout_fee_percent', v_payout_fee_bps / 100.0
    ),
    'multiplier', v_multiplier,
    'volume_discount_bps', v_volume_discount_bps,
    'health_score', COALESCE(v_health.overall_score, 50)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get effective fees for a transaction
CREATE OR REPLACE FUNCTION get_effective_fees(p_organizer_id UUID, p_amount_cents BIGINT)
RETURNS JSONB AS $$
DECLARE
  v_fees RECORD;
  v_platform_fee BIGINT;
  v_processing_fee BIGINT;
  v_net_amount BIGINT;
BEGIN
  SELECT * INTO v_fees FROM organizer_fee_tiers WHERE organizer_id = p_organizer_id;
  
  -- If no fees set, calculate them
  IF NOT FOUND THEN
    PERFORM calculate_dynamic_fees(p_organizer_id);
    SELECT * INTO v_fees FROM organizer_fee_tiers WHERE organizer_id = p_organizer_id;
  END IF;
  
  -- Use defaults if still not found
  IF NOT FOUND THEN
    v_fees.platform_fee_bps := 500;
    v_fees.processing_fee_bps := 290;
    v_fees.tier := 'standard';
  END IF;
  
  -- Calculate fees
  v_platform_fee := (p_amount_cents * v_fees.platform_fee_bps / 10000)::BIGINT;
  v_processing_fee := (p_amount_cents * v_fees.processing_fee_bps / 10000)::BIGINT;
  v_net_amount := p_amount_cents - v_platform_fee - v_processing_fee;
  
  RETURN jsonb_build_object(
    'gross_amount_cents', p_amount_cents,
    'platform_fee_cents', v_platform_fee,
    'processing_fee_cents', v_processing_fee,
    'total_fees_cents', v_platform_fee + v_processing_fee,
    'net_amount_cents', v_net_amount,
    'tier', v_fees.tier,
    'platform_fee_bps', v_fees.platform_fee_bps,
    'processing_fee_bps', v_fees.processing_fee_bps
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. CAPITAL ADVANCE FUNCTIONS
-- =====================================================

-- Calculate advance eligibility
CREATE OR REPLACE FUNCTION calculate_advance_eligibility(p_organizer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_health RECORD;
  v_avg_monthly_volume BIGINT;
  v_existing_advance RECORD;
  v_max_advance BIGINT;
  v_fee_rate_bps INTEGER;
  v_is_eligible BOOLEAN := FALSE;
  v_rejection_reasons JSONB := '[]'::jsonb;
BEGIN
  -- Get health score
  SELECT * INTO v_health FROM organizer_health_scores WHERE organizer_id = p_organizer_id;
  
  IF v_health IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reasons', jsonb_build_array('No financial history')
    );
  END IF;
  
  -- Check for existing active advance
  SELECT * INTO v_existing_advance
  FROM capital_advances
  WHERE organizer_id = p_organizer_id
    AND status IN ('active', 'repaying', 'approved', 'pending');
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reasons', jsonb_build_array('Existing advance must be repaid first'),
      'existing_advance_id', v_existing_advance.id,
      'remaining_balance', v_existing_advance.remaining_balance_cents
    );
  END IF;
  
  -- Calculate average monthly volume (last 3 months)
  SELECT COALESCE(AVG(monthly_total), 0)::BIGINT INTO v_avg_monthly_volume
  FROM (
    SELECT date_trunc('month', created_at) AS month, SUM(amount_cents) AS monthly_total
    FROM payout_requests
    WHERE user_id = p_organizer_id
      AND status = 'completed'
      AND created_at > NOW() - INTERVAL '3 months'
    GROUP BY date_trunc('month', created_at)
  ) monthly;
  
  -- Eligibility checks
  IF v_health.tenure_score < 40 THEN
    v_rejection_reasons := v_rejection_reasons || '"Account too new (min 90 days)"'::jsonb;
  END IF;
  
  IF v_health.overall_score < 60 THEN
    v_rejection_reasons := v_rejection_reasons || '"Health score too low (min 60)"'::jsonb;
  END IF;
  
  IF v_health.total_volume_cents < 500000 THEN
    v_rejection_reasons := v_rejection_reasons || '"Insufficient volume history (min $5,000)"'::jsonb;
  END IF;
  
  IF v_health.disputes_lost > 0 THEN
    v_rejection_reasons := v_rejection_reasons || '"Recent dispute losses"'::jsonb;
  END IF;
  
  IF v_avg_monthly_volume < 100000 THEN
    v_rejection_reasons := v_rejection_reasons || '"Average monthly volume too low"'::jsonb;
  END IF;
  
  -- If no rejection reasons, they're eligible
  v_is_eligible := jsonb_array_length(v_rejection_reasons) = 0;
  
  -- Calculate max advance (up to 1 month of avg volume, capped by health score)
  IF v_is_eligible THEN
    v_max_advance := LEAST(
      v_avg_monthly_volume,
      (v_health.total_volume_cents * 0.1)::BIGINT, -- Max 10% of total historical
      1000000 -- Hard cap $10,000
    );
    
    -- Adjust by health score
    v_max_advance := (v_max_advance * (v_health.overall_score / 100.0))::BIGINT;
    
    -- Determine fee rate based on risk
    IF v_health.overall_score >= 85 THEN
      v_fee_rate_bps := 500; -- 5%
    ELSIF v_health.overall_score >= 70 THEN
      v_fee_rate_bps := 800; -- 8%
    ELSE
      v_fee_rate_bps := 1200; -- 12%
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'eligible', v_is_eligible,
    'organizer_id', p_organizer_id,
    'max_advance_cents', COALESCE(v_max_advance, 0),
    'fee_rate_bps', COALESCE(v_fee_rate_bps, 0),
    'fee_rate_percent', COALESCE(v_fee_rate_bps / 100.0, 0),
    'repayment_rate_bps', 1500, -- 15% of each payout
    'avg_monthly_volume_cents', v_avg_monthly_volume,
    'health_score', v_health.overall_score,
    'tenure_score', v_health.tenure_score,
    'reasons', CASE WHEN v_is_eligible THEN '[]'::jsonb ELSE v_rejection_reasons END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Request capital advance
CREATE OR REPLACE FUNCTION request_capital_advance(
  p_organizer_id UUID,
  p_amount_cents BIGINT
)
RETURNS JSONB AS $$
DECLARE
  v_eligibility JSONB;
  v_max_advance BIGINT;
  v_fee_rate_bps INTEGER;
  v_fee_amount BIGINT;
  v_total_repayment BIGINT;
  v_advance_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Check eligibility
  v_eligibility := calculate_advance_eligibility(p_organizer_id);
  
  IF NOT (v_eligibility->>'eligible')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not eligible for advance',
      'reasons', v_eligibility->'reasons'
    );
  END IF;
  
  v_max_advance := (v_eligibility->>'max_advance_cents')::BIGINT;
  v_fee_rate_bps := (v_eligibility->>'fee_rate_bps')::INTEGER;
  
  IF p_amount_cents > v_max_advance THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Requested amount exceeds maximum',
      'max_advance_cents', v_max_advance,
      'requested_cents', p_amount_cents
    );
  END IF;
  
  IF p_amount_cents < 10000 THEN -- Min $100
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Minimum advance is $100'
    );
  END IF;
  
  -- Calculate fee and total repayment
  v_fee_amount := (p_amount_cents * v_fee_rate_bps / 10000)::BIGINT;
  v_total_repayment := p_amount_cents + v_fee_amount;
  
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = p_organizer_id;
  
  -- Create advance request
  INSERT INTO capital_advances (
    tenant_id, organizer_id, advance_amount_cents, fee_amount_cents, 
    total_repayment_cents, remaining_balance_cents, fee_rate_bps, repayment_rate_bps,
    status, health_score_at_approval, projected_monthly_volume_cents,
    risk_tier_at_approval
  ) VALUES (
    v_tenant_id, p_organizer_id, p_amount_cents, v_fee_amount,
    v_total_repayment, v_total_repayment, v_fee_rate_bps, 1500,
    'pending',
    (v_eligibility->>'health_score')::INTEGER,
    (v_eligibility->>'avg_monthly_volume_cents')::BIGINT,
    (SELECT risk_tier FROM organizer_health_scores WHERE organizer_id = p_organizer_id)
  )
  RETURNING id INTO v_advance_id;
  
  -- Create audit log
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (p_organizer_id, 'capital_advance_requested', 'capital_advance', v_advance_id,
    jsonb_build_object(
      'amount_cents', p_amount_cents,
      'fee_cents', v_fee_amount,
      'total_repayment_cents', v_total_repayment
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'advance_id', v_advance_id,
    'advance_amount_cents', p_amount_cents,
    'fee_amount_cents', v_fee_amount,
    'total_repayment_cents', v_total_repayment,
    'fee_rate_percent', v_fee_rate_bps / 100.0,
    'repayment_rate_percent', 15,
    'status', 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process advance repayment (called during payout)
CREATE OR REPLACE FUNCTION process_advance_repayment(
  p_payout_id UUID,
  p_payout_amount_cents BIGINT
)
RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_advance RECORD;
  v_repayment_amount BIGINT;
  v_new_balance BIGINT;
BEGIN
  SELECT * INTO v_payout FROM payout_requests WHERE id = p_payout_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not found');
  END IF;
  
  -- Check for active advance
  SELECT * INTO v_advance
  FROM capital_advances
  WHERE organizer_id = v_payout.user_id
    AND status IN ('active', 'repaying')
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_advance', false,
      'full_payout_cents', p_payout_amount_cents
    );
  END IF;
  
  -- Calculate repayment (15% of payout or remaining balance, whichever is less)
  v_repayment_amount := LEAST(
    (p_payout_amount_cents * v_advance.repayment_rate_bps / 10000)::BIGINT,
    v_advance.remaining_balance_cents
  );
  
  v_new_balance := v_advance.remaining_balance_cents - v_repayment_amount;
  
  -- Update advance
  UPDATE capital_advances
  SET 
    amount_repaid_cents = amount_repaid_cents + v_repayment_amount,
    remaining_balance_cents = v_new_balance,
    repayment_count = repayment_count + 1,
    last_repayment_at = NOW(),
    status = CASE WHEN v_new_balance <= 0 THEN 'paid_off' ELSE 'repaying' END,
    updated_at = NOW()
  WHERE id = v_advance.id;
  
  -- Audit log
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
  VALUES (v_payout.user_id, 'advance_repayment', 'capital_advance', v_advance.id,
    jsonb_build_object(
      'repayment_cents', v_repayment_amount,
      'remaining_balance_cents', v_new_balance,
      'payout_id', p_payout_id,
      'is_paid_off', v_new_balance <= 0
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'has_advance', true,
    'advance_id', v_advance.id,
    'repayment_cents', v_repayment_amount,
    'remaining_balance_cents', v_new_balance,
    'is_paid_off', v_new_balance <= 0,
    'net_payout_cents', p_payout_amount_cents - v_repayment_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. ADMIN QUERY FUNCTIONS
-- =====================================================

-- Get all risk signals for admin
CREATE OR REPLACE FUNCTION get_risk_signals(
  p_tenant_id UUID,
  p_severity TEXT DEFAULT NULL,
  p_resolved BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB AS $$
DECLARE
  v_signals JSONB;
  v_stats JSONB;
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'manager', 'finance')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;
  
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'critical', COUNT(*) FILTER (WHERE severity = 'critical' AND resolved = FALSE),
    'high', COUNT(*) FILTER (WHERE severity = 'high' AND resolved = FALSE),
    'medium', COUNT(*) FILTER (WHERE severity = 'medium' AND resolved = FALSE),
    'low', COUNT(*) FILTER (WHERE severity = 'low' AND resolved = FALSE)
  ) INTO v_stats
  FROM risk_signals
  WHERE tenant_id = p_tenant_id;
  
  SELECT jsonb_agg(row_to_json(t)) INTO v_signals
  FROM (
    SELECT 
      rs.*,
      p.display_name AS user_display_name,
      p.email AS user_email
    FROM risk_signals rs
    LEFT JOIN profiles p ON p.id = rs.user_id
    WHERE rs.tenant_id = p_tenant_id
      AND (p_severity IS NULL OR rs.severity = p_severity)
      AND rs.resolved = p_resolved
    ORDER BY 
      CASE rs.severity
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        ELSE 3
      END,
      rs.created_at DESC
    LIMIT p_limit
  ) t;
  
  RETURN jsonb_build_object(
    'signals', COALESCE(v_signals, '[]'::jsonb),
    'stats', v_stats
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get capital advances for admin
CREATE OR REPLACE FUNCTION get_capital_advances(
  p_tenant_id UUID,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB AS $$
DECLARE
  v_advances JSONB;
  v_stats JSONB;
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'manager')
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;
  
  SELECT jsonb_build_object(
    'total_advanced_cents', COALESCE(SUM(advance_amount_cents), 0),
    'total_outstanding_cents', COALESCE(SUM(remaining_balance_cents) FILTER (WHERE status IN ('active', 'repaying')), 0),
    'total_repaid_cents', COALESCE(SUM(amount_repaid_cents), 0),
    'active_count', COUNT(*) FILTER (WHERE status IN ('active', 'repaying')),
    'pending_count', COUNT(*) FILTER (WHERE status = 'pending'),
    'paid_off_count', COUNT(*) FILTER (WHERE status = 'paid_off'),
    'defaulted_count', COUNT(*) FILTER (WHERE status = 'defaulted')
  ) INTO v_stats
  FROM capital_advances
  WHERE tenant_id = p_tenant_id;
  
  SELECT jsonb_agg(row_to_json(t)) INTO v_advances
  FROM (
    SELECT 
      ca.*,
      p.display_name AS organizer_display_name,
      p.email AS organizer_email
    FROM capital_advances ca
    LEFT JOIN profiles p ON p.id = ca.organizer_id
    WHERE ca.tenant_id = p_tenant_id
      AND (p_status IS NULL OR ca.status = p_status)
    ORDER BY ca.created_at DESC
    LIMIT p_limit
  ) t;
  
  RETURN jsonb_build_object(
    'advances', COALESCE(v_advances, '[]'::jsonb),
    'stats', v_stats
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION detect_risk_signals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_predictive_risk_score(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_dynamic_fees(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_effective_fees(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_advance_eligibility(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION request_capital_advance(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_advance_repayment(UUID, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION get_risk_signals(UUID, TEXT, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_capital_advances(UUID, TEXT, INTEGER) TO authenticated;
