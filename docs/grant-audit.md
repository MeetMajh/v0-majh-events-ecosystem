Grant Audit Categorization (T-205 Phase 1)
Generated: May 19, 2026
Purpose: Definitive mapping of every public schema table/view to a grant category. Source of truth for T-205 migration batches.
Category definitions
CategoryAnon grantsUse caseANONESensitive internal data. Authenticated access via RLS only.BSELECT onlyPublic-readable content (tournaments, news, media, articles).CINSERT onlyAnonymous form submissions (contact forms).DNONEAuthenticated-user data. No anon access.
All categories preserve full grants for postgres (database owner) and service_role (backend service access). authenticated role gets SELECT (and INSERT where appropriate) regardless of category — RLS policies handle actual row-level access for authenticated users.
Urgent: RLS-disabled tables (10)
These tables have NO row-level security. Any anon grant results in immediate full access. Highest priority cleanup. All move to Category A.

ad_clicks
ad_conversions
allowed_embed_domains
content_embeddings
conversion_events
exports_participants_missing_registrations
exports_registrations_missing_participants
moderation_alerts
outbox
platform_metrics

Treatment for these tables: Enable RLS first, add a basic policy (probably "service_role only"), then REVOKE anon grants.
Tables with RLS enabled but ZERO policies (9)
Tables where RLS is on but no policies exist. Effectively locked from authenticated users (default-deny). Service role can still access. Need policies added when they're touched.

clip_jobs
compliance_alerts
feed_cache, feed_interactions, feed_sessions
stream_chat_messages ← will become Category B, needs read policy
stream_clips_buffer
stream_slots
stream_viewers
studio_audio_tracks, studio_hotkeys, studio_overlays, studio_presets, studio_replay_buffer
ticket_order_items

Treatment: Defer policy work to later batches. Flag for review in T-204 (authorization migration).
Category A — Lock down completely (REVOKE ALL FROM anon)
Financial spine

ledger_accounts, ledger_entries, ledger_transactions
financial_alerts, financial_intents, financial_transactions
wallets, wallet_transactions, user_wallets, withdrawal_requests
invoices
escrow_accounts
payout_methods, payout_requests, organizer_payouts, player_payouts, tournament_payouts
disputes
tournament_payments
platform_revenue, platform_fee_config
organizer_fee_overrides, organizer_fee_tiers, tournament_fee_overrides
creator_earnings
capital_advances
points_transactions *(user loyalty/rewards activity — private)*
prize_distributions *(payment records, not public prize structure — prize structure lives in tournament-facing tables)*
dismissed_stripe_payments
reconciliation_audit_log
tax_forms
billing_events
subscriptions
payment_methods

Financial views

escrow_status
financial_health_summary
ledger_balances
v_dispute_exposure
v_financial_summary (already locked down — May 18)
v_payout_status
v_tournament_financials

Compliance and audit

aml_transaction_logs
kyc_sessions, kyc_verifications
compliance_alerts
access_audit_log, access_requests
risk_signals
api_request_log, api_keys
moderation_actions, moderation_logs, moderation_reports, moderation_alerts
user_restrictions
media_reports

Admin and system

admins
staff_roles
site_settings, system_alerts, system_controls
alert_configurations, alert_history
auto_feature_config, automation_logs, automation_rules
chaos_test_runs, deployment_integrity_runs
feature_definitions, feature_usage_log
realtime_metrics, platform_metrics
notification_logs, notification_queue
outbox
usage_records
allowed_embed_domains
content_embeddings
exports_participants_missing_registrations, exports_registrations_missing_participants

Tenant/department/location/permission structure

tenants, tenant_features, tenant_memberships
departments, locations
organization_members, organization_invitations, organization_role_templates
role_template_permissions, role_requests
permission_definitions
member_permission_overrides, member_resource_scopes
invitations

CarBadMV operational

cb_bookings, cb_booking_addons
cb_catering_categories, cb_catering_inquiries, cb_catering_items, cb_catering_order_items, cb_catering_orders
cb_client_interactions, cb_clients
cb_event_addons, cb_event_packages
cb_inventory_items, cb_inventory_log
cb_invoice_items, cb_invoices
cb_prep_tasks
cb_proposal_items, cb_proposals
cb_rental_booking_items, cb_rental_bookings, cb_rental_items
cb_staff_shifts

Advertising and marketing internals

