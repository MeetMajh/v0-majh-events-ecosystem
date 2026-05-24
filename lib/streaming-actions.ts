"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ═══════════════════════════════════════════════════════════════════════════════
// MAJH STREAMING ECOSYSTEM - Server Actions
// Unified streaming infrastructure for tournaments, broadcasts, clips, and VODs
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StreamRoom {
  id: string
  tenant_id?: string
  tournament_id?: string
  match_id?: string
  round_id?: string
  room_code: string
  name: string
  description?: string
  room_type: 'match' | 'table' | 'stage' | 'practice' | 'custom'
  max_streams: number
  table_number?: number
  status: 'waiting' | 'ready' | 'live' | 'paused' | 'ended'
  is_feature_room: boolean
  is_recording: boolean
  stream_delay_seconds: number
  allow_spectators: boolean
  chat_enabled: boolean
  viewer_count: number
  peak_viewers: number
  scheduled_at?: string
  started_at?: string
  ended_at?: string
  created_at: string
  updated_at: string
}

export interface PlayerStream {
  id: string
  room_id: string
  user_id: string
  slot_number: number
  player_role: 'player' | 'caster' | 'observer' | 'producer'
  stream_key: string
  ingest_url?: string
  playback_url?: string
  peer_id?: string
  status: 'disconnected' | 'connecting' | 'connected' | 'streaming' | 'error'
  is_muted: boolean
  is_video_enabled: boolean
  latency_ms?: number
  connected_at?: string
  created_at: string
}

export interface BroadcastSession {
  id: string
  tenant_id?: string
  tournament_id?: string
  event_id?: string
  title: string
  description?: string
  producer_id?: string
  status: 'setup' | 'preview' | 'live' | 'paused' | 'ended'
  output_resolution: string
  output_bitrate_kbps: number
  output_framerate: number
  broadcast_delay_seconds: number
  is_recording: boolean
  recording_url?: string
  recording_started_at?: string
  viewer_count: number
  peak_viewers: number
  total_views: number
  scheduled_at?: string
  started_at?: string
  ended_at?: string
  created_at: string
  updated_at: string
}

