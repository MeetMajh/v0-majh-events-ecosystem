"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { addMatchReaction, getMatchReactionCounts } from "@/lib/tournament-controller-actions"
import { createClient } from "@/lib/supabase/client"
import { Flame, Laugh, HandMetal, Frown, Sparkles } from "lucide-react"

const REACTIONS = [
  { type: "fire" as const, icon: Flame, label: "Fire", color: "text-orange-500 hover:bg-orange-500/20" },
  { type: "shocked" as const, icon: Sparkles, label: "Shocked", color: "text-yellow-500 hover:bg-yellow-500/20" },
  { type: "clap" as const, icon: HandMetal, label: "Clap", color: "text-green-500 hover:bg-green-500/20" },
  { type: "sad" as const, icon: Frown, label: "Sad", color: "text-blue-500 hover:bg-blue-500/20" },
  { type: "laugh" as const, icon: Laugh, label: "Laugh", color: "text-purple-500 hover:bg-purple-500/20" },
]

interface MatchReactionsProps {
  matchId: string
  sessionId: string
  variant?: "bar" | "compact" | "floating"
  className?: string
}

export function MatchReactions({ matchId, sessionId, variant = "bar", className }: MatchReactionsProps) {
  const [counts, setCounts] = useState({
    fire_count: 0,
    shocked_count: 0,
    clap_count: 0,
    sad_count: 0,
    laugh_count: 0,
    total_count: 0,
  })
  const [recentReaction, setRecentReaction] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState<string | null>(null)

  // Fetch initial counts
  useEffect(() => {
    getMatchReactionCounts(matchId).then(setCounts)
  }, [matchId])

  // Subscribe to realtime updates
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase
      .channel(`reactions-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_reaction_counts",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          if (payload.new) {
            setCounts(payload.new as typeof counts)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId])

  const handleReaction = useCallback(async (type: typeof REACTIONS[number]["type"]) => {
    // Optimistic update
    setCounts(prev => ({
      ...prev,
      [`${type}_count`]: prev[`${type}_count` as keyof typeof prev] + 1,
      total_count: prev.total_count + 1,
    }))
    
    setRecentReaction(type)
    setIsAnimating(type)
    setTimeout(() => setIsAnimating(null), 300)

    await addMatchReaction(matchId, type, sessionId)
  }, [matchId, sessionId])

  const getCount = (type: string) => {
    const key = `${type}_count` as keyof typeof counts
    return counts[key] || 0
  }

  if (variant === "floating") {
    return (
      <div className={cn("fixed bottom-4 left-1/2 -translate-x-1/2 z-50", className)}>
        <div className="flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-lg border border-border p-1 shadow-xl">
          {REACTIONS.map(({ type, icon: Icon, label, color }) => (
            <Button
              key={type}
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full h-10 w-10 p-0 transition-all",
                color,
                isAnimating === type && "scale-125"
              )}
              onClick={() => handleReaction(type)}
              title={label}
            >
              <Icon className="h-5 w-5" />
            </Button>
          ))}
          <div className="px-3 text-sm font-medium text-muted-foreground">
            {counts.total_count.toLocaleString()}
          </div>
        </div>
      </div>
    )
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {REACTIONS.map(({ type, icon: Icon, color }) => (
          <Button
            key={type}
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-2 gap-1 text-xs",
              color,
              isAnimating === type && "scale-110"
            )}
            onClick={() => handleReaction(type)}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{getCount(type)}</span>
          </Button>
        ))}
      </div>
    )
  }

  // Default bar variant
  return (
    <div className={cn("flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-lg", className)}>
      {REACTIONS.map(({ type, icon: Icon, label, color }) => (
        <Button
          key={type}
          variant="ghost"
          size="sm"
          className={cn(
            "flex-col h-auto py-2 px-3 gap-1 transition-all",
            color,
            isAnimating === type && "scale-110"
          )}
          onClick={() => handleReaction(type)}
        >
          <Icon className={cn("h-6 w-6", isAnimating === type && "animate-bounce")} />
          <span className="text-xs font-medium">{getCount(type).toLocaleString()}</span>
        </Button>
      ))}
      <div className="ml-4 pl-4 border-l border-border">
        <div className="text-sm font-semibold">{counts.total_count.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">reactions</div>
      </div>
    </div>
  )
}

// Floating reaction animation burst
export function ReactionBurst({ type }: { type: string }) {
  const reaction = REACTIONS.find(r => r.type === type)
  if (!reaction) return null
  
  const Icon = reaction.icon
  
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-float-up"
          style={{
            left: `${30 + Math.random() * 40}%`,
            bottom: "20%",
            animationDelay: `${i * 0.1}s`,
          }}
        >
          <Icon className={cn("h-8 w-8", reaction.color)} />
        </div>
      ))}
    </div>
  )
}
