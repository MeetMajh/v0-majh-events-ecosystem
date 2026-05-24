"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ═══════════════════════════════════════════════════════════════════════════════
// MAJH STUDIO PRO - Broadcast Production System
// Scene management, source control, live switching
// ═══════════════════════════════════════════════════════════════════════════════

export interface StudioSource {
  id: string
  session_id: string
  user_id: string
  source_type: "webcam" | "screen" | "match" | "clip" | "image" | "browser" | "rtmp"
  label: string
  is_active: boolean
  z_index: number
  config: Record<string, any>
  position_x: number
  position_y: number
  width: number
  height: number
  opacity: number
  match_id?: string
  clip_url?: string
}

export interface StudioScene {
  id: string
  session_id: string
  user_id: string
  name: string
  is_active: boolean
  is_preview: boolean
  scene_order: number
  background_color: string
  background_image?: string
  transition_type: "cut" | "fade" | "wipe" | "slide"
  transition_duration: number
  items?: StudioSceneItem[]
}

export interface StudioSceneItem {
  id: string
  scene_id: string
  source_id: string
  position_x: number
  position_y: number
  width: number
  height: number
  opacity: number
  z_index: number
  is_visible: boolean
  crop_top: number
  crop_bottom: number
  crop_left: number
  crop_right: number
  source?: StudioSource
}

export interface StudioOverlay {
  id: string
  session_id: string
  overlay_type: "match_score" | "player_cam" | "chat" | "alerts" | "custom"
  label: string
  is_visible: boolean
  position_x: number
  position_y: number
  width: number
  height: number
  match_id?: string
  tournament_id?: string
  config: Record<string, any>
}

export interface StudioOutput {
  id: string
  session_id: string
  platform: "majh" | "twitch" | "youtube" | "kick" | "custom"
  rtmp_url?: string
  stream_key?: string
  is_active: boolean
  status: "idle" | "connecting" | "live" | "error"
  error_message?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCES
// ─────────────────────────────────────────────────────────────────────────────

export async function createSource(input: {
  session_id: string
  source_type: StudioSource["source_type"]
  label: string
  config?: Record<string, any>
  match_id?: string
  clip_url?: string
}): Promise<{ source: StudioSource | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { source: null, error: "Not authenticated" }
  }

  const { data, error } = await supabase
    .from("studio_sources")
    .insert({
      session_id: input.session_id,
      user_id: user.id,
      source_type: input.source_type,
      label: input.label,
      config: input.config || {},
      match_id: input.match_id,
      clip_url: input.clip_url,
    })
    .select()
    .single()

  if (error) {
    return { source: null, error: error.message }
  }

  return { source: data as StudioSource, error: null }
}

export async function getSources(sessionId: string): Promise<StudioSource[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("studio_sources")
    .select("*")
    .eq("session_id", sessionId)
    .order("z_index", { ascending: true })

  if (error) {
    console.error("Error fetching sources:", error)
    return []
  }

  return data as StudioSource[]
}

