"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import {
  Card,
  CardContent,
  CardDescription,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
  Globe,
  Lock,
  Copy,
  ExternalLink,
  Maximize,
  Minimize,
  LayoutGrid,
  Square,
  CircleDot,
  StopCircle,
  AlertTriangle,
  Check,
  Gamepad2,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { StreamSession, StreamLayout } from "@/lib/majh-studio-actions"

const fetcher = (url: string) => fetch(url).then(res => res.json())

type StreamSource = "screen" | "camera" | "both"
type LayoutType = "fullscreen" | "picture_in_picture" | "side_by_side"

export default function MajhStudioPage() {
  // Refs
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Media state
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [combinedStream, setCombinedStream] = useState<MediaStream | null>(null)
  
  // UI state
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  const [streamSource, setStreamSource] = useState<StreamSource>("both")
  const [layoutType, setLayoutType] = useState<LayoutType>("picture_in_picture")
  const [cameraPosition, setCameraPosition] = useState<"top_left" | "top_right" | "bottom_left" | "bottom_right">("bottom_right")
  const [cameraSize, setCameraSize] = useState(25) // percentage
  const [showOverlay, setShowOverlay] = useState(true)
  const [copiedLink, setCopiedLink] = useState(false)
  
  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [gameId, setGameId] = useState<string>("")
  const [isPublic, setIsPublic] = useState(true)
  const [allowChat, setAllowChat] = useState(true)
  const [allowClips, setAllowClips] = useState(true)

  // Data fetching
  const { data: sessionData, mutate: mutateSession } = useSWR<{ data: StreamSession | null }>(
    "/api/studio/session",
    fetcher
  )
  const { data: gamesData } = useSWR<{ data: any[] }>("/api/games", fetcher)

  const session = sessionData?.data
  const games = gamesData?.data || []

  // Load session data into form
  useEffect(() => {
    if (session) {
      setTitle(session.title || "")
      setDescription(session.description || "")
      setGameId(session.game_id || "")
      setIsPublic(session.is_public)
      setAllowChat(session.allow_chat)
      setAllowClips(session.allow_clips)
      setIsLive(session.is_live)
    }
  }, [session])

  // ─────────────────────────────────────────────────────────────────────────────
  // Media Capture
  // ─────────────────────────────────────────────────────────────────────────────

  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true,
      })
      
      setScreenStream(stream)
      
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream
      }

      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenCapture()
      }

      return stream
    } catch (err) {
      console.error("Screen capture error:", err)
      return null
    }
  }

  const stopScreenCapture = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop())
      setScreenStream(null)
    }
  }

  const startCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true,
      })
      
      setCameraStream(stream)
      
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream
      }

      return stream
    } catch (err) {
      console.error("Camera capture error:", err)
      return null
    }
  }

  const stopCameraCapture = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
  }

  const toggleMic = () => {
    if (cameraStream) {
      const audioTrack = cameraStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMicEnabled(audioTrack.enabled)
      }
    }
    if (screenStream) {
      const audioTrack = screenStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
      }
    }
  }

  const toggleCamera = () => {
    if (cameraStream) {
      const videoTrack = cameraStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsCameraEnabled(videoTrack.enabled)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Stream Setup
  // ─────────────────────────────────────────────────────────────────────────────

  const setupStream = async () => {
    setIsSettingUp(true)

    try {
      if (streamSource === "screen" || streamSource === "both") {
        await startScreenCapture()
      }
      
      if (streamSource === "camera" || streamSource === "both") {
        await startCameraCapture()
      }
    } catch (err) {
      console.error("Setup error:", err)
    }

    setIsSettingUp(false)
  }

  const stopStream = () => {
    stopScreenCapture()
    stopCameraCapture()
    setCombinedStream(null)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Session Management
  // ─────────────────────────────────────────────────────────────────────────────

  const createSession = async () => {
    if (!title.trim()) {
      alert("Please enter a stream title")
      return
    }

    const res = await fetch("/api/studio/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        title,
        description,
        game_id: gameId || null,
        is_public: isPublic,
        allow_chat: allowChat,
        allow_clips: allowClips,
      }),
    })

    const result = await res.json()
    if (result.error) {
      alert(result.error)
      return
    }

    mutateSession()
  }

  const goLive = async () => {
    if (!session) {
      await createSession()
      return
    }

    // Start the stream
    const res = await fetch("/api/studio/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        sessionId: session.id,
      }),
    })

    const result = await res.json()
    if (result.error) {
      alert(result.error)
      return
    }

    setIsLive(true)
    mutateSession()
  }

  const endLive = async () => {
    if (!session) return

    const res = await fetch("/api/studio/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "end",
        sessionId: session.id,
      }),
    })

    const result = await res.json()
    if (result.error) {
      alert(result.error)
      return
    }

    setIsLive(false)
    stopStream()
    mutateSession()
  }

  const copyStreamLink = () => {
    if (session) {
      navigator.clipboard.writeText(`${window.location.origin}/watch/${session.id}`)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  const hasAnyStream = screenStream || cameraStream

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              MAJH Studio
            </h1>
            {isLive && (
              <Badge variant="destructive" className="animate-pulse">
                <CircleDot className="h-3 w-3 mr-1" />
                LIVE
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {session && (
              <Button variant="outline" size="sm" onClick={copyStreamLink}>
                {copiedLink ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedLink ? "Copied!" : "Copy Link"}
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/live">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Live Hub
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
          {/* Main Preview Area */}
          <div className="space-y-4">
            {/* Preview */}
            <Card className="overflow-hidden">
              <div className="aspect-video bg-black relative">
                {/* Screen Share */}
                {screenStream && (
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={cn(
                      "absolute inset-0 w-full h-full object-contain",
                      layoutType === "side_by_side" ? "w-1/2" : "w-full"
                    )}
                  />
                )}

                {/* Camera (PiP) */}
                {cameraStream && isCameraEnabled && layoutType === "picture_in_picture" && (
                  <div
                    className={cn(
                      "absolute z-10 rounded-lg overflow-hidden border-2 border-primary shadow-lg",
                      cameraPosition === "top_left" && "top-4 left-4",
                      cameraPosition === "top_right" && "top-4 right-4",
                      cameraPosition === "bottom_left" && "bottom-4 left-4",
                      cameraPosition === "bottom_right" && "bottom-4 right-4"
                    )}
                    style={{ width: `${cameraSize}%`, aspectRatio: "16/9" }}
                  >
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Camera Fullscreen */}
                {cameraStream && !screenStream && (
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}

                {/* Overlay */}
                {showOverlay && isLive && (
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <Badge variant="destructive" className="font-bold">
                      <CircleDot className="h-3 w-3 mr-1 animate-pulse" />
                      LIVE
                    </Badge>
                    <Badge variant="secondary">
                      <Users className="h-3 w-3 mr-1" />
                      {session?.viewer_count || 0}
                    </Badge>
                  </div>
                )}

                {/* No Stream State */}
                {!hasAnyStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <Video className="h-16 w-16 mb-4 opacity-30" />
                    <p className="text-lg">No video source</p>
                    <p className="text-sm">Select a source and click Start Preview</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Media Controls */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={screenStream ? "default" : "outline"}
                      size="sm"
                      onClick={screenStream ? stopScreenCapture : startScreenCapture}
                    >
                      <Monitor className="h-4 w-4 mr-2" />
                      {screenStream ? "Stop Screen" : "Share Screen"}
                    </Button>
                    <Button
                      variant={cameraStream ? "default" : "outline"}
                      size="sm"
                      onClick={cameraStream ? stopCameraCapture : startCameraCapture}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {cameraStream ? "Stop Camera" : "Start Camera"}
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleMic}
                      disabled={!cameraStream && !screenStream}
                    >
                      {isMicEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-destructive" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleCamera}
                      disabled={!cameraStream}
                    >
                      {isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-destructive" />}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isLive ? (
                      <Button
                        variant="destructive"
                        onClick={goLive}
                        disabled={!hasAnyStream || !title.trim()}
                      >
                        <Radio className="h-4 w-4 mr-2" />
                        Go Live
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                            <StopCircle className="h-4 w-4 mr-2" />
                            End Stream
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>End your stream?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will end your live stream and disconnect all viewers.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={endLive}>End Stream</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Layout Controls */}
            {screenStream && cameraStream && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Layout Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Label className="text-sm w-24">Layout</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={layoutType === "fullscreen" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLayoutType("fullscreen")}
                      >
                        <Maximize className="h-4 w-4 mr-1" />
                        Full
                      </Button>
                      <Button
                        variant={layoutType === "picture_in_picture" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLayoutType("picture_in_picture")}
                      >
                        <Square className="h-4 w-4 mr-1" />
                        PiP
                      </Button>
                      <Button
                        variant={layoutType === "side_by_side" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLayoutType("side_by_side")}
                      >
                        <LayoutGrid className="h-4 w-4 mr-1" />
                        Side
                      </Button>
                    </div>
                  </div>

                  {layoutType === "picture_in_picture" && (
                    <>
                      <div className="flex items-center gap-4">
                        <Label className="text-sm w-24">Position</Label>
                        <div className="flex gap-2">
                          {(["top_left", "top_right", "bottom_left", "bottom_right"] as const).map((pos) => (
                            <Button
                              key={pos}
                              variant={cameraPosition === pos ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCameraPosition(pos)}
                            >
                              {pos.replace("_", " ")}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Label className="text-sm w-24">Size</Label>
                        <Slider
                          value={[cameraSize]}
                          onValueChange={(v) => setCameraSize(v[0])}
                          min={10}
                          max={50}
                          step={5}
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground w-12">{cameraSize}%</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Stream Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Stream Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Friday Night Modern"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isLive}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="What are you streaming today?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isLive}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Game</Label>
                  <Select value={gameId} onValueChange={setGameId} disabled={isLive}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a game" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No specific game</SelectItem>
                      {games.map((game: any) => (
                        <SelectItem key={game.id} value={game.id}>
                          {game.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Stream Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    <span className="text-sm">Public Stream</span>
                  </div>
                  <Switch
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                    disabled={isLive}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm">Allow Chat</span>
                  </div>
                  <Switch
                    checked={allowChat}
                    onCheckedChange={setAllowChat}
                    disabled={isLive}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scissors className="h-4 w-4" />
                    <span className="text-sm">Allow Clips</span>
                  </div>
                  <Switch
                    checked={allowClips}
                    onCheckedChange={setAllowClips}
                    disabled={isLive}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    <span className="text-sm">Show Overlay</span>
                  </div>
                  <Switch
                    checked={showOverlay}
                    onCheckedChange={setShowOverlay}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            {isLive && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/dashboard/stream/tools">
                      <Layers className="h-4 w-4 mr-2" />
                      OBS Overlays
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Scissors className="h-4 w-4 mr-2" />
                    Create Clip
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Info Box */}
            {!hasAnyStream && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="py-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Getting Started</p>
                      <p className="text-muted-foreground mt-1">
                        1. Click Share Screen to capture your game
                      </p>
                      <p className="text-muted-foreground">
                        2. Optionally add your camera
                      </p>
                      <p className="text-muted-foreground">
                        3. Fill in your stream details
                      </p>
                      <p className="text-muted-foreground">
                        4. Click Go Live when ready!
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
