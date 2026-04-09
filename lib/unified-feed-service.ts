"use server"

import { createClient } from "@/lib/supabase/server"
import { runAdAuction, type AuctionContext } from "@/lib/ads-auction-engine"

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED FEED SERVICE
// Merges clips, live matches, VODs, and ads into ONE scrollable experience
// ═══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

export type FeedItemType = "clip" | "live_match" | "vod" | "ad" | "tournament"

export interface UnifiedFeedItem {
  id: string
  type: FeedItemType
  
  // Common fields
  title: string
  description?: string
  media_url?: string
  thumbnail_url?: string
  duration_seconds?: number
  
  // Creator/Source
  creator_id?: string
  creator_name?: string
  creator_avatar?: string
  
  // Game context
  game_id?: string
  game_name?: string
  game_logo?: string
  
  // Tournament context
  tournament_id?: string
  tournament_name?: string
  
  // Engagement metrics
  view_count: number
  like_count: number
  comment_count: number
  
  // Ranking metadata
  score: number
  ranking_reason: string
  is_live: boolean
  
  // Ad-specific fields
  ad_data?: {
    click_url: string
    headline?: string
    primary_text?: string
    call_to_action?: string
    advertiser_id: string
    impression_id: string
  }
  
  // Timestamps
  created_at: string
}

export interface FeedOptions {
  limit?: number
  offset?: number
  gameFilter?: string
  userId?: string | null
  sessionId?: string
  includeAds?: boolean
  adFrequency?: number  // Insert ad every N items
  boostLive?: boolean
  boostGames?: string[]
  avoidGames?: string[]
}

export interface FeedResult {
  items: UnifiedFeedItem[]
  hasMore: boolean
  sessionId: string
  meta: {
    strategy: string
    liveCount: number
    clipCount: number
    vodCount: number
    adCount: number
  }
}

// ══════════════════════════════════════════
// RANKING WEIGHTS
// ══════════════════════════════════════════

const WEIGHTS = {
  // Engagement (35%)
  view_velocity: 0.12,      // Views per hour
  like_rate: 0.10,
  completion_rate: 0.08,
  share_rate: 0.05,
  
  // Freshness & Momentum (25%)
  freshness: 0.10,
  momentum: 0.10,
  trending: 0.05,
  
  // Personalization (25%)
  game_affinity: 0.10,
  creator_affinity: 0.10,
  followed_creator: 0.05,
  
  // Content Type (15%)
  live_boost: 0.10,         // Live content gets priority
  vod_quality: 0.05,
}

// ══════════════════════════════════════════
// CORE FEED GENERATION
// ══════════════════════════════════════════

/**
 * Get unified feed combining all content types
 */
export async function getUnifiedFeed(options: FeedOptions = {}): Promise<FeedResult> {
  const {
    limit = 20,
    offset = 0,
    gameFilter,
    userId,
    sessionId = generateSessionId(),
    includeAds = true,
    adFrequency = 5,
    boostLive = true,
    boostGames = [],
    avoidGames = [],
  } = options

  const supabase = await createClient()
  
  // Fetch all content types in parallel
  const [clips, liveMatches, vods, userPrefs] = await Promise.all([
    fetchClips(supabase, { gameFilter, limit: limit * 2, avoidGames }),
    fetchLiveMatches(supabase, { gameFilter, avoidGames }),
    fetchVods(supabase, { gameFilter, limit: Math.floor(limit / 2), avoidGames }),
    userId ? fetchUserPreferences(supabase, userId) : null,
  ])

  // Merge and score all content
  const allContent: UnifiedFeedItem[] = [
    ...clips.map(c => transformClip(c)),
    ...liveMatches.map(m => transformLiveMatch(m)),
    ...vods.map(v => transformVod(v)),
  ]

  // Score and rank
  const scoredContent = allContent
    .map(item => ({
      ...item,
      score: calculateUnifiedScore(item, userPrefs, { boostLive, boostGames }),
    }))
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score)

  // Apply content type distribution rules
  const distributedFeed = applyDistributionRules(scoredContent, {
    maxConsecutiveSameType: 3,
    liveFirst: boostLive && liveMatches.length > 0,
  })

  // Slice for pagination
  const paginatedFeed = distributedFeed.slice(offset, offset + limit)

  // Inject ads if enabled
  let finalFeed = paginatedFeed
  let adCount = 0
  
  if (includeAds) {
    const feedWithAds = await injectAds(paginatedFeed, {
      userId,
      sessionId,
      adFrequency,
      gameId: gameFilter,
    })
    finalFeed = feedWithAds.feed
    adCount = feedWithAds.adCount
  }

  // Track session
  await updateFeedSession(supabase, sessionId, userId || null, {
    itemsServed: finalFeed.length,
    liveCount: liveMatches.length,
    clipCount: clips.length,
    vodCount: vods.length,
  })

  return {
    items: finalFeed,
    hasMore: distributedFeed.length > offset + limit,
    sessionId,
    meta: {
      strategy: userId ? "personalized" : "cold_start",
      liveCount: finalFeed.filter(i => i.type === "live_match").length,
      clipCount: finalFeed.filter(i => i.type === "clip").length,
      vodCount: finalFeed.filter(i => i.type === "vod").length,
      adCount,
    },
  }
}

