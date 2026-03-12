-- Create tournament_preregistrations table for invite-only tournaments
CREATE TABLE IF NOT EXISTS tournament_preregistrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  player_id UUID REFERENCES auth.users(id), -- NULL until they register and claim
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled')),
  invited_by UUID REFERENCES auth.users(id),
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, email)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_preregistrations_tournament ON tournament_preregistrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_preregistrations_email ON tournament_preregistrations(email);
CREATE INDEX IF NOT EXISTS idx_preregistrations_status ON tournament_preregistrations(status);

-- Enable RLS
ALTER TABLE tournament_preregistrations ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Staff can manage preregistrations" ON tournament_preregistrations;
CREATE POLICY "Staff can manage preregistrations" ON tournament_preregistrations 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
  );

DROP POLICY IF EXISTS "Users can view own preregistrations" ON tournament_preregistrations;
CREATE POLICY "Users can view own preregistrations" ON tournament_preregistrations 
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
    player_id = auth.uid()
  );

-- Also add status 'preregistered' to tournament_registrations if not exists
ALTER TABLE tournament_registrations DROP CONSTRAINT IF EXISTS tournament_registrations_status_check;
ALTER TABLE tournament_registrations ADD CONSTRAINT tournament_registrations_status_check 
  CHECK (status IN ('preregistered', 'pending', 'registered', 'checked_in', 'dropped', 'disqualified', 'no_show'));
