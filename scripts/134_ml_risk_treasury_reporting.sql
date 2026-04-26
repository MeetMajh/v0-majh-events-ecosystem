-- =====================================================
-- ML-BACKED RISK ENGINE + TREASURY + INVESTOR REPORTING
-- Final evolution tier for fintech infrastructure
-- =====================================================

-- =====================================================
-- 1. ML MODEL INFRASTRUCTURE
-- =====================================================

-- Model registry for tracking trained models
CREATE TABLE IF NOT EXISTS ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('risk_scoring', 'churn_prediction', 'fraud_detection', 'ltv_prediction')),
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT FALSE,
  accuracy DECIMAL(5,4),
  precision_score DECIMAL(5,4),
  recall_score DECIMAL(5,4),
  f1_score DECIMAL(5,4),
  feature_weights JSONB DEFAULT '{}',
  training_metadata JSONB DEFAULT '{}',
  trained_at TIMESTAMPTZ,
  deployed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, model_name, version)
);

-- Feature store for ML inputs
CREATE TABLE IF NOT EXISTS ml_feature_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  -- Behavioral features
  f_transaction_count_30d INTEGER DEFAULT 0,
  f_transaction_volume_30d BIGINT DEFAULT 0,
  f_avg_transaction_size BIGINT DEFAULT 0,
  f_transaction_velocity DECIMAL(10,4) DEFAULT 0,
  f_unique_buyers_30d INTEGER DEFAULT 0,
  -- Risk features
  f_dispute_count_lifetime INTEGER DEFAULT 0,
  f_dispute_count_90d INTEGER DEFAULT 0,
  f_dispute_rate DECIMAL(8,6) DEFAULT 0,
  f_refund_count_30d INTEGER DEFAULT 0,
  f_refund_rate DECIMAL(8,6) DEFAULT 0,
  f_chargeback_count INTEGER DEFAULT 0,
  -- Account features
  f_account_age_days INTEGER DEFAULT 0,
  f_payout_count_lifetime INTEGER DEFAULT 0,
  f_payout_success_rate DECIMAL(5,4) DEFAULT 1,
  f_avg_payout_time_hours DECIMAL(10,2) DEFAULT 0,
  -- Engagement features
  f_login_frequency_30d INTEGER DEFAULT 0,
  f_events_created_30d INTEGER DEFAULT 0,
  f_profile_completeness DECIMAL(5,4) DEFAULT 0,
  -- Computed scores
  computed_risk_score INTEGER DEFAULT 50,
  computed_churn_probability DECIMAL(5,4) DEFAULT 0,
  computed_ltv_cents BIGINT DEFAULT 0,
  -- Metadata
  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organizer_id)
);

CREATE INDEX IF NOT EXISTS idx_ml_features_tenant ON ml_feature_store(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ml_features_risk ON ml_feature_store(computed_risk_score DESC);

-- Scoring history for audit and model improvement
CREATE TABLE IF NOT EXISTS ml_scoring_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  organizer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  model_id UUID REFERENCES ml_models(id),
  score_type TEXT NOT NULL,
  input_features JSONB DEFAULT '{}',
  raw_score DECIMAL(10,6),
  normalized_score INTEGER,
  confidence DECIMAL(5,4),
  decision TEXT,
  outcome TEXT, -- actual outcome for model training
  outcome_recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scoring_history_organizer ON ml_scoring_history(organizer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scoring_history_outcome ON ml_scoring_history(outcome) WHERE outcome IS NOT NULL;

-- =====================================================
-- 2. TREASURY MANAGEMENT
-- =====================================================

-- Treasury snapshots for tracking balances over time
CREATE TABLE IF NOT EXISTS treasury_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  -- Stripe balances
  stripe_available_cents BIGINT DEFAULT 0,
  stripe_pending_cents BIGINT DEFAULT 0,
  stripe_connect_reserve_cents BIGINT DEFAULT 0,
  -- Platform balances
  platform_escrow_cents BIGINT DEFAULT 0,
  platform_reserve_cents BIGINT DEFAULT 0,
  platform_revenue_cents BIGINT DEFAULT 0,
  -- Liability positions
  pending_payouts_cents BIGINT DEFAULT 0,
  held_payouts_cents BIGINT DEFAULT 0,
  active_advances_cents BIGINT DEFAULT 0,
  dispute_reserve_cents BIGINT DEFAULT 0,
  -- Computed metrics
  net_position_cents BIGINT DEFAULT 0,
  liquidity_ratio DECIMAL(8,4) DEFAULT 0,
  reserve_coverage_ratio DECIMAL(8,4) DEFAULT 0,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_treasury_snapshots_tenant ON treasury_snapshots(tenant_id, snapshot_date DESC);

-- Treasury rules for automated rebalancing
CREATE TABLE IF NOT EXISTS treasury_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('min_reserve', 'max_exposure', 'liquidity_threshold', 'auto_sweep', 'alert_threshold')),
  is_enabled BOOLEAN DEFAULT TRUE,
  threshold_value DECIMAL(15,4),
  threshold_unit TEXT CHECK (threshold_unit IN ('cents', 'percent', 'ratio')),
  action_type TEXT CHECK (action_type IN ('alert', 'hold_payouts', 'sweep_to_reserve', 'require_approval')),
  action_config JSONB DEFAULT '{}',
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, rule_name)
);

