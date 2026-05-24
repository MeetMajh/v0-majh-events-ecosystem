"use client"

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { 
  Flame, 
  TrendingUp, 
  MessageSquare, 
  Zap, 
  Eye,
  Users,
  Trophy,
  ArrowUp,
} from "lucide-react"
import type { TrendingMatch, TrendingBadge, MomentumBadge as MomentumBadgeType } from "@/lib/tournament-controller-actions"
import { MomentumBadge } from "@/components/esports/momentum-badge"

const BADGE_CONFIG: Record<TrendingBadge, { label: string; icon: any; className: string }> = {
  hot: { label: "HOT", icon: Flame, className: "bg-orange-500/90 text-white" },
  rising: { label: "RISING", icon: TrendingUp, className: "bg-emerald-500/90 text-white" },
  chat_exploding: { label: "CHAT EXPLODING", icon: MessageSquare, className: "bg-purple-500/90 text-white" },
  peak_viewers: { label: "PEAK VIEWERS", icon: Eye, className: "bg-blue-500/90 text-white" },
  clutch_moment: { label: "CLUTCH", icon: Zap, className: "bg-yellow-500/90 text-black" },
  upset_alert: { label: "UPSET ALERT", icon: Trophy, className: "bg-red-500/90 text-white" },
}

function getInitials(player: { first_name: string | null; last_name: string | null } | null): string {
  if (!player) return "?"
  const first = player.first_name?.[0] || ""
  const last = player.last_name?.[0] || ""
  return (first + last).toUpperCase() || "?"
}

