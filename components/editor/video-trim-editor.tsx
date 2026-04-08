"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import {
  Scissors,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface VideoTrimEditorProps {
  videoUrl: string
  duration: number
  onTrimComplete: (start: number, end: number) => void
  onCancel: () => void
  initialStart?: number
  initialEnd?: number
}

export function VideoTrimEditor({
  videoUrl,
  duration,
  onTrimComplete,
  onCancel,
  initialStart = 0,
  initialEnd,
}: VideoTrimEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [trimStart, setTrimStart] = useState(initialStart)
  const [trimEnd, setTrimEnd] = useState(initialEnd ?? duration)
  const [isDragging, setIsDragging] = useState<"start" | "end" | null>(null)

  // Format time as mm:ss.s
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(1)
    return `${mins}:${secs.padStart(4, "0")}`
  }

  // Update current time on video timeupdate
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      // Loop within trim range during playback
      if (isPlaying && video.currentTime >= trimEnd) {
        video.currentTime = trimStart
      }
    }

    video.addEventListener("timeupdate", handleTimeUpdate)
    return () => video.removeEventListener("timeupdate", handleTimeUpdate)
  }, [isPlaying, trimStart, trimEnd])

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      // Start from trim start if outside range
      if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
        video.currentTime = trimStart
      }
      video.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, trimStart, trimEnd])

  // Seek to position
  const seekTo = (time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(duration, time))
    setCurrentTime(video.currentTime)
  }

  // Handle trim handle drag
  const handleTrimChange = (value: number[], handle: "start" | "end") => {
    if (handle === "start") {
      const newStart = Math.min(value[0], trimEnd - 0.5)
      setTrimStart(newStart)
      if (currentTime < newStart) {
        seekTo(newStart)
      }
    } else {
      const newEnd = Math.max(value[0], trimStart + 0.5)
      setTrimEnd(newEnd)
      if (currentTime > newEnd) {
        seekTo(newEnd)
      }
    }

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(5)
    }
  }

  // Calculate trim duration
  const trimDuration = trimEnd - trimStart

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-primary" />
          <span className="font-medium">Trim Video</span>
        </div>
        <Button
          size="sm"
          onClick={() => onTrimComplete(trimStart, trimEnd)}
          className="gap-1"
        >
          <Check className="h-4 w-4" />
          Done
        </Button>
      </div>

      {/* Video Preview */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg aspect-[9/16] bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlay}
          />

          {/* Play/Pause overlay */}
          {!isPlaying && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
              onClick={togglePlay}
            >
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Play className="h-8 w-8 text-white fill-white ml-1" />
              </div>
            </div>
          )}

          {/* Time indicator */}
          <div className="absolute top-4 left-4 px-2 py-1 rounded bg-black/60 text-white text-sm font-mono">
            {formatTime(currentTime)}
          </div>
        </div>
      </div>

      {/* Trim Controls */}
      <div className="p-4 space-y-4 glass-panel-darker border-t border-border/30">
        {/* Trim info */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Trim:</span>
            <span className="font-mono">{formatTime(trimStart)}</span>
            <span className="text-muted-foreground">to</span>
            <span className="font-mono">{formatTime(trimEnd)}</span>
          </div>
          <div className="text-muted-foreground">
            Duration: <span className="font-mono text-foreground">{formatTime(trimDuration)}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative h-12 bg-muted/30 rounded-lg overflow-hidden">
          {/* Trimmed region highlight */}
          <div
            className="absolute top-0 bottom-0 bg-primary/20"
            style={{
              left: `${(trimStart / duration) * 100}%`,
              width: `${((trimEnd - trimStart) / duration) * 100}%`,
            }}
          />

          {/* Current position indicator */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />

          {/* Start handle */}
          <div
            className="absolute top-0 bottom-0 w-3 bg-primary cursor-ew-resize z-20 flex items-center justify-center"
            style={{ left: `${(trimStart / duration) * 100}%` }}
          >
            <div className="w-0.5 h-6 bg-white rounded-full" />
          </div>

          {/* End handle */}
          <div
            className="absolute top-0 bottom-0 w-3 bg-primary cursor-ew-resize z-20 flex items-center justify-center"
            style={{ left: `calc(${(trimEnd / duration) * 100}% - 12px)` }}
          >
            <div className="w-0.5 h-6 bg-white rounded-full" />
          </div>
        </div>

        {/* Sliders for precise control */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Start</label>
            <Slider
              value={[trimStart]}
              min={0}
              max={duration - 0.5}
              step={0.1}
              onValueChange={(v) => handleTrimChange(v, "start")}
              className="cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">End</label>
            <Slider
              value={[trimEnd]}
              min={0.5}
              max={duration}
              step={0.1}
              onValueChange={(v) => handleTrimChange(v, "end")}
              className="cursor-pointer"
            />
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => seekTo(trimStart)}
          >
            <SkipBack className="h-5 w-5" />
          </Button>
          <Button
            variant="default"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => seekTo(trimEnd)}
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