-- Treasury actions log
CREATE TABLE IF NOT EXISTS treasury_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  triggered_by TEXT, -- 'rule', 'manual', 'system'
  rule_id UUID REFERENCES treasury_rules(id),
  amount_cents BIGINT,
  from_account TEXT,
  to_account TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  executed_by UUID REFERENCES profiles(id),
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. INVESTOR-GRADE REPORTING
-- =====================================================

-- Financial reports table
CREATE TABLE IF NOT EXISTS financial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  -- Revenue metrics
  gross_revenue_cents BIGINT DEFAULT 0,
  platform_fees_cents BIGINT DEFAULT 0,
  processing_fees_cents BIGINT DEFAULT 0,
  net_revenue_cents BIGINT DEFAULT 0,
  -- Transaction metrics
  transaction_count INTEGER DEFAULT 0,
  avg_transaction_cents BIGINT DEFAULT 0,
  unique_buyers INTEGER DEFAULT 0,
  unique_organizers INTEGER DEFAULT 0,
  -- Payout metrics
  total_payouts_cents BIGINT DEFAULT 0,
  payout_count INTEGER DEFAULT 0,
  avg_payout_time_hours DECIMAL(10,2) DEFAULT 0,
  -- Risk metrics
  dispute_count INTEGER DEFAULT 0,
  dispute_amount_cents BIGINT DEFAULT 0,
  dispute_rate DECIMAL(8,6) DEFAULT 0,
  refund_count INTEGER DEFAULT 0,
  refund_amount_cents BIGINT DEFAULT 0,
  refund_rate DECIMAL(8,6) DEFAULT 0,
  -- Capital metrics
  advances_issued_cents BIGINT DEFAULT 0,
  advances_repaid_cents BIGINT DEFAULT 0,
  advance_fee_revenue_cents BIGINT DEFAULT 0,
  -- Growth metrics
  new_organizers INTEGER DEFAULT 0,
  churned_organizers INTEGER DEFAULT 0,
  organizer_retention_rate DECIMAL(5,4) DEFAULT 0,
  -- Computed KPIs
  take_rate DECIMAL(6,4) DEFAULT 0,
  ltv_per_organizer_cents BIGINT DEFAULT 0,
  cac_per_organizer_cents BIGINT DEFAULT 0,
  -- Report metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID REFERENCES profiles(id),
  is_finalized BOOLEAN DEFAULT FALSE,
  finalized_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_reports_tenant ON financial_reports(tenant_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_financial_reports_type ON financial_reports(report_type);

-- Cohort analysis table
CREATE TABLE IF NOT EXISTS organizer_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  cohort_month DATE NOT NULL, -- First day of cohort month
  organizer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  -- Cohort metrics (updated over time)
  month_0_revenue_cents BIGINT DEFAULT 0,
  month_1_revenue_cents BIGINT DEFAULT 0,
  month_2_revenue_cents BIGINT DEFAULT 0,
  month_3_revenue_cents BIGINT DEFAULT 0,
  month_6_revenue_cents BIGINT DEFAULT 0,
  month_12_revenue_cents BIGINT DEFAULT 0,
  -- Activity tracking
  months_active INTEGER DEFAULT 1,
  last_active_month DATE,
  is_churned BOOLEAN DEFAULT FALSE,
  churned_at DATE,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, cohort_month, organizer_id)
);

CREATE INDEX IF NOT EXISTS idx_cohorts_tenant ON organizer_cohorts(tenant_id, cohort_month);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_feature_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_scoring_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_cohorts ENABLE ROW LEVEL SECURITY;

-- ML tables
CREATE POLICY "Staff can view ML models" ON ml_models FOR SELECT 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'manager')));
CREATE POLICY "Service role manages ML" ON ml_models FOR ALL 
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Organizers can view own features" ON ml_feature_store FOR SELECT 
  USING (organizer_id = auth.uid());
