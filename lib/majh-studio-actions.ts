"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"

// ═══════════════════════════════════════════════════════════════════════════════
// MAJH STUDIO - In-Browser Streaming System
// WebRTC-based streaming using LiveKit
// ═══════════════════════════════════════════════════════════════════════════════

export interface StreamSession {
  id: string
  host_id: string
  user_id: string
  title: string
  description?: string
  game_id?: string
  category?: string
  livekit_room_name: string
  status: "offline" | "live" | "ended"
  visibility: "public" | "private" | "unlisted"
  peak_viewers: number
  total_views: number
  total_chat_messages: number
  started_at?: string
  ended_at?: string
  created_at: string
  updated_at?: string
  thumbnail_url?: string
  vod_url?: string
  stream_key?: string
  multistream_enabled: boolean
  chat_enabled: boolean
  clips_enabled: boolean
  host?: {
    id: string
    display_name: string
    avatar_url?: string
  }
  game?: {
    id: string
    name: string
    logo_url?: string
  }
  // Computed properties for compatibility
  is_live?: boolean
  is_public?: boolean
}

export interface StreamLayout {
  id: string
  stream_id: string
  layout_type: "fullscreen" | "picture_in_picture" | "side_by_side"
  camera_enabled: boolean
  camera_position: "top_left" | "top_right" | "bottom_left" | "bottom_right"
  camera_size: "small" | "medium" | "large"
  overlay_enabled: boolean
  overlay_config: Record<string, any>
}

export interface CreateSessionInput {
  title: string
  description?: string
  game_id?: string
  is_public?: boolean
  allow_chat?: boolean
  allow_clips?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveKit Token Generation
// ─────────────────────────────────────────────────────────────────────────────

interface TokenOptions {
  roomName: string
  participantName: string
  participantIdentity: string
  canPublish?: boolean
  canSubscribe?: boolean
}

/**
 * Generate a LiveKit access token
 * In production, use livekit-server-sdk. For now, we'll use a simple JWT.
 */
export async function generateLiveKitToken(options: TokenOptions) {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  
  if (!apiKey || !apiSecret) {
    // Fallback for development - return a mock token
    // In production, this would error
    console.warn("LiveKit credentials not configured - using development mode")
    return {
      token: `dev_token_${options.roomName}_${options.participantIdentity}`,
      wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://livekit.majhevents.com",
    }
  }

  // Use livekit-server-sdk in production
  const { AccessToken } = await import("livekit-server-sdk")
  
  const at = new AccessToken(apiKey, apiSecret, {
    identity: options.participantIdentity,
    name: options.participantName,
  })
  
  at.addGrant({
    roomJoin: true,
    room: options.roomName,
    canPublish: options.canPublish ?? false,
    canSubscribe: options.canSubscribe ?? true,
  })

  return {
    token: await at.toJwt(),
    wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://livekit.majhevents.com",
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Session Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new stream session
 */
export async function createStreamSession(input: CreateSessionInput) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "You must be logged in to stream" }
  }

  // Check for existing active session
  const { data: existing } = await supabase
    .from("stream_sessions")
    .select("id")
    .eq("host_id", user.id)
    .eq("status", "live")
    .single()

  if (existing) {
    return { error: "You already have an active stream. End it first." }
  }

  // Generate unique room name and stream key
  const livekit_room_name = `majh-${nanoid(12)}`
  const stream_key = `sk_${nanoid(24)}`

  const { data, error } = await supabase
    .from("stream_sessions")
    .insert({
      host_id: user.id,
      user_id: user.id,
      title: input.title,
      description: input.description,
      game_id: input.game_id,
      livekit_room_name,
      stream_key,
      status: "offline",
      visibility: input.is_public !== false ? "public" : "private",
      chat_enabled: input.allow_chat ?? true,
      clips_enabled: input.allow_clips ?? true,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating stream session:", error)
    return { error: error.message }
  }

  // Create default layout
  await supabase.from("stream_layouts").insert({
    stream_id: data.id,
    layout_type: "picture_in_picture",
    camera_enabled: true,
    camera_position: "bottom_right",
    camera_size: "small",
    overlay_enabled: true,
  })

  revalidatePath("/dashboard/studio")
  return { data: data as StreamSession }
}

/**
 * Start a stream (go live)
 */
export async function startStreamSession(sessionId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("stream_sessions")
    .update({
      status: "live",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("host_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error starting stream:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/studio")
  revalidatePath("/live")
  return { data: data as StreamSession }
}

/**
 * End a stream
 */
export async function endStreamSession(sessionId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("stream_sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("host_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error ending stream:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/studio")
  revalidatePath("/live")
  return { data: data as StreamSession }
}

/**
 * Get current user's active stream session
 */
export async function getMyStreamSession() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null }
  }

  const { data, error } = await supabase
    .from("stream_sessions")
    .select(`
      *,
      game:games(id, name, logo_url)
    `)
    .eq("host_id", user.id)
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching stream session:", error)
    return { error: error.message }
  }

  return { data: data as StreamSession | null }
}

/**
 * Get stream session by ID
 */
export async function getStreamSession(sessionId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("stream_sessions")
    .select(`
      *,
      host:profiles(id, display_name, avatar_url),
      game:games(id, name, logo_url)
    `)
    .eq("id", sessionId)
    .single()

  if (error) {
    console.error("Error fetching stream session:", error)
    return { error: error.message }
  }

  return { data: data as StreamSession }
}

