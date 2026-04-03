"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { generateEmbedUrl, generateThumbnailUrl, checkContentViolations, isAllowedUrl, type MediaType, type SourceType } from "@/lib/media-utils"

// Re-export types from media-utils for convenience
export type { MediaType, SourceType }

// ==========================================
// TYPES
// ==========================================

export type Visibility = "public" | "unlisted" | "private" | "followers_only"
export type ModerationStatus = "pending" | "approved" | "rejected" | "flagged"
export type ReactionType = "like" | "dislike" | "fire" | "shocked" | "clap" | "sad" | "laugh" | "pog" | "gg"

export interface PlayerMedia {
  id: string
  player_id: string
  title: string
  description: string | null
  media_type: string
  source_type: string
  video_url: string | null
  embed_url: string | null
  storage_path: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  game_id: string | null
  tournament_id: string | null
  match_id: string | null
  visibility: Visibility
  moderation_status: ModerationStatus
  view_count: number
  like_count: number
  comment_count: number
  trending_score: number
  is_featured: boolean
  created_at: string
  player?: {
    id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  }
  game?: { id: string; name: string; slug: string } | null
  tournament?: { id: string; name: string; slug: string } | null
}

// ==========================================
// MEDIA CRUD
// ==========================================

export async function createMedia(data: {
  title: string
  description?: string
  mediaType: MediaType
  sourceType: SourceType
  videoUrl?: string
  storagePath?: string
  thumbnailUrl?: string
  durationSeconds?: number
  gameId?: string
  tournamentId?: string
  matchId?: string
  visibility?: Visibility
}): Promise<{ media?: PlayerMedia; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Must be logged in to upload media" }
  
  // Check if user is content banned
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_content_banned, content_ban_until")
    .eq("id", user.id)
    .single()
  
  if (profile?.is_content_banned) {
    if (!profile.content_ban_until || new Date(profile.content_ban_until) > new Date()) {
      return { error: "You are currently banned from uploading content" }
    }
  }
  
  // Validate content
  const violations = checkContentViolations(data.title, data.description)
  if (violations.length > 0) {
    return { error: `Content violations: ${violations.join(", ")}` }
  }
  
  // Validate URL if provided
  let embedUrl: string | null = null
  let thumbnailUrl = data.thumbnailUrl || null
  
  if (data.videoUrl && data.sourceType !== "upload") {
    if (!isAllowedUrl(data.videoUrl)) {
      return { error: "Video URL not from an allowed platform (YouTube, Twitch, Kick)" }
    }
    embedUrl = generateEmbedUrl(data.videoUrl)
    if (!thumbnailUrl) {
      thumbnailUrl = generateThumbnailUrl(data.videoUrl)
    }
  }
  
  // Require gaming context (at least one of game, tournament, or match)
  if (!data.gameId && !data.tournamentId && !data.matchId) {
    return { error: "Media must be linked to a game, tournament, or match" }
  }
  
  // Determine initial moderation status
  // Auto-approve if user has high trust score, otherwise pending
  const { data: trustData } = await supabase
    .from("profiles")
    .select("content_trust_score, approved_uploads")
    .eq("id", user.id)
    .single()
  
  const autoApprove = (trustData?.content_trust_score || 0) >= 80 && (trustData?.approved_uploads || 0) >= 5
  
  const { data: media, error } = await supabase
    .from("player_media")
    .insert({
      player_id: user.id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      media_type: data.mediaType,
      source_type: data.sourceType,
      video_url: data.videoUrl || null,
      embed_url: embedUrl,
      storage_path: data.storagePath || null,
      thumbnail_url: thumbnailUrl,
      duration_seconds: data.durationSeconds || null,
      game_id: data.gameId || null,
      tournament_id: data.tournamentId || null,
      match_id: data.matchId || null,
      visibility: data.visibility || "public",
      moderation_status: autoApprove ? "approved" : "pending",
      published_at: autoApprove ? new Date().toISOString() : null,
    })
    .select()
    .single()
  
  if (error) return { error: error.message }
  
  // Update user's upload count
  await supabase
    .from("profiles")
    .update({ total_uploads: (trustData?.approved_uploads || 0) + 1 })
    .eq("id", user.id)
  
  revalidatePath(`/players/${user.id}`)
  return { media }
}

