"use server"

import { createClient } from "@/lib/supabase/server"

// ═══════════════════════════════════════════════════════════════════════════════
// ML RANKING SERVICE
// TikTok-level Content Ranking & Personalization
// ═══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

export interface RankingFeatures {
  // Engagement metrics
  watch_time_ratio: number     // actual / total duration
  completion_rate: number      // % who watched to end
  rewatch_count: number        // rewatches per view
  like_rate: number            // likes / views
  comment_rate: number         // comments / views
  share_rate: number           // shares / views
  
  // Creator signals
  creator_followed: boolean
  creator_verified: boolean
  
  // Content signals
  same_game: boolean
  matching_tags: number
  quality_score: number
  
  // Temporal signals
  trending_score: number
  momentum_score: number
  freshness_hours: number
}

export interface ContentItem {
  id: string
  creator_id: string
  content_type: string
  media_url: string
  thumbnail_url?: string
  duration_seconds?: number
  title?: string
  description?: string
  game_id?: string
  tournament_id?: string
  tags: string[]
  quality_score: number
  view_count: number
  like_count: number
  comment_count: number
  share_count: number
  trending_score: number
  momentum_score: number
  freshness_hours: number
  completion_rate: number
  avg_watch_percentage: number
}

export interface UserPreferences {
  user_id: string
  favorite_games: string[]
  favorite_creators: string[]
  blocked_creators: string[]
  game_affinities: Record<string, number>
  creator_affinities: Record<string, number>
  tag_affinities: Record<string, number>
  content_type_affinities: Record<string, number>
  preferred_content_length: "short" | "medium" | "long"
}

// ══════════════════════════════════════════
// RANKING ALGORITHM
// ══════════════════════════════════════════

// Feature weights (tunable)
const WEIGHTS = {
  // Engagement (40%)
  watch_time_ratio: 0.15,
  completion_rate: 0.10,
  like_rate: 0.08,
  share_rate: 0.07,
  
  // Quality & Popularity (25%)
  quality_score: 0.10,
  trending_score: 0.10,
  momentum_score: 0.05,
  
  // Personalization (25%)
  game_affinity: 0.12,
  creator_affinity: 0.08,
  followed_creator: 0.05,
  
  // Freshness (10%)
  freshness: 0.10,
}

/**
 * Calculate raw engagement score from content metrics
 */
function calculateEngagementScore(content: ContentItem): number {
  const views = Math.max(content.view_count, 1)
  
  const likeRate = content.like_count / views
  const commentRate = content.comment_count / views
  const shareRate = content.share_count / views
  
  return (
    (content.avg_watch_percentage / 100) * WEIGHTS.watch_time_ratio +
    content.completion_rate * WEIGHTS.completion_rate +
    likeRate * WEIGHTS.like_rate * 100 + // Scale up rates
    shareRate * WEIGHTS.share_rate * 200  // Shares weighted higher
  )
}

/**
 * Calculate personalization score based on user preferences
 */
function calculatePersonalizationScore(
  content: ContentItem, 
  prefs: UserPreferences | null
): number {
  if (!prefs) return 0.5 // Neutral for anonymous users
  
  let score = 0
  
  // Game affinity
  if (content.game_id && prefs.game_affinities[content.game_id]) {
    score += prefs.game_affinities[content.game_id] * WEIGHTS.game_affinity
  }
  
  // Creator affinity
  if (prefs.creator_affinities[content.creator_id]) {
    score += prefs.creator_affinities[content.creator_id] * WEIGHTS.creator_affinity
  }
  
  // Followed creator boost
  if (prefs.favorite_creators.includes(content.creator_id)) {
    score += WEIGHTS.followed_creator
  }
  
  // Tag matching
  const matchingTags = content.tags.filter(tag => 
    (prefs.tag_affinities[tag] || 0) > 0.5
  ).length
  score += Math.min(matchingTags * 0.02, 0.1)
  
  return score
}

/**
 * Calculate freshness score (decays over time)
 */
