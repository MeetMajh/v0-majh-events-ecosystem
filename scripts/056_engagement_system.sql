-- Engagement System Migration
-- Adds viewer tracking, reactions, chat, and player follows for stickiness

-- ==========================================
-- 1. VIEWER COUNT TRACKING
-- ==========================================

-- Match viewer sessions (for real viewer counts)
CREATE TABLE IF NOT EXISTS match_viewer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL, -- anonymous session tracking
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_ping_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  watch_duration_seconds INTEGER DEFAULT 0
);

-- Indexes for viewer tracking
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_match ON match_viewer_sessions(match_id);
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_active ON match_viewer_sessions(match_id, last_ping_at) 
  WHERE ended_at IS NULL;

-- Function to get active viewer count (pinged in last 60 seconds)
CREATE OR REPLACE FUNCTION get_match_viewer_count(p_match_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT session_id)
    FROM match_viewer_sessions
    WHERE match_id = p_match_id
      AND ended_at IS NULL
      AND last_ping_at > NOW() - INTERVAL '60 seconds'
  );
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 2. MATCH REACTIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS match_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT, -- for anonymous reactions
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('fire', 'shocked', 'clap', 'sad', 'laugh')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregate reaction counts per match
CREATE TABLE IF NOT EXISTS match_reaction_counts (
  match_id UUID PRIMARY KEY REFERENCES tournament_matches(id) ON DELETE CASCADE,
  fire_count INTEGER DEFAULT 0,
  shocked_count INTEGER DEFAULT 0,
  clap_count INTEGER DEFAULT 0,
  sad_count INTEGER DEFAULT 0,
  laugh_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reactions_match ON match_reactions(match_id);
CREATE INDEX IF NOT EXISTS idx_reactions_recent ON match_reactions(match_id, created_at DESC);

-- Function to increment reaction count
CREATE OR REPLACE FUNCTION increment_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO match_reaction_counts (match_id, fire_count, shocked_count, clap_count, sad_count, laugh_count, total_count)
  VALUES (NEW.match_id, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (match_id) DO NOTHING;

  UPDATE match_reaction_counts
  SET 
    fire_count = fire_count + CASE WHEN NEW.reaction_type = 'fire' THEN 1 ELSE 0 END,
    shocked_count = shocked_count + CASE WHEN NEW.reaction_type = 'shocked' THEN 1 ELSE 0 END,
    clap_count = clap_count + CASE WHEN NEW.reaction_type = 'clap' THEN 1 ELSE 0 END,
    sad_count = sad_count + CASE WHEN NEW.reaction_type = 'sad' THEN 1 ELSE 0 END,
    laugh_count = laugh_count + CASE WHEN NEW.reaction_type = 'laugh' THEN 1 ELSE 0 END,
    total_count = total_count + 1,
    updated_at = NOW()
  WHERE match_id = NEW.match_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_reaction ON match_reactions;
CREATE TRIGGER trigger_increment_reaction
  AFTER INSERT ON match_reactions
  FOR EACH ROW
  EXECUTE FUNCTION increment_reaction_count();

-- ==========================================
-- 3. MATCH CHAT
-- ==========================================

CREATE TABLE IF NOT EXISTS match_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  is_moderator BOOLEAN DEFAULT false,
  is_caster BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_match ON match_chat_messages(match_id);
CREATE INDEX IF NOT EXISTS idx_chat_recent ON match_chat_messages(match_id, created_at DESC);

-- ==========================================
-- 4. PLAYER FOLLOWS
-- ==========================================

CREATE TABLE IF NOT EXISTS player_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, player_id)
);

-- Add follower counts to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_follows_follower ON player_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_player ON player_follows(player_id);

-- Function to update follower count
CREATE OR REPLACE FUNCTION update_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE id = NEW.player_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = follower_count - 1 WHERE id = OLD.player_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_follower_count ON player_follows;
CREATE TRIGGER trigger_update_follower_count
  AFTER INSERT OR DELETE ON player_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follower_count();

-- ==========================================
-- 5. MATCH METADATA ENHANCEMENTS
-- ==========================================

-- Add engagement fields to tournament_matches
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS peak_viewer_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_reactions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS chat_message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS momentum_player_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS momentum_streak INTEGER DEFAULT 0;

