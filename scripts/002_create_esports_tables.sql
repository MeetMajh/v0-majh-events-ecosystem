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
