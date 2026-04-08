-- ═══════════════════════════════════════════════════════════════════════════════
-- ADS MANAGER + ML RANKING + ANALYTICS PIPELINE SCHEMA
-- Meta-style Campaign Management + TikTok-level Feed + Real-time Data
-- ═══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════
-- PART 1: ADS MANAGER (META-STYLE HIERARCHY)
-- Campaign → Ad Set → Ad
-- ══════════════════════════════════════════

-- Advertiser accounts (can be users or organizations)
CREATE TABLE IF NOT EXISTS advertiser_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'self_serve' CHECK (account_type IN ('self_serve', 'managed', 'agency')),
  
  -- Billing
  billing_type TEXT NOT NULL DEFAULT 'prepaid' CHECK (billing_type IN ('prepaid', 'postpaid', 'credit_line')),
  balance_cents INTEGER NOT NULL DEFAULT 0,
  credit_limit_cents INTEGER DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  
  -- Stripe for billing
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'suspended', 'pending_review')),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  
  -- Limits
  daily_spend_limit_cents INTEGER DEFAULT 1000000, -- $10,000 default
  lifetime_spend_cents INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT advertiser_must_have_owner CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL)
);

-- Campaigns (top level)
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES advertiser_accounts(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  objective TEXT NOT NULL CHECK (objective IN (
    'awareness', 'reach', 'traffic', 'engagement', 
    'app_installs', 'video_views', 'lead_generation', 
    'conversions', 'catalog_sales', 'store_traffic'
  )),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived', 'deleted')),
  delivery_status TEXT DEFAULT 'learning' CHECK (delivery_status IN ('learning', 'active', 'limited', 'not_delivering')),
  
  -- Budget (campaign level)
  budget_type TEXT NOT NULL DEFAULT 'daily' CHECK (budget_type IN ('daily', 'lifetime')),
  budget_cents INTEGER NOT NULL,
  spend_cap_cents INTEGER, -- Optional total spend cap
  
  -- Schedule
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  
  -- Optimization
  bid_strategy TEXT NOT NULL DEFAULT 'lowest_cost' CHECK (bid_strategy IN ('lowest_cost', 'cost_cap', 'bid_cap', 'target_cost')),
  
  -- Metrics (aggregated)
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend_cents INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ad Sets (targeting + budget allocation)
CREATE TABLE IF NOT EXISTS ad_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived', 'deleted')),
  
  -- Budget (ad set level, optional)
  budget_type TEXT CHECK (budget_type IN ('daily', 'lifetime')),
  budget_cents INTEGER,
  
  -- Schedule
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  
  -- Bidding
  bid_amount_cents INTEGER, -- Manual bid if using bid_cap
  optimization_goal TEXT NOT NULL DEFAULT 'impressions' CHECK (optimization_goal IN (
    'impressions', 'reach', 'link_clicks', 'landing_page_views',
    'engagement', 'video_views', 'conversions', 'app_installs'
  )),
  
  -- TARGETING (esports-specific)
  targeting JSONB NOT NULL DEFAULT '{}',
  -- Structure:
  -- {
  --   "age_min": 18, "age_max": 35,
  --   "genders": ["all"],
  --   "locations": ["US", "CA"],
  --   "games": ["street-fighter-6", "tekken-8"],
  --   "interests": ["fighting-games", "esports"],
  --   "tournament_viewers": true,
  --   "skill_levels": ["intermediate", "advanced"],
  --   "device_types": ["mobile", "desktop"],
  --   "custom_audiences": ["uuid1", "uuid2"],
  --   "lookalike_audiences": ["uuid3"]
  -- }
  
  -- Placements
  placements JSONB NOT NULL DEFAULT '["feed", "clips", "tournament_pages"]',
  -- Options: feed, clips, tournament_pages, live_streams, clutch_moments, pre_roll, mid_roll
  
  -- Metrics
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend_cents INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ads (creative units)
CREATE TABLE IF NOT EXISTS ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_set_id UUID NOT NULL REFERENCES ad_sets(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'rejected', 'pending_review', 'archived', 'deleted')),
  
  -- Creative
  format TEXT NOT NULL CHECK (format IN ('image', 'video', 'carousel', 'collection', 'instant_experience')),
  
  -- Media
  media_urls JSONB NOT NULL DEFAULT '[]', -- Array of URLs
  thumbnail_url TEXT,
  
  -- Copy
  headline TEXT,
  primary_text TEXT,
  description TEXT,
  call_to_action TEXT CHECK (call_to_action IN (
    'learn_more', 'shop_now', 'sign_up', 'watch_more', 
    'download', 'get_offer', 'book_now', 'contact_us', 'apply_now'
  )),
  
  -- Destination
  destination_url TEXT NOT NULL,
  display_url TEXT,
  
  -- Tracking
  tracking_pixel_id TEXT,
  utm_params JSONB DEFAULT '{}',
  
  -- Review
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'appeal')),
  rejection_reason TEXT,
  
  -- Metrics
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend_cents INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  video_watches_at_25 INTEGER DEFAULT 0,
  video_watches_at_50 INTEGER DEFAULT 0,
  video_watches_at_75 INTEGER DEFAULT 0,
  video_watches_at_100 INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Custom Audiences
