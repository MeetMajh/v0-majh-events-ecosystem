"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"

// ═══════════════════════════════════════════════════════════════════════════════
// GO LIVE - Player Streaming Feature
// Allows players to stream directly through the platform
// ═══════════════════════════════════════════════════════════════════════════════

export interface UserStream {
  id: string
  user_id: string
  title: string
  description?: string
  game_id?: string
  stream_key: string
  rtmp_url: string
  playback_url?: string
  status: "offline" | "live" | "ended"
  started_at?: string
  ended_at?: string
  peak_viewers: number
  total_views: number
  is_public: boolean
  allow_chat: boolean
  allow_clips: boolean
  game?: { id: string; name: string; logo_url?: string }
  user?: { id: string; display_name: string; avatar_url?: string }
  created_at: string
}

export interface CreateStreamInput {
  title: string
  description?: string
  game_id?: string
  is_public?: boolean
  allow_chat?: boolean
  allow_clips?: boolean
}

/**
 * Generate a unique stream key
 */
function generateStreamKey(): string {
  return `live_${nanoid(32)}`
}

/**
 * Get RTMP URL for streaming
 * In production, this would point to your streaming server (e.g., Mux, Cloudflare Stream)
 */
function getRtmpUrl(): string {
  // This is a placeholder - in production, integrate with:
  // - Mux Live (recommended)
  // - Cloudflare Stream
  // - Amazon IVS
  // - Custom RTMP server
  return process.env.RTMP_SERVER_URL || "rtmp://live.majhevents.com/live"
}

/**
 * Create a new stream configuration for a user
 */
export async function createStream(input: CreateStreamInput) {
  console.log("[v0] createStream called with:", input)
  
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  console.log("[v0] user:", user?.id)
  
  if (!user) {
    return { error: "You must be logged in to stream" }
  }

  // Check if user already has an active stream
  const { data: existing, error: existingError } = await supabase
    .from("user_streams")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["offline", "live"])
    .single()

  console.log("[v0] existing stream check:", { existing, existingError })

  if (existing) {
    return { error: "You already have an active stream configuration. End your current stream first." }
  }

  const stream_key = generateStreamKey()
  const rtmp_url = getRtmpUrl()

  console.log("[v0] inserting stream with key:", stream_key)

  const { data, error } = await supabase
    .from("user_streams")
    .insert({
      user_id: user.id,
      title: input.title,
      description: input.description,
      game_id: input.game_id,
      stream_key,
      rtmp_url,
      status: "offline",
      is_public: input.is_public ?? true,
      allow_chat: input.allow_chat ?? true,
      allow_clips: input.allow_clips ?? true,
    })
    .select()
    .single()

  console.log("[v0] insert result:", { data, error })

  if (error) {
    console.error("[v0] Error creating stream:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/stream")
  return { data: data as UserStream }
}

/**
 * Update stream settings
 */
export async function updateStream(streamId: string, updates: Partial<CreateStreamInput>) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("user_streams")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", streamId)
    .eq("user_id", user.id) // Ensure user owns this stream
    .select()
    .single()

  if (error) {
    console.error("Error updating stream:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/stream")
  return { data: data as UserStream }
}

/**
 * Get user's stream configuration
 */
export async function getMyStream() {
  console.log("[v0] getMyStream called")
  
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  console.log("[v0] getMyStream user:", user?.id)
  
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("user_streams")
    .select(`
      *,
      game:games(id, name, logo_url)
    `)
    .eq("user_id", user.id)
    .in("status", ["offline", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  console.log("[v0] getMyStream result:", { data, error })

  if (error && error.code !== "PGRST116") { // PGRST116 = no rows
    console.error("[v0] Error fetching stream:", error)
    return { error: error.message }
  }

  return { data: data as UserStream | null }
}

/**
 * Start streaming (called when stream is detected on RTMP server)
 */
export async function startStream(streamKey: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("user_streams")
    .update({
      status: "live",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stream_key", streamKey)
    .eq("status", "offline")
    .select()
    .single()

  if (error) {
    console.error("Error starting stream:", error)
    return { error: error.message }
  }

  return { data: data as UserStream }
}

/**
 * End streaming
 */
export async function endStream(streamId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("user_streams")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", streamId)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error ending stream:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/stream")
  return { data: data as UserStream }
}

/**
 * Regenerate stream key (security feature)
 */
export async function regenerateStreamKey(streamId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const new_stream_key = generateStreamKey()

  const { data, error } = await supabase
    .from("user_streams")
    .update({
      stream_key: new_stream_key,
      updated_at: new Date().toISOString(),
    })
    .eq("id", streamId)
    .eq("user_id", user.id)
    .eq("status", "offline") // Can only regenerate when offline
    .select()
    .single()

  if (error) {
    console.error("Error regenerating stream key:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/stream")
  return { data: data as UserStream }
}

/**
 * Delete stream configuration
 */
export async function deleteStream(streamId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { error } = await supabase
    .from("user_streams")
    .delete()
    .eq("id", streamId)
    .eq("user_id", user.id)
    .neq("status", "live") // Cannot delete while live

  if (error) {
    console.error("Error deleting stream:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/stream")
  return { success: true }
}

/**
 * Get all live streams (public)
 */
export async function getLiveStreams(options?: { game_id?: string; limit?: number }) {
  const supabase = await createClient()

  let query = supabase
    .from("user_streams")
    .select(`
      *,
      game:games(id, name, logo_url),
      user:profiles(id, display_name, avatar_url)
    `)
    .eq("status", "live")
    .eq("is_public", true)
    .order("total_views", { ascending: false })

  if (options?.game_id) {
    query = query.eq("game_id", options.game_id)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching live streams:", error)
    return { error: error.message }
  }

  return { data: data as UserStream[] }
}

/**
 * Update viewer count (called periodically)
 */
export async function updateViewerCount(streamId: string, currentViewers: number) {
  const supabase = await createClient()

  // Get current peak to compare
  const { data: stream } = await supabase
    .from("user_streams")
    .select("peak_viewers, total_views")
    .eq("id", streamId)
    .single()

  const newPeak = Math.max(stream?.peak_viewers || 0, currentViewers)

  const { error } = await supabase
    .from("user_streams")
    .update({
      peak_viewers: newPeak,
      total_views: (stream?.total_views || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", streamId)

  if (error) {
    console.error("Error updating viewer count:", error)
  }
}
