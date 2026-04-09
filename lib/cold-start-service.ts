"use server"

import { createClient } from "@/lib/supabase/server"

// ═══════════════════════════════════════════════════════════════════════════════
// COLD START SERVICE
// Intelligent feed for new users with no interaction history
// ═══════════════════════════════════════════════════════════════════════════════

const COLD_START_THRESHOLD = 20 // Events needed before ML kicks in

// ══════════════════════════════════════════
// COLD START DETECTION
// ══════════════════════════════════════════

/**
 * Check if user is in cold start phase
 */
export async function isUserColdStart(userId: string | null): Promise<boolean> {
  if (!userId) return true
  
  const supabase = await createClient()
  
  // Check event count
  const { count } = await supabase
    .from("analytics_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("event_name", ["clip_view", "clip_like", "watch_time"])
  
  return (count || 0) < COLD_START_THRESHOLD
}

/**
 * Get user's onboarding preferences
 */
export async function getUserOnboardingPrefs(userId: string | null) {
  if (!userId) return null
  
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("user_preferences")
    .select("games, intents, skill_level, onboarding_completed")
    .eq("user_id", userId)
    .single()
  
  return data
}

// ══════════════════════════════════════════
// COLD START FEED STRATEGIES
// ══════════════════════════════════════════

interface ColdStartClip {
  id: string
  title: string
  thumbnail_url: string
  media_url: string
  duration_seconds: number
  view_count: number
  like_count: number
  trending_score: number
  quality_score: number
  game_id: string
  creator: {
    id: string
    display_name: string
    avatar_url: string | null
  }
}

/**
 * Get cold start feed for new user
 */
export async function getColdStartFeed(
  userId: string | null,
  options: {
    limit?: number
    gameFilter?: string
  } = {}
): Promise<ColdStartClip[]> {
  const supabase = await createClient()
  const { limit = 20, gameFilter } = options
  
  // Get onboarding preferences if available
  const prefs = await getUserOnboardingPrefs(userId)
  const preferredGames = prefs?.games || []
  
  const feed: ColdStartClip[] = []
  
  // Strategy 1: Trending clips in preferred games (40%)
  const trendingCount = Math.floor(limit * 0.4)
  let trendingQuery = supabase
    .from("player_media")
    .select(`
      id, title, thumbnail_url, media_url, duration_seconds,
      view_count, like_count, trending_score, quality_score, game_id,
      player:players!player_media_player_id_fkey(id, gamertag, avatar_url)
    `)
    .eq("status", "approved")
    .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order("trending_score", { ascending: false })
    .limit(trendingCount)
  
  if (gameFilter) {
    trendingQuery = trendingQuery.eq("game_id", gameFilter)
  } else if (preferredGames.length > 0) {
    trendingQuery = trendingQuery.in("game_id", preferredGames)
  }
  
  const { data: trendingClips } = await trendingQuery
  
  if (trendingClips) {
    feed.push(...trendingClips.map(c => ({
      ...c,
      creator: {
        id: c.player?.id || "",
        display_name: c.player?.gamertag || "Unknown",
        avatar_url: c.player?.avatar_url || null,
      }
    })))
  }
  
  // Strategy 2: High quality clips (30%)
  const qualityCount = Math.floor(limit * 0.3)
  let qualityQuery = supabase
    .from("player_media")
    .select(`
      id, title, thumbnail_url, media_url, duration_seconds,
      view_count, like_count, trending_score, quality_score, game_id,
      player:players!player_media_player_id_fkey(id, gamertag, avatar_url)
    `)
    .eq("status", "approved")
    .gte("quality_score", 7)
    .order("view_count", { ascending: false })
    .limit(qualityCount)
  
  if (gameFilter) {
    qualityQuery = qualityQuery.eq("game_id", gameFilter)
  } else if (preferredGames.length > 0) {
    qualityQuery = qualityQuery.in("game_id", preferredGames)
  }
  
  const { data: qualityClips } = await qualityQuery
  
  if (qualityClips) {
    const existingIds = new Set(feed.map(c => c.id))
    feed.push(...qualityClips
      .filter(c => !existingIds.has(c.id))
      .map(c => ({
        ...c,
        creator: {
          id: c.player?.id || "",
          display_name: c.player?.gamertag || "Unknown",
          avatar_url: c.player?.avatar_url || null,
        }
      })))
  }
  
  // Strategy 3: Diverse mix from other games (20%)
  const diverseCount = Math.floor(limit * 0.2)
  let diverseQuery = supabase
    .from("player_media")
    .select(`
      id, title, thumbnail_url, media_url, duration_seconds,
      view_count, like_count, trending_score, quality_score, game_id,
      player:players!player_media_player_id_fkey(id, gamertag, avatar_url)
    `)
    .eq("status", "approved")
    .gte("view_count", 100)
    .order("created_at", { ascending: false })
    .limit(diverseCount)
  
  if (preferredGames.length > 0) {
    // Get clips from OTHER games to diversify
    diverseQuery = diverseQuery.not("game_id", "in", `(${preferredGames.join(",")})`)
  }
  
  const { data: diverseClips } = await diverseQuery
  
  if (diverseClips) {
    const existingIds = new Set(feed.map(c => c.id))
    feed.push(...diverseClips
      .filter(c => !existingIds.has(c.id))
      .map(c => ({
        ...c,
        creator: {
          id: c.player?.id || "",
          display_name: c.player?.gamertag || "Unknown",
          avatar_url: c.player?.avatar_url || null,
        }
      })))
  }
  
  // Strategy 4: Random fresh content (10%)
  const randomCount = Math.floor(limit * 0.1)
  const { data: randomClips } = await supabase
    .from("player_media")
    .select(`
      id, title, thumbnail_url, media_url, duration_seconds,
      view_count, like_count, trending_score, quality_score, game_id,
      player:players!player_media_player_id_fkey(id, gamertag, avatar_url)
    `)
    .eq("status", "approved")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(randomCount * 3) // Fetch more to shuffle
  
  if (randomClips) {
    const existingIds = new Set(feed.map(c => c.id))
    const shuffled = randomClips
      .filter(c => !existingIds.has(c.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, randomCount)
      .map(c => ({
        ...c,
        creator: {
          id: c.player?.id || "",
          display_name: c.player?.gamertag || "Unknown",
          avatar_url: c.player?.avatar_url || null,
        }
      }))
    feed.push(...shuffled)
  }
  
  // Shuffle final feed for variety while keeping some trending at top
  const topTrending = feed.slice(0, 3)
  const rest = feed.slice(3).sort(() => Math.random() - 0.5)
  
  return [...topTrending, ...rest].slice(0, limit)
}

// ══════════════════════════════════════════
// BOOST RULES FOR NEW CONTENT/CREATORS
// ══════════════════════════════════════════

interface BoostRule {
  type: "new_creator" | "new_content" | "tournament"
  multiplier: number
  durationHours: number
}

const BOOST_RULES: BoostRule[] = [
  { type: "new_creator", multiplier: 1.5, durationHours: 168 }, // 7 days
  { type: "new_content", multiplier: 1.3, durationHours: 24 },
  { type: "tournament", multiplier: 2.0, durationHours: 12 },
]

/**
 * Apply boost rules to clip scores
 */
function applyBoostRules(
  clip: ColdStartClip,
  creatorCreatedAt: Date,
  clipCreatedAt: Date,
  isFromTournament: boolean
): number {
  let boost = 1.0
  const now = Date.now()
  
  // New creator boost
  const creatorAgeHours = (now - creatorCreatedAt.getTime()) / (1000 * 60 * 60)
  const creatorRule = BOOST_RULES.find(r => r.type === "new_creator")!
  if (creatorAgeHours < creatorRule.durationHours) {
    boost *= creatorRule.multiplier
  }
  
  // New content boost
  const contentAgeHours = (now - clipCreatedAt.getTime()) / (1000 * 60 * 60)
  const contentRule = BOOST_RULES.find(r => r.type === "new_content")!
  if (contentAgeHours < contentRule.durationHours) {
    boost *= contentRule.multiplier
  }
  
  // Tournament boost
  if (isFromTournament) {
    const tournamentRule = BOOST_RULES.find(r => r.type === "tournament")!
    boost *= tournamentRule.multiplier
  }
  
  return boost
}

// ══════════════════════════════════════════
// UNIFIED FEED DECISION
// ══════════════════════════════════════════

/**
 * Get the appropriate feed based on user state
 */
export async function getSmartFeed(
  userId: string | null,
  options: {
    limit?: number
    gameFilter?: string
    feedType?: "foryou" | "following" | "trending"
  } = {}
) {
  const { limit = 20, gameFilter, feedType = "foryou" } = options
  
  // Check if user is in cold start
  const isColdStart = await isUserColdStart(userId)
  
  if (isColdStart || feedType === "trending") {
    // Use cold start strategy
    return {
      feed: await getColdStartFeed(userId, { limit, gameFilter }),
      strategy: "cold_start",
      isColdStart: true,
    }
  }
  
  // User has enough history - use ML ranking
  // This would call the ML service or local ranking
  const { getPersonalizedFeed } = await import("./ml-ranking-service")
  const feed = await getPersonalizedFeed(userId, {
    limit,
    gameFilter,
    explorationRate: 0.2,
  })
  
  return {
    feed,
    strategy: "ml_ranked",
    isColdStart: false,
  }
}
