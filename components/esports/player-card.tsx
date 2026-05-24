"use client"

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { 
  Trophy, 
  TrendingUp, 
  Users,
  Gamepad2,
  Medal,
  Radio,
  UserPlus,
  UserMinus,
  Loader2,
} from "lucide-react"

interface PlayerStats {
  wins?: number
  losses?: number
  points?: number
  rank?: number
  titles?: number
}

interface PlayerCardProps {
  player: {
    id: string
    first_name?: string | null
    last_name?: string | null
    display_name?: string | null
    avatar_url?: string | null
    team?: { name: string; tag?: string } | null
    stats?: PlayerStats
    isLive?: boolean
  }
  variant?: "default" | "compact" | "featured"
  rank?: number
  showFollow?: boolean
  isFollowing?: boolean
  onFollowToggle?: () => void
  followLoading?: boolean
  className?: string
}

function getInitials(player: { first_name?: string | null; last_name?: string | null }): string {
  const first = player.first_name?.[0] || ""
  const last = player.last_name?.[0] || ""
  return (first + last).toUpperCase() || "?"
}

function getDisplayName(player: { first_name?: string | null; last_name?: string | null; display_name?: string | null }): string {
  if (player.display_name) return player.display_name
  return `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Unknown"
}

export function PlayerCard({
  player,
  variant = "default",
  rank,
  showFollow = false,
  isFollowing = false,
  onFollowToggle,
  followLoading = false,
  className,
}: PlayerCardProps) {
  const displayName = getDisplayName(player)
  const stats = player.stats
  
  // Compact variant - for lists
  if (variant === "compact") {
    return (
      <Link href={`/esports/players/${player.id}`}>
        <Card className={cn(
          "esports-card glass-panel border-0 flex items-center gap-3 p-3",
          className
        )}>
          {rank && (
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
              rank === 1 ? "bg-yellow-500/20 text-yellow-500" :
              rank === 2 ? "bg-gray-400/20 text-gray-400" :
              rank === 3 ? "bg-orange-600/20 text-orange-600" :
              "bg-muted text-muted-foreground"
            )}>
              {rank}
            </div>
          )}
          
          <div className="relative">
            <Avatar className="h-10 w-10 ring-2 ring-border">
              <AvatarImage src={player.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {getInitials(player)}
              </AvatarFallback>
            </Avatar>
            {player.isLive && (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive">
                <Radio className="h-2.5 w-2.5 text-white animate-pulse" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{displayName}</p>
            {player.team && (
              <p className="text-xs text-muted-foreground truncate">
                {player.team.tag ? `[${player.team.tag}]` : ""} {player.team.name}
              </p>
            )}
          </div>

          {stats && (
            <div className="flex items-center gap-3 text-sm">
              {stats.points !== undefined && (
                <span className="badge-featured px-2 py-0.5 rounded text-xs font-semibold">
                  {stats.points.toLocaleString()} pts
                </span>
              )}
              {stats.wins !== undefined && stats.losses !== undefined && (
                <span className="text-muted-foreground">
                  <span className="text-green-500">{stats.wins}</span>
                  -
                  <span className="text-red-500">{stats.losses}</span>
                </span>
              )}
            </div>
          )}
        </Card>
      </Link>
    )
  }

  // Featured variant - for hero sections
  if (variant === "featured") {
    return (
      <Card className={cn(
        "esports-card glass-panel border-0 p-6 relative overflow-hidden",
        player.isLive && "glow-live",
        className
      )}>
        {player.isLive && (
          <Badge className="badge-live absolute top-4 right-4 gap-1">
            <Radio className="h-3 w-3" />
            LIVE
          </Badge>
        )}
        
        <div className="flex flex-col items-center text-center">
          {rank && (
            <Badge className={cn(
              "mb-3",
              rank === 1 ? "badge-featured" :
              rank === 2 ? "bg-gray-400/20 text-gray-300 border-gray-400/30" :
              rank === 3 ? "bg-orange-600/20 text-orange-500 border-orange-600/30" :
              ""
            )}>
              <Medal className="mr-1 h-3 w-3" />
              #{rank}
            </Badge>
          )}
          
          <Avatar className="h-24 w-24 ring-4 ring-primary/30 mb-4">
            <AvatarImage src={player.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-3xl">
              {getInitials(player)}
            </AvatarFallback>
          </Avatar>
          
          <Link href={`/esports/players/${player.id}`}>
            <h3 className="esports-heading text-xl text-foreground hover:text-primary transition-colors">
              {displayName}
            </h3>
          </Link>
          
          {player.team && (
            <p className="text-sm text-muted-foreground mt-1">
              <Users className="inline h-3 w-3 mr-1" />
              {player.team.tag ? `[${player.team.tag}]` : ""} {player.team.name}
            </p>
          )}
          
          {stats && (
            <div className="stat-bar mt-4 justify-center">
              {stats.points !== undefined && (
                <div className="stat-item">
                  <span className="stat-value text-primary">{stats.points.toLocaleString()}</span>
                  <span className="stat-label">Points</span>
                </div>
              )}
              {stats.wins !== undefined && stats.losses !== undefined && (
                <div className="stat-item">
                  <span className="stat-value">
                    <span className="text-green-500">{stats.wins}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-red-500">{stats.losses}</span>
                  </span>
                  <span className="stat-label">Record</span>
                </div>
              )}
              {stats.titles !== undefined && stats.titles > 0 && (
                <div className="stat-item">
                  <span className="stat-value text-yellow-500">{stats.titles}</span>
                  <span className="stat-label">Titles</span>
                </div>
              )}
            </div>
          )}
          
          {showFollow && onFollowToggle && (
            <Button
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              className="mt-4 gap-2"
              onClick={(e) => {
                e.preventDefault()
                onFollowToggle()
              }}
              disabled={followLoading}
            >
              {followLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isFollowing ? (
                <><UserMinus className="h-4 w-4" /> Following</>
              ) : (
                <><UserPlus className="h-4 w-4" /> Follow</>
              )}
            </Button>
          )}
        </div>
      </Card>
    )
  }

  // Default variant
  return (
    <Link href={`/esports/players/${player.id}`}>
      <Card className={cn(
        "esports-card glass-panel border-0 p-4 relative overflow-hidden",
        player.isLive && "ring-2 ring-destructive/50",
        className
      )}>
        {player.isLive && (
          <Badge className="badge-live absolute top-3 right-3 h-5 px-1.5 text-[10px] gap-0.5">
            <Radio className="h-2.5 w-2.5" />
            LIVE
          </Badge>
        )}
        
        <div className="flex items-start gap-4">
          <div className="relative">
            <Avatar className="h-14 w-14 ring-2 ring-border">
              <AvatarImage src={player.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {getInitials(player)}
              </AvatarFallback>
            </Avatar>
            {rank && rank <= 3 && (
              <div className={cn(
                "absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                rank === 1 ? "bg-yellow-500 text-black" :
                rank === 2 ? "bg-gray-400 text-black" :
                "bg-orange-600 text-white"
              )}>
                {rank}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {displayName}
            </h3>
            {player.team && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                <Users className="inline h-3 w-3 mr-1" />
                {player.team.tag ? `[${player.team.tag}]` : ""} {player.team.name}
              </p>
            )}
            
            {stats && (
              <div className="flex items-center gap-3 mt-2 text-xs">
                {stats.points !== undefined && (
                  <span className="flex items-center gap-1 text-primary">
                    <TrendingUp className="h-3 w-3" />
                    {stats.points.toLocaleString()} pts
                  </span>
                )}
                {stats.wins !== undefined && stats.losses !== undefined && (
                  <span className="text-muted-foreground">
                    <span className="text-green-500">{stats.wins}</span>-
                    <span className="text-red-500">{stats.losses}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}
