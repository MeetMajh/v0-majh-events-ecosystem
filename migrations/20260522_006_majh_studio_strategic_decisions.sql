-- 20260522_006_majh_studio_strategic_decisions.sql
-- Store leadership decisions for MAJH Studio pre-launch phase

BEGIN;

-- Strategic decisions table - audit trail of leadership decisions
CREATE TABLE IF NOT EXISTS strategic_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_category TEXT NOT NULL CHECK (decision_category IN (
    'gpu_hosting',
    'concurrent_broadcast_limit',
    'vr_implementation',
    'licensing_compliance',
    'organizer_approval'
  )),
  decision_title TEXT NOT NULL,
  decision_value TEXT NOT NULL,
  rationale TEXT,
  financial_impact JSONB, -- { implementation_cost, monthly_burn, savings_vs_alternative }
  risk_assessment JSONB,  -- { risk_level, mitigation_strategies }
  decision_date TIMESTAMPTZ DEFAULT now(),
  approved_by UUID REFERENCES auth.users(id),
  status TEXT CHECK (status IN ('proposed', 'approved', 'implemented', 'revised')) DEFAULT 'proposed',
  implementation_notes TEXT,
  related_phase TEXT, -- e.g., 'Phase 1', 'Phase 1-2'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_strategic_decisions_tenant ON strategic_decisions(tenant_id);
CREATE INDEX idx_strategic_decisions_category ON strategic_decisions(decision_category);
CREATE INDEX idx_strategic_decisions_status ON strategic_decisions(status);

-- Decision checkpoints for Phase 1 launch verification
CREATE TABLE IF NOT EXISTS decision_implementation_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategic_decision_id UUID NOT NULL REFERENCES strategic_decisions(id) ON DELETE CASCADE,
  checkpoint_name TEXT NOT NULL,
  checkpoint_description TEXT,
  is_complete BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_checklist_decision ON decision_implementation_checklist(strategic_decision_id);
CREATE INDEX idx_checklist_complete ON decision_implementation_checklist(is_complete);

-- Broadcast tier pricing and feature mapping (derived from decisions)
CREATE TABLE IF NOT EXISTS broadcast_subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL UNIQUE CHECK (tier_name IN ('basic_stream', 'studio', 'enterprise')),
  monthly_price DECIMAL(10,2),
  max_concurrent_broadcasts INT,
  max_video_sources INT,
  max_destinations INT,
  max_overlays INT,
  vod_retention_days INT,
  can_remove_watermark BOOLEAN DEFAULT FALSE,
  max_co_producers INT,
  includes_event_type_profiles TEXT[], -- array of event type IDs
  custom_api_access BOOLEAN DEFAULT FALSE,
  sso_saml_support BOOLEAN DEFAULT FALSE,
  sla_percentage DECIMAL(5,2),
  overage_charge_per_stream DECIMAL(7,2), -- for Studio tier
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert approved MAJH Studio tiers
INSERT INTO broadcast_subscription_tiers (tier_name, monthly_price, max_concurrent_broadcasts, max_video_sources, max_destinations, max_overlays, vod_retention_days, can_remove_watermark, max_co_producers, includes_event_type_profiles, sso_saml_support, sla_percentage, overage_charge_per_stream)
VALUES
  ('basic_stream', 29.00, 1, 1, 1, 3, 2, FALSE, 0, ARRAY['gaming', 'entertainment'], FALSE, 99.50, NULL),
  ('studio', 99.00, 10, 4, NULL, NULL, 365, TRUE, 4, ARRAY['gaming', 'church', 'conference', 'music', 'graduation', 'corporate', 'entertainment', 'hospitality'], FALSE, 99.95, 15.00),
  ('enterprise', NULL, NULL, NULL, NULL, NULL, 365, TRUE, NULL, ARRAY['gaming', 'church', 'conference', 'music', 'graduation', 'corporate', 'entertainment', 'hospitality'], TRUE, 99.99, NULL)
ON CONFLICT (tier_name) DO NOTHING;

-- Compliance tracking table
CREATE TABLE IF NOT EXISTS broadcast_compliance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_type TEXT NOT NULL CHECK (requirement_type IN (
    'dmca_agent',
    'takedown_process',
    'repeat_infringer_policy',
    'gdpr_privacy',
    'ccpa_opt_out',
    'coppa_age_gate',
    'music_licensing'
  )),
  description TEXT,
  implementation_status TEXT CHECK (implementation_status IN ('not_started', 'in_progress', 'completed', 'deferred')) DEFAULT 'not_started',
  phase TEXT, -- 'Phase 1', 'Phase 2', etc.
  estimated_cost DECIMAL(10,2),
  completion_date TIMESTAMPTZ,
  responsible_team TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert DMCA Phase 1 requirements
