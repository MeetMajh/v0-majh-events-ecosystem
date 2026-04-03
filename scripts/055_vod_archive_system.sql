-- VOD Archive System
-- Enables storing and organizing recorded tournament content

-- 1. Tournament VODs table
CREATE TABLE IF NOT EXISTS tournament_vods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id UUID REFERENCES tournament_matches(id) ON DELETE SET NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  
  -- Video source
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'twitch', 'kick', 'custom')),
  video_url TEXT NOT NULL,
  embed_url TEXT,
  thumbnail_url TEXT,
  
  -- Metadata
  duration_seconds INTEGER,
  round_number INTEGER,
  is_featured BOOLEAN DEFAULT false,
  is_highlight BOOLEAN DEFAULT false,
  
  -- Players involved (for match VODs)
  player1_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  
  -- Timestamps
  recorded_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VOD timestamps/chapters
CREATE TABLE IF NOT EXISTS vod_timestamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vod_id UUID NOT NULL REFERENCES tournament_vods(id) ON DELETE CASCADE,
  
  label TEXT NOT NULL,
  timestamp_seconds INTEGER NOT NULL,
  description TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_vods_tournament ON tournament_vods(tournament_id);
CREATE INDEX IF NOT EXISTS idx_vods_match ON tournament_vods(match_id);
CREATE INDEX IF NOT EXISTS idx_vods_featured ON tournament_vods(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_vods_published ON tournament_vods(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_vod_timestamps_vod ON vod_timestamps(vod_id);

-- 4. Auto-generate embed URL function for VODs
CREATE OR REPLACE FUNCTION auto_generate_vod_embed_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.video_url IS NOT NULL AND NEW.platform IS NOT NULL THEN
    NEW.embed_url := get_stream_embed_url(NEW.video_url, NEW.platform);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_embed_url_vods ON tournament_vods;
CREATE TRIGGER auto_embed_url_vods
  BEFORE INSERT OR UPDATE OF video_url, platform ON tournament_vods
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_vod_embed_url();

-- 5. Enable RLS
ALTER TABLE tournament_vods ENABLE ROW LEVEL SECURITY;
ALTER TABLE vod_timestamps ENABLE ROW LEVEL SECURITY;

-- Anyone can view published VODs
CREATE POLICY "Anyone can view VODs"
  ON tournament_vods FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view VOD timestamps"
  ON vod_timestamps FOR SELECT
  USING (true);

-- Tournament organizers can manage VODs
CREATE POLICY "Tournament organizers can manage VODs"
  ON tournament_vods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_vods.tournament_id
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

CREATE POLICY "Tournament organizers can manage VOD timestamps"
  ON vod_timestamps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tournament_vods v
      JOIN tournaments t ON v.tournament_id = t.id
      WHERE v.id = vod_timestamps.vod_id
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