// ══════════════════════════════════════════
// CONTENT FETCHERS
// ══════════════════════════════════════════

async function fetchClips(
  supabase: any, 
  options: { gameFilter?: string; limit: number; avoidGames: string[] }
) {
  let query = supabase
    .from("player_media")
    .select(`
      id,
      title,
      description,
      media_url,
      thumbnail_url,
      duration_seconds,
      player_id,
      game_id,
      tournament_id,
      view_count,
      like_count,
      comment_count,
      trending_score,
      momentum_score,
      created_at,
      players!player_media_player_id_fkey(id, username, profile_image_url),
      games!player_media_game_id_fkey(id, name, logo_url)
    `)
    .in("media_type", ["highlight", "clip", "video"])
    .eq("status", "active")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(options.limit)

  if (options.gameFilter) {
    query = query.eq("game_id", options.gameFilter)
  }

  if (options.avoidGames.length > 0) {
    query = query.not("game_id", "in", `(${options.avoidGames.join(",")})`)
  }

  const { data } = await query
  return data || []
}

async function fetchLiveMatches(
  supabase: any,
  options: { gameFilter?: string; avoidGames: string[] }
) {
  let query = supabase
    .from("matches")
    .select(`
      id,
      round,
      status,
      scheduled_time,
      team_1:teams!matches_team_1_id_fkey(id, name, logo_url),
      team_2:teams!matches_team_2_id_fkey(id, name, logo_url),
      tournament:tournaments!matches_tournament_id_fkey(
        id, name, logo_url, game_id,
        games!tournaments_game_id_fkey(id, name, logo_url)
      ),
      feature_matches(stream_url, thumbnail_url, viewer_count)
    `)
    .eq("status", "in_progress")

  const { data } = await query
  
  let matches = data || []
  
  // Filter by game
  if (options.gameFilter) {
    matches = matches.filter((m: any) => m.tournament?.game_id === options.gameFilter)
  }
  
  if (options.avoidGames.length > 0) {
    matches = matches.filter((m: any) => !options.avoidGames.includes(m.tournament?.game_id))
  }

  return matches
}

async function fetchVods(
  supabase: any,
  options: { gameFilter?: string; limit: number; avoidGames: string[] }
) {
  let query = supabase
    .from("vod_archives")
    .select(`
      id,
      title,
      description,
      stream_url,
      thumbnail_url,
      duration_minutes,
      view_count,
      created_at,
      tournament:tournaments!vod_archives_tournament_id_fkey(
        id, name, logo_url, game_id,
        games!tournaments_game_id_fkey(id, name, logo_url)
      )
    `)
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(options.limit)

  const { data } = await query
  
  let vods = data || []
  
  if (options.gameFilter) {
    vods = vods.filter((v: any) => v.tournament?.game_id === options.gameFilter)
  }
  
  if (options.avoidGames.length > 0) {
    vods = vods.filter((v: any) => !options.avoidGames.includes(v.tournament?.game_id))
  }

  return vods
}

async function fetchUserPreferences(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .single()
  
  return data
}

// ══════════════════════════════════════════
// TRANSFORMERS
// ══════════════════════════════════════════

function transformClip(clip: any): UnifiedFeedItem {
  return {
    id: clip.id,
    type: "clip",
    title: clip.title || "Untitled Clip",
    description: clip.description,
    media_url: clip.media_url,
    thumbnail_url: clip.thumbnail_url,
    duration_seconds: clip.duration_seconds,
    creator_id: clip.player_id,
    creator_name: clip.players?.username,
    creator_avatar: clip.players?.profile_image_url,
    game_id: clip.game_id,
    game_name: clip.games?.name,
    game_logo: clip.games?.logo_url,
    tournament_id: clip.tournament_id,
    view_count: clip.view_count || 0,
    like_count: clip.like_count || 0,
    comment_count: clip.comment_count || 0,
    score: 0,
    ranking_reason: "trending",
    is_live: false,
    created_at: clip.created_at,
  }
}

