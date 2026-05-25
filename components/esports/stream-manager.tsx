"use client"

import { useState, useEffect, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Tv,
  Plus,
  ExternalLink,
  Eye,
  Radio,
  Settings,
  Trash2,
  RefreshCw,
  Check,
  Copy,
  Play,
  Square,
  Users,
  MessageSquare,
} from "lucide-react"

interface StreamConfig {
  id: string
  platform: "twitch" | "kick" | "youtube" | "custom"
  channelName: string
  streamUrl: string
  embedUrl?: string
  chatEmbedUrl?: string
  title?: string
  isLive: boolean
  viewerCount?: number
  isPrimary: boolean
}

interface StreamManagerProps {
  tournamentId: string
  tournamentSlug: string
  initialStreams?: StreamConfig[]
  onStreamUpdate?: (streams: StreamConfig[]) => void
}

const PLATFORM_CONFIG = {
  twitch: {
    label: "Twitch",
    color: "bg-purple-500",
    icon: "📺",
    placeholder: "username",
    baseUrl: "https://twitch.tv/",
  },
  kick: {
    label: "Kick",
    color: "bg-green-500",
    icon: "🎮",
    placeholder: "username",
    baseUrl: "https://kick.com/",
  },
  youtube: {
    label: "YouTube",
    color: "bg-red-500",
    icon: "▶️",
    placeholder: "video ID or channel",
    baseUrl: "https://youtube.com/watch?v=",
  },
  custom: {
    label: "Custom",
    color: "bg-gray-500",
    icon: "🔗",
    placeholder: "embed URL",
    baseUrl: "",
  },
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function generateEmbedUrl(platform: string, channel: string): string {
  const parent = typeof window !== "undefined" ? window.location.hostname : "localhost"
  
  switch (platform) {
    case "twitch":
      return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&muted=false`
    case "kick":
      return `https://player.kick.com/${channel}`
    case "youtube":
      return `https://www.youtube.com/embed/${channel}?autoplay=1`
    default:
      return channel
  }
}

function generateChatUrl(platform: string, channel: string): string | undefined {
  const parent = typeof window !== "undefined" ? window.location.hostname : "localhost"
  
  switch (platform) {
    case "twitch":
      return `https://www.twitch.tv/embed/${channel}/chat?parent=${parent}&darkpopout`
    case "kick":
      return `https://kick.com/${channel}/chatroom`
    case "youtube":
      return `https://www.youtube.com/live_chat?v=${channel}&embed_domain=${parent}`
    default:
      return undefined
  }
}

export function StreamManager({
  tournamentId,
  tournamentSlug,
  initialStreams = [],
  onStreamUpdate,
}: StreamManagerProps) {
  const [streams, setStreams] = useState<StreamConfig[]>(initialStreams)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [newStream, setNewStream] = useState({
    platform: "twitch" as const,
    channelName: "",
    title: "",
  })

  // Add a new stream
  const handleAddStream = () => {
    if (!newStream.channelName.trim()) return

    const stream: StreamConfig = {
      id: generateId(),
      platform: newStream.platform,
      channelName: newStream.channelName.trim(),
      streamUrl: `${PLATFORM_CONFIG[newStream.platform].baseUrl}${newStream.channelName.trim()}`,
      embedUrl: generateEmbedUrl(newStream.platform, newStream.channelName.trim()),
      chatEmbedUrl: generateChatUrl(newStream.platform, newStream.channelName.trim()),
      title: newStream.title || undefined,
      isLive: false,
      isPrimary: streams.length === 0, // First stream is primary
    }

    const updated = [...streams, stream]
    setStreams(updated)
    onStreamUpdate?.(updated)
    setNewStream({ platform: "twitch", channelName: "", title: "" })
    setIsAddDialogOpen(false)
  }

  // Remove a stream
  const handleRemoveStream = (id: string) => {
    const updated = streams.filter((s) => s.id !== id)
    // If we removed the primary, make the first one primary
    if (updated.length > 0 && !updated.some((s) => s.isPrimary)) {
      updated[0].isPrimary = true
    }
    setStreams(updated)
    onStreamUpdate?.(updated)
  }

  // Set primary stream
  const handleSetPrimary = (id: string) => {
    const updated = streams.map((s) => ({ ...s, isPrimary: s.id === id }))
    setStreams(updated)
    onStreamUpdate?.(updated)
  }

  // Copy embed code
  const copyEmbedCode = (stream: StreamConfig) => {
    const code = `<iframe src="${stream.embedUrl}" width="100%" height="400" allowfullscreen></iframe>`
    navigator.clipboard.writeText(code)
  }

  const primaryStream = streams.find((s) => s.isPrimary)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Stream Management</h3>
          <p className="text-sm text-muted-foreground">
            Configure live streams for your tournament
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Stream
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Stream Source</DialogTitle>
              <DialogDescription>
                Add a Twitch, Kick, or YouTube stream to your tournament
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select
                  value={newStream.platform}
                  onValueChange={(v) =>
                    setNewStream((p) => ({ ...p, platform: v as typeof p.platform }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLATFORM_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span>{config.icon}</span>
                          <span>{config.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Channel / Username</Label>
                <Input
                  placeholder={PLATFORM_CONFIG[newStream.platform].placeholder}
                  value={newStream.channelName}
                  onChange={(e) =>
                    setNewStream((p) => ({ ...p, channelName: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  URL preview: {PLATFORM_CONFIG[newStream.platform].baseUrl}
                  {newStream.channelName || "..."}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Custom Title (optional)</Label>
                <Input
                  placeholder="e.g., Main Stage, Feature Match"
                  value={newStream.title}
                  onChange={(e) => setNewStream((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddStream} disabled={!newStream.channelName.trim()}>
                Add Stream
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Primary Stream Preview */}
      {primaryStream && (
        <Card className="overflow-hidden">
          <div className="relative aspect-video bg-black">
            <iframe
              src={primaryStream.embedUrl}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <Badge className={cn("text-white", PLATFORM_CONFIG[primaryStream.platform].color)}>
                {PLATFORM_CONFIG[primaryStream.platform].icon}{" "}
                {PLATFORM_CONFIG[primaryStream.platform].label}
              </Badge>
              {primaryStream.isLive && (
                <Badge variant="destructive" className="animate-pulse">
                  <Radio className="mr-1 h-3 w-3" />
                  LIVE
                </Badge>
              )}
              {primaryStream.viewerCount !== undefined && primaryStream.viewerCount > 0 && (
                <Badge variant="secondary">
                  <Eye className="mr-1 h-3 w-3" />
                  {primaryStream.viewerCount.toLocaleString()}
                </Badge>
              )}
            </div>
          </div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">
                  {primaryStream.title || primaryStream.channelName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {primaryStream.streamUrl}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyEmbedCode(primaryStream)}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Embed
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={primaryStream.streamUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Open
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stream List */}
      {streams.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">All Streams</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {streams.map((stream) => (
              <Card
                key={stream.id}
                className={cn(
                  "transition-colors",
                  stream.isPrimary && "border-primary/50 bg-primary/5"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            PLATFORM_CONFIG[stream.platform].color,
                            "text-white border-0"
                          )}
                        >
                          {PLATFORM_CONFIG[stream.platform].label}
                        </Badge>
                        {stream.isPrimary && (
                          <Badge variant="secondary" className="text-xs">
                            Primary
                          </Badge>
                        )}
                        {stream.isLive && (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
                            Live
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-foreground">
                        {stream.title || stream.channelName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {stream.channelName}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!stream.isPrimary && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleSetPrimary(stream.id)}
                          title="Set as primary"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveStream(stream.id)}
                        title="Remove stream"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-muted p-3">
              <Tv className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mb-1 font-medium text-foreground">No streams configured</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Add a Twitch, Kick, or YouTube stream to broadcast your tournament
            </p>
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Stream
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Embed Info */}
      {streams.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Public Stream URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                {typeof window !== "undefined" ? window.location.origin : ""}/esports/tournaments/
                {tournamentSlug}/live
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${window.location.origin}/esports/tournaments/${tournamentSlug}/live`
                  )
                }
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Share this URL with viewers to watch the tournament live
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Multi-Stream Viewer (for watching multiple streams at once)
// ══════════════════════════════════════════════════════════════════════════════

interface MultiStreamViewerProps {
  streams: StreamConfig[]
  showChat?: boolean
  layout?: "grid" | "pip" | "side-by-side"
}

export function MultiStreamViewer({
  streams,
  showChat = true,
  layout = "grid",
}: MultiStreamViewerProps) {
  const [activeStreamId, setActiveStreamId] = useState(streams[0]?.id)
  const [chatStream, setChatStream] = useState(streams[0])

  const activeStream = streams.find((s) => s.id === activeStreamId) || streams[0]

  if (streams.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed bg-muted/20">
        <p className="text-muted-foreground">No streams available</p>
      </div>
    )
  }

  // Picture-in-picture layout
  if (layout === "pip" && streams.length > 1) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        {/* Main stream */}
        <iframe
          src={activeStream.embedUrl}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen"
          allowFullScreen
        />

        {/* PIP streams */}
        <div className="absolute bottom-4 right-4 flex gap-2">
          {streams
            .filter((s) => s.id !== activeStreamId)
            .slice(0, 3)
            .map((stream) => (
              <button
                key={stream.id}
                onClick={() => setActiveStreamId(stream.id)}
                className="relative h-24 w-36 overflow-hidden rounded border-2 border-white/50 transition-transform hover:scale-105 hover:border-white"
              >
                <iframe
                  src={stream.embedUrl}
                  className="pointer-events-none h-full w-full"
                  allow="autoplay"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-1 left-1 text-[10px] font-medium text-white">
                  {stream.title || stream.channelName}
                </span>
              </button>
            ))}
        </div>
      </div>
    )
  }

  // Side by side with chat
  if (layout === "side-by-side" && showChat && activeStream.chatEmbedUrl) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr,350px]">
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          <iframe
            src={activeStream.embedUrl}
            className="h-full w-full"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        </div>
        <div className="flex h-[400px] flex-col overflow-hidden rounded-lg border lg:h-auto">
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4" />
              Chat
            </span>
            {streams.length > 1 && (
              <Select
                value={chatStream?.id}
                onValueChange={(id) => setChatStream(streams.find((s) => s.id === id))}
              >
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {streams.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title || s.channelName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex-1">
            <iframe
              src={chatStream?.chatEmbedUrl || activeStream.chatEmbedUrl}
              className="h-full w-full"
            />
          </div>
        </div>
      </div>
    )
  }

  // Grid layout (default)
  const gridCols =
    streams.length === 1
      ? "grid-cols-1"
      : streams.length === 2
        ? "grid-cols-2"
        : streams.length <= 4
          ? "grid-cols-2"
          : "grid-cols-3"

  return (
    <div className={cn("grid gap-2", gridCols)}>
      {streams.map((stream) => (
        <div
          key={stream.id}
          className={cn(
            "relative aspect-video overflow-hidden rounded-lg bg-black",
            streams.length === 1 && "col-span-full"
          )}
        >
          <iframe
            src={stream.embedUrl}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs text-white border-0",
                  PLATFORM_CONFIG[stream.platform].color
                )}
              >
                {PLATFORM_CONFIG[stream.platform].label}
              </Badge>
              {stream.isLive && (
                <span className="flex items-center gap-1 text-xs text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                  LIVE
                </span>
              )}
            </div>
            <span className="text-xs text-white/80">
              {stream.title || stream.channelName}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
