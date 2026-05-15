"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Volume2,
  VolumeX,
  Play,
  Radio,
  Trophy,
  Film,
  ExternalLink,
} from "lucide-react"
import type { UnifiedFeedItem } from "@/lib/unified-feed-service"

interface FeedItemCardProps {
  item: UnifiedFeedItem
  isActive: boolean
  isMuted: boolean
  onToggleMute: () => void
  onLike: () => void
  onShare: () => void
  sessionId: string
}

function formatViews(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function FeedItemCard({
  item,
  isActive,
  isMuted,
  onToggleMute,
  onLike,
  onShare,
  sessionId,
}: FeedItemCardProps) {
  // Route to appropriate renderer based on type
  switch (item.type) {
    case "clip":
      return (
        <ClipRenderer
          item={item}
          isActive={isActive}
          isMuted={isMuted}
          onToggleMute={onToggleMute}
          onLike={onLike}
          onShare={onShare}
        />
      )
    case "live_match":
      return (
        <LiveMatchRenderer
          item={item}
          isActive={isActive}
          isMuted={isMuted}
          onToggleMute={onToggleMute}
        />
      )
    case "vod":
      return (
        <VodRenderer
          item={item}
          isActive={isActive}
          isMuted={isMuted}
          onToggleMute={onToggleMute}
        />
      )
    case "ad":
      return <AdRenderer item={item} sessionId={sessionId} />
    default:
      return null
  }
}

// ══════════════════════════════════════════
// CLIP RENDERER
// ══════════════════════════════════════════

function ClipRenderer({
  item,
  isActive,
  isMuted,
  onToggleMute,
  onLike,
  onShare,
}: {
  item: UnifiedFeedItem
  isActive: boolean
  isMuted: boolean
  onToggleMute: () => void
  onLike: () => void
  onShare: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [showHeart, setShowHeart] = useState(false)
  const lastTapRef = useRef(0)

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

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
    }
  }, [isMuted])

  const handleDoubleTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      setIsLiked(true)
      setShowHeart(true)
      onLike()
      setTimeout(() => setShowHeart(false), 1000)
      if (navigator.vibrate) navigator.vibrate(50)
    }
    lastTapRef.current = now
  }

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  return (
    <div className="relative h-full w-full bg-black" onClick={handleDoubleTap}>
      {/* Video */}
      <video
        ref={videoRef}
        src={item.media_url}
        poster={item.thumbnail_url}
        loop
        playsInline
        muted={isMuted}
        className="h-full w-full object-cover"
      />

      {/* Play/Pause overlay */}
      {!isPlaying && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/20"
          onClick={handleTogglePlay}
        >
          <Play className="h-16 w-16 text-white/80" />
        </div>
      )}

      {/* Double tap heart animation */}
      <AnimatedHeart show={showHeart} />

      {/* Content info */}
      <div className="absolute bottom-0 left-0 right-16 p-4 pb-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        {/* Creator info */}
        <Link href={`/players/${item.creator_id}`} className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10 border-2 border-white/20">
            <AvatarImage src={item.creator_avatar} />
            <AvatarFallback>{item.creator_name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-white">{item.creator_name}</p>
            {item.game_name && (
              <Badge variant="secondary" className="mt-1 bg-white/10 text-white/80 text-xs">
                {item.game_name}
              </Badge>
            )}
          </div>
        </Link>

        {/* Title & description */}
        <h3 className="text-white font-medium line-clamp-2">{item.title}</h3>
        {item.description && (
          <p className="text-white/70 text-sm mt-1 line-clamp-2">{item.description}</p>
        )}
        
        {/* Engagement & View Count */}
        <div className="flex items-center gap-3 mt-2 text-xs text-white/70">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {item.view_count || 0} views
          </span>
        </div>
      </div>

      {/* Action buttons (right side) */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
        <ActionButton
          icon={<Heart className={cn("h-7 w-7", isLiked && "fill-red-500 text-red-500")} />}
          count={item.like_count}
          onClick={() => {
            setIsLiked(!isLiked)
            onLike()
          }}
        />
        <ActionButton
          icon={<MessageCircle className="h-7 w-7" />}
          count={item.comment_count}
          onClick={() => {}}
        />
        <Link href={`/watch/clip/${item.id}`}>
          <ActionButton
            icon={<Share2 className="h-7 w-7" />}
            onClick={onShare}
          />
        </Link>
        <button onClick={onToggleMute} className="text-white">
          {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </button>
      </div>

      {/* Content type badge */}
      <div className="absolute top-4 left-4">
        <Badge className="bg-primary/90 text-primary-foreground">
          <Film className="h-3 w-3 mr-1" />
          Clip
        </Badge>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// LIVE MATCH RENDERER
// ══════════════════════════════════════════

function LiveMatchRenderer({
  item,
  isActive,
  isMuted,
  onToggleMute,
}: {
  item: UnifiedFeedItem
  isActive: boolean
  isMuted: boolean
  onToggleMute: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (isActive && videoRef.current && item.media_url) {
      videoRef.current.play().catch(() => {})
    } else if (videoRef.current) {
      videoRef.current.pause()
    }
  }, [isActive, item.media_url])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
    }
  }, [isMuted])

  return (
    <div className="relative h-full w-full bg-black">
      {/* Stream or thumbnail */}
      {item.media_url ? (
        <video
          ref={videoRef}
          src={item.media_url}
          poster={item.thumbnail_url}
          playsInline
          muted={isMuted}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="relative h-full w-full">
          {item.thumbnail_url && (
            <Image
              src={item.thumbnail_url}
              alt={item.title}
              fill
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <p className="text-white/80">Stream preview not available</p>
          </div>
        </div>
      )}

      {/* LIVE badge */}
      <div className="absolute top-4 left-4">
        <Badge className="bg-red-600 text-white animate-pulse">
          <Radio className="h-3 w-3 mr-1" />
          LIVE
        </Badge>
      </div>

      {/* Viewer count */}
      <div className="absolute top-4 right-4">
        <Badge variant="secondary" className="bg-black/60 text-white">
          <Eye className="h-3 w-3 mr-1" />
          {formatViews(item.view_count)} watching
        </Badge>
      </div>

      {/* Match info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-20 bg-gradient-to-t from-black via-black/80 to-transparent">
        {/* Tournament badge */}
        {item.tournament_name && (
          <Badge className="mb-3 bg-primary/80">
            <Trophy className="h-3 w-3 mr-1" />
            {item.tournament_name}
          </Badge>
        )}

        {/* Match title */}
        <h2 className="text-2xl font-bold text-white mb-2">{item.title}</h2>
        <p className="text-white/70">{item.description}</p>

        {/* Game info */}
        <div className="flex items-center gap-2 mt-3">
          {item.game_logo && (
            <Image src={item.game_logo} alt={item.game_name || ""} width={24} height={24} className="rounded" />
          )}
          <span className="text-white/80 text-sm">{item.game_name}</span>
        </div>

        {/* Watch button */}
        <Link href={`/live/${item.id}`}>
          <Button className="mt-4 w-full bg-red-600 hover:bg-red-700">
            Watch Live
          </Button>
        </Link>
      </div>

      {/* Mute toggle */}
      <button 
        onClick={onToggleMute} 
        className="absolute right-4 bottom-24 text-white p-2"
      >
        {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════
// VOD RENDERER
// ══════════════════════════════════════════

function VodRenderer({
  item,
  isActive,
  isMuted,
  onToggleMute,
}: {
  item: UnifiedFeedItem
  isActive: boolean
  isMuted: boolean
  onToggleMute: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.play().catch(() => {})
      setIsPlaying(true)
    } else if (videoRef.current) {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }, [isActive])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
    }
  }, [isMuted])

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        src={item.media_url}
        poster={item.thumbnail_url}
        playsInline
        muted={isMuted}
        className="h-full w-full object-cover"
      />

      {/* VOD badge */}
      <div className="absolute top-4 left-4">
        <Badge variant="secondary" className="bg-purple-600/90 text-white">
          <Film className="h-3 w-3 mr-1" />
          VOD
        </Badge>
      </div>

      {/* Duration */}
      {item.duration_seconds && (
        <div className="absolute top-4 right-4">
          <Badge variant="secondary" className="bg-black/60 text-white">
            {formatDuration(item.duration_seconds)}
          </Badge>
        </div>
      )}

      {/* Info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-20 bg-gradient-to-t from-black via-black/80 to-transparent">
        {item.tournament_name && (
          <Badge className="mb-3 bg-purple-600/80">
            <Trophy className="h-3 w-3 mr-1" />
            {item.tournament_name}
          </Badge>
        )}

        <h2 className="text-xl font-bold text-white mb-2">{item.title}</h2>
        {item.description && (
          <p className="text-white/70 line-clamp-2">{item.description}</p>
        )}

        <div className="flex items-center gap-4 mt-3 text-white/60 text-sm">
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {formatViews(item.view_count)} views
          </span>
          {item.game_name && <span>{item.game_name}</span>}
        </div>
      </div>

      {/* Mute toggle */}
      <button 
        onClick={onToggleMute} 
        className="absolute right-4 bottom-24 text-white p-2"
      >
        {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════
// AD RENDERER
// ══════════════════════════════════════════

function AdRenderer({
  item,
  sessionId,
}: {
  item: UnifiedFeedItem
  sessionId: string
}) {
  const [impressionTracked, setImpressionTracked] = useState(false)

  useEffect(() => {
    // Track impression after 1 second
    if (!impressionTracked) {
      const timer = setTimeout(() => {
        fetch("/api/feed/unified", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemType: "ad",
            itemId: item.id,
            action: "view",
            sessionId,
          }),
        })
        setImpressionTracked(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [impressionTracked, item.id, sessionId])

  const handleClick = () => {
    // Track click
    fetch("/api/feed/unified", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType: "ad",
        itemId: item.id,
        action: "click",
        sessionId,
      }),
    })

    // Open ad URL
    if (item.ad_data?.click_url) {
      window.open(item.ad_data.click_url, "_blank")
    }
  }

  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center">
      {/* Ad media */}
      {item.media_url ? (
        <video
          src={item.media_url}
          poster={item.thumbnail_url}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : item.thumbnail_url ? (
        <Image
          src={item.thumbnail_url}
          alt={item.title}
          fill
          className="object-cover"
        />
      ) : (
        <div className="bg-muted h-full w-full" />
      )}

      {/* Sponsored badge */}
      <div className="absolute top-4 left-4">
        <Badge variant="outline" className="bg-black/60 text-white/80 border-white/20">
          Sponsored
        </Badge>
      </div>

      {/* Ad content overlay */}
      <div 
        className="absolute bottom-0 left-0 right-0 p-4 pb-20 bg-gradient-to-t from-black via-black/80 to-transparent cursor-pointer"
        onClick={handleClick}
      >
        {item.ad_data?.headline && (
          <h2 className="text-xl font-bold text-white mb-2">{item.ad_data.headline}</h2>
        )}
        {item.ad_data?.primary_text && (
          <p className="text-white/80 line-clamp-2">{item.ad_data.primary_text}</p>
        )}
        
        {item.ad_data?.call_to_action && (
          <Button className="mt-4 gap-2" onClick={handleClick}>
            {item.ad_data.call_to_action}
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// SHARED COMPONENTS
// ══════════════════════════════════════════

function ActionButton({
  icon,
  count,
  onClick,
}: {
  icon: React.ReactNode
  count?: number
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 text-white">
      {icon}
      {count !== undefined && (
        <span className="text-xs font-medium">{formatViews(count)}</span>
      )}
    </button>
  )
}

function AnimatedHeart({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.5, opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <Heart className="h-24 w-24 text-red-500 fill-red-500" />
    </motion.div>
  )
}