/**
 * Get all live stream sessions
 */
export async function getLiveStreamSessions(options?: { game_id?: string; limit?: number }) {
  const supabase = await createClient()

  let query = supabase
    .from("stream_sessions")
    .select(`
      *,
      host:profiles(id, display_name, avatar_url),
      game:games(id, name, logo_url)
    `)
    .eq("status", "live")
    .eq("visibility", "public")
    .order("peak_viewers", { ascending: false })

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

  return { data: data as StreamSession[] }
}

/**
 * Update viewer count
 */
export async function updateViewerCount(sessionId: string, delta: number) {
  const supabase = await createClient()

  // Get current count
  const { data: session } = await supabase
    .from("stream_sessions")
    .select("viewer_count, peak_viewers")
    .eq("id", sessionId)
    .single()

  if (!session) return

  const newCount = Math.max(0, (session.viewer_count || 0) + delta)
  const newPeak = Math.max(session.peak_viewers || 0, newCount)

  await supabase
    .from("stream_sessions")
    .update({
      viewer_count: newCount,
      peak_viewers: newPeak,
    })
    .eq("id", sessionId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get stream layout
 */
export async function getStreamLayout(streamId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("stream_layouts")
    .select("*")
    .eq("stream_id", streamId)
    .single()

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching layout:", error)
    return { error: error.message }
  }

  return { data: data as StreamLayout | null }
}

/**
 * Update stream layout
 */
export async function updateStreamLayout(streamId: string, updates: Partial<StreamLayout>) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Verify ownership
  const { data: session } = await supabase
    .from("stream_sessions")
    .select("host_id")
    .eq("id", streamId)
    .single()

  if (session?.host_id !== user.id) {
    return { error: "Not your stream" }
  }

  const { data, error } = await supabase
    .from("stream_layouts")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("stream_id", streamId)
    .select()
    .single()

  if (error) {
    console.error("Error updating layout:", error)
    return { error: error.message }
  }

  return { data: data as StreamLayout }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send chat message
 */
export async function sendChatMessage(streamId: string, message: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Must be logged in to chat" }
  }

  // Check if chat is allowed
  const { data: session } = await supabase
    .from("stream_sessions")
    .select("chat_enabled")
    .eq("id", streamId)
    .single()

  if (!session?.chat_enabled) {
    return { error: "Chat is disabled for this stream" }
  }

  const { data, error } = await supabase
    .from("stream_chat_messages")
    .insert({
      stream_id: streamId,
      user_id: user.id,
      message: message.slice(0, 500), // Limit message length
    })
    .select(`
      *,
      user:profiles(id, display_name, avatar_url)
    `)
    .single()

  if (error) {
    console.error("Error sending message:", error)
    return { error: error.message }
  }

  return { data }
}

/**
 * Get recent chat messages
 */
export async function getChatMessages(streamId: string, limit = 50) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("stream_chat_messages")
    .select(`
      *,
      user:profiles(id, display_name, avatar_url)
    `)
    .eq("stream_id", streamId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching messages:", error)
    return { error: error.message }
  }

  return { data: data?.reverse() || [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// Clipping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a clip from the current stream
 * In production, this would trigger a backend worker to extract the clip
 */
export async function createClip(streamId: string, title: string, durationSeconds = 30) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Must be logged in to create clips" }
  }

  // Check if clipping is allowed
  const { data: session } = await supabase
    .from("stream_sessions")
    .select("clips_enabled, started_at")
    .eq("id", streamId)
    .single()

  if (!session?.clips_enabled) {
    return { error: "Clipping is disabled for this stream" }
  }

  // Calculate timestamp within stream
  const startedAt = new Date(session.started_at || Date.now())
  const now = new Date()
  const streamTimestamp = Math.floor((now.getTime() - startedAt.getTime()) / 1000)

  // Create clip record (in production, this would queue a job to extract the video)
  const { data, error } = await supabase
    .from("stream_clips")
    .insert({
      stream_id: streamId,
      creator_id: user.id,
      title,
      clip_url: "", // Would be filled by worker
      duration_seconds: durationSeconds,
      stream_timestamp_start: Math.max(0, streamTimestamp - durationSeconds),
      stream_timestamp_end: streamTimestamp,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating clip:", error)
    return { error: error.message }
  }

  return { data, message: "Clip is being processed. It will appear in your clips shortly." }
}

// ──────────────────────��──────────────────────────────────────────────────────
// Viewer Tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Join stream as viewer
 */
export async function joinStream(streamId: string, sessionId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from("stream_viewers")
    .upsert({
      stream_id: streamId,
      user_id: user?.id || null,
      session_id: sessionId,
      joined_at: new Date().toISOString(),
      left_at: null,
    }, {
      onConflict: "stream_id,session_id",
    })

  if (!error) {
    await updateViewerCount(streamId, 1)
  }

  return { success: !error }
}

/**
 * Leave stream as viewer
 */
export async function leaveStream(streamId: string, sessionId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("stream_viewers")
    .update({ left_at: new Date().toISOString() })
    .eq("stream_id", streamId)
    .eq("session_id", sessionId)

  if (!error) {
    await updateViewerCount(streamId, -1)
  }

  return { success: !error }
}
