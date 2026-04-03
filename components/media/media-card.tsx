"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  Play,
  Eye,
  Heart,
  MessageSquare,
  Clock,
  MoreVertical,
  Flag,
  Share2,
  Bookmark,
  Trash2,
  Edit,
  Flame,
  Trophy,
  Gamepad2,
} from "lucide-react"
import type { PlayerMedia } from "@/lib/media-actions"
import type { MediaType } from "@/lib/media-utils"

interface MediaCardProps {
  media: PlayerMedia
  variant?: "default" | "compact" | "featured"
  showPlayer?: boolean
  isOwner?: boolean
  onDelete?: (id: string) => void
  onEdit?: (id: string) => void
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatViews(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

function getMediaTypeConfig(type: MediaType) {
  switch (type) {
    case "clip":
      return { label: "Clip", icon: Play, color: "bg-purple-500/20 text-purple-400" }
    case "vod":
      return { label: "VOD", icon: Clock, color: "bg-blue-500/20 text-blue-400" }
    case "highlight":
      return { label: "Highlight", icon: Flame, color: "bg-orange-500/20 text-orange-400" }
    case "full_match":
      return { label: "Full Match", icon: Trophy, color: "bg-emerald-500/20 text-emerald-400" }
    case "tutorial":
      return { label: "Tutorial", icon: Gamepad2, color: "bg-cyan-500/20 text-cyan-400" }
  }
}

export function MediaCard({
  media,
  variant = "default",
  showPlayer = true,
  isOwner = false,
  onDelete,
  onEdit,
}: MediaCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const typeConfig = getMediaTypeConfig(media.media_type)
  const TypeIcon = typeConfig.icon

  if (variant === "compact") {
    return (
      <Link href={`/media/${media.id}`}>
        <Card className="group overflow-hidden transition-all hover:bg-accent/50">
          <div className="flex gap-3 p-2">
            {/* Thumbnail */}
            <div className="relative aspect-video w-32 flex-shrink-0 overflow-hidden rounded-md bg-muted">
              {media.thumbnail_url ? (
                <Image
                  src={media.thumbnail_url}
                  alt={media.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Play className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">
                {formatDuration(media.duration_seconds)}
              </div>
            </div>
            
            {/* Info */}
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <h4 className="line-clamp-2 text-sm font-medium leading-tight">
                {media.title}
              </h4>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {formatViews(media.view_count)}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {media.like_count}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </Link>
    )
  }

  if (variant === "featured") {
    return (
      <Link href={`/media/${media.id}`}>
        <Card
          className="group relative overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Large thumbnail */}
          <div className="relative aspect-video overflow-hidden bg-muted">
            {media.thumbnail_url ? (
              <Image
                src={media.thumbnail_url}
                alt={media.title}
                fill
                className={cn(
                  "object-cover transition-transform duration-300",
                  isHovered && "scale-105"
                )}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Play className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
            
            {/* Overlay on hover */}
            <div className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity",
              isHovered ? "opacity-100" : "opacity-0"
            )}>
              <div className="rounded-full bg-white/90 p-4">
                <Play className="h-8 w-8 fill-black text-black" />
              </div>
            </div>
            
            {/* Duration badge */}
            <div className="absolute bottom-3 right-3 rounded bg-black/80 px-2 py-1 text-sm font-medium text-white">
              {formatDuration(media.duration_seconds)}
            </div>
            
            {/* Type badge */}
            <Badge className={cn("absolute left-3 top-3 gap-1", typeConfig.color)}>
              <TypeIcon className="h-3 w-3" />
              {typeConfig.label}
            </Badge>
            
            {/* Featured badge */}
            {media.is_featured && (
              <Badge className="absolute right-3 top-3 bg-amber-500 text-black">
                Featured
              </Badge>
            )}
          </div>
          
          <CardContent className="p-4">
            <h3 className="line-clamp-2 text-lg font-semibold leading-tight group-hover:text-primary">
              {media.title}
            </h3>
            
            {showPlayer && media.player && (
              <div className="mt-3 flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={media.player.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {media.player.first_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {media.player.first_name} {media.player.last_name}
                </span>
              </div>
            )}
            
            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {formatViews(media.view_count)} views
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                {media.like_count}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                {media.comment_count}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  // Default variant
  return (
    <Card
      className="group relative overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/media/${media.id}`}>
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden bg-muted">
          {media.thumbnail_url ? (
            <Image
              src={media.thumbnail_url}
              alt={media.title}
              fill
              className={cn(
                "object-cover transition-transform duration-300",
                isHovered && "scale-105"
              )}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Play className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          
          {/* Play overlay */}
          <div className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            <div className="rounded-full bg-white/90 p-3">
              <Play className="h-6 w-6 fill-black text-black" />
            </div>
          </div>
          
          {/* Duration */}
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(media.duration_seconds)}
          </div>
          
          {/* Type badge */}
          <Badge className={cn("absolute left-2 top-2 gap-1 text-xs", typeConfig.color)}>
            <TypeIcon className="h-3 w-3" />
            {typeConfig.label}
          </Badge>
        </div>
      </Link>
      
      <CardContent className="p-3">
        <div className="flex gap-3">
          {showPlayer && media.player && (
            <Link href={`/players/${media.player.id}`}>
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarImage src={media.player.avatar_url || undefined} />
                <AvatarFallback>
                  {media.player.first_name?.[0]}
                </AvatarFallback>
              </Avatar>
            </Link>
          )}
          
          <div className="min-w-0 flex-1">
            <Link href={`/media/${media.id}`}>
              <h4 className="line-clamp-2 text-sm font-medium leading-tight hover:text-primary">
                {media.title}
              </h4>
            </Link>
            
            {showPlayer && media.player && (
              <Link 
                href={`/players/${media.player.id}`}
                className="mt-1 block text-xs text-muted-foreground hover:text-foreground"
              >
                {media.player.first_name} {media.player.last_name}
              </Link>
            )}
            
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatViews(media.view_count)} views</span>
              <span>-</span>
              <span>{new Date(media.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          
          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
                  isHovered && "opacity-100"
                )}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Bookmark className="mr-2 h-4 w-4" />
                Save
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
              {isOwner ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onEdit?.(media.id)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => onDelete?.(media.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <Flag className="mr-2 h-4 w-4" />
                    Report
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}

// Grid component for displaying multiple cards
export function MediaGrid({
  media,
  variant = "default",
  showPlayer = true,
  columns = 4,
}: {
  media: PlayerMedia[]
  variant?: "default" | "compact" | "featured"
  showPlayer?: boolean
  columns?: 2 | 3 | 4
}) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  }

  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Play className="mb-4 h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">No media found</p>
      </div>
    )
  }

  return (
    <div className={cn("grid gap-4", gridCols[columns])}>
      {media.map((item) => (
        <MediaCard 
          key={item.id} 
          media={item} 
          variant={variant}
          showPlayer={showPlayer}
        />
      ))}
    </div>
  )
}