export interface BroadcastSource {
  id: string
  session_id: string
  source_type: 'player_stream' | 'room' | 'screen' | 'camera' | 'video' | 'image' | 'overlay' | 'text' | 'browser'
  player_stream_id?: string
  room_id?: string
  media_url?: string
  name: string
  volume: number
  is_muted: boolean
  is_active: boolean
  is_available: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface BroadcastScene {
  id: string
  session_id: string
  name: string
  scene_type: 'match' | 'standings' | 'bracket' | 'interview' | 'brb' | 'intro' | 'outro' | 'custom'
  thumbnail_url?: string
  layout_preset: 'single' | 'split' | 'pip' | 'quad' | 'grid' | 'custom'
  is_preview: boolean
  is_program: boolean
  sort_order: number
  items?: BroadcastSceneItem[]
  created_at: string
}

export interface BroadcastSceneItem {
  id: string
  scene_id: string
  source_id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  z_index: number
  is_visible: boolean
  is_locked: boolean
  transition_type: 'cut' | 'fade' | 'slide' | 'zoom'
  transition_duration_ms: number
  source?: BroadcastSource
}

export interface StreamClip {
  id: string
  tenant_id?: string
  broadcast_session_id?: string
  room_id?: string
  match_id?: string
  tournament_id?: string
  title: string
  description?: string
  created_by?: string
  video_url: string
  thumbnail_url?: string
  duration_seconds: number
  start_time_seconds?: number
  end_time_seconds?: number
  clip_type: 'manual' | 'auto_highlight' | 'score_change' | 'reaction_spike' | 'clutch'
  highlight_score: number
  status: 'processing' | 'ready' | 'failed' | 'deleted'
  is_featured: boolean
  is_public: boolean
  view_count: number
  like_count: number
  share_count: number
  clipped_at: string
  published_at?: string
  created_at: string
}

export interface StreamVOD {
  id: string
  tenant_id?: string
  broadcast_session_id?: string
  room_id?: string
  tournament_id?: string
  match_id?: string
  title: string
  description?: string
  video_url: string
  thumbnail_url?: string
  duration_seconds?: number
  file_size_bytes?: number
  status: 'processing' | 'ready' | 'failed' | 'deleted'
  processing_progress: number
  quality_variants: Array<{ quality: string; url: string; bitrate: number }>
  is_featured: boolean
  is_public: boolean
  round_number?: number
  view_count: number
  recorded_at?: string
  published_at?: string
  created_at: string
  chapters?: VODChapter[]
}

export interface VODChapter {
  id: string
  vod_id: string
  title: string
  description?: string
  timestamp_seconds: number
  thumbnail_url?: string
  is_auto_generated: boolean
  chapter_type: 'round_start' | 'score_change' | 'highlight' | 'break' | 'custom'
  created_at: string
}

export interface LiveEvent {
  id: string
  tenant_id?: string
  broadcast_session_id?: string
  tournament_id?: string
  room_id?: string
  title: string
  description?: string
  thumbnail_url?: string
  stream_url?: string
  embed_url?: string
  platform?: string
  status: 'scheduled' | 'live' | 'ended'
  is_featured: boolean
  viewer_count: number
  peak_viewers: number
  category: 'tournament' | 'practice' | 'community' | 'educational' | 'entertainment'
  tags: string[]
  scheduled_at?: string
  started_at?: string
  ended_at?: string
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAM ROOM ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new stream room
 */
export async function createStreamRoom(input: {
  tenantId?: string
  tournamentId?: string
  matchId?: string
  name: string
  tableNumber?: number
  roomType?: StreamRoom['room_type']
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase.rpc('create_stream_room', {
    p_tenant_id: input.tenantId || null,
    p_name: input.name,
    p_tournament_id: input.tournamentId || null,
    p_match_id: input.matchId || null,
    p_table_number: input.tableNumber || null,
    p_room_type: input.roomType || 'match'
  })

  if (error) {
    console.error("Error creating stream room:", error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/studio')
  revalidatePath('/live')
  return { data }
}

/**
 * Join a stream room and get credentials
 */
export async function joinStreamRoom(roomId: string, slotNumber?: number, role: PlayerStream['player_role'] = 'player') {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase.rpc('join_stream_room', {
    p_room_id: roomId,
    p_user_id: user.id,
    p_slot_number: slotNumber || null,
    p_player_role: role
  })

  if (error) {
    console.error("Error joining stream room:", error)
    return { error: error.message }
  }

  return { data }
}

/**
 * Update player stream status (connect/disconnect/streaming)
 */
export async function updateStreamStatus(
  streamKey: string,
  status: PlayerStream['status'],
  playbackUrl?: string,
  latencyMs?: number
) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('update_player_stream_status', {
    p_stream_key: streamKey,
    p_status: status,
    p_playback_url: playbackUrl || null,
    p_latency_ms: latencyMs || null
  })

  if (error) {
    console.error("Error updating stream status:", error)
    return { error: error.message }
  }

  return { data }
}

/**
 * Get stream room by room code
 */
export async function getStreamRoom(roomCode: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_stream_room', {
    p_room_code: roomCode
  })

  if (error) {
    console.error("Error fetching stream room:", error)
    return { error: error.message }
  }

  return { data }
}

/**
 * Get stream room by ID
 */
export async function getStreamRoomById(roomId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_stream_room_by_id', {
    p_room_id: roomId
  })

  if (error) {
    console.error("Error fetching stream room:", error)
    return { error: error.message }
  }

  return { data }
}

/**
 * Get all stream rooms for a tournament
 */
export async function getTournamentStreamRooms(tournamentId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_tournament_stream_rooms', {
    p_tournament_id: tournamentId
  })

  if (error) {
    console.error("Error fetching tournament stream rooms:", error)
    return { error: error.message }
  }

  return { data }
}

/**
 * Get all currently live stream rooms
 */
export async function getLiveStreamRooms(tenantId?: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_live_stream_rooms', {
    p_tenant_id: tenantId || null
  })

  if (error) {
    console.error("Error fetching live stream rooms:", error)
    return { error: error.message }
  }

  return { data }
}

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST SESSION ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new broadcast session
 */