CREATE TABLE IF NOT EXISTS custom_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES advertiser_accounts(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  audience_type TEXT NOT NULL CHECK (audience_type IN (
    'website_visitors', 'customer_list', 'app_activity', 
    'engagement', 'video_viewers', 'tournament_participants'
  )),
  
  -- Source config
  source_config JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  -- { "pixel_id": "...", "event": "page_view", "days": 30 }
  -- { "tournament_ids": ["..."], "placement_range": [1, 8] }
  
  -- Size
  estimated_size INTEGER DEFAULT 0,
  
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'too_small', 'error')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookalike Audiences
CREATE TABLE IF NOT EXISTS lookalike_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES advertiser_accounts(id) ON DELETE CASCADE,
  source_audience_id UUID NOT NULL REFERENCES custom_audiences(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  countries TEXT[] NOT NULL,
  similarity_percentage INTEGER NOT NULL CHECK (similarity_percentage BETWEEN 1 AND 10), -- 1% = most similar
  
  estimated_size INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════
-- PART 2: ML RANKING SYSTEM (TIKTOK-LEVEL FEED)
-- ══════════════════════════════════════════

-- Content items (clips, highlights, posts)
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  content_type TEXT NOT NULL CHECK (content_type IN ('clip', 'highlight', 'post', 'stream_vod')),
  
  -- Media
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER, -- For video content
  
  -- Metadata
  title TEXT,
  description TEXT,
  game_id UUID REFERENCES games(id),
  tournament_id UUID REFERENCES tournaments(id),
  tags TEXT[] DEFAULT '{}',
  
  -- Quality signals
  quality_score NUMERIC(5,4) DEFAULT 0.5, -- ML-computed 0-1
  
  -- Engagement metrics (real-time updated)
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  share_count INTEGER NOT NULL DEFAULT 0,
  save_count INTEGER NOT NULL DEFAULT 0,
  
  -- Watch metrics
  total_watch_time_seconds INTEGER NOT NULL DEFAULT 0,
  avg_watch_percentage NUMERIC(5,2) DEFAULT 0,
  completion_rate NUMERIC(5,4) DEFAULT 0, -- % who watched to end
  rewatch_count INTEGER NOT NULL DEFAULT 0,
  
  -- Ranking signals
  trending_score NUMERIC(10,4) DEFAULT 0, -- Time-decayed engagement
  momentum_score NUMERIC(10,4) DEFAULT 0, -- Rate of engagement growth
  freshness_hours NUMERIC(10,2) DEFAULT 0, -- Hours since posted
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('processing', 'active', 'flagged', 'removed')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private')),
  
  -- Monetization
  is_monetized BOOLEAN DEFAULT FALSE,
  ad_revenue_cents INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User content interactions (for personalization)
CREATE TABLE IF NOT EXISTS content_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  
  -- Interaction type
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'view', 'like', 'unlike', 'comment', 'share', 'save', 'unsave', 'report', 'not_interested'
  )),
  
  -- View-specific data
  watch_time_seconds INTEGER,
  watch_percentage NUMERIC(5,2),
  completed BOOLEAN DEFAULT FALSE,
  rewatched BOOLEAN DEFAULT FALSE,
  
  -- Context
  source TEXT, -- feed, search, profile, tournament, direct_link
  position_in_feed INTEGER, -- Where it appeared
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Index for fast lookups
  UNIQUE(user_id, content_id, interaction_type, created_at)
);

-- User preference embeddings (for ML)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  
  -- Explicit preferences
  favorite_games UUID[] DEFAULT '{}',
  favorite_creators UUID[] DEFAULT '{}',
  blocked_creators UUID[] DEFAULT '{}',
  
  -- Computed preferences (updated by ML pipeline)
  game_affinities JSONB DEFAULT '{}', -- { "game_id": score }
  creator_affinities JSONB DEFAULT '{}',
  tag_affinities JSONB DEFAULT '{}',
  content_type_affinities JSONB DEFAULT '{}',
  
  -- Engagement patterns
  avg_session_duration_seconds INTEGER DEFAULT 0,
  preferred_content_length TEXT DEFAULT 'medium', -- short, medium, long
  active_hours JSONB DEFAULT '{}', -- { "0": 0.1, "1": 0.05, ... "23": 0.2 }
  
  -- Embedding vector (for neural ranking)
  embedding_vector NUMERIC[] DEFAULT '{}',
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Content embeddings (for similarity matching)
CREATE TABLE IF NOT EXISTS content_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE UNIQUE,
  
  -- Visual embedding (from video/image)
  visual_embedding NUMERIC[] DEFAULT '{}',
  
  -- Text embedding (from title, description, tags)
  text_embedding NUMERIC[] DEFAULT '{}',
  
  -- Audio embedding (from video audio)
  audio_embedding NUMERIC[] DEFAULT '{}',
  
  -- Combined embedding
  combined_embedding NUMERIC[] DEFAULT '{}',
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════
-- PART 3: REAL-TIME ANALYTICS PIPELINE
-- ══════════════════════════════════════════

