"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { requireStaffAction } from "@/lib/auth/require-staff"
import { generateEmbedUrl, generateThumbnailUrl, checkContentViolations, isAllowedUrl } from "@/lib/media-utils"
import { moderateMedia as runAIModeration } from "@/lib/content-moderation"

export type MediaType = "clip" | "vod" | "highlight" | "full_match" | "tutorial"
export type SourceType = "upload" | "youtube" | "twitch" | "kick" | "external"
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
// FILE UPLOAD
// ==========================================

export async function uploadMediaFile(
  formData: FormData
): Promise<{ url?: string; storagePath?: string; error?: string }> {
  console.log("[v0] uploadMediaFile called")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.log("[v0] Upload: No user found")
    return { error: "Must be logged in to upload" }
  }
  console.log("[v0] Upload: User ID:", user.id)

  const file = formData.get("file") as File
  if (!file || !(file instanceof File)) {
    console.log("[v0] Upload: No file in formData")
    return { error: "No file provided" }
  }
  console.log("[v0] Upload: File name:", file.name, "type:", file.type, "size:", file.size)

  const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"]
  if (!allowedTypes.includes(file.type)) {
    return { error: "Invalid file type. Supported: MP4, WebM, MOV" }
  }

  const maxSize = 100 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: "File too large. Maximum size is 100MB" }
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase() || "mp4"
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`
  const filePath = `${user.id}/${fileName}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from("player-media")
    .upload(filePath, buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    })

  if (uploadError) {
    console.error("[v0] Storage upload error:", uploadError)
    if (uploadError.message.includes("bucket") || uploadError.message.includes("not found")) {
      return { error: "Storage not configured. Please create a 'player-media' bucket in Supabase Storage." }
    }
    return { error: `Upload failed: ${uploadError.message}` }
  }

  const { data: urlData } = supabase.storage
    .from("player-media")
    .getPublicUrl(filePath)

  return {
    url: urlData.publicUrl,
    storagePath: filePath,
  }
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

  const violations = checkContentViolations(data.title, data.description)
  if (violations.length > 0) {
    return { error: `Content violations: ${violations.join(", ")}` }
  }

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

  const autoApprove = true
  const mediaUrl = data.videoUrl || data.storagePath || embedUrl || ""

  const { data: media, error } = await supabase
    .from("player_media")
    .insert({
      player_id: user.id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      media_type: data.mediaType,
      category: data.mediaType === "clip" ? "gameplay" : "other",
      url: mediaUrl,
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

  await supabase.rpc("increment_upload_count", { user_id: user.id }).catch(() => {
    supabase
      .from("profiles")
      .update({ total_uploads: 1 })
      .eq("id", user.id)
  })

  if (!autoApprove) {
    runAIModeration(media.id).catch((err) => {
      console.error("[v0] Background moderation failed:", err)
    })
  }

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

  const { data: existing } = await supabase
    .from("player_media")
    .select("player_id")
    .eq("id", mediaId)
    .single()

  if (!existing || existing.player_id !== user.id) {
    return { error: "Not authorized to edit this media" }
  }

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

  const { data: existing } = await supabase
    .from("player_media")
    .select("player_id, storage_path")
    .eq("id", mediaId)
    .single()

  if (!existing || existing.player_id !== user.id) {
    return { error: "Not authorized to delete this media" }
  }

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

// ==========================================
// VIEW TRACKING
// ==========================================

export async function trackClipView(clipId: string): Promise<{ success: boolean; views?: number; error?: string }> {
  const supabase = await createClient()

  try {
    const { data: clip, error: fetchError } = await supabase
      .from("player_media")
      .select("view_count")
      .eq("id", clipId)
      .single()

    if (fetchError || !clip) {
      return { success: false, error: "Clip not found" }
    }

    const newViews = (clip.view_count || 0) + 1
    const { data: updated, error: updateError } = await supabase
      .from("player_media")
      .update({ view_count: newViews })
      .eq("id", clipId)
      .select("view_count")
      .single()

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true, views: updated?.view_count || newViews }
  } catch (error) {
    console.error("[v0] Error tracking clip view:", error)
    return { success: false, error: "Failed to track view" }
  }
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
      player:player_id(id, first_name, last_name, avatar_url),
      game:game_id(id, name, slug)
    `)
    .eq("visibility", "public")
    .eq("moderation_status", "approved")
    .order("trending_score", { ascending: false })
    .limit(options?.limit || 20)

  if (options?.gameId) {
    query = query.eq("game_id", options.gameId)
  }

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

  const { data, error } = await query

  if (error) {
    console.error("[v0] getTrendingMedia error:", error)
    return []
  }

  console.log("[v0] getTrendingMedia found:", data?.length, "items")
  return (data || []) as PlayerMedia[]
}

export async function getRecentMedia(limit: number = 20): Promise<PlayerMedia[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("player_media")
    .select(`
      *,
      player:player_id(id, first_name, last_name, avatar_url),
