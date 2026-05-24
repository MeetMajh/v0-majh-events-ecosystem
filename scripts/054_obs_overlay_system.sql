-- OBS Overlay System Migration
-- Enables broadcast-ready overlays for streaming

-- 1. Overlay Config Table
CREATE TABLE IF NOT EXISTS match_overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  
  theme TEXT DEFAULT 'default', -- default, dark, light, custom
  layout TEXT DEFAULT 'standard', -- standard, compact, vertical, minimal
  
  show_timer BOOLEAN DEFAULT true,
  show_round BOOLEAN DEFAULT true,
  show_records BOOLEAN DEFAULT true,
  show_avatars BOOLEAN DEFAULT true,
  show_tournament_name BOOLEAN DEFAULT true,
  
  primary_color TEXT DEFAULT '#6366f1',
  accent_color TEXT DEFAULT '#22c55e',
  background_opacity NUMERIC(3,2) DEFAULT 0.85,
  
  custom_css TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(match_id)
);

-- 2. Extend tournament_matches with live broadcast fields
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS timer_duration_seconds INTEGER DEFAULT 3000,
ADD COLUMN IF NOT EXISTS streamer_user_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS stream_status TEXT DEFAULT 'offline' CHECK (stream_status IN ('offline', 'starting', 'live', 'ended'));

-- 3. Overlay Events (for animations and real-time updates)
CREATE TABLE IF NOT EXISTS match_overlay_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- score_update, game_win, match_win, timer_pause, timer_resume
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_overlays_match ON match_overlays(match_id);
CREATE INDEX IF NOT EXISTS idx_overlay_events_match ON match_overlay_events(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_live ON tournament_matches(is_live) WHERE is_live = true;

-- 5. Enable RLS
ALTER TABLE match_overlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_overlay_events ENABLE ROW LEVEL SECURITY;

-- Anyone can view overlays (needed for OBS)
CREATE POLICY "Anyone can view overlays"
  ON match_overlays FOR SELECT
  USING (true);

-- Tournament organizers can manage overlays
CREATE POLICY "Tournament organizers can manage overlays"
  ON match_overlays FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tournament_matches tm
      JOIN tournament_rounds tr ON tm.round_id = tr.id
      JOIN tournament_phases tp ON tr.phase_id = tp.id
      JOIN tournaments t ON tp.tournament_id = t.id
      WHERE tm.id = match_overlays.match_id
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

-- Anyone can view overlay events
CREATE POLICY "Anyone can view overlay events"
  ON match_overlay_events FOR SELECT
  USING (true);

-- Tournament organizers can create overlay events
CREATE POLICY "Tournament organizers can create overlay events"
  ON match_overlay_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournament_matches tm
      JOIN tournament_rounds tr ON tm.round_id = tr.id
      JOIN tournament_phases tp ON tr.phase_id = tp.id
      JOIN tournaments t ON tp.tournament_id = t.id
      WHERE tm.id = match_overlay_events.match_id
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

-- 6. Function to get overlay data for a match
CREATE OR REPLACE FUNCTION get_match_overlay_data(p_match_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'match', jsonb_build_object(
      'id', tm.id,
      'status', tm.status,
      'table_number', tm.table_number,
      'is_live', tm.is_live,
      'player1_wins', COALESCE(tm.player1_wins, 0),
      'player2_wins', COALESCE(tm.player2_wins, 0),
      'draws', COALESCE(tm.draws, 0),
      'timer_started_at', tm.timer_started_at,
      'timer_duration_seconds', tm.timer_duration_seconds
    ),
    'round', jsonb_build_object(
      'number', tr.round_number,
      'status', tr.status
    ),
    'tournament', jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'slug', t.slug
    ),
    'player1', jsonb_build_object(
      'id', p1.id,
      'name', COALESCE(p1.first_name, '') || ' ' || COALESCE(p1.last_name, ''),
      'avatar_url', p1.avatar_url
    ),
    'player2', jsonb_build_object(
      'id', p2.id,
      'name', COALESCE(p2.first_name, '') || ' ' || COALESCE(p2.last_name, ''),
      'avatar_url', p2.avatar_url
    ),
    'overlay', COALESCE(
      (SELECT jsonb_build_object(
        'theme', mo.theme,
        'layout', mo.layout,
        'show_timer', mo.show_timer,
        'show_round', mo.show_round,
        'show_records', mo.show_records,
        'show_avatars', mo.show_avatars,
        'show_tournament_name', mo.show_tournament_name,
        'primary_color', mo.primary_color,
        'accent_color', mo.accent_color,
        'background_opacity', mo.background_opacity
      ) FROM match_overlays mo WHERE mo.match_id = tm.id),
      jsonb_build_object(
        'theme', 'default',
        'layout', 'standard',
        'show_timer', true,
        'show_round', true,
        'show_records', true,
        'show_avatars', true,
        'show_tournament_name', true,
        'primary_color', '#6366f1',
        'accent_color', '#22c55e',
        'background_opacity', 0.85
      )
    )
  ) INTO result
  FROM tournament_matches tm
  JOIN tournament_rounds tr ON tm.round_id = tr.id
  JOIN tournament_phases tp ON tr.phase_id = tp.id
  JOIN tournaments t ON tp.tournament_id = t.id
  LEFT JOIN profiles p1 ON tm.player1_id = p1.id
  LEFT JOIN profiles p2 ON tm.player2_id = p2.id
  WHERE tm.id = p_match_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
