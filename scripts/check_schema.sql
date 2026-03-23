-- Check tournament-related table columns
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN (
  'tournaments',
  'tournament_phases',
  'tournament_rounds',
  'tournament_matches',
  'tournament_registrations',
  'tournament_player_stats',
  'tournament_announcements'
)
ORDER BY table_name, ordinal_position;
