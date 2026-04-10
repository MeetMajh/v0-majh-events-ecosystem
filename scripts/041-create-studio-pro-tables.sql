-- MAJH Studio Pro Database Tables
-- These tables support persistent scene/source configurations

-- Studio Sessions (for saving/loading studio configurations)
CREATE TABLE IF NOT EXISTS studio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Session',
  config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Studio Scenes (saved scene configurations)
CREATE TABLE IF NOT EXISTS studio_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Studio Scene Items (sources within scenes)
CREATE TABLE IF NOT EXISTS studio_scene_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES studio_scenes(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- webcam, screen, image, video, text, overlay
  label TEXT NOT NULL,
  x INT NOT NULL DEFAULT 0,
  y INT NOT NULL DEFAULT 0,
  width INT NOT NULL DEFAULT 640,
  height INT NOT NULL DEFAULT 360,
  z_index INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  locked BOOLEAN NOT NULL DEFAULT false,
  opacity NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE studio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_scene_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for studio_sessions
DROP POLICY IF EXISTS "Users can view their own studio sessions" ON studio_sessions;
CREATE POLICY "Users can view their own studio sessions"
ON studio_sessions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own studio sessions" ON studio_sessions;
CREATE POLICY "Users can create their own studio sessions"
ON studio_sessions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own studio sessions" ON studio_sessions;
CREATE POLICY "Users can update their own studio sessions"
ON studio_sessions FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own studio sessions" ON studio_sessions;
CREATE POLICY "Users can delete their own studio sessions"
ON studio_sessions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for studio_scenes
DROP POLICY IF EXISTS "Users can view scenes in their sessions" ON studio_scenes;
CREATE POLICY "Users can view scenes in their sessions"
ON studio_scenes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM studio_sessions 
    WHERE studio_sessions.id = studio_scenes.session_id 
    AND studio_sessions.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage scenes in their sessions" ON studio_scenes;
CREATE POLICY "Users can manage scenes in their sessions"
ON studio_scenes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM studio_sessions 
    WHERE studio_sessions.id = studio_scenes.session_id 
    AND studio_sessions.user_id = auth.uid()
  )
);

-- RLS Policies for studio_scene_items
DROP POLICY IF EXISTS "Users can view items in their scenes" ON studio_scene_items;
CREATE POLICY "Users can view items in their scenes"
ON studio_scene_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM studio_scenes
    JOIN studio_sessions ON studio_sessions.id = studio_scenes.session_id
    WHERE studio_scenes.id = studio_scene_items.scene_id 
    AND studio_sessions.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage items in their scenes" ON studio_scene_items;
CREATE POLICY "Users can manage items in their scenes"
ON studio_scene_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM studio_scenes
    JOIN studio_sessions ON studio_sessions.id = studio_scenes.session_id
    WHERE studio_scenes.id = studio_scene_items.scene_id 
    AND studio_sessions.user_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_studio_sessions_user_id ON studio_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_scenes_session_id ON studio_scenes(session_id);
CREATE INDEX IF NOT EXISTS idx_studio_scene_items_scene_id ON studio_scene_items(scene_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_studio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_studio_sessions_updated_at ON studio_sessions;
CREATE TRIGGER update_studio_sessions_updated_at
  BEFORE UPDATE ON studio_sessions
  FOR EACH ROW EXECUTE FUNCTION update_studio_updated_at();

DROP TRIGGER IF EXISTS update_studio_scenes_updated_at ON studio_scenes;
CREATE TRIGGER update_studio_scenes_updated_at
  BEFORE UPDATE ON studio_scenes
  FOR EACH ROW EXECUTE FUNCTION update_studio_updated_at();

DROP TRIGGER IF EXISTS update_studio_scene_items_updated_at ON studio_scene_items;
CREATE TRIGGER update_studio_scene_items_updated_at
  BEFORE UPDATE ON studio_scene_items
  FOR EACH ROW EXECUTE FUNCTION update_studio_updated_at();
