"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence, PanInfo } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { 
  Play, 
  Heart, 
  MessageCircle, 
  Share2, 
  Eye,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  Trophy,
  Gamepad2,
  MoreHorizontal,
  Bookmark,
  Flag,
  X,
  Loader2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getMediaFeed, addMediaReaction, trackMediaView, followPlayer, unfollowPlayer, checkIfFollowing, type PlayerMedia } from "@/lib/media-actions"

// Format view count
function formatViews(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

// Swipe physics constants (TikTok-level feel)
const SWIPE_THRESHOLD = 120        // Minimum distance for swipe
const VELOCITY_THRESHOLD = 500     // Minimum velocity for swipe
const FLICK_VELOCITY = 1200        // Fast flick = instant navigate
const RUBBER_BAND_ELASTIC = 0.2    // Resistance when dragging past bounds

// Single clip view in the swipe feed
function ClipView({ 
  clip, 
  isActive,
  isMuted,
  onToggleMute,
}: { 
  clip: PlayerMedia
  isActive: boolean
  isMuted: boolean
  onToggleMute: () => void
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(clip.like_count)
  const [isFollowing, setIsFollowing] = useState(false)
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false)
  const [viewTracked, setViewTracked] = useState(false)
  const lastTapRef = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Check if following on mount
  useEffect(() => {
    checkIfFollowing(clip.player_id).then(setIsFollowing)
  }, [clip.player_id])

  // Track view when active for 3+ seconds
  useEffect(() => {
    if (!isActive || viewTracked) return
    const timer = setTimeout(() => {
      trackMediaView(clip.id)
      setViewTracked(true)
    }, 3000)
    return () => clearTimeout(timer)
  }, [isActive, viewTracked, clip.id])

  // Auto-play when active
  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
      setIsPlaying(true)
    } else if (videoRef.current) {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }, [isActive])

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
    }
  }, [isMuted])

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play().catch(() => {})
      }
      setIsPlaying(!isPlaying)
    }
  }

  // Double-tap to like
  const handleTap = (e: React.MouseEvent) => {
    // Ignore taps on interactive elements
    if ((e.target as HTMLElement).closest('button, a, [role="button"]')) return
    
    const now = Date.now()
    const timeSinceLastTap = now - lastTapRef.current
    
    if (timeSinceLastTap < 300) {
      // Double tap - like with haptic feedback
      if (!isLiked) {
        setIsLiked(true)
        setLikeCount(prev => prev + 1)
        setShowDoubleTapHeart(true)
        // Haptic feedback burst for like
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([30, 50, 30])
        }
        addMediaReaction(clip.id, "like").catch(() => {
          setIsLiked(false)
          setLikeCount(prev => prev - 1)
        })
        setTimeout(() => setShowDoubleTapHeart(false), 1000)
      }
    } else {
      // Single tap - toggle play
      handleTogglePlay()
    }
    
    lastTapRef.current = now
  }

  // Follow/unfollow handler
  const handleFollow = async () => {
    if (isFollowing) {
      setIsFollowing(false)
      const result = await unfollowPlayer(clip.player_id)
      if (!result.success) setIsFollowing(true)
    } else {
      setIsFollowing(true)
      const result = await followPlayer(clip.player_id)
      if (!result.success) setIsFollowing(false)
    }
  }

  const handleLike = async () => {
    setIsLiked(!isLiked)
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1)
    try {
      await addMediaReaction(clip.id, "like")
    } catch {
      setIsLiked(isLiked)
      setLikeCount(likeCount)
    }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/media/${clip.id}`
    if (navigator.share) {
      await navigator.share({ title: clip.title, url })
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  return (
    <div 
      className="absolute inset-0 bg-black"
      onClick={handleTap}
    >
      {/* Video or Embed */}
      {clip.embed_url || clip.video_url ? (
        <div className="absolute inset-0">
          {clip.source_type === "youtube" && clip.embed_url ? (
            <iframe
              src={`${clip.embed_url}?autoplay=${isActive ? 1 : 0}&mute=${isMuted ? 1 : 0}&controls=0&modestbranding=1&rel=0&playsinline=1`}
              className="h-full w-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              src={clip.video_url || undefined}
              poster={clip.thumbnail_url || undefined}
              className="h-full w-full object-contain"
              loop
              playsInline
              muted={isMuted}
              preload="auto"
            />
          )}
        </div>
      ) : clip.thumbnail_url ? (
        <Image
          src={clip.thumbnail_url}
          alt={clip.title}
          fill
          className="object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Play className="h-16 w-16 text-white/50" />
        </div>
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

      {/* Play/Pause indicator */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="rounded-full bg-black/50 p-4 backdrop-blur-sm">
              <Play className="h-12 w-12 text-white fill-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double-tap heart animation */}
      <AnimatePresence>
        {showDoubleTapHeart && (
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <Heart className="h-32 w-32 text-red-500 fill-red-500" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right sidebar - Actions */}
      <div className="absolute right-3 bottom-32 z-10 flex flex-col items-center gap-5">
        {/* Player avatar with follow button */}
        <div className="relative">
          <Link 
            href={`/esports/players/${clip.player_id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar className="h-12 w-12 ring-2 ring-white shadow-lg">
              <AvatarImage src={clip.player?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {clip.player?.first_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
          </Link>
          <motion.button
            whileTap={{ scale: 0.9 }}
            className={cn(
              "absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full w-5 h-5 flex items-center justify-center shadow-lg",
              isFollowing ? "bg-green-500" : "bg-primary"
            )}
            onClick={(e) => {
              e.stopPropagation()
              handleFollow()
            }}
          >
            <span className="text-[10px] text-white font-bold">
              {isFollowing ? "✓" : "+"}
            </span>
          </motion.button>
        </div>

        {/* Like */}
        <motion.button 
          whileTap={{ scale: 0.9 }}
          className="flex flex-col items-center gap-1"
          onClick={(e) => {
            e.stopPropagation()
            handleLike()
          }}
        >
          <motion.div 
            animate={isLiked ? { scale: [1, 1.3, 1] } : {}}
            className={cn(
              "rounded-full p-2.5 backdrop-blur-sm transition-colors",
              isLiked ? "bg-red-500/30" : "bg-white/10"
            )}
          >
            <Heart className={cn(
              "h-7 w-7 transition-all",
              isLiked ? "text-red-500 fill-red-500" : "text-white"
            )} />
          </motion.div>
          <span className="text-xs text-white font-semibold drop-shadow-lg">
            {formatViews(likeCount)}
          </span>
        </motion.button>

        {/* Comments */}
        <Link 
          href={`/media/${clip.id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col items-center gap-1"
        >
          <div className="rounded-full bg-white/10 p-2.5 backdrop-blur-sm">
            <MessageCircle className="h-7 w-7 text-white" />
          </div>
          <span className="text-xs text-white font-semibold drop-shadow-lg">
            {clip.comment_count}
          </span>
        </Link>

        {/* Bookmark */}
        <motion.button 
          whileTap={{ scale: 0.9 }}
          className="flex flex-col items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-full bg-white/10 p-2.5 backdrop-blur-sm">
            <Bookmark className="h-7 w-7 text-white" />
          </div>
        </motion.button>

        {/* Share */}
        <motion.button 
          whileTap={{ scale: 0.9 }}
          className="flex flex-col items-center gap-1"
          onClick={(e) => {
            e.stopPropagation()
            handleShare()
          }}
        >
          <div className="rounded-full bg-white/10 p-2.5 backdrop-blur-sm">
            <Share2 className="h-7 w-7 text-white" />
          </div>
        </motion.button>

        {/* More */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="rounded-full bg-white/10 p-2.5 backdrop-blur-sm">
              <MoreHorizontal className="h-6 w-6 text-white" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-panel border-0">
            <DropdownMenuItem>
              <Flag className="mr-2 h-4 w-4" />
              Report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bottom info */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-4 pb-8">
        {/* Player name */}
        <Link 
          href={`/esports/players/${clip.player_id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-2 mb-2"
        >
          <span className="font-bold text-white drop-shadow-lg">
            @{clip.player?.first_name || "Player"}
          </span>
        </Link>

        {/* Title */}
        <p className="text-white text-sm line-clamp-2 mb-3 drop-shadow-lg">
          {clip.title}
        </p>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          {clip.game && (
            <Badge variant="secondary" className="bg-white/15 text-white border-0 gap-1 backdrop-blur-sm">
              <Gamepad2 className="h-3 w-3" />
              {clip.game.name}
            </Badge>
          )}
          {clip.tournament && (
            <Badge variant="secondary" className="bg-white/15 text-white border-0 gap-1 backdrop-blur-sm">
              <Trophy className="h-3 w-3" />
              {clip.tournament.name}
            </Badge>
          )}
          <Badge variant="secondary" className="bg-white/15 text-white border-0 gap-1 backdrop-blur-sm">
            <Eye className="h-3 w-3" />
            {formatViews(clip.view_count)}
          </Badge>
        </div>
      </div>
    </div>
  )
}

// Preload next video
function VideoPreloader({ clip }: { clip: PlayerMedia }) {
  if (!clip.video_url || clip.source_type === "youtube") return null
  return (
    <video 
      src={clip.video_url} 
      preload="auto" 
      className="hidden" 
      aria-hidden="true"
    />
  )
}

export default function ClipsFeedPage() {
  const [clips, setClips] = useState<PlayerMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  const [direction, setDirection] = useState(0)

  // Load initial clips
  useEffect(() => {
    loadClips()
  }, [])

  // Preload more when approaching end
  useEffect(() => {
    if (clips.length - currentIndex <= 3 && hasMore && !loading) {
      loadClips()
    }
  }, [currentIndex, clips.length, hasMore, loading])

  const loadClips = async () => {
    if (loading && clips.length > 0) return
    setLoading(true)
    try {
      const result = await getMediaFeed(
        cursor ?? undefined,
        10,
        "trending"
      )
      
      if (!result.nextCursor) {
        setHasMore(false)
      }
      
      setClips(prev => [...prev, ...result.media])
      setCursor(result.nextCursor)
    } catch (e) {
      console.error("Failed to load clips:", e)
    } finally {
      setLoading(false)
    }
  }

  // Navigate to next/prev clip with haptic feedback
  const paginate = useCallback((newDirection: number) => {
    const newIndex = currentIndex + newDirection
    if (newIndex >= 0 && newIndex < clips.length) {
      setDirection(newDirection)
      setCurrentIndex(newIndex)
      // Haptic feedback for native feel
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(10)
      }
    }
  }, [currentIndex, clips.length])

  // Handle drag end for swipe navigation with velocity-based physics
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info
    const absVelocity = Math.abs(velocity.y)
    
    // Fast flick = instant navigation (native feel)
    if (absVelocity > FLICK_VELOCITY) {
      if (velocity.y < 0 && currentIndex < clips.length - 1) {
        paginate(1)
      } else if (velocity.y > 0 && currentIndex > 0) {
        paginate(-1)
      }
      return
    }
    
    // Velocity-based swipe (primary navigation)
    if (velocity.y < -VELOCITY_THRESHOLD || offset.y < -SWIPE_THRESHOLD) {
      if (currentIndex < clips.length - 1) {
        paginate(1)
      }
    } else if (velocity.y > VELOCITY_THRESHOLD || offset.y > SWIPE_THRESHOLD) {
      if (currentIndex > 0) {
        paginate(-1)
      }
    }
    // Otherwise snap back (rubber band effect handles this via dragConstraints)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") {
        paginate(1)
      } else if (e.key === "ArrowUp" || e.key === "k") {
        paginate(-1)
      } else if (e.key === "m") {
        setIsMuted(prev => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [paginate])

  // Slide animation variants with spring physics
  const slideVariants = {
    enter: (direction: number) => ({
      y: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      y: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      y: direction > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.95,
    }),
  }

  // Spring transition for native feel
  const springTransition = {
    type: "spring",
    stiffness: 300,
    damping: 30,
  }

  const currentClip = clips[currentIndex]
  const nextClip = clips[currentIndex + 1]

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 safe-area-inset-top">
        <Link href="/media" className="text-white/80 hover:text-white">
          <X className="h-6 w-6" />
        </Link>
        <span className="esports-subheading text-white/80">For You</span>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/80 hover:text-white hover:bg-white/10"
          onClick={() => setIsMuted(prev => !prev)}
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>
      </div>

      {/* Main content area */}
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        {currentClip && (
          <motion.div
            key={currentClip.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              ...springTransition,
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 },
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={RUBBER_BAND_ELASTIC}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
          >
            <ClipView 
              clip={currentClip} 
              isActive={true}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(prev => !prev)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preload next video */}
      {nextClip && <VideoPreloader clip={nextClip} />}

      {/* Loading state */}
      {loading && clips.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {/* Empty state */}
      {!loading && clips.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <Play className="h-16 w-16 mb-4 text-white/30" />
          <p className="text-lg font-medium">No clips yet</p>
          <p className="text-sm text-white/60">Be the first to upload!</p>
          <Link href="/media">
            <Button className="mt-4">Browse Media</Button>
          </Link>
        </div>
      )}

      {/* Navigation indicators (desktop) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex-col gap-2 hidden md:flex">
        <Button
          variant="ghost"
          size="icon"
          className="text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30"
          onClick={() => paginate(-1)}
          disabled={currentIndex === 0}
        >
          <ChevronUp className="h-6 w-6" />
        </Button>
        <div className="text-center text-xs text-white/50 py-1">
          {currentIndex + 1}/{clips.length}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30"
          onClick={() => paginate(1)}
          disabled={currentIndex >= clips.length - 1}
        >
          <ChevronDown className="h-6 w-6" />
        </Button>
      </div>

      {/* Swipe hint (shows briefly on first load) */}
      <motion.div
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
      >
        <div className="flex flex-col items-center text-white/60 text-sm">
          <ChevronUp className="h-5 w-5 animate-bounce" />
          <span>Swipe for more</span>
        </div>
      </motion.div>
    </div>
  )
}
