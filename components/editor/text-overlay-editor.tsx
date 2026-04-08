"use client"

import { useState, useRef, useCallback } from "react"
import { motion, useDragControls, PanInfo } from "framer-motion"
import { 
  Type, 
  Plus, 
  Trash2, 
  Check,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Move,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

export interface TextOverlay {
  id: string
  text: string
  x: number // percentage
  y: number // percentage
  fontSize: number
  fontWeight: "normal" | "bold"
  fontStyle: "normal" | "italic"
  textAlign: "left" | "center" | "right"
  color: string
  backgroundColor: string
  rotation: number
}

interface TextOverlayEditorProps {
  videoUrl: string
  overlays: TextOverlay[]
  onOverlaysChange: (overlays: TextOverlay[]) => void
  onComplete: () => void
  onCancel: () => void
}

const PRESET_COLORS = [
  "#FFFFFF", // White
  "#000000", // Black
  "#FF0000", // Red
  "#00FF00", // Green
  "#0066FF", // Blue
  "#FFFF00", // Yellow
  "#FF00FF", // Magenta
  "#00FFFF", // Cyan
  "#FF6600", // Orange
  "#9900FF", // Purple
]

const BACKGROUND_COLORS = [
  "transparent",
  "rgba(0,0,0,0.5)",
  "rgba(0,0,0,0.8)",
  "rgba(255,255,255,0.5)",
  "rgba(255,255,255,0.8)",
  "#FF0000",
  "#0066FF",
  "#FFFF00",
]

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

function DraggableText({
  overlay,
  isSelected,
  onSelect,
  onUpdate,
  containerRef,
}: {
  overlay: TextOverlay
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<TextOverlay>) => void
  containerRef: React.RefObject<HTMLDivElement>
}) {
  const dragControls = useDragControls()

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!containerRef.current) return
      
      const rect = containerRef.current.getBoundingClientRect()
      const newX = overlay.x + (info.offset.x / rect.width) * 100
      const newY = overlay.y + (info.offset.y / rect.height) * 100
      
      // Clamp to container bounds
      onUpdate({
        x: Math.max(0, Math.min(100, newX)),
        y: Math.max(0, Math.min(100, newY)),
      })
    },
    [overlay.x, overlay.y, onUpdate, containerRef]
  )

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className={cn(
        "absolute cursor-move select-none",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-transparent"
      )}
      style={{
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
      }}
      whileTap={{ scale: 1.05 }}
    >
      <div
        className="px-3 py-1.5 rounded whitespace-nowrap"
        style={{
          fontSize: `${overlay.fontSize}px`,
          fontWeight: overlay.fontWeight,
          fontStyle: overlay.fontStyle,
          textAlign: overlay.textAlign,
          color: overlay.color,
          backgroundColor: overlay.backgroundColor,
          textShadow: overlay.backgroundColor === "transparent" 
            ? "2px 2px 4px rgba(0,0,0,0.8)" 
            : "none",
        }}
      >
        {overlay.text || "Double tap to edit"}
      </div>

      {/* Drag handle indicator */}
      {isSelected && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded bg-primary text-primary-foreground text-xs">
          <Move className="h-3 w-3" />
          Drag
        </div>
      )}
    </motion.div>
  )
}