function transformLiveMatch(match: any): UnifiedFeedItem {
  const featureMatch = match.feature_matches?.[0]
  const team1Name = match.team_1?.name || "TBD"
  const team2Name = match.team_2?.name || "TBD"
  
  return {
    id: match.id,
    type: "live_match",
    title: `${team1Name} vs ${team2Name}`,
    description: `Round ${match.round} - ${match.tournament?.name}`,
    media_url: featureMatch?.stream_url,
    thumbnail_url: featureMatch?.thumbnail_url,
    creator_id: undefined,
    creator_name: match.tournament?.name,
    creator_avatar: match.tournament?.logo_url,
    game_id: match.tournament?.game_id,
    game_name: match.tournament?.games?.name,
    game_logo: match.tournament?.games?.logo_url,
    tournament_id: match.tournament?.id,
    tournament_name: match.tournament?.name,
    view_count: featureMatch?.viewer_count || 0,
    like_count: 0,
    comment_count: 0,
    score: 0,
    ranking_reason: "live",
    is_live: true,
    created_at: match.scheduled_time,
  }
}

function transformVod(vod: any): UnifiedFeedItem {
  return {
    id: vod.id,
    type: "vod",
    title: vod.title || "Match VOD",
    description: vod.description,
    media_url: vod.stream_url,
    thumbnail_url: vod.thumbnail_url,
    duration_seconds: (vod.duration_minutes || 0) * 60,
    creator_id: undefined,
    creator_name: vod.tournament?.name,
    creator_avatar: vod.tournament?.logo_url,
    game_id: vod.tournament?.game_id,
    game_name: vod.tournament?.games?.name,
    game_logo: vod.tournament?.games?.logo_url,
    tournament_id: vod.tournament?.id,
    tournament_name: vod.tournament?.name,
    view_count: vod.view_count || 0,
    like_count: 0,
    comment_count: 0,
    score: 0,
    ranking_reason: "vod",
    is_live: false,
    created_at: vod.created_at,
  }
}

// ══════════════════════════════════════════
// SCORING ALGORITHM
// ══════════════════════════════════════════

function calculateUnifiedScore(
  item: UnifiedFeedItem,
  userPrefs: any | null,
  options: { boostLive: boolean; boostGames: string[] }
): number {
  let score = 0
  
  // Engagement score
  const views = Math.max(item.view_count, 1)
  const likeRate = item.like_count / views
  score += likeRate * WEIGHTS.like_rate * 100
  
  // View velocity (views per hour since creation)
  const hoursOld = Math.max(1, (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60))
  const viewVelocity = item.view_count / hoursOld
  score += Math.min(viewVelocity / 100, 1) * WEIGHTS.view_velocity
  
  // Freshness decay (half-life of 24 hours)
  const freshnessDecay = Math.pow(0.5, hoursOld / 24)
  score += freshnessDecay * WEIGHTS.freshness
  
  // Live content boost
  if (item.is_live && options.boostLive) {
    score += WEIGHTS.live_boost * 2  // Double weight for live
  }
  
  // Game affinity
  if (userPrefs && item.game_id && userPrefs.game_affinities?.[item.game_id]) {
    score += userPrefs.game_affinities[item.game_id] * WEIGHTS.game_affinity
  }
  
  // Creator affinity
  if (userPrefs && item.creator_id && userPrefs.creator_affinities?.[item.creator_id]) {
    score += userPrefs.creator_affinities[item.creator_id] * WEIGHTS.creator_affinity
  }
  
  // Following boost
  if (userPrefs && item.creator_id && userPrefs.favorite_creators?.includes(item.creator_id)) {
    score += WEIGHTS.followed_creator
  }
  
  // Boosted games from session
  if (item.game_id && options.boostGames.includes(item.game_id)) {
    score *= 1.5
  }
  
  return score
}

// ══════════════════════════════════════════
// DISTRIBUTION RULES
// ══════════════════════════════════════════

