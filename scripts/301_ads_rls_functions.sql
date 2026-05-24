-- ═══════════════════════════════════════════════════════════════════════════════
-- ADS MANAGER + ML RANKING: RLS POLICIES + HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════
-- RLS POLICIES
-- ══════════════════════════════════════════

-- Enable RLS
ALTER TABLE advertiser_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookalike_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;

-- Advertiser Accounts
CREATE POLICY "Users can view own advertiser accounts" ON advertiser_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own advertiser accounts" ON advertiser_accounts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Staff can manage all advertiser accounts" ON advertiser_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'manager'))
  );

-- Campaigns
CREATE POLICY "Advertisers can view own campaigns" ON ad_campaigns
  FOR SELECT USING (
    advertiser_id IN (SELECT id FROM advertiser_accounts WHERE user_id = auth.uid())
  );

CREATE POLICY "Advertisers can manage own campaigns" ON ad_campaigns
  FOR ALL USING (
    advertiser_id IN (SELECT id FROM advertiser_accounts WHERE user_id = auth.uid())
  );

CREATE POLICY "Staff can manage all campaigns" ON ad_campaigns
  FOR ALL USING (
    EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role IN ('owner', 'manager', 'staff'))
  );

-- Ad Sets
CREATE POLICY "Advertisers can view own ad sets" ON ad_sets
  FOR SELECT USING (
    campaign_id IN (
      SELECT c.id FROM ad_campaigns c
      JOIN advertiser_accounts a ON a.id = c.advertiser_id
      WHERE a.user_id = auth.uid()
    )
  );

CREATE POLICY "Advertisers can manage own ad sets" ON ad_sets
  FOR ALL USING (
    campaign_id IN (
      SELECT c.id FROM ad_campaigns c
      JOIN advertiser_accounts a ON a.id = c.advertiser_id
      WHERE a.user_id = auth.uid()
    )
  );

-- Ads
CREATE POLICY "Advertisers can view own ads" ON ads
  FOR SELECT USING (
    ad_set_id IN (
      SELECT s.id FROM ad_sets s
      JOIN ad_campaigns c ON c.id = s.campaign_id
      JOIN advertiser_accounts a ON a.id = c.advertiser_id
      WHERE a.user_id = auth.uid()
    )
  );

CREATE POLICY "Advertisers can manage own ads" ON ads
  FOR ALL USING (
    ad_set_id IN (
      SELECT s.id FROM ad_sets s
      JOIN ad_campaigns c ON c.id = s.campaign_id
      JOIN advertiser_accounts a ON a.id = c.advertiser_id
      WHERE a.user_id = auth.uid()
    )
  );

-- Custom Audiences
CREATE POLICY "Advertisers can manage own audiences" ON custom_audiences
  FOR ALL USING (
    advertiser_id IN (SELECT id FROM advertiser_accounts WHERE user_id = auth.uid())
  );

-- Lookalike Audiences
CREATE POLICY "Advertisers can manage own lookalikes" ON lookalike_audiences
  FOR ALL USING (
    advertiser_id IN (SELECT id FROM advertiser_accounts WHERE user_id = auth.uid())
  );

-- Content Items
CREATE POLICY "Public can view active content" ON content_items
  FOR SELECT USING (status = 'active' AND visibility = 'public');

CREATE POLICY "Creators can manage own content" ON content_items
  FOR ALL USING (auth.uid() = creator_id);

CREATE POLICY "Staff can manage all content" ON content_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid())
  );

-- Content Interactions
CREATE POLICY "Users can view own interactions" ON content_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own interactions" ON content_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can read all interactions" ON content_interactions
  FOR SELECT USING (TRUE);

-- User Preferences
CREATE POLICY "Users can manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Analytics Events (write-only for users, read for staff)
CREATE POLICY "Anyone can insert events" ON analytics_events
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Staff can read events" ON analytics_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid())
  );

-- Realtime Metrics (public read for own content)
CREATE POLICY "Public can read metrics" ON realtime_metrics
  FOR SELECT USING (TRUE);

-- Ad Impressions
CREATE POLICY "Advertisers can view own impressions" ON ad_impressions
  FOR SELECT USING (
    advertiser_id IN (SELECT id FROM advertiser_accounts WHERE user_id = auth.uid())
  );

-- ══════════════════════════════════════════
-- ML RANKING FUNCTIONS
-- ══════════════════════════════════════════

-- Calculate trending score (time-decayed engagement)
CREATE OR REPLACE FUNCTION calculate_trending_score(
  p_like_count INTEGER,
  p_comment_count INTEGER,
  p_share_count INTEGER,
  p_view_count INTEGER,
  p_created_at TIMESTAMPTZ
)
RETURNS NUMERIC AS $$
DECLARE
  hours_old NUMERIC;
  engagement_score NUMERIC;
  decay_factor NUMERIC;
