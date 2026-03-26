-- Create tournament_announcements table for storing announcements
CREATE TABLE IF NOT EXISTS tournament_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tournament_announcements_tournament_id 
  ON tournament_announcements(tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_announcements_created_at 
  ON tournament_announcements(created_at DESC);

-- Enable RLS
ALTER TABLE tournament_announcements ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view announcements for tournaments they can see
CREATE POLICY "Anyone can view tournament announcements"
  ON tournament_announcements FOR SELECT
  USING (true);

-- Policy: Tournament organizers and staff can create announcements
CREATE POLICY "Organizers can create announcements"
  ON tournament_announcements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'manager', 'organizer', 'staff')
    )
    OR
    EXISTS (
      SELECT 1 FROM tournaments 
      WHERE tournaments.id = tournament_id 
      AND tournaments.created_by = auth.uid()
    )
  );

-- Policy: Tournament organizers and staff can delete announcements
CREATE POLICY "Organizers can delete announcements"
  ON tournament_announcements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM staff_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'manager', 'organizer')
    )
    OR author_id = auth.uid()
  );