export async function updateMedia(
  mediaId: string,
  data: {
    title?: string
    description?: string
    visibility?: Visibility
    thumbnailUrl?: string
    gameId?: string
    tournamentId?: string
    matchId?: string
  }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Must be logged in" }
  
  // Verify ownership
  const { data: existing } = await supabase
    .from("player_media")
    .select("player_id")
    .eq("id", mediaId)
    .single()
  
  if (!existing || existing.player_id !== user.id) {
    return { error: "Not authorized to edit this media" }
  }
  
  // Validate content if title/description changed
  if (data.title || data.description) {
    const violations = checkContentViolations(data.title || "", data.description)
    if (violations.length > 0) {
      return { error: `Content violations: ${violations.join(", ")}` }
    }
  }
  
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (data.title) updateData.title = data.title.trim()
  if (data.description !== undefined) updateData.description = data.description?.trim() || null
  if (data.visibility) updateData.visibility = data.visibility
  if (data.thumbnailUrl) updateData.thumbnail_url = data.thumbnailUrl
  if (data.gameId) updateData.game_id = data.gameId
  if (data.tournamentId) updateData.tournament_id = data.tournamentId
  if (data.matchId) updateData.match_id = data.matchId
  
  const { error } = await supabase
    .from("player_media")
    .update(updateData)
    .eq("id", mediaId)
  
  if (error) return { error: error.message }
  
  revalidatePath(`/media/${mediaId}`)
  return { success: true }
}

export async function deleteMedia(mediaId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Must be logged in" }
  
  // Verify ownership
  const { data: existing } = await supabase
    .from("player_media")
    .select("player_id, storage_path")
    .eq("id", mediaId)
    .single()
  
  if (!existing || existing.player_id !== user.id) {
    return { error: "Not authorized to delete this media" }
  }
  
  // Delete from storage if uploaded
  if (existing.storage_path) {
    await supabase.storage.from("player-media").remove([existing.storage_path])
  }
  
  const { error } = await supabase
    .from("player_media")
    .delete()
    .eq("id", mediaId)
  
  if (error) return { error: error.message }
  
  revalidatePath(`/players/${user.id}`)
  return { success: true }
}

// ==========================================
// MEDIA QUERIES
// ==========================================

export async function getMediaById(mediaId: string): Promise<PlayerMedia | null> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("player_media")
    .select(`
      *,
      player:profiles!player_media_player_id_fkey(id, first_name, last_name, avatar_url),
      game:games(id, name, slug),
      tournament:tournaments(id, name, slug)
    `)
    .eq("id", mediaId)
    .single()
  
  return data as PlayerMedia | null
}

export async function getPlayerMedia(
  playerId: string,
  options?: {
    mediaType?: MediaType
    limit?: number
    offset?: number
  }
): Promise<PlayerMedia[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let query = supabase
    .from("player_media")
    .select(`
      *,
      game:games(id, name, slug),
      tournament:tournaments(id, name, slug)
    `)
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
  
  // Only show approved public media unless viewing own profile
  if (user?.id !== playerId) {
    query = query.eq("visibility", "public").eq("moderation_status", "approved")
  }
  
  if (options?.mediaType) {
    query = query.eq("media_type", options.mediaType)
  }
  
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options?.limit || 20) - 1)
  }
  
  const { data } = await query
  return (data || []) as PlayerMedia[]
}

export async function getTrendingMedia(
  options?: {
    gameId?: string
    limit?: number
    timeframe?: "day" | "week" | "month" | "all"
  }
): Promise<PlayerMedia[]> {
  const supabase = await createClient()
  
  let query = supabase
    .from("player_media")
    .select(`
      *,
      player:profiles!player_media_player_id_fkey(id, first_name, last_name, avatar_url),
      game:games(id, name, slug)
    `)
    .eq("visibility", "public")
    .eq("moderation_status", "approved")
    .order("trending_score", { ascending: false })
    .limit(options?.limit || 20)
  
  if (options?.gameId) {
    query = query.eq("game_id", options.gameId)
  }
  
  // Timeframe filter
  if (options?.timeframe && options.timeframe !== "all") {
    const now = new Date()
    let cutoff: Date
    switch (options.timeframe) {
      case "day": cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); break
      case "week": cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
      case "month": cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break
    }
    query = query.gte("created_at", cutoff.toISOString())
  }
  
  const { data } = await query
  return (data || []) as PlayerMedia[]
}

export async function getRecentMedia(limit: number = 20): Promise<PlayerMedia[]> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("player_media")
    .select(`
      *,
      player:profiles!player_media_player_id_fkey(id, first_name, last_name, avatar_url),
      game:games(id, name, slug)
    `)
    .eq("visibility", "public")
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit)
  
  return (data || []) as PlayerMedia[]
}

