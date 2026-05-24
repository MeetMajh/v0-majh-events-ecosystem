"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Calendar, Clock, Gamepad2, Share2, Eye } from "lucide-react"
import Link from "next/link"
import MuxPlayer from "@mux/mux-player-react"

interface VODData {
  id: string
  title: string
  description?: string
  status: string
  playback_url?: string
  mux_playback_id?: string
  started_at?: string
  ended_at?: string
  total_views: number
  user?: {
    id: string
    first_name?: string
    last_name?: string
    avatar_url?: string
  }
  game?: {
    id: string
    name: string
    icon_url?: string
  }
}

export default function WatchVODPage() {
  const params = useParams()
  const vodId = params.id as string
  
  const [vod, setVod] = useState<VODData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchVOD() {
      const supabase = createClient()
      
      // Simplified query without joins to avoid RLS/FK issues
      const { data, error } = await supabase
        .from("user_streams")
        .select("*")
        .eq("id", vodId)
        .single()

      console.log("[v0] VOD fetch result:", data, "error:", error?.message, "code:", error?.code)

      if (error || !data) {
        console.error("[v0] Error fetching VOD:", error)
        setError("Recording not found")
      } else {
        setVod(data)
        // Increment view count (don't await, fire and forget)
        supabase
          .from("user_streams")
          .update({ total_views: (data.total_views || 0) + 1 })
          .eq("id", vodId)
          .then(() => console.log("[v0] View count incremented"))
      }
      setLoading(false)
    }

    if (vodId) {
      fetchVOD()
    }
  }, [vodId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading recording...</div>
      </div>
    )
  }

  if (error || !vod) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <h2 className="text-xl font-bold mb-2">Recording Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This recording may have been removed or doesn&apos;t exist.
            </p>
            <Button asChild>
              <Link href="/live">Browse Live Streams</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const streamerName = vod.user 
    ? `${vod.user.first_name || ''} ${vod.user.last_name || ''}`.trim() || 'MAJH Creator'
    : 'MAJH Creator'

  const duration = vod.started_at && vod.ended_at
    ? Math.round((new Date(vod.ended_at).getTime() - new Date(vod.started_at).getTime()) / 60000)
    : null

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Back button */}
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/live">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Live Hub
          </Link>
        </Button>

        <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
          {/* Main Video */}
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="aspect-video bg-black">
                {vod.mux_playback_id ? (
                  <MuxPlayer
                    playbackId={vod.mux_playback_id}
                    streamType="on-demand"
                    autoPlay={false}
                    className="w-full h-full"
                    metadata={{
                      video_title: vod.title,
                      viewer_user_id: "anonymous",
                    }}
                  />
                ) : vod.playback_url ? (
                  <video
                    src={vod.playback_url}
                    controls
                    autoPlay={false}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>Video unavailable</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Stream Info */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={vod.user?.avatar_url} />
                      <AvatarFallback>
                        {streamerName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h1 className="text-xl font-bold">{vod.title}</h1>
                      <p className="text-sm text-muted-foreground">
                        {streamerName}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                        {vod.game && (
                          <div className="flex items-center gap-1">
                            <Gamepad2 className="h-4 w-4" />
                            {vod.game.name}
                          </div>
                        )}
                        {vod.ended_at && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(vod.ended_at))}
                          </div>
                        )}
                        {duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {duration} min
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {vod.total_views || 0} views
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      navigator.clipboard.writeText(window.location.href)
                    }}>
                      <Share2 className="h-4 w-4 mr-1" />
                      Share
                    </Button>
                  </div>
                </div>

                {vod.description && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {vod.description}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Related VODs */}
          <div className="space-y-4">
            <h3 className="font-semibold">More from {streamerName}</h3>
            <p className="text-sm text-muted-foreground">
              More recordings coming soon...
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
