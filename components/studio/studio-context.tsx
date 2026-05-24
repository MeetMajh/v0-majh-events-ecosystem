"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"

// Types
export interface StudioSource {
  id: string
  type: "webcam" | "screen" | "image" | "video" | "text" | "overlay"
  label: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  visible: boolean
  locked: boolean
  opacity: number
  stream?: MediaStream
  url?: string
  text?: string
  style?: Record<string, string>
}

export interface StudioScene {
  id: string
  name: string
  sources: StudioSource[]
  thumbnail?: string
}

export interface StudioState {
  scenes: StudioScene[]
  activeSceneId: string | null
  previewSceneId: string | null
  selectedSourceId: string | null
  isLive: boolean
  streamKey: string | null
  rtmpUrl: string | null
  viewerCount: number
  audioLevels: Record<string, number>
  isMuted: boolean
  volume: number
}

interface StudioContextValue extends StudioState {
  // Scene actions
  addScene: (name: string) => void
  removeScene: (sceneId: string) => void
  renameScene: (sceneId: string, name: string) => void
  setActiveScene: (sceneId: string) => void
  setPreviewScene: (sceneId: string) => void
  switchToPreview: () => void
  
  // Source actions
  addSource: (sceneId: string, source: Omit<StudioSource, "id">) => void
  removeSource: (sceneId: string, sourceId: string) => void
  updateSource: (sceneId: string, sourceId: string, updates: Partial<StudioSource>) => void
  selectSource: (sourceId: string | null) => void
  
  // Stream actions
  goLive: () => Promise<void>
  endStream: () => Promise<void>
  
  // Audio actions
  setVolume: (volume: number) => void
  toggleMute: () => void
  
  // Media capture
  startWebcam: () => Promise<MediaStream | null>
  startScreenShare: () => Promise<MediaStream | null>
  stopCapture: (stream: MediaStream) => void
}

const StudioContext = createContext<StudioContextValue | null>(null)

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

const defaultScene: StudioScene = {
  id: "default",
  name: "Main Scene",
  sources: []
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [scenes, setScenes] = useState<StudioScene[]>([defaultScene])
  const [activeSceneId, setActiveSceneId] = useState<string | null>("default")
  const [previewSceneId, setPreviewSceneId] = useState<string | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [streamKey, setStreamKey] = useState<string | null>(null)
  const [rtmpUrl, setRtmpUrl] = useState<string | null>(null)
  const [viewerCount, setViewerCount] = useState(0)
  const [audioLevels, setAudioLevels] = useState<Record<string, number>>({})
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolumeState] = useState(100)

  // Scene actions
  const addScene = useCallback((name: string) => {
    const newScene: StudioScene = {
      id: generateId(),
      name,
      sources: []
    }
    setScenes(prev => [...prev, newScene])
  }, [])

  const removeScene = useCallback((sceneId: string) => {
    setScenes(prev => prev.filter(s => s.id !== sceneId))
    if (activeSceneId === sceneId) {
      setActiveSceneId(scenes[0]?.id || null)
    }
    if (previewSceneId === sceneId) {
      setPreviewSceneId(null)
    }
  }, [activeSceneId, previewSceneId, scenes])

  const renameScene = useCallback((sceneId: string, name: string) => {
    setScenes(prev => prev.map(s => 
      s.id === sceneId ? { ...s, name } : s
    ))
  }, [])

  const setActiveScene = useCallback((sceneId: string) => {
    setActiveSceneId(sceneId)
  }, [])

  const setPreviewScene = useCallback((sceneId: string) => {
    setPreviewSceneId(sceneId)
  }, [])

  const switchToPreview = useCallback(() => {
    if (previewSceneId) {
      setActiveSceneId(previewSceneId)
      setPreviewSceneId(null)
    }
  }, [previewSceneId])

  // Source actions
  const addSource = useCallback((sceneId: string, source: Omit<StudioSource, "id">) => {
    const newSource: StudioSource = {
      ...source,
      id: generateId()
    }
    setScenes(prev => prev.map(scene => 
      scene.id === sceneId 
        ? { ...scene, sources: [...scene.sources, newSource] }
        : scene
    ))
  }, [])

  const removeSource = useCallback((sceneId: string, sourceId: string) => {
    setScenes(prev => prev.map(scene => 
      scene.id === sceneId 
        ? { ...scene, sources: scene.sources.filter(s => s.id !== sourceId) }
        : scene
    ))
    if (selectedSourceId === sourceId) {
      setSelectedSourceId(null)
    }
  }, [selectedSourceId])

  const updateSource = useCallback((sceneId: string, sourceId: string, updates: Partial<StudioSource>) => {
    setScenes(prev => prev.map(scene => 
      scene.id === sceneId 
        ? { 
            ...scene, 
            sources: scene.sources.map(s => 
              s.id === sourceId ? { ...s, ...updates } : s
            )
          }
        : scene
    ))
  }, [])

  const selectSource = useCallback((sourceId: string | null) => {
    setSelectedSourceId(sourceId)
  }, [])

  // Stream actions
  const goLive = useCallback(async () => {
    try {
      // Generate stream key if not exists
      const key = `sk_${generateId()}`
      const url = "rtmp://live.majhevents.com/live"
      
      setStreamKey(key)
      setRtmpUrl(url)
      setIsLive(true)
    } catch (error) {
      console.error("Failed to go live:", error)
      throw error
    }
  }, [])

  const endStream = useCallback(async () => {
    setIsLive(false)
    setViewerCount(0)
  }, [])

  // Audio actions
  const setVolume = useCallback((vol: number) => {
    setVolumeState(Math.max(0, Math.min(100, vol)))
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev)
  }, [])

  // Media capture
  const startWebcam = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      })
      return stream
    } catch (error) {
      console.error("Failed to start webcam:", error)
      return null
    }
  }, [])

  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 },
        audio: true
      })
      return stream
    } catch (error) {
      console.error("Failed to start screen share:", error)
      return null
    }
  }, [])

  const stopCapture = useCallback((stream: MediaStream) => {
    stream.getTracks().forEach(track => track.stop())
  }, [])

  const value: StudioContextValue = {
    scenes,
    activeSceneId,
    previewSceneId,
    selectedSourceId,
    isLive,
    streamKey,
    rtmpUrl,
    viewerCount,
    audioLevels,
    isMuted,
    volume,
    addScene,
    removeScene,
    renameScene,
    setActiveScene,
    setPreviewScene,
    switchToPreview,
    addSource,
    removeSource,
    updateSource,
    selectSource,
    goLive,
    endStream,
    setVolume,
    toggleMute,
    startWebcam,
    startScreenShare,
    stopCapture
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
    throw new Error("useStudio must be used within StudioProvider")
  }
  return context
}
