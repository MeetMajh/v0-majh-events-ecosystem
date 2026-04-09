-- STREAM SOURCES MANAGEMENT
-- Allows staff to add external streams (Twitch, YouTube) to rotate on the platform

-- STREAM SOURCES TABLE
CREATE TABLE IF NOT EXISTS stream_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source info
  title TEXT NOT NULL,
  description TEXT,
  platform TEXT NOT NULL, -- 'twitch', 'youtube', 'kick', 'custom'
  channel_url TEXT NOT NULL,
  embed_url TEXT, -- Pre-computed embed URL
  channel_id TEXT, -- Platform-specific channel ID
  
  -- Categorization
  game_id UUID,
  category TEXT, -- 'top_streamer', 'sponsored', 'organization', 'community'
  tags TEXT[] DEFAULT '{}',
  
  -- Scheduling
  source_type TEXT NOT NULL DEFAULT 'always', -- 'always', 'scheduled', 'live_only'
  schedule_start TIMESTAMPTZ,
  schedule_end TIMESTAMPTZ,
  priority INTEGER DEFAULT 50, -- Higher = shown first
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_live BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  
  -- Live stats (updated by cron/webhook)
  viewer_count INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  stream_title TEXT, -- Current stream title from platform
  last_live_at TIMESTAMPTZ,
  
  -- Organization/Sponsor info
  organization_id UUID,
  sponsor_id UUID,
  contact_email TEXT,
  
  -- Metadata
  added_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_sources_active ON stream_sources(is_active, is_live);
CREATE INDEX IF NOT EXISTS idx_stream_sources_priority ON stream_sources(priority DESC);
CREATE INDEX IF NOT EXISTS idx_stream_sources_game ON stream_sources(game_id);
CREATE INDEX IF NOT EXISTS idx_stream_sources_category ON stream_sources(category);

-- SCHEDULED STREAM SLOTS
CREATE TABLE IF NOT EXISTS stream_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID,
  organization_id UUID,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_slots_date ON stream_slots(slot_date, start_time);

-- USER STREAMS (for Go Live feature)
CREATE TABLE IF NOT EXISTS user_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  game_id UUID,
  stream_key TEXT UNIQUE,
  rtmp_url TEXT,
  playback_url TEXT,
  status TEXT NOT NULL DEFAULT 'offline',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  peak_viewers INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  allow_chat BOOLEAN DEFAULT true,
  allow_clips BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_streams_user ON user_streams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streams_status ON user_streams(status);

-- RLS
ALTER TABLE stream_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streams ENABLE ROW LEVEL SECURITY;
