"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

// Types
export interface StudioSource {
  id: string
  user_id: string
  name: string
  source_type: "camera" | "screen" | "window" | "image" | "video" | "browser" | "text" | "color"
  config: Record<string, unknown>
  is_active: boolean
  sort_order: number
  // Runtime state
  stream?: MediaStream
  element?: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
}

export interface StudioSceneItem {
  id: string
  scene_id: string
  source_id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  scale_x: number
  scale_y: number
  visible: boolean
  locked: boolean
  sort_order: number
  source?: StudioSource
}

export interface StudioScene {
  id: string
  user_id: string
  name: string
  is_active: boolean
  is_default: boolean
  thumbnail_url?: string
  sort_order: number
  items: StudioSceneItem[]
}

export interface StudioSession {
  id: string
  user_id: string
  title: string
  description?: string
  status: "offline" | "live" | "ended"
  visibility: "public" | "private" | "unlisted"
  stream_key: string
  rtmp_url: string
  playback_url?: string
  started_at?: string
  ended_at?: string
  viewer_count: number
  peak_viewers: number
  chat_enabled: boolean
}

export interface StudioOutput {
  id: string
  user_id: string
  name: string
  platform: "custom" | "twitch" | "youtube" | "kick" | "majh"
  rtmp_url: string
  stream_key?: string
  is_active: boolean
  is_primary: boolean
}

interface StudioContextType {
  // State
  session: StudioSession | null
  sources: StudioSource[]
  scenes: StudioScene[]
  outputs: StudioOutput[]
  activeScene: StudioScene | null
  previewScene: StudioScene | null
  isLive: boolean
  isLoading: boolean
  error: string | null

  // Canvas refs
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>
  programCanvasRef: React.RefObject<HTMLCanvasElement | null>

  // Session actions
  createSession: (title: string, description?: string) => Promise<void>
  updateSession: (updates: Partial<StudioSession>) => Promise<void>
  goLive: () => Promise<void>
  endStream: () => Promise<void>

  // Source actions
  addSource: (type: StudioSource["source_type"], name: string, config?: Record<string, unknown>) => Promise<StudioSource | null>
  removeSource: (sourceId: string) => Promise<void>
  updateSource: (sourceId: string, updates: Partial<StudioSource>) => Promise<void>
  captureCamera: (sourceId: string, deviceId?: string) => Promise<MediaStream | null>
  captureScreen: (sourceId: string) => Promise<MediaStream | null>
  stopCapture: (sourceId: string) => void

  // Scene actions
  addScene: (name: string) => Promise<StudioScene | null>
  removeScene: (sceneId: string) => Promise<void>
  updateScene: (sceneId: string, updates: Partial<StudioScene>) => Promise<void>
  setActiveScene: (sceneId: string) => void
  setPreviewScene: (sceneId: string) => void
  transitionToScene: (sceneId: string) => void

  // Scene item actions
  addItemToScene: (sceneId: string, sourceId: string) => Promise<void>
  removeItemFromScene: (sceneId: string, itemId: string) => Promise<void>
  updateSceneItem: (sceneId: string, itemId: string, updates: Partial<StudioSceneItem>) => Promise<void>

  // Output actions
  addOutput: (name: string, platform: StudioOutput["platform"], rtmpUrl: string, streamKey?: string) => Promise<void>
  removeOutput: (outputId: string) => Promise<void>

  // Utility
  refreshData: () => Promise<void>
}

const StudioContext = createContext<StudioContextType | null>(null)

