"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Play, Film, Clock, Flame, Upload, ChevronRight } from "lucide-react"
import { MediaCard, MediaGrid } from "@/components/media/media-card"
import { MediaUploadForm } from "@/components/media/media-upload-form"
import { getPlayerMedia, type PlayerMedia } from "@/lib/media-actions"
import type { MediaType } from "@/lib/media-utils"
import { createClient } from "@/lib/supabase/client"

interface PlayerMediaSectionProps {
  playerId: string
  playerName?: string
}

export function PlayerMediaSection({ playerId, playerName }: PlayerMediaSectionProps) {
  const [media, setMedia] = useState<PlayerMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"all" | MediaType>("all")
  const [isOwner, setIsOwner] = useState(false)
  
  useEffect(() => {
    async function load() {
      setLoading(true)
      
      // Check if current user is the profile owner
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsOwner(user?.id === playerId)
      
      // Fetch media
      const playerMedia = await getPlayerMedia(playerId, { limit: 12 })
      setMedia(playerMedia)
      setLoading(false)
    }
    load()
  }, [playerId])
  
  const filteredMedia = activeTab === "all" 
    ? media 
    : media.filter(m => m.media_type === activeTab)
  
  const clipCount = media.filter(m => m.media_type === "clip").length
  const highlightCount = media.filter(m => m.media_type === "highlight").length
  const vodCount = media.filter(m => ["vod", "full_match"].includes(m.media_type)).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (media.length === 0 && !isOwner) {
    return null // Don't show empty section for other users
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          Media
        </h2>
        
        {isOwner && (
          <MediaUploadForm
            trigger={
              <Button size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            }
            onSuccess={() => {
              // Refresh media
              getPlayerMedia(playerId, { limit: 12 }).then(setMedia)
            }}
          />
        )}
      </div>
      
      {media.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
          <Play className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No clips yet</p>
          {isOwner && (
            <p className="mt-2 text-sm text-muted-foreground">
              Share your best moments with the community!
            </p>
          )}
        </div>
      ) : (
        <>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all" className="gap-1.5">
                All
                <span className="text-xs text-muted-foreground">({media.length})</span>
              </TabsTrigger>
              {clipCount > 0 && (
                <TabsTrigger value="clip" className="gap-1.5">
                  <Flame className="h-3.5 w-3.5" />
                  Clips
                  <span className="text-xs text-muted-foreground">({clipCount})</span>
                </TabsTrigger>
              )}
              {highlightCount > 0 && (
                <TabsTrigger value="highlight" className="gap-1.5">
                  Highlights
                  <span className="text-xs text-muted-foreground">({highlightCount})</span>
                </TabsTrigger>
              )}
              {vodCount > 0 && (
                <TabsTrigger value="vod" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  VODs
                  <span className="text-xs text-muted-foreground">({vodCount})</span>
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-0">
              <MediaGrid 
                media={filteredMedia} 
                columns={3} 
                showPlayer={false}
              />
            </TabsContent>
          </Tabs>
          
          {media.length > 6 && (
            <div className="mt-4 text-center">
              <Button variant="outline" asChild>
                <Link href={`/media?player=${playerId}`}>
                  View all media
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
