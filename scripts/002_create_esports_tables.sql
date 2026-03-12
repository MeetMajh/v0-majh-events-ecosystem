-- Esports/Tournament System Tables
-- This migration creates all tables needed for the tournament management system

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'fighting',
  icon_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff roles table
CREATE TABLE IF NOT EXISTS staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'organizer', 'moderator')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  format TEXT NOT NULL DEFAULT 'swiss',
  status TEXT NOT NULL DEFAULT 'registration' CHECK (status IN ('draft', 'registration', 'check_in', 'in_progress', 'completed', 'cancelled')),
  entry_fee_cents INTEGER DEFAULT 0,
  prize_description TEXT,
  max_participants INTEGER,
  rules_text TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  registration_deadline TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament phases (swiss, elimination, etc.)
CREATE TABLE IF NOT EXISTS tournament_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phase_type TEXT NOT NULL CHECK (phase_type IN ('swiss', 'single_elimination', 'double_elimination', 'round_robin')),
  phase_order INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN DEFAULT false,
  is_complete BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament rounds
CREATE TABLE IF NOT EXISTS tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES tournament_phases(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  is_current BOOLEAN DEFAULT false,
  is_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament registrations (players registered for tournaments)
CREATE TABLE IF NOT EXISTS tournament_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'dropped', 'eliminated', 'disqualified')),
  seed INTEGER,
  registration_code TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'waived')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  checked_in_at TIMESTAMPTZ,
  UNIQUE(tournament_id, user_id)
);

-- Tournament preregistrations (for generating codes)
CREATE TABLE IF NOT EXISTS tournament_preregistrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  code TEXT,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament registration codes
CREATE TABLE IF NOT EXISTS tournament_registration_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  max_uses INTEGER DEFAULT 1,
  uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, code)
);

-- Tournament matches
CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,
  player1_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player1_score INTEGER DEFAULT 0,
  player2_score INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'bye')),
  table_number INTEGER,
  bracket_position INTEGER,
  next_match_id UUID REFERENCES tournament_matches(id) ON DELETE SET NULL,
  loser_next_match_id UUID REFERENCES tournament_matches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Tournament player stats (for tracking swiss tiebreakers, etc.)
CREATE TABLE IF NOT EXISTS tournament_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES tournament_phases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_wins INTEGER DEFAULT 0,
  match_losses INTEGER DEFAULT 0,
  match_draws INTEGER DEFAULT 0,
  game_wins INTEGER DEFAULT 0,
  game_losses INTEGER DEFAULT 0,
  match_points INTEGER DEFAULT 0,
  omw_percent NUMERIC(5,4) DEFAULT 0,
  gw_percent NUMERIC(5,4) DEFAULT 0,
  ogw_percent NUMERIC(5,4) DEFAULT 0,
  byes INTEGER DEFAULT 0,
  dropped BOOLEAN DEFAULT false,
  final_standing INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(phase_id, user_id)
);

-- Tournament decklists
CREATE TABLE IF NOT EXISTS tournament_decklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decklist_text TEXT,
  decklist_json JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- Legacy tournament participants (for backwards compatibility)
CREATE TABLE IF NOT EXISTS tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered',
  seed INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- Legacy matches table (for backwards compatibility)
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER,
  player1_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player1_score INTEGER DEFAULT 0,
  player2_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament sponsors
CREATE TABLE IF NOT EXISTS tournament_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  tier TEXT DEFAULT 'bronze',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament results (for historical records and leaderboards)
CREATE TABLE IF NOT EXISTS tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placement INTEGER NOT NULL,
  match_wins INTEGER DEFAULT 0,
  match_losses INTEGER DEFAULT 0,
  ranking_points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- Leaderboard entries
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  tournaments_played INTEGER DEFAULT 0,
  tournaments_won INTEGER DEFAULT 0,
  ranking_points INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tag TEXT,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  captain_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team members
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Social links
CREATE TABLE IF NOT EXISTS social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_preregistrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registration_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_decklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for games (public read, staff write)
CREATE POLICY "Games are viewable by everyone" ON games FOR SELECT USING (true);
CREATE POLICY "Staff can manage games" ON games FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager'))
);

-- RLS Policies for staff_roles (only owners can manage)
CREATE POLICY "Staff roles viewable by authenticated" ON staff_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only owners can manage staff" ON staff_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role = 'owner')
);

-- RLS Policies for tournaments (public read, staff write)
CREATE POLICY "Tournaments are viewable by everyone" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Staff can manage tournaments" ON tournaments FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);

