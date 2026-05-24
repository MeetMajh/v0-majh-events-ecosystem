"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { UnifiedFeed } from "@/components/feed/unified-feed"
import { 
  X, 
  Volume2, 
  VolumeX,
  Flame,
  Users,
  Sparkles,
  Filter,
  Gamepad2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"

type FeedType = "foryou" | "following" | "trending"

const FEED_TABS: { type: FeedType; label: string; icon: React.ReactNode }[] = [
  { type: "foryou", label: "For You", icon: <Sparkles className="h-4 w-4" /> },
  { type: "following", label: "Following", icon: <Users className="h-4 w-4" /> },
  { type: "trending", label: "Trending", icon: <Flame className="h-4 w-4" /> },
]

const GAMES = [
  { id: "all", name: "All Games" },
  { id: "mtg", name: "Magic: The Gathering" },
  { id: "pokemon", name: "Pokemon TCG" },
  { id: "yugioh", name: "Yu-Gi-Oh!" },
  { id: "lorcana", name: "Lorcana" },
  { id: "flesh-and-blood", name: "Flesh and Blood" },
  { id: "one-piece", name: "One Piece TCG" },
]

export default function ClipsFeedPage() {
  const [feedType, setFeedType] = useState<FeedType>("foryou")
  const [gameFilter, setGameFilter] = useState<string | undefined>(undefined)
  const [isMuted, setIsMuted] = useState(true)

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-30 safe-area-inset-top">
        {/* Gradient overlay for better visibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        
        <div className="relative flex items-center justify-between p-4">
          {/* Left: Close */}
          <Link href="/" className="text-white/80 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </Link>

          {/* Center: Feed type tabs */}
          <div className="flex items-center gap-1 bg-white/10 rounded-full p-1 backdrop-blur-sm">
            {FEED_TABS.map((tab) => (
              <button
                key={tab.type}
                onClick={() => setFeedType(tab.type)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5",
                  feedType === tab.type
                    ? "bg-white text-black"
                    : "text-white/70 hover:text-white"
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {/* Game filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "text-white/80 hover:text-white hover:bg-white/10",
                    gameFilter && "text-primary"
                  )}
                >
                  <Gamepad2 className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by Game</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {GAMES.map((game) => (
                  <DropdownMenuItem
                    key={game.id}
                    onClick={() => setGameFilter(game.id === "all" ? undefined : game.id)}
                    className={cn(
                      gameFilter === game.id && "bg-primary/10 text-primary"
                    )}
                  >
                    {game.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mute toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => setIsMuted(prev => !prev)}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Unified Feed */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${feedType}-${gameFilter}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          <UnifiedFeed 
            feedType={feedType}
            gameFilter={gameFilter}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(prev => !prev)}
          />
        </motion.div>
      </AnimatePresence>

      {/* Game filter indicator */}
      <AnimatePresence>
        {gameFilter && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20"
          >
            <button
              onClick={() => setGameFilter(undefined)}
              className="flex items-center gap-2 px-4 py-2 bg-primary/90 text-primary-foreground rounded-full text-sm font-medium backdrop-blur-sm"
            >
              <Gamepad2 className="h-4 w-4" />
              {GAMES.find(g => g.id === gameFilter)?.name}
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
