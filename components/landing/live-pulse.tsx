"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
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
} from "lucide-react"

interface LiveEvent {
  id: string
  type: "match" | "stream" | "tournament"
  title: string
  game: string
  viewers: number
  thumbnail?: string
  players?: { name: string; avatar?: string }[]
  startsIn?: string
  isLive: boolean
}

interface ActivityItem {
  id: string
  type: "clip_trending" | "match_started" | "player_joined" | "tournament_starting"
  message: string
  timestamp: Date
  link?: string
}

// Simulated real-time data (in production, use Supabase realtime)
function useLivePulseData() {
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([
    {
      id: "1",
      type: "match",
      title: "Grand Finals - Modern",
      game: "Magic: The Gathering",
      viewers: 234,
      isLive: true,
      players: [
        { name: "ProPlayer1", avatar: undefined },
        { name: "ChampMTG", avatar: undefined },
      ],
    },
    {
      id: "2",
      type: "tournament",
      title: "Weekly Pokemon League",
      game: "Pokemon TCG",
      viewers: 0,
      startsIn: "15 min",
      isLive: false,
    },
  ])

  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([
    {
      id: "a1",
      type: "clip_trending",
      message: "\"Top Deck Wins Finals\" is trending",
      timestamp: new Date(),
      link: "/clips",
    },
    {
      id: "a2",
      type: "match_started",
      message: "Grand Finals just started",
      timestamp: new Date(Date.now() - 60000),
      link: "/live",
    },
    {
      id: "a3",
      type: "player_joined",
      message: "12 players joined today's tournament",
      timestamp: new Date(Date.now() - 120000),
      link: "/esports/tournaments",
    },
  ])

  const [currentActivityIndex, setCurrentActivityIndex] = useState(0)

  // Rotate through activity items
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentActivityIndex(prev => (prev + 1) % activityFeed.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [activityFeed.length])

  // Simulate viewer count changes
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveEvents(prev => prev.map(event => ({
        ...event,
        viewers: event.isLive 
          ? event.viewers + Math.floor(Math.random() * 10) - 3
          : event.viewers,
      })))
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return {
    liveEvents,
    activityFeed,
    currentActivityIndex,
    totalViewers: liveEvents.reduce((sum, e) => sum + e.viewers, 0),
    liveCount: liveEvents.filter(e => e.isLive).length,
  }
}

function formatViewers(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

export function LivePulse() {
  const { liveEvents, activityFeed, currentActivityIndex, totalViewers, liveCount } = useLivePulseData()

  return (
    <section className="border-b border-border bg-gradient-to-r from-primary/5 via-background to-primary/5">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Live indicator + stats */}
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
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{formatViewers(totalViewers)} watching</span>
              </div>
              <div className="flex items-center gap-1">
                <Flame className="h-4 w-4 text-orange-500" />
                <span>{liveCount} live events</span>
              </div>
            </div>
          </div>

          {/* Live events carousel */}
          <div className="flex-1 flex items-center gap-3 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            {liveEvents.map((event) => (
              <Link
                key={event.id}
                href={event.isLive ? `/live?match=${event.id}` : `/esports/tournaments`}
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
                ) : (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Clock className="h-3 w-3" />
                    {event.startsIn}
                  </Badge>
                )}

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

                {/* Players or viewers */}
                {event.players ? (
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
                ) : null}

                {event.isLive && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    {formatViewers(event.viewers)}
                  </div>
                )}
              </Link>
            ))}

            {/* View all link */}
            <Link
              href="/live"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm text-primary hover:underline"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Activity ticker */}
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
                  href={activityFeed[currentActivityIndex]?.link || "#"}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  {activityFeed[currentActivityIndex]?.type === "clip_trending" && (
                    <Flame className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  )}
                  {activityFeed[currentActivityIndex]?.type === "match_started" && (
                    <Play className="h-4 w-4 text-green-500 flex-shrink-0" />
                  )}
                  {activityFeed[currentActivityIndex]?.type === "player_joined" && (
                    <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  )}
                  {activityFeed[currentActivityIndex]?.type === "tournament_starting" && (
                    <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  )}
                  <span className="truncate">
                    {activityFeed[currentActivityIndex]?.message}
                  </span>
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
