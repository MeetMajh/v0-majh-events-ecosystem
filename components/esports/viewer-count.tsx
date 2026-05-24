"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { trackViewerSession, getMatchViewerCount } from "@/lib/tournament-controller-actions"
import { Eye, Users, TrendingUp } from "lucide-react"

interface ViewerCountProps {
  matchId: string
  initialCount?: number
  variant?: "badge" | "inline" | "large"
  className?: string
  trackViewing?: boolean
}

// Generate a unique session ID
function getSessionId(): string {
  if (typeof window === "undefined") return ""
  
  let sessionId = sessionStorage.getItem("viewer_session_id")
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    sessionStorage.setItem("viewer_session_id", sessionId)
  }
  return sessionId
}

export function ViewerCount({ 
  matchId, 
  initialCount = 0, 
  variant = "badge",
  className,
  trackViewing = true
}: ViewerCountProps) {
  const [count, setCount] = useState(initialCount)
  const [isTracking, setIsTracking] = useState(false)

  // Track viewer session
  useEffect(() => {
    if (!trackViewing || typeof window === "undefined") return

    const sessionId = getSessionId()
    let intervalId: NodeJS.Timeout

    const startTracking = async () => {
      await trackViewerSession(matchId, sessionId)
      setIsTracking(true)

      // Ping every 30 seconds to maintain active status
      intervalId = setInterval(async () => {
        await trackViewerSession(matchId, sessionId)
      }, 30000)
    }

    startTracking()

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [matchId, trackViewing])

  // Fetch viewer count periodically
  useEffect(() => {
    const fetchCount = async () => {
      const newCount = await getMatchViewerCount(matchId)
      setCount(newCount)
    }

    fetchCount()
    const intervalId = setInterval(fetchCount, 10000) // Update every 10 seconds

    return () => clearInterval(intervalId)
  }, [matchId])

  const formatCount = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
  }

  if (variant === "large") {
    return (
      <div className={cn("flex items-center gap-3 p-4 bg-muted/50 rounded-lg", className)}>
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-500/10">
          <Eye className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <div className="text-2xl font-bold">{formatCount(count)}</div>
          <div className="text-sm text-muted-foreground">watching now</div>
        </div>
        {count > 10 && (
          <div className="ml-auto flex items-center gap-1 text-green-500 text-sm">
            <TrendingUp className="h-4 w-4" />
            <span>Live</span>
          </div>
        )}
      </div>
    )
  }

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-sm text-muted-foreground", className)}>
        <Eye className="h-3.5 w-3.5" />
        <span>{formatCount(count)}</span>
      </span>
    )
  }

  // Default badge variant
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
      count > 0 ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground",
      className
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        count > 0 ? "bg-red-500 animate-pulse" : "bg-muted-foreground"
      )} />
      <Eye className="h-3 w-3" />
      <span>{formatCount(count)}</span>
    </div>
  )
}

// Hook for tracking viewer session
export function useViewerTracking(matchId: string, enabled: boolean = true) {
  const [sessionId, setSessionId] = useState<string>("")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSessionId(getSessionId())
    }
  }, [])

  useEffect(() => {
    if (!enabled || !sessionId) return

    let intervalId: NodeJS.Timeout

    const track = async () => {
      await trackViewerSession(matchId, sessionId)
    }

    track()
    intervalId = setInterval(track, 30000)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [matchId, sessionId, enabled])

  return sessionId
}
