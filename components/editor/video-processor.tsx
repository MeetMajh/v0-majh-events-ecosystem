"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Scissors,
  Crop,
  Download,
  Loader2,
  Check,
  X,
  Sparkles,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  processVideo,
  trimVideo,
  cropToVertical,
  getVideoMetadata,
  type VideoProcessingOptions,
  type ProcessingProgress,
} from "@/lib/ffmpeg-service"
import type { Area } from "@/components/editor/video-cropper"

interface VideoProcessorProps {
  file: File
  trimRange?: { start: number; end: number }
  cropArea?: Area
  onProcessed: (processedFile: File) => void
  onCancel: () => void
}

export function VideoProcessor({
  file,
  trimRange,
  cropArea,
  onProcessed,
  onCancel,
}: VideoProcessorProps) {
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState<ProcessingProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleProcess = useCallback(async () => {
    setProcessing(true)
    setError(null)

    try {
      // Get video metadata for crop calculations
      const metadata = await getVideoMetadata(file)

      const options: VideoProcessingOptions = {
        quality: "high",
        format: "mp4",
      }

      // Add trim if specified
      if (trimRange) {
        options.trim = {
          startTime: trimRange.start,
          endTime: trimRange.end,
        }
      }

      // Add crop if specified (convert percentage-based Area to pixels)
      if (cropArea) {
        options.crop = {
          x: Math.round((cropArea.x / 100) * metadata.width),
          y: Math.round((cropArea.y / 100) * metadata.height),
          width: Math.round((cropArea.width / 100) * metadata.width),
          height: Math.round((cropArea.height / 100) * metadata.height),
        }
      }

      // Process the video
      const processedBlob = await processVideo(file, options, setProgress)

      // Convert blob to file
      const processedFile = new File(
        [processedBlob],
        file.name.replace(/\.[^/.]+$/, "_processed.mp4"),
        { type: "video/mp4" }
      )

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 100, 50])
      }

      onProcessed(processedFile)
    } catch (err) {
      console.error("Video processing error:", err)
      setError(err instanceof Error ? err.message : "Failed to process video")
    } finally {
      setProcessing(false)
    }
  }, [file, trimRange, cropArea, onProcessed])

  const hasEdits = trimRange || cropArea

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-md glass-panel rounded-2xl border border-border/30 p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Process Video</h2>
              <p className="text-sm text-muted-foreground">
                Apply your edits to the video
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={processing}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Edit Summary */}
        <div className="space-y-3 mb-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Edits to Apply
          </p>
          <div className="flex flex-wrap gap-2">
            {trimRange && (
              <Badge variant="secondary" className="gap-1">
                <Scissors className="h-3 w-3" />
                Trim: {trimRange.start.toFixed(1)}s - {trimRange.end.toFixed(1)}s
              </Badge>
            )}
            {cropArea && (
              <Badge variant="secondary" className="gap-1">
                <Crop className="h-3 w-3" />
                Crop Applied
              </Badge>
            )}
            {!hasEdits && (
              <Badge variant="outline" className="text-muted-foreground">
                No edits - will optimize video
              </Badge>
            )}
          </div>
        </div>

        {/* Progress */}
        <AnimatePresence mode="wait">
          {processing && progress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 space-y-3"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{progress.message}</span>
                <span className="font-mono">{progress.progress}%</span>
              </div>
              <Progress value={progress.progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progress.stage === "loading" && "Loading video processor..."}
                {progress.stage === "processing" && "This may take a moment..."}
                {progress.stage === "finalizing" && "Almost done..."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2"
          >
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Processing Failed
              </p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleProcess}
            disabled={processing}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Process Video
              </>
            )}
          </Button>
        </div>

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          Video processing runs locally in your browser
        </p>
      </motion.div>
    </motion.div>
  )
}
