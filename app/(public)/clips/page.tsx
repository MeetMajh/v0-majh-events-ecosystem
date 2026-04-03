"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useInView } from "react-intersection-observer"
import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { 
  Play, 
  Pause,
  Heart, 
  MessageCircle, 
  Share2, 
  Flame,
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

// Single clip card in the vertical feed
function ClipCard({ 
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
  const { ref: inViewRef, inView } = useInView({ threshold: 0.7 })

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

  // Auto-play when in view
  useEffect(() => {
    if (inView && isActive && videoRef.current) {
      videoRef.current.play().catch(() => {})
      setIsPlaying(true)
    } else if (videoRef.current) {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }, [inView, isActive])

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
  const handleTap = () => {
    const now = Date.now()
    const timeSinceLastTap = now - lastTapRef.current
    
    if (timeSinceLastTap < 300) {
      // Double tap - like
      if (!isLiked) {
        setIsLiked(true)
        setLikeCount(prev => prev + 1)
        setShowDoubleTapHeart(true)
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
      // Revert on error
      setIsLiked(isLiked)
      setLikeCount(likeCount)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: clip.title,
        url: `${window.location.origin}/media/${clip.id}`,
      })
    } else {
      await navigator.clipboard.writeText(`${window.location.origin}/media/${clip.id}`)
    }
  }

  return (
    <div 
      ref={inViewRef}
      className="relative h-[100dvh] w-full snap-start snap-always bg-black"
      onClick={handleTap}
    >
      {/* Video or Thumbnail */}
      {clip.embed_url || clip.video_url ? (
        <div className="absolute inset-0">
          {clip.source_type === "youtube" && clip.embed_url ? (
            <iframe
              src={`${clip.embed_url}?autoplay=${isActive && inView ? 1 : 0}&mute=${isMuted ? 1 : 0}&controls=0&modestbranding=1&rel=0`}
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
            />
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {clip.thumbnail_url ? (
            <Image
              src={clip.thumbnail_url}
              alt={clip.title}
              fill
              className="object-contain"
            />
          ) : (
            <Play className="h-16 w-16 text-white/50" />
          )}
        </div>
      )}

      {/* Gradient overlays */}
      <div className="video-overlay pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 safe-area-inset-top">
        <Link href="/media" className="text-white/80 hover:text-white">
          <ChevronUp className="h-6 w-6 rotate-[-90deg]" />
        </Link>
        <span className="esports-subheading text-white/80">Clips</span>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/80 hover:text-white hover:bg-white/10"
          onClick={(e) => {
            e.stopPropagation()
            onToggleMute()
          }}
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>
      </div>

      {/* Play/Pause indicator */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-full bg-black/50 p-4">
            <Play className="h-12 w-12 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Double-tap heart animation */}
      {showDoubleTapHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <Heart className="h-32 w-32 text-red-500 fill-red-500 animate-ping" />
        </div>
      )}

      {/* Right sidebar - Actions */}
      <div className="absolute right-3 bottom-32 z-10 flex flex-col items-center gap-5">
        {/* Player avatar with follow button */}
        <div className="relative">
          <Link 
            href={`/esports/players/${clip.player_id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar className="h-12 w-12 ring-2 ring-white">
              <AvatarImage src={clip.player?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {clip.player?.first_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
          </Link>
          {!isFollowing ? (
            <button
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary p-0.5 w-5 h-5 flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation()
                handleFollow()
              }}
            >
              <span className="text-[10px] text-white font-bold">+</span>
            </button>
          ) : (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-green-500 p-0.5 w-5 h-5 flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">✓</span>
            </div>
          )}
        </div>

        {/* Like */}
        <button 
          className="flex flex-col items-center gap-1"
          onClick={(e) => {
            e.stopPropagation()
            handleLike()
          }}
        >
          <div className={cn(
            "rounded-full p-2 transition-colors",
            isLiked ? "bg-red-500/20" : "bg-white/10"
          )}>
            <Heart className={cn(
              "h-7 w-7 transition-all",
              isLiked ? "text-red-500 fill-red-500 scale-110" : "text-white"
            )} />
          </div>
          <span className="text-xs text-white font-medium">{formatViews(likeCount)}</span>
        </button>

        {/* Comments */}
        <Link 
          href={`/media/${clip.id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col items-center gap-1"
        >
          <div className="rounded-full bg-white/10 p-2">
            <MessageCircle className="h-7 w-7 text-white" />
          </div>
          <span className="text-xs text-white font-medium">{clip.comment_count}</span>
        </Link>

        {/* Bookmark */}
        <button 
          className="flex flex-col items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-full bg-white/10 p-2">
            <Bookmark className="h-7 w-7 text-white" />
          </div>
        </button>

        {/* Share */}
        <button 
          className="flex flex-col items-center gap-1"
          onClick={(e) => {
            e.stopPropagation()
            handleShare()
          }}
        >
          <div className="rounded-full bg-white/10 p-2">
            <Share2 className="h-7 w-7 text-white" />
          </div>
        </button>

        {/* More */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="rounded-full bg-white/10 p-2">
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
      <div className="absolute inset-x-0 bottom-0 z-10 p-4 pb-8 safe-area-inset-bottom">
        {/* Player name */}
        <Link 
          href={`/esports/players/${clip.player_id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-2 mb-2"
        >
          <span className="font-semibold text-white">
            @{clip.player?.first_name || "Player"}
          </span>
        </Link>

        {/* Title */}
        <p className="text-white text-sm line-clamp-2 mb-2">
          {clip.title}
        </p>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          {clip.game && (
            <Badge variant="secondary" className="bg-white/10 text-white border-0 gap-1">
              <Gamepad2 className="h-3 w-3" />
              {clip.game.name}
            </Badge>
          )}
          {clip.tournament && (
            <Badge variant="secondary" className="bg-white/10 text-white border-0 gap-1">
              <Trophy className="h-3 w-3" />
              {clip.tournament.name}
            </Badge>
          )}
          <Badge variant="secondary" className="bg-white/10 text-white border-0 gap-1">
            <Eye className="h-3 w-3" />
            {formatViews(clip.view_count)}
          </Badge>
        </div>
      </div>
    </div>
  )
}

export default function ClipsFeedPage() {
  const [clips, setClips] = useState<PlayerMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView()

  // Load initial clips
  useEffect(() => {
    loadClips()
  }, [])

  // Load more when reaching end
  useEffect(() => {
    if (loadMoreInView && hasMore && !loading) {
      loadClips()
    }
  }, [loadMoreInView, hasMore, loading])

  const loadClips = async () => {
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

  // Handle scroll to detect active clip
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const scrollTop = containerRef.current.scrollTop
    const height = window.innerHeight
    const newIndex = Math.round(scrollTop / height)
    if (newIndex !== activeIndex) {
      setActiveIndex(newIndex)
    }
  }, [activeIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return
      const height = window.innerHeight
      
      if (e.key === "ArrowDown" || e.key === "j") {
        containerRef.current.scrollTo({
          top: (activeIndex + 1) * height,
          behavior: "smooth"
        })
      } else if (e.key === "ArrowUp" || e.key === "k") {
        containerRef.current.scrollTo({
          top: Math.max(0, (activeIndex - 1) * height),
          behavior: "smooth"
        })
      } else if (e.key === "m") {
        setIsMuted(prev => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeIndex])

  return (
    <div 
      ref={containerRef}
      className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-black"
      onScroll={handleScroll}
    >
      {clips.map((clip, index) => (
        <ClipCard 
          key={clip.id} 
          clip={clip} 
          isActive={index === activeIndex}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(prev => !prev)}
        />
      ))}
      
      {/* Load more trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
          {loading && (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && clips.length === 0 && (
        <div className="h-[100dvh] flex flex-col items-center justify-center text-white">
          <Play className="h-16 w-16 mb-4 text-white/30" />
          <p className="text-lg font-medium">No clips yet</p>
          <p className="text-sm text-white/60">Be the first to upload!</p>
          <Link href="/media">
            <Button className="mt-4">Browse Media</Button>
          </Link>
        </div>
      )}

      {/* Navigation hints */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-20 flex-col gap-2 hidden md:flex">
        <Button
          variant="ghost"
          size="icon"
          className="text-white/50 hover:text-white hover:bg-white/10"
          onClick={() => {
            if (containerRef.current) {
              containerRef.current.scrollTo({
                top: Math.max(0, (activeIndex - 1) * window.innerHeight),
                behavior: "smooth"
              })
            }
          }}
          disabled={activeIndex === 0}
        >
          <ChevronUp className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/50 hover:text-white hover:bg-white/10"
          onClick={() => {
            if (containerRef.current) {
              containerRef.current.scrollTo({
                top: (activeIndex + 1) * window.innerHeight,
                behavior: "smooth"
              })
            }
          }}
          disabled={activeIndex >= clips.length - 1}
        >
          <ChevronDown className="h-6 w-6" />
        </Button>
      </div>
    </div>
  )
}
