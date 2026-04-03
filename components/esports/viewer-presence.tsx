"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { updateViewerPresence, getMatchEngagement } from "@/lib/tournament-controller-actions"
import { createClient } from "@/lib/supabase/client"
import { Users, Eye, Flame, TrendingUp } from "lucide-react"

export function ViewerCount({
  matchId,
  className,
  showLabel = true,
  size = "default",
}: {
  matchId: string
  className?: string
  showLabel?: boolean
  size?: "sm" | "default" | "lg"
}) {
  const [viewerCount, setViewerCount] = useState(0)
  const [sessionId] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("viewer_session") || Math.random().toString(36).slice(2)
      : ""
  )

  // Store session ID
  useEffect(() => {
    if (sessionId && typeof window !== "undefined") {
      localStorage.setItem("viewer_session", sessionId)
    }
  }, [sessionId])

  // Send heartbeat every 30 seconds
  useEffect(() => {
    const sendHeartbeat = async () => {
      const result = await updateViewerPresence(matchId, sessionId)
      if (result.viewerCount !== undefined) {
        setViewerCount(result.viewerCount)
      }
    }

    // Initial heartbeat
    sendHeartbeat()

    // Set up interval
    const interval = setInterval(sendHeartbeat, 30000)

    return () => clearInterval(interval)
  }, [matchId, sessionId])

  // Subscribe to viewer changes
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`viewers:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_viewers",
          filter: `match_id=eq.${matchId}`,
        },
        async () => {
          // Re-fetch count on any change
          const result = await updateViewerPresence(matchId, sessionId)
          if (result.viewerCount !== undefined) {
            setViewerCount(result.viewerCount)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, sessionId])

  const sizeClasses = {
    sm: "h-5 px-1.5 text-[10px]",
    default: "h-6 px-2 text-xs",
    lg: "h-7 px-2.5 text-sm",
  }

  const iconSizes = {
    sm: "h-3 w-3",
    default: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        "flex items-center gap-1 font-medium",
        sizeClasses[size],
        viewerCount > 10 && "bg-red-500/20 text-red-500",
        className
      )}
    >
      <Eye className={cn(iconSizes[size], viewerCount > 10 && "animate-pulse")} />
      {viewerCount}
      {showLabel && <span className="hidden sm:inline">watching</span>}
    </Badge>
  )
}

export function EngagementStats({
  matchId,
  className,
}: {
  matchId: string
  className?: string
}) {
  const [stats, setStats] = useState({
    viewers: 0,
    reactions: 0,
    predictions: 0,
    hypeScore: 0,
    peakViewers: 0,
  })

  useEffect(() => {
    const fetchStats = async () => {
      const data = await getMatchEngagement(matchId)
      setStats(data)
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10000) // Refresh every 10s

    return () => clearInterval(interval)
  }, [matchId])

  // Calculate hype level
  const getHypeLevel = (score: number) => {
    if (score >= 500) return { label: "ON FIRE", color: "text-orange-500", bg: "bg-orange-500/20" }
    if (score >= 200) return { label: "HYPE", color: "text-yellow-500", bg: "bg-yellow-500/20" }
    if (score >= 50) return { label: "Active", color: "text-green-500", bg: "bg-green-500/20" }
    return { label: "Quiet", color: "text-muted-foreground", bg: "bg-muted" }
  }

  const hypeLevel = getHypeLevel(stats.hypeScore)

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Badge variant="secondary" className="flex items-center gap-1">
        <Eye className="h-3 w-3" />
        {stats.viewers} watching
      </Badge>

      <Badge variant="secondary" className="flex items-center gap-1">
        <Users className="h-3 w-3" />
        {stats.predictions} predictions
      </Badge>

      <Badge variant="secondary" className={cn("flex items-center gap-1", hypeLevel.bg, hypeLevel.color)}>
        <Flame className={cn("h-3 w-3", stats.hypeScore >= 200 && "animate-pulse")} />
        {hypeLevel.label}
      </Badge>

      {stats.peakViewers > 0 && (
        <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          Peak: {stats.peakViewers}
        </Badge>
      )}
    </div>
  )
}

// Compact version for match cards
export function ViewerBadge({
  matchId,
  className,
}: {
  matchId: string
  className?: string
}) {
  const [viewerCount, setViewerCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      const result = await updateViewerPresence(matchId)
      if (result.viewerCount !== undefined) {
        setViewerCount(result.viewerCount)
      }
    }

    fetchCount()
  }, [matchId])

  if (viewerCount === 0) return null

  return (
    <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <Eye className="h-3 w-3" />
      {viewerCount}
    </span>
  )
}
