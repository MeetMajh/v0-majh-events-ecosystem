git add supabase/migrations/20260519_007_enable_rls_disabled_tables.sql
git commit -m "T-205.0: Enable RLS and lock down grants on 10 RLS-disabled tables

Closes urgent finding from T-205 grant audit. Enables RLS on
ad_clicks, ad_conversions, allowed_embed_domains, content_embeddings,
conversion_events, exports_participants_missing_registrations,
exports_registrations_missing_participants, moderation_alerts,
outbox, platform_metrics. Adds service-role-only policies. REVOKEs
all anon, authenticated, and PUBLIC grants. postgres and service_role
retain full access."
git push origin main

-- 20260519_007_enable_rls_disabled_tables.sql
-- T-205.0: Enable RLS, add restrictive policies, REVOKE anon and authenticated 
-- grants on the 10 tables that currently have RLS disabled.
-- 
-- After this migration, these tables are accessible only via postgres (db owner)
-- and service_role (backend service). authenticated and anon have ZERO access.
-- If T-204 later determines admin-role access is needed via authenticated, 
-- additional grants and policies will be added at that time.

BEGIN;

-- ==========================================
-- 1. Enable RLS on all 10 tables
-- ==========================================

ALTER TABLE public.ad_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_embed_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports_participants_missing_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports_registrations_missing_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_metrics ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 2. Add service-role-only SELECT policies
-- ==========================================
-- Note: service_role bypasses RLS by default in Supabase, but explicit policies
-- document intent. Authenticated users will see no rows (default deny).

CREATE POLICY "service_role_only_select_ad_clicks" 
    ON public.ad_clicks FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_select_ad_conversions" 
    ON public.ad_conversions FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_select_allowed_embed_domains" 
    ON public.allowed_embed_domains FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_select_content_embeddings" 
    ON public.content_embeddings FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_select_conversion_events" 
    ON public.conversion_events FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_select_exports_participants_missing" 
    ON public.exports_participants_missing_registrations FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_select_exports_registrations_missing" 
    ON public.exports_registrations_missing_participants FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_select_moderation_alerts" 
    ON public.moderation_alerts FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_select_outbox" 
    ON public.outbox FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_select_platform_metrics" 
    ON public.platform_metrics FOR SELECT
    USING (auth.role() = 'service_role');

-- ==========================================
-- 3. REVOKE all anon grants
-- ==========================================

REVOKE ALL ON public.ad_clicks FROM anon;
REVOKE ALL ON public.ad_conversions FROM anon;
REVOKE ALL ON public.allowed_embed_domains FROM anon;
REVOKE ALL ON public.content_embeddings FROM anon;
REVOKE ALL ON public.conversion_events FROM anon;
REVOKE ALL ON public.exports_participants_missing_registrations FROM anon;
REVOKE ALL ON public.exports_registrations_missing_participants FROM anon;
REVOKE ALL ON public.moderation_alerts FROM anon;
REVOKE ALL ON public.outbox FROM anon;
REVOKE ALL ON public.platform_metrics FROM anon;

-- ==========================================
-- 4. REVOKE all authenticated grants
-- ==========================================
-- These tables are internal/admin/diagnostic. Regular authenticated users 
-- should not have any access. If admin role needs access in the future,
-- explicit policies will be added in T-204.

REVOKE ALL ON public.ad_clicks FROM authenticated;
REVOKE ALL ON public.ad_conversions FROM authenticated;
REVOKE ALL ON public.allowed_embed_domains FROM authenticated;
REVOKE ALL ON public.content_embeddings FROM authenticated;
REVOKE ALL ON public.conversion_events FROM authenticated;
REVOKE ALL ON public.exports_participants_missing_registrations FROM authenticated;
REVOKE ALL ON public.exports_registrations_missing_participants FROM authenticated;
REVOKE ALL ON public.moderation_alerts FROM authenticated;
REVOKE ALL ON public.outbox FROM authenticated;
REVOKE ALL ON public.platform_metrics FROM authenticated;

-- ==========================================
-- 5. REVOKE from PUBLIC role (catch-all for inherited grants)
-- ==========================================

REVOKE ALL ON public.ad_clicks FROM PUBLIC;
REVOKE ALL ON public.ad_conversions FROM PUBLIC;
REVOKE ALL ON public.allowed_embed_domains FROM PUBLIC;
REVOKE ALL ON public.content_embeddings FROM PUBLIC;
REVOKE ALL ON public.conversion_events FROM PUBLIC;
REVOKE ALL ON public.exports_participants_missing_registrations FROM PUBLIC;
REVOKE ALL ON public.exports_registrations_missing_participants FROM PUBLIC;
REVOKE ALL ON public.moderation_alerts FROM PUBLIC;
REVOKE ALL ON public.outbox FROM PUBLIC;
REVOKE ALL ON public.platform_metrics FROM PUBLIC;

COMMIT;

### Verification queries (run after the migration)
  
-- 1. Confirm RLS is enabled on all 10 tables
SELECT 
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'ad_clicks', 'ad_conversions', 'allowed_embed_domains', 'content_embeddings',
    'conversion_events', 'exports_participants_missing_registrations',
    'exports_registrations_missing_participants', 'moderation_alerts', 
    'outbox', 'platform_metrics'
  )
ORDER BY c.relname;

-- Expected: all 10 rows with rls_enabled = true

-- 2. Confirm policies exist (one per table)
SELECT 
  tablename,
  COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'ad_clicks', 'ad_conversions', 'allowed_embed_domains', 'content_embeddings',
    'conversion_events', 'exports_participants_missing_registrations',
    'exports_registrations_missing_participants', 'moderation_alerts', 
    'outbox', 'platform_metrics'
  )
GROUP BY tablename
ORDER BY tablename;

-- Expected: all 10 tables with policy_count = 1

-- 3. Confirm anon and authenticated have NO grants
SELECT 
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'ad_clicks', 'ad_conversions', 'allowed_embed_domains', 'content_embeddings',
    'conversion_events', 'exports_participants_missing_registrations',
    'exports_registrations_missing_participants', 'moderation_alerts', 
    'outbox', 'platform_metrics'
  )
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- Expected: ZERO rows returned

-- 4. Confirm postgres and service_role still have access
SELECT 
  table_name,
  grantee,
  COUNT(*) AS privilege_count
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'ad_clicks', 'ad_conversions', 'allowed_embed_domains', 'content_embeddings',
    'conversion_events', 'exports_participants_missing_registrations',
    'exports_registrations_missing_participants', 'moderation_alerts', 
    'outbox', 'platform_metrics'
  )
  AND grantee IN ('postgres', 'service_role')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- Expected: 20 rows (10 tables × 2 roles), each with privilege_count = 7
