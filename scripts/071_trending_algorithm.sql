-- =============================================
-- UPGRADED TRENDING ALGORITHM
-- Weighted real-time scoring with recency decay
-- =============================================

-- Add new scoring columns to player_media
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS reactions_per_minute DECIMAL(10,4) DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS views_per_minute DECIMAL(10,4) DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS engagement_velocity DECIMAL(10,4) DEFAULT 0;
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMP WITH TIME ZONE;

-- Upgraded trending score calculation
-- Formula:
--   (view_count * 0.30) +
--   (like_count * 0.25) +
--   (comment_count * 0.15) +
--   (engagement_velocity * 0.20) +
--   (recency_bonus * 0.10)
--
-- With recency decay: 1 / (hours_since_created + 1)
-- And diversity penalty for creator spam

CREATE OR REPLACE FUNCTION calculate_trending_score(
  p_media_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  v_view_count INTEGER;
  v_like_count INTEGER;
  v_comment_count INTEGER;
  v_engagement_velocity DECIMAL;
  v_hours_since_created DECIMAL;
  v_recency_bonus DECIMAL;
  v_base_score DECIMAL;
  v_final_score DECIMAL;
BEGIN
  -- Get media stats
  SELECT 
    view_count,
    like_count,
    comment_count,
    engagement_velocity,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600
  INTO 
    v_view_count,
    v_like_count,
    v_comment_count,
    v_engagement_velocity,
    v_hours_since_created
  FROM player_media
  WHERE id = p_media_id;
  
  -- Calculate recency bonus (decays over time)
  v_recency_bonus := 100.0 / (v_hours_since_created + 1);
  
  -- Calculate base score with weights
  v_base_score := 
    (COALESCE(v_view_count, 0) * 0.30) +
    (COALESCE(v_like_count, 0) * 25 * 0.25) + -- likes weighted more per action
    (COALESCE(v_comment_count, 0) * 50 * 0.15) + -- comments weighted highest per action
    (COALESCE(v_engagement_velocity, 0) * 100 * 0.20) +
    (v_recency_bonus * 0.10);
  
  -- Apply logarithmic scaling for large numbers
  v_final_score := LOG(v_base_score + 1) * 100;
  
  RETURN v_final_score;
END;
$$ LANGUAGE plpgsql;

-- Function to update engagement velocity (call this periodically)
CREATE OR REPLACE FUNCTION update_engagement_velocity()
RETURNS void AS $$
BEGIN
  -- Calculate engagement velocity based on recent activity (last hour)
  UPDATE player_media pm
  SET 
    engagement_velocity = (
      SELECT COUNT(*)::DECIMAL / 60 -- per minute
      FROM (
        SELECT created_at FROM media_views WHERE media_id = pm.id AND created_at > NOW() - INTERVAL '1 hour'
        UNION ALL
        SELECT created_at FROM media_reactions WHERE media_id = pm.id AND created_at > NOW() - INTERVAL '1 hour'
        UNION ALL
        SELECT created_at FROM media_comments WHERE media_id = pm.id AND created_at > NOW() - INTERVAL '1 hour'
      ) recent_engagement
    ),
    reactions_per_minute = (
      SELECT COUNT(*)::DECIMAL / 60
      FROM media_reactions
      WHERE media_id = pm.id AND created_at > NOW() - INTERVAL '1 hour'
    ),
    views_per_minute = (
      SELECT COUNT(*)::DECIMAL / 60
      FROM media_views
      WHERE media_id = pm.id AND created_at > NOW() - INTERVAL '1 hour'
    ),
    last_engagement_at = (
      SELECT MAX(created_at)
      FROM (
        SELECT created_at FROM media_views WHERE media_id = pm.id
        UNION ALL
        SELECT created_at FROM media_reactions WHERE media_id = pm.id
        UNION ALL
        SELECT created_at FROM media_comments WHERE media_id = pm.id
      ) all_engagement
    )
  WHERE pm.created_at > NOW() - INTERVAL '7 days'; -- Only update recent media
END;
$$ LANGUAGE plpgsql;

-- Recalculate all trending scores
CREATE OR REPLACE FUNCTION recalculate_all_trending_scores()
RETURNS void AS $$
BEGIN
  -- First update velocities
  PERFORM update_engagement_velocity();
  
  -- Then recalculate scores
  UPDATE player_media
  SET trending_score = calculate_trending_score(id)
  WHERE created_at > NOW() - INTERVAL '30 days'
    AND visibility = 'public'
    AND moderation_status = 'approved';
END;
$$ LANGUAGE plpgsql;

-- Get diverse trending feed (max 2 per creator)
CREATE OR REPLACE FUNCTION get_diverse_trending_feed(
  p_limit INTEGER DEFAULT 20,
  p_cursor_id UUID DEFAULT NULL,
  p_cursor_score DECIMAL DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  player_id UUID,
  title TEXT,
  description TEXT,
  media_type TEXT,
  source_type TEXT,
  video_url TEXT,
  embed_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  game_id UUID,
  tournament_id UUID,
  visibility TEXT,
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  trending_score DECIMAL,
  is_featured BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  player_first_name TEXT,
  player_last_name TEXT,
  player_avatar_url TEXT,
  game_name TEXT,
  game_slug TEXT,
  row_num BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_media AS (
    SELECT 
      pm.*,
      p.first_name as player_first_name,
      p.last_name as player_last_name,
      p.avatar_url as player_avatar_url,
      g.name as game_name,
      g.slug as game_slug,
      ROW_NUMBER() OVER (PARTITION BY pm.player_id ORDER BY pm.trending_score DESC) as creator_rank
    FROM player_media pm
    LEFT JOIN profiles p ON p.id = pm.player_id
    LEFT JOIN games g ON g.id = pm.game_id
    WHERE pm.visibility = 'public'
      AND pm.moderation_status = 'approved'
      AND (
        p_cursor_id IS NULL 
        OR pm.trending_score < p_cursor_score 
        OR (pm.trending_score = p_cursor_score AND pm.id < p_cursor_id)
      )
  )
  SELECT 
    rm.id,
    rm.player_id,
    rm.title,
    rm.description,
    rm.media_type,
    rm.source_type,
    rm.video_url,
    rm.embed_url,
    rm.thumbnail_url,
    rm.duration_seconds,
    rm.game_id,
    rm.tournament_id,
    rm.visibility,
    rm.view_count,
    rm.like_count,
    rm.comment_count,
    rm.trending_score,
    rm.is_featured,
    rm.created_at,
    rm.player_first_name,
    rm.player_last_name,
    rm.player_avatar_url,
    rm.game_name,
    rm.game_slug,
    rm.creator_rank as row_num
  FROM ranked_media rm
  WHERE rm.creator_rank <= 2 -- Max 2 clips per creator
  ORDER BY rm.trending_score DESC, rm.id DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
