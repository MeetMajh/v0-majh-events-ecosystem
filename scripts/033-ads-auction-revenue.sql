-- ADS AUCTION & REVENUE SPLITS SCHEMA

-- AD IMPRESSIONS (no foreign keys for resilience)
CREATE TABLE IF NOT EXISTS ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID,
  ad_set_id UUID,
  ad_id UUID,
  advertiser_id UUID,
  user_id UUID,
  placement TEXT NOT NULL,
  price_paid_cents INTEGER NOT NULL DEFAULT 0,
  winning_bid_cents INTEGER NOT NULL DEFAULT 0,
  quality_score NUMERIC DEFAULT 5,
  relevance_score NUMERIC DEFAULT 5,
  context JSONB DEFAULT '{}',
  clicked BOOLEAN DEFAULT false,
  clicked_at TIMESTAMPTZ,
  bid_strategy TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign ON ad_impressions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad ON ad_impressions(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_created ON ad_impressions(created_at DESC);

-- AD CLICKS
CREATE TABLE IF NOT EXISTS ad_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  impression_id UUID,
  campaign_id UUID,
  ad_set_id UUID,
  ad_id UUID,
  advertiser_id UUID,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_impression ON ad_clicks(impression_id);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_campaign ON ad_clicks(campaign_id);

-- AD CONVERSIONS
CREATE TABLE IF NOT EXISTS ad_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  impression_id UUID,
  campaign_id UUID,
  ad_set_id UUID,
  ad_id UUID,
  advertiser_id UUID,
  conversion_type TEXT NOT NULL,
  conversion_value_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CREATOR EARNINGS
CREATE TABLE IF NOT EXISTS creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  revenue_event_id TEXT,
  earning_type TEXT NOT NULL,
  gross_amount_cents INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  net_amount_cents INTEGER NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL,
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  payout_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_earnings_user ON creator_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_status ON creator_earnings(status);

-- PAYOUT REQUESTS
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL DEFAULT 0,
  net_amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_payout_id TEXT,
  paypal_payout_id TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_user ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

-- PLATFORM REVENUE
CREATE TABLE IF NOT EXISTS platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revenue_event_id TEXT,
  amount_cents INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_created ON platform_revenue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_source ON platform_revenue(source_type);

-- RLS POLICIES
ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_revenue ENABLE ROW LEVEL SECURITY;

-- Creator earnings: Users can see their own
CREATE POLICY "Users can view their earnings" ON creator_earnings
  FOR SELECT USING (user_id = auth.uid());

-- Payout requests: Users can see and create their own
CREATE POLICY "Users can view their payouts" ON payout_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can request payouts" ON payout_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());