-- ==========================================
-- 6. AUTO-VOD TRIGGER
-- ==========================================

-- Function to auto-create VOD when match completes with stream
CREATE OR REPLACE FUNCTION auto_create_match_vod()
RETURNS TRIGGER AS $$
DECLARE
  v_tournament_id UUID;
  v_round_number INTEGER;
  v_player1_name TEXT;
  v_player2_name TEXT;
  v_tournament_name TEXT;
BEGIN
  -- Only trigger when match status changes to confirmed and has stream URL
  IF NEW.status = 'confirmed' AND NEW.stream_url IS NOT NULL AND OLD.status != 'confirmed' THEN
    -- Get tournament info
    SELECT tp.tournament_id, tr.round_number
    INTO v_tournament_id, v_round_number
    FROM tournament_rounds tr
    JOIN tournament_phases tp ON tr.phase_id = tp.id
    WHERE tr.id = NEW.round_id;

    -- Get player names
    SELECT COALESCE(first_name || ' ' || last_name, 'Player 1') INTO v_player1_name
    FROM profiles WHERE id = NEW.player1_id;
    
    SELECT COALESCE(first_name || ' ' || last_name, 'Player 2') INTO v_player2_name
    FROM profiles WHERE id = NEW.player2_id;

    -- Get tournament name
    SELECT name INTO v_tournament_name FROM tournaments WHERE id = v_tournament_id;

    -- Insert VOD record
    INSERT INTO tournament_vods (
      tournament_id,
      match_id,
      title,
      description,
      platform,
      video_url,
      round_number,
      player1_id,
      player2_id,
      recorded_at
    ) VALUES (
      v_tournament_id,
      NEW.id,
      v_player1_name || ' vs ' || v_player2_name || ' - Round ' || v_round_number,
      v_tournament_name || ' - Round ' || v_round_number || ' Match',
      COALESCE(NEW.stream_platform, 'custom'),
      NEW.stream_url,
      v_round_number,
      NEW.player1_id,
      NEW.player2_id,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_vod ON tournament_matches;
CREATE TRIGGER trigger_auto_create_vod
  AFTER UPDATE OF status ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_match_vod();

-- ==========================================
-- 7. TRENDING SCORE CALCULATION
-- ==========================================

-- Add trending score to matches
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS trending_score NUMERIC(10,2) DEFAULT 0;

-- Function to calculate trending score
CREATE OR REPLACE FUNCTION calculate_trending_score(
  p_viewer_count INTEGER,
  p_reaction_count INTEGER,
  p_is_feature BOOLEAN,
  p_hours_ago NUMERIC
)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (
    (COALESCE(p_viewer_count, 0) * 10) +
    (COALESCE(p_reaction_count, 0) * 5) +
    (CASE WHEN p_is_feature THEN 100 ELSE 0 END)
  ) / POWER(COALESCE(p_hours_ago, 1) + 2, 1.5);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==========================================
-- 8. RLS POLICIES
-- ==========================================

ALTER TABLE match_viewer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_reaction_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_follows ENABLE ROW LEVEL SECURITY;

-- Viewer sessions - anyone can create, only own can view
CREATE POLICY "Anyone can create viewer session" ON match_viewer_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own sessions" ON match_viewer_sessions FOR SELECT USING (true);
CREATE POLICY "Users can update own sessions" ON match_viewer_sessions FOR UPDATE USING (true);

-- Reactions - anyone can view and create
CREATE POLICY "Anyone can view reactions" ON match_reactions FOR SELECT USING (true);
CREATE POLICY "Anyone can create reactions" ON match_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view reaction counts" ON match_reaction_counts FOR SELECT USING (true);

-- Chat - anyone can view, authenticated can post
CREATE POLICY "Anyone can view chat" ON match_chat_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can post chat" ON match_chat_messages FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- Follows - users manage their own follows
CREATE POLICY "Anyone can view follows" ON player_follows FOR SELECT USING (true);
CREATE POLICY "Users can manage own follows" ON player_follows FOR ALL 
  USING (follower_id = auth.uid());

-- Enable realtime for engagement tables
ALTER PUBLICATION supabase_realtime ADD TABLE match_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE match_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE match_reaction_counts;
