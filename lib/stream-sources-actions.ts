"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ═══════════════════════════════════════════════════════════════════════════════
// STREAM SOURCES MANAGEMENT
// Admin tools to manage external stream sources (Twitch, YouTube, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

export interface StreamSource {
  id: string
  title: string
  description?: string
  platform: "twitch" | "youtube" | "kick" | "custom"
  channel_url: string
  embed_url?: string
  channel_id?: string
  game_id?: string
  category: "top_streamer" | "sponsored" | "organization" | "community"
  tags: string[]
  source_type: "always" | "scheduled" | "live_only"
  schedule_start?: string
  schedule_end?: string
  priority: number
  is_active: boolean
  is_live: boolean
  is_featured: boolean
  viewer_count: number
  thumbnail_url?: string
  stream_title?: string
  last_live_at?: string
  organization_id?: string
  sponsor_id?: string
  contact_email?: string
  game?: { id: string; name: string; logo_url?: string }
  created_at: string
}

export interface CreateStreamSourceInput {
  title: string
  description?: string
  platform: "twitch" | "youtube" | "kick" | "custom"
  channel_url: string
  game_id?: string
  category: "top_streamer" | "sponsored" | "organization" | "community"
  tags?: string[]
  source_type?: "always" | "scheduled" | "live_only"
  priority?: number
  is_featured?: boolean
  contact_email?: string
}

/**
 * Generate embed URL from channel URL
 */
function generateEmbedUrl(platform: string, channelUrl: string): string {
  try {
    const url = new URL(channelUrl)
    
    switch (platform) {
      case "twitch": {
        // Extract channel name from twitch.tv/channelname
        const channel = url.pathname.replace("/", "").split("/")[0]
        return `https://player.twitch.tv/?channel=${channel}&parent=${process.env.NEXT_PUBLIC_APP_URL?.replace("https://", "").replace("http://", "") || "localhost"}`
      }
      case "youtube": {
        // Handle youtube.com/watch?v=ID or youtu.be/ID or youtube.com/live/ID
        let videoId = url.searchParams.get("v")
        if (!videoId && url.hostname === "youtu.be") {
          videoId = url.pathname.replace("/", "")
        }
        if (!videoId && url.pathname.includes("/live/")) {
          videoId = url.pathname.split("/live/")[1]
        }
        return videoId ? `https://www.youtube.com/embed/${videoId}` : channelUrl
      }
      case "kick": {
        const channel = url.pathname.replace("/", "").split("/")[0]
        return `https://player.kick.com/${channel}`
      }
      default:
        return channelUrl
    }
  } catch {
    return channelUrl
  }
}

/**
 * Extract channel ID from URL
 */
function extractChannelId(platform: string, channelUrl: string): string | null {
  try {
    const url = new URL(channelUrl)
    
    switch (platform) {
      case "twitch":
        return url.pathname.replace("/", "").split("/")[0]
      case "youtube":
        if (url.pathname.includes("/channel/")) {
          return url.pathname.split("/channel/")[1]?.split("/")[0]
        }
        return url.searchParams.get("v") || url.pathname.replace("/", "")
      case "kick":
        return url.pathname.replace("/", "").split("/")[0]
      default:
        return null
    }
  } catch {
    return null
  }
}

/**
 * Create a new stream source
 */