CREATE POLICY "Staff can view all features" ON ml_feature_store FOR SELECT 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'manager', 'finance')));
CREATE POLICY "Service role manages features" ON ml_feature_store FOR ALL 
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Staff can view scoring history" ON ml_scoring_history FOR SELECT 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'manager', 'finance')));
CREATE POLICY "Service role manages scoring" ON ml_scoring_history FOR ALL 
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Treasury tables
CREATE POLICY "Staff can view treasury" ON treasury_snapshots FOR SELECT 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'finance')));
CREATE POLICY "Service role manages treasury" ON treasury_snapshots FOR ALL 
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Staff can manage treasury rules" ON treasury_rules FOR ALL 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner')));
CREATE POLICY "Service role manages rules" ON treasury_rules FOR ALL 
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Staff can view treasury actions" ON treasury_actions FOR SELECT 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'finance')));
CREATE POLICY "Service role manages actions" ON treasury_actions FOR ALL 
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Reporting tables
CREATE POLICY "Staff can view reports" ON financial_reports FOR SELECT 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'finance')));
CREATE POLICY "Staff can manage reports" ON financial_reports FOR ALL 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner')));

CREATE POLICY "Staff can view cohorts" ON organizer_cohorts FOR SELECT 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'manager', 'finance')));
CREATE POLICY "Service role manages cohorts" ON organizer_cohorts FOR ALL 
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- ML FEATURE COMPUTATION
-- =====================================================

