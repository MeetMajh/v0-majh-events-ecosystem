-- Notifications System
-- Pulls users back to the platform with timely alerts

-- ==========================================
-- 1. NOTIFICATIONS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Notification type
  type TEXT NOT NULL CHECK (type IN (
    'match_ready',           -- Your match is ready to play
    'match_starting',        -- Your match is starting soon
    'match_result',          -- Match result recorded
    'tournament_starting',   -- Tournament you're in is starting
    'round_starting',        -- New round starting in your tournament
    'followed_player_live',  -- Player you follow is live
    'followed_player_match', -- Player you follow has a match
    'trending_match',        -- A match is trending/hot
    'achievement_earned',    -- You earned an achievement
    'staff_alert',           -- Alert from tournament staff
    'system'                 -- System notification
  )),
  
  -- Content
  title TEXT NOT NULL,
  body TEXT,
  
  -- Navigation
  link TEXT,                 -- URL to navigate to
  
  -- Related entities (for deduplication and grouping)
  match_id UUID REFERENCES tournament_matches(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- State
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_dismissed BOOLEAN DEFAULT false,
  
  -- Metadata
  icon TEXT,                 -- Icon name/emoji
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ     -- Optional expiration
);

-- ==========================================
-- 2. NOTIFICATION PREFERENCES
-- ==========================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  
  -- Per-type preferences
  match_ready BOOLEAN DEFAULT true,
  match_starting BOOLEAN DEFAULT true,
  match_result BOOLEAN DEFAULT true,
  tournament_starting BOOLEAN DEFAULT true,
  round_starting BOOLEAN DEFAULT true,
  followed_player_live BOOLEAN DEFAULT true,
  followed_player_match BOOLEAN DEFAULT true,
  trending_match BOOLEAN DEFAULT false,  -- Off by default (can be spammy)
  achievement_earned BOOLEAN DEFAULT true,
  staff_alert BOOLEAN DEFAULT true,
  
  -- Delivery preferences
  in_app BOOLEAN DEFAULT true,
  email BOOLEAN DEFAULT false,           -- Future: email notifications
  push BOOLEAN DEFAULT false,            -- Future: push notifications
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_recent ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_match ON notifications(match_id) WHERE match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_tournament ON notifications(tournament_id) WHERE tournament_id IS NOT NULL;

-- ==========================================
-- 4. RLS POLICIES
-- ==========================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own notifications' AND tablename = 'notifications') THEN
    CREATE POLICY "Users can view own notifications" ON notifications
      FOR SELECT USING (user_id = auth.uid());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own notifications' AND tablename = 'notifications') THEN
    CREATE POLICY "Users can update own notifications" ON notifications
      FOR UPDATE USING (user_id = auth.uid());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can create notifications' AND tablename = 'notifications') THEN
    CREATE POLICY "System can create notifications" ON notifications
      FOR INSERT WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own preferences' AND tablename = 'notification_preferences') THEN
    CREATE POLICY "Users can manage own preferences" ON notification_preferences
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

-- ==========================================
-- 5. HELPER FUNCTIONS
-- ==========================================

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_match_id UUID DEFAULT NULL,
  p_tournament_id UUID DEFAULT NULL,
  p_player_id UUID DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal'
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_prefs notification_preferences%ROWTYPE;
BEGIN
  -- Check user preferences
  SELECT * INTO v_prefs FROM notification_preferences WHERE user_id = p_user_id;
  
  -- If no preferences, create default
  IF NOT FOUND THEN
    INSERT INTO notification_preferences (user_id) VALUES (p_user_id);
  ELSE
    -- Check if this notification type is enabled
    IF (p_type = 'match_ready' AND NOT v_prefs.match_ready) OR
       (p_type = 'match_starting' AND NOT v_prefs.match_starting) OR
       (p_type = 'match_result' AND NOT v_prefs.match_result) OR
       (p_type = 'tournament_starting' AND NOT v_prefs.tournament_starting) OR
       (p_type = 'round_starting' AND NOT v_prefs.round_starting) OR
       (p_type = 'followed_player_live' AND NOT v_prefs.followed_player_live) OR
       (p_type = 'followed_player_match' AND NOT v_prefs.followed_player_match) OR
       (p_type = 'trending_match' AND NOT v_prefs.trending_match) OR
       (p_type = 'achievement_earned' AND NOT v_prefs.achievement_earned) OR
       (p_type = 'staff_alert' AND NOT v_prefs.staff_alert) THEN
      RETURN NULL;  -- User has this notification type disabled
    END IF;
    
    -- Check quiet hours
    IF v_prefs.quiet_hours_enabled AND 
       v_prefs.quiet_hours_start IS NOT NULL AND 
       v_prefs.quiet_hours_end IS NOT NULL THEN
      IF CURRENT_TIME BETWEEN v_prefs.quiet_hours_start AND v_prefs.quiet_hours_end THEN
        RETURN NULL;  -- In quiet hours
      END IF;
    END IF;
  END IF;
  
  -- Create notification
  INSERT INTO notifications (
    user_id, type, title, body, link, 
    match_id, tournament_id, player_id, icon, priority
  ) VALUES (
    p_user_id, p_type, p_title, p_body, p_link,
    p_match_id, p_tournament_id, p_player_id, p_icon, p_priority
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify all followers of a player
CREATE OR REPLACE FUNCTION notify_player_followers(
  p_player_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_match_id UUID DEFAULT NULL,
  p_tournament_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_follower_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_follower_id IN 
    SELECT follower_id FROM player_follows WHERE player_id = p_player_id
  LOOP
    PERFORM create_notification(
      v_follower_id, p_type, p_title, p_body, p_link,
      p_match_id, p_tournament_id, p_player_id
    );
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify all participants in a tournament
CREATE OR REPLACE FUNCTION notify_tournament_participants(
  p_tournament_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_user_id IN 
    SELECT user_id FROM tournament_participants 
    WHERE tournament_id = p_tournament_id AND status = 'registered'
  LOOP
    PERFORM create_notification(
      v_user_id, p_type, p_title, p_body, p_link,
      NULL, p_tournament_id, NULL
    );
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 6. TRIGGERS FOR AUTO-NOTIFICATIONS
-- ==========================================

-- Notify when match becomes featured (player goes live)
CREATE OR REPLACE FUNCTION notify_on_feature_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when is_feature_match changes to true
  IF NEW.is_feature_match = true AND (OLD.is_feature_match IS NULL OR OLD.is_feature_match = false) THEN
    -- Notify followers of player 1
    IF NEW.player1_id IS NOT NULL THEN
      PERFORM notify_player_followers(
        NEW.player1_id,
        'followed_player_live',
        'Player is live!',
        (SELECT first_name || ' ' || last_name FROM profiles WHERE id = NEW.player1_id) || ' is now streaming a match',
        '/match/' || NEW.id || '/watch',
        NEW.id,
        NULL
      );
    END IF;
    
    -- Notify followers of player 2
    IF NEW.player2_id IS NOT NULL THEN
      PERFORM notify_player_followers(
        NEW.player2_id,
        'followed_player_live',
        'Player is live!',
        (SELECT first_name || ' ' || last_name FROM profiles WHERE id = NEW.player2_id) || ' is now streaming a match',
        '/match/' || NEW.id || '/watch',
        NEW.id,
        NULL
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_feature_match ON tournament_matches;
CREATE TRIGGER trigger_notify_feature_match
  AFTER UPDATE ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_feature_match();

-- ==========================================
-- 7. ENABLE REALTIME
-- ==========================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
