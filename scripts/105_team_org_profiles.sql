-- ============================================================================
-- TEAM & ORGANIZATION PROFILES
-- For team and org branding, logos, and streaming assets
-- ============================================================================

-- Team Profiles Table
CREATE TABLE IF NOT EXISTS team_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    social_links JSONB DEFAULT '{}',
    achievements JSONB DEFAULT '[]',
    contact_email TEXT,
    website_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_profiles_team ON team_profiles(team_id);

-- Organization Profiles Table
CREATE TABLE IF NOT EXISTS organization_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    social_links JSONB DEFAULT '{}',
    contact_email TEXT,
    website_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    stream_branding JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_profiles_org ON organization_profiles(organization_id);

-- RLS
ALTER TABLE team_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view team profiles" ON team_profiles;
DROP POLICY IF EXISTS "Anyone can view org profiles" ON organization_profiles;

CREATE POLICY "Anyone can view team profiles" ON team_profiles
    FOR SELECT USING (TRUE);

CREATE POLICY "Anyone can view org profiles" ON organization_profiles
    FOR SELECT USING (TRUE);

-- Verify
SELECT 'team_profiles and organization_profiles created' as result;