export async function createBroadcastSession(input: {
  tenantId?: string
  title: string
  description?: string
  tournamentId?: string
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase.rpc('create_broadcast_session', {
    p_tenant_id: input.tenantId || null,
    p_producer_id: user.id,
    p_title: input.title,
    p_tournament_id: input.tournamentId || null,
    p_description: input.description || null
  })

  if (error) {
    console.error("Error creating broadcast session:", error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/admin/broadcast')
  return { data }
}

/**
 * Add a source to a broadcast session
 */
export async function addBroadcastSource(input: {
  sessionId: string
  sourceType: BroadcastSource['source_type']
  name: string
  playerStreamId?: string
  roomId?: string
  mediaUrl?: string
  metadata?: Record<string, unknown>
}) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('add_broadcast_source', {
    p_session_id: input.sessionId,
    p_source_type: input.sourceType,
    p_name: input.name,
    p_player_stream_id: input.playerStreamId || null,
    p_room_id: input.roomId || null,
    p_media_url: input.mediaUrl || null,
    p_metadata: input.metadata || {}
  })

  if (error) {
    console.error("Error adding broadcast source:", error)
    return { error: error.message }
  }

  return { data }
}

/**
 * Add source to a scene with positioning
 */
export async function addSourceToScene(input: {
  sceneId: string
  sourceId: string
  x?: number
  y?: number
  width?: number
  height?: number
  zIndex?: number
}) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('add_source_to_scene', {
    p_scene_id: input.sceneId,
    p_source_id: input.sourceId,
    p_x: input.x ?? 0,
    p_y: input.y ?? 0,
    p_width: input.width ?? 100,
    p_height: input.height ?? 100,
    p_z_index: input.zIndex ?? 0
  })

  if (error) {
    console.error("Error adding source to scene:", error)
    return { error: error.message }
  }

  return { data }
}

/**
 * Start a broadcast (go live)
 */
export async function startBroadcast(sessionId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase.rpc('start_broadcast', {
    p_session_id: sessionId,
    p_producer_id: user.id
  })

  if (error) {
    console.error("Error starting broadcast:", error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/admin/broadcast')
  revalidatePath('/live')
  return { data }
}

/**
 * End a broadcast
 */
export async function endBroadcast(sessionId: string, recordingUrl?: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase.rpc('end_broadcast', {
    p_session_id: sessionId,
    p_producer_id: user.id,
    p_recording_url: recordingUrl || null
  })

  if (error) {
    console.error("Error ending broadcast:", error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/admin/broadcast')
  revalidatePath('/live')
  return { data }
}

/**
 * Get broadcast session with all details
 */
export async function getBroadcastSession(sessionId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_broadcast_session', {
    p_session_id: sessionId
  })

  if (error) {
    console.error("Error fetching broadcast session:", error)
    return { error: error.message }
  }

  return { data }
}

/**
 * Switch the active scene in a broadcast
 */
export async function switchBroadcastScene(sessionId: string, sceneId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase.rpc('switch_broadcast_scene', {
    p_session_id: sessionId,
    p_scene_id: sceneId,
    p_producer_id: user.id
  })

  if (error) {
    console.error("Error switching scene:", error)
    return { error: error.message }
  }

  return { data }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIP ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a manual clip
 */
export async function createClip(input: {
  tenantId?: string
  title: string
  videoUrl: string
  durationSeconds: number
  broadcastSessionId?: string
  roomId?: string
  matchId?: string
  tournamentId?: string
  clipType?: StreamClip['clip_type']
  startTimeSeconds?: number
  endTimeSeconds?: number
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase.rpc('create_clip', {
    p_tenant_id: input.tenantId || null,
    p_created_by: user.id,
    p_title: input.title,
    p_video_url: input.videoUrl,
    p_duration_seconds: input.durationSeconds,
    p_broadcast_session_id: input.broadcastSessionId || null,
    p_room_id: input.roomId || null,
    p_match_id: input.matchId || null,
    p_tournament_id: input.tournamentId || null,
    p_clip_type: input.clipType || 'manual',
    p_start_time_seconds: input.startTimeSeconds || null,
    p_end_time_seconds: input.endTimeSeconds || null
  })

  if (error) {
    console.error("Error creating clip:", error)
    return { error: error.message }
  }

  revalidatePath('/live')
  return { data }
}

/**
 * Auto-generate a highlight clip
 */
export async function generateHighlightClip(input: {
  broadcastSessionId: string
  highlightType: 'score_change' | 'reaction_spike' | 'clutch'
  startTimeSeconds: number
  durationSeconds?: number
  highlightScore?: number
  title?: string
}) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('generate_highlight_clip', {
    p_broadcast_session_id: input.broadcastSessionId,
    p_highlight_type: input.highlightType,
    p_start_time_seconds: input.startTimeSeconds,
    p_duration_seconds: input.durationSeconds || 30,
    p_highlight_score: input.highlightScore || 0.8,
    p_title: input.title || null
  })

  if (error) {
    console.error("Error generating highlight clip:", error)
    return { error: error.message }
  }

  return { data }
}

/**
 * Get trending clips
 */
export async function getTrendingClips(limit = 20, tournamentId?: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_trending_clips', {
    p_limit: limit,
    p_tournament_id: tournamentId || null
  })

  if (error) {
    console.error("Error fetching trending clips:", error)
    return { error: error.message }
  }

  return { data: data || [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// VOD ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get tournament VODs
 */
export async function getTournamentVODs(tournamentId: string, limit = 50) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_tournament_vods', {
    p_tournament_id: tournamentId,
    p_limit: limit
  })

  if (error) {
    console.error("Error fetching tournament VODs:", error)
    return { error: error.message }
  }

  return { data: data || [] }
}

/**
 * Add chapter to a VOD
 */
export async function addVODChapter(input: {
  vodId: string
  title: string
  timestampSeconds: number
  chapterType?: VODChapter['chapter_type']
  description?: string
}) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('add_vod_chapter', {
    p_vod_id: input.vodId,
    p_title: input.title,
    p_timestamp_seconds: input.timestampSeconds,
    p_chapter_type: input.chapterType || 'custom',
    p_description: input.description || null
  })

  if (error) {
    console.error("Error adding VOD chapter:", error)
    return { error: error.message }
  }

  return { data }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE HUB ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get live events for the Live Hub
 */
export async function getLiveEvents(category?: LiveEvent['category'], tenantId?: string, limit = 20) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_live_events', {
    p_category: category || null,
    p_tenant_id: tenantId || null,
    p_limit: limit
  })

  if (error) {
    console.error("Error fetching live events:", error)
    return { error: error.message }
  }

  return { data: data || [] }
}