-- Raw events table (high-volume, partitioned by time)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identification
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  
  -- Actor
  user_id UUID REFERENCES profiles(id),
  session_id TEXT,
  device_id TEXT,
  
  -- Target
  target_type TEXT, -- content, ad, tournament, user, etc.
  target_id UUID,
  
  -- Event data
  properties JSONB NOT NULL DEFAULT '{}',
  
  -- Context
  platform TEXT, -- web, ios, android
  app_version TEXT,
  device_type TEXT,
  os TEXT,
  browser TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  
  -- UTM
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  
  -- Timestamps
  client_timestamp TIMESTAMPTZ,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Real-time metrics (updated continuously)
CREATE TABLE IF NOT EXISTS realtime_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  metric_type TEXT NOT NULL, -- content, ad, tournament, user, platform
  entity_id UUID NOT NULL,
  
  -- Time bucket (for aggregation)
  time_bucket TIMESTAMPTZ NOT NULL, -- Rounded to minute/hour
  granularity TEXT NOT NULL DEFAULT 'minute' CHECK (granularity IN ('minute', 'hour', 'day')),
  
  -- Counters
  views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  watch_time_seconds INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  
  -- Ad-specific
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend_cents INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  
  -- Engagement rates
  ctr NUMERIC(8,6) DEFAULT 0,
  engagement_rate NUMERIC(8,6) DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(metric_type, entity_id, time_bucket, granularity)
);

-- Ad impressions log (for billing and reporting)
CREATE TABLE IF NOT EXISTS ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  ad_set_id UUID NOT NULL,
  campaign_id UUID NOT NULL,
  advertiser_id UUID NOT NULL,
  
  -- Viewer
  user_id UUID REFERENCES profiles(id),
  session_id TEXT,
  
  -- Placement
  placement TEXT NOT NULL,
  content_id UUID REFERENCES content_items(id), -- If shown alongside content
  position INTEGER, -- Position in feed/list
  
  -- Auction
  bid_cents INTEGER NOT NULL,
  won_price_cents INTEGER NOT NULL, -- Second-price auction result
  
  -- Viewability
  viewable BOOLEAN DEFAULT FALSE, -- 50% visible for 1+ second
  view_duration_ms INTEGER,
  
  -- Outcome
  clicked BOOLEAN DEFAULT FALSE,
  converted BOOLEAN DEFAULT FALSE,
  conversion_value_cents INTEGER,
  
  -- Context
  device_type TEXT,
  country TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversion tracking
CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  advertiser_id UUID NOT NULL REFERENCES advertiser_accounts(id) ON DELETE CASCADE,
  ad_id UUID REFERENCES ads(id),
  impression_id UUID REFERENCES ad_impressions(id),
  
  user_id UUID REFERENCES profiles(id),
  
  conversion_type TEXT NOT NULL, -- purchase, signup, app_install, etc.
  conversion_value_cents INTEGER DEFAULT 0,
  
  -- Attribution
  attribution_window TEXT NOT NULL DEFAULT '7d_click', -- 1d_click, 7d_click, 1d_view, etc.
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ══════════════════════════════════════════

-- Ads Manager indexes
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_advertiser ON ad_campaigns(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ad_sets_campaign ON ad_sets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ads_ad_set ON ads(ad_set_id);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);

-- Content indexes
CREATE INDEX IF NOT EXISTS idx_content_items_creator ON content_items(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_items_game ON content_items(game_id);
CREATE INDEX IF NOT EXISTS idx_content_items_trending ON content_items(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_created ON content_items(created_at DESC);

-- Interaction indexes
CREATE INDEX IF NOT EXISTS idx_content_interactions_user ON content_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_content ON content_interactions(content_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_type ON content_interactions(interaction_type);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_target ON analytics_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_time ON analytics_events(server_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_realtime_metrics_entity ON realtime_metrics(metric_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_realtime_metrics_time ON realtime_metrics(time_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad ON ad_impressions(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign ON ad_impressions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_time ON ad_impressions(created_at DESC);