export async function getFeaturedMedia(limit: number = 5): Promise<PlayerMedia[]> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("player_media")
    .select(`
      *,
      player:profiles!player_media_player_id_fkey(id, first_name, last_name, avatar_url),
      game:games(id, name, slug)
    `)
    .eq("visibility", "public")
    .eq("moderation_status", "approved")
    .eq("is_featured", true)
    .order("featured_at", { ascending: false })
    .limit(limit)
  
  return (data || []) as PlayerMedia[]
}

// Get paginated media feed for infinite scroll (TikTok-style)
export async function getMediaFeed(
  cursor?: string, // ID of last item for pagination
  limit: number = 10,
  filter: "trending" | "recent" | "following" = "trending"
): Promise<{ media: PlayerMedia[]; nextCursor: string | null }> {
  const supabase = await createClient()
  
  let query = supabase
    .from("player_media")
    .select(`
      *,
      player:profiles!player_media_player_id_fkey(id, first_name, last_name, avatar_url),
      game:games(id, name, slug)
    `)
    .eq("visibility", "public")
    .eq("moderation_status", "approved")
  
  // Filter by type
  if (filter === "trending") {
    query = query.order("trending_score", { ascending: false })
  } else if (filter === "recent") {
    query = query.order("created_at", { ascending: false })
  } else if (filter === "following") {
    // Get user's followed players
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: follows } = await supabase
        .from("player_follows")
        .select("player_id")
        .eq("follower_id", user.id)
      
      const followedIds = follows?.map(f => f.player_id) || []
      if (followedIds.length > 0) {
        query = query.in("player_id", followedIds)
      }
    }
    query = query.order("created_at", { ascending: false })
  }
  
  // Cursor-based pagination
  if (cursor) {
    // Get the cursor item to compare
    const { data: cursorItem } = await supabase
      .from("player_media")
      .select("trending_score, created_at")
      .eq("id", cursor)
      .single()
    
    if (cursorItem) {
      if (filter === "trending") {
        query = query.or(`trending_score.lt.${cursorItem.trending_score},and(trending_score.eq.${cursorItem.trending_score},id.lt.${cursor})`)
      } else {
        query = query.lt("created_at", cursorItem.created_at)
      }
    }
  }
  
  query = query.limit(limit + 1) // Fetch one extra to check if there are more
  
  const { data } = await query
  
  const media = (data || []).slice(0, limit) as PlayerMedia[]
  const hasMore = (data?.length || 0) > limit
  const nextCursor = hasMore && media.length > 0 ? media[media.length - 1].id : null
  
  return { media, nextCursor }
}

// ==========================================
// ENGAGEMENT
// ==========================================

export async function addMediaReaction(
  mediaId: string,
  reactionType: ReactionType
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Must be logged in to react" }
  
  // Upsert reaction
  const { error } = await supabase
    .from("media_reactions")
    .upsert({
      media_id: mediaId,
      user_id: user.id,
      reaction_type: reactionType,
    }, { onConflict: "media_id,user_id,reaction_type" })
  
  if (error) return { error: error.message }
  return { success: true }
}

export async function removeMediaReaction(
  mediaId: string,
  reactionType: ReactionType
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Must be logged in" }
  
  const { error } = await supabase
    .from("media_reactions")
    .delete()
    .eq("media_id", mediaId)
    .eq("user_id", user.id)
    .eq("reaction_type", reactionType)
  
  if (error) return { error: error.message }
  return { success: true }
}

export async function getMediaReactions(mediaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data: reactions } = await supabase
    .from("media_reactions")
    .select("reaction_type")
    .eq("media_id", mediaId)
  
  // Count by type
  const counts: Record<string, number> = {}
  reactions?.forEach(r => {
    counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1
  })
  
  // Check user's reaction
  let userReaction: ReactionType | null = null
  if (user) {
    const { data: userReactionData } = await supabase
      .from("media_reactions")
      .select("reaction_type")
      .eq("media_id", mediaId)
      .eq("user_id", user.id)
      .limit(1)
      .single()
    
    userReaction = userReactionData?.reaction_type as ReactionType | null
  }
  
  return { counts, userReaction }
}

// ==========================================
// COMMENTS
// ==========================================

export async function addMediaComment(
  mediaId: string,
  content: string,
  parentId?: string
): Promise<{ commentId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Must be logged in to comment" }
  
  if (content.length < 1 || content.length > 1000) {
    return { error: "Comment must be between 1 and 1000 characters" }
  }
  
  const { data, error } = await supabase
    .from("media_comments")
    .insert({
      media_id: mediaId,
      user_id: user.id,
      parent_id: parentId || null,
      content: content.trim(),
    })
    .select("id")
    .single()
  
  if (error) return { error: error.message }
  return { commentId: data.id }
}

