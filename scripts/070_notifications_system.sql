-- =============================================
-- NOTIFICATIONS SYSTEM
-- Retention engine for MAJH ecosystem
-- =============================================

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'new_follower',
    'new_clip', 
    'live_match',
    'tournament_start',
    'match_result',
    'mention',
    'comment_reply',
    'clip_featured',
    'achievement'
  )),
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT, -- 'clip', 'match', 'tournament', 'player', 'comment'
  entity_id UUID,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- who triggered it
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player follows table (if not exists from previous migration)
CREATE TABLE IF NOT EXISTS player_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, player_id)
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  new_follower BOOLEAN DEFAULT true,
  new_clip_from_followed BOOLEAN DEFAULT true,
  live_match BOOLEAN DEFAULT true,
  tournament_updates BOOLEAN DEFAULT true,
  mentions BOOLEAN DEFAULT true,
  comment_replies BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_player_follows_follower ON player_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_player_follows_player ON player_follows(player_id);

-- Follower count cache on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Update follower counts function
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment counts
    UPDATE profiles SET follower_count = follower_count + 1 WHERE id = NEW.player_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement counts
    UPDATE profiles SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.player_id;
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for follow count updates
DROP TRIGGER IF EXISTS trigger_update_follow_counts ON player_follows;
CREATE TRIGGER trigger_update_follow_counts
  AFTER INSERT OR DELETE ON player_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();

-- Function to create notification for all followers
CREATE OR REPLACE FUNCTION notify_followers(
  p_player_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  notification_count INTEGER;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, actor_id)
  SELECT 
    pf.follower_id,
    p_type,
    p_title,
    p_body,
    p_entity_type,
    p_entity_id,
    p_player_id
  FROM player_follows pf
  JOIN notification_preferences np ON np.user_id = pf.follower_id
  WHERE pf.player_id = p_player_id
    AND (
      (p_type = 'new_clip' AND np.new_clip_from_followed = true) OR
      (p_type = 'live_match' AND np.live_match = true) OR
      (p_type NOT IN ('new_clip', 'live_match'))
    );
  
  GET DIAGNOSTICS notification_count = ROW_COUNT;
  RETURN notification_count;
END;
$$ LANGUAGE plpgsql;

-- Auto-create notification preferences for new users
CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON profiles;
CREATE TRIGGER trigger_create_notification_preferences
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_preferences();

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Notifications: users can only see their own
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Follows: anyone can see follows, only auth users can create/delete
DROP POLICY IF EXISTS "Anyone can view follows" ON player_follows;
CREATE POLICY "Anyone can view follows" ON player_follows
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can follow" ON player_follows;
CREATE POLICY "Users can follow" ON player_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow" ON player_follows;
CREATE POLICY "Users can unfollow" ON player_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Notification preferences: users can only manage their own
DROP POLICY IF EXISTS "Users can view own preferences" ON notification_preferences;
CREATE POLICY "Users can view own preferences" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON notification_preferences;
CREATE POLICY "Users can update own preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);
