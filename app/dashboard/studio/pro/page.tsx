"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Radio,
  Video,
  Camera,
  Monitor,
  Mic,
  MicOff,
  VideoOff,
  Settings,
  Layers,
  Users,
  MessageSquare,
  Scissors,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Play,
  Square,
  SkipBack,
  Volume2,
  VolumeX,
  Maximize,
  ChevronRight,
  Layout,
  Image,
  Globe,
  Gamepad2,
  Trophy,
  Clock,
  Zap,
  Copy,
  Save,
  MoreVertical,
  ArrowRightLeft,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  createScene,
  createSource,
  switchScene,
  setPreviewScene,
  transitionPreviewToProgram,
  addSourceToScene,
  updateSceneItem,
  createOverlay,
  toggleOverlay,
  triggerInstantReplay,
  savePreset,
  type StudioScene,
  type StudioSource,
  type StudioOverlay,
} from "@/lib/studio-pro-actions"

const fetcher = (url: string) => fetch(url).then(res => res.json())

// ═══════════════════════════════════════════════════════════════════════════════
// MAJH STUDIO PRO - Broadcast Production Control Room
// ═══════════════════════════════════════════════════════════════════════════════

export default function StudioProPage() {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [streamTitle, setStreamTitle] = useState("")
  const [selectedGame, setSelectedGame] = useState("")
  
  // Scenes state
  const [scenes, setScenes] = useState<StudioScene[]>([])
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
  const [previewSceneId, setPreviewSceneId] = useState<string | null>(null)
  
  // Sources state
  const [sources, setSources] = useState<StudioSource[]>([])
  
  // Overlays state
  const [overlays, setOverlays] = useState<StudioOverlay[]>([])
  
  // Media state
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  
  // Audio levels
  const [audioLevels, setAudioLevels] = useState<Record<string, number>>({
    mic: 80,
    desktop: 100,
    music: 50,
  })
  const [mutedTracks, setMutedTracks] = useState<Record<string, boolean>>({})
  
  // UI state
  const [showAddSource, setShowAddSource] = useState(false)
  const [showAddScene, setShowAddScene] = useState(false)
  const [showAddOverlay, setShowAddOverlay] = useState(false)
  const [transitionType, setTransitionType] = useState<"cut" | "fade" | "wipe">("cut")
  const [transitionDuration, setTransitionDuration] = useState(300)
  
  // Refs
  const previewRef = useRef<HTMLDivElement>(null)
  const programRef = useRef<HTMLDivElement>(null)
  
  // Fetch games
  const { data: gamesData } = useSWR("/api/games", fetcher)
  const games = gamesData?.games || []
  
  // Fetch tournaments (for overlay)
  const { data: tournamentsData } = useSWR("/api/tournaments?limit=10", fetcher)
  const tournaments = tournamentsData?.tournaments || []
  
  // Fetch matches (for overlay)
  const { data: matchesData } = useSWR("/api/matches?status=in_progress&limit=10", fetcher)
  const matches = matchesData?.matches || []

  // Initialize default scenes on first load
  useEffect(() => {
    if (sessionId && scenes.length === 0) {
      // Create default scenes
      const defaultScenes = [
        { name: "Starting Soon", color: "#1a1a2e" },
        { name: "Main Scene", color: "#000000" },
        { name: "Caster Desk", color: "#1a1a2e" },
        { name: "Break Screen", color: "#2d1b4e" },
      ]
      
      defaultScenes.forEach(async (s, i) => {
        const { scene } = await createScene({
          session_id: sessionId,
          name: s.name,
          background_color: s.color,
        })
        if (scene) {
          setScenes(prev => [...prev, scene])
          if (i === 0) {
            setActiveSceneId(scene.id)
          }
        }
      })
    }
  }, [sessionId, scenes.length])

  // ─────────────────────────────────────────────────────────────────────────────
  // Source Management
  // ─────────────────────────────────────────────────────────────────────────────
  
  const addWebcamSource = async () => {
    if (!sessionId) return
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setCameraStream(stream)
      
      const { source } = await createSource({
        session_id: sessionId,
        source_type: "webcam",
        label: "Webcam",
        config: { deviceId: stream.getVideoTracks()[0]?.getSettings().deviceId },
      })
      
      if (source) {
        setSources(prev => [...prev, source])
      }
    } catch (err) {
      console.error("Failed to access webcam:", err)
    }
  }
  
  const addScreenShare = async () => {
    if (!sessionId) return
    
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: "always" },
        audio: true,
      })
      setScreenStream(stream)
      
      const { source } = await createSource({
        session_id: sessionId,
        source_type: "screen",
        label: "Screen Share",
      })
      
      if (source) {
        setSources(prev => [...prev, source])
      }
    } catch (err) {
      console.error("Failed to share screen:", err)
    }
  }
  
  const addMatchSource = async (matchId: string, matchName: string) => {
    if (!sessionId) return
    
    const { source } = await createSource({
      session_id: sessionId,
      source_type: "match",
      label: matchName,
      match_id: matchId,
    })
    
    if (source) {
      setSources(prev => [...prev, source])
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Scene Switching
  // ─────────────────────────────────────────────────────────────────────────────
  
  const handleSwitchScene = async (sceneId: string) => {
    if (!sessionId) return
    
    await switchScene({
      session_id: sessionId,
      scene_id: sceneId,
      transition: transitionType,
      duration_ms: transitionDuration,
    })
    
    setActiveSceneId(sceneId)
  }
  
  const handleSetPreview = async (sceneId: string) => {
    if (!sessionId) return
    
    await setPreviewScene({
      session_id: sessionId,
      scene_id: sceneId,
    })
    
    setPreviewSceneId(sceneId)
  }
  
  const handleTransition = async () => {
    if (!sessionId || !previewSceneId) return
    
    await transitionPreviewToProgram(sessionId)
    setActiveSceneId(previewSceneId)
    setPreviewSceneId(null)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Overlays
  // ─────────────────────────────────────────────────────────────────────────────
  
  const handleAddOverlay = async (type: StudioOverlay["overlay_type"], matchId?: string) => {
    if (!sessionId) return
    
    const { overlay } = await createOverlay({
      session_id: sessionId,
      overlay_type: type,
      label: type === "match_score" ? "Match Score" : type === "chat" ? "Chat Overlay" : type,
      match_id: matchId,
    })
    
    if (overlay) {
      setOverlays(prev => [...prev, overlay])
    }
  }
  
  const handleToggleOverlay = async (overlayId: string, visible: boolean) => {
    await toggleOverlay(overlayId, visible)
    setOverlays(prev => prev.map(o => 
      o.id === overlayId ? { ...o, is_visible: visible } : o
    ))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Instant Replay
  // ─────────────────────────────────────────────────────────────────────────────
  
  const handleInstantReplay = async (seconds = 30) => {
    if (!sessionId) return
    
    const { clip_url } = await triggerInstantReplay({
      session_id: sessionId,
      seconds_back: seconds,
    })
    
    if (clip_url) {
      // Play the replay - in a real implementation this would switch to a replay scene
      console.log("Playing instant replay:", clip_url)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Go Live / End Stream
  // ─────────────────────────────────────────────────────────────────────────────
  
  const handleGoLive = async () => {
    // Create session if not exists
    if (!sessionId) {
      const response = await fetch("/api/studio/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: streamTitle || "Untitled Stream",
          game_id: selectedGame || undefined,
        }),
      })
      const data = await response.json()
      if (data.session) {
        setSessionId(data.session.id)
      }
    }
    
    setIsLive(true)
  }
  
  const handleEndStream = async () => {
    setIsLive(false)
    // Clean up streams
    screenStream?.getTracks().forEach(t => t.stop())
    cameraStream?.getTracks().forEach(t => t.stop())
    setScreenStream(null)
    setCameraStream(null)
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-[#0a0a0f] text-white overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/studio" className="text-sm text-muted-foreground hover:text-white">
              Back to Studio
            </Link>
            <div className="h-4 w-px bg-white/20" />
            <span className="font-bold text-primary">MAJH STUDIO PRO</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Input
              placeholder="Stream Title"
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              className="w-64 bg-white/5 border-white/10"
            />
            
            <Select value={selectedGame} onValueChange={setSelectedGame}>
              <SelectTrigger className="w-40 bg-white/5 border-white/10">
                <SelectValue placeholder="Game" />
              </SelectTrigger>
              <SelectContent>
                {games.map((game: any) => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {isLive ? (
              <Button variant="destructive" onClick={handleEndStream}>
                <Square className="h-4 w-4 mr-2" />
                End Stream
              </Button>
            ) : (
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleGoLive}>
                <Radio className="h-4 w-4 mr-2" />
                Go Live
              </Button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Sources */}
          <aside className="w-64 border-r border-white/10 flex flex-col">
            <div className="p-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Sources</h3>
                <Dialog open={showAddSource} onOpenChange={setShowAddSource}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-6 w-6">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Source</DialogTitle>
                      <DialogDescription>Choose a source type to add to your stream</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3 py-4">
                      <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => { addWebcamSource(); setShowAddSource(false); }}>
                        <Camera className="h-6 w-6" />
                        <span className="text-xs">Webcam</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => { addScreenShare(); setShowAddSource(false); }}>
                        <Monitor className="h-6 w-6" />
                        <span className="text-xs">Screen Share</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex-col gap-2">
                        <Image className="h-6 w-6" />
                        <span className="text-xs">Image</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex-col gap-2">
                        <Globe className="h-6 w-6" />
                        <span className="text-xs">Browser</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex-col gap-2 col-span-2">
                        <Gamepad2 className="h-6 w-6" />
                        <span className="text-xs">Live Match Feed</span>
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                      source.is_active ? "bg-primary/20" : "bg-white/5 hover:bg-white/10"
                    )}
                  >
                    {source.source_type === "webcam" && <Camera className="h-4 w-4 text-blue-400" />}
                    {source.source_type === "screen" && <Monitor className="h-4 w-4 text-green-400" />}
                    {source.source_type === "match" && <Gamepad2 className="h-4 w-4 text-purple-400" />}
                    {source.source_type === "image" && <Image className="h-4 w-4 text-yellow-400" />}
                    <span className="text-sm flex-1 truncate">{source.label}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-50 hover:opacity-100">
                      {source.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </Button>
                  </div>
                ))}
                
                {sources.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No sources added yet
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* Audio Mixer */}
            <div className="border-t border-white/10 p-3">
              <h3 className="text-sm font-semibold mb-3">Audio Mixer</h3>
              <div className="space-y-3">
                {Object.entries(audioLevels).map(([track, level]) => (
                  <div key={track} className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setMutedTracks(prev => ({ ...prev, [track]: !prev[track] }))}
                    >
                      {mutedTracks[track] ? <VolumeX className="h-3 w-3 text-red-400" /> : <Volume2 className="h-3 w-3" />}
                    </Button>
                    <span className="text-xs w-14 capitalize">{track}</span>
                    <Slider
                      value={[level]}
                      max={100}
                      step={1}
                      onValueChange={([v]) => setAudioLevels(prev => ({ ...prev, [track]: v }))}
                      className="flex-1"
                      disabled={mutedTracks[track]}
                    />
                    <span className="text-xs w-8 text-right text-muted-foreground">{level}%</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Center - Preview & Program */}
          <main className="flex-1 flex flex-col p-4 gap-4">
            {/* Preview & Program Row */}
            <div className="flex gap-4 flex-1">
              {/* Preview */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">PREVIEW</span>
                  <Badge variant="outline" className="text-xs">
                    {scenes.find(s => s.id === previewSceneId)?.name || "None"}
                  </Badge>
                </div>
                <div
                  ref={previewRef}
                  className="flex-1 rounded-lg border-2 border-green-500/50 bg-black relative overflow-hidden"
                >
                  {/* Preview content */}
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    {previewSceneId ? (
                      <span className="text-lg">{scenes.find(s => s.id === previewSceneId)?.name}</span>
                    ) : (
                      <span>Select a scene to preview</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Transition Controls */}
              <div className="flex flex-col items-center justify-center gap-3 w-24">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="lg"
                      className="w-full bg-red-600 hover:bg-red-700"
                      onClick={handleTransition}
                      disabled={!previewSceneId}
                    >
                      <ArrowRightLeft className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Transition to Program</TooltipContent>
                </Tooltip>
                
                <Select value={transitionType} onValueChange={(v: any) => setTransitionType(v)}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cut">Cut</SelectItem>
                    <SelectItem value="fade">Fade</SelectItem>
                    <SelectItem value="wipe">Wipe</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="text-center">
                  <span className="text-xs text-muted-foreground">Duration</span>
                  <Input
                    type="number"
                    value={transitionDuration}
                    onChange={(e) => setTransitionDuration(parseInt(e.target.value) || 300)}
                    className="w-full h-8 text-xs text-center mt-1"
                  />
                  <span className="text-[10px] text-muted-foreground">ms</span>
                </div>
              </div>
              
              {/* Program (Live) */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-400">PROGRAM</span>
                    {isLive && (
                      <Badge className="bg-red-600 text-white animate-pulse">LIVE</Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">
                    {scenes.find(s => s.id === activeSceneId)?.name || "None"}
                  </Badge>
                </div>
                <div
                  ref={programRef}
                  className="flex-1 rounded-lg border-2 border-red-500/50 bg-black relative overflow-hidden"
                >
                  {/* Program content */}
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    {activeSceneId ? (
                      <span className="text-lg">{scenes.find(s => s.id === activeSceneId)?.name}</span>
                    ) : (
                      <span>No scene active</span>
                    )}
                  </div>
                  
                  {/* Overlays would render here */}
                  {overlays.filter(o => o.is_visible).map((overlay) => (
                    <div
                      key={overlay.id}
                      className="absolute bg-black/50 rounded p-2 text-xs"
                      style={{
                        left: `${overlay.position_x}%`,
                        top: `${overlay.position_y}%`,
                        width: `${overlay.width}%`,
                        height: `${overlay.height}%`,
                      }}
                    >
                      {overlay.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Scene Switcher */}
            <div className="h-28 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Scenes</h3>
                <Dialog open={showAddScene} onOpenChange={setShowAddScene}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7">
                      <Plus className="h-3 w-3 mr-1" />
                      Add Scene
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Scene</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <Label>Scene Name</Label>
                      <Input placeholder="e.g., Player Interview" className="mt-2" />
                    </div>
                    <DialogFooter>
                      <Button onClick={() => setShowAddScene(false)}>Create Scene</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2">
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className={cn(
                      "flex-shrink-0 w-32 h-20 rounded-lg border-2 cursor-pointer transition-all relative overflow-hidden group",
                      scene.id === activeSceneId
                        ? "border-red-500"
                        : scene.id === previewSceneId
                        ? "border-green-500"
                        : "border-white/20 hover:border-white/40"
                    )}
                    style={{ backgroundColor: scene.background_color }}
                    onClick={() => handleSetPreview(scene.id)}
                    onDoubleClick={() => handleSwitchScene(scene.id)}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-white/80 text-center px-1">
                        {scene.name}
                      </span>
                    </div>
                    
                    {scene.id === activeSceneId && (
                      <div className="absolute top-1 right-1">
                        <Badge className="bg-red-600 text-[10px] px-1 py-0">LIVE</Badge>
                      </div>
                    )}
                    
                    {scene.id === previewSceneId && (
                      <div className="absolute top-1 right-1">
                        <Badge className="bg-green-600 text-[10px] px-1 py-0">PRV</Badge>
                      </div>
                    )}
                    
                    {/* Quick actions on hover */}
                    <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-5 w-5 bg-black/50">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem>Duplicate</DropdownMenuItem>
                          <DropdownMenuItem>Rename</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-400">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                
                {scenes.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    No scenes created yet
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Right Panel - Overlays & Controls */}
          <aside className="w-72 border-l border-white/10 flex flex-col">
            <Tabs defaultValue="overlays" className="flex-1 flex flex-col">
              <TabsList className="w-full rounded-none border-b border-white/10 bg-transparent h-10">
                <TabsTrigger value="overlays" className="flex-1 data-[state=active]:bg-white/10">Overlays</TabsTrigger>
                <TabsTrigger value="controls" className="flex-1 data-[state=active]:bg-white/10">Controls</TabsTrigger>
                <TabsTrigger value="chat" className="flex-1 data-[state=active]:bg-white/10">Chat</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overlays" className="flex-1 p-3 mt-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Overlays</h3>
                  <Dialog open={showAddOverlay} onOpenChange={setShowAddOverlay}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Overlay</DialogTitle>
                        <DialogDescription>Add a tournament-integrated overlay</DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-3 py-4">
                        <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => { handleAddOverlay("match_score"); setShowAddOverlay(false); }}>
                          <Trophy className="h-6 w-6" />
                          <span className="text-xs">Match Score</span>
                        </Button>
                        <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => { handleAddOverlay("player_cam"); setShowAddOverlay(false); }}>
                          <Users className="h-6 w-6" />
                          <span className="text-xs">Player Cams</span>
                        </Button>
                        <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => { handleAddOverlay("chat"); setShowAddOverlay(false); }}>
                          <MessageSquare className="h-6 w-6" />
                          <span className="text-xs">Chat</span>
                        </Button>
                        <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => { handleAddOverlay("alerts"); setShowAddOverlay(false); }}>
                          <Zap className="h-6 w-6" />
                          <span className="text-xs">Alerts</span>
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {overlays.map((overlay) => (
                      <div
                        key={overlay.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white/5"
                      >
                        {overlay.overlay_type === "match_score" && <Trophy className="h-4 w-4 text-primary" />}
                        {overlay.overlay_type === "chat" && <MessageSquare className="h-4 w-4 text-blue-400" />}
                        {overlay.overlay_type === "alerts" && <Zap className="h-4 w-4 text-yellow-400" />}
                        {overlay.overlay_type === "player_cam" && <Users className="h-4 w-4 text-green-400" />}
                        <span className="text-sm flex-1 truncate">{overlay.label}</span>
                        <Switch
                          checked={overlay.is_visible}
                          onCheckedChange={(v) => handleToggleOverlay(overlay.id, v)}
                        />
                      </div>
                    ))}
                    
                    {overlays.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No overlays added
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                {/* Quick Overlay Presets */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">QUICK PRESETS</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      Match View
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      Caster Desk
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      Break Screen
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      Top 8 Intro
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="controls" className="flex-1 p-3 mt-0">
                <div className="space-y-4">
                  {/* Instant Replay */}
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <SkipBack className="h-4 w-4" />
                        Instant Replay
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="grid grid-cols-3 gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleInstantReplay(15)}>
                          15s
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleInstantReplay(30)}>
                          30s
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleInstantReplay(60)}>
                          60s
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Quick Actions */}
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-2">
                      <Button size="sm" variant="outline" className="w-full justify-start">
                        <Scissors className="h-4 w-4 mr-2" />
                        Create Clip
                      </Button>
                      <Button size="sm" variant="outline" className="w-full justify-start">
                        <Save className="h-4 w-4 mr-2" />
                        Save Preset
                      </Button>
                      <Button size="sm" variant="outline" className="w-full justify-start">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Stream URL
                      </Button>
                    </CardContent>
                  </Card>
                  
                  {/* Stream Stats */}
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm">Stream Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <div className="text-muted-foreground">Viewers</div>
                        <div className="text-right font-mono">0</div>
                        <div className="text-muted-foreground">Duration</div>
                        <div className="text-right font-mono">00:00:00</div>
                        <div className="text-muted-foreground">Bitrate</div>
                        <div className="text-right font-mono">-- kbps</div>
                        <div className="text-muted-foreground">FPS</div>
                        <div className="text-right font-mono">--</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="chat" className="flex-1 flex flex-col p-3 mt-0">
                <div className="flex-1 rounded-lg bg-white/5 p-2 mb-3">
                  <div className="text-center text-muted-foreground text-sm py-8">
                    Chat will appear here when live
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Send a message..." className="flex-1 bg-white/5" />
                  <Button size="icon">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </aside>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <footer className="h-8 border-t border-white/10 px-4 flex items-center text-[10px] text-muted-foreground gap-4">
          <span><kbd className="px-1 py-0.5 bg-white/10 rounded">1-9</kbd> Switch Scene</span>
          <span><kbd className="px-1 py-0.5 bg-white/10 rounded">Space</kbd> Transition</span>
          <span><kbd className="px-1 py-0.5 bg-white/10 rounded">R</kbd> Instant Replay</span>
          <span><kbd className="px-1 py-0.5 bg-white/10 rounded">C</kbd> Create Clip</span>
          <span><kbd className="px-1 py-0.5 bg-white/10 rounded">M</kbd> Mute Mic</span>
        </footer>
      </div>
    </TooltipProvider>
  )
}