function getPlayerName(player: { first_name: string | null; last_name: string | null } | null): string {
  if (!player) return "TBD"
  return `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Unknown"
}

interface TrendingMatchCardProps {
  match: TrendingMatch
  rank?: number
  variant?: "default" | "compact" | "featured"
}

export function TrendingMatchCard({ match, rank, variant = "default" }: TrendingMatchCardProps) {
  const badge = match.trendingBadge ? BADGE_CONFIG[match.trendingBadge] : null
  const BadgeIcon = badge?.icon
  
  const isLive = match.status === "in_progress" || match.status === "player1_reported" || match.status === "player2_reported"

  if (variant === "compact") {
    return (
      <Link href={`/match/${match.id}/watch`}>
        <Card className="esports-card glass-panel border-0 group flex items-center gap-3 p-3">
          {rank && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
              {rank}
            </div>
          )}
          
          <div className="flex flex-1 items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={match.player1?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">{getInitials(match.player1)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">vs</span>
            <Avatar className="h-7 w-7">
              <AvatarImage src={match.player2?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">{getInitials(match.player2)}</AvatarFallback>
            </Avatar>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isLive && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                LIVE
              </Badge>
            )}
            {match.viewerCount > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {match.viewerCount}
              </span>
            )}
            {match.viewerVelocity > 0 && (
              <span className="flex items-center gap-0.5 text-emerald-500">
                <ArrowUp className="h-3 w-3" />
                {match.viewerVelocity}
              </span>
            )}
          </div>

          {match.momentumBadge && (
            <MomentumBadge badge={match.momentumBadge} size="sm" showTooltip={false} animate={false} />
          )}
          {badge && !match.momentumBadge && (
            <Badge className={cn("h-5 px-1.5 text-[10px]", badge.className)}>
              {BadgeIcon && <BadgeIcon className="mr-0.5 h-3 w-3" />}
              {badge.label}
            </Badge>
          )}
        </Card>
      </Link>
    )
  }

  if (variant === "featured") {
    return (
      <Link href={`/match/${match.id}/watch`}>
        <Card className={cn(
          "esports-card glass-panel border-0 group relative overflow-hidden",
          isLive && "glow-live"
        )}>
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-destructive/5" />
          
          {/* Content */}
          <div className="relative p-6">
            {/* Header badges */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isLive && (
                  <Badge className="badge-live gap-1">
                    <span className="h-2 w-2 rounded-full bg-white" />
                    LIVE
                  </Badge>
                )}
                {badge && (
                  <Badge className={cn("gap-1", badge.className)}>
                    {BadgeIcon && <BadgeIcon className="h-3.5 w-3.5" />}
                    {badge.label}
                  </Badge>
                )}
                {match.momentumBadge && (
                  <MomentumBadge badge={match.momentumBadge} size="sm" />
                )}
                {match.isDecidingGame && !match.momentumBadge && (
                  <Badge variant="destructive" className="animate-pulse">MATCH POINT</Badge>
                )}
              </div>
              {match.tournament && (
                <Badge variant="outline" className="text-xs">
                  {match.tournament.gameName || match.tournament.name}
                </Badge>
              )}
            </div>

            {/* Players */}
            <div className="flex items-center justify-between">
              {/* Player 1 */}
              <div className="flex flex-col items-center gap-2">
                <Avatar className="h-16 w-16 border-2 border-background shadow-lg">
                  <AvatarImage src={match.player1?.avatar_url || undefined} />
                  <AvatarFallback className="text-xl">{getInitials(match.player1)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold">{getPlayerName(match.player1)}</span>
                <span className="text-2xl font-bold">{match.player1Wins}</span>
              </div>

              {/* VS */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-muted-foreground">VS</span>
                {match.roundNumber && (
                  <span className="text-xs text-muted-foreground">Round {match.roundNumber}</span>
                )}
              </div>

              {/* Player 2 */}
              <div className="flex flex-col items-center gap-2">
                <Avatar className="h-16 w-16 border-2 border-background shadow-lg">
                  <AvatarImage src={match.player2?.avatar_url || undefined} />
                  <AvatarFallback className="text-xl">{getInitials(match.player2)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold">{getPlayerName(match.player2)}</span>
                <span className="text-2xl font-bold">{match.player2Wins}</span>
              </div>
            </div>

            {/* Stats bar */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 border-t pt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                {match.viewerCount} watching
              </span>
              {match.leadChanges > 0 && (
                <span className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  {match.leadChanges} lead changes
                </span>
              )}
              {match.reactionsPerMinute > 0 && (
                <span className="flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-orange-500" />
                  {match.reactionsPerMinute.toFixed(1)}/min
                </span>
              )}
              {match.chatPerMinute > 0 && (
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  {match.chatPerMinute.toFixed(1)}/min
                </span>
              )}
            </div>
          </div>
        </Card>
      </Link>
    )
  }

  // Default variant
  return (
    <Link href={`/match/${match.id}/watch`}>
      <Card className="group overflow-hidden transition-all hover:shadow-lg hover:ring-2 hover:ring-primary/20">
        <div className="flex items-stretch">
          {/* Rank indicator */}
          {rank && (
            <div className={cn(
              "flex w-10 items-center justify-center font-bold",
              rank === 1 && "bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-950",
              rank === 2 && "bg-gradient-to-b from-slate-300 to-slate-500 text-slate-950",
              rank === 3 && "bg-gradient-to-b from-amber-600 to-amber-800 text-amber-100",
              rank > 3 && "bg-muted text-muted-foreground"
            )}>
              {rank}
            </div>
          )}

          {/* Main content */}
          <div className="flex flex-1 items-center gap-4 p-4">
            {/* Players */}
            <div className="flex items-center gap-2">
              <Avatar className="h-10 w-10">
                <AvatarImage src={match.player1?.avatar_url || undefined} />
                <AvatarFallback>{getInitials(match.player1)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{getPlayerName(match.player1)}</span>
                <span className="text-xs text-muted-foreground">
                  {match.player1Wins} - {match.player2Wins}
                </span>
              </div>
              <span className="mx-2 text-xs text-muted-foreground">vs</span>
              <Avatar className="h-10 w-10">
                <AvatarImage src={match.player2?.avatar_url || undefined} />
                <AvatarFallback>{getInitials(match.player2)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{getPlayerName(match.player2)}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 px-4 text-sm text-muted-foreground">
            {isLive && (
              <Badge variant="destructive" className="gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                LIVE
              </Badge>
            )}
            
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>{match.viewerCount}</span>
            </div>

            {match.viewerVelocity > 0 && (
              <div className="flex items-center gap-0.5 text-emerald-500">
                <ArrowUp className="h-4 w-4" />
                <span>{match.viewerVelocity}</span>
              </div>
            )}

            {badge && (
              <Badge className={cn("gap-1", badge.className)}>
                {BadgeIcon && <BadgeIcon className="h-3.5 w-3.5" />}
                {badge.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Tournament info */}
        {match.tournament && (
          <div className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              {match.tournament.name}
              {match.roundNumber && <span>- Round {match.roundNumber}</span>}
            </span>
          </div>
        )}
      </Card>
    </Link>
  )
}

// Trending list component
interface TrendingListProps {
  matches: TrendingMatch[]
  variant?: "default" | "compact" | "featured"
  showRanks?: boolean
  emptyMessage?: string
}

export function TrendingList({ 
  matches, 
  variant = "default", 
  showRanks = true,
  emptyMessage = "No trending matches right now"
}: TrendingListProps) {
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <TrendingUp className="mb-2 h-8 w-8 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {matches.map((match, index) => (
        <TrendingMatchCard 
          key={match.id} 
          match={match} 
          rank={showRanks ? index + 1 : undefined}
          variant={variant}
        />
      ))}
    </div>
  )
}
