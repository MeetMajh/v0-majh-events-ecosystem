-- ═══════════════════════════════════════════════════════════════════════════════
-- TOURNAMENT FINANCIAL ENGINE (TFE) - Database Schema
-- ═══════════════════════════════════════════════════════════════════════════════
-- This schema supports:
-- 1. Free tournaments
-- 2. Entry fee tournaments (organizer collects)
-- 3. Sponsored/Cash prize tournaments (escrow system)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: ALTER EXISTING TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add financial columns to tournaments table
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS tournament_type TEXT DEFAULT 'free' 
  CHECK (tournament_type IN ('free', 'paid', 'sponsored'));
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prize_pool_cents INTEGER DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS min_players_action TEXT DEFAULT 'cancel' 
  CHECK (min_players_action IN ('cancel', 'refund', 'delay', 'reduce_prize'));
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT NULL 
  CHECK (escrow_status IN ('pending', 'funded', 'released', 'refunded'));
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS escrow_funded_at TIMESTAMPTZ;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5,2) DEFAULT 5.00;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organizer_payout_method TEXT DEFAULT 'platform' 
  CHECK (organizer_payout_method IN ('platform', 'direct', 'manual'));
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sponsor_name TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sponsor_logo_url TEXT;

-- Add financial columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_connect_status TEXT DEFAULT 'not_started' 
  CHECK (stripe_connect_status IN ('not_started', 'pending', 'incomplete', 'complete'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_payout_method TEXT DEFAULT 'bank' 
  CHECK (preferred_payout_method IN ('bank', 'paypal', 'venmo', 'cashapp', 'western_union'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paypal_email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS venmo_handle TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cashapp_handle TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_earnings_cents INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pending_earnings_cents INTEGER DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: USER WALLETS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  pending_cents INTEGER NOT NULL DEFAULT 0,
  lifetime_earnings_cents INTEGER NOT NULL DEFAULT 0,
  lifetime_withdrawals_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user ON user_wallets(user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: TOURNAMENT PAYMENTS (Entry fees collected)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tournament_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES tournament_registrations(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER DEFAULT 0,
  net_amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card', 'paypal', 'applepay', 'googlepay', 'cash', 'venmo', 'cashapp', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  paypal_order_id TEXT,
  refund_amount_cents INTEGER DEFAULT 0,
  refund_reason TEXT,
  refunded_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_payments_tournament ON tournament_payments(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_payments_user ON tournament_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_payments_status ON tournament_payments(status);
CREATE INDEX IF NOT EXISTS idx_tournament_payments_stripe ON tournament_payments(stripe_payment_intent_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: PRIZE POOL ESCROW
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS escrow_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  funded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  funded_amount_cents INTEGER DEFAULT 0,
  released_amount_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_funded', 'funded', 'releasing', 'released', 'refunded', 'disputed')),
  funding_method TEXT CHECK (funding_method IN ('card', 'bank_transfer', 'platform_balance', 'external_verified')),
  stripe_payment_intent_id TEXT,
  funding_deadline TIMESTAMPTZ,
  funded_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  proof_of_funds_url TEXT,
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending_review', 'verified', 'rejected')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id)
);

CREATE INDEX IF NOT EXISTS idx_escrow_accounts_tournament ON escrow_accounts(tournament_id);
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_status ON escrow_accounts(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: PRIZE DISTRIBUTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prize_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  placement INTEGER NOT NULL,
  percentage NUMERIC(5,2) NOT NULL,
  fixed_amount_cents INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, placement)
);

CREATE INDEX IF NOT EXISTS idx_prize_distributions_tournament ON prize_distributions(tournament_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: PLAYER PAYOUTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS player_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  escrow_id UUID REFERENCES escrow_accounts(id),
  placement INTEGER NOT NULL,
  gross_amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER DEFAULT 0,
  net_amount_cents INTEGER NOT NULL,
  payout_method TEXT NOT NULL CHECK (payout_method IN ('bank', 'paypal', 'venmo', 'cashapp', 'western_union', 'platform_balance', 'stripe_connect')),
  payout_destination TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_details', 'processing', 'completed', 'failed', 'cancelled', 'disputed')),
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,
  paypal_payout_id TEXT,
  external_reference TEXT,
  instant_payout BOOLEAN DEFAULT FALSE,
  instant_fee_cents INTEGER DEFAULT 0,
  requested_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_payouts_tournament ON player_payouts(tournament_id);
CREATE INDEX IF NOT EXISTS idx_player_payouts_user ON player_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_player_payouts_status ON player_payouts(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 7: ORGANIZER PAYOUTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS organizer_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER DEFAULT 0,
  net_amount_cents INTEGER NOT NULL,
  payout_type TEXT NOT NULL CHECK (payout_type IN ('entry_fees', 'manual', 'adjustment')),
  payout_method TEXT NOT NULL CHECK (payout_method IN ('bank', 'paypal', 'venmo', 'cashapp', 'stripe_connect', 'check')),
  payout_destination TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  stripe_transfer_id TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizer_payouts_organizer ON organizer_payouts(organizer_id);
CREATE INDEX IF NOT EXISTS idx_organizer_payouts_tournament ON organizer_payouts(tournament_id);
CREATE INDEX IF NOT EXISTS idx_organizer_payouts_status ON organizer_payouts(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 8: WALLET TRANSACTIONS (Audit Trail)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'prize_win', 'entry_fee_collected', 'withdrawal', 'refund_received', 
    'refund_issued', 'platform_fee', 'deposit', 'adjustment', 'payout_reversal'
  )),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_tournament ON wallet_transactions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 9: KYC VERIFICATION RECORDS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('identity', 'address', 'bank_account', 'payout_method')),
  provider TEXT NOT NULL CHECK (provider IN ('stripe_identity', 'manual', 'persona', 'plaid')),
  provider_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'verified', 'failed', 'expired')),
  failure_reason TEXT,
  verified_data JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user ON kyc_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON kyc_verifications(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 10: PAYOUT METHOD VERIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('bank', 'paypal', 'venmo', 'cashapp', 'western_union')),
  is_primary BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  -- Bank details (encrypted/tokenized in production)
  bank_name TEXT,
  bank_last_four TEXT,
  bank_routing_last_four TEXT,
  -- Digital wallet handles
  account_email TEXT,
  account_handle TEXT,
  -- Verification
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'failed')),
  verified_at TIMESTAMPTZ,
  stripe_bank_account_id TEXT,
  plaid_account_id TEXT,
  -- Metadata
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_methods_user ON payout_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_methods_primary ON payout_methods(user_id) WHERE is_primary = TRUE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 11: FINANCIAL ALERTS & NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'escrow_funded', 'escrow_deadline', 'payout_ready', 'payout_sent', 
    'payout_failed', 'refund_issued', 'fraud_detected', 'kyc_required',
    'min_players_not_met', 'tournament_cancelled'
  )),
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_alerts_user ON financial_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_alerts_unread ON financial_alerts(user_id) WHERE is_read = FALSE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 12: ROW LEVEL SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_alerts ENABLE ROW LEVEL SECURITY;

