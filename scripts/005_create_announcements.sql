-- Create tournament_announcements table
CREATE TABLE IF NOT EXISTS tournament_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_announcements_tournament ON tournament_announcements(tournament_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON tournament_announcements(created_at DESC);

-- Enable RLS
ALTER TABLE tournament_announcements ENABLE ROW LEVEL SECURITY;

-- Anyone can view announcements for tournaments they're registered in
DROP POLICY IF EXISTS "Anyone can view tournament announcements" ON tournament_announcements;
CREATE POLICY "Anyone can view tournament announcements" ON tournament_announcements 
  FOR SELECT USING (true);

-- Only staff can create announcements
DROP POLICY IF EXISTS "Staff can create announcements" ON tournament_announcements;
CREATE POLICY "Staff can create announcements" ON tournament_announcements 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
  );

-- Staff can update/delete their own announcements
DROP POLICY IF EXISTS "Staff can update announcements" ON tournament_announcements;
CREATE POLICY "Staff can update announcements" ON tournament_announcements 
  FOR UPDATE USING (
    author_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager'))
  );

DROP POLICY IF EXISTS "Staff can delete announcements" ON tournament_announcements;
CREATE POLICY "Staff can delete announcements" ON tournament_announcements 
  FOR DELETE USING (
    author_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager'))
  );
