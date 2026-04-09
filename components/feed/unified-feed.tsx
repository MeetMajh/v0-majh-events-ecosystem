"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence, PanInfo } from "framer-motion"
import useSWRInfinite from "swr/infinite"
import { cn } from "@/lib/utils"
import { FeedItemCard } from "./feed-item-card"
import { Loader2 } from "lucide-react"
import type { UnifiedFeedItem } from "@/lib/unified-feed-service"

// Swipe physics constants
const SWIPE_THRESHOLD = 100
const VELOCITY_THRESHOLD = 400

interface UnifiedFeedProps {
  feedType?: "foryou" | "following" | "trending"
  gameFilter?: string
  isMuted?: boolean
  onToggleMute?: () => void
  className?: string
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function UnifiedFeed({ 
  feedType = "foryou",
  gameFilter, 
  isMuted: externalMuted,
  onToggleMute,
  className 
}: UnifiedFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionId] = useState(() => `fs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`)
  const [internalMuted, setInternalMuted] = useState(true)
  
  // Use external mute state if provided, otherwise internal
  const isMuted = externalMuted !== undefined ? externalMuted : internalMuted
  const toggleMute = onToggleMute || (() => setInternalMuted(prev => !prev))
  const [dragDirection, setDragDirection] = useState<"up" | "down" | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewStartTimeRef = useRef<number>(Date.now())

  // Infinite loading with SWR
  const getKey = (pageIndex: number, previousPageData: any) => {
    if (previousPageData && !previousPageData.hasMore) return null
    const params = new URLSearchParams({
      limit: "10",
      offset: String(pageIndex * 10),
      sessionId,
      type: feedType,
      ...(gameFilter && { game: gameFilter }),
    })
    return `/api/feed/unified?${params}`
  }

  const { data, size, setSize, isLoading, isValidating } = useSWRInfinite(getKey, fetcher, {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
  })

  // Flatten all pages into single feed
  const feed: UnifiedFeedItem[] = data ? data.flatMap(page => page.items || []) : []
  const hasMore = data ? data[data.length - 1]?.hasMore : true

  // Track view when item becomes active
  useEffect(() => {
    viewStartTimeRef.current = Date.now()
    
    // Track view after 3 seconds
    const timer = setTimeout(() => {
      if (feed[currentIndex]) {
        trackInteraction("view", feed[currentIndex])
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [currentIndex, feed])

  // Load more when near end
  useEffect(() => {
    if (currentIndex >= feed.length - 3 && hasMore && !isValidating) {
      setSize(size + 1)
    }
  }, [currentIndex, feed.length, hasMore, isValidating, setSize, size])

  const trackInteraction = useCallback(async (action: string, item: UnifiedFeedItem) => {
    const watchDuration = Math.floor((Date.now() - viewStartTimeRef.current) / 1000)
    const watchPercentage = item.duration_seconds 
      ? Math.min(100, (watchDuration / item.duration_seconds) * 100)
      : undefined

    await fetch("/api/feed/unified", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType: item.type,
        itemId: item.id,
        action,
        sessionId,
        watchDurationSeconds: watchDuration,
        watchPercentage,
        positionInFeed: currentIndex,
      }),
    })
  }, [sessionId, currentIndex])

  const goToNext = useCallback(() => {
    if (currentIndex < feed.length - 1) {
      // Track skip if watch time < 3 seconds
      const watchDuration = (Date.now() - viewStartTimeRef.current) / 1000
      if (watchDuration < 3 && feed[currentIndex]) {
        trackInteraction("skip", feed[currentIndex])
      }
      setCurrentIndex(prev => prev + 1)
    }
  }, [currentIndex, feed, trackInteraction])

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }, [currentIndex])

  const handleDragEnd = (e: any, info: PanInfo) => {
    const { velocity, offset } = info

    if (velocity.y < -VELOCITY_THRESHOLD || offset.y < -SWIPE_THRESHOLD) {
      goToNext()
    } else if (velocity.y > VELOCITY_THRESHOLD || offset.y > SWIPE_THRESHOLD) {
      goToPrev()
    }

    setDragDirection(null)
  }

  const handleDrag = (e: any, info: PanInfo) => {
    if (info.offset.y < -20) {
      setDragDirection("up")
    } else if (info.offset.y > 20) {
      setDragDirection("down")
    } else {
      setDragDirection(null)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") {
        goToNext()
      } else if (e.key === "ArrowUp" || e.key === "k") {
        goToPrev()
      } else if (e.key === "m") {
        toggleMute()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [goToNext, goToPrev])

  if (isLoading && feed.length === 0) {
    return (
      <div className={cn("flex h-screen items-center justify-center bg-background", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (feed.length === 0) {
    return (
      <div className={cn("flex h-screen items-center justify-center bg-background", className)}>
        <p className="text-muted-foreground">No content available</p>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={cn("relative h-screen w-full overflow-hidden bg-black", className)}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={currentIndex}
          initial={{ y: dragDirection === "up" ? "100%" : "-100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: dragDirection === "up" ? "-100%" : "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          className="absolute inset-0"
        >
          <FeedItemCard
            item={feed[currentIndex]}
            isActive={true}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            onLike={() => trackInteraction("like", feed[currentIndex])}
            onShare={() => trackInteraction("share", feed[currentIndex])}
            sessionId={sessionId}
          />
        </motion.div>
      </AnimatePresence>

      {/* Navigation indicators */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
        {feed.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((_, idx) => {
          const actualIdx = Math.max(0, currentIndex - 2) + idx
          return (
            <div
              key={actualIdx}
              className={cn(
                "h-1 w-1 rounded-full transition-all",
                actualIdx === currentIndex 
                  ? "h-4 bg-white" 
                  : "bg-white/40"
              )}
            />
          )
        })}
      </div>

      {/* Loading indicator */}
      {isValidating && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
          <Loader2 className="h-5 w-5 animate-spin text-white/60" />
        </div>
      )}
    </div>
  )
}
