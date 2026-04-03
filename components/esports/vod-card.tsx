"use client"

import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Play, Clock, Eye, Star, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

interface VOD {
  id: string
  title: string
  description?: string
  platform: string
  video_url: string
  embed_url?: string
  thumbnail_url?: string
  duration_seconds?: number
  round_number?: number
  is_featured?: boolean
  is_highlight?: boolean
  view_count?: number
  published_at?: string
  player1?: {
    id: string
    first_name: string
    last_name: string
    avatar_url?: string
  } | null
  player2?: {
    id: string
    first_name: string
    last_name: string
    avatar_url?: string
  } | null
  tournaments?: {
    id: string
    name: string
    slug: string
    games?: {
      name: string
      slug: string
    }
  }
}

interface VODCardProps {
  vod: VOD
  showTournament?: boolean
  size?: "small" | "medium" | "large"
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}

function getPlayerInitials(player: { first_name: string; last_name: string }): string {
  return `${player.first_name[0]}${player.last_name[0]}`.toUpperCase()
}

function getYouTubeThumbnail(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([^&?/]+)/)
  if (match) {
    return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`
  }
  return null
}

export function VODCard({ vod, showTournament = false, size = "medium" }: VODCardProps) {
  const thumbnail = vod.thumbnail_url || getYouTubeThumbnail(vod.video_url) || "/images/placeholder-vod.jpg"
  
  const sizeClasses = {
    small: "aspect-video",
    medium: "aspect-video",
    large: "aspect-video md:aspect-[16/9]",
  }

  return (
    <Card className={cn(
      "group overflow-hidden transition-all hover:ring-2 hover:ring-primary/50",
      vod.is_featured && "ring-2 ring-yellow-500/50"
    )}>
      <Link href={vod.video_url} target="_blank" rel="noopener noreferrer">
        <div className={cn("relative overflow-hidden bg-muted", sizeClasses[size])}>
          {/* Thumbnail */}
          <Image
            src={thumbnail}
            alt={vod.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes={size === "large" ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 100vw, 33vw"}
          />
          
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90">
              <Play className="h-8 w-8 fill-current text-primary-foreground" />
            </div>
          </div>
          
          {/* Duration badge */}
          {vod.duration_seconds && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
              <Clock className="h-3 w-3" />
              {formatDuration(vod.duration_seconds)}
            </div>
          )}
          
          {/* Featured/Highlight badges */}
          <div className="absolute left-2 top-2 flex gap-1.5">
            {vod.is_featured && (
              <Badge className="bg-yellow-500 text-yellow-950">
                <Star className="mr-1 h-3 w-3 fill-current" />
                Featured
              </Badge>
            )}
            {vod.is_highlight && (
              <Badge variant="destructive">
                <Trophy className="mr-1 h-3 w-3" />
                Highlight
              </Badge>
            )}
          </div>
          
          {/* Round number */}
          {vod.round_number && (
            <Badge 
              variant="secondary" 
              className="absolute right-2 top-2"
            >
              R{vod.round_number}
            </Badge>
          )}
        </div>
      </Link>
      
      <CardContent className="p-3">
        {/* Title */}
        <Link href={vod.video_url} target="_blank" rel="noopener noreferrer">
          <h3 className={cn(
            "font-semibold line-clamp-2 transition-colors hover:text-primary",
            size === "small" ? "text-sm" : "text-base"
          )}>
            {vod.title}
          </h3>
        </Link>
        
        {/* Players */}
        {(vod.player1 || vod.player2) && (
          <div className="mt-2 flex items-center gap-2">
            {vod.player1 && (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={vod.player1.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getPlayerInitials(vod.player1)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">
                  {vod.player1.first_name} {vod.player1.last_name}
                </span>
              </div>
            )}
            {vod.player1 && vod.player2 && (
              <span className="text-xs text-muted-foreground">vs</span>
            )}
            {vod.player2 && (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={vod.player2.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getPlayerInitials(vod.player2)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">
                  {vod.player2.first_name} {vod.player2.last_name}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Tournament info */}
        {showTournament && vod.tournaments && (
          <div className="mt-2">
            <Link 
              href={`/esports/tournaments/${vod.tournaments.slug}`}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              {vod.tournaments.name}
              {vod.tournaments.games && (
                <span className="ml-1 text-primary/70">
                  ({vod.tournaments.games.name})
                </span>
              )}
            </Link>
          </div>
        )}
        
        {/* View count and date */}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {vod.view_count !== undefined && vod.view_count > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatViewCount(vod.view_count)} views
            </span>
          )}
          {vod.published_at && (
            <span>
              {new Date(vod.published_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface VODGridProps {
  vods: VOD[]
  showTournament?: boolean
  emptyMessage?: string
}

export function VODGrid({ vods, showTournament = false, emptyMessage = "No VODs available" }: VODGridProps) {
  if (vods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <Play className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {vods.map((vod) => (
        <VODCard key={vod.id} vod={vod} showTournament={showTournament} />
      ))}
    </div>
  )
}
