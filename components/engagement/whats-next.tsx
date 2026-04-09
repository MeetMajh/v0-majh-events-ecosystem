"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  X,
  ChevronRight,
  Play,
  Trophy,
  Users,
  Flame,
  Bell,
  Gamepad2,
  Video,
  Calendar,
  ArrowRight,
} from "lucide-react"

export type WhatsNextContext =
  | { type: "watched_clip"; clipId: string; playerId: string; playerName: string; gameName: string }
  | { type: "followed_player"; playerId: string; playerName: string }
  | { type: "viewed_tournament"; tournamentId: string; tournamentName: string }
  | { type: "completed_match"; matchId: string; winnerId: string }
  | { type: "first_visit" }

interface WhatsNextAction {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  href: string
  priority: number
  variant?: "default" | "primary" | "ghost"
}

function getActionsForContext(context: WhatsNextContext): WhatsNextAction[] {
  switch (context.type) {
    case "watched_clip":
      return [
        {
          id: "more-from-player",
          label: `More from ${context.playerName}`,
          description: "See all their clips",
          icon: <Video className="h-5 w-5" />,
          href: `/esports/players/${context.playerId}`,
          priority: 1,
          variant: "primary",
        },
        {
          id: "follow-player",
          label: `Follow ${context.playerName}`,
          description: "Get notified when they post",
          icon: <Bell className="h-5 w-5" />,
          href: `/esports/players/${context.playerId}?action=follow`,
          priority: 2,
        },
        {
          id: "more-game",
          label: `More ${context.gameName}`,
          description: "Explore clips from this game",
          icon: <Gamepad2 className="h-5 w-5" />,
          href: `/clips?game=${encodeURIComponent(context.gameName)}`,
          priority: 3,
        },
        {
          id: "live-matches",
          label: "Watch Live",
          description: "See who's playing now",
          icon: <Play className="h-5 w-5" />,
          href: "/live",
          priority: 4,
          variant: "ghost",
        },
      ]

    case "followed_player":
      return [
        {
          id: "player-clips",
          label: `Watch ${context.playerName}'s clips`,
          description: "See their best moments",
          icon: <Video className="h-5 w-5" />,
          href: `/esports/players/${context.playerId}?tab=media`,
          priority: 1,
          variant: "primary",
        },
        {
          id: "player-matches",
          label: "View match history",
          description: "See their tournament results",
          icon: <Trophy className="h-5 w-5" />,
          href: `/esports/players/${context.playerId}?tab=matches`,
          priority: 2,
        },
        {
          id: "explore-players",
          label: "Discover more players",
          description: "Find new favorites",
          icon: <Users className="h-5 w-5" />,
          href: "/esports/leaderboard",
          priority: 3,
        },
      ]

    case "viewed_tournament":
      return [
        {
          id: "join-tournament",
          label: "Register Now",
          description: "Secure your spot",
          icon: <Trophy className="h-5 w-5" />,
          href: `/esports/tournaments/${context.tournamentId}/register`,
          priority: 1,
          variant: "primary",
        },
        {
          id: "tournament-brackets",
          label: "View Brackets",
          description: "See the matchups",
          icon: <Gamepad2 className="h-5 w-5" />,
          href: `/esports/tournaments/${context.tournamentId}/brackets`,
          priority: 2,
        },
        {
          id: "set-reminder",
          label: "Set Reminder",
          description: "Get notified when it starts",
          icon: <Bell className="h-5 w-5" />,
          href: `/esports/tournaments/${context.tournamentId}?action=remind`,
          priority: 3,
        },
      ]

    case "completed_match":
      return [
        {
          id: "watch-replay",
          label: "Watch Replay",
          description: "See the full match",
          icon: <Play className="h-5 w-5" />,
          href: `/live?replay=${context.matchId}`,
          priority: 1,
          variant: "primary",
        },
        {
          id: "view-highlights",
          label: "Match Highlights",
          description: "See the best moments",
          icon: <Flame className="h-5 w-5" />,
          href: `/clips?match=${context.matchId}`,
          priority: 2,
        },
        {
          id: "follow-winner",
          label: "Follow Winner",
          description: "Stay updated on their journey",
          icon: <Bell className="h-5 w-5" />,
          href: `/esports/players/${context.winnerId}?action=follow`,
          priority: 3,
        },
      ]

    case "first_visit":
    default:
      return [
        {
          id: "explore-clips",
          label: "Watch Clips",
          description: "Best moments from the community",
          icon: <Play className="h-5 w-5" />,
          href: "/clips",
          priority: 1,
          variant: "primary",
        },
        {
          id: "live-now",
          label: "Watch Live",
          description: "See matches happening now",
          icon: <Flame className="h-5 w-5" />,
          href: "/live",
          priority: 2,
        },
        {
          id: "tournaments",
          label: "Browse Tournaments",
          description: "Find your next competition",
          icon: <Trophy className="h-5 w-5" />,
          href: "/esports/tournaments",
          priority: 3,
        },
        {
          id: "book-event",
          label: "Book an Event",
          description: "Host your own tournament",
          icon: <Calendar className="h-5 w-5" />,
          href: "/events",
          priority: 4,
          variant: "ghost",
        },
      ]
  }
}

interface WhatsNextProps {
  context: WhatsNextContext
  onDismiss?: () => void
  className?: string
  variant?: "inline" | "modal" | "toast"
}

export function WhatsNext({ context, onDismiss, className, variant = "inline" }: WhatsNextProps) {
  const [isVisible, setIsVisible] = useState(true)
  const actions = getActionsForContext(context).sort((a, b) => a.priority - b.priority)

  if (!isVisible) return null

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  if (variant === "toast") {
    return (
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={cn(
          "fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50",
          "bg-card border border-border rounded-xl shadow-xl overflow-hidden",
          className
        )}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">What&apos;s Next?</span>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-2">
            {actions.slice(0, 2).map((action) => (
              <Link
                key={action.id}
                href={action.href}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-colors",
                  action.variant === "primary"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted hover:bg-muted/80"
                )}
                onClick={handleDismiss}
              >
                {action.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{action.label}</p>
                  <p className={cn(
                    "text-xs truncate",
                    action.variant === "primary" ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {action.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  if (variant === "modal") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={handleDismiss}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={cn(
            "bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">What&apos;s Next?</h3>
              <button
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              {actions.map((action) => (
                <Link
                  key={action.id}
                  href={action.href}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl transition-all",
                    action.variant === "primary"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : action.variant === "ghost"
                      ? "hover:bg-muted"
                      : "bg-muted hover:bg-muted/80"
                  )}
                  onClick={handleDismiss}
                >
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full",
                    action.variant === "primary"
                      ? "bg-primary-foreground/20"
                      : "bg-background"
                  )}>
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{action.label}</p>
                    <p className={cn(
                      "text-sm",
                      action.variant === "primary" ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // Default: inline variant
  return (
    <div className={cn("bg-muted/50 rounded-xl p-4 border border-border", className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">What&apos;s Next?</span>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {actions.slice(0, 4).map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-lg text-center transition-colors",
              action.variant === "primary"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-background hover:bg-muted"
            )}
          >
            {action.icon}
            <span className="text-xs font-medium">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// Hook to manage What's Next state
export function useWhatsNext() {
  const [context, setContext] = useState<WhatsNextContext | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  const showPrompt = (newContext: WhatsNextContext) => {
    setContext(newContext)
    setIsVisible(true)
  }

  const hidePrompt = () => {
    setIsVisible(false)
    setTimeout(() => setContext(null), 300)
  }

  return {
    context,
    isVisible,
    showPrompt,
    hidePrompt,
  }
}