export function StudioProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()

  // State
  const [session, setSession] = useState<StudioSession | null>(null)
  const [sources, setSources] = useState<StudioSource[]>([])
  const [scenes, setScenes] = useState<StudioScene[]>([])
  const [outputs, setOutputs] = useState<StudioOutput[]>([])
  const [activeScene, setActiveSceneState] = useState<StudioScene | null>(null)
  const [previewScene, setPreviewSceneState] = useState<StudioScene | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Canvas refs
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const programCanvasRef = useRef<HTMLCanvasElement>(null)

  // Stream refs for cleanup
  const streamsRef = useRef<Map<string, MediaStream>>(new Map())

  // Load initial data
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError("Not authenticated")
        return
      }

      // Load session
      const { data: sessionData } = await supabase
        .from("studio_sessions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["offline", "live"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (sessionData) {
        setSession(sessionData)
        setIsLive(sessionData.status === "live")
      }

      // Load sources
      const { data: sourcesData } = await supabase
        .from("studio_sources")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("sort_order")

      setSources(sourcesData || [])

      // Load scenes with items
      const { data: scenesData } = await supabase
        .from("studio_scenes")
        .select(`
          *,
          items:studio_scene_items(
            *,
            source:studio_sources(*)
          )
        `)
        .eq("user_id", user.id)
        .order("sort_order")

      const loadedScenes = (scenesData || []).map(scene => ({
        ...scene,
        items: scene.items || []
      }))
      setScenes(loadedScenes)

      // Set active/preview scenes
      const active = loadedScenes.find(s => s.is_active) || loadedScenes[0]
      if (active) {
        setActiveSceneState(active)
        setPreviewSceneState(active)
      }

      // Load outputs
      const { data: outputsData } = await supabase
        .from("studio_outputs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at")

      setOutputs(outputsData || [])

    } catch (err) {
      console.error("Error loading studio data:", err)
      setError(err instanceof Error ? err.message : "Failed to load studio data")
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  // Session actions
  const createSession = useCallback(async (title: string, description?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("studio_sessions")
      .insert({
        user_id: user.id,
        title,
        description,
        status: "offline"
      })
      .select()
      .single()

    if (error) throw error
    setSession(data)
  }, [supabase])

  const updateSession = useCallback(async (updates: Partial<StudioSession>) => {
    if (!session) return

    const { data, error } = await supabase
      .from("studio_sessions")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", session.id)
      .select()
      .single()

    if (error) throw error
    setSession(data)
  }, [session, supabase])

  const goLive = useCallback(async () => {
    if (!session) throw new Error("No session")

    await updateSession({
      status: "live",
      started_at: new Date().toISOString()
    })
    setIsLive(true)
  }, [session, updateSession])

  const endStream = useCallback(async () => {
    if (!session) return

    await updateSession({
      status: "ended",
      ended_at: new Date().toISOString()
    })
    setIsLive(false)
  }, [session, updateSession])

  // Source actions
  const addSource = useCallback(async (
    type: StudioSource["source_type"],
    name: string,
    config: Record<string, unknown> = {}
  ): Promise<StudioSource | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("studio_sources")
      .insert({
        user_id: user.id,
        name,
        source_type: type,
        config,
        sort_order: sources.length
      })
      .select()
      .single()

    if (error) {
      console.error("Error adding source:", error)
      return null
    }

    setSources(prev => [...prev, data])
    return data
  }, [supabase, sources.length])

  const removeSource = useCallback(async (sourceId: string) => {
    // Stop any active stream
    const stream = streamsRef.current.get(sourceId)
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      streamsRef.current.delete(sourceId)
    }

    await supabase
      .from("studio_sources")
      .delete()
      .eq("id", sourceId)

    setSources(prev => prev.filter(s => s.id !== sourceId))
  }, [supabase])

  const updateSource = useCallback(async (sourceId: string, updates: Partial<StudioSource>) => {
    const { data, error } = await supabase
      .from("studio_sources")
      .update(updates)
      .eq("id", sourceId)
      .select()
      .single()

    if (error) return

    setSources(prev => prev.map(s => s.id === sourceId ? { ...s, ...data } : s))
  }, [supabase])

  const captureCamera = useCallback(async (sourceId: string, deviceId?: string): Promise<MediaStream | null> => {
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: true
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamsRef.current.set(sourceId, stream)

      setSources(prev => prev.map(s => 
        s.id === sourceId ? { ...s, stream } : s
      ))

      return stream
    } catch (err) {
      console.error("Error capturing camera:", err)
      return null
    }
  }, [])

  const captureScreen = useCallback(async (sourceId: string): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })
      streamsRef.current.set(sourceId, stream)

      setSources(prev => prev.map(s => 
        s.id === sourceId ? { ...s, stream } : s
      ))

      return stream
    } catch (err) {
      console.error("Error capturing screen:", err)
      return null
    }
  }, [])

  const stopCapture = useCallback((sourceId: string) => {
    const stream = streamsRef.current.get(sourceId)
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      streamsRef.current.delete(sourceId)
    }

    setSources(prev => prev.map(s => 
      s.id === sourceId ? { ...s, stream: undefined } : s
    ))
  }, [])

  // Scene actions
  const addScene = useCallback(async (name: string): Promise<StudioScene | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("studio_scenes")
      .insert({
        user_id: user.id,
        name,
        sort_order: scenes.length,
        is_default: scenes.length === 0
      })
      .select()
      .single()

    if (error) return null

    const newScene = { ...data, items: [] }
    setScenes(prev => [...prev, newScene])
    
    if (scenes.length === 0) {
      setActiveSceneState(newScene)
      setPreviewSceneState(newScene)
    }

    return newScene
  }, [supabase, scenes.length])

  const removeScene = useCallback(async (sceneId: string) => {
    await supabase
      .from("studio_scenes")
      .delete()
      .eq("id", sceneId)

    setScenes(prev => prev.filter(s => s.id !== sceneId))
  }, [supabase])

  const updateScene = useCallback(async (sceneId: string, updates: Partial<StudioScene>) => {
    const { data, error } = await supabase
      .from("studio_scenes")
      .update(updates)
      .eq("id", sceneId)
      .select()
      .single()

    if (error) return

    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...data } : s))
  }, [supabase])

  const setActiveScene = useCallback((sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId)
    if (scene) {
      setActiveSceneState(scene)
      
      // Update database
      supabase
        .from("studio_scenes")
        .update({ is_active: false })
        .eq("user_id", session?.user_id || "")
        .then(() => {
          supabase
            .from("studio_scenes")
            .update({ is_active: true })
            .eq("id", sceneId)
        })
    }
  }, [scenes, session?.user_id, supabase])

  const setPreviewScene = useCallback((sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId)
    if (scene) {
      setPreviewSceneState(scene)
    }
  }, [scenes])

  const transitionToScene = useCallback((sceneId: string) => {
    setActiveScene(sceneId)
  }, [setActiveScene])

  // Scene item actions
  const addItemToScene = useCallback(async (sceneId: string, sourceId: string) => {
    const { data, error } = await supabase
      .from("studio_scene_items")
      .insert({
        scene_id: sceneId,
        source_id: sourceId,
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        sort_order: 0
      })
      .select(`
        *,
        source:studio_sources(*)
      `)
      .single()

    if (error) return

    setScenes(prev => prev.map(scene => {
      if (scene.id === sceneId) {
        return { ...scene, items: [...scene.items, data] }
      }
      return scene
    }))
  }, [supabase])

  const removeItemFromScene = useCallback(async (sceneId: string, itemId: string) => {
    await supabase
      .from("studio_scene_items")
      .delete()
      .eq("id", itemId)

    setScenes(prev => prev.map(scene => {
      if (scene.id === sceneId) {
        return { ...scene, items: scene.items.filter(i => i.id !== itemId) }
      }
      return scene
    }))
  }, [supabase])

  const updateSceneItem = useCallback(async (sceneId: string, itemId: string, updates: Partial<StudioSceneItem>) => {
    const { data, error } = await supabase
      .from("studio_scene_items")
      .update(updates)
      .eq("id", itemId)
      .select(`
        *,
        source:studio_sources(*)
      `)
      .single()

    if (error) return

    setScenes(prev => prev.map(scene => {
      if (scene.id === sceneId) {
        return {
          ...scene,
          items: scene.items.map(i => i.id === itemId ? data : i)
        }
      }
      return scene
    }))
  }, [supabase])

  // Output actions
  const addOutput = useCallback(async (
    name: string,
    platform: StudioOutput["platform"],
    rtmpUrl: string,
    streamKey?: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from("studio_outputs")
      .insert({
        user_id: user.id,
        name,
        platform,
        rtmp_url: rtmpUrl,
        stream_key: streamKey,
        is_primary: outputs.length === 0
      })
      .select()
      .single()

    if (error) return

    setOutputs(prev => [...prev, data])
  }, [supabase, outputs.length])

  const removeOutput = useCallback(async (outputId: string) => {
    await supabase
      .from("studio_outputs")
      .delete()
      .eq("id", outputId)

    setOutputs(prev => prev.filter(o => o.id !== outputId))
  }, [supabase])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamsRef.current.forEach(stream => {
        stream.getTracks().forEach(track => track.stop())
      })
      streamsRef.current.clear()
    }
  }, [])

  const value: StudioContextType = {
    session,
    sources,
    scenes,
    outputs,
    activeScene,
    previewScene,
    isLive,
    isLoading,
    error,
    previewCanvasRef,
    programCanvasRef,
    createSession,
    updateSession,
    goLive,
    endStream,
    addSource,
    removeSource,
    updateSource,
    captureCamera,
    captureScreen,
    stopCapture,
    addScene,
    removeScene,
    updateScene,
    setActiveScene,
    setPreviewScene,
    transitionToScene,
    addItemToScene,
    removeItemFromScene,
    updateSceneItem,
    addOutput,
    removeOutput,
    refreshData
  }

  return (
    <StudioContext.Provider value={value}>
      {children}
    </StudioContext.Provider>
  )
}

export function useStudio() {
  const context = useContext(StudioContext)
  if (!context) {
    throw new Error("useStudio must be used within a StudioProvider")
  }
  return context
}
