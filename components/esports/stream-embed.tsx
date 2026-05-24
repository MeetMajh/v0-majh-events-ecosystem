"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Play, Maximize2, Volume2, VolumeX, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface StreamEmbedProps {
  embedUrl: string
  streamUrl?: string
  platform?: "youtube" | "twitch" | "kick" | "custom"
  title?: string
  autoplay?: boolean
  className?: string
  aspectRatio?: "video" | "square" | "portrait"
}

// Generate embed URL from stream URL
export function getEmbedUrl(streamUrl: string, platform: string): string {
  if (platform === "youtube") {
    // YouTube: extract video ID
    const videoIdMatch = streamUrl.match(/(?:youtube\.com\/(?:watch\?v=|live\/)|youtu\.be\/)([^&?/]+)/)
    if (videoIdMatch) {
      return `https://www.youtube.com/embed/${videoIdMatch[1]}?autoplay=1&mute=1`
    }
  }
  
  if (platform === "twitch") {
    // Twitch: extract channel name
    const channelMatch = streamUrl.match(/twitch\.tv\/([^/?]+)/)
    if (channelMatch) {
      // For Twitch, parent domain is required
      const parent = typeof window !== "undefined" ? window.location.hostname : "localhost"
      return `https://player.twitch.tv/?channel=${channelMatch[1]}&parent=${parent}&autoplay=true&muted=true`
    }
  }
  
  if (platform === "kick") {
    // Kick: extract channel name
    const channelMatch = streamUrl.match(/kick\.com\/([^/?]+)/)
    if (channelMatch) {
      return `https://player.kick.com/${channelMatch[1]}`
    }
  }
  
  // Custom or fallback
  return streamUrl
}

export function StreamEmbed({
  embedUrl,
  streamUrl,
  platform = "custom",
  title = "Live Stream",
  autoplay = true,
  className,
  aspectRatio = "video",
}: StreamEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [showOverlay, setShowOverlay] = useState(true)

  // Aspect ratio classes
  const aspectClasses = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[9/16]",
  }

  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-black", aspectClasses[aspectRatio], className)}>
      {/* Loading state */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading stream...</span>
          </div>
        </div>
      )}

      {/* Stream iframe */}
      <iframe
        src={embedUrl}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        onLoad={() => setIsLoaded(true)}
      />

      {/* Overlay controls (for click-to-unmute on first load) */}
      {showOverlay && isLoaded && (
        <button
          className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity hover:bg-black/30"
          onClick={() => setShowOverlay(false)}
        >
          <div className="flex flex-col items-center gap-2 text-white">
            <Play className="h-12 w-12" />
            <span className="text-sm font-medium">Click to watch</span>
          </div>
        </button>
      )}

      {/* Stream controls overlay */}
      {isLoaded && !showOverlay && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-opacity hover:opacity-100">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
            {platform !== "custom" && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs capitalize text-white">
                {platform}
              </span>
            )}
          </div>
          {streamUrl && (
            <a
              href={streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// Compact stream preview for lists
export function StreamPreview({
  embedUrl,
  platform,
  isLive = true,
  viewerCount,
  className,
}: {
  embedUrl: string
  platform?: string
  isLive?: boolean
  viewerCount?: number
  className?: string
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-black aspect-video", className)}>
      <iframe
        src={embedUrl}
        title="Stream preview"
        className="absolute inset-0 h-full w-full pointer-events-none"
        allow="autoplay"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        {isLive && (
          <span className="flex items-center gap-1 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            LIVE
          </span>
        )}
        {viewerCount !== undefined && viewerCount > 0 && (
          <span className="rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
            {viewerCount.toLocaleString()} viewers
          </span>
        )}
      </div>
    </div>
  )
}
