# Schema Inventory and Consolidation Plan

**Status:** Living document. Updated as consolidation tasks complete.  
**Source of truth for:** What every existing table is for, who owns it, and what's happening to it.

**Status legend:**
- **KEEP** — table is correct, stays as-is, possibly moves to a module schema
- **CONSOLIDATE→X** — duplicate; data being merged into X, this table will be dropped
- **DROP** — table is fictional, redundant, or premature; will be dropped
- **DEFER** — keep but mark module as disabled-until-post-August
- **NEW** — does not yet exist; needs to be created

When a table's status changes, update this document in the same commit
as the migration.

---

## core (foundation, all modules depend on it)

| Table | Status | Notes |
|---|---|---|
| profiles | KEEP | Move to `core.profiles`. Drop `is_admin`, `role` columns; derive from organization_members. | dd claim_status enum(claimed,shadow,merged), cardeio_player_id text, shadow_email text. Partial unique index on (shadow_email) WHERE claim_status = 'shadow' to prevent duplicate shadows. Discord OAuth claim flow merges shadow → claimed in a single transaction (see T-116 below). |
| tenants | KEEP | Move to `core.tenants`. |
| organization_members | KEEP | Move to `core.organization_members`. **Authoritative auth table.** |
| organization_role_templates | KEEP | Move to `core.organization_role_templates`. |
| organization_invitations | KEEP | Move to `core.organization_invitations`. |
| permission_definitions | KEEP | Move to `core.permission_definitions`. |
| role_template_permissions | KEEP | Move to `core.role_template_permissions`. |
| member_permission_overrides | KEEP | Move to `core.member_permission_overrides`. |
| member_resource_scopes | KEEP | Move to `core.member_resource_scopes`. |
| tenant_memberships | CONSOLIDATE→organization_members | Migrate rows; drop. |
| staff_roles | CONSOLIDATE→organization_members | Migrate rows with role_key mapping; drop. |
| tenant_features | KEEP | Move to `core.tenant_features`. Critical for module gating. |
| feature_definitions | KEEP | Move to `core.feature_definitions`. |
| feature_usage_log | KEEP | Move to `core.feature_usage_log`. |
| pricing_plans | KEEP | Move to `core.pricing_plans`. |
| pricing_plan_features | KEEP | Move to `core.pricing_plan_features`. |
| subscriptions | KEEP | Move to `core.subscriptions`. |
| invoices | KEEP | Move to `core.invoices` (SaaS billing, distinct from cb_invoices). |
| billing_events | KEEP | Move to `core.billing_events`. |
| payment_methods | KEEP | Move to `core.payment_methods`. |
| usage_records | KEEP | Move to `core.usage_records`. |
| api_keys | KEEP | Move to `integrations.api_keys` (cleaner home). |
| api_request_log | KEEP | Move to `integrations.api_request_log`. |
| **financial_intents** | NEW | Spec'd in ARCHITECTURE.md §7. Build in T-005. |
| ledger_accounts | KEEP | Move to `core.ledger_accounts`. Becomes source of truth for balances. |
| ledger_transactions | KEEP | Move to `core.ledger_transactions`. |
| ledger_entries | KEEP | Move to `core.ledger_entries`. Add balanced-transaction trigger. |
| financial_transactions | CONSOLIDATE→ledger | Read model only after consolidation. Stop writing as source of truth. |
| financial_alerts | KEEP | Move to `core.financial_alerts`. Fix INSERT policy in T-004. |
| user_wallets | CONSOLIDATE→ledger | Becomes a view over ledger entries. |
| wallets | DROP | Duplicate of user_wallets, RLS off. Migrate any rows, then drop. |
| wallet_transactions | CONSOLIDATE→ledger | Becomes view; old table dropped after migration. |
| dismissed_stripe_payments | DROP | Code smell. Reconciliation should obviate it. Drop after audit confirms 0 rows. |
| reconciliation_audit_log | KEEP | Move to `core.reconciliation_audit_log`. Make append-only. |
| **audit_log** | NEW | Single canonical audit log. Build in T-012. |
| access_audit_log | KEEP | Move to `core.access_audit_log`. Make append-only. Distinct from general audit_log (this is access-control specific). |
| outbox | KEEP | Move to `core.outbox`. Wire to a worker. |
| kyc_sessions | KEEP | Move to `core.kyc_sessions`. |
| kyc_verifications | KEEP | Move to `core.kyc_verifications`. |
| tax_forms | KEEP | Move to `core.tax_forms`. |
| aml_transaction_logs | KEEP | Move to `core.aml_transaction_logs`. |
| compliance_alerts | KEEP | Move to `core.compliance_alerts`. |
| notifications | KEEP | Move to `core.notifications`. Fix INSERT policy in T-004. |
| notification_preferences | KEEP | Move to `core.notification_preferences`. |
| user_preferences | KEEP | Move to `core.user_preferences`. |
| user_restrictions | KEEP | Move to `core.user_restrictions`. |
| invitations | KEEP | Move to `core.invitations` (general invites, distinct from organization_invitations). |
| access_requests | KEEP | Move to `core.access_requests`. |
| analytics_events | KEEP | Move to `metrics.events`. Fix forgery vector in T-004. |
| platform_metrics | KEEP | Move to `metrics.platform_metrics`. |
| realtime_metrics | KEEP | Move to `metrics.realtime_metrics`. |
| site_settings | KEEP | Move to `core.site_settings`. |
| social_links | KEEP | Move to `core.social_links`. |

