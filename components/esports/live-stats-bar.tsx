"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Eye, Radio, Trophy, TrendingUp, Flame, Users } from "lucide-react"
import { getLiveStats } from "@/lib/tournament-controller-actions"
import { useLiveStreams, useLiveCount } from "@/lib/unified-realtime"

interface LiveStats {
  activeViewers: number
  liveMatches: number
  liveTournaments: number
}

interface LiveStatsBarProps {
  className?: string
  variant?: "bar" | "badges" | "minimal"
  refreshInterval?: number
}

export function LiveStatsBar({ 
  className, 
  variant = "bar",
  refreshInterval = 30000 
}: LiveStatsBarProps) {
  // Use unified realtime state for live streams
  const liveStreams = useLiveStreams()
  const liveStreamCount = useLiveCount()
  
  const [stats, setStats] = useState<LiveStats>({
    activeViewers: 0,
    liveMatches: 0,
    liveTournaments: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getLiveStats()
        // Merge API stats with realtime stream data
        setStats({
          ...data,
          liveMatches: Math.max(data.liveMatches, liveStreamCount),
          activeViewers: data.activeViewers + liveStreams.reduce((sum, s) => sum + s.viewerCount, 0)
        })
      } catch (error) {
        console.error("Failed to fetch live stats:", error)
        // Fallback to realtime data only
        setStats({
          activeViewers: liveStreams.reduce((sum, s) => sum + s.viewerCount, 0),
          liveMatches: liveStreamCount,
          liveTournaments: 0,
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval, liveStreams, liveStreamCount])

  const hasActivity = stats.activeViewers > 0 || stats.liveMatches > 0 || stats.liveTournaments > 0

  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center gap-3 text-sm", className)}>
        {stats.liveTournaments > 0 && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Trophy className="h-4 w-4" />
            {stats.liveTournaments} live
          </span>
        )}
        {stats.activeViewers > 0 && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Eye className="h-4 w-4" />
            {stats.activeViewers.toLocaleString()}
          </span>
        )}
      </div>
    )
  }

  if (variant === "badges") {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {stats.liveTournaments > 0 && (
          <Badge variant="secondary" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            {stats.liveTournaments} Tournament{stats.liveTournaments !== 1 ? "s" : ""} Live
          </Badge>
        )}
        {stats.liveMatches > 0 && (
          <Badge variant="secondary" className="gap-1.5">
            <Radio className="h-3.5 w-3.5 text-destructive" />
            {stats.liveMatches} Match{stats.liveMatches !== 1 ? "es" : ""} Streaming
          </Badge>
        )}
        {stats.activeViewers > 0 && (
          <Badge variant="secondary" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            {stats.activeViewers.toLocaleString()} Watching
          </Badge>
        )}
        {!hasActivity && !isLoading && (
          <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            No live activity
          </Badge>
        )}
      </div>
    )
  }

  // Default bar variant
  return (
    <div className={cn(
      "flex items-center justify-between rounded-lg border bg-card/50 px-4 py-3 backdrop-blur-sm",
      hasActivity && "border-primary/20 bg-primary/5",
      className
    )}>
      <div className="flex items-center gap-2">
        {hasActivity ? (
          <>
            <div className="flex h-2 w-2 items-center justify-center">
              <span className="absolute h-2 w-2 animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-destructive" />
            </div>
            <span className="font-semibold text-foreground">MAJH LIVE</span>
          </>
        ) : (
          <span className="text-muted-foreground">No Live Content</span>
        )}
      </div>

      <div className="flex items-center gap-6">
        <StatItem 
          icon={Trophy} 
          value={stats.liveTournaments} 
          label="tournaments"
          highlight={stats.liveTournaments > 0}
        />
        <StatItem 
          icon={Radio} 
          value={stats.liveMatches} 
          label="matches"
          highlight={stats.liveMatches > 0}
        />
        <StatItem 
          icon={Eye} 
          value={stats.activeViewers} 
          label="viewers"
          highlight={stats.activeViewers > 10}
        />
      </div>
    </div>
  )
}

function StatItem({ 
  icon: Icon, 
  value, 
  label, 
  highlight 
}: { 
  icon: any
  value: number
  label: string
  highlight?: boolean
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 text-sm",
      highlight ? "text-foreground" : "text-muted-foreground"
    )}>
      <Icon className={cn("h-4 w-4", highlight && "text-primary")} />
      <span className="font-medium">{value.toLocaleString()}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  )
}

// Trending indicator badge
export function TrendingIndicator({ 
  score, 
  velocity,
  className 
}: { 
  score: number
  velocity: number
  className?: string
}) {
  if (score < 10 && velocity <= 0) return null

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {velocity > 5 && (
        <Badge className="gap-1 bg-emerald-500/90 text-white">
          <TrendingUp className="h-3 w-3" />
          +{velocity}
        </Badge>
      )}
      {score > 50 && (
        <Badge className="gap-1 bg-orange-500/90 text-white">
          <Flame className="h-3 w-3" />
          Hot
        </Badge>
      )}
    </div>
  )
}
