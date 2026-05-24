-- Notification Queue + Logs
-- Delivery engine tables for the notification system

-- ==========================================
-- 1. NOTIFICATION QUEUE
-- ==========================================

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_pending
  ON notification_queue(status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_queue_user
  ON notification_queue(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_queue_notification
  ON notification_queue(notification_id);

-- ==========================================
-- 2. NOTIFICATION LOGS
-- ==========================================

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  response JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user
  ON notification_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_created
  ON notification_logs(created_at DESC);

-- ==========================================
-- 3. RLS
-- ==========================================

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Queue: service_role only (cron worker uses service role)
CREATE POLICY "service_role full access to queue"
  ON notification_queue FOR ALL
  USING (auth.role() = 'service_role');

-- Logs: service_role only
CREATE POLICY "service_role full access to logs"
  ON notification_logs FOR ALL
  USING (auth.role() = 'service_role');

-- ==========================================
-- 4. HELPER: get_user_email (used by dispatch worker)
-- ==========================================

CREATE OR REPLACE FUNCTION get_user_email(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'email', (SELECT email FROM auth.users WHERE id = p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_email(UUID) TO service_role;

-- ==========================================
-- 5. ADD tournament_registration to notifications type check
-- ==========================================

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'match_ready',
    'match_starting',
    'match_result',
    'tournament_starting',
    'tournament_registration',
    'round_starting',
    'followed_player_live',
    'followed_player_match',
    'trending_match',
    'achievement_earned',
    'staff_alert',
    'system'
  ));

-- ==========================================
-- 5. ADD email_frequency to notification_preferences
-- ==========================================

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS email_frequency TEXT NOT NULL DEFAULT 'important'
    CHECK (email_frequency IN ('all', 'important', 'silent')),
  ADD COLUMN IF NOT EXISTS tournaments BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS purchases BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS announcements BOOLEAN NOT NULL DEFAULT true;
