"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
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
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ExternalLink,
  Info,
} from "lucide-react"

// Platform configurations
const PLATFORMS = [
  {
    id: "twitch",
    name: "Twitch",
    color: "#9146FF",
    rtmpUrl: "rtmp://live.twitch.tv/live",
    keyHelp: "Get your stream key from Twitch Dashboard > Settings > Stream",
    logo: "T",
  },
  {
    id: "youtube",
    name: "YouTube",
    color: "#FF0000",
    rtmpUrl: "rtmp://a.rtmp.youtube.com/live2",
    keyHelp: "Get your stream key from YouTube Studio > Go Live > Stream settings",
    logo: "Y",
  },
  {
    id: "kick",
    name: "Kick",
    color: "#53FC18",
    rtmpUrl: "rtmp://fa723fc1b171.global-contribute.live-video.net/app",
    keyHelp: "Get your stream key from Kick Dashboard > Settings > Stream",
    logo: "K",
  },
  {
    id: "facebook",
    name: "Facebook Gaming",
    color: "#1877F2",
    rtmpUrl: "rtmps://live-api-s.facebook.com:443/rtmp",
    keyHelp: "Get your stream key from Facebook Creator Studio",
    logo: "F",
  },
]

interface StreamDestination {
  id: string
  platform: string
  streamKey: string
  enabled: boolean
  connected: boolean
}

export default function MultistreamPage() {
  const [destinations, setDestinations] = useState<StreamDestination[]>([])
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [isStreaming, setIsStreaming] = useState(false)

  const addDestination = (platformId: string) => {
    if (destinations.some(d => d.platform === platformId)) return
    
    setDestinations([
      ...destinations,
      {
        id: `dest_${Date.now()}`,
        platform: platformId,
        streamKey: "",
        enabled: true,
        connected: false,
      },
    ])
  }

  const updateDestination = (id: string, updates: Partial<StreamDestination>) => {
    setDestinations(destinations.map(d => 
      d.id === id ? { ...d, ...updates } : d
    ))
  }

  const removeDestination = (id: string) => {
    setDestinations(destinations.filter(d => d.id !== id))
    setShowKeys(prev => {
      const { [id]: _, ...rest } = prev
      return rest
    })
  }

  const getPlatform = (platformId: string) => 
    PLATFORMS.find(p => p.id === platformId)

  const availablePlatforms = PLATFORMS.filter(
    p => !destinations.some(d => d.platform === p.id)
  )

  const enabledDestinations = destinations.filter(d => d.enabled && d.streamKey)

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <Link 
          href="/dashboard/stream" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Go Live
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Multistream</h1>
            <p className="text-muted-foreground mt-1">
              Stream to multiple platforms simultaneously
            </p>
          </div>
          {isStreaming && (
            <Badge variant="destructive" className="gap-1 text-sm px-3 py-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              LIVE
            </Badge>
          )}
        </div>
      </div>

      {/* How it works */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">How Multistreaming Works</p>
              <ol className="text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Add your stream keys for each platform below</li>
                <li>Use the MAJH Events RTMP URL and stream key in OBS</li>
                <li>When you go live, we&apos;ll rebroadcast to all enabled platforms</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Destinations */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Stream Destinations</h2>
          {availablePlatforms.length > 0 && (
            <div className="flex gap-2">
              {availablePlatforms.map((platform) => (
                <Button
                  key={platform.id}
                  size="sm"
                  variant="outline"
                  onClick={() => addDestination(platform.id)}
                  className="gap-2"
                >
                  <div
                    className="h-4 w-4 rounded flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: platform.color }}
                  >
                    {platform.logo}
                  </div>
                  Add {platform.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {destinations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Radio className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-medium mb-2">No Destinations Added</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add platforms above to start multistreaming
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {destinations.map((dest) => {
              const platform = getPlatform(dest.platform)
              if (!platform) return null

              return (
                <Card key={dest.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: platform.color }}
                        >
                          {platform.logo}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{platform.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {platform.rtmpUrl}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {dest.streamKey ? (
                          dest.enabled ? (
                            <Badge variant="outline" className="text-green-500 border-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ready
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Disabled
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-amber-500 border-amber-500">
                            Needs Key
                          </Badge>
                        )}
                        <Switch
                          checked={dest.enabled}
                          onCheckedChange={(checked) => updateDestination(dest.id, { enabled: checked })}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Stream Key</Label>
                      <div className="flex gap-2">
                        <Input
                          type={showKeys[dest.id] ? "text" : "password"}
                          value={dest.streamKey}
                          onChange={(e) => updateDestination(dest.id, { streamKey: e.target.value })}
                          placeholder="Enter your stream key"
                          className="font-mono"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => setShowKeys(prev => ({ ...prev, [dest.id]: !prev[dest.id] }))}
                        >
                          {showKeys[dest.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="outline" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove {platform.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove {platform.name} from your multistream destinations.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeDestination(dest.id)}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      <p className="text-xs text-muted-foreground">{platform.keyHelp}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      {enabledDestinations.length > 0 && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Ready to Multistream
            </CardTitle>
            <CardDescription>
              Your stream will be sent to {enabledDestinations.length} platform{enabledDestinations.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {enabledDestinations.map((dest) => {
                const platform = getPlatform(dest.platform)
                if (!platform) return null
                return (
                  <Badge 
                    key={dest.id} 
                    variant="secondary"
                    className="gap-1"
                    style={{ backgroundColor: platform.color + "20", borderColor: platform.color }}
                  >
                    <div
                      className="h-3 w-3 rounded flex items-center justify-center text-white text-[8px] font-bold"
                      style={{ backgroundColor: platform.color }}
                    >
                      {platform.logo}
                    </div>
                    {platform.name}
                  </Badge>
                )
              })}
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/dashboard/stream">
                <Radio className="h-4 w-4 mr-2" />
                Go to Stream Settings
              </Link>
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Note about service */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">About Multistreaming</p>
              <p>
                Multistreaming requires a restreaming service to broadcast your stream to multiple platforms. 
                We partner with Restream.io for reliable multi-destination broadcasting. Your stream keys are 
                stored securely and only used during active streams.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