export async function createStreamSource(input: CreateStreamSourceInput) {
  const supabase = await createClient()
  
  // Check admin permission
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "super_admin", "staff"].includes(profile.role)) {
    return { error: "Unauthorized - Admin access required" }
  }

  const embed_url = generateEmbedUrl(input.platform, input.channel_url)
  const channel_id = extractChannelId(input.platform, input.channel_url)

  const { data, error } = await supabase
    .from("stream_sources")
    .insert({
      title: input.title,
      description: input.description,
      platform: input.platform,
      channel_url: input.channel_url,
      embed_url,
      channel_id,
      game_id: input.game_id,
      category: input.category,
      tags: input.tags || [],
      source_type: input.source_type || "always",
      priority: input.priority || 50,
      is_featured: input.is_featured || false,
      contact_email: input.contact_email,
      added_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating stream source:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/admin/streams")
  return { data }
}

/**
 * Update a stream source
 */
export async function updateStreamSource(id: string, updates: Partial<CreateStreamSourceInput> & {
  is_active?: boolean
  is_live?: boolean
  is_featured?: boolean
  viewer_count?: number
  thumbnail_url?: string
  stream_title?: string
}) {
  const supabase = await createClient()
  
  // Check admin permission
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "super_admin", "staff"].includes(profile.role)) {
    return { error: "Unauthorized - Admin access required" }
  }

  // Regenerate embed URL if channel URL changed
  let embed_url = undefined
  let channel_id = undefined
  if (updates.channel_url && updates.platform) {
    embed_url = generateEmbedUrl(updates.platform, updates.channel_url)
    channel_id = extractChannelId(updates.platform, updates.channel_url)
  }

  const { data, error } = await supabase
    .from("stream_sources")
    .update({
      ...updates,
      ...(embed_url && { embed_url }),
      ...(channel_id && { channel_id }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Error updating stream source:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/admin/streams")
  return { data }
}

/**
 * Delete a stream source
 */
export async function deleteStreamSource(id: string) {
  const supabase = await createClient()
  
  // Check admin permission
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "super_admin", "staff"].includes(profile.role)) {
    return { error: "Unauthorized - Admin access required" }
  }

  const { error } = await supabase
    .from("stream_sources")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting stream source:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/admin/streams")
  return { success: true }
}

/**
 * Get all stream sources (admin view)
 */
export async function getStreamSources(options?: {
  category?: string
  game_id?: string
  is_active?: boolean
  is_live?: boolean
}) {
  const supabase = await createClient()

  let query = supabase
    .from("stream_sources")
    .select(`
      *,
      game:games(id, name, icon_url)
    `)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })

  if (options?.category) {
    query = query.eq("category", options.category)
  }
  if (options?.game_id) {
    query = query.eq("game_id", options.game_id)
  }
  if (options?.is_active !== undefined) {
    query = query.eq("is_active", options.is_active)
  }
  if (options?.is_live !== undefined) {
    query = query.eq("is_live", options.is_live)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching stream sources:", error)
    return { error: error.message }
  }

  return { data: data as StreamSource[] }
}

/**
 * Get active stream sources for public display
 */
export async function getActiveStreams() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("stream_sources")
    .select(`
      *,
      game:games(id, name, icon_url)
    `)
    .eq("is_active", true)
    .order("is_live", { ascending: false })
    .order("is_featured", { ascending: false })
    .order("priority", { ascending: false })
    .limit(10)

  if (error) {
    console.error("Error fetching active streams:", error)
    return { error: error.message }
  }

  return { data: data as StreamSource[] }
}

/**
 * Toggle stream source active status
 */
export async function toggleStreamSourceActive(id: string, is_active: boolean) {
  return updateStreamSource(id, { is_active })
}

/**
 * Toggle stream source featured status
 */
export async function toggleStreamSourceFeatured(id: string, is_featured: boolean) {
  return updateStreamSource(id, { is_featured })
}

/**
 * Update stream live status (called by cron/webhook)
 */
export async function updateStreamLiveStatus(id: string, is_live: boolean, stats?: {
  viewer_count?: number
  thumbnail_url?: string
  stream_title?: string
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("stream_sources")
    .update({
      is_live,
      viewer_count: stats?.viewer_count || 0,
      thumbnail_url: stats?.thumbnail_url,
      stream_title: stats?.stream_title,
      last_live_at: is_live ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    console.error("Error updating stream live status:", error)
    return { error: error.message }
  }

  return { success: true }
}