ad_campaigns, ad_sets, ads
ad_clicks, ad_conversions, ad_impressions
advertiser_accounts
conversion_events
custom_audiences, lookalike_audiences
marketing_campaigns, marketing_campaign_recipients, marketing_templates
crm_segments, crm_segment_members

Tournament operational (organizer-private)

tournament_announcements
tournament_decklists (deck submissions are private)
tournament_issues
tournament_organizer_requests
tournament_preregistrations
tournament_registration_codes
organizer_requests

Wizard private data

guide_conversations, guide_messages, guide_interactions_feedback
guide_tools

Other internal

analytics_events
recruitment_applications
inventory
menu_items
promo_codes

Category B — Public-readable (anon SELECT only)
Tournament public-facing

tournaments
tournament_phases, tournament_matches, tournament_rounds, round_pairings
tournament_results
tournament_player_stats
tournament_participants, tournament_registrations, registrations
tournament_sponsors
tournament_streams, tournament_vods
bracket_nodes, brackets
external_tournaments

Public content

events, event_calendar
news_articles, news_categories
pricing_plans, pricing_plan_features
games
sponsors
categories

Public player/team data

players
teams, team_members
pools, pool_members
social_links
game_leaderboards, leaderboard_entries
rating_history
player_follows

Public streams/media

live_events, livestreams
stream_sources
stream_vods, vod_chapters, vod_timestamps
stream_chat_messages (viewable during live stream)
player_media
player_streams
user_media
media_views, media_view_events
media_comments, media_reactions, reaction_aggregates
highlight_candidates
stream_clips
content_items, content_interactions

Forum reads

forum_threads, forum_replies

Wizard help content

guide_categories, guide_articles, guide_article_chunks, guide_ui_contexts

Tickets (public-facing prices)

ticket_types

Category C — Anon INSERT only

contact_submissions

Category D — Authenticated only (no anon access)
User-owned data

profiles
user_preferences
user_streams
notification_preferences
notifications

Match data (live, authenticated users for write)

matches
match_chat_messages
match_engagement_events
match_game_results
match_overlay_events, match_overlays
match_predictions
match_reactions, match_reaction_counts
match_viewers, match_viewer_sessions

Community (members only)

community_messages
community_moderators
community_room_members
community_rooms

Streaming operational (broadcaster's own configs)

stream_assets
stream_clips_buffer
stream_destinations
stream_layouts
stream_rooms
stream_sessions
stream_slots
stream_viewers
studio_audio_tracks, studio_hotkeys, studio_outputs, studio_overlays
studio_presets, studio_replay_buffer
studio_scene_items, studio_scenes, studio_sessions, studio_sources
broadcast_outputs, broadcast_scene_items, broadcast_scenes, broadcast_sessions, broadcast_sources
multistream_destinations

Tickets (purchase flow, user-owned)

tickets
ticket_orders, ticket_order_items
ticket_check_ins

Orders

orders, order_items

Feed (user-personalized)

feed_cache, feed_interactions, feed_sessions

Misc authenticated-only

clip_jobs
issue_comments
offline_sync_queue

Migration batch plan (preview)
Once you confirm the categorization above, the migration batches will be:
Batch 0 (urgent — same day): Enable RLS on the 10 disabled tables. Add minimum policies. Migration: 20260519_007_enable_rls_disabled_tables.sql
Batch 1 (financial lockdown): REVOKE anon on all Category A financial + views. Migration: 20260519_008_revoke_anon_financial.sql
Batch 2 (compliance + admin lockdown): REVOKE anon on Category A compliance and admin tables. Migration: 20260519_009_revoke_anon_admin_compliance.sql
Batch 3 (tenant + carbadmv + ads lockdown): REVOKE anon on Category A tenant/CB/ads tables. Migration: 20260519_010_revoke_anon_tenant_cb_ads.sql
Batch 4 (category D — authenticated-only): REVOKE anon on all Category D tables. Migration: 20260519_011_revoke_anon_authenticated_only.sql
Batch 5 (category B — set to SELECT only): REVOKE all from anon then GRANT SELECT. Migration: 20260519_012_anon_select_only_public.sql
Batch 6 (category C — INSERT only): REVOKE all then GRANT INSERT. Migration: 20260519_013_anon_insert_only_forms.sql
Each batch wrapped in BEGIN/COMMIT. After each batch, smoke test the app for broken pages before proceeding.