## tournament

| Table | Status | Notes |
|---|---|---|
| tournaments | KEEP | Move to `tournament.tournaments`. Drop redundant `type` column (keep `format`). |
| tournament_phases | KEEP | Move to `tournament.phases`. |
| tournament_rounds | KEEP | Move to `tournament.rounds`. |
| tournament_matches | KEEP | Move to `tournament.matches`. **Canonical match table.** |
| tournament_participants | KEEP | Move to `tournament.participants`. |
| tournament_registrations | KEEP | Move to `tournament.registrations`. **Canonical registration table.** |
| tournament_preregistrations | KEEP | Move to `tournament.preregistrations`. |
| tournament_registration_codes | KEEP | Move to `tournament.registration_codes`. |
| tournament_decklists | KEEP | Move to `tournament.decklists`. |
| tournament_player_stats | KEEP | Move to `tournament.player_stats`. |
| tournament_results | KEEP | Move to `tournament.results`. |
| tournament_issues | KEEP | Move to `tournament.issues`. |
| tournament_announcements | KEEP | Move to `tournament.announcements`. |
| tournament_organizer_requests | KEEP | Move to `tournament.organizer_requests`. |
| tournament_payments | CONSOLIDATE→financial_intents + ledger | Read model after consolidation. |
| tournament_payouts | CONSOLIDATE→financial_intents + ledger | Read model. |
| tournament_sponsors | KEEP | Move to `tournament.sponsors`. |
| games | KEEP | Move to `tournament.games`. |
| matches | DROP | Duplicate of tournament_matches. Migrate FKs (brackets, bracket_nodes), then drop. |
| registrations | DROP | Duplicate of tournament_registrations. Migrate any rows, drop. |
| players | DROP | Duplicate participant model. Drop after FK migration. |
| organizer_requests | DROP | Duplicate of tournament_organizer_requests. Drop. |
| brackets | KEEP | Move to `tournament.brackets`. Enable RLS in T-002. Repoint FK from matches → tournament_matches. |
| bracket_nodes | KEEP | Move to `tournament.bracket_nodes`. Enable RLS. |
| pools | KEEP | Move to `tournament.pools`. Enable RLS. |
| pool_members | KEEP | Move to `tournament.pool_members`. Enable RLS. |
| round_pairings | KEEP | Move to `tournament.round_pairings`. Enable RLS. |
| escrow_accounts | KEEP | Move to `tournament.escrow_accounts`. Becomes a read model over ledger after T-005. Tighten the "Public can view funded escrow" policy in T-006. |
| prize_distributions | KEEP | Move to `tournament.prize_distributions`. |
| organizer_payouts | CONSOLIDATE→financial_intents + ledger | Read model. |
| player_payouts | CONSOLIDATE→financial_intents + ledger | Read model. Fix OR-composition bug with trigger in T-007. |
| payout_methods | KEEP | Move to `core.payout_methods`. |
| payout_requests | KEEP | Move to `core.payout_requests`. Enable RLS via policies (currently RLS-on no-policies). |
| withdrawal_requests | KEEP | Move to `core.withdrawal_requests`. |
| leaderboard_entries | KEEP | Move to `tournament.leaderboard_entries`. |
| game_leaderboards | KEEP | Move to `tournament.game_leaderboards`. |
| rating_history | KEEP | Move to `tournament.rating_history`. |
| teams | KEEP | Move to `tournament.teams`. |
| team_members | KEEP | Move to `tournament.team_members`. |
| external_tournaments | KEEP | Move to `tournament.external_tournaments`. |
| offline_sync_queue | KEEP | Move to `tournament.offline_sync_queue`. |
| issue_comments | KEEP | Move to `tournament.issue_comments`. |