function calculateFreshnessScore(freshnessHours: number): number {
  // Half-life of 24 hours
  const decay = Math.pow(0.5, freshnessHours / 24)
  return decay * WEIGHTS.freshness
}

/**
 * Calculate final rank score for content
 */
export function calculateRankScore(
  content: ContentItem,
  prefs: UserPreferences | null
): number {
  // Check if blocked creator
  if (prefs?.blocked_creators.includes(content.creator_id)) {
    return -1 // Will be filtered out
  }
  
  const engagementScore = calculateEngagementScore(content)
  const personalizationScore = calculatePersonalizationScore(content, prefs)
  const freshnessScore = calculateFreshnessScore(content.freshness_hours)
  
  // Quality and trending scores from DB
  const qualityScore = content.quality_score * WEIGHTS.quality_score
  const trendingScore = Math.min(content.trending_score / 1000, 1) * WEIGHTS.trending_score
  const momentumScore = Math.min(content.momentum_score, 1) * WEIGHTS.momentum_score
  
  const totalScore = 
    engagementScore + 
    personalizationScore + 
    freshnessScore + 
    qualityScore + 
    trendingScore + 
    momentumScore
  
  return totalScore
}

// ══════════════════════════════════════════
// FEED GENERATION
// ══════════════════════════════════════════

/**
 * Get personalized feed for user
 */
export async function getPersonalizedFeed(
  userId: string | null,
  options: {
    limit?: number
    offset?: number
    explorationRate?: number
    gameFilter?: string
    contentType?: string
  } = {}
) {
  const supabase = await createClient()
  const { limit = 50, offset = 0, explorationRate = 0.2, gameFilter, contentType } = options
  
  // Get user preferences
  let prefs: UserPreferences | null = null
  if (userId) {
    const { data } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .single()
    prefs = data
  }
  
  // Build content query
  let query = supabase
    .from("content_items")
    .select(`
      *,
      creator:profiles!content_items_creator_id_fkey(id, display_name, avatar_url, verified)
    `)
    .eq("status", "active")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit * 3) // Fetch more for ranking pool
  
  if (gameFilter) {
    query = query.eq("game_id", gameFilter)
  }
  
  if (contentType) {
    query = query.eq("content_type", contentType)
  }
  
  // Filter out recently viewed content
  if (userId) {
    const { data: recentViews } = await supabase
      .from("content_interactions")
      .select("content_id")
      .eq("user_id", userId)
      .eq("interaction_type", "view")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(500)
    
    const viewedIds = (recentViews || []).map(v => v.content_id)
    if (viewedIds.length > 0) {
      query = query.not("id", "in", `(${viewedIds.join(",")})`)
    }
  }
  
  const { data: candidates, error } = await query
  
  if (error) {
    console.error("Failed to fetch content candidates:", error)
    return []
  }
  
  if (!candidates || candidates.length === 0) {
    return []
  }
  
  // Score and rank content
  const scoredContent = candidates
    .map(content => ({
      ...content,
      rankScore: calculateRankScore(content as ContentItem, prefs)
    }))
    .filter(c => c.rankScore >= 0) // Filter blocked creators
    .sort((a, b) => b.rankScore - a.rankScore)
  
  // Apply exploration vs exploitation
  const explorationCount = Math.floor(limit * explorationRate)
  const exploitationCount = limit - explorationCount
  
  // Top ranked content (exploitation)
  const exploited = scoredContent.slice(0, exploitationCount)
  
  // Random fresh content (exploration)
  const freshPool = candidates.filter(c => 
    c.freshness_hours < 48 && 
    !exploited.find(e => e.id === c.id)
  )
  const explored = shuffleArray(freshPool)
    .slice(0, explorationCount)
    .map(c => ({ ...c, rankScore: 0, isExploration: true }))
  
  // Combine and interleave
  const feed = interleaveArrays(exploited, explored)
    .slice(offset, offset + limit)
  
  return feed
}

/**
 * Get "For You" feed with mixed content
 */
export async function getForYouFeed(userId: string | null, limit: number = 20) {
  return getPersonalizedFeed(userId, {
    limit,
    explorationRate: 0.25,
  })
}

/**
 * Get "Following" feed (only followed creators)
 */
export async function getFollowingFeed(userId: string, limit: number = 20) {
  const supabase = await createClient()
  
  // Get followed creators
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("favorite_creators")
    .eq("user_id", userId)
    .single()
  
  if (!prefs?.favorite_creators?.length) {
    return []
  }
  
  const { data: content } = await supabase
    .from("content_items")
    .select(`
      *,
      creator:profiles!content_items_creator_id_fkey(id, display_name, avatar_url, verified)
    `)
    .in("creator_id", prefs.favorite_creators)
    .eq("status", "active")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit)
  
  return content || []
}

/**
 * Get "Trending" feed (highest momentum)
 */
export async function getTrendingFeed(
  options: { gameId?: string; limit?: number } = {}
) {
  const supabase = await createClient()
  const { gameId, limit = 20 } = options
  
  let query = supabase
    .from("content_items")
    .select(`
      *,
      creator:profiles!content_items_creator_id_fkey(id, display_name, avatar_url, verified)
    `)
    .eq("status", "active")
    .eq("visibility", "public")
    .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order("trending_score", { ascending: false })
    .limit(limit)
  
  if (gameId) {
    query = query.eq("game_id", gameId)
  }
  
  const { data } = await query
  return data || []
}

// ══════════════════════════════════════════
// USER PREFERENCES
// ══════════════════════════════════════════

/**
 * Get or create user preferences
 */
export async function getOrCreatePreferences(userId: string) {
  const supabase = await createClient()
  
  const { data: existing } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .single()
  
  if (existing) return existing
  
  const { data: created } = await supabase
    .from("user_preferences")
    .insert({
      user_id: userId,
      favorite_games: [],
      favorite_creators: [],
      blocked_creators: [],
      game_affinities: {},
      creator_affinities: {},
      tag_affinities: {},
      content_type_affinities: {},
    })
    .select()
    .single()
  
  return created
}

/**
 * Update user preferences based on interaction
 */
export async function updatePreferencesFromInteraction(
  userId: string,
  contentId: string,
  interactionType: "view" | "like" | "share" | "save",
  watchPercentage?: number
) {
  const supabase = await createClient()
  
  // Get content details
  const { data: content } = await supabase
    .from("content_items")
    .select("game_id, creator_id, tags, content_type")
    .eq("id", contentId)
    .single()
  
  if (!content) return
  
  // Get current preferences
  const prefs = await getOrCreatePreferences(userId)
  if (!prefs) return
  
  // Calculate affinity delta based on interaction
  let delta = 0
  switch (interactionType) {
    case "view":
      delta = watchPercentage ? (watchPercentage / 100) * 0.05 : 0.02
      break
    case "like":
      delta = 0.1
      break
    case "share":
      delta = 0.2
      break
    case "save":
      delta = 0.15
      break
  }
  
  // Update affinities
  const gameAffinities = { ...prefs.game_affinities }
  const creatorAffinities = { ...prefs.creator_affinities }
  const tagAffinities = { ...prefs.tag_affinities }
  const contentTypeAffinities = { ...prefs.content_type_affinities }
  
  if (content.game_id) {
    gameAffinities[content.game_id] = Math.min(
      (gameAffinities[content.game_id] || 0) + delta,
      1
    )
  }
  
  creatorAffinities[content.creator_id] = Math.min(
    (creatorAffinities[content.creator_id] || 0) + delta,
    1
  )
  
  for (const tag of content.tags || []) {
    tagAffinities[tag] = Math.min(
      (tagAffinities[tag] || 0) + delta * 0.5,
      1
    )
  }
  
  contentTypeAffinities[content.content_type] = Math.min(
    (contentTypeAffinities[content.content_type] || 0) + delta * 0.3,
    1
  )
  
  // Save updated preferences
  await supabase
    .from("user_preferences")
    .update({
      game_affinities: gameAffinities,
      creator_affinities: creatorAffinities,
      tag_affinities: tagAffinities,
      content_type_affinities: contentTypeAffinities,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
}

/**
 * Follow/unfollow creator
 */
export async function toggleFollowCreator(userId: string, creatorId: string) {
  const supabase = await createClient()
  const prefs = await getOrCreatePreferences(userId)
  if (!prefs) return { error: "Failed to get preferences" }
  
  const isFollowing = prefs.favorite_creators.includes(creatorId)
  const newFavorites = isFollowing
    ? prefs.favorite_creators.filter((id: string) => id !== creatorId)
    : [...prefs.favorite_creators, creatorId]
  
  await supabase
    .from("user_preferences")
    .update({
      favorite_creators: newFavorites,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
  
  return { following: !isFollowing }
}

/**
 * Block/unblock creator
 */
export async function toggleBlockCreator(userId: string, creatorId: string) {
  const supabase = await createClient()
  const prefs = await getOrCreatePreferences(userId)
  if (!prefs) return { error: "Failed to get preferences" }
  
  const isBlocked = prefs.blocked_creators.includes(creatorId)
  const newBlocked = isBlocked
    ? prefs.blocked_creators.filter((id: string) => id !== creatorId)
    : [...prefs.blocked_creators, creatorId]
  
  await supabase
    .from("user_preferences")
    .update({
      blocked_creators: newBlocked,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
  
  return { blocked: !isBlocked }
}

// ══════════════════════════════════════════
// CONTENT INTERACTIONS
// ══════════════════════════════════════════

/**
 * Record content interaction
 */
export async function recordInteraction(
  userId: string,
  contentId: string,
  interactionType: string,
  data: {
    watchTimeSeconds?: number
    watchPercentage?: number
    completed?: boolean
    source?: string
    positionInFeed?: number
  } = {}
) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("content_interactions")
    .insert({
      user_id: userId,
      content_id: contentId,
      interaction_type: interactionType,
      watch_time_seconds: data.watchTimeSeconds,
      watch_percentage: data.watchPercentage,
      completed: data.completed,
      source: data.source,
      position_in_feed: data.positionInFeed,
    })
  
  if (error) {
    console.error("Failed to record interaction:", error)
    return { error: "Failed to record interaction" }
  }
  
  // Update content metrics
  await updateContentMetrics(contentId, interactionType)
  
  // Update user preferences
  if (["view", "like", "share", "save"].includes(interactionType)) {
    await updatePreferencesFromInteraction(
      userId, 
      contentId, 
      interactionType as any,
      data.watchPercentage
    )
  }
  
  return { success: true }
}

/**
 * Update content metrics after interaction
 */
async function updateContentMetrics(contentId: string, interactionType: string) {
  const supabase = await createClient()
  
  // Increment counters
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  
  switch (interactionType) {
    case "view":
      updates.view_count = supabase.rpc("increment", { x: 1 })
      break
    case "like":
      updates.like_count = supabase.rpc("increment", { x: 1 })
      break
    case "unlike":
      updates.like_count = supabase.rpc("increment", { x: -1 })
      break
    case "comment":
      updates.comment_count = supabase.rpc("increment", { x: 1 })
      break
    case "share":
      updates.share_count = supabase.rpc("increment", { x: 1 })
      break
    case "save":
      updates.save_count = supabase.rpc("increment", { x: 1 })
      break
  }
  
  // Call DB function to recalculate scores
  await supabase.rpc("update_content_metrics", { p_content_id: contentId })
}

// ══════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function interleaveArrays<T>(arr1: T[], arr2: T[]): T[] {
  const result: T[] = []
  const maxLen = Math.max(arr1.length, arr2.length)
  
  // Interleave: 3 from arr1, 1 from arr2
  let i1 = 0, i2 = 0
  while (i1 < arr1.length || i2 < arr2.length) {
    // Add 3 from exploitation
    for (let k = 0; k < 3 && i1 < arr1.length; k++) {
      result.push(arr1[i1++])
    }
    // Add 1 from exploration
    if (i2 < arr2.length) {
      result.push(arr2[i2++])
    }
  }
  
  return result
}
