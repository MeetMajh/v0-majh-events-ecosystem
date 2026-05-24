-- T-004: Fix INSERT forgery vectors
-- Tighten INSERT policies to prevent users from forging rows attributing actions to others

-- ============================================
-- PART 1: Revoke INSERT from authenticated (service-role only)
-- ============================================

-- wallet_transactions: service-role only
DROP POLICY IF EXISTS "Users can insert wallet transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "Allow insert wallet_transactions" ON wallet_transactions;
CREATE POLICY "Service role inserts wallet_transactions"
  ON wallet_transactions FOR INSERT
  TO service_role
  WITH CHECK (true);

-- notifications: service-role only
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Allow insert notifications" ON notifications;
CREATE POLICY "Service role inserts notifications"
  ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- financial_alerts: service-role only
DROP POLICY IF EXISTS "Users can insert financial_alerts" ON financial_alerts;
DROP POLICY IF EXISTS "Allow insert financial_alerts" ON financial_alerts;
CREATE POLICY "Service role inserts financial_alerts"
  ON financial_alerts FOR INSERT
  TO service_role
  WITH CHECK (true);

-- access_audit_log: service-role only
DROP POLICY IF EXISTS "Users can insert access_audit_log" ON access_audit_log;
DROP POLICY IF EXISTS "Allow insert access_audit_log" ON access_audit_log;
CREATE POLICY "Service role inserts access_audit_log"
  ON access_audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- match_engagement_events: service-role only
DROP POLICY IF EXISTS "Users can insert match_engagement_events" ON match_engagement_events;
DROP POLICY IF EXISTS "Allow insert match_engagement_events" ON match_engagement_events;
CREATE POLICY "Service role inserts match_engagement_events"
  ON match_engagement_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================
-- PART 2: Tighten user_id checks (user_id = auth.uid() OR user_id IS NULL)
-- ============================================

-- match_reactions
DROP POLICY IF EXISTS "Users can insert match_reactions" ON match_reactions;
DROP POLICY IF EXISTS "Allow insert match_reactions" ON match_reactions;
CREATE POLICY "Users insert own match_reactions"
  ON match_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- match_viewer_sessions
DROP POLICY IF EXISTS "Users can insert match_viewer_sessions" ON match_viewer_sessions;
DROP POLICY IF EXISTS "Allow insert match_viewer_sessions" ON match_viewer_sessions;
CREATE POLICY "Users insert own match_viewer_sessions"
  ON match_viewer_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- match_viewers
DROP POLICY IF EXISTS "Users can insert match_viewers" ON match_viewers;
DROP POLICY IF EXISTS "Allow insert match_viewers" ON match_viewers;
CREATE POLICY "Users insert own match_viewers"
  ON match_viewers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- media_view_events
DROP POLICY IF EXISTS "Users can insert media_view_events" ON media_view_events;
DROP POLICY IF EXISTS "Allow insert media_view_events" ON media_view_events;
CREATE POLICY "Users insert own media_view_events"
  ON media_view_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- media_views
DROP POLICY IF EXISTS "Users can insert media_views" ON media_views;
DROP POLICY IF EXISTS "Allow insert media_views" ON media_views;
CREATE POLICY "Users insert own media_views"
  ON media_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- analytics_events (also drop duplicate policy)
DROP POLICY IF EXISTS "Users can insert analytics_events" ON analytics_events;
DROP POLICY IF EXISTS "Allow insert analytics" ON analytics_events;
DROP POLICY IF EXISTS "Allow insert analytics_events" ON analytics_events;
CREATE POLICY "Users insert own analytics_events"
  ON analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ============================================
-- PART 3: Revoke cb_* INSERT from authenticated (admin/service-role only)
-- ============================================

-- cb_league_members
DROP POLICY IF EXISTS "Users can insert cb_league_members" ON cb_league_members;
DROP POLICY IF EXISTS "Allow insert cb_league_members" ON cb_league_members;
CREATE POLICY "Service role inserts cb_league_members"
  ON cb_league_members FOR INSERT
  TO service_role
  WITH CHECK (true);

-- cb_league_seasons
DROP POLICY IF EXISTS "Users can insert cb_league_seasons" ON cb_league_seasons;
DROP POLICY IF EXISTS "Allow insert cb_league_seasons" ON cb_league_seasons;
CREATE POLICY "Service role inserts cb_league_seasons"
  ON cb_league_seasons FOR INSERT
  TO service_role
  WITH CHECK (true);

-- cb_leagues
DROP POLICY IF EXISTS "Users can insert cb_leagues" ON cb_leagues;
DROP POLICY IF EXISTS "Allow insert cb_leagues" ON cb_leagues;
CREATE POLICY "Service role inserts cb_leagues"
  ON cb_leagues FOR INSERT
  TO service_role
  WITH CHECK (true);

-- cb_match_games
DROP POLICY IF EXISTS "Users can insert cb_match_games" ON cb_match_games;
DROP POLICY IF EXISTS "Allow insert cb_match_games" ON cb_match_games;
CREATE POLICY "Service role inserts cb_match_games"
  ON cb_match_games FOR INSERT
  TO service_role
  WITH CHECK (true);

-- cb_matches
DROP POLICY IF EXISTS "Users can insert cb_matches" ON cb_matches;
DROP POLICY IF EXISTS "Allow insert cb_matches" ON cb_matches;
CREATE POLICY "Service role inserts cb_matches"
  ON cb_matches FOR INSERT
  TO service_role
  WITH CHECK (true);

-- cb_season_standings
DROP POLICY IF EXISTS "Users can insert cb_season_standings" ON cb_season_standings;
DROP POLICY IF EXISTS "Allow insert cb_season_standings" ON cb_season_standings;
CREATE POLICY "Service role inserts cb_season_standings"
  ON cb_season_standings FOR INSERT
  TO service_role
  WITH CHECK (true);

-- cb_teams
DROP POLICY IF EXISTS "Users can insert cb_teams" ON cb_teams;
DROP POLICY IF EXISTS "Allow insert cb_teams" ON cb_teams;
CREATE POLICY "Service role inserts cb_teams"
  ON cb_teams FOR INSERT
  TO service_role
  WITH CHECK (true);

-- cb_weekly_matchups
DROP POLICY IF EXISTS "Users can insert cb_weekly_matchups" ON cb_weekly_matchups;
DROP POLICY IF EXISTS "Allow insert cb_weekly_matchups" ON cb_weekly_matchups;
CREATE POLICY "Service role inserts cb_weekly_matchups"
  ON cb_weekly_matchups FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================
-- PART 4: contact_submissions - keep open (anonymous expected)
-- Rate-limiting deferred to T-064 at app layer
-- ============================================
-- No changes needed - existing open INSERT is intentional
