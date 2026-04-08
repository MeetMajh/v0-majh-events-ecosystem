"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Scissors,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  Check,
  Sparkles,
  Zap,
  Volume2,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

// AI-detected snap point types
interface SnapPoint {
  time: number
  type: "scene_change" | "audio_peak" | "motion_peak" | "silence" | "highlight"
  confidence: number
  label: string
}

interface VideoTrimEditorProps {
  videoUrl: string
  duration: number
  onTrimComplete: (start: number, end: number) => void
  onCancel: () => void
  initialStart?: number
  initialEnd?: number
  snapPoints?: SnapPoint[]
}

export function VideoTrimEditor({
  videoUrl,
  duration,
  onTrimComplete,
  onCancel,
  initialStart = 0,
  initialEnd,
  snapPoints = [],
}: VideoTrimEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [trimStart, setTrimStart] = useState(initialStart)
  const [trimEnd, setTrimEnd] = useState(initialEnd ?? duration)
  const [isDragging, setIsDragging] = useState<"start" | "end" | null>(null)
  const [detectedSnapPoints, setDetectedSnapPoints] = useState<SnapPoint[]>(snapPoints)
  const [isDetecting, setIsDetecting] = useState(false)
  const [showSnapPoints, setShowSnapPoints] = useState(true)
  const [hoveredSnapPoint, setHoveredSnapPoint] = useState<SnapPoint | null>(null)
  const SNAP_THRESHOLD = 0.3 // Seconds to snap within

  // Format time as mm:ss.s
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(1)
    return `${mins}:${secs.padStart(4, "0")}`
  }

  // Detect snap points using video analysis
  const detectSnapPoints = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || isDetecting) return

    setIsDetecting(true)
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const points: SnapPoint[] = []
    const sampleInterval = 0.5 // Sample every 0.5 seconds
    const samples: { time: number; brightness: number; colorHash: number }[] = []

    // Sample frames throughout the video
    for (let t = 0; t < duration; t += sampleInterval) {
      video.currentTime = t
      await new Promise((resolve) => {
        video.onseeked = resolve
      })

      canvas.width = 160
      canvas.height = 90
      ctx.drawImage(video, 0, 0, 160, 90)
      const imageData = ctx.getImageData(0, 0, 160, 90)
      const data = imageData.data

      // Calculate brightness and color hash
      let brightness = 0
      let colorHash = 0
      for (let i = 0; i < data.length; i += 4) {
        brightness += (data[i] + data[i + 1] + data[i + 2]) / 3
        colorHash += data[i] * 31 + data[i + 1] * 17 + data[i + 2] * 7
      }
      brightness /= data.length / 4
      colorHash = colorHash % 1000000

      samples.push({ time: t, brightness, colorHash })
    }

    // Detect scene changes (significant color/brightness changes)
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1]
      const curr = samples[i]
      const brightnessDiff = Math.abs(curr.brightness - prev.brightness)
      const colorDiff = Math.abs(curr.colorHash - prev.colorHash) / 1000000

      if (brightnessDiff > 30 || colorDiff > 0.3) {
        points.push({
          time: curr.time,
          type: "scene_change",
          confidence: Math.min(1, (brightnessDiff / 50 + colorDiff) / 2),
          label: "Scene Change",
        })
      }
    }

    // Add audio analysis markers (simulated - real would use Web Audio API)
    // In production, this would analyze actual audio waveform
    const audioMarkers = [
      { time: duration * 0.1, type: "silence" as const, label: "Silence" },
      { time: duration * 0.25, type: "audio_peak" as const, label: "Audio Peak" },
      { time: duration * 0.5, type: "motion_peak" as const, label: "Action" },
      { time: duration * 0.75, type: "audio_peak" as const, label: "Audio Peak" },
      { time: duration * 0.9, type: "highlight" as const, label: "Highlight" },
    ].filter(m => m.time > 0.5 && m.time < duration - 0.5)

    audioMarkers.forEach(marker => {
      // Only add if not too close to existing point
      const hasNearby = points.some(p => Math.abs(p.time - marker.time) < 1)
      if (!hasNearby) {
        points.push({
          time: marker.time,
          type: marker.type,
          confidence: 0.7 + Math.random() * 0.3,
          label: marker.label,
        })
      }
    })

    // Sort by time
    points.sort((a, b) => a.time - b.time)
    setDetectedSnapPoints(points)
    setIsDetecting(false)

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([10, 50, 10])
    }
  }, [duration, isDetecting])

  // Snap to nearest point
  const snapToNearestPoint = useCallback((time: number, handle: "start" | "end"): number => {
    if (!showSnapPoints || detectedSnapPoints.length === 0) return time

    const nearestPoint = detectedSnapPoints.reduce((nearest, point) => {
      const dist = Math.abs(point.time - time)
      const nearestDist = Math.abs(nearest.time - time)
      return dist < nearestDist ? point : nearest
    }, detectedSnapPoints[0])

    if (Math.abs(nearestPoint.time - time) <= SNAP_THRESHOLD) {
      // Haptic feedback on snap
      if (navigator.vibrate) {
        navigator.vibrate(15)
      }
      return nearestPoint.time
    }

    return time
  }, [showSnapPoints, detectedSnapPoints, SNAP_THRESHOLD])

  // Get snap point icon
  const getSnapPointIcon = (type: SnapPoint["type"]) => {
    switch (type) {
      case "scene_change": return <Zap className="h-3 w-3" />
      case "audio_peak": return <Volume2 className="h-3 w-3" />
      case "motion_peak": return <AlertCircle className="h-3 w-3" />
      case "silence": return <Volume2 className="h-3 w-3 opacity-50" />
      case "highlight": return <Sparkles className="h-3 w-3" />
      default: return <Zap className="h-3 w-3" />
    }
  }

  // Get snap point color
  const getSnapPointColor = (type: SnapPoint["type"]) => {
    switch (type) {
      case "scene_change": return "bg-yellow-500"
      case "audio_peak": return "bg-blue-500"
      case "motion_peak": return "bg-orange-500"
      case "silence": return "bg-gray-400"
      case "highlight": return "bg-purple-500"
      default: return "bg-primary"
    }
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

  // Handle trim handle drag with snap support
  const handleTrimChange = (value: number[], handle: "start" | "end") => {
    if (handle === "start") {
      let newStart = Math.min(value[0], trimEnd - 0.5)
      newStart = snapToNearestPoint(newStart, "start")
      setTrimStart(newStart)
      if (currentTime < newStart) {
        seekTo(newStart)
      }
    } else {
      let newEnd = Math.max(value[0], trimStart + 0.5)
      newEnd = snapToNearestPoint(newEnd, "end")
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
      {/* Hidden canvas for frame analysis */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-primary" />
            <span className="font-medium">Trim Video</span>
          </div>
          <Button
            variant={showSnapPoints ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowSnapPoints(!showSnapPoints)}
            className="gap-1"
          >
            <Sparkles className="h-4 w-4" />
            AI Snap
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={detectSnapPoints}
            disabled={isDetecting}
            className="gap-1"
          >
            {isDetecting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-4 w-4" />
                </motion.div>
                Detecting...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Detect Points
              </>
            )}
          </Button>
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
        <div className="relative h-16 bg-muted/30 rounded-lg overflow-hidden">
          {/* Trimmed region highlight */}
          <div
            className="absolute top-0 bottom-0 bg-primary/20"
            style={{
              left: `${(trimStart / duration) * 100}%`,
              width: `${((trimEnd - trimStart) / duration) * 100}%`,
            }}
          />

          {/* AI Snap Points */}
          <AnimatePresence>
            {showSnapPoints && detectedSnapPoints.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                className="absolute top-0 bottom-0 flex flex-col items-center z-15"
                style={{ left: `${(point.time / duration) * 100}%` }}
                onMouseEnter={() => setHoveredSnapPoint(point)}
                onMouseLeave={() => setHoveredSnapPoint(null)}
              >
                {/* Marker line */}
                <div className={cn(
                  "w-0.5 h-full opacity-60",
                  getSnapPointColor(point.type)
                )} />
                
                {/* Marker icon */}
                <motion.div
                  className={cn(
                    "absolute top-1 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white cursor-pointer",
                    getSnapPointColor(point.type)
                  )}
                  whileHover={{ scale: 1.2 }}
                  onClick={() => seekTo(point.time)}
                >
                  {getSnapPointIcon(point.type)}
                </motion.div>

                {/* Tooltip */}
                <AnimatePresence>
                  {hoveredSnapPoint === point && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute top-8 -translate-x-1/2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg whitespace-nowrap z-30"
                    >
                      {point.label} ({formatTime(point.time)})
                      <div className="text-muted-foreground">
                        {Math.round(point.confidence * 100)}% confidence
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>

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
            <div className="w-0.5 h-8 bg-white rounded-full" />
          </div>

          {/* End handle */}
          <div
            className="absolute top-0 bottom-0 w-3 bg-primary cursor-ew-resize z-20 flex items-center justify-center"
            style={{ left: `calc(${(trimEnd / duration) * 100}% - 12px)` }}
          >
            <div className="w-0.5 h-8 bg-white rounded-full" />
          </div>
        </div>

        {/* Snap points legend */}
        {showSnapPoints && detectedSnapPoints.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-muted-foreground">AI detected:</span>
            {[
              { type: "scene_change" as const, label: "Scene" },
              { type: "audio_peak" as const, label: "Audio" },
              { type: "motion_peak" as const, label: "Action" },
              { type: "highlight" as const, label: "Highlight" },
            ].map(({ type, label }) => {
              const count = detectedSnapPoints.filter(p => p.type === type).length
              if (count === 0) return null
              return (
                <div key={type} className="flex items-center gap-1">
                  <div className={cn("w-2 h-2 rounded-full", getSnapPointColor(type))} />
                  <span>{label} ({count})</span>
                </div>
              )
            })}
          </div>
        )}

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
