-- PLATFORM ESSENTIALS
-- Creates all missing tables needed for the platform to function properly

-- ═══════════════════════════════════════════════════════════════════════════════
-- FINANCIAL TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Financial Transactions (audit log of all financial activity)
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'completed',
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_created ON financial_transactions(created_at DESC);

-- Financial Alerts (warnings and notifications)
CREATE TABLE IF NOT EXISTS financial_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT,
  is_read BOOLEAN DEFAULT false,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_alerts_unread ON financial_alerts(is_read, severity);

-- ═══════════════════════════════════════════════════════════════════════════════
-- NEWS & CONTENT TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- News Categories
CREATE TABLE IF NOT EXISTS news_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add category_id to news_articles if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'news_articles' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE news_articles ADD COLUMN category_id UUID;
  END IF;
END
$$;

-- Insert default news categories
INSERT INTO news_categories (name, slug) VALUES
  ('Announcements', 'announcements'),
  ('Tournament News', 'tournament-news'),
  ('Community', 'community'),
  ('Updates', 'updates'),
  ('Esports', 'esports')
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- GAMES TABLE (for stream categories)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default games
INSERT INTO games (name, slug, description) VALUES
  ('Magic: The Gathering', 'magic-the-gathering', 'The original trading card game'),
  ('Yu-Gi-Oh!', 'yugioh', 'King of Games'),
  ('Pokemon TCG', 'pokemon-tcg', 'Gotta catch em all'),
  ('Flesh and Blood', 'flesh-and-blood', 'A modern TCG'),
  ('Lorcana', 'lorcana', 'Disney trading card game'),
  ('One Piece TCG', 'one-piece-tcg', 'Pirate adventures'),
  ('Star Wars Unlimited', 'star-wars-unlimited', 'In a galaxy far, far away')
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PLATFORM METRICS (for ops command center)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS platform_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_type TEXT DEFAULT 'gauge',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_name ON platform_metrics(metric_name, recorded_at DESC);

-- Moderation Alerts (for ops center)
CREATE TABLE IF NOT EXISTS moderation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  status TEXT DEFAULT 'pending',
  assigned_to UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_alerts_status ON moderation_alerts(status, severity);

-- ═══════════════════════════════════════════════════════════════════════════════
-- USER MEDIA (for uploads)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT DEFAULT 'general',
  title TEXT,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_media_user ON user_media(user_id);
CREATE INDEX IF NOT EXISTS idx_user_media_category ON user_media(category);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENABLE RLS ON ALL TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_media ENABLE ROW LEVEL SECURITY;

-- Public read access to games and news categories
CREATE POLICY "Anyone can view games" ON games FOR SELECT USING (true);
CREATE POLICY "Anyone can view news categories" ON news_categories FOR SELECT USING (true);

-- User media policies
CREATE POLICY "Users can view own media" ON user_media FOR SELECT 
  USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Users can insert own media" ON user_media FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own media" ON user_media FOR UPDATE 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own media" ON user_media FOR DELETE 
  USING (auth.uid() = user_id);
