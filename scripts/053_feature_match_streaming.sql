-- Feature Match + Streaming System
-- Adds streaming capabilities and feature match functionality to tournaments

-- 1. Add streaming fields to tournament_matches
ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS is_feature_match BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stream_url TEXT,
ADD COLUMN IF NOT EXISTS stream_platform TEXT CHECK (stream_platform IN ('youtube', 'twitch', 'kick', 'custom', NULL)),
ADD COLUMN IF NOT EXISTS stream_embed_url TEXT,
ADD COLUMN IF NOT EXISTS viewer_count INTEGER DEFAULT 0;

-- 2. Add streaming configuration to tournaments
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS stream_url TEXT,
ADD COLUMN IF NOT EXISTS stream_platform TEXT CHECK (stream_platform IN ('youtube', 'twitch', 'kick', 'custom', NULL)),
ADD COLUMN IF NOT EXISTS stream_embed_url TEXT,
ADD COLUMN IF NOT EXISTS enable_streaming BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stream_key TEXT;

-- 3. Create a table for tournament streams (for multi-stream support)
CREATE TABLE IF NOT EXISTS tournament_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Stream',
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'twitch', 'kick', 'custom')),
  stream_url TEXT NOT NULL,
  embed_url TEXT,
  stream_key TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_live BOOLEAN DEFAULT false,
  viewer_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_matches_feature ON tournament_matches(is_feature_match) WHERE is_feature_match = true;
CREATE INDEX IF NOT EXISTS idx_tournament_streams_live ON tournament_streams(is_live) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_tournament_streams_tournament ON tournament_streams(tournament_id);

-- 5. Function to get embed URL from stream URL
CREATE OR REPLACE FUNCTION get_stream_embed_url(p_url TEXT, p_platform TEXT)
RETURNS TEXT AS $$
DECLARE
  video_id TEXT;
  channel_name TEXT;
BEGIN
  IF p_platform = 'youtube' THEN
    -- Extract YouTube video ID from various URL formats
    IF p_url ~ 'youtube\.com/watch\?v=' THEN
      video_id := regexp_replace(p_url, '.*v=([^&]+).*', '\1');
      RETURN 'https://www.youtube.com/embed/' || video_id || '?autoplay=1';
    ELSIF p_url ~ 'youtube\.com/live/' THEN
      video_id := regexp_replace(p_url, '.*/live/([^?]+).*', '\1');
      RETURN 'https://www.youtube.com/embed/' || video_id || '?autoplay=1';
    ELSIF p_url ~ 'youtu\.be/' THEN
      video_id := regexp_replace(p_url, '.*/([^?]+).*', '\1');
      RETURN 'https://www.youtube.com/embed/' || video_id || '?autoplay=1';
    END IF;
  ELSIF p_platform = 'twitch' THEN
    -- Extract Twitch channel name
    IF p_url ~ 'twitch\.tv/' THEN
      channel_name := regexp_replace(p_url, '.*twitch\.tv/([^/?]+).*', '\1');
      RETURN 'https://player.twitch.tv/?channel=' || channel_name || '&parent=' || current_setting('app.domain', true);
    END IF;
  ELSIF p_platform = 'kick' THEN
    -- Extract Kick channel name
    IF p_url ~ 'kick\.com/' THEN
      channel_name := regexp_replace(p_url, '.*kick\.com/([^/?]+).*', '\1');
      RETURN 'https://player.kick.com/' || channel_name;
    END IF;
  END IF;
  
  -- Return original URL for custom streams
  RETURN p_url;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Function to auto-generate embed URL on insert/update
CREATE OR REPLACE FUNCTION auto_generate_embed_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stream_url IS NOT NULL AND NEW.stream_platform IS NOT NULL THEN
    NEW.stream_embed_url := get_stream_embed_url(NEW.stream_url, NEW.stream_platform);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS auto_embed_url_matches ON tournament_matches;
CREATE TRIGGER auto_embed_url_matches
  BEFORE INSERT OR UPDATE OF stream_url, stream_platform ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_embed_url();

DROP TRIGGER IF EXISTS auto_embed_url_tournaments ON tournaments;
CREATE TRIGGER auto_embed_url_tournaments
  BEFORE INSERT OR UPDATE OF stream_url, stream_platform ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_embed_url();

DROP TRIGGER IF EXISTS auto_embed_url_streams ON tournament_streams;
CREATE TRIGGER auto_embed_url_streams
  BEFORE INSERT OR UPDATE OF stream_url, platform ON tournament_streams
  FOR EACH ROW
  WHEN (NEW.stream_url IS NOT NULL)
  EXECUTE FUNCTION auto_generate_embed_url();

-- 7. Enable RLS on tournament_streams
ALTER TABLE tournament_streams ENABLE ROW LEVEL SECURITY;

-- Public can view streams
CREATE POLICY "Anyone can view tournament streams"
  ON tournament_streams FOR SELECT
  USING (true);

-- Only tournament organizers can manage streams
CREATE POLICY "Tournament organizers can manage streams"
  ON tournament_streams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_streams.tournament_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM staff_roles sr
          WHERE sr.user_id = auth.uid()
          AND sr.role IN ('owner', 'manager', 'organizer')
        )
      )
    )
  );