export async function getMediaComments(mediaId: string, limit: number = 50) {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("media_comments")
    .select(`
      *,
      user:profiles!media_comments_user_id_fkey(id, first_name, last_name, avatar_url)
    `)
    .eq("media_id", mediaId)
    .eq("is_deleted", false)
    .is("parent_id", null) // Top-level comments only
    .order("created_at", { ascending: false })
    .limit(limit)
  
  return data || []
}

export async function deleteMediaComment(commentId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Must be logged in" }
  
  // Soft delete
  const { error } = await supabase
    .from("media_comments")
    .update({ is_deleted: true })
    .eq("id", commentId)
    .eq("user_id", user.id)
  
  if (error) return { error: error.message }
  return { success: true }
}

// ==========================================
// VIEWS
// ==========================================

export async function trackMediaView(
  mediaId: string,
  sessionId?: string
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Upsert view
  await supabase
    .from("media_views")
    .upsert({
      media_id: mediaId,
      user_id: user?.id || null,
      session_id: sessionId || null,
    }, { onConflict: "media_id,user_id" })
    .select()
  
  // Increment view count
  await supabase.rpc("update_media_stats", { p_media_id: mediaId })
}

// ==========================================
// REPORTING
// ==========================================

export async function reportMedia(
  mediaId: string,
  reason: string,
  details?: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Must be logged in to report" }
  
  const { error } = await supabase
    .from("media_reports")
    .insert({
      media_id: mediaId,
      reporter_id: user.id,
      reason,
      details: details?.trim() || null,
    })
  
  if (error) {
    if (error.code === "23505") return { error: "You have already reported this content" }
    return { error: error.message }
  }
  
  return { success: true }
}

// ==========================================
// MODERATION (Admin)
// ==========================================

export async function moderateMedia(
  mediaId: string,
  action: "approve" | "reject",
  reason?: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Must be logged in" }
  
  // Check admin permission
  const { data: staff } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()
  
  if (!staff || !["owner", "manager", "organizer"].includes(staff.role)) {
    return { error: "Not authorized" }
  }
  
  const updateData: Record<string, any> = {
    moderation_status: action === "approve" ? "approved" : "rejected",
    moderated_by: user.id,
    moderated_at: new Date().toISOString(),
  }
  
  if (action === "approve") {
    updateData.published_at = new Date().toISOString()
    updateData.is_flagged = false
  } else {
    updateData.rejection_reason = reason || null
  }
  
  const { data: media, error } = await supabase
    .from("player_media")
    .update(updateData)
    .eq("id", mediaId)
    .select("player_id")
    .single()
  
  if (error) return { error: error.message }
  
  // Update user's trust score
  if (media) {
    const column = action === "approve" ? "approved_uploads" : "rejected_uploads"
    await supabase.rpc("increment_profile_column", { 
      p_user_id: media.player_id, 
      p_column: column 
    })
    
    // Recalculate trust score
    const { data: profile } = await supabase
      .from("profiles")
      .select("approved_uploads, rejected_uploads")
      .eq("id", media.player_id)
      .single()
    
    if (profile) {
      const total = (profile.approved_uploads || 0) + (profile.rejected_uploads || 0)
      const trustScore = total > 0 
        ? Math.round(((profile.approved_uploads || 0) / total) * 100)
        : 100
      
      await supabase
        .from("profiles")
        .update({ content_trust_score: trustScore })
        .eq("id", media.player_id)
    }
  }
  
  return { success: true }
}

export async function getPendingMedia(limit: number = 50): Promise<PlayerMedia[]> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("player_media")
    .select(`
      *,
      player:profiles!player_media_player_id_fkey(id, first_name, last_name, avatar_url, content_trust_score),
      game:games(id, name, slug)
    `)
    .eq("moderation_status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit)
  
  return (data || []) as PlayerMedia[]
}

export async function getFlaggedMedia(limit: number = 50): Promise<PlayerMedia[]> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("player_media")
    .select(`
      *,
      player:profiles!player_media_player_id_fkey(id, first_name, last_name, avatar_url),
      game:games(id, name, slug)
    `)
    .eq("is_flagged", true)
    .order("flag_count", { ascending: false })
    .limit(limit)
  
  return (data || []) as PlayerMedia[]
}
