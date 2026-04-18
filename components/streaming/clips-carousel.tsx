"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Play,
  Eye,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  Film,
  Flame,
  Clock,
  Sparkles,
} from "lucide-react"
import { useTrendingClips } from "@/lib/hooks/use-streaming"

interface ClipCardProps {
  clip: {
    id: string
    title: string
    thumbnail_url?: string
    video_url: string
    duration_seconds: number
    clip_type: string
    view_count: number
    like_count: number
    is_featured: boolean
    highlight_score: number
    clipped_at: string
    created_at: string
  }
  variant?: "default" | "compact" | "featured"
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatViewCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

function ClipCard({ clip, variant = "default" }: ClipCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const clipTypeLabel = {
    manual: "Clip",
    auto_highlight: "Highlight",
    score_change: "Score",
    reaction_spike: "Hype",
    clutch: "Clutch",
  }[clip.clip_type] || "Clip"

  const clipTypeColor = {
    manual: "bg-primary/20 text-primary",
    auto_highlight: "bg-yellow-500/20 text-yellow-500",
    score_change: "bg-blue-500/20 text-blue-500",
    reaction_spike: "bg-orange-500/20 text-orange-500",
    clutch: "bg-purple-500/20 text-purple-500",
  }[clip.clip_type] || "bg-primary/20 text-primary"

  if (variant === "featured") {
    return (
      <Card
        className="group relative overflow-hidden border-primary/30 bg-gradient-to-br from-card to-card/80"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="aspect-video relative">
          {clip.thumbnail_url ? (
            <img
              src={clip.thumbnail_url}
              alt={clip.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Film className="h-16 w-16 text-primary/30" />
            </div>
          )}
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Play button */}
          <div className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            <Button size="lg" className="rounded-full h-16 w-16 bg-primary/90 hover:bg-primary">
              <Play className="h-8 w-8" />
            </Button>
          </div>
          
          {/* Duration badge */}
          <Badge className="absolute top-3 right-3 bg-black/70 text-white border-0">
            {formatDuration(clip.duration_seconds)}
          </Badge>
          
          {/* Type badge */}
          <Badge className={cn("absolute top-3 left-3 border-0", clipTypeColor)}>
            {clip.clip_type === "auto_highlight" && <Sparkles className="h-3 w-3 mr-1" />}
            {clipTypeLabel}
          </Badge>
          
          {/* Bottom info */}
          <div className="absolute bottom-0 inset-x-0 p-4">
            <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{clip.title}</h3>
            <div className="flex items-center gap-4 text-white/80 text-sm">
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {formatViewCount(clip.view_count)}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                {formatViewCount(clip.like_count)}
              </span>
              {clip.highlight_score > 0.7 && (
                <Badge className="bg-orange-500/20 text-orange-400 border-0 gap-1">
                  <Flame className="h-3 w-3" />
                  Hot
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  if (variant === "compact") {
    return (
      <Card
        className="group relative overflow-hidden border-border hover:border-primary/50 transition-colors"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex gap-3 p-2">
          <div className="relative w-24 aspect-video rounded-lg overflow-hidden flex-shrink-0">
            {clip.thumbnail_url ? (
              <img
                src={clip.thumbnail_url}
                alt={clip.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-primary/10 flex items-center justify-center">
                <Film className="h-6 w-6 text-primary/30" />
              </div>
            )}
            <Badge className="absolute bottom-1 right-1 bg-black/70 text-white border-0 text-xs px-1 py-0">
              {formatDuration(clip.duration_seconds)}
            </Badge>
          </div>
          <div className="flex-1 min-w-0 py-1">
            <h4 className="text-sm font-medium text-foreground line-clamp-2">{clip.title}</h4>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {formatViewCount(clip.view_count)}
              </span>
              <Badge className={cn("text-xs px-1.5 py-0 border-0", clipTypeColor)}>
                {clipTypeLabel}
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card
      className="group relative overflow-hidden border-border hover:border-primary/50 transition-all"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="aspect-video relative">
        {clip.thumbnail_url ? (
          <img
            src={clip.thumbnail_url}
            alt={clip.title}
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
          {formatDuration(clip.duration_seconds)}
        </Badge>
        
        <Badge className={cn("absolute top-2 left-2 border-0 text-xs", clipTypeColor)}>
          {clipTypeLabel}
        </Badge>
      </div>
      <CardContent className="p-3">
        <h4 className="font-medium text-foreground line-clamp-2 text-sm">{clip.title}</h4>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatViewCount(clip.view_count)}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {formatViewCount(clip.like_count)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

interface ClipsCarouselProps {
  tournamentId?: string
  limit?: number
  title?: string
  showViewAll?: boolean
}

export function ClipsCarousel({
  tournamentId,
  limit = 10,
  title = "Trending Clips",
  showViewAll = true,
}: ClipsCarouselProps) {
  const { data, isLoading, error } = useTrendingClips(limit, tournamentId)
  const [scrollPosition, setScrollPosition] = useState(0)

  const clips = data?.data || []

  const scrollLeft = () => {
    const container = document.getElementById("clips-carousel")
    if (container) {
      container.scrollBy({ left: -300, behavior: "smooth" })
      setScrollPosition(container.scrollLeft - 300)
    }
  }

  const scrollRight = () => {
    const container = document.getElementById("clips-carousel")
    if (container) {
      container.scrollBy({ left: 300, behavior: "smooth" })
      setScrollPosition(container.scrollLeft + 300)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            {title}
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-video rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || clips.length === 0) {
    return null
  }

  const featuredClip = clips[0]
  const otherClips = clips.slice(1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={scrollLeft}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={scrollRight}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {showViewAll && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/live/clips">View All</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Featured clip */}
        <div className="lg:col-span-1">
          <ClipCard clip={featuredClip} variant="featured" />
        </div>

        {/* Scrollable clips */}
        <div className="lg:col-span-2 relative">
          <div
            id="clips-carousel"
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {otherClips.map((clip) => (
              <div key={clip.id} className="flex-shrink-0 w-56">
                <ClipCard clip={clip} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ClipsGridProps {
  tournamentId?: string
  matchId?: string
  limit?: number
  variant?: "default" | "compact"
}

export function ClipsGrid({
  tournamentId,
  matchId,
  limit = 12,
  variant = "default",
}: ClipsGridProps) {
  const { data, isLoading, error } = useTrendingClips(limit, tournamentId)
  const clips = data?.data || []

  if (isLoading) {
    return (
      <div className={cn(
        "grid gap-4",
        variant === "compact" ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      )}>
        {Array.from({ length: limit }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl bg-card animate-pulse",
              variant === "compact" ? "h-20" : "aspect-video"
            )}
          />
        ))}
      </div>
    )
  }

  if (error || clips.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <Film className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No clips available</p>
      </div>
    )
  }

  return (
    <div className={cn(
      "grid gap-4",
      variant === "compact" ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    )}>
      {clips.map((clip) => (
        <ClipCard key={clip.id} clip={clip} variant={variant} />
      ))}
    </div>
  )
}

export { ClipCard }
