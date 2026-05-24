-- ═══════════════════════════════════════════════════════════════════════════════
-- KYC + COMPLIANCE SCHEMA
-- Identity Verification, Tax Compliance, Anti-Money Laundering
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add KYC fields to profiles (if not already present)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'not_started' 
  CHECK (kyc_status IN ('not_started', 'pending', 'requires_input', 'verified', 'rejected', 'expired'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_identity_session_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ssn_last_four TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tax_form_status TEXT DEFAULT 'not_required'
  CHECK (tax_form_status IN ('not_required', 'required', 'submitted', 'verified'));

-- KYC Verification Sessions
CREATE TABLE IF NOT EXISTS kyc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Stripe Identity Session
  stripe_session_id TEXT NOT NULL,
  stripe_session_url TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN (
    'created', 'processing', 'requires_input', 'verified', 'canceled'
  )),
  
  -- Results
  verification_report JSONB DEFAULT '{}',
  document_type TEXT,
  document_country TEXT,
  
  -- Risk signals
  risk_score NUMERIC(5,2),
  risk_signals JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  UNIQUE(stripe_session_id)
);

-- KYC Documents (for manual review or record keeping)
CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL,
  
  document_type TEXT NOT NULL CHECK (document_type IN (
    'government_id', 'passport', 'drivers_license',
    'selfie', 'address_proof', 'tax_form', 'other'
  )),
  
  -- Storage
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Verification
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'expired'
  )),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  
  -- Metadata
  extracted_data JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tax Forms (W-9, W-8BEN for US tax compliance)
CREATE TABLE IF NOT EXISTS tax_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  form_type TEXT NOT NULL CHECK (form_type IN ('w9', 'w8ben', 'w8ben_e')),
  tax_year INTEGER NOT NULL,
  
  -- Form data (encrypted in production)
  legal_name TEXT NOT NULL,
  business_name TEXT,
  tax_classification TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  
  -- For W-9
  ssn_last_four TEXT,
  ein TEXT,
  
  -- For W-8BEN
  foreign_tin TEXT,
  country_of_citizenship TEXT,
  treaty_country TEXT,
  treaty_article TEXT,
  
  -- Certification
  signature_date DATE NOT NULL,
  certification_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'verified', 'rejected', 'expired'
  )),
  verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1099 Forms Generated
CREATE TABLE IF NOT EXISTS tax_1099_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  tax_year INTEGER NOT NULL,
  form_type TEXT NOT NULL DEFAULT '1099-nec',
  
  -- Amounts
  total_earnings_cents INTEGER NOT NULL DEFAULT 0,
  federal_tax_withheld_cents INTEGER DEFAULT 0,
  state_tax_withheld_cents INTEGER DEFAULT 0,
  
  -- Form data
  payer_tin TEXT NOT NULL,
  payer_name TEXT NOT NULL,
  payer_address TEXT NOT NULL,
  
  recipient_tin_last_four TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'generated', 'sent', 'corrected'
  )),
  sent_at TIMESTAMPTZ,
  
  -- Storage
  pdf_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, tax_year, form_type)
);

-- Compliance Alerts (for admin review)
CREATE TABLE IF NOT EXISTS compliance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'high_risk_transaction', 'suspicious_activity', 'kyc_expired',
    'tax_threshold_reached', 'payout_threshold', 'watchlist_match',
    'multiple_accounts', 'chargeback', 'manual_review_required'
  )),
  
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  title TEXT NOT NULL,
  description TEXT,
  
  -- Related entities
  transaction_id UUID,
  tournament_id UUID REFERENCES tournaments(id),
  payout_id UUID REFERENCES player_payouts(id),
  
  -- Resolution
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution_notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AML Transaction Monitoring
CREATE TABLE IF NOT EXISTS aml_transaction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  transaction_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  
  -- Velocity tracking
  daily_total_cents INTEGER DEFAULT 0,
  weekly_total_cents INTEGER DEFAULT 0,
  monthly_total_cents INTEGER DEFAULT 0,
  
  -- Risk assessment
  risk_score NUMERIC(5,2),
  risk_factors JSONB DEFAULT '[]',
  
  -- Flags
  flagged BOOLEAN DEFAULT FALSE,
  flagged_reason TEXT,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_kyc_sessions_user ON kyc_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_status ON kyc_sessions(status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_forms_user ON tax_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_1099_user_year ON tax_1099_forms(user_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_compliance_alerts_status ON compliance_alerts(status);
CREATE INDEX IF NOT EXISTS idx_compliance_alerts_user ON compliance_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_aml_logs_user ON aml_transaction_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_aml_logs_flagged ON aml_transaction_logs(flagged) WHERE flagged = TRUE;

-- ══════════════════════════════════════════
-- RLS POLICIES
-- ══════════════════════════════════════════

ALTER TABLE kyc_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_1099_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE aml_transaction_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own KYC data
CREATE POLICY "users_view_own_kyc_sessions" ON kyc_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_view_own_kyc_documents" ON kyc_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_view_own_tax_forms" ON tax_forms
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_tax_forms" ON tax_forms
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_view_own_1099" ON tax_1099_forms
  FOR SELECT USING (auth.uid() = user_id);

-- Admin access
CREATE POLICY "admin_all_kyc_sessions" ON kyc_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "admin_all_compliance_alerts" ON compliance_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "admin_all_aml_logs" ON aml_transaction_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );
