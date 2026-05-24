"use server"

import { createClient } from "@/lib/supabase/server"

// ═══════════════════════════════════════════════════════════════════════════════
// TWO-TOWER ML SERVICE
// Deep Learning Ranking with User and Item Towers
// ═══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

export interface UserFeatures {
  user_id: string
  // Engagement features
  avg_watch_time: number
  completion_rate: number
  like_rate: number
  comment_rate: number
  share_rate: number
  // Preference features
  game_affinities: number[] // One-hot encoded
  content_type_affinities: number[]
  // Behavioral features
  session_count: number
  days_since_signup: number
  follows_count: number
  // Temporal features
  hour_of_day: number
  day_of_week: number
}

export interface ItemFeatures {
  item_id: string
  // Quality features
  quality_score: number
  trending_score: number
  momentum_score: number
  // Engagement features
  view_count: number
  like_rate: number
  completion_rate: number
  avg_watch_percentage: number
  // Content features
  duration_seconds: number
  game_id_encoded: number[] // One-hot
  content_type_encoded: number[] // One-hot
  // Creator features
  creator_followers: number
  creator_verified: boolean
  creator_avg_engagement: number
  // Temporal features
  age_hours: number
}

export interface RankingResult {
  item_id: string
  score: number
  user_vec?: number[]
  item_vec?: number[]
}

// ══════════════════════════════════════════
// FEATURE EXTRACTION
// ══════════════════════════════════════════

const GAMES = ["mtg-arena", "pokemon", "yugioh", "smash", "league", "valorant", "other"]
const CONTENT_TYPES = ["clip", "highlight", "tutorial", "match", "stream"]

/**
 * One-hot encode a value
 */
function oneHotEncode(value: string, categories: string[]): number[] {
  return categories.map(cat => cat === value ? 1 : 0)
}

/**
 * Extract user features from database
 */
export async function extractUserFeatures(userId: string): Promise<UserFeatures> {
  const supabase = await createClient()
  
  // Get user preferences
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .single()
  
  // Get user stats from events
  const { data: eventStats } = await supabase
    .rpc("get_user_engagement_stats", { p_user_id: userId })
  
  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .single()
  
  // Get follows count
  const { count: followsCount } = await supabase
    .from("player_follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", userId)
  
  // Extract game affinities as vector
  const gameAffinities = GAMES.map(game => 
    (prefs?.game_affinities?.[game] || 0) as number
  )
  
  // Extract content type affinities
  const contentTypeAffinities = CONTENT_TYPES.map(type =>
    (prefs?.content_type_affinities?.[type] || 0) as number
  )
  
  const now = new Date()
  
  return {
    user_id: userId,
    avg_watch_time: eventStats?.avg_watch_time || 0,
    completion_rate: eventStats?.completion_rate || 0,
    like_rate: eventStats?.like_rate || 0,
    comment_rate: eventStats?.comment_rate || 0,
    share_rate: eventStats?.share_rate || 0,
    game_affinities: gameAffinities,
    content_type_affinities: contentTypeAffinities,
    session_count: eventStats?.session_count || 1,
    days_since_signup: profile?.created_at 
      ? Math.floor((now.getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
    follows_count: followsCount || 0,
    hour_of_day: now.getHours(),
    day_of_week: now.getDay(),
  }
}

/**
 * Extract item features from clip data
 */
export function extractItemFeatures(item: any): ItemFeatures {
  const now = Date.now()
  const createdAt = new Date(item.created_at).getTime()
  const ageHours = (now - createdAt) / (1000 * 60 * 60)
  
  return {
    item_id: item.id,
    quality_score: item.quality_score || 5,
    trending_score: Math.min((item.trending_score || 0) / 1000, 1),
    momentum_score: item.momentum_score || 0,
    view_count: Math.log10(Math.max(item.view_count || 1, 1)),
    like_rate: item.view_count > 0 ? (item.like_count / item.view_count) : 0,
    completion_rate: item.completion_rate || 0.5,
    avg_watch_percentage: item.avg_watch_percentage || 50,
    duration_seconds: Math.min((item.duration_seconds || 30) / 300, 1),
    game_id_encoded: oneHotEncode(item.game_id || "other", GAMES),
    content_type_encoded: oneHotEncode(item.content_type || "clip", CONTENT_TYPES),
    creator_followers: Math.log10(Math.max(item.creator?.followers_count || 1, 1)),
    creator_verified: item.creator?.verified || false,
    creator_avg_engagement: item.creator?.avg_engagement || 0.05,
    age_hours: Math.min(ageHours / 168, 1), // Normalize to week
  }
}

// ══════════════════════════════════════════
// NEURAL NETWORK SIMULATION
// (Production would call actual PyTorch service)
// ══════════════════════════════════════════

/**
 * User tower: Convert user features to embedding
 */
function userTower(features: UserFeatures): number[] {
  // In production, this calls the PyTorch model
  // Here we simulate with a weighted combination
  
  const engagementVec = [
    features.avg_watch_time / 60,
    features.completion_rate,
    features.like_rate * 10,
    features.share_rate * 20,
  ]
  
  const preferenceVec = [
    ...features.game_affinities,
    ...features.content_type_affinities,
  ]
  
  const behaviorVec = [
    Math.log10(features.session_count + 1) / 3,
    Math.min(features.days_since_signup / 365, 1),
    Math.log10(features.follows_count + 1) / 3,
  ]
  
  const temporalVec = [
    Math.sin(2 * Math.PI * features.hour_of_day / 24),
    Math.cos(2 * Math.PI * features.hour_of_day / 24),
    Math.sin(2 * Math.PI * features.day_of_week / 7),
    Math.cos(2 * Math.PI * features.day_of_week / 7),
  ]
  
  // Combine into 64-dim embedding
  const combined = [...engagementVec, ...preferenceVec, ...behaviorVec, ...temporalVec]
  
  // Simple "neural network" transformation
  // (In production: actual PyTorch forward pass)
  return normalizeVector(combined.slice(0, 64))
}

/**
 * Item tower: Convert item features to embedding
 */
function itemTower(features: ItemFeatures): number[] {
  const qualityVec = [
    features.quality_score / 10,
    features.trending_score,
    features.momentum_score,
  ]
  
  const engagementVec = [
    features.view_count / 7, // log scale normalized
    features.like_rate * 10,
    features.completion_rate,
    features.avg_watch_percentage / 100,
  ]
  
  const contentVec = [
    features.duration_seconds,
    ...features.game_id_encoded,
    ...features.content_type_encoded,
  ]
  
  const creatorVec = [
    features.creator_followers / 7,
    features.creator_verified ? 1 : 0,
    features.creator_avg_engagement * 10,
  ]
  
  const temporalVec = [
    1 - features.age_hours, // Fresher = higher
  ]
  
  // Combine into 64-dim embedding
  const combined = [...qualityVec, ...engagementVec, ...contentVec, ...creatorVec, ...temporalVec]
  
  return normalizeVector(combined.slice(0, 64))
}

/**
 * Normalize a vector to unit length
 */
function normalizeVector(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  if (magnitude === 0) return vec.map(() => 0)
  return vec.map(v => v / magnitude)
}

/**
 * Dot product of two vectors
 */
function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0)
}

// ══════════════════════════════════════════
// RANKING API
// ══════════════════════════════════════════

/**
 * Rank items using two-tower model
 */
export async function rankWithTwoTower(
  userId: string | null,
  items: any[]
): Promise<RankingResult[]> {
  // Extract user features
  let userVec: number[]
  
  if (userId) {
    const userFeatures = await extractUserFeatures(userId)
    userVec = userTower(userFeatures)
  } else {
    // Default user vector for anonymous users
    userVec = new Array(64).fill(0).map(() => Math.random() * 0.1)
    userVec = normalizeVector(userVec)
  }
  
  // Score each item
  const results: RankingResult[] = items.map(item => {
    const itemFeatures = extractItemFeatures(item)
    const itemVec = itemTower(itemFeatures)
    
    // Score = dot product of user and item embeddings
    const score = dotProduct(userVec, itemVec)
    
    return {
      item_id: item.id,
      score,
      user_vec: userVec,
      item_vec: itemVec,
    }
  })
  
  // Sort by score descending
  return results.sort((a, b) => b.score - a.score)
}

/**
 * ML inference API endpoint handler
 * Call external ML service if available
 */
export async function callMLService(
  userId: string,
  items: any[]
): Promise<RankingResult[]> {
  const mlUrl = process.env.ML_SERVICE_URL
  
  if (!mlUrl) {
    // Fallback to local two-tower
    return rankWithTwoTower(userId, items)
  }
  
  try {
    // Extract features
    const userFeatures = await extractUserFeatures(userId)
    const itemFeatures = items.map(extractItemFeatures)
    
    // Call external ML service
    const response = await fetch(`${mlUrl}/rank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_features: userFeatures,
        item_features: itemFeatures,
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })
    
    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}`)
    }
    
    const data = await response.json()
    return data.rankings
  } catch (error) {
    console.error("ML service call failed, falling back to local:", error)
    return rankWithTwoTower(userId, items)
  }
}

// ══════════════════════════════════════════
// EMBEDDING STORAGE
// ══════════════════════════════════════════

/**
 * Store user embedding for fast retrieval
 */
export async function storeUserEmbedding(userId: string) {
  const supabase = await createClient()
  
  const userFeatures = await extractUserFeatures(userId)
  const embedding = userTower(userFeatures)
  
  await supabase
    .from("user_embeddings")
    .upsert({
      user_id: userId,
      embedding: embedding,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
}

/**
 * Get cached user embedding
 */
export async function getUserEmbedding(userId: string): Promise<number[] | null> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("user_embeddings")
    .select("embedding, updated_at")
    .eq("user_id", userId)
    .single()
  
  if (!data) return null
  
  // Check if stale (older than 1 hour)
  const updatedAt = new Date(data.updated_at).getTime()
  const ageHours = (Date.now() - updatedAt) / (1000 * 60 * 60)
  
  if (ageHours > 1) {
    // Refresh in background
    storeUserEmbedding(userId).catch(console.error)
  }
  
  return data.embedding
}

// ══════════════════════════════════════════
// UNIFIED RANKING PIPELINE
// ══════════════════════════════════════════

/**
 * Full ranking pipeline
 */
export async function runRankingPipeline(
  userId: string | null,
  candidateItems: any[],
  options: {
    useCache?: boolean
    diversify?: boolean
    boostNew?: boolean
  } = {}
) {
  const { useCache = true, diversify = true, boostNew = true } = options
  
  // Get rankings from two-tower model
  let rankings = userId
    ? await callMLService(userId, candidateItems)
    : await rankWithTwoTower(null, candidateItems)
  
  // Apply post-processing
  
  // 1. Boost new content
  if (boostNew) {
    rankings = rankings.map(r => {
      const item = candidateItems.find(i => i.id === r.item_id)
      if (!item) return r
      
      const ageHours = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60)
      if (ageHours < 24) {
        return { ...r, score: r.score * 1.2 }
      }
      return r
    })
  }
  
  // 2. Diversify (avoid same creator too often)
  if (diversify) {
    const seenCreators = new Set<string>()
    rankings = rankings.filter(r => {
      const item = candidateItems.find(i => i.id === r.item_id)
      if (!item) return true
      
      const creatorId = item.creator_id || item.player_id
      if (seenCreators.size >= 10) return true // Allow repeats after 10
      
      if (seenCreators.has(creatorId)) {
        return false
      }
      seenCreators.add(creatorId)
      return true
    })
  }
  
  // Re-sort after adjustments
  rankings.sort((a, b) => b.score - a.score)
  
  return rankings
}
