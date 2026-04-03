"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Flame, Undo2, Zap, Target, TrendingUp, Crown } from "lucide-react"
import type { MomentumBadge as MomentumBadgeType } from "@/lib/tournament-controller-actions"

const MOMENTUM_CONFIG: Record<MomentumBadgeType, {
  label: string
  icon: React.ElementType
  color: string
  bgColor: string
  description: string
}> = {
  on_fire: {
    label: "On Fire",
    icon: Flame,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10 border-orange-500/30",
    description: "Player has won 3+ games in a row",
  },
  comeback: {
    label: "Comeback",
    icon: Undo2,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
    description: "Player overcame a 2+ game deficit",
  },
  clutch_game: {
    label: "Clutch",
    icon: Zap,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10 border-yellow-500/30",
    description: "Multiple lead changes - anyone can win",
  },
  final_game: {
    label: "Final Game",
    icon: Target,
    color: "text-red-500",
    bgColor: "bg-red-500/10 border-red-500/30",
    description: "Deciding game - winner takes all",
  },
  upset_brewing: {
    label: "Upset Alert",
    icon: TrendingUp,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10 border-purple-500/30",
    description: "Lower seed is winning against favorite",
  },
  dominant: {
    label: "Dominant",
    icon: Crown,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10 border-blue-500/30",
    description: "Player hasn't dropped a game",
  },
}

interface MomentumBadgeProps {
  badge: MomentumBadgeType | null
  size?: "sm" | "md" | "lg"
  showTooltip?: boolean
  animate?: boolean
  className?: string
}

export function MomentumBadge({ 
  badge, 
  size = "md", 
  showTooltip = true,
  animate = true,
  className 
}: MomentumBadgeProps) {
  if (!badge) return null
  
  const config = MOMENTUM_CONFIG[badge]
  if (!config) return null
  
  const Icon = config.icon
  
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  }
  
  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  }
  
  const badgeContent = (
    <Badge 
      variant="outline" 
      className={cn(
        "font-semibold border",
        config.bgColor,
        config.color,
        sizeClasses[size],
        animate && "animate-pulse",
        className
      )}
    >
      <Icon className={cn(iconSizes[size], animate && badge === "on_fire" && "animate-bounce")} />
      {config.label}
    </Badge>
  )
  
  if (!showTooltip) return badgeContent
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface MomentumIndicatorProps {
  momentum: {
    momentumPlayerId: string | null
    momentumStreak: number
    leadChanges: number
    isDecidingGame: boolean
    momentumBadge: MomentumBadgeType | null
  }
  player1Id: string
  player2Id: string
  player1Name?: string
  player2Name?: string
  className?: string
}

export function MomentumIndicator({
  momentum,
  player1Id,
  player2Id,
  player1Name = "Player 1",
  player2Name = "Player 2",
  className,
}: MomentumIndicatorProps) {
  const { momentumPlayerId, momentumStreak, leadChanges, isDecidingGame, momentumBadge } = momentum
  
  const momentumPlayerName = momentumPlayerId === player1Id 
    ? player1Name 
    : momentumPlayerId === player2Id 
      ? player2Name 
      : null
  
  return (
    <div className={cn("flex items-center gap-3 text-sm", className)}>
      {momentumBadge && <MomentumBadge badge={momentumBadge} size="sm" />}
      
      {momentumStreak >= 2 && momentumPlayerName && (
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{momentumPlayerName}</span>
          {" "}on a {momentumStreak}-game streak
        </span>
      )}
      
      {leadChanges >= 2 && (
        <span className="text-muted-foreground">
          {leadChanges} lead changes
        </span>
      )}
      
      {isDecidingGame && (
        <span className="font-semibold text-destructive animate-pulse">
          MATCH POINT
        </span>
      )}
    </div>
  )
}

interface GameHistoryBarProps {
  games: Array<{
    game_number: number
    winner_id: string | null
    player1_score: number
    player2_score: number
  }>
  player1Id: string
  player2Id: string
  gamesToWin?: number
  className?: string
}

export function GameHistoryBar({
  games,
  player1Id,
  player2Id,
  gamesToWin = 2,
  className,
}: GameHistoryBarProps) {
  const totalGames = gamesToWin * 2 - 1
  
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: totalGames }).map((_, i) => {
        const game = games[i]
        const isPlayed = !!game
        const isP1Win = game?.winner_id === player1Id
        const isP2Win = game?.winner_id === player2Id
        
        return (
          <div
            key={i}
            className={cn(
              "h-2 w-4 rounded-sm transition-all",
              !isPlayed && "bg-muted",
              isP1Win && "bg-primary",
              isP2Win && "bg-destructive"
            )}
            title={isPlayed ? `Game ${i + 1}: ${isP1Win ? "P1" : "P2"} wins` : `Game ${i + 1}`}
          />
        )
      })}
    </div>
  )
}
