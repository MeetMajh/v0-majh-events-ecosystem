-- Analytics events table for tracking user actions
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  properties JSONB DEFAULT '{}',
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);

-- Enable RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anyone (for tracking)
DROP POLICY IF EXISTS "Allow insert analytics" ON analytics_events;
CREATE POLICY "Allow insert analytics" ON analytics_events FOR INSERT WITH CHECK (true);

-- Only admins can read analytics
DROP POLICY IF EXISTS "Admins can read analytics" ON analytics_events;
CREATE POLICY "Admins can read analytics" ON analytics_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
