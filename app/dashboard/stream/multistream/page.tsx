"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import useSWR from "swr"
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
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  ArrowLeft,
  Info,
  Loader2,
  Plus,
} from "lucide-react"
import {
  addStreamDestination,
  updateStreamDestination,
  deleteStreamDestination,
  type StreamDestination,
} from "@/lib/multistream-actions"

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Platform configurations
const PLATFORMS = [
  {
    id: "twitch",
    name: "Twitch",
    color: "#9146FF",
    rtmpUrl: "rtmp://live.twitch.tv/live",
    keyHelp: "Get your stream key from Twitch Dashboard → Settings → Stream",
    logo: "T",
  },
  {
    id: "youtube",
    name: "YouTube",
    color: "#FF0000",
    rtmpUrl: "rtmp://a.rtmp.youtube.com/live2",
    keyHelp: "Get your stream key from YouTube Studio → Go Live → Stream settings",
    logo: "Y",
  },
  {
    id: "kick",
    name: "Kick",
    color: "#53FC18",
    rtmpUrl: "rtmp://fa723fc1b171.global-contribute.live-video.net/app",
    keyHelp: "Get your stream key from Kick Dashboard → Settings → Stream",
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

export default function MultistreamPage() {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [pendingKeys, setPendingKeys] = useState<Record<string, string>>({})
  const [isAdding, setIsAdding] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const { data, error, mutate } = useSWR<{ data: StreamDestination[] }>(
    "/api/user/multistream",
    fetcher
  )

  const destinations = data?.data || []
  const isLoading = !data && !error

  const getPlatform = (platformId: string) => 
    PLATFORMS.find(p => p.id === platformId)

  const availablePlatforms = PLATFORMS.filter(
    p => !destinations.some(d => d.platform === p.id)
  )

  const enabledDestinations = destinations.filter(d => d.enabled && d.stream_key)

  const handleAddPlatform = async (platformId: string) => {
    setIsAdding(platformId)
    try {
      const result = await addStreamDestination(platformId, "")
      if (!result.error) {
        mutate()
      }
    } catch (err) {
      console.error("Error adding platform:", err)
    } finally {
      setIsAdding(null)
    }
  }

  const handleUpdateKey = async (destId: string) => {
    const newKey = pendingKeys[destId]
    if (!newKey) return

    setIsUpdating(destId)
    try {
      const result = await updateStreamDestination(destId, { stream_key: newKey })
      if (!result.error) {
        mutate()
        setPendingKeys(prev => {
          const { [destId]: _, ...rest } = prev
          return rest
        })
      }
    } catch (err) {
      console.error("Error updating key:", err)
    } finally {
      setIsUpdating(null)
    }
  }

  const handleToggleEnabled = async (destId: string, enabled: boolean) => {
    try {
      await updateStreamDestination(destId, { enabled })
      mutate()
    } catch (err) {
      console.error("Error toggling enabled:", err)
    }
  }

  const handleDelete = async (destId: string) => {
    setIsDeleting(destId)
    try {
      await deleteStreamDestination(destId)
      mutate()
    } catch (err) {
      console.error("Error deleting:", err)
    } finally {
      setIsDeleting(null)
    }
  }

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
                <li>When you go live, we rebroadcast to all enabled platforms</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Platform Buttons */}
      {availablePlatforms.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium mb-3">Add Platform</h2>
          <div className="flex flex-wrap gap-2">
            {availablePlatforms.map((platform) => (
              <Button
                key={platform.id}
                size="sm"
                variant="outline"
                onClick={() => handleAddPlatform(platform.id)}
                disabled={isAdding === platform.id}
                className="gap-2"
              >
                {isAdding === platform.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <div
                    className="h-4 w-4 rounded flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: platform.color }}
                  >
                    {platform.logo}
                  </div>
                )}
                {platform.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Destinations */}
      <div className="space-y-4 mb-6">
        <h2 className="text-lg font-semibold">Stream Destinations</h2>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : destinations.length === 0 ? (
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

              const currentKey = pendingKeys[dest.id] ?? dest.stream_key
              const hasUnsavedChanges = pendingKeys[dest.id] !== undefined && pendingKeys[dest.id] !== dest.stream_key

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
                        {dest.stream_key ? (
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
                          onCheckedChange={(checked) => handleToggleEnabled(dest.id, checked)}
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
                          value={currentKey}
                          onChange={(e) => setPendingKeys(prev => ({ ...prev, [dest.id]: e.target.value }))}
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
                        {hasUnsavedChanges && (
                          <Button
                            onClick={() => handleUpdateKey(dest.id)}
                            disabled={isUpdating === dest.id}
                          >
                            {isUpdating === dest.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                        )}
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
                              <AlertDialogAction 
                                onClick={() => handleDelete(dest.id)}
                                disabled={isDeleting === dest.id}
                              >
                                {isDeleting === dest.id ? "Removing..." : "Remove"}
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
                Multistreaming broadcasts your stream to multiple platforms at once. 
                Your stream keys are stored securely and only used during active streams.
                Make sure you have the necessary permissions to stream on each platform.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
