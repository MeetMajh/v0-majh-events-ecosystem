"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import useSWR from "swr"
import {
  Radio,
  Eye,
  Trophy,
  Play,
  Clock,
  Flame,
  Users,
  ArrowRight,
  Gamepad2,
  Calendar,
  Video,
} from "lucide-react"

interface LiveEvent {
  id: string
  type: "match" | "stream" | "tournament"
  title: string
  game: string
  game_id?: string
  viewers: number
  thumbnail?: string
  players?: { name: string; avatar?: string }[]
  startsIn?: string
  isLive: boolean
  stream_url?: string
}

interface ActivityItem {
  id: string
  type: "clip_trending" | "match_started" | "player_joined" | "tournament_starting"
  message: string
  timestamp: string
  link?: string
}

interface LivePulseData {
  liveEvents: LiveEvent[]
  upcomingEvents: LiveEvent[]
  activityFeed: ActivityItem[]
  totalViewers: number
  liveCount: number
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

function formatViewers(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

export function LivePulse() {
  const { data, isLoading, error } = useSWR<LivePulseData>(
    "/api/live-pulse",
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  )

  const [currentActivityIndex, setCurrentActivityIndex] = useState(0)

  // Rotate through activity items
  useEffect(() => {
    if (!data?.activityFeed?.length) return
    
    const interval = setInterval(() => {
      setCurrentActivityIndex(prev => (prev + 1) % data.activityFeed.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [data?.activityFeed?.length])

  // Don't render anything if loading or no data
  if (isLoading) {
    return null // Silent loading - don't show skeleton that implies content exists
  }

  // If there's nothing live and nothing upcoming, show a simple CTA instead
  const hasLiveContent = data?.liveEvents && data.liveEvents.length > 0
  const hasUpcoming = data?.upcomingEvents && data.upcomingEvents.length > 0
  const hasActivity = data?.activityFeed && data.activityFeed.length > 0

  // If nothing is happening, show "Get Involved" CTA instead of fake data
  if (!hasLiveContent && !hasUpcoming) {
    return (
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">No Live Events Right Now</h3>
                <p className="text-sm text-muted-foreground">
                  Check out upcoming tournaments or browse clips
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/esports/tournaments">
                  <Calendar className="h-4 w-4 mr-2" />
                  View Tournaments
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/clips">
                  <Play className="h-4 w-4 mr-2" />
                  Browse Clips
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const allEvents = [
    ...(data?.liveEvents || []),
    ...(data?.upcomingEvents || []),
  ]

  return (
    <section className="border-b border-border bg-gradient-to-r from-primary/5 via-background to-primary/5">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Live indicator + stats - only show if actually live */}
          {hasLiveContent && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Radio className="h-5 w-5 text-red-500" />
                  <motion.div
                    className="absolute inset-0 rounded-full bg-red-500/30"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <span className="font-bold text-foreground">LIVE NOW</span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {data?.totalViewers > 0 && (
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{formatViewers(data.totalViewers)} watching</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span>{data?.liveCount || 0} live</span>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming indicator if no live content */}
          {!hasLiveContent && hasUpcoming && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="font-bold text-foreground">COMING UP</span>
              </div>
            </div>
          )}

          {/* Events carousel */}
          <div className="flex-1 flex items-center gap-3 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            {allEvents.map((event) => (
              <Link
                key={event.id}
                href={
                  event.isLive 
                    ? `/live?match=${event.id}` 
                    : `/esports/tournaments/${event.id}`
                }
                className={cn(
                  "flex-shrink-0 flex items-center gap-3 px-4 py-2 rounded-lg border transition-all hover:border-primary/50",
                  event.isLive
                    ? "bg-red-500/5 border-red-500/20"
                    : "bg-muted/50 border-border"
                )}
              >
                {/* Live/Upcoming badge */}
                {event.isLive ? (
                  <Badge variant="destructive" className="gap-1 text-[10px]">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                    </span>
                    LIVE
                  </Badge>
                ) : event.startsIn ? (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Clock className="h-3 w-3" />
                    {event.startsIn}
                  </Badge>
                ) : null}

                {/* Event info */}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-foreground truncate max-w-[150px]">
                    {event.title}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Gamepad2 className="h-3 w-3" />
                    {event.game}
                  </span>
                </div>

                {/* Players */}
                {event.players && event.players.length > 0 && (
                  <div className="flex -space-x-2">
                    {event.players.slice(0, 2).map((player, i) => (
                      <Avatar key={i} className="h-6 w-6 border-2 border-background">
                        <AvatarImage src={player.avatar} />
                        <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                          {player.name[0]}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                )}

                {event.isLive && event.viewers > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    {formatViewers(event.viewers)}
                  </div>
                )}
              </Link>
            ))}

            {/* View all link */}
            <Link
              href={hasLiveContent ? "/live" : "/esports/tournaments"}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm text-primary hover:underline"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Activity ticker - only show if there's real activity */}
          {hasActivity && (
            <div className="relative h-8 w-full lg:w-64 overflow-hidden rounded-lg bg-muted/50 border border-border">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={currentActivityIndex}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-center px-3"
                >
                  <Link
                    href={data?.activityFeed[currentActivityIndex]?.link || "#"}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
                  >
                    {data?.activityFeed[currentActivityIndex]?.type === "clip_trending" && (
                      <Flame className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    )}
                    {data?.activityFeed[currentActivityIndex]?.type === "match_started" && (
                      <Play className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                    {data?.activityFeed[currentActivityIndex]?.type === "player_joined" && (
                      <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    )}
                    {data?.activityFeed[currentActivityIndex]?.type === "tournament_starting" && (
                      <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    )}
                    <span className="truncate">
                      {data?.activityFeed[currentActivityIndex]?.message}
                    </span>
                  </Link>
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