export function TextOverlayEditor({
  videoUrl,
  overlays,
  onOverlaysChange,
  onComplete,
  onCancel,
}: TextOverlayEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showColorPicker, setShowColorPicker] = useState<"text" | "bg" | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const selectedOverlay = overlays.find((o) => o.id === selectedId)

  const addOverlay = () => {
    const newOverlay: TextOverlay = {
      id: generateId(),
      text: "Your text here",
      x: 50,
      y: 50,
      fontSize: 24,
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "center",
      color: "#FFFFFF",
      backgroundColor: "rgba(0,0,0,0.5)",
      rotation: 0,
    }
    onOverlaysChange([...overlays, newOverlay])
    setSelectedId(newOverlay.id)
    navigator.vibrate?.(10)
  }

  const updateOverlay = (id: string, updates: Partial<TextOverlay>) => {
    onOverlaysChange(
      overlays.map((o) => (o.id === id ? { ...o, ...updates } : o))
    )
  }

  const deleteOverlay = (id: string) => {
    onOverlaysChange(overlays.filter((o) => o.id !== id))
    if (selectedId === id) {
      setSelectedId(null)
    }
    navigator.vibrate?.(10)
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
          <Type className="h-5 w-5 text-primary" />
          <span className="font-semibold">Add Text</span>
        </div>
        <Button size="sm" onClick={onComplete}>
          <Check className="h-4 w-4 mr-1" />
          Done
        </Button>
      </header>

      {/* Video preview with overlays */}
      <div 
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center bg-black"
        onClick={() => setSelectedId(null)}
      >
        <div className="relative aspect-[9/16] max-h-full w-full max-w-sm">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            loop
            muted
            autoPlay
            playsInline
          />

          {/* Render overlays */}
          {overlays.map((overlay) => (
            <DraggableText
              key={overlay.id}
              overlay={overlay}
              isSelected={selectedId === overlay.id}
              onSelect={() => setSelectedId(overlay.id)}
              onUpdate={(updates) => updateOverlay(overlay.id, updates)}
              containerRef={containerRef}
            />
          ))}

          {/* Add text button (centered when no overlays) */}
          {overlays.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={addOverlay}
                className="gap-2 bg-black/50 border-white/30"
              >
                <Plus className="h-5 w-5" />
                Add Text
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-4 bg-black/80 backdrop-blur-sm max-h-[45vh] overflow-y-auto">
        {selectedOverlay ? (
          <>
            {/* Text input */}
            <div className="space-y-2">
              <Input
                value={selectedOverlay.text}
                onChange={(e) => updateOverlay(selectedOverlay.id, { text: e.target.value })}
                placeholder="Enter text"
                className="bg-white/10 border-white/20"
                autoFocus
              />
            </div>

            {/* Font size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Size</p>
                <span className="text-xs text-muted-foreground">{selectedOverlay.fontSize}px</span>
              </div>
              <Slider
                value={[selectedOverlay.fontSize]}
                min={12}
                max={64}
                step={1}
                onValueChange={([value]) => updateOverlay(selectedOverlay.id, { fontSize: value })}
              />
            </div>

            {/* Style buttons */}
            <div className="flex gap-2">
              <Button
                variant={selectedOverlay.fontWeight === "bold" ? "default" : "outline"}
                size="icon"
                onClick={() => 
                  updateOverlay(selectedOverlay.id, { 
                    fontWeight: selectedOverlay.fontWeight === "bold" ? "normal" : "bold" 
                  })
                }
                className="flex-1"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedOverlay.fontStyle === "italic" ? "default" : "outline"}
                size="icon"
                onClick={() => 
                  updateOverlay(selectedOverlay.id, { 
                    fontStyle: selectedOverlay.fontStyle === "italic" ? "normal" : "italic" 
                  })
                }
                className="flex-1"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedOverlay.textAlign === "left" ? "default" : "outline"}
                size="icon"
                onClick={() => updateOverlay(selectedOverlay.id, { textAlign: "left" })}
                className="flex-1"
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedOverlay.textAlign === "center" ? "default" : "outline"}
                size="icon"
                onClick={() => updateOverlay(selectedOverlay.id, { textAlign: "center" })}
                className="flex-1"
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedOverlay.textAlign === "right" ? "default" : "outline"}
                size="icon"
                onClick={() => updateOverlay(selectedOverlay.id, { textAlign: "right" })}
                className="flex-1"
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Color pickers */}
            <div className="grid grid-cols-2 gap-4">
              {/* Text color */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowColorPicker(showColorPicker === "text" ? null : "text")}
                  className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider w-full"
                >
                  <Palette className="h-3 w-3" />
                  Text Color
                  <div
                    className="w-4 h-4 rounded-full border border-white/30 ml-auto"
                    style={{ backgroundColor: selectedOverlay.color }}
                  />
                </button>
                {showColorPicker === "text" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex flex-wrap gap-1"
                  >
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          updateOverlay(selectedOverlay.id, { color })
                          setShowColorPicker(null)
                        }}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                          selectedOverlay.color === color
                            ? "border-primary"
                            : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Background color */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowColorPicker(showColorPicker === "bg" ? null : "bg")}
                  className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider w-full"
                >
                  <Palette className="h-3 w-3" />
                  Background
                  <div
                    className="w-4 h-4 rounded-full border border-white/30 ml-auto"
                    style={{ 
                      backgroundColor: selectedOverlay.backgroundColor,
                      backgroundImage: selectedOverlay.backgroundColor === "transparent" 
                        ? "linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)"
                        : undefined,
                      backgroundSize: "8px 8px",
                      backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                    }}
                  />
                </button>
                {showColorPicker === "bg" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex flex-wrap gap-1"
                  >
                    {BACKGROUND_COLORS.map((color, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          updateOverlay(selectedOverlay.id, { backgroundColor: color })
                          setShowColorPicker(null)
                        }}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                          selectedOverlay.backgroundColor === color
                            ? "border-primary"
                            : "border-transparent"
                        )}
                        style={{ 
                          backgroundColor: color,
                          backgroundImage: color === "transparent" 
                            ? "linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)"
                            : undefined,
                          backgroundSize: "8px 8px",
                          backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                        }}
                      />
                    ))}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Rotation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Rotation</p>
                <span className="text-xs text-muted-foreground">{selectedOverlay.rotation}°</span>
              </div>
              <Slider
                value={[selectedOverlay.rotation]}
                min={-45}
                max={45}
                step={1}
                onValueChange={([value]) => updateOverlay(selectedOverlay.id, { rotation: value })}
              />
            </div>

            {/* Delete button */}
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => deleteOverlay(selectedOverlay.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Text
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">
              {overlays.length > 0 
                ? "Tap a text to edit, or add more" 
                : "Add text overlays to your clip"}
            </p>
            <Button onClick={addOverlay} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Text
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