## broadcast

| Table | Status | Notes |
|---|---|---|
| broadcast_sessions | KEEP | Move to `broadcast.sessions`. **Canonical broadcast container.** |
| broadcast_scenes | KEEP | Move to `broadcast.scenes`. Scene slots reference participants by predicate (role, slot, kind), NOT by hardcoded room names or participant IDs. This is what lets the same scene engine handle co-located events (May 16) and remote events (post-May 16 topologies B/C/D) without code changes.|
| broadcast_scene_items | KEEP | Move to `broadcast.scene_items`. Scene slots reference participants by predicate (role, slot, kind), NOT by hardcoded room names or participant IDs. This is what lets the same scene engine handle co-located events (May 16) and remote events (post-May 16 topologies B/C/D) without code changes.d|
| broadcast_sources | KEEP | Move to `broadcast.sources`. |
| broadcast_outputs | KEEP | Move to `broadcast.outputs`. |
|broadcast.broadcasts| NEW| Replaces ad-hoc per-match broadcast records. One row per match-being-streamed. Holds livekit_room_name, mux_live_stream_id, mux_playback_id, status. Supersedes broadcast_sessions for match-scoped broadcasts; broadcast_sessions retained for non-match broadcasts (solo streams, between-event content).
broadcast.broadcast_participants |NEW | Who is in the LiveKit room and in what role. (broadcast_id, user_id) unique. Columns: role enum(player,caster,producer,observer), slot integer, joined_at, left_at. The slot field is independent of role — supports topologies with multiple casters, multiple observers, or per-player game-capture sources.
broadcast.broadcast_sources |NEW | What media tracks each participant publishes. Columns: broadcast_participant_id, kind enum(face_cam,game_capture,mic,screen_share,venue_cam), livekit_track_sid, label, published_at, unpublished_at. The scene engine references slots by (role, slot, kind) predicates, never by topology-specific names.
broadcast.egress_jobs |NEW | Tracks active LiveKit Egress sessions per broadcast. Columns: broadcast_id, livekit_egress_id, status enum(requested,active,stopping,stopped,failed), started_at, ended_at, last_error. Idempotency: at most one active row per broadcast, enforced by partial unique index.
broadcast.broadcast_destinations | NEW | Per-broadcast (or per-tournament) third-party simulcast targets. Encrypted RTMP URL + stream key. Replaces the older multistream_destinations and stream_destinations tables marked CONSOLIDATE→broadcast_outputs in current SCHEMA.md. Decision needed: per-broadcast (caster reconfigures each match) or per-tournament (organizer configures once)? Decision: per-tournament with a per-broadcast override flag. 
| stream_rooms | KEEP | Move to `broadcast.rooms`. |
| stream_sessions | CONSOLIDATE→broadcast_sessions | Migrate, drop. |
| stream_sources | CONSOLIDATE→broadcast_sources | Migrate, drop. Distinct from broadcast_sources only by feature, not concept. |
| stream_slots | DROP | Unclear use, no UI references. Audit then drop. |
| stream_assets | KEEP | Move to `broadcast.assets`. |
| stream_layouts | KEEP | Move to `broadcast.layouts`. |
| stream_destinations | CONSOLIDATE→broadcast_outputs | Migrate, drop. |
| multistream_destinations | CONSOLIDATE→broadcast_outputs | Migrate, drop. |
| user_streams | CONSOLIDATE→broadcast_sessions (with type='solo') | Personal streams become a session type. |
| livestreams | CONSOLIDATE→broadcast_sessions | Migrate, drop. |
| live_events | CONSOLIDATE→broadcast_sessions | Migrate, drop. |
| player_streams | KEEP | Move to `broadcast.player_streams`. Distinct: this is the per-player WebRTC slot in a multi-player room. |
| tournament_streams | CONSOLIDATE→broadcast_sessions | Tournament-level stream is just a broadcast session linked to a tournament. |
| stream_chat_messages | CONSOLIDATE→audience.chat_messages | Stream chat is audience-layer concern. |
| stream_viewers | CONSOLIDATE→audience.viewers | Same. |
| studio_sessions | CONSOLIDATE→broadcast_sessions | Decision: drop entire `studio_*` parallel system; keep `broadcast_*`. |
| studio_scenes | DROP | Use broadcast_scenes. |
| studio_scene_items | DROP | Use broadcast_scene_items. |
| studio_sources | DROP | Use broadcast_sources. |
| studio_overlays | CONSOLIDATE→audience.match_overlays | Overlays are audience-facing presentation. |
| studio_outputs | DROP | Use broadcast_outputs. |
| studio_audio_tracks | KEEP | Move to `broadcast.audio_tracks`. Audio mixing is broadcast concern. |
| studio_hotkeys | KEEP | Move to `broadcast.hotkeys`. Producer ergonomics. |
| studio_presets | KEEP | Move to `broadcast.presets`. |
| studio_replay_buffer | CONSOLIDATE→clips.replay_buffer | Replay buffer feeds clipping. |
| stream_clips | CONSOLIDATE→clips.clips | Clips live in clips module. |
| stream_clips_buffer | CONSOLIDATE→clips.replay_buffer | Same. |
| stream_vods | KEEP | Move to `broadcast.vods`. |
| tournament_vods | CONSOLIDATE→broadcast.vods (with tournament_id link) | Just VODs that link to tournaments. |
| vod_chapters | KEEP | Move to `broadcast.vod_chapters`. |
| vod_timestamps | CONSOLIDATE→vod_chapters | Same concept, less detailed. |
| allowed_embed_domains | KEEP | Move to `broadcast.allowed_embed_domains`. Or move to config; revisit. |