BEGIN
  hours_old := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 3600.0;
  
  -- Weighted engagement
  engagement_score := (
    p_like_count * 1.0 +
    p_comment_count * 3.0 +
    p_share_count * 5.0 +
    p_view_count * 0.1
  );
  
  -- Time decay (half-life of 24 hours)
  decay_factor := POWER(0.5, hours_old / 24.0);
  
  RETURN engagement_score * decay_factor;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate content rank score for a user
CREATE OR REPLACE FUNCTION calculate_content_rank(
  p_content_id UUID,
  p_user_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  v_content RECORD;
  v_prefs RECORD;
  v_score NUMERIC := 0;
  v_game_affinity NUMERIC := 0;
  v_creator_affinity NUMERIC := 0;
BEGIN
  -- Get content
  SELECT * INTO v_content FROM content_items WHERE id = p_content_id;
  
  IF v_content IS NULL THEN RETURN 0; END IF;
  
  -- Get user preferences
  SELECT * INTO v_prefs FROM user_preferences WHERE user_id = p_user_id;
  
  -- Base score from engagement metrics
  v_score := (
    v_content.trending_score * 0.20 +
    v_content.momentum_score * 0.15 +
    v_content.quality_score * 0.15 +
    v_content.completion_rate * 0.20 +
    (v_content.avg_watch_percentage / 100.0) * 0.15 +
    (1.0 / GREATEST(v_content.freshness_hours, 0.1)) * 0.05
  );
  
  -- Add personalization if we have preferences
  IF v_prefs IS NOT NULL THEN
    -- Game affinity
    IF v_content.game_id IS NOT NULL AND v_prefs.game_affinities ? v_content.game_id::TEXT THEN
      v_game_affinity := (v_prefs.game_affinities ->> v_content.game_id::TEXT)::NUMERIC;
      v_score := v_score * (1 + v_game_affinity * 0.3);
    END IF;
    
    -- Creator affinity
    IF v_prefs.creator_affinities ? v_content.creator_id::TEXT THEN
      v_creator_affinity := (v_prefs.creator_affinities ->> v_content.creator_id::TEXT)::NUMERIC;
      v_score := v_score * (1 + v_creator_affinity * 0.2);
    END IF;
    
    -- Followed creator boost
    IF v_content.creator_id = ANY(v_prefs.favorite_creators) THEN
      v_score := v_score * 1.5;
    END IF;
    
    -- Blocked creator filter
    IF v_content.creator_id = ANY(v_prefs.blocked_creators) THEN
      RETURN 0;
    END IF;
  END IF;
  
  RETURN v_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get personalized feed for user
CREATE OR REPLACE FUNCTION get_personalized_feed(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_exploration_rate NUMERIC DEFAULT 0.2
)
RETURNS TABLE (
  content_id UUID,
  rank_score NUMERIC,
  is_exploration BOOLEAN
) AS $$
DECLARE
  v_exploration_count INTEGER;
  v_ranked_count INTEGER;
BEGIN
  v_exploration_count := CEIL(p_limit * p_exploration_rate);
  v_ranked_count := p_limit - v_exploration_count;
  
  -- Return ranked content + exploration
  RETURN QUERY
  (
    -- Ranked content (exploitation)
    SELECT 
      ci.id AS content_id,
      calculate_content_rank(ci.id, p_user_id) AS rank_score,
      FALSE AS is_exploration
    FROM content_items ci
    WHERE ci.status = 'active' 
      AND ci.visibility = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM content_interactions i 
        WHERE i.user_id = p_user_id 
          AND i.content_id = ci.id 
          AND i.interaction_type = 'view'
          AND i.created_at > NOW() - INTERVAL '7 days'
      )
    ORDER BY calculate_content_rank(ci.id, p_user_id) DESC
    LIMIT v_ranked_count
    OFFSET p_offset
  )
  UNION ALL
  (
    -- Random exploration
    SELECT 
      ci.id AS content_id,
      RANDOM() AS rank_score,
      TRUE AS is_exploration
    FROM content_items ci
    WHERE ci.status = 'active' 
      AND ci.visibility = 'public'
      AND ci.created_at > NOW() - INTERVAL '48 hours'
    ORDER BY RANDOM()
    LIMIT v_exploration_count
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Update content metrics
CREATE OR REPLACE FUNCTION update_content_metrics(p_content_id UUID)
RETURNS VOID AS $$
DECLARE
  v_hours_old NUMERIC;
BEGIN
  -- Calculate freshness
  SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 
  INTO v_hours_old
  FROM content_items WHERE id = p_content_id;
  
  -- Update all computed metrics
  UPDATE content_items SET
    freshness_hours = v_hours_old,
    trending_score = calculate_trending_score(
      like_count, comment_count, share_count, view_count, created_at
    ),
    momentum_score = (
      SELECT COALESCE(
        (COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour'))::NUMERIC /
        GREATEST((COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'))::NUMERIC / 24, 1),
        0
      )
      FROM content_interactions
      WHERE content_id = p_content_id AND interaction_type IN ('like', 'comment', 'share')
    ),
    avg_watch_percentage = (
      SELECT COALESCE(AVG(watch_percentage), 0)
      FROM content_interactions
      WHERE content_id = p_content_id AND interaction_type = 'view'
    ),
    completion_rate = (
      SELECT COALESCE(
        COUNT(*) FILTER (WHERE completed = TRUE)::NUMERIC / GREATEST(COUNT(*), 1),
        0
      )
      FROM content_interactions
      WHERE content_id = p_content_id AND interaction_type = 'view'
    ),
    updated_at = NOW()
  WHERE id = p_content_id;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════
-- AD SERVING FUNCTIONS
-- ══════════════════════════════════════════

-- Get eligible ads for placement
CREATE OR REPLACE FUNCTION get_eligible_ads(
  p_placement TEXT,
  p_user_id UUID DEFAULT NULL,
  p_content_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  ad_id UUID,
  ad_set_id UUID,
  campaign_id UUID,
  advertiser_id UUID,
  bid_cents INTEGER,
  rank_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id AS ad_id,
    s.id AS ad_set_id,
    c.id AS campaign_id,
    c.advertiser_id,
    COALESCE(s.bid_amount_cents, 100) AS bid_cents, -- Default $1 CPM
    (
      -- Quality score based on CTR
      CASE WHEN a.impressions > 100 THEN
        (a.clicks::NUMERIC / a.impressions) * 1000
      ELSE 0.5 END
      +
      -- Bid factor
      COALESCE(s.bid_amount_cents, 100)::NUMERIC / 1000
    ) AS rank_score
  FROM ads a
  JOIN ad_sets s ON s.id = a.ad_set_id
  JOIN ad_campaigns c ON c.id = s.campaign_id
  JOIN advertiser_accounts aa ON aa.id = c.advertiser_id
  WHERE 
    a.status = 'active'
    AND s.status = 'active'
    AND c.status = 'active'
    AND aa.status = 'active'
    AND a.review_status = 'approved'
    AND c.start_date <= NOW()
    AND (c.end_date IS NULL OR c.end_date > NOW())
    AND (s.start_date IS NULL OR s.start_date <= NOW())
    AND (s.end_date IS NULL OR s.end_date > NOW())
    AND s.placements ? p_placement
    AND (c.spend_cap_cents IS NULL OR c.spend_cents < c.spend_cap_cents)
    AND aa.balance_cents > 0
  ORDER BY rank_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Record ad impression
CREATE OR REPLACE FUNCTION record_ad_impression(
  p_ad_id UUID,
  p_user_id UUID,
  p_placement TEXT,
  p_content_id UUID DEFAULT NULL,
  p_position INTEGER DEFAULT NULL,
  p_bid_cents INTEGER DEFAULT 100,
  p_won_price_cents INTEGER DEFAULT 100
)
RETURNS UUID AS $$
DECLARE
  v_ad RECORD;
  v_impression_id UUID;
BEGIN
  -- Get ad details
  SELECT a.*, s.campaign_id, c.advertiser_id
  INTO v_ad
  FROM ads a
  JOIN ad_sets s ON s.id = a.ad_set_id
  JOIN ad_campaigns c ON c.id = s.campaign_id
  WHERE a.id = p_ad_id;
  
  IF v_ad IS NULL THEN RETURN NULL; END IF;
  
  -- Insert impression
  INSERT INTO ad_impressions (
    ad_id, ad_set_id, campaign_id, advertiser_id,
    user_id, placement, content_id, position,
    bid_cents, won_price_cents
  )
  VALUES (
    p_ad_id, v_ad.ad_set_id, v_ad.campaign_id, v_ad.advertiser_id,
    p_user_id, p_placement, p_content_id, p_position,
    p_bid_cents, p_won_price_cents
  )
  RETURNING id INTO v_impression_id;
  
  -- Update counters
  UPDATE ads SET impressions = impressions + 1 WHERE id = p_ad_id;
  UPDATE ad_sets SET impressions = impressions + 1 WHERE id = v_ad.ad_set_id;
  UPDATE ad_campaigns SET impressions = impressions + 1 WHERE id = v_ad.campaign_id;
  
  RETURN v_impression_id;
END;
$$ LANGUAGE plpgsql;

-- Record ad click
CREATE OR REPLACE FUNCTION record_ad_click(p_impression_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_imp RECORD;
BEGIN
  SELECT * INTO v_imp FROM ad_impressions WHERE id = p_impression_id;
  
  IF v_imp IS NULL OR v_imp.clicked THEN RETURN FALSE; END IF;
  
  -- Mark impression as clicked
  UPDATE ad_impressions SET clicked = TRUE WHERE id = p_impression_id;
  
  -- Update counters
  UPDATE ads SET clicks = clicks + 1 WHERE id = v_imp.ad_id;
  UPDATE ad_sets SET clicks = clicks + 1 WHERE id = v_imp.ad_set_id;
  UPDATE ad_campaigns SET clicks = clicks + 1 WHERE id = v_imp.campaign_id;
  
  -- Charge advertiser (CPC if applicable, or add to spend)
  UPDATE ad_campaigns SET spend_cents = spend_cents + v_imp.won_price_cents WHERE id = v_imp.campaign_id;
  UPDATE ad_sets SET spend_cents = spend_cents + v_imp.won_price_cents WHERE id = v_imp.ad_set_id;
  UPDATE ads SET spend_cents = spend_cents + v_imp.won_price_cents WHERE id = v_imp.ad_id;
  
  -- Deduct from advertiser balance
  UPDATE advertiser_accounts 
  SET balance_cents = balance_cents - v_imp.won_price_cents,
      lifetime_spend_cents = lifetime_spend_cents + v_imp.won_price_cents
  WHERE id = v_imp.advertiser_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════
-- ANALYTICS FUNCTIONS
-- ══════════════════════════════════════════

-- Ingest analytics event
CREATE OR REPLACE FUNCTION ingest_event(
  p_event_type TEXT,
  p_event_name TEXT,
  p_user_id UUID DEFAULT NULL,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_properties JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO analytics_events (
    event_type, event_name, user_id, target_type, target_id, properties
  )
  VALUES (
    p_event_type, p_event_name, p_user_id, p_target_type, p_target_id, p_properties
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Update realtime metrics
CREATE OR REPLACE FUNCTION update_realtime_metric(
  p_metric_type TEXT,
  p_entity_id UUID,
  p_granularity TEXT DEFAULT 'minute',
  p_views INTEGER DEFAULT 0,
  p_likes INTEGER DEFAULT 0,
  p_comments INTEGER DEFAULT 0,
  p_shares INTEGER DEFAULT 0,
  p_watch_time INTEGER DEFAULT 0,
  p_impressions INTEGER DEFAULT 0,
  p_clicks INTEGER DEFAULT 0,
  p_spend_cents INTEGER DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
  v_bucket TIMESTAMPTZ;
BEGIN
  -- Calculate time bucket
  IF p_granularity = 'minute' THEN
    v_bucket := date_trunc('minute', NOW());
  ELSIF p_granularity = 'hour' THEN
    v_bucket := date_trunc('hour', NOW());
  ELSE
    v_bucket := date_trunc('day', NOW());
  END IF;
  
  -- Upsert metric
  INSERT INTO realtime_metrics (
    metric_type, entity_id, time_bucket, granularity,
    views, likes, comments, shares, watch_time_seconds,
    impressions, clicks, spend_cents
  )
  VALUES (
    p_metric_type, p_entity_id, v_bucket, p_granularity,
    p_views, p_likes, p_comments, p_shares, p_watch_time,
    p_impressions, p_clicks, p_spend_cents
  )
  ON CONFLICT (metric_type, entity_id, time_bucket, granularity)
  DO UPDATE SET
    views = realtime_metrics.views + EXCLUDED.views,
    likes = realtime_metrics.likes + EXCLUDED.likes,
    comments = realtime_metrics.comments + EXCLUDED.comments,
    shares = realtime_metrics.shares + EXCLUDED.shares,
    watch_time_seconds = realtime_metrics.watch_time_seconds + EXCLUDED.watch_time_seconds,
    impressions = realtime_metrics.impressions + EXCLUDED.impressions,
    clicks = realtime_metrics.clicks + EXCLUDED.clicks,
    spend_cents = realtime_metrics.spend_cents + EXCLUDED.spend_cents,
    ctr = CASE WHEN (realtime_metrics.impressions + EXCLUDED.impressions) > 0 
      THEN (realtime_metrics.clicks + EXCLUDED.clicks)::NUMERIC / (realtime_metrics.impressions + EXCLUDED.impressions)
      ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