export async function updateSource(
  sourceId: string,
  updates: Partial<StudioSource>
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("studio_sources")
    .update(updates)
    .eq("id", sourceId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function deleteSource(sourceId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("studio_sources")
    .delete()
    .eq("id", sourceId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENES
// ─────────────────────────────────────────────────────────────────────────────

export async function createScene(input: {
  session_id: string
  name: string
  background_color?: string
}): Promise<{ scene: StudioScene | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { scene: null, error: "Not authenticated" }
  }

  // Get current max order
  const { data: existing } = await supabase
    .from("studio_scenes")
    .select("scene_order")
    .eq("session_id", input.session_id)
    .order("scene_order", { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].scene_order + 1 : 0

  const { data, error } = await supabase
    .from("studio_scenes")
    .insert({
      session_id: input.session_id,
      user_id: user.id,
      name: input.name,
      background_color: input.background_color || "#000000",
      scene_order: nextOrder,
    })
    .select()
    .single()

  if (error) {
    return { scene: null, error: error.message }
  }

  return { scene: data as StudioScene, error: null }
}

export async function getScenes(sessionId: string): Promise<StudioScene[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("studio_scenes")
    .select(`
      *,
      items:studio_scene_items(
        *,
        source:studio_sources(*)
      )
    `)
    .eq("session_id", sessionId)
    .order("scene_order", { ascending: true })

  if (error) {
    console.error("Error fetching scenes:", error)
    return []
  }

  return data as StudioScene[]
}

export async function updateScene(
  sceneId: string,
  updates: Partial<StudioScene>
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("studio_scenes")
    .update(updates)
    .eq("id", sceneId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function deleteScene(sceneId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  // First delete scene items
  await supabase
    .from("studio_scene_items")
    .delete()
    .eq("scene_id", sceneId)
  
  const { error } = await supabase
    .from("studio_scenes")
    .delete()
    .eq("id", sceneId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE SWITCHING (The Core Feature)
// ─────────────────────────────────────────────────────────────────────────────

export async function switchScene(input: {
  session_id: string
  scene_id: string
  transition?: "cut" | "fade" | "wipe" | "slide"
  duration_ms?: number
}): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  // Set all scenes to inactive
  await supabase
    .from("studio_scenes")
    .update({ is_active: false, is_preview: false })
    .eq("session_id", input.session_id)
  
  // Set target scene to active
  const { error } = await supabase
    .from("studio_scenes")
    .update({ 
      is_active: true,
      transition_type: input.transition || "cut",
      transition_duration: input.duration_ms || 300,
    })
    .eq("id", input.scene_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function setPreviewScene(input: {
  session_id: string
  scene_id: string
}): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  // Clear preview from all scenes
  await supabase
    .from("studio_scenes")
    .update({ is_preview: false })
    .eq("session_id", input.session_id)
  
  // Set target scene as preview
  const { error } = await supabase
    .from("studio_scenes")
    .update({ is_preview: true })
    .eq("id", input.scene_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function transitionPreviewToProgram(sessionId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  // Get the preview scene
  const { data: preview } = await supabase
    .from("studio_scenes")
    .select("id, transition_type, transition_duration")
    .eq("session_id", sessionId)
    .eq("is_preview", true)
    .single()
  
  if (!preview) {
    return { success: false, error: "No preview scene set" }
  }

  // Clear active and preview from all
  await supabase
    .from("studio_scenes")
    .update({ is_active: false, is_preview: false })
    .eq("session_id", sessionId)
  
  // Set preview as active
  const { error } = await supabase
    .from("studio_scenes")
    .update({ is_active: true })
    .eq("id", preview.id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE ITEMS
// ─────────────────────────────────────────────────────────────────────────────

export async function addSourceToScene(input: {
  scene_id: string
  source_id: string
  position?: { x: number; y: number }
  size?: { width: number; height: number }
}): Promise<{ item: StudioSceneItem | null; error: string | null }> {
  const supabase = await createClient()
  
  // Get current max z_index
  const { data: existing } = await supabase
    .from("studio_scene_items")
    .select("z_index")
    .eq("scene_id", input.scene_id)
    .order("z_index", { ascending: false })
    .limit(1)

  const nextZ = existing && existing.length > 0 ? existing[0].z_index + 1 : 0

  const { data, error } = await supabase
    .from("studio_scene_items")
    .insert({
      scene_id: input.scene_id,
      source_id: input.source_id,
      position_x: input.position?.x || 0,
      position_y: input.position?.y || 0,
      width: input.size?.width || 100,
      height: input.size?.height || 100,
      z_index: nextZ,
    })
    .select()
    .single()

  if (error) {
    return { item: null, error: error.message }
  }

  return { item: data as StudioSceneItem, error: null }
}

export async function updateSceneItem(
  itemId: string,
  updates: Partial<StudioSceneItem>
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("studio_scene_items")
    .update(updates)
    .eq("id", itemId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function removeSourceFromScene(itemId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("studio_scene_items")
    .delete()
    .eq("id", itemId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAYS (Tournament-Integrated)
// ─────────────────────────────────────────────────────────────────────────────

export async function createOverlay(input: {
  session_id: string
  overlay_type: StudioOverlay["overlay_type"]
  label: string
  match_id?: string
  tournament_id?: string
  config?: Record<string, any>
}): Promise<{ overlay: StudioOverlay | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { overlay: null, error: "Not authenticated" }
  }

  const { data, error } = await supabase
    .from("studio_overlays")
    .insert({
      session_id: input.session_id,
      user_id: user.id,
      overlay_type: input.overlay_type,
      label: input.label,
      match_id: input.match_id,
      tournament_id: input.tournament_id,
      config: input.config || {},
    })
    .select()
    .single()

  if (error) {
    return { overlay: null, error: error.message }
  }

  return { overlay: data as StudioOverlay, error: null }
}

export async function getOverlays(sessionId: string): Promise<StudioOverlay[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("studio_overlays")
    .select("*")
    .eq("session_id", sessionId)

  if (error) {
    console.error("Error fetching overlays:", error)
    return []
  }

  return data as StudioOverlay[]
}

export async function toggleOverlay(
  overlayId: string,
  visible: boolean
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("studio_overlays")
    .update({ is_visible: visible })
    .eq("id", overlayId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUTS (Multi-stream)
// ─────────────────────────────────────────────────────────────────────────────

export async function getOutputs(sessionId: string): Promise<StudioOutput[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("studio_outputs")
    .select("*")
    .eq("session_id", sessionId)

  if (error) {
    console.error("Error fetching outputs:", error)
    return []
  }

  return data as StudioOutput[]
}

export async function addOutput(input: {
  session_id: string
  platform: StudioOutput["platform"]
  rtmp_url?: string
  stream_key?: string
}): Promise<{ output: StudioOutput | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { output: null, error: "Not authenticated" }
  }

  const { data, error } = await supabase
    .from("studio_outputs")
    .insert({
      session_id: input.session_id,
      user_id: user.id,
      platform: input.platform,
      rtmp_url: input.rtmp_url,
      stream_key: input.stream_key,
    })
    .select()
    .single()

  if (error) {
    return { output: null, error: error.message }
  }

  return { output: data as StudioOutput, error: null }
}

export async function updateOutputStatus(
  outputId: string,
  status: StudioOutput["status"],
  errorMessage?: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("studio_outputs")
    .update({ 
      status,
      error_message: errorMessage || null,
    })
    .eq("id", outputId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTANT REPLAY
// ─────────────────────────────────────────────────────────────────────────────

export async function triggerInstantReplay(input: {
  session_id: string
  seconds_back?: number
}): Promise<{ clip_url: string | null; error: string | null }> {
  const supabase = await createClient()
  const secondsBack = input.seconds_back || 30
  
  // Get the last N seconds of buffer chunks
  const cutoffTime = new Date(Date.now() - secondsBack * 1000).toISOString()
  
  const { data, error } = await supabase
    .from("studio_replay_buffer")
    .select("*")
    .eq("session_id", input.session_id)
    .gte("timestamp_start", cutoffTime)
    .order("chunk_index", { ascending: true })

  if (error || !data || data.length === 0) {
    return { clip_url: null, error: "No replay buffer available" }
  }

  // In a real implementation, this would stitch the chunks together
  // For now, return the most recent chunk
  return { clip_url: data[data.length - 1].chunk_url, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export async function savePreset(input: {
  name: string
  description?: string
  session_id: string
}): Promise<{ preset_id: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { preset_id: null, error: "Not authenticated" }
  }

  // Get current scenes and sources
  const [scenes, sources, overlays] = await Promise.all([
    getScenes(input.session_id),
    getSources(input.session_id),
    getOverlays(input.session_id),
  ])

  const presetData = {
    scenes: scenes.map(s => ({
      name: s.name,
      background_color: s.background_color,
      transition_type: s.transition_type,
      items: s.items,
    })),
    sources: sources.map(s => ({
      source_type: s.source_type,
      label: s.label,
      config: s.config,
    })),
    overlays: overlays.map(o => ({
      overlay_type: o.overlay_type,
      label: o.label,
      config: o.config,
    })),
  }

  const { data, error } = await supabase
    .from("studio_presets")
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description,
      preset_data: presetData,
    })
    .select("id")
    .single()

  if (error) {
    return { preset_id: null, error: error.message }
  }

  return { preset_id: data.id, error: null }
}

export async function loadPreset(presetId: string, sessionId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  const { data: preset, error } = await supabase
    .from("studio_presets")
    .select("preset_data")
    .eq("id", presetId)
    .single()

  if (error || !preset) {
    return { success: false, error: "Preset not found" }
  }

  // Apply preset data to session
  // This would recreate sources, scenes, and overlays
  // Implementation depends on exact requirements

  return { success: true, error: null }
}

export async function getPresets(): Promise<any[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from("studio_presets")
    .select("id, name, description, is_default, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return []
  }

  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// TOURNAMENT DATA FETCH (For Overlays)
// ─────────────────────────────────────────────────────────────────────────────

export async function getLiveMatchOverlayData(matchId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("matches")
    .select(`
      id,
      round,
      table_number,
      status,
      player1_score,
      player2_score,
      player1:profiles!player1_id(id, display_name, avatar_url),
      player2:profiles!player2_id(id, display_name, avatar_url),
      tournament:tournaments(id, name, game_id)
    `)
    .eq("id", matchId)
    .single()

  if (error) {
    return null
  }

  return {
    match: data,
    // Add computed fields
    isMatchPoint: (data.player1_score >= 2 || data.player2_score >= 2) && Math.abs(data.player1_score - data.player2_score) <= 1,
    momentum: data.player1_score > data.player2_score ? "player1" : data.player2_score > data.player1_score ? "player2" : "even",
  }
}

export async function getTournamentStandingsOverlayData(tournamentId: string, limit = 8) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("standings")
    .select(`
      rank,
      wins,
      losses,
      points,
      player:profiles!player_id(id, display_name, avatar_url)
    `)
    .eq("tournament_id", tournamentId)
    .order("rank", { ascending: true })
    .limit(limit)

  if (error) {
    return []
  }

  return data
}
