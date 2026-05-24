"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { 
  Image, 
  ChevronLeft, 
  ChevronRight, 
  Check,
  Sparkles,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ThumbnailSelectorProps {
  videoUrl: string
  onSelect: (thumbnailDataUrl: string) => void
  onCancel: () => void
}

const FRAME_COUNT = 8 // Number of frames to extract

export function ThumbnailSelector({ videoUrl, onSelect, onCancel }: ThumbnailSelectorProps) {
  const [frames, setFrames] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [customThumbnail, setCustomThumbnail] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Extract frames from video
  const extractFrames = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Wait for video metadata
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) {
        resolve()
      } else {
        video.onloadedmetadata = () => resolve()
      }
    })

    const duration = video.duration
    const frameInterval = duration / (FRAME_COUNT + 1)
    const extractedFrames: string[] = []

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const time = frameInterval * i
      
      // Seek to time
      video.currentTime = time
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve()
      })

      // Draw frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      // Convert to data URL
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
      extractedFrames.push(dataUrl)
    }

    setFrames(extractedFrames)
    setLoading(false)
  }, [])

  useEffect(() => {
    extractFrames()
  }, [extractFrames])

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setCustomThumbnail(result)
        setSelectedIndex(-1) // -1 indicates custom thumbnail
      }
      reader.readAsDataURL(file)
    }
  }

  const handleConfirm = () => {
    const selected = selectedIndex === -1 ? customThumbnail : frames[selectedIndex]
    if (selected) {
      onSelect(selected)
      navigator.vibrate?.(10)
    }
  }

  const scrollFrames = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 120
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  const selectedThumbnail = selectedIndex === -1 ? customThumbnail : frames[selectedIndex]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Hidden video element for frame extraction */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="hidden"
        crossOrigin="anonymous"
        preload="metadata"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCustomUpload}
      />

      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Image className="h-5 w-5 text-primary" />
          <span className="font-semibold">Choose Thumbnail</span>
        </div>
        <Button size="sm" onClick={handleConfirm} disabled={!selectedThumbnail}>
          <Check className="h-4 w-4 mr-1" />
          Done
        </Button>
      </header>

      {/* Main preview */}
      <div className="flex-1 flex items-center justify-center p-4">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <p className="text-muted-foreground">Generating thumbnails...</p>
          </div>
        ) : selectedThumbnail ? (
          <motion.div
            key={selectedIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative aspect-video max-w-md w-full rounded-xl overflow-hidden ring-2 ring-primary"
          >
            <img
              src={selectedThumbnail}
              alt="Selected thumbnail"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-xs">
              {selectedIndex === -1 ? "Custom" : `Frame ${selectedIndex + 1}`}
            </div>
          </motion.div>
        ) : (
          <div className="text-muted-foreground">Select a thumbnail</div>
        )}
      </div>

      {/* Frame selector */}
      <div className="p-4 space-y-4 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Select Frame</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1"
          >
            <Upload className="h-3 w-3" />
            Upload Custom
          </Button>
        </div>

        {/* Scrollable frame strip */}
        <div className="relative">
          {/* Scroll buttons */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-black/60"
            onClick={() => scrollFrames("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-black/60"
            onClick={() => scrollFrames("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Frame strip */}
          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide px-8 py-2"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {/* Custom thumbnail option */}
            {customThumbnail && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSelectedIndex(-1)}
                className={cn(
                  "relative flex-shrink-0 w-20 aspect-video rounded-lg overflow-hidden transition-all",
                  selectedIndex === -1
                    ? "ring-2 ring-primary scale-105"
                    : "ring-1 ring-white/20 opacity-70 hover:opacity-100"
                )}
                style={{ scrollSnapAlign: "center" }}
              >
                <img
                  src={customThumbnail}
                  alt="Custom thumbnail"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Upload className="h-4 w-4" />
                </div>
              </motion.button>
            )}

            {/* Extracted frames */}
            {frames.map((frame, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => {
                  setSelectedIndex(index)
                  navigator.vibrate?.(5)
                }}
                className={cn(
                  "relative flex-shrink-0 w-20 aspect-video rounded-lg overflow-hidden transition-all",
                  selectedIndex === index
                    ? "ring-2 ring-primary scale-105"
                    : "ring-1 ring-white/20 opacity-70 hover:opacity-100"
                )}
                style={{ scrollSnapAlign: "center" }}
              >
                <img
                  src={frame}
                  alt={`Frame ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {selectedIndex === index && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-primary/30"
                  >
                    <Check className="h-5 w-5 text-white" />
                  </motion.div>
                )}
              </motion.button>
            ))}

            {/* Loading placeholders */}
            {loading && (
              <>
                {Array.from({ length: FRAME_COUNT }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-20 aspect-video rounded-lg bg-white/10 animate-pulse"
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Tip */}
        <p className="text-xs text-muted-foreground text-center">
          A good thumbnail grabs attention. Choose a frame with action or upload a custom image.
        </p>
      </div>
    </motion.div>
  )
}
