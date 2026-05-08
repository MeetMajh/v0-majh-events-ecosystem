"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Settings,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  Gamepad2,
  MessageSquare,
  Scissors,
  Globe,
  Lock,
  ExternalLink,
  Users,
  Clock,
  Layers,
  Share2,
  Tv,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  createStream,
  updateStream,
  endStream,
  regenerateStreamKey,
  type UserStream,
  type CreateStreamInput,
} from "@/lib/go-live-actions"

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function GoLivePage() {
  const [showStreamKey, setShowStreamKey] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Form state for new/edit stream
  const [formData, setFormData] = useState<CreateStreamInput>({
    title: "",
    description: "",
    game_id: undefined,
    is_public: true,
    allow_chat: true,
    allow_clips: true,
  })

  const { data: streamData, error, mutate } = useSWR<{ data: UserStream | null }>(
    "/api/user/stream",
    fetcher
  )

  const { data: gamesData } = useSWR<{ data: any[] }>("/api/games", fetcher)

  const stream = streamData?.data
  const games = gamesData?.data || []

  // Populate form when stream loads
  useEffect(() => {
    if (stream) {
      setFormData({
        title: stream.title,
        description: stream.description || "",
        game_id: stream.game_id,
        is_public: stream.is_public,
        allow_chat: stream.allow_chat,
        allow_clips: stream.allow_clips,
      })
    }
  }, [stream])

  const handleCreateStream = async () => {
    if (!formData.title) {
      toast.error("Please enter a stream title")
      return
    }
    
    setIsCreating(true)
    setErrorMessage(null)
    console.log("[v0] handleCreateStream called with:", formData)
    
    try {
      const result = await createStream(formData)
      console.log("[v0] createStream result:", result)
      
      if (result.error) {
        setErrorMessage(result.error)
        toast.error(result.error)
        console.log("[v0] Error from createStream:", result.error)
      } else if (result.data) {
        console.log("[v0] Stream created successfully:", result.data)
        toast.success("Stream created! Your stream key is ready.")
        
        // Optimistic update: populate SWR cache immediately so UI shows stream key right away
        await mutate({ data: result.data }, { revalidate: false })
        console.log("[v0] SWR cache updated optimistically with stream data")
        
        // Background sync: revalidate from server without disrupting the UI
        mutate()
        console.log("[v0] Background SWR refetch triggered")
      } else {
        // No error, no data - something unexpected
        setErrorMessage("Unexpected response - no data returned")
        toast.error("Something went wrong")
        console.log("[v0] Unexpected result - no error, no data:", result)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create stream"
      setErrorMessage(message)
      toast.error(message)
      console.error("[v0] Exception in handleCreateStream:", err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateStream = async () => {
    if (!stream) return
    
    setIsUpdating(true)
    try {
      await updateStream(stream.id, formData)
      mutate()
    } catch (err) {
      console.error("Error updating stream:", err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleEndStream = async () => {
    if (!stream) return
    
    try {
      await endStream(stream.id)
      mutate()
    } catch (err) {
      console.error("Error ending stream:", err)
    }
  }

  const handleRegenerateKey = async () => {
    if (!stream) return
    
    try {
      await regenerateStreamKey(stream.id)
      mutate()
    } catch (err) {
      console.error("Error regenerating key:", err)
    }
  }

  const copyToClipboard = (text: string, type: "key" | "url") => {
    navigator.clipboard.writeText(text)
    if (type === "key") {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } else {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    }
  }

  // No stream yet - show setup
  if (!stream) {
    return (
      <div className="container max-w-3xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Go Live</h1>
          <p className="text-muted-foreground mt-1">
            Set up your stream to broadcast on MAJH Events
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              Create Your Stream
            </CardTitle>
            <CardDescription>
              Configure your stream settings to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Stream Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Friday Night MTG - Modern Tournament Prep"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What will you be streaming today?"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="game">Game Category</Label>
              <Select
                value={formData.game_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, game_id: value === "none" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a game" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific game</SelectItem>
                  {games.map((game: any) => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Public Stream
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Anyone can discover and watch your stream
                  </p>
                </div>
                <Switch
                  checked={formData.is_public}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Enable Chat
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow viewers to chat during your stream
                  </p>
                </div>
                <Switch
                  checked={formData.allow_chat}
                  onCheckedChange={(checked) => setFormData({ ...formData, allow_chat: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Scissors className="h-4 w-4" />
                    Allow Clips
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Let viewers create clips from your stream
                  </p>
                </div>
                <Switch
                  checked={formData.allow_clips}
                  onCheckedChange={(checked) => setFormData({ ...formData, allow_clips: checked })}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            {errorMessage && (
              <div className="w-full p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            <Button 
              onClick={handleCreateStream} 
              disabled={isCreating || !formData.title}
              className="w-full"
            >
              {isCreating ? "Creating..." : "Create Stream Configuration"}
            </Button>
          </CardFooter>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">How to Stream</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
              <p>Create your stream configuration above</p>
            </div>
            <div className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
              <p>Copy your Stream Key and RTMP URL</p>
            </div>
            <div className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
              <p>Open OBS Studio, Streamlabs, or your streaming software</p>
            </div>
            <div className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">4</span>
              <p>Go to Settings → Stream → Custom and paste your details</p>
            </div>
            <div className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">5</span>
              <p>Click &quot;Start Streaming&quot; in your software to go live!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Has stream configuration
  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Go Live</h1>
          <p className="text-muted-foreground mt-1">
            Manage your stream settings and go live
          </p>
        </div>
        
        {stream.status === "live" && (
          <Badge variant="destructive" className="gap-1 text-sm px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            LIVE NOW
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stream Key & URL */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Stream Settings
            </CardTitle>
            <CardDescription>
              Use these settings in OBS or your streaming software
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>RTMP URL</Label>
              <div className="flex gap-2">
                <Input
                  value={stream.rtmp_url}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(stream.rtmp_url, "url")}
                >
                  {copiedUrl ? (
                    <span className="text-green-500 text-xs">Copied!</span>
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Stream Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showStreamKey ? "text" : "password"}
                  value={stream.stream_key}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowStreamKey(!showStreamKey)}
                >
                  {showStreamKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(stream.stream_key, "key")}
                >
                  {copiedKey ? (
                    <span className="text-green-500 text-xs">Copied!</span>
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Never share your stream key with anyone
              </p>
            </div>

            {stream.status === "offline" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate Stream Key
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate Stream Key?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will invalidate your current stream key. You&apos;ll need to update your streaming software with the new key.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRegenerateKey}>
                      Regenerate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>

        {/* Stream Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Stream Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={stream.status === "live"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Game</Label>
              <Select
                value={formData.game_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, game_id: value === "none" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific game</SelectItem>
                  {games.map((game: any) => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleUpdateStream} 
              disabled={isUpdating}
              className="w-full"
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Stream Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Stream Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{stream.peak_viewers}</div>
                <div className="text-sm text-muted-foreground">Peak Viewers</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{stream.total_views}</div>
                <div className="text-sm text-muted-foreground">Total Views</div>
              </div>
            </div>
            
            {stream.started_at && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Started: {new Date(stream.started_at).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stream Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-2">
                  {formData.is_public ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  Visibility
                </Label>
                <p className="text-sm text-muted-foreground">
                  {formData.is_public ? "Public - Anyone can find" : "Private - Only with link"}
                </p>
              </div>
              <Switch
                checked={formData.is_public}
                onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </Label>
              </div>
              <Switch
                checked={formData.allow_chat}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_chat: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-2">
                  <Scissors className="h-4 w-4" />
                  Allow Clips
                </Label>
              </div>
              <Switch
                checked={formData.allow_clips}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_clips: checked })}
              />
            </div>

            {stream.status === "live" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full mt-4">
                    End Stream
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End your stream?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will end your live broadcast. Make sure to stop streaming in OBS first.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEndStream}>
                      End Stream
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Streamer Tools */}
      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <Link href="/dashboard/stream/tools">
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">OBS Overlays</h3>
                <p className="text-sm text-muted-foreground">
                  Match overlays, standings, timers
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/stream/multistream">
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Share2 className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold">Multistream</h3>
                <p className="text-sm text-muted-foreground">
                  Stream to Twitch, YouTube, Kick
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/live">
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Tv className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold">Watch Live</h3>
                <p className="text-sm text-muted-foreground">
                  View all live streams
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Status Banner */}
      {stream.status === "offline" && (
        <Card className="mt-6 border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div>
              <h3 className="font-semibold">Not Live Yet</h3>
              <p className="text-sm text-muted-foreground">
                Start streaming from OBS or your streaming software using the credentials above. Your stream will appear here once detected.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