-- User Wallets: Users can view their own wallet
CREATE POLICY "Users can view own wallet" ON user_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all wallets" ON user_wallets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE staff_roles.user_id = auth.uid() 
      AND staff_roles.role IN ('owner', 'manager')
    )
  );

-- Tournament Payments: Users see their own payments, staff see all
CREATE POLICY "Users can view own payments" ON tournament_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Tournament organizers can view tournament payments" ON tournament_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = tournament_payments.tournament_id 
      AND tournaments.created_by = auth.uid()
    )
  );

CREATE POLICY "Staff can manage all payments" ON tournament_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE staff_roles.user_id = auth.uid() 
      AND staff_roles.role IN ('owner', 'manager')
    )
  );

-- Escrow Accounts: Tournament organizers and staff can view
CREATE POLICY "Tournament organizers can view escrow" ON escrow_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = escrow_accounts.tournament_id 
      AND tournaments.created_by = auth.uid()
    )
  );

CREATE POLICY "Staff can manage escrow" ON escrow_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE staff_roles.user_id = auth.uid() 
      AND staff_roles.role IN ('owner', 'manager')
    )
  );

-- Prize Distributions: Public read for tournament participants
CREATE POLICY "Anyone can view prize distributions" ON prize_distributions
  FOR SELECT USING (TRUE);

CREATE POLICY "Tournament organizers can manage prize distributions" ON prize_distributions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = prize_distributions.tournament_id 
      AND tournaments.created_by = auth.uid()
    )
  );

CREATE POLICY "Staff can manage prize distributions" ON prize_distributions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE staff_roles.user_id = auth.uid() 
      AND staff_roles.role IN ('owner', 'manager', 'organizer')
    )
  );

-- Player Payouts: Users see their own payouts
CREATE POLICY "Users can view own payouts" ON player_payouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own payout details" ON player_payouts
  FOR UPDATE USING (auth.uid() = user_id AND status = 'awaiting_details');

CREATE POLICY "Staff can manage all payouts" ON player_payouts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE staff_roles.user_id = auth.uid() 
      AND staff_roles.role IN ('owner', 'manager')
    )
  );

-- Organizer Payouts
CREATE POLICY "Organizers can view own payouts" ON organizer_payouts
  FOR SELECT USING (auth.uid() = organizer_id);

CREATE POLICY "Staff can manage organizer payouts" ON organizer_payouts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE staff_roles.user_id = auth.uid() 
      AND staff_roles.role IN ('owner', 'manager')
    )
  );