function applyDistributionRules(
  items: UnifiedFeedItem[],
  options: { maxConsecutiveSameType: number; liveFirst: boolean }
): UnifiedFeedItem[] {
  const result: UnifiedFeedItem[] = []
  const remaining = [...items]
  
  // If live first, put live content at top
  if (options.liveFirst) {
    const liveItems = remaining.filter(i => i.is_live)
    liveItems.forEach(item => {
      result.push(item)
      remaining.splice(remaining.indexOf(item), 1)
    })
  }
  
  // Interleave rest to avoid consecutive same types
  let consecutiveCount = 0
  let lastType: FeedItemType | null = result.length > 0 ? result[result.length - 1].type : null
  
  while (remaining.length > 0) {
    // Find next item that's different type if we've hit max consecutive
    let nextIdx = 0
    if (consecutiveCount >= options.maxConsecutiveSameType) {
      const differentTypeIdx = remaining.findIndex(i => i.type !== lastType)
      if (differentTypeIdx !== -1) {
        nextIdx = differentTypeIdx
      }
    }
    
    const nextItem = remaining[nextIdx]
    result.push(nextItem)
    remaining.splice(nextIdx, 1)
    
    if (nextItem.type === lastType) {
      consecutiveCount++
    } else {
      consecutiveCount = 1
      lastType = nextItem.type
    }
  }
  
  return result
}

// ══════════════════════════════════════════
// ADS INJECTION
// ══════════════════════════════════════════

async function injectAds(
  feed: UnifiedFeedItem[],
  options: { userId?: string | null; sessionId: string; adFrequency: number; gameId?: string }
): Promise<{ feed: UnifiedFeedItem[]; adCount: number }> {
  const result: UnifiedFeedItem[] = []
  let adCount = 0
  
  for (let i = 0; i < feed.length; i++) {
    result.push(feed[i])
    
    // Insert ad every N items
    if ((i + 1) % options.adFrequency === 0) {
      const auctionContext: AuctionContext = {
        placement: "clip_feed",
        user_id: options.userId || undefined,
        game_id: options.gameId || feed[i].game_id,
      }
      
      try {
        const auctionResult = await runAdAuction(auctionContext)
        
        if (auctionResult.winner) {
          result.push({
            id: auctionResult.auction_id,
            type: "ad",
            title: auctionResult.winner.headline || "Sponsored",
            description: auctionResult.winner.primary_text,
            media_url: auctionResult.winner.media_url,
            thumbnail_url: auctionResult.winner.thumbnail_url,
            view_count: 0,
            like_count: 0,
            comment_count: 0,
            score: 0,
            ranking_reason: "sponsored",
            is_live: false,
            created_at: new Date().toISOString(),
            ad_data: {
              click_url: auctionResult.winner.click_url,
              headline: auctionResult.winner.headline,
              primary_text: auctionResult.winner.primary_text,
              call_to_action: auctionResult.winner.call_to_action,
              advertiser_id: auctionResult.winner.advertiser_id,
              impression_id: auctionResult.auction_id,
            },
          })
          adCount++
        }
      } catch (error) {
        // Silently fail - no ad is fine
        console.error("Ad auction failed:", error)
      }
    }
  }
  
  return { feed: result, adCount }
}

// ══════════════════════════════════════════
// SESSION MANAGEMENT
// ══════════════════════════════════════════

async function updateFeedSession(
  supabase: any,
  sessionId: string,
  userId: string | null,
  stats: { itemsServed: number; liveCount: number; clipCount: number; vodCount: number }
) {
  await supabase
    .from("feed_sessions")
    .upsert({
      session_id: sessionId,
      user_id: userId,
      last_activity_at: new Date().toISOString(),
    }, { onConflict: "session_id" })
}

function generateSessionId(): string {
  return `fs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// ══════════════════════════════════════════
// INTERACTION TRACKING
// ══════════════════════════════════════════

/**
 * Track user interaction with feed item
 */
export async function trackFeedInteraction(
  itemType: FeedItemType,
  itemId: string,
  action: string,
  options: {
    userId?: string | null
    sessionId: string
    watchDurationSeconds?: number
    watchPercentage?: number
    positionInFeed?: number
  }
) {
  const supabase = await createClient()
  
  await supabase.from("feed_interactions").insert({
    user_id: options.userId,
    session_id: options.sessionId,
    item_type: itemType,
    item_id: itemId,
    action,
    watch_duration_seconds: options.watchDurationSeconds,
    watch_percentage: options.watchPercentage,
    position_in_feed: options.positionInFeed,
    feed_session_id: options.sessionId,
  })
  
  // Update session preferences based on interaction
  if (action === "skip") {
    await updateSessionAvoidance(supabase, options.sessionId, itemType, itemId)
  } else if (action === "like" || (action === "view" && (options.watchPercentage || 0) > 80)) {
    await updateSessionBoost(supabase, options.sessionId, itemType, itemId)
  }
}

async function updateSessionAvoidance(supabase: any, sessionId: string, itemType: string, itemId: string) {
  // Get the game from the item and add to avoided games
  // Implementation depends on item type
}

async function updateSessionBoost(supabase: any, sessionId: string, itemType: string, itemId: string) {
  // Get the game from the item and add to boosted games
  // Implementation depends on item type
}
