"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { moderateMedia } from "@/lib/media-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  Play, 
  AlertTriangle,
  Loader2,
  ExternalLink,
  RefreshCw
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface MediaItem {
  id: string
  title: string
  description: string | null
  media_type: string
  thumbnail_url: string | null
  video_url: string | null
  moderation_status: string
  visibility: string
  view_count: number
  created_at: string
  player: {
    id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  }
}

export default function MediaModerationPage() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending")
  
  const supabase = createClient()

  const fetchMedia = async () => {
    setLoading(true)
    let query = supabase
      .from("player_media")
      .select(`
        id,
        title,
        description,
        media_type,
        thumbnail_url,
        video_url,
        moderation_status,
        visibility,
        view_count,
        created_at,
        player:profiles!player_id(id, first_name, last_name, avatar_url)
      `)
      .order("created_at", { ascending: false })
      .limit(50)
    
    if (filter !== "all") {
      query = query.eq("moderation_status", filter)
    }
    
    const { data, error } = await query
    
    if (!error && data) {
      setMedia(data as unknown as MediaItem[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchMedia()
  }, [filter])

  const handleModerate = async (mediaId: string, action: "approved" | "rejected") => {
    setActionLoading(mediaId)
    const result = await moderateMedia(mediaId, action)
    if (result.success) {
      // Remove from list or update status
      setMedia(prev => 
        filter === "pending" 
          ? prev.filter(m => m.id !== mediaId)
          : prev.map(m => m.id === mediaId ? { ...m, moderation_status: action } : m)
      )
    }
    setActionLoading(null)
  }

  const statusCounts = {
    pending: media.filter(m => m.moderation_status === "pending").length,
    approved: media.filter(m => m.moderation_status === "approved").length,
    rejected: media.filter(m => m.moderation_status === "rejected").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Media Moderation</h1>
          <p className="text-muted-foreground">Review and approve user-uploaded content</p>
        </div>
        <Button variant="outline" onClick={fetchMedia} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-yellow-500/20 p-3">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statusCounts.pending}</p>
              <p className="text-sm text-muted-foreground">Pending Review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-green-500/20 p-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statusCounts.approved}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-red-500/20 p-3">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statusCounts.rejected}</p>
              <p className="text-sm text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending
            {statusCounts.pending > 0 && (
              <Badge variant="destructive" className="ml-1">{statusCounts.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            <CheckCircle className="mr-2 h-4 w-4" />
            Approved
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <XCircle className="mr-2 h-4 w-4" />
            Rejected
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : media.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium">No {filter} media</h3>
                <p className="text-sm text-muted-foreground">
                  {filter === "pending" 
                    ? "All caught up! No content waiting for review." 
                    : `No ${filter} content to display.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {media.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      {/* Thumbnail */}
                      <div className="relative aspect-video w-full md:w-64 flex-shrink-0 bg-muted">
                        {item.thumbnail_url ? (
                          <Image
                            src={item.thumbnail_url}
                            alt={item.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Play className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        <Badge className="absolute top-2 left-2 capitalize">
                          {item.media_type}
                        </Badge>
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold line-clamp-1">{item.title}</h3>
                            {item.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {item.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span>
                                By: {item.player?.first_name} {item.player?.last_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {item.view_count}
                              </span>
                              <span>
                                {new Date(item.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {/* Status badge */}
                          <Badge 
                            variant={
                              item.moderation_status === "approved" ? "default" :
                              item.moderation_status === "rejected" ? "destructive" :
                              "secondary"
                            }
                          >
                            {item.moderation_status}
                          </Badge>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-4">
                          <Link href={`/media/${item.id}`} target="_blank">
                            <Button variant="outline" size="sm">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Preview
                            </Button>
                          </Link>
                          
                          {item.moderation_status === "pending" && (
                            <>
                              <Button 
                                size="sm" 
                                onClick={() => handleModerate(item.id, "approved")}
                                disabled={actionLoading === item.id}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {actionLoading === item.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                )}
                                Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleModerate(item.id, "rejected")}
                                disabled={actionLoading === item.id}
                              >
                                {actionLoading === item.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <XCircle className="mr-2 h-4 w-4" />
                                )}
                                Reject
                              </Button>
                            </>
                          )}

                          {item.moderation_status === "approved" && (
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleModerate(item.id, "rejected")}
                              disabled={actionLoading === item.id}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Revoke
                            </Button>
                          )}

                          {item.moderation_status === "rejected" && (
                            <Button 
                              size="sm"
                              onClick={() => handleModerate(item.id, "approved")}
                              disabled={actionLoading === item.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Restore
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