-- Wallet Transactions: Users see their own transactions
CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all transactions" ON wallet_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE staff_roles.user_id = auth.uid() 
      AND staff_roles.role IN ('owner', 'manager')
    )
  );

-- KYC Verifications: Users see their own, staff sees all
CREATE POLICY "Users can view own KYC" ON kyc_verifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff can manage KYC" ON kyc_verifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE staff_roles.user_id = auth.uid() 
      AND staff_roles.role IN ('owner', 'manager')
    )
  );

-- Payout Methods: Users manage their own
CREATE POLICY "Users can manage own payout methods" ON payout_methods
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Staff can view payout methods" ON payout_methods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE staff_roles.user_id = auth.uid() 
      AND staff_roles.role IN ('owner', 'manager')
    )
  );

-- Financial Alerts: Users see their own alerts
CREATE POLICY "Users can view own alerts" ON financial_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts" ON financial_alerts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Staff can manage all alerts" ON financial_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE staff_roles.user_id = auth.uid() 
      AND staff_roles.role IN ('owner', 'manager')
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 13: HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Function to get or create user wallet
CREATE OR REPLACE FUNCTION get_or_create_wallet(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id FROM user_wallets WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO user_wallets (user_id, balance_cents, pending_cents)
    VALUES (p_user_id, 0, 0)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate prize amount for a placement
CREATE OR REPLACE FUNCTION calculate_prize_amount(
  p_tournament_id UUID,
  p_placement INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_prize_pool INTEGER;
  v_percentage NUMERIC;
  v_fixed_amount INTEGER;
BEGIN
  SELECT prize_pool_cents INTO v_prize_pool FROM tournaments WHERE id = p_tournament_id;
  
  SELECT percentage, fixed_amount_cents 
  INTO v_percentage, v_fixed_amount 
  FROM prize_distributions 
  WHERE tournament_id = p_tournament_id AND placement = p_placement;
  
  IF v_fixed_amount IS NOT NULL THEN
    RETURN v_fixed_amount;
  END IF;
  
  IF v_percentage IS NOT NULL AND v_prize_pool IS NOT NULL THEN
    RETURN FLOOR(v_prize_pool * v_percentage / 100);
  END IF;
  
  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if tournament can start (minimum players met)
CREATE OR REPLACE FUNCTION can_tournament_start(p_tournament_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_min_players INTEGER;
  v_current_players INTEGER;
  v_tournament_type TEXT;
  v_escrow_status TEXT;
BEGIN
  SELECT min_players, tournament_type, escrow_status
  INTO v_min_players, v_tournament_type, v_escrow_status
  FROM tournaments WHERE id = p_tournament_id;
  
  SELECT COUNT(*) INTO v_current_players
  FROM tournament_registrations
  WHERE tournament_id = p_tournament_id AND status IN ('registered', 'checked_in');
  
  -- Check minimum players
  IF v_min_players IS NOT NULL AND v_current_players < v_min_players THEN
    RETURN FALSE;
  END IF;
  
  -- Check escrow for sponsored tournaments
  IF v_tournament_type = 'sponsored' AND v_escrow_status != 'funded' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get tournament financial summary
CREATE OR REPLACE FUNCTION get_tournament_financial_summary(p_tournament_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_entries', (
      SELECT COUNT(*) FROM tournament_payments 
      WHERE tournament_id = p_tournament_id AND status = 'succeeded'
    ),
    'total_collected_cents', COALESCE((
      SELECT SUM(amount_cents) FROM tournament_payments 
      WHERE tournament_id = p_tournament_id AND status = 'succeeded'
    ), 0),
    'total_refunded_cents', COALESCE((
      SELECT SUM(refund_amount_cents) FROM tournament_payments 
      WHERE tournament_id = p_tournament_id AND refund_amount_cents > 0
    ), 0),
    'platform_fees_cents', COALESCE((
      SELECT SUM(platform_fee_cents) FROM tournament_payments 
      WHERE tournament_id = p_tournament_id AND status = 'succeeded'
    ), 0),
    'escrow_status', (
      SELECT status FROM escrow_accounts WHERE tournament_id = p_tournament_id
    ),
    'escrow_amount_cents', COALESCE((
      SELECT funded_amount_cents FROM escrow_accounts WHERE tournament_id = p_tournament_id
    ), 0),
    'pending_payouts_cents', COALESCE((
      SELECT SUM(net_amount_cents) FROM player_payouts 
      WHERE tournament_id = p_tournament_id AND status IN ('pending', 'processing')
    ), 0),
    'completed_payouts_cents', COALESCE((
      SELECT SUM(net_amount_cents) FROM player_payouts 
      WHERE tournament_id = p_tournament_id AND status = 'completed'
    ), 0)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
