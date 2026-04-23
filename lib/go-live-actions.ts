"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import { createMuxLiveStream, deleteMuxLiveStream } from "@/lib/mux"
import { getActiveStreamingProvider, getPlaybackUrl } from "@/lib/streaming-config"

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
  mux_stream_id?: string
  mux_playback_id?: string
  mux_asset_id?: string
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
 * Generate a unique stream key (fallback if Mux fails)
 */
function generateStreamKey(): string {
  return `live_${nanoid(32)}`
}

/**
 * Create a new stream configuration for a user
 */
export async function createStream(input: CreateStreamInput) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "You must be logged in to stream" }
  }

  // Check if user already has a LIVE stream (allow creating new if offline or ended)
  const { data: existing } = await supabase
    .from("user_streams")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("status", "live")
    .maybeSingle()

  if (existing) {
    return { error: "You already have a live stream. End your current stream first." }
  }
  
  // Delete any old ended/offline streams to start fresh
  await supabase
    .from("user_streams")
    .delete()
    .eq("user_id", user.id)
    .neq("status", "live")

  // Get active streaming provider
  const streamingProvider = await getActiveStreamingProvider()
  
  // Create stream based on provider
  let streamData: {
    streamKey: string
    rtmpUrl: string
    playbackId?: string
    muxStreamId?: string
    provider: "mux" | "rtmp"
  }

  if (streamingProvider.provider === "mux") {
    // Use Mux (default)
    try {
      const muxStream = await createMuxLiveStream()
      streamData = {
        streamKey: muxStream.streamKey,
        rtmpUrl: muxStream.rtmpUrl,
        playbackId: muxStream.playbackId,
        muxStreamId: muxStream.muxStreamId,
        provider: "mux",
      }
    } catch (muxError) {
      console.error("Mux stream creation failed:", muxError)
      return { error: "Failed to create stream. Please try again or contact support." }
    }
  } else {
    // Use self-hosted RTMP
    streamData = {
      streamKey: generateStreamKey(),
      rtmpUrl: streamingProvider.rtmpUrl,
      playbackId: undefined,
      muxStreamId: undefined,
      provider: "rtmp",
    }
  }

  const { data, error } = await supabase
    .from("user_streams")
    .insert({
      user_id: user.id,
      title: input.title,
      description: input.description,
      game_id: input.game_id,
      stream_key: streamData.streamKey,
      rtmp_url: streamData.rtmpUrl,
      mux_stream_id: streamData.muxStreamId,
      mux_playback_id: streamData.playbackId,
      status: "offline",
      is_public: input.is_public ?? true,
      allow_chat: input.allow_chat ?? true,
      allow_clips: input.allow_clips ?? true,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating stream:", error)
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
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("user_streams")
    .select(`*, game:games(id, name, icon_url)`)
    .eq("user_id", user.id)
    .in("status", ["offline", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Error fetching stream:", error)
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
      game:games(id, name, icon_url),
      user:profiles(id, first_name, last_name, avatar_url)
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
