"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { sendMatchReaction, type ReactionType } from "@/lib/tournament-controller-actions"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Flame, Skull, Sparkles, ThumbsUp, Zap, PartyPopper, Frown, Laugh } from "lucide-react"

const REACTIONS: { type: ReactionType; emoji: string; icon: any; label: string; color: string }[] = [
  { type: "hype", emoji: "🔥", icon: Flame, label: "HYPE", color: "text-orange-500" },
  { type: "pog", emoji: "😮", icon: Sparkles, label: "POG", color: "text-yellow-500" },
  { type: "clutch", emoji: "⚡", icon: Zap, label: "CLUTCH", color: "text-blue-500" },
  { type: "gg", emoji: "👏", icon: ThumbsUp, label: "GG", color: "text-green-500" },
  { type: "fire", emoji: "🎉", icon: PartyPopper, label: "LET'S GO", color: "text-purple-500" },
  { type: "sadge", emoji: "😢", icon: Frown, label: "SADGE", color: "text-gray-500" },
  { type: "lul", emoji: "😂", icon: Laugh, label: "LUL", color: "text-cyan-500" },
  { type: "skull", emoji: "💀", icon: Skull, label: "DEAD", color: "text-zinc-500" },
]

// Floating reaction animation
function FloatingReaction({ emoji, onComplete }: { emoji: string; onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000)
    return () => clearTimeout(timer)
  }, [onComplete])

  const randomX = Math.random() * 100
  const randomDelay = Math.random() * 0.3

  return (
    <div
      className="pointer-events-none absolute animate-float-up text-2xl"
      style={{
        left: `${randomX}%`,
        animationDelay: `${randomDelay}s`,
      }}
    >
      {emoji}
    </div>
  )
}

export function ReactionsBar({
  matchId,
  compact = false,
  className,
}: {
  matchId: string
  compact?: boolean
  className?: string
}) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [cooldown, setCooldown] = useState(false)
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string }[]>([])
  const [sessionId] = useState(() => 
    typeof window !== "undefined" 
      ? localStorage.getItem("session_id") || Math.random().toString(36).slice(2)
      : ""
  )

  // Subscribe to real-time reactions
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`reactions:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_reactions",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const reaction = payload.new as { reaction_type: string }
          
          // Update counts
          setCounts((prev) => ({
            ...prev,
            [reaction.reaction_type]: (prev[reaction.reaction_type] || 0) + 1,
          }))

          // Add floating animation
          const reactionConfig = REACTIONS.find((r) => r.type === reaction.reaction_type)
          if (reactionConfig) {
            const id = Date.now() + Math.random()
            setFloatingReactions((prev) => [...prev, { id, emoji: reactionConfig.emoji }])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId])

  // Store session ID
  useEffect(() => {
    if (sessionId && typeof window !== "undefined") {
      localStorage.setItem("session_id", sessionId)
    }
  }, [sessionId])

  const handleReaction = useCallback(async (type: ReactionType) => {
    if (cooldown) return

    setCooldown(true)
    setTimeout(() => setCooldown(false), 500) // 500ms cooldown

    const result = await sendMatchReaction(matchId, type, sessionId)
    if (result.error) {
      toast.error("Could not send reaction")
    }
  }, [matchId, sessionId, cooldown])

  const removeFloating = useCallback((id: number) => {
    setFloatingReactions((prev) => prev.filter((r) => r.id !== id))
  }, [])

  if (compact) {
    return (
      <div className={cn("relative flex items-center gap-1 overflow-hidden", className)}>
        {/* Floating reactions */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {floatingReactions.map((r) => (
            <FloatingReaction key={r.id} emoji={r.emoji} onComplete={() => removeFloating(r.id)} />
          ))}
        </div>

        {REACTIONS.slice(0, 4).map((reaction) => (
          <Button
            key={reaction.type}
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 gap-1 px-2 transition-transform hover:scale-110 active:scale-95",
              cooldown && "opacity-50"
            )}
            onClick={() => handleReaction(reaction.type)}
            disabled={cooldown}
          >
            <span className="text-lg">{reaction.emoji}</span>
            {counts[reaction.type] > 0 && (
              <span className="text-xs text-muted-foreground">{counts[reaction.type]}</span>
            )}
          </Button>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("relative rounded-xl border border-border bg-card/50 p-4", className)}>
      {/* Floating reactions */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
        {floatingReactions.map((r) => (
          <FloatingReaction key={r.id} emoji={r.emoji} onComplete={() => removeFloating(r.id)} />
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">React</span>
        {Object.values(counts).reduce((a, b) => a + b, 0) > 0 && (
          <Badge variant="secondary" className="text-xs">
            {Object.values(counts).reduce((a, b) => a + b, 0)} reactions
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {REACTIONS.map((reaction) => {
          const Icon = reaction.icon
          const count = counts[reaction.type] || 0

          return (
            <Button
              key={reaction.type}
              variant="outline"
              className={cn(
                "relative flex h-auto flex-col gap-1 py-2 transition-all hover:scale-105 active:scale-95",
                cooldown && "opacity-50",
                count > 0 && "border-primary/30 bg-primary/5"
              )}
              onClick={() => handleReaction(reaction.type)}
              disabled={cooldown}
            >
              <span className="text-xl">{reaction.emoji}</span>
              <span className={cn("text-[10px] font-medium", reaction.color)}>
                {reaction.label}
              </span>
              {count > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-[10px]"
                >
                  {count > 99 ? "99+" : count}
                </Badge>
              )}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

// Reaction feed for displaying recent reactions
export function ReactionFeed({
  matchId,
  className,
}: {
  matchId: string
  className?: string
}) {
  const [recentReactions, setRecentReactions] = useState<{ id: string; type: string; timestamp: number }[]>([])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`reaction-feed:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_reactions",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const reaction = payload.new as { id: string; reaction_type: string }
          setRecentReactions((prev) => [
            { id: reaction.id, type: reaction.reaction_type, timestamp: Date.now() },
            ...prev.slice(0, 19), // Keep last 20
          ])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId])

  // Remove old reactions
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setRecentReactions((prev) => prev.filter((r) => now - r.timestamp < 5000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (recentReactions.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {recentReactions.map((r) => {
        const config = REACTIONS.find((c) => c.type === r.type)
        return (
          <span
            key={r.id}
            className="animate-in fade-in slide-in-from-bottom-2 text-lg duration-300"
          >
            {config?.emoji}
          </span>
        )
      })}
    </div>
  )
}