-- RLS Policies for tournament_phases
CREATE POLICY "Tournament phases viewable by everyone" ON tournament_phases FOR SELECT USING (true);
CREATE POLICY "Staff can manage phases" ON tournament_phases FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);

-- RLS Policies for tournament_rounds
CREATE POLICY "Tournament rounds viewable by everyone" ON tournament_rounds FOR SELECT USING (true);
CREATE POLICY "Staff can manage rounds" ON tournament_rounds FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);

-- RLS Policies for tournament_registrations
CREATE POLICY "Registrations viewable by everyone" ON tournament_registrations FOR SELECT USING (true);
CREATE POLICY "Users can register themselves" ON tournament_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can manage registrations" ON tournament_registrations FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);
CREATE POLICY "Users can update own registration" ON tournament_registrations FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for tournament_preregistrations
CREATE POLICY "Staff can manage preregistrations" ON tournament_preregistrations FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);

-- RLS Policies for tournament_registration_codes
CREATE POLICY "Staff can manage registration codes" ON tournament_registration_codes FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);
CREATE POLICY "Anyone can view codes to validate" ON tournament_registration_codes FOR SELECT USING (true);

-- RLS Policies for tournament_matches
CREATE POLICY "Matches viewable by everyone" ON tournament_matches FOR SELECT USING (true);
CREATE POLICY "Staff can manage matches" ON tournament_matches FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);
CREATE POLICY "Players can report own matches" ON tournament_matches FOR UPDATE USING (
  auth.uid() = player1_id OR auth.uid() = player2_id
);

-- RLS Policies for tournament_player_stats
CREATE POLICY "Player stats viewable by everyone" ON tournament_player_stats FOR SELECT USING (true);
CREATE POLICY "Staff can manage player stats" ON tournament_player_stats FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);

-- RLS Policies for tournament_decklists
CREATE POLICY "Own decklists viewable" ON tournament_decklists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Staff can view all decklists" ON tournament_decklists FOR SELECT USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);
CREATE POLICY "Users can manage own decklists" ON tournament_decklists FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for tournament_participants (legacy)
CREATE POLICY "Participants viewable by everyone" ON tournament_participants FOR SELECT USING (true);
CREATE POLICY "Staff can manage participants" ON tournament_participants FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);

-- RLS Policies for matches (legacy)
CREATE POLICY "Legacy matches viewable by everyone" ON matches FOR SELECT USING (true);
CREATE POLICY "Staff can manage legacy matches" ON matches FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);

-- RLS Policies for tournament_sponsors
CREATE POLICY "Sponsors viewable by everyone" ON tournament_sponsors FOR SELECT USING (true);
CREATE POLICY "Staff can manage sponsors" ON tournament_sponsors FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);

-- RLS Policies for tournament_results
CREATE POLICY "Results viewable by everyone" ON tournament_results FOR SELECT USING (true);
CREATE POLICY "Staff can manage results" ON tournament_results FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);

-- RLS Policies for leaderboard_entries
CREATE POLICY "Leaderboard viewable by everyone" ON leaderboard_entries FOR SELECT USING (true);
CREATE POLICY "Staff can manage leaderboard" ON leaderboard_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);

-- RLS Policies for teams
CREATE POLICY "Teams viewable by everyone" ON teams FOR SELECT USING (true);
CREATE POLICY "Users can create teams" ON teams FOR INSERT WITH CHECK (auth.uid() = captain_id);
CREATE POLICY "Captains can manage own team" ON teams FOR UPDATE USING (auth.uid() = captain_id);
CREATE POLICY "Captains can delete own team" ON teams FOR DELETE USING (auth.uid() = captain_id);

-- RLS Policies for team_members
CREATE POLICY "Team members viewable by everyone" ON team_members FOR SELECT USING (true);
CREATE POLICY "Team captains can manage members" ON team_members FOR ALL USING (
  EXISTS (SELECT 1 FROM teams WHERE id = team_id AND captain_id = auth.uid())
);
CREATE POLICY "Users can leave teams" ON team_members FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for social_links
CREATE POLICY "Social links viewable by everyone" ON social_links FOR SELECT USING (true);
CREATE POLICY "Users can manage own links" ON social_links FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Team captains can manage team links" ON social_links FOR ALL USING (
  EXISTS (SELECT 1 FROM teams WHERE id = team_id AND captain_id = auth.uid())
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tournaments_game_id ON tournaments(game_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON tournaments(slug);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_tournament_id ON tournament_registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_user_id ON tournament_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_round_id ON tournament_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_tournament_player_stats_phase_id ON tournament_player_stats(phase_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_user_id ON leaderboard_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_game_id ON leaderboard_entries(game_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
