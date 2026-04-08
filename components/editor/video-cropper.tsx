"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import Cropper, { Area } from "react-easy-crop"
import { motion } from "framer-motion"
import { 
  Crop, 
  Maximize, 
  Square, 
  RectangleVertical,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface VideoCropperProps {
  videoUrl: string
  onCropComplete: (croppedAreaPixels: Area) => void
  onCancel: () => void
}

type AspectRatioOption = {
  label: string
  value: number
  icon: React.ReactNode
}

const ASPECT_RATIOS: AspectRatioOption[] = [
  { label: "9:16", value: 9 / 16, icon: <RectangleVertical className="h-4 w-4" /> },
  { label: "1:1", value: 1, icon: <Square className="h-4 w-4" /> },
  { label: "16:9", value: 16 / 9, icon: <Maximize className="h-4 w-4" /> },
  { label: "4:5", value: 4 / 5, icon: <RectangleVertical className="h-4 w-4 rotate-0" /> },
]

export function VideoCropper({ videoUrl, onCropComplete, onCancel }: VideoCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [aspect, setAspect] = useState(9 / 16) // Default to vertical
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Pause video when cropping
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.pause()
    }
  }, [])

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop)
  }, [])

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom)
  }, [])

  const onCropCompleteCallback = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels)
    },
    []
  )

  const handleConfirm = () => {
    if (croppedAreaPixels) {
      onCropComplete(croppedAreaPixels)
      // Haptic feedback
      navigator.vibrate?.(10)
    }
  }

  const handleReset = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    navigator.vibrate?.(5)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Crop className="h-5 w-5 text-primary" />
          <span className="font-semibold">Crop Video</span>
        </div>
        <Button size="sm" onClick={handleConfirm} disabled={!croppedAreaPixels}>
          <Check className="h-4 w-4 mr-1" />
          Done
        </Button>
      </header>

      {/* Cropper area */}
      <div className="relative flex-1">
        <Cropper
          video={videoUrl}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropCompleteCallback}
          cropShape="rect"
          showGrid={true}
          style={{
            containerStyle: {
              backgroundColor: "#000",
            },
            cropAreaStyle: {
              border: "2px solid hsl(var(--primary))",
            },
          }}
        />

        {/* Grid overlay hint */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-1/4 border border-white/10" />
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-4 bg-black/80 backdrop-blur-sm">
        {/* Aspect ratio selector */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Aspect Ratio</p>
          <div className="flex gap-2">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.label}
                onClick={() => {
                  setAspect(ratio.value)
                  navigator.vibrate?.(5)
                }}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 p-3 rounded-lg transition-all",
                  aspect === ratio.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                )}
              >
                {ratio.icon}
                <span className="text-xs font-medium">{ratio.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Zoom slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Zoom</p>
            <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={([value]) => setZoom(value)}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Rotation slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Rotation</p>
            <span className="text-xs text-muted-foreground">{rotation}°</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Slider
              value={[rotation]}
              min={-180}
              max={180}
              step={1}
              onValueChange={([value]) => setRotation(value)}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
