"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, ExternalLink, Play } from "lucide-react"
import { cn } from "@/lib/utils"

interface StreamCardWithShareProps {
  id: string
  title: string
  platform: string
  isLive: boolean
  thumbnail?: string
  embed_url: string
  channel_url?: string
}

export function StreamCardWithShare({
  id,
  title,
  platform,
  isLive,
  thumbnail,
  embed_url,
  channel_url,
}: StreamCardWithShareProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${typeof window !== "undefined" ? window.location.origin : "https://majhevents.com"}/watch/stream/${id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Link href={`/watch/stream/${id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardContent className="p-0">
          {/* Thumbnail */}
          <div className="relative w-full aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group">
            {thumbnail ? (
              <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2">
                <Play className="h-8 w-8 text-primary/40" />
              </div>
            )}

            {/* Live Badge */}
            {isLive && (
              <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 bg-red-500 text-white rounded-full text-xs font-semibold">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
            )}

            {/* Platform Badge */}
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white rounded text-xs font-medium capitalize">
              {platform}
            </div>

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors flex items-center justify-center">
              <Play className="h-12 w-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-sm line-clamp-2 text-foreground">
                {title}
              </h3>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2 h-8"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Share</span>
                  </>
                )}
              </Button>
              {channel_url && (
                <a href={channel_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 h-8"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Open</span>
                  </Button>
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
