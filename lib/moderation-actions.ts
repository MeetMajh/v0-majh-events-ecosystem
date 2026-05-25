"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type ModerationStatus = "pending" | "approved" | "rejected"
export type ModerationCategory = "safe" | "adult" | "violence" | "hate" | "spam" | "copyright" | "off_topic"

export interface FlaggedContent {
  id: string
  type: "clip" | "media" | "comment" | "profile"
  title: string
  thumbnail_url: string | null
  video_url: string | null
  description: string | null
  user_id: string
  user_name: string | null
  user_avatar: string | null
  moderation_status: ModerationStatus
  is_flagged: boolean
  flags: string[]
  category: ModerationCategory | null
  confidence: number | null
  reason: string | null
  created_at: string
  reported_count: number
}

export interface ModerationStats {
  total_pending: number
  total_approved_today: number
  total_rejected_today: number
  total_reports: number
  flagged_by_ai: number
  flagged_by_users: number
}

/**
 * Get flagged content for moderation review
 */
export async function getFlaggedContent(options?: {
  status?: ModerationStatus
  limit?: number
  offset?: number
}): Promise<FlaggedContent[]> {
  const supabase = await createClient()
  const { status = "pending", limit = 50, offset = 0 } = options || {}
  
  // Get flagged player_media with user info
  let query = supabase
    .from("player_media")
    .select(`
      id,
      title,
      thumbnail_url,
      video_url,
      description,
      user_id,
      moderation_status,
      is_flagged,
      created_at,
      profiles!player_media_user_id_fkey(
        first_name,
        last_name,
        avatar_url,
        username
      )
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (status === "pending") {
    query = query.or("moderation_status.eq.pending,is_flagged.eq.true")
  } else {
    query = query.eq("moderation_status", status)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error("[Moderation] Failed to fetch flagged content:", error)
    return []
  }
  
  return (data || []).map((item: any) => ({
    id: item.id,
    type: "media" as const,
    title: item.title || "Untitled",
    thumbnail_url: item.thumbnail_url,
    video_url: item.video_url,
    description: item.description,
    user_id: item.user_id,
    user_name: item.profiles 
      ? `${item.profiles.first_name || ""} ${item.profiles.last_name || ""}`.trim() || item.profiles.username
      : "Unknown",
    user_avatar: item.profiles?.avatar_url,
    moderation_status: item.moderation_status,
    is_flagged: item.is_flagged,
    flags: [],
    category: null,
    confidence: null,
    reason: null,
    created_at: item.created_at,
    reported_count: 0,
  }))
}

/**
 * Get moderation statistics
 */
export async function getModerationStats(): Promise<ModerationStats> {
  const supabase = await createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Get counts in parallel
  const [pendingResult, approvedResult, rejectedResult, flaggedResult] = await Promise.all([
    supabase
      .from("player_media")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "pending"),
    supabase
      .from("player_media")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "approved")
      .gte("created_at", today.toISOString()),
    supabase
      .from("player_media")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "rejected")
      .gte("created_at", today.toISOString()),
    supabase
      .from("player_media")
      .select("id", { count: "exact", head: true })
      .eq("is_flagged", true),
  ])
  
  return {
    total_pending: pendingResult.count || 0,
    total_approved_today: approvedResult.count || 0,
    total_rejected_today: rejectedResult.count || 0,
    total_reports: 0, // Would come from moderation_reports table
    flagged_by_ai: flaggedResult.count || 0,
    flagged_by_users: 0,
  }
}

/**
 * Approve content
 */
export async function approveContent(contentId: string, contentType: string = "media") {
  const supabase = await createClient()
  
  // Get current user for audit
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  if (contentType === "media") {
    const { error } = await supabase
      .from("player_media")
      .update({
        moderation_status: "approved",
        is_flagged: false,
        published_at: new Date().toISOString(),
      })
      .eq("id", contentId)
    
    if (error) throw error
  }
  
  // Log the action
  await supabase.from("moderation_logs").insert({
    media_id: contentId,
    moderator_id: user.id,
    action_taken: "approved",
    automated: false,
  }).catch(() => {})
  
  revalidatePath("/admin/moderation")
  return { success: true }
}

/**
 * Reject content
 */
export async function rejectContent(
  contentId: string, 
  contentType: string = "media",
  reason?: string
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  if (contentType === "media") {
    const { error } = await supabase
      .from("player_media")
      .update({
        moderation_status: "rejected",
        is_flagged: true,
        published_at: null,
      })
      .eq("id", contentId)
    
    if (error) throw error
  }
  
  // Log the action
  await supabase.from("moderation_logs").insert({
    media_id: contentId,
    moderator_id: user.id,
    action_taken: "rejected",
    automated: false,
    notes: reason,
  }).catch(() => {})
  
  revalidatePath("/admin/moderation")
  return { success: true }
}

/**
 * Delete content permanently
 */
export async function deleteContent(contentId: string, contentType: string = "media") {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  if (contentType === "media") {
    const { error } = await supabase
      .from("player_media")
      .delete()
      .eq("id", contentId)
    
    if (error) throw error
  }
  
  revalidatePath("/admin/moderation")
  return { success: true }
}

/**
 * Ban a user
 */
export async function banUser(
  userId: string, 
  reason: string,
  duration?: number // in hours, null = permanent
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  
  const expiresAt = duration 
    ? new Date(Date.now() + duration * 60 * 60 * 1000).toISOString()
    : null
  
  // Update user profile
  const { error } = await supabase
    .from("profiles")
    .update({
      is_banned: true,
      ban_reason: reason,
      ban_expires_at: expiresAt,
    })
    .eq("id", userId)
  
  if (error) throw error
  
  revalidatePath("/admin/moderation")
  return { success: true }
}

/**
 * Unban a user
 */
export async function unbanUser(userId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("profiles")
    .update({
      is_banned: false,
      ban_reason: null,
      ban_expires_at: null,
    })
    .eq("id", userId)
  
  if (error) throw error
  
  revalidatePath("/admin/moderation")
  return { success: true }
}
