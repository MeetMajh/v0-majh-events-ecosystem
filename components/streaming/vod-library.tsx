"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  Play,
  Eye,
  Clock,
  Calendar,
  Trophy,
  ChevronRight,
  Film,
  List,
  Bookmark,
  Star,
} from "lucide-react"
import { useVODs, useTournamentVODs } from "@/lib/hooks/use-streaming"

interface VODChapter {
  id: string
  title: string
  timestamp_seconds: number
  chapter_type: string
}

interface VOD {
  id: string
  title: string
  description?: string
  thumbnail_url?: string
  video_url: string
  duration_seconds?: number
  view_count: number
  is_featured: boolean
  recorded_at?: string
  published_at?: string
  chapters?: VODChapter[]
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "--:--"
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatViewCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

function formatDate(dateString?: string): string {
  if (!dateString) return ""
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString))
}

interface VODCardProps {
  vod: VOD
  variant?: "default" | "compact" | "featured"
}

function VODCard({ vod, variant = "default" }: VODCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const hasChapters = vod.chapters && vod.chapters.length > 0

  if (variant === "featured") {
    return (
      <Card
        className="group relative overflow-hidden border-primary/30 bg-gradient-to-br from-card to-card/80"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="grid md:grid-cols-2 gap-0">
          <div className="aspect-video relative">
            {vod.thumbnail_url ? (
              <img
                src={vod.thumbnail_url}
                alt={vod.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Film className="h-16 w-16 text-primary/30" />
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            <div className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity",
              isHovered ? "opacity-100" : "opacity-0"
            )}>
              <Button size="lg" className="rounded-full h-16 w-16 bg-primary/90 hover:bg-primary">
                <Play className="h-8 w-8" />
              </Button>
            </div>
            
            <Badge className="absolute top-3 right-3 bg-black/70 text-white border-0">
              {formatDuration(vod.duration_seconds)}
            </Badge>
            
            {vod.is_featured && (
              <Badge className="absolute top-3 left-3 bg-yellow-500/20 text-yellow-500 border-0 gap-1">
                <Star className="h-3 w-3" />
                Featured
              </Badge>
            )}
          </div>

          <div className="p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-foreground mb-2">{vod.title}</h3>
              {vod.description && (
                <p className="text-muted-foreground text-sm line-clamp-3 mb-4">{vod.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {formatViewCount(vod.view_count)} views
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(vod.recorded_at || vod.published_at)}
                </span>
              </div>
            </div>

            {hasChapters && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <List className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {vod.chapters!.length} Chapters
                  </span>
                </div>
                <div className="space-y-1">
                  {vod.chapters!.slice(0, 3).map((chapter) => (
                    <div
                      key={chapter.id}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span className="truncate">{chapter.title}</span>
                      <span className="flex-shrink-0 ml-2">{formatDuration(chapter.timestamp_seconds)}</span>
                    </div>
                  ))}
                  {vod.chapters!.length > 3 && (
                    <p className="text-xs text-primary">+{vod.chapters!.length - 3} more</p>
                  )}
                </div>
              </div>
            )}

            <Button className="mt-4" asChild>
              <Link href={`/live/vods/${vod.id}`}>
                Watch Now <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  if (variant === "compact") {
    return (
      <Card className="group overflow-hidden border-border hover:border-primary/50 transition-colors">
        <div className="flex gap-3 p-2">
          <div className="relative w-32 aspect-video rounded-lg overflow-hidden flex-shrink-0">
            {vod.thumbnail_url ? (
              <img
                src={vod.thumbnail_url}
                alt={vod.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-primary/10 flex items-center justify-center">
                <Film className="h-6 w-6 text-primary/30" />
              </div>
            )}
            <Badge className="absolute bottom-1 right-1 bg-black/70 text-white border-0 text-xs px-1 py-0">
              {formatDuration(vod.duration_seconds)}
            </Badge>
          </div>
          <div className="flex-1 min-w-0 py-1">
            <h4 className="text-sm font-medium text-foreground line-clamp-2">{vod.title}</h4>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {formatViewCount(vod.view_count)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(vod.recorded_at)}
              </span>
            </div>
            {hasChapters && (
              <Badge variant="outline" className="mt-2 text-xs">
                <List className="h-3 w-3 mr-1" />
                {vod.chapters!.length} chapters
              </Badge>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card
      className="group overflow-hidden border-border hover:border-primary/50 transition-all"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="aspect-video relative">
        {vod.thumbnail_url ? (
          <img
            src={vod.thumbnail_url}
            alt={vod.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <Film className="h-12 w-12 text-primary/30" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <div className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity",
          isHovered ? "opacity-100" : "opacity-0"
        )}>
          <Button size="sm" className="rounded-full h-12 w-12 bg-primary/90 hover:bg-primary">
            <Play className="h-5 w-5" />
          </Button>
        </div>
        
        <Badge className="absolute top-2 right-2 bg-black/70 text-white border-0 text-xs">
          {formatDuration(vod.duration_seconds)}
        </Badge>
        
        {vod.is_featured && (
          <Badge className="absolute top-2 left-2 bg-yellow-500/20 text-yellow-500 border-0 text-xs gap-1">
            <Star className="h-3 w-3" />
            Featured
          </Badge>
        )}
        
        {hasChapters && (
          <Badge className="absolute bottom-2 left-2 bg-black/70 text-white border-0 text-xs gap-1">
            <List className="h-3 w-3" />
            {vod.chapters!.length} chapters
          </Badge>
        )}
      </div>
      <CardContent className="p-3">
        <h4 className="font-medium text-foreground line-clamp-2 text-sm">{vod.title}</h4>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatViewCount(vod.view_count)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(vod.recorded_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

interface VODLibraryProps {
  tournamentId?: string
  featured?: boolean
  limit?: number
  showTabs?: boolean
  title?: string
}

export function VODLibrary({
  tournamentId,
  featured,
  limit = 12,
  showTabs = true,
  title = "Past Broadcasts",
}: VODLibraryProps) {
  const [activeTab, setActiveTab] = useState("all")
  
  const { data, isLoading, error } = useVODs({
    tournamentId,
    featured: activeTab === "featured" ? true : featured,
    limit,
  })

  const vods = data?.data || []

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            {title}
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-video rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || vods.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          {title}
        </h2>
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Film className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No VODs available</p>
        </div>
      </div>
    )
  }

  const featuredVod = vods.find((v) => v.is_featured) || vods[0]
  const otherVods = vods.filter((v) => v.id !== featuredVod.id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          {title}
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/live/vods">View All</Link>
        </Button>
      </div>

      {showTabs && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-background/50">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="featured">Featured</TabsTrigger>
            <TabsTrigger value="tournament">Tournaments</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Featured VOD */}
      {featuredVod && <VODCard vod={featuredVod} variant="featured" />}

      {/* Grid of other VODs */}
      {otherVods.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {otherVods.map((vod) => (
            <VODCard key={vod.id} vod={vod} />
          ))}
        </div>
      )}
    </div>
  )
}

interface VODListProps {
  tournamentId?: string
  limit?: number
  variant?: "default" | "compact"
}

export function VODList({ tournamentId, limit = 10, variant = "default" }: VODListProps) {
  const { data, isLoading, error } = useTournamentVODs(tournamentId || null, limit)
  const vods = data?.data || []

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-card animate-pulse" />
        ))}
      </div>
    )
  }

  if (error || vods.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center">
        <Film className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No VODs yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {vods.map((vod) => (
        <VODCard key={vod.id} vod={vod} variant={variant} />
      ))}
    </div>
  )
}

export { VODCard }