## audience

| Table | Status | Notes |
|---|---|---|
| match_chat_messages | KEEP | Move to `audience.chat_messages`. |
| match_reactions | KEEP | Move to `audience.reactions`. Fix forgery vector in T-004 (ensure user_id = auth.uid() in with_check). |
| match_reaction_counts | KEEP | Move to `audience.reaction_counts`. Maintained by trigger from reactions. |
| match_viewers | KEEP | Move to `audience.viewers`. Fix INSERT policy. |
| match_viewer_sessions | KEEP | Move to `audience.viewer_sessions`. |
| match_engagement_events | KEEP | Move to `audience.engagement_events`. Fix INSERT policy. |
| match_predictions | KEEP | Move to `audience.predictions`. |
| match_overlays | KEEP | Move to `audience.match_overlays`. |
| match_overlay_events | KEEP | Move to `audience.match_overlay_events`. |
| match_game_results | KEEP | Move to `audience.game_results`. |
| reaction_aggregates | KEEP | Move to `audience.reaction_aggregates`. |
| auto_feature_config | KEEP | Move to `audience.auto_feature_config`. |
| **audience.match_summary** | NEW | Read model: denormalized match + stream + scores. Built in T-026. |

## feed

| Table | Status | Notes |
|---|---|---|
| content_items | KEEP | Move to `feed.content_items`. |
| content_interactions | KEEP | Move to `feed.interactions`. |
| content_embeddings | KEEP | Move to `feed.embeddings`. Enable RLS (currently off). |
| feed_cache | KEEP | Move to `feed.cache`. Enable RLS. |
| feed_interactions | KEEP | Move to `feed.feed_interactions`. Enable RLS. |
| feed_sessions | KEEP | Move to `feed.sessions`. Enable RLS. |
| player_follows | KEEP | Move to `feed.follows`. Drop duplicate policy. |
| player_media | CONSOLIDATE→content_items | Audit which is the canonical content table; keep content_items. |
| user_media | CONSOLIDATE→content_items | Same. |
| media_comments | KEEP | Move to `feed.comments`. |
| media_reactions | KEEP | Move to `feed.media_reactions`. Drop duplicate policies. |
| media_reports | KEEP | Move to `ops.media_reports`. Moderation concern. |
| media_views | CONSOLIDATE→content_interactions | Same data, narrower table. |
| media_view_events | CONSOLIDATE→content_interactions | Same. |

## clips

| Table | Status | Notes |
|---|---|---|
| clip_jobs | KEEP | Move to `clips.jobs`. Enable RLS. **Needs worker — see T-038.** |
| highlight_candidates | KEEP | Move to `clips.highlight_candidates`. **Needs ML/heuristic detector — see T-040.** |
| **clips.replay_buffer** | NEW | Consolidates studio_replay_buffer + stream_clips_buffer. |
| **clips.clips** | NEW | Consolidates stream_clips. |

## venue

