-- Fix news_articles table to support category_id

-- Add category_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'news_articles' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE news_articles ADD COLUMN category_id UUID REFERENCES news_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create news_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS news_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#c4a24e',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories if empty
INSERT INTO news_categories (name, slug, color) VALUES
  ('News', 'news', '#3b82f6'),
  ('Announcements', 'announcements', '#c4a24e'),
  ('Tournament Updates', 'tournament-updates', '#22c55e'),
  ('Community', 'community', '#8b5cf6'),
  ('Patch Notes', 'patch-notes', '#f59e0b')
ON CONFLICT (slug) DO NOTHING;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_news_articles_category_id ON news_articles(category_id);