CREATE OR REPLACE FUNCTION compute_ml_features(p_organizer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_features RECORD;
  v_tx_30d RECORD;
  v_risk RECORD;
  v_account RECORD;
  v_engagement RECORD;
  v_risk_score INTEGER;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = p_organizer_id;
  
  -- Transaction features (30 days)
  SELECT 
    COUNT(*) as tx_count,
    COALESCE(SUM(fi.amount_cents), 0) as tx_volume,
    COALESCE(AVG(fi.amount_cents), 0)::BIGINT as avg_size,
    COUNT(DISTINCT fi.user_id) as unique_buyers
  INTO v_tx_30d
  FROM financial_intents fi
  JOIN tournaments t ON t.id = fi.reference_id
  WHERE t.organizer_id = p_organizer_id
    AND fi.status = 'succeeded'
    AND fi.intent_type IN ('tournament_entry', 'ticket_purchase')
    AND fi.created_at > NOW() - INTERVAL '30 days';
  
  -- Risk features
  SELECT 
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '90 days') as disputes_90d,
    COUNT(*) as disputes_lifetime
  INTO v_risk
  FROM disputes
  WHERE organizer_id = p_organizer_id;
  
  -- Account features
  SELECT 
    EXTRACT(DAY FROM NOW() - p.created_at)::INTEGER as age_days,
    COUNT(pr.*) as payout_count,
    COALESCE(AVG(CASE WHEN pr.status = 'completed' THEN 1 ELSE 0 END), 1)::DECIMAL as success_rate
  INTO v_account
  FROM profiles p
  LEFT JOIN payout_requests pr ON pr.user_id = p.id
  WHERE p.id = p_organizer_id
  GROUP BY p.created_at;
  
  -- Compute risk score using weighted formula
  v_risk_score := LEAST(100, GREATEST(0,
    50 -- Base score
    + (v_risk.disputes_90d * 15) -- Recent disputes heavily weighted
    + (v_risk.disputes_lifetime * 5) -- Historical disputes
    - (CASE WHEN v_account.age_days > 365 THEN 20 WHEN v_account.age_days > 180 THEN 10 WHEN v_account.age_days > 90 THEN 5 ELSE 0 END) -- Tenure bonus
    - (CASE WHEN v_tx_30d.tx_volume > 1000000 THEN 15 WHEN v_tx_30d.tx_volume > 100000 THEN 10 ELSE 0 END) -- Volume bonus
    + (CASE WHEN v_account.success_rate < 0.9 THEN 20 WHEN v_account.success_rate < 0.95 THEN 10 ELSE 0 END) -- Payout failure penalty
  ));
  
  -- Upsert features
  INSERT INTO ml_feature_store (
    organizer_id, tenant_id,
    f_transaction_count_30d, f_transaction_volume_30d, f_avg_transaction_size, f_unique_buyers_30d,
    f_dispute_count_lifetime, f_dispute_count_90d,
    f_account_age_days, f_payout_count_lifetime, f_payout_success_rate,
    computed_risk_score, last_computed_at, updated_at
  ) VALUES (
    p_organizer_id, v_tenant_id,
    v_tx_30d.tx_count, v_tx_30d.tx_volume, v_tx_30d.avg_size, v_tx_30d.unique_buyers,
    v_risk.disputes_lifetime, v_risk.disputes_90d,
    v_account.age_days, v_account.payout_count, v_account.success_rate,
    v_risk_score, NOW(), NOW()
  )
  ON CONFLICT (organizer_id) DO UPDATE SET
    f_transaction_count_30d = EXCLUDED.f_transaction_count_30d,
    f_transaction_volume_30d = EXCLUDED.f_transaction_volume_30d,
    f_avg_transaction_size = EXCLUDED.f_avg_transaction_size,
    f_unique_buyers_30d = EXCLUDED.f_unique_buyers_30d,
    f_dispute_count_lifetime = EXCLUDED.f_dispute_count_lifetime,
    f_dispute_count_90d = EXCLUDED.f_dispute_count_90d,
    f_account_age_days = EXCLUDED.f_account_age_days,
    f_payout_count_lifetime = EXCLUDED.f_payout_count_lifetime,
    f_payout_success_rate = EXCLUDED.f_payout_success_rate,
    computed_risk_score = EXCLUDED.computed_risk_score,
    last_computed_at = NOW(),
    updated_at = NOW();
  
  RETURN jsonb_build_object(
    'success', true,
    'organizer_id', p_organizer_id,
    'risk_score', v_risk_score,
    'features', jsonb_build_object(
      'tx_count_30d', v_tx_30d.tx_count,
      'tx_volume_30d', v_tx_30d.tx_volume,
      'disputes_90d', v_risk.disputes_90d,
      'account_age_days', v_account.age_days
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ML-BACKED RISK SCORING
-- =====================================================

CREATE OR REPLACE FUNCTION ml_score_payout_risk(p_payout_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_features RECORD;
  v_model RECORD;
  v_raw_score DECIMAL;
  v_normalized_score INTEGER;
  v_confidence DECIMAL;
  v_decision TEXT;
  v_factors JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO v_payout FROM payout_requests WHERE id = p_payout_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not found');
  END IF;
  
  -- Ensure features are computed
  PERFORM compute_ml_features(v_payout.user_id);
  SELECT * INTO v_features FROM ml_feature_store WHERE organizer_id = v_payout.user_id;
  
  -- Get active risk model (or use default scoring)
  SELECT * INTO v_model FROM ml_models 
  WHERE model_type = 'risk_scoring' AND is_active = TRUE 
  ORDER BY version DESC LIMIT 1;
  
  -- Compute weighted score using feature weights (or defaults)
  IF v_model IS NOT NULL AND v_model.feature_weights IS NOT NULL THEN
    -- Use model weights
    v_raw_score := 
      COALESCE((v_model.feature_weights->>'dispute_weight')::DECIMAL, 0.3) * v_features.f_dispute_count_90d * 10 +
      COALESCE((v_model.feature_weights->>'volume_weight')::DECIMAL, -0.1) * LEAST(100, v_features.f_transaction_volume_30d / 100000) +
      COALESCE((v_model.feature_weights->>'tenure_weight')::DECIMAL, -0.2) * LEAST(100, v_features.f_account_age_days / 3.65) +
      COALESCE((v_model.feature_weights->>'payout_weight')::DECIMAL, 0.2) * (100 - v_features.f_payout_success_rate * 100);
    v_confidence := COALESCE(v_model.accuracy, 0.75);
  ELSE
    -- Default scoring
    v_raw_score := v_features.computed_risk_score::DECIMAL;
    v_confidence := 0.7;
  END IF;
  
  -- Normalize to 0-100
  v_normalized_score := LEAST(100, GREATEST(0, v_raw_score::INTEGER));
  
  -- Amount-based adjustment
  IF v_payout.amount_cents > 500000 THEN
    v_normalized_score := v_normalized_score + 15;
    v_factors := v_factors || jsonb_build_object('factor', 'high_amount', 'impact', 15);
  ELSIF v_payout.amount_cents > 100000 THEN
    v_normalized_score := v_normalized_score + 5;
    v_factors := v_factors || jsonb_build_object('factor', 'medium_amount', 'impact', 5);
  END IF;
  
  -- Velocity check
  IF v_features.f_transaction_volume_30d > 0 AND 
     v_payout.amount_cents > v_features.f_transaction_volume_30d * 0.5 THEN
    v_normalized_score := v_normalized_score + 20;
    v_factors := v_factors || jsonb_build_object('factor', 'velocity_anomaly', 'impact', 20);
  END IF;
  
  v_normalized_score := LEAST(100, v_normalized_score);
  
  -- Decision logic
  v_decision := CASE 
    WHEN v_normalized_score >= 75 THEN 'hold'
    WHEN v_normalized_score >= 50 THEN 'delay_48h'
    WHEN v_normalized_score >= 25 THEN 'delay_24h'
    ELSE 'approve'
  END;
  
  -- Record scoring for model training
  INSERT INTO ml_scoring_history (
    tenant_id, organizer_id, model_id, score_type,
    input_features, raw_score, normalized_score, confidence, decision
  ) VALUES (
    v_features.tenant_id, v_payout.user_id, v_model.id, 'payout_risk',
    to_jsonb(v_features), v_raw_score, v_normalized_score, v_confidence, v_decision
  );
  
  -- Add feature-based factors
  IF v_features.f_dispute_count_90d > 0 THEN
    v_factors := v_factors || jsonb_build_object('factor', 'recent_disputes', 'count', v_features.f_dispute_count_90d, 'impact', v_features.f_dispute_count_90d * 10);
  END IF;
  IF v_features.f_account_age_days < 90 THEN
    v_factors := v_factors || jsonb_build_object('factor', 'new_account', 'age_days', v_features.f_account_age_days, 'impact', 10);
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'payout_id', p_payout_id,
    'ml_score', v_normalized_score,
    'confidence', v_confidence,
    'decision', v_decision,
    'factors', v_factors,
    'model_version', v_model.version,
    'features_used', jsonb_build_object(
      'dispute_count_90d', v_features.f_dispute_count_90d,
      'tx_volume_30d', v_features.f_transaction_volume_30d,
      'account_age_days', v_features.f_account_age_days,
      'payout_success_rate', v_features.f_payout_success_rate
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TREASURY AUTOMATION
-- =====================================================

CREATE OR REPLACE FUNCTION capture_treasury_snapshot(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_snapshot RECORD;
  v_escrow BIGINT;
  v_reserve BIGINT;
  v_pending_payouts BIGINT;
  v_held_payouts BIGINT;
  v_active_advances BIGINT;
  v_net_position BIGINT;
  v_liquidity_ratio DECIMAL;
BEGIN
  -- Calculate escrow balance
  SELECT COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_cents 
         WHEN le.direction = 'debit' THEN -le.amount_cents 
         ELSE 0 END
  ), 0) INTO v_escrow
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'escrow'
    AND lt.status = 'posted';
  
  -- Calculate platform reserve
  SELECT COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_cents 
         WHEN le.direction = 'debit' THEN -le.amount_cents 
         ELSE 0 END
  ), 0) INTO v_reserve
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.tenant_id = p_tenant_id
    AND la.account_type = 'dispute_reserve'
    AND lt.status = 'posted';
  
  -- Pending payouts
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_pending_payouts
  FROM payout_requests pr
  JOIN profiles p ON p.id = pr.user_id
  WHERE p.tenant_id = p_tenant_id
    AND pr.status IN ('pending', 'eligible', 'approved', 'processing')
    AND pr.is_on_hold = FALSE;
  
  -- Held payouts
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_held_payouts
  FROM payout_requests pr
  JOIN profiles p ON p.id = pr.user_id
  WHERE p.tenant_id = p_tenant_id
    AND pr.is_on_hold = TRUE;
  
  -- Active advances
  SELECT COALESCE(SUM(total_repayment_cents - amount_repaid_cents), 0) INTO v_active_advances
  FROM capital_advances
  WHERE tenant_id = p_tenant_id
    AND status IN ('active', 'repaying');
  
  -- Net position
  v_net_position := v_escrow + v_reserve - v_pending_payouts - v_held_payouts;
  
  -- Liquidity ratio
  v_liquidity_ratio := CASE 
    WHEN (v_pending_payouts + v_held_payouts) > 0 
    THEN (v_escrow + v_reserve)::DECIMAL / (v_pending_payouts + v_held_payouts)
    ELSE 999.99 
  END;
  
  -- Insert snapshot
  INSERT INTO treasury_snapshots (
    tenant_id, snapshot_date,
    platform_escrow_cents, platform_reserve_cents,
    pending_payouts_cents, held_payouts_cents, active_advances_cents,
    net_position_cents, liquidity_ratio
  ) VALUES (
    p_tenant_id, CURRENT_DATE,
    v_escrow, v_reserve,
    v_pending_payouts, v_held_payouts, v_active_advances,
    v_net_position, v_liquidity_ratio
  )
  ON CONFLICT (tenant_id, snapshot_date) DO UPDATE SET
    platform_escrow_cents = EXCLUDED.platform_escrow_cents,
    platform_reserve_cents = EXCLUDED.platform_reserve_cents,
    pending_payouts_cents = EXCLUDED.pending_payouts_cents,
    held_payouts_cents = EXCLUDED.held_payouts_cents,
    active_advances_cents = EXCLUDED.active_advances_cents,
    net_position_cents = EXCLUDED.net_position_cents,
    liquidity_ratio = EXCLUDED.liquidity_ratio;
  
  RETURN jsonb_build_object(
    'success', true,
    'snapshot_date', CURRENT_DATE,
    'escrow_cents', v_escrow,
    'reserve_cents', v_reserve,
    'pending_payouts_cents', v_pending_payouts,
    'held_payouts_cents', v_held_payouts,
    'active_advances_cents', v_active_advances,
    'net_position_cents', v_net_position,
    'liquidity_ratio', v_liquidity_ratio
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check treasury rules and trigger actions
CREATE OR REPLACE FUNCTION check_treasury_rules(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_snapshot RECORD;
  v_rule RECORD;
  v_triggered INTEGER := 0;
  v_actions JSONB := '[]'::jsonb;
BEGIN
  -- Get latest snapshot
  SELECT * INTO v_snapshot FROM treasury_snapshots 
  WHERE tenant_id = p_tenant_id 
  ORDER BY snapshot_date DESC LIMIT 1;
  
  IF NOT FOUND THEN
    PERFORM capture_treasury_snapshot(p_tenant_id);
    SELECT * INTO v_snapshot FROM treasury_snapshots 
    WHERE tenant_id = p_tenant_id 
    ORDER BY snapshot_date DESC LIMIT 1;
  END IF;
  
  -- Check each enabled rule
  FOR v_rule IN 
    SELECT * FROM treasury_rules 
    WHERE tenant_id = p_tenant_id AND is_enabled = TRUE
  LOOP
    DECLARE
      v_threshold_met BOOLEAN := FALSE;
      v_action_id UUID;
    BEGIN
      -- Evaluate rule
      CASE v_rule.rule_type
        WHEN 'min_reserve' THEN
          v_threshold_met := v_snapshot.platform_reserve_cents < v_rule.threshold_value;
        WHEN 'liquidity_threshold' THEN
          v_threshold_met := v_snapshot.liquidity_ratio < v_rule.threshold_value;
        WHEN 'max_exposure' THEN
          v_threshold_met := (v_snapshot.pending_payouts_cents + v_snapshot.held_payouts_cents) > v_rule.threshold_value;
        ELSE
          v_threshold_met := FALSE;
      END CASE;
      
      IF v_threshold_met THEN
        -- Record action
        INSERT INTO treasury_actions (
          tenant_id, action_type, triggered_by, rule_id, metadata
        ) VALUES (
          p_tenant_id, v_rule.action_type, 'rule', v_rule.id,
          jsonb_build_object(
            'rule_name', v_rule.rule_name,
            'threshold', v_rule.threshold_value,
            'current_value', CASE v_rule.rule_type
              WHEN 'min_reserve' THEN v_snapshot.platform_reserve_cents
              WHEN 'liquidity_threshold' THEN v_snapshot.liquidity_ratio
              WHEN 'max_exposure' THEN v_snapshot.pending_payouts_cents + v_snapshot.held_payouts_cents
            END
          )
        ) RETURNING id INTO v_action_id;
        
        -- Update rule trigger count
        UPDATE treasury_rules 
        SET last_triggered_at = NOW(), trigger_count = trigger_count + 1
        WHERE id = v_rule.id;
        
        v_triggered := v_triggered + 1;
        v_actions := v_actions || jsonb_build_object(
          'rule_name', v_rule.rule_name,
          'action_type', v_rule.action_type,
          'action_id', v_action_id
        );
        
        -- Create alert
        PERFORM create_alert(
          p_tenant_id,
          'treasury_rule_triggered',
          CASE v_rule.action_type WHEN 'hold_payouts' THEN 'critical' ELSE 'warning' END,
          'Treasury Rule Triggered: ' || v_rule.rule_name,
          'Rule threshold breached - ' || v_rule.action_type || ' action initiated',
          'treasury_rule',
          v_rule.id,
          jsonb_build_object('rule_type', v_rule.rule_type, 'threshold', v_rule.threshold_value)
        );
      END IF;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'rules_checked', (SELECT COUNT(*) FROM treasury_rules WHERE tenant_id = p_tenant_id AND is_enabled = TRUE),
    'rules_triggered', v_triggered,
    'actions', v_actions
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INVESTOR-GRADE REPORTING FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION generate_financial_report(
  p_tenant_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_report_type TEXT DEFAULT 'custom'
)
RETURNS JSONB AS $$
DECLARE
  v_report_id UUID;
  v_revenue RECORD;
  v_transactions RECORD;
  v_payouts RECORD;
  v_risk RECORD;
  v_capital RECORD;
  v_growth RECORD;
BEGIN
  -- Revenue metrics
  SELECT 
    COALESCE(SUM(fi.amount_cents), 0) as gross_revenue,
    COALESCE(SUM(fi.platform_fee_cents), 0) as platform_fees,
    COALESCE(SUM(fi.processing_fee_cents), 0) as processing_fees
  INTO v_revenue
  FROM financial_intents fi
  JOIN profiles p ON p.id = fi.user_id
  WHERE p.tenant_id = p_tenant_id
    AND fi.status = 'succeeded'
    AND fi.intent_type IN ('tournament_entry', 'ticket_purchase')
    AND fi.created_at::DATE BETWEEN p_period_start AND p_period_end;
  
  -- Transaction metrics
  SELECT 
    COUNT(*) as tx_count,
    COALESCE(AVG(fi.amount_cents), 0)::BIGINT as avg_tx,
    COUNT(DISTINCT fi.user_id) as unique_buyers,
    COUNT(DISTINCT t.organizer_id) as unique_organizers
  INTO v_transactions
  FROM financial_intents fi
  JOIN tournaments t ON t.id = fi.reference_id
  JOIN profiles p ON p.id = t.organizer_id
  WHERE p.tenant_id = p_tenant_id
    AND fi.status = 'succeeded'
    AND fi.intent_type IN ('tournament_entry', 'ticket_purchase')
    AND fi.created_at::DATE BETWEEN p_period_start AND p_period_end;
  
  -- Payout metrics
  SELECT 
    COALESCE(SUM(pr.amount_cents), 0) as total_payouts,
    COUNT(*) as payout_count,
    COALESCE(AVG(EXTRACT(EPOCH FROM (pr.processed_at - pr.created_at)) / 3600), 0) as avg_time_hours
  INTO v_payouts
  FROM payout_requests pr
  JOIN profiles p ON p.id = pr.user_id
  WHERE p.tenant_id = p_tenant_id
    AND pr.status = 'completed'
    AND pr.processed_at::DATE BETWEEN p_period_start AND p_period_end;
  
  -- Risk metrics
  SELECT 
    COUNT(d.*) as dispute_count,
    COALESCE(SUM(d.amount_cents), 0) as dispute_amount,
    COUNT(r.*) as refund_count,
    COALESCE(SUM(r.amount_cents), 0) as refund_amount
  INTO v_risk
  FROM profiles p
  LEFT JOIN disputes d ON d.organizer_id = p.id 
    AND d.created_at::DATE BETWEEN p_period_start AND p_period_end
  LEFT JOIN (
    SELECT fi.* FROM financial_intents fi
    JOIN tournaments t ON t.id = fi.reference_id
    WHERE fi.intent_type = 'refund' AND fi.status = 'succeeded'
  ) r ON r.user_id = p.id
    AND r.created_at::DATE BETWEEN p_period_start AND p_period_end
  WHERE p.tenant_id = p_tenant_id;
  
  -- Capital metrics
  SELECT 
    COALESCE(SUM(CASE WHEN created_at::DATE BETWEEN p_period_start AND p_period_end THEN amount_cents ELSE 0 END), 0) as issued,
    COALESCE(SUM(CASE WHEN completed_at::DATE BETWEEN p_period_start AND p_period_end THEN amount_repaid_cents ELSE 0 END), 0) as repaid,
    COALESCE(SUM(CASE WHEN created_at::DATE BETWEEN p_period_start AND p_period_end THEN fee_cents ELSE 0 END), 0) as fees
  INTO v_capital
  FROM capital_advances
  WHERE tenant_id = p_tenant_id;
  
  -- Growth metrics
  SELECT
    COUNT(*) FILTER (WHERE created_at::DATE BETWEEN p_period_start AND p_period_end) as new_organizers,
    COUNT(*) FILTER (WHERE role = 'organizer') as total_organizers
  INTO v_growth
  FROM profiles
  WHERE tenant_id = p_tenant_id;
  
  -- Insert report
  INSERT INTO financial_reports (
    tenant_id, report_type, period_start, period_end,
    gross_revenue_cents, platform_fees_cents, processing_fees_cents, net_revenue_cents,
    transaction_count, avg_transaction_cents, unique_buyers, unique_organizers,
    total_payouts_cents, payout_count, avg_payout_time_hours,
    dispute_count, dispute_amount_cents, refund_count, refund_amount_cents,
    advances_issued_cents, advances_repaid_cents, advance_fee_revenue_cents,
    new_organizers, take_rate
  ) VALUES (
    p_tenant_id, p_report_type, p_period_start, p_period_end,
    v_revenue.gross_revenue, v_revenue.platform_fees, v_revenue.processing_fees,
    v_revenue.platform_fees + v_capital.fees,
    v_transactions.tx_count, v_transactions.avg_tx, v_transactions.unique_buyers, v_transactions.unique_organizers,
    v_payouts.total_payouts, v_payouts.payout_count, v_payouts.avg_time_hours,
    v_risk.dispute_count, v_risk.dispute_amount, v_risk.refund_count, v_risk.refund_amount,
    v_capital.issued, v_capital.repaid, v_capital.fees,
    v_growth.new_organizers,
    CASE WHEN v_revenue.gross_revenue > 0 THEN v_revenue.platform_fees::DECIMAL / v_revenue.gross_revenue ELSE 0 END
  ) RETURNING id INTO v_report_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'period', jsonb_build_object('start', p_period_start, 'end', p_period_end),
    'summary', jsonb_build_object(
      'gross_revenue_cents', v_revenue.gross_revenue,
      'net_revenue_cents', v_revenue.platform_fees + v_capital.fees,
      'transaction_count', v_transactions.tx_count,
      'dispute_count', v_risk.dispute_count,
      'new_organizers', v_growth.new_organizers
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get treasury dashboard data
CREATE OR REPLACE FUNCTION get_treasury_dashboard(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current RECORD;
  v_history JSONB;
  v_rules JSONB;
  v_recent_actions JSONB;
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'finance')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;
  
  -- Get latest snapshot
  SELECT * INTO v_current FROM treasury_snapshots 
  WHERE tenant_id = p_tenant_id 
  ORDER BY snapshot_date DESC LIMIT 1;
  
  -- Get 30-day history
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.snapshot_date) INTO v_history
  FROM (
    SELECT snapshot_date, platform_escrow_cents, platform_reserve_cents,
           pending_payouts_cents, held_payouts_cents, net_position_cents, liquidity_ratio
    FROM treasury_snapshots
    WHERE tenant_id = p_tenant_id
      AND snapshot_date > CURRENT_DATE - INTERVAL '30 days'
    ORDER BY snapshot_date DESC
  ) t;
  
  -- Get active rules
  SELECT jsonb_agg(row_to_json(r)) INTO v_rules
  FROM (
    SELECT id, rule_name, rule_type, is_enabled, threshold_value, threshold_unit, action_type, last_triggered_at
    FROM treasury_rules
    WHERE tenant_id = p_tenant_id
    ORDER BY rule_type
  ) r;
  
  -- Get recent actions
  SELECT jsonb_agg(row_to_json(a)) INTO v_recent_actions
  FROM (
    SELECT ta.*, tr.rule_name
    FROM treasury_actions ta
    LEFT JOIN treasury_rules tr ON tr.id = ta.rule_id
    WHERE ta.tenant_id = p_tenant_id
    ORDER BY ta.created_at DESC
    LIMIT 20
  ) a;
  
  RETURN jsonb_build_object(
    'current', row_to_json(v_current),
    'history', COALESCE(v_history, '[]'::jsonb),
    'rules', COALESCE(v_rules, '[]'::jsonb),
    'recent_actions', COALESCE(v_recent_actions, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get investor reports
CREATE OR REPLACE FUNCTION get_investor_reports(
  p_tenant_id UUID,
  p_report_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 12
)
RETURNS JSONB AS $$
DECLARE
  v_reports JSONB;
  v_summary JSONB;
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'finance')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;
  
  -- Get reports
  SELECT jsonb_agg(row_to_json(r)) INTO v_reports
  FROM (
    SELECT *
    FROM financial_reports
    WHERE tenant_id = p_tenant_id
      AND (p_report_type IS NULL OR report_type = p_report_type)
    ORDER BY period_end DESC
    LIMIT p_limit
  ) r;
  
  -- Get all-time summary
  SELECT jsonb_build_object(
    'total_revenue_cents', COALESCE(SUM(gross_revenue_cents), 0),
    'total_platform_fees_cents', COALESCE(SUM(platform_fees_cents), 0),
    'total_transactions', COALESCE(SUM(transaction_count), 0),
    'total_disputes', COALESCE(SUM(dispute_count), 0),
    'avg_take_rate', COALESCE(AVG(take_rate), 0),
    'total_advances_issued_cents', COALESCE(SUM(advances_issued_cents), 0),
    'total_advance_fees_cents', COALESCE(SUM(advance_fee_revenue_cents), 0)
  ) INTO v_summary
  FROM financial_reports
  WHERE tenant_id = p_tenant_id;
  
  RETURN jsonb_build_object(
    'reports', COALESCE(v_reports, '[]'::jsonb),
    'all_time_summary', v_summary
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION compute_ml_features(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION ml_score_payout_risk(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION capture_treasury_snapshot(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION check_treasury_rules(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION generate_financial_report(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_treasury_dashboard(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_investor_reports(UUID, TEXT, INTEGER) TO authenticated;
