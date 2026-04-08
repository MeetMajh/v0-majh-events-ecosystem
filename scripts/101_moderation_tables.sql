-- Moderation reports (user-submitted reports)
CREATE TABLE IF NOT EXISTS moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('clip', 'chat', 'comment', 'profile', 'stream')),
  content_id UUID NOT NULL,
  content_url TEXT,
  message TEXT,
  reason TEXT NOT NULL CHECK (reason IN (
    'inappropriate', 'spam', 'harassment', 'hate_speech', 
    'violence', 'copyright', 'misinformation', 'other'
  )),
  additional_info TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Moderation actions taken
CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES moderation_reports(id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'approve', 'remove', 'warn', 'mute', 'ban', 
    'shadow_ban', 'restrict', 'dismiss', 'escalate'
  )),
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'content', 'comment')),
  reason TEXT,
  duration_hours INTEGER,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  automated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Moderation logs (audit trail)
CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID,
  user_id UUID,
  moderator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  result JSONB,
  action_taken TEXT,
  automated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User restrictions/bans
CREATE TABLE IF NOT EXISTS user_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL CHECK (restriction_type IN (
    'muted', 'banned', 'shadow_banned', 'restricted', 'upload_disabled'
  )),
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_moderation_reports_status ON moderation_reports(status);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_content ON moderation_reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_created ON moderation_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_report ON moderation_actions(report_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target ON moderation_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_user ON user_restrictions(user_id) WHERE is_active = TRUE;