INSERT INTO broadcast_compliance_requirements (requirement_type, description, implementation_status, phase, estimated_cost, responsible_team)
VALUES
  ('dmca_agent', 'Register DMCA agent with US Copyright Office', 'not_started', 'Phase 1', 6.00, 'Legal + Dev'),
  ('takedown_process', 'Implement DMCA takedown form + email workflow', 'not_started', 'Phase 1', 500.00, 'Dev'),
  ('repeat_infringer_policy', 'Implement automated repeat infringer strikes + suspension', 'not_started', 'Phase 1', 300.00, 'Dev + Moderation'),
  ('music_licensing', 'Terms of Service: Organizer responsible for licensing (Phase 3: ASCAP/BMI blanket)', 'not_started', 'Phase 1', 0.00, 'Legal'),
  ('gdpr_privacy', 'Privacy policy + data retention controls', 'not_started', 'Phase 2', 1000.00, 'Legal + Dev'),
  ('coppa_age_gate', 'Age verification for users under 13', 'deferred', 'Phase 2', 2000.00, 'Dev')
ON CONFLICT DO NOTHING;

-- Guardrails configuration table for auto-approve system
CREATE TABLE IF NOT EXISTS broadcast_guardrails_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardrail_type TEXT NOT NULL UNIQUE CHECK (guardrail_type IN (
    'rate_limit_stream_start',
    'account_standing_check',
    'channel_limit_check',
    'content_policy_scan',
    'payment_standing_check',
    'schedule_window_check'
  )),
  enabled BOOLEAN DEFAULT TRUE,
  check_order INT, -- execution order (1-6)
  description TEXT,
  threshold_value TEXT, -- e.g., '3 streams per hour', 'max 2 strikes in 30 days'
  failure_behavior TEXT CHECK (failure_behavior IN ('block', 'escalate', 'warn')) DEFAULT 'escalate',
  severity_level TEXT CHECK (severity_level IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert auto-approve guardrails
INSERT INTO broadcast_guardrails_config (guardrail_type, enabled, check_order, description, threshold_value, failure_behavior, severity_level)
VALUES
  ('rate_limit_stream_start', TRUE, 1, 'Max stream starts per hour', '3 per hour', 'block', 'high'),
  ('account_standing_check', TRUE, 2, 'No recent strikes', 'max 2 strikes in 30 days', 'block', 'critical'),
  ('channel_limit_check', TRUE, 3, 'Within subscription concurrent limit', 'tier-based', 'block', 'high'),
  ('content_policy_scan', TRUE, 4, 'Sample first 30 seconds for violations', 'confidence > 75%', 'escalate', 'medium'),
  ('payment_standing_check', TRUE, 5, 'No past-due invoices', 'current payment status', 'block', 'critical'),
  ('schedule_window_check', TRUE, 6, 'Within 15 min of scheduled time', '±15 minutes', 'warn', 'low');

-- GPU hosting infrastructure decisions
CREATE TABLE IF NOT EXISTS infrastructure_hosting_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hosting_provider TEXT NOT NULL UNIQUE,
  decision_rationale TEXT,
  monthly_base_cost DECIMAL(10,2),
  cost_per_concurrent_broadcast DECIMAL(10,2),
  devops_overhead_cost DECIMAL(10,2),
  setup_time_days INT,
  reliability_sla DECIMAL(5,2),
  auto_scaling BOOLEAN,
  is_recommended BOOLEAN,
  migration_path_available BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO infrastructure_hosting_decisions (hosting_provider, decision_rationale, monthly_base_cost, cost_per_concurrent_broadcast, devops_overhead_cost, setup_time_days, reliability_sla, auto_scaling, is_recommended, migration_path_available)
VALUES
  ('LiveKit Cloud Ship', 'Recommended: 28x cheaper at startup, zero DevOps overhead, automatic scaling', 50.00, 0.015, 0.00, 1, 99.99, TRUE, TRUE, TRUE),
  ('LiveKit Cloud Scale', 'Recommended upgrade path when exceeding 150K monthly minutes', 500.00, 0.015, 0.00, 0, 99.99, TRUE, FALSE, TRUE),
  ('AWS EC2 g4dn.xlarge Self-Hosted', 'Not recommended: High DevOps cost, manual scaling, higher complexity', 379.00, NULL, 5000.00, 21, 99.00, FALSE, FALSE, FALSE);

COMMIT;