| Table | Status | Notes |
|---|---|---|
| events | KEEP | Move to `venue.events`. |
| ticket_types | KEEP | Move to `venue.ticket_types`. |
| tickets | KEEP | Move to `venue.tickets`. |
| ticket_orders | KEEP | Move to `venue.ticket_orders`. Becomes read model after financial_intents adoption. |
| ticket_order_items | KEEP | Move to `venue.ticket_order_items`. Enable RLS (currently RLS-on no-policies). |
| ticket_check_ins | KEEP | Move to `venue.ticket_check_ins`. |
| promo_codes | KEEP | Move to `venue.promo_codes`. |
| sponsors | KEEP | Move to `venue.sponsors` (or core if cross-event sponsor catalog). Decision T-018. |
| event_calendar | KEEP | Move to `venue.event_calendar`. |

## metrics

| Table | Status | Notes |
|---|---|---|
| analytics_events | KEEP | Already listed in core; really lives in `metrics.events`. |
| platform_metrics | KEEP | Already listed; lives in `metrics.platform_metrics`. |
| realtime_metrics | KEEP | Already listed; lives in `metrics.realtime_metrics`. |
| **metrics.sponsor_reports** | NEW | Sponsor-facing report rows. T-051. |
| **metrics.organizer_kpis** | NEW | Read model for organizer dashboard. T-052. |
| **metrics.live_dashboard** | NEW | Real-time aggregates for tenant dashboards. T-053. |

## integrations

| Table | Status | Notes |
|---|---|---|
| api_keys | KEEP | Already listed. |
| api_request_log | KEEP | Already listed. |
| **integrations.webhook_subscriptions** | NEW | Tenant-configured outbound webhooks. T-058. |
| **integrations.webhook_deliveries** | NEW | Delivery log + retry state. T-058. |

## ops

| Table | Status | Notes |
|---|---|---|
| moderation_reports | KEEP | Move to `ops.moderation_reports`. |
| moderation_actions | KEEP | Move to `ops.moderation_actions`. |
| moderation_logs | KEEP | Move to `ops.moderation_logs`. |
| moderation_alerts | KEEP | Move to `ops.moderation_alerts`. Enable RLS. |
| system_alerts | KEEP | Move to `ops.system_alerts`. |
| system_controls | KEEP | Move to `ops.system_controls`. |
| chaos_test_runs | KEEP | Move to `ops.chaos_test_runs`. |
| deployment_integrity_runs | KEEP | Move to `ops.deployment_integrity_runs`. |

## DEFERRED — disabled until post-Barbados

These modules' tables stay in the database but are gated by `tenant_features`
flags that default to false. No tenant has them enabled until explicitly
turned on. Module-specific RLS policies must check the feature flag.

### ads (DEFER all)

ad_campaigns, ad_sets, ads, ad_impressions, ad_clicks, ad_conversions,
advertiser_accounts, conversion_events, custom_audiences, lookalike_audiences

### catering (DEFER all)

cb_bookings, cb_booking_addons, cb_event_packages, cb_event_addons,
cb_catering_categories, cb_catering_items, cb_catering_orders,
cb_catering_order_items, cb_catering_inquiries, cb_rental_items,
cb_rental_bookings, cb_rental_booking_items, cb_inventory_items,
cb_inventory_log, cb_prep_tasks, cb_proposals, cb_proposal_items,
cb_invoices, cb_invoice_items, cb_staff_shifts, cb_clients,
cb_client_interactions, crm_segments, crm_segment_members,
marketing_campaigns, marketing_campaign_recipients, marketing_templates,
automation_rules, automation_logs

### commerce (DEFER all)

menu_items, categories, inventory, orders, order_items, points_transactions

### creator (DEFER all)

creator_earnings, platform_revenue (move to core for now since used in
metrics — re-evaluate post-launch)

### community (DEFER all)

forum_threads, forum_replies, community_rooms, community_room_members,
community_messages, community_moderators

## DROP — fictional, accidental, or duplicate

These get dropped in T-001:

ml_models, ml_feature_store, ml_scoring_history, treasury_snapshots,
treasury_rules, treasury_actions, financial_reports, organizer_cohorts,
plus their associated functions (compute_ml_features, ml_score_payout_risk,
capture_treasury_snapshot, check_treasury_rules, get_treasury_history,
generate_financial_report, get_investor_reports)

Also probable drops pending audit:
- recruitment_applications (not on any roadmap)
- contact_submissions (replace with proper inquiry handling in `core`)
- news_articles, news_categories (defer until content team exists)

## Export tables (audit then drop)

exports_participants_missing_registrations,
exports_registrations_missing_participants

These are reconciliation drift export tables. After consolidation of
registrations into one canonical model (T-024), these become unnecessary.
Verify 0 rows, then drop.