/**
 * Get upcoming scheduled events
 */
export async function getUpcomingEvents(limit = 10) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_upcoming_events', {
    p_limit: limit
  })

  if (error) {
    console.error("Error fetching upcoming events:", error)
    return { error: error.message }
  }

  return { data: data || [] }
}

/**
 * Update viewer count for a stream/broadcast/event
 */
export async function updateViewerCount(
  targetType: 'room' | 'broadcast' | 'live_event',
  targetId: string,
  delta: number
) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('update_viewer_count', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_delta: delta
  })

  if (error) {
    console.error("Error updating viewer count:", error)
    return { error: error.message }
  }

  return { data }
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRECT DATABASE QUERIES (Fallback/Alternative)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all live streams directly from database
 */
export async function getAllLiveStreams() {
  const supabase = await createClient()
  
  // Get live stream rooms
  const { data: rooms, error: roomsError } = await supabase
    .from('stream_rooms')
    .select(`
      *,
      streams:player_streams(*)
    `)
    .eq('status', 'live')
    .order('viewer_count', { ascending: false })

  if (roomsError) {
    console.error("Error fetching live rooms:", roomsError)
  }

  // Get live broadcast sessions
  const { data: broadcasts, error: broadcastsError } = await supabase
    .from('broadcast_sessions')
    .select('*')
    .eq('status', 'live')
    .order('viewer_count', { ascending: false })

  if (broadcastsError) {
    console.error("Error fetching live broadcasts:", broadcastsError)
  }

  // Get live events
  const { data: events, error: eventsError } = await supabase
    .from('live_events')
    .select('*')
    .eq('status', 'live')
    .order('viewer_count', { ascending: false })

  if (eventsError) {
    console.error("Error fetching live events:", eventsError)
  }

  return {
    rooms: rooms || [],
    broadcasts: broadcasts || [],
    events: events || []
  }
}

/**
 * Get all clips with optional filters
 */
export async function getAllClips(filters?: {
  tournamentId?: string
  matchId?: string
  featured?: boolean
  limit?: number
}) {
  const supabase = await createClient()
  
  let query = supabase
    .from('stream_clips')
    .select('*')
    .eq('status', 'ready')
    .eq('is_public', true)
    .order('view_count', { ascending: false })

  if (filters?.tournamentId) {
    query = query.eq('tournament_id', filters.tournamentId)
  }
  if (filters?.matchId) {
    query = query.eq('match_id', filters.matchId)
  }
  if (filters?.featured) {
    query = query.eq('is_featured', true)
  }
  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching clips:", error)
    return { error: error.message }
  }

  return { data: data || [] }
}

/**
 * Get all VODs with optional filters
 */
export async function getAllVODs(filters?: {
  tournamentId?: string
  featured?: boolean
  limit?: number
}) {
  const supabase = await createClient()
  
  let query = supabase
    .from('stream_vods')
    .select(`
      *,
      chapters:vod_chapters(*)
    `)
    .eq('status', 'ready')
    .eq('is_public', true)
    .order('recorded_at', { ascending: false })

  if (filters?.tournamentId) {
    query = query.eq('tournament_id', filters.tournamentId)
  }
  if (filters?.featured) {
    query = query.eq('is_featured', true)
  }
  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching VODs:", error)
    return { error: error.message }
  }

  return { data: data || [] }
}
