"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import { createMuxLiveStream, deleteMuxLiveStream, getMuxLiveStream, getMuxAsset } from "@/lib/mux"
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
    .select("*")
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
 * End streaming - Fetch VOD metadata from Mux and save playback URL
 */
export async function endStream(streamId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get the current stream to access Mux IDs
  const { data: stream, error: fetchError } = await supabase
    .from("user_streams")
    .select("*")
    .eq("id", streamId)
    .eq("user_id", user.id)
    .eq("status", "live")
    .single()

  if (fetchError || !stream) {
    return { error: "Stream not found or not live" }
  }

  // Try to fetch Mux stream to get recording asset ID
  let playbackId: string | null = null
  let assetId: string | null = null
  
  if (stream.mux_stream_id) {
    try {
      const muxStream = await getMuxLiveStream(stream.mux_stream_id)
      
      if (muxStream?.recent_asset_ids?.[0]) {
        assetId = muxStream.recent_asset_ids[0]
        
        // Retry logic - Mux may need time to process the asset
        let retries = 0
        let asset = null
        
        while (retries < 3 && !asset?.playback_ids?.[0]) {
          try {
            const { getMuxAsset } = await import("@/lib/mux")
            asset = await getMuxAsset(assetId)
            
            if (asset?.playback_ids?.[0]?.id) {
              playbackId = asset.playback_ids[0].id
              break
            }
          } catch (err) {
            console.log(`[v0] Mux asset fetch attempt ${retries + 1} failed, retrying...`)
          }
          
          // Wait 2 seconds before retry
          retries++
          if (retries < 3) {
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }
    } catch (err) {
      console.error("[v0] Error fetching Mux stream or asset:", err)
      // Continue anyway - VOD will be saved with null playback_id and can be filled later
    }
  }

  // Generate playback URL if we have a playback ID
  const playbackUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null

  const { data, error } = await supabase
    .from("user_streams")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      mux_playback_id: playbackId,
      playback_url: playbackUrl,
      mux_asset_id: assetId,
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
  revalidatePath("/live/vods")
  revalidatePath("/dashboard/recordings")
  return { data: data as UserStream }
}

/**
 * Manually start streaming (user clicks "I'm streaming now" button)
 * Used when OBS is already streaming but system hasn't detected it yet
 */
export async function manuallyStartStreaming(streamId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Get the stream to access mux_playback_id
  const { data: stream, error: fetchError } = await supabase
    .from("user_streams")
    .select("*")
    .eq("id", streamId)
    .eq("user_id", user.id)
    .single()

  if (fetchError || !stream) {
    return { error: "Stream not found" }
  }

  // Generate playback URL from mux_playback_id
  let playbackUrl = stream.playback_url
  if (!playbackUrl && stream.mux_playback_id) {
    playbackUrl = `https://stream.mux.com/${stream.mux_playback_id}.m3u8`
  }

  const { data, error } = await supabase
    .from("user_streams")
    .update({
      status: "live",
      started_at: new Date().toISOString(),
      playback_url: playbackUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", streamId)
    .eq("user_id", user.id)
    .eq("status", "offline")
    .select()
    .single()

  if (error) {
    console.error("Error starting stream manually:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/stream")
  return { data: data as UserStream }
}

/**
 * Get live stream status (health check)
 * Checks if stream is actually active on Mux
 */
export async function checkStreamStatus(streamId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data: stream, error: fetchError } = await supabase
    .from("user_streams")
    .select("*")
    .eq("id", streamId)
    .eq("user_id", user.id)
    .single()

  if (fetchError) {
    return { error: fetchError.message }
  }

  // If stream is already live, return current status
  if (stream.status === "live") {
    return { 
      data: { 
        status: "live",
        isActive: true,
        started_at: stream.started_at
      } 
    }
  }

  // Check Mux API to see if stream is actually active
  if (stream.mux_stream_id) {
    try {
      const muxResponse = await fetch(
        `https://api.mux.com/video/v1/live_streams/${stream.mux_stream_id}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`
            ).toString("base64")}`,
          },
        }
      )

      if (muxResponse.ok) {
        const muxData = await muxResponse.json()
        const isActive = muxData.data?.status === "active"

        // If Mux says active but our DB says offline, auto-update
        if (isActive && stream.status === "offline") {
          const { data: updated } = await supabase
            .from("user_streams")
            .update({
              status: "live",
              started_at: new Date().toISOString(),
            })
            .eq("id", streamId)
            .select()
            .single()
          
          return { 
            data: { 
              status: "live",
              isActive: true,
              autoDetected: true,
              started_at: updated?.started_at
            } 
          }
        }

        return { 
          data: { 
            status: stream.status,
            isActive,
            muxStatus: muxData.data?.status
          } 
        }
      }
    } catch (err) {
      console.error("Error checking Mux stream status:", err)
      // Fall through to return current status
    }
  }

  return { 
    data: { 
      status: stream.status,
      isActive: false
    } 
  }
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
