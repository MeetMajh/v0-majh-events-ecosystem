"use client"

import { useRef, useEffect, useState } from "react"
import { useStudio, type StudioSource } from "./studio-context"
import { cn } from "@/lib/utils"

interface StudioCanvasProps {
  sceneId: string | null
  isPreview?: boolean
  className?: string
}

export function StudioCanvas({ sceneId, isPreview = false, className }: StudioCanvasProps) {
  const { scenes, selectedSourceId, selectSource, updateSource } = useStudio()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  
  const scene = scenes.find(s => s.id === sceneId)
  const sources = scene?.sources || []

  // Track container size for scaling
  useEffect(() => {
    if (!containerRef.current) return
    
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        })
      }
    })
    
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Calculate scale factor (canvas is 1920x1080, scale to fit container)
  const canvasWidth = 1920
  const canvasHeight = 1080
  const scaleX = containerSize.width / canvasWidth
  const scaleY = containerSize.height / canvasHeight
  const scale = Math.min(scaleX, scaleY)

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative bg-black overflow-hidden",
        className
      )}
      style={{ aspectRatio: "16/9" }}
    >
      {/* Scaled canvas container */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center"
        }}
      >
        <div 
          className="relative bg-neutral-900"
          style={{ width: canvasWidth, height: canvasHeight }}
        >
          {sources.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
              {isPreview ? "Preview - No sources" : "No sources added"}
            </div>
          )}
          
          {sources
            .filter(s => s.visible)
            .sort((a, b) => a.zIndex - b.zIndex)
            .map(source => (
              <DraggableSource
                key={source.id}
                source={source}
                sceneId={sceneId!}
                isSelected={selectedSourceId === source.id}
                onSelect={() => !isPreview && selectSource(source.id)}
                onUpdate={(updates) => !isPreview && updateSource(sceneId!, source.id, updates)}
                disabled={isPreview}
              />
            ))
          }
        </div>
      </div>
      
      {/* Label */}
      <div className={cn(
        "absolute top-2 left-2 px-2 py-1 text-xs font-bold rounded",
        isPreview ? "bg-amber-500 text-black" : "bg-red-600 text-white"
      )}>
        {isPreview ? "PREVIEW" : "PROGRAM"}
      </div>
    </div>
  )
}

interface DraggableSourceProps {
  source: StudioSource
  sceneId: string
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<StudioSource>) => void
  disabled?: boolean
}

function DraggableSource({ 
  source, 
  sceneId, 
  isSelected, 
  onSelect, 
  onUpdate,
  disabled 
}: DraggableSourceProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, sourceX: 0, sourceY: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || source.locked) return
    e.stopPropagation()
    onSelect()
    
    setIsDragging(true)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      sourceX: source.x,
      sourceY: source.y
    })
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (disabled || source.locked) return
    e.stopPropagation()
    
    setIsResizing(true)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: source.width,
      height: source.height
    })
  }

  useEffect(() => {
    if (!isDragging && !isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.x
        const dy = e.clientY - dragStart.y
        onUpdate({
          x: dragStart.sourceX + dx,
          y: dragStart.sourceY + dy
        })
      }
      
      if (isResizing) {
        const dx = e.clientX - resizeStart.x
        const dy = e.clientY - resizeStart.y
        onUpdate({
          width: Math.max(50, resizeStart.width + dx),
          height: Math.max(50, resizeStart.height + dy)
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, isResizing, dragStart, resizeStart, onUpdate])

  return (
    <div
      className={cn(
        "absolute cursor-move",
        isSelected && !disabled && "ring-2 ring-amber-500",
        source.locked && "cursor-not-allowed"
      )}
      style={{
        left: source.x,
        top: source.y,
        width: source.width,
        height: source.height,
        zIndex: source.zIndex,
        opacity: source.opacity
      }}
      onMouseDown={handleMouseDown}
    >
      <SourceRenderer source={source} />
      
      {/* Resize handle */}
      {isSelected && !disabled && !source.locked && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 bg-amber-500 cursor-se-resize"
          onMouseDown={handleResizeMouseDown}
        />
      )}
      
      {/* Label */}
      {isSelected && !disabled && (
        <div className="absolute -top-6 left-0 px-2 py-0.5 bg-amber-500 text-black text-xs rounded">
          {source.label}
        </div>
      )}
    </div>
  )
}

function SourceRenderer({ source }: { source: StudioSource }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && source.stream) {
      videoRef.current.srcObject = source.stream
    }
  }, [source.stream])

  switch (source.type) {
    case "webcam":
    case "screen":
      return (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover bg-neutral-800"
        />
      )
    
    case "image":
      return (
        <img
          src={source.url}
          alt={source.label}
          className="w-full h-full object-cover"
        />
      )
    
    case "video":
      return (
        <video
          src={source.url}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      )
    
    case "text":
      return (
        <div 
          className="w-full h-full flex items-center justify-center p-4"
          style={source.style}
        >
          <span className="text-white text-2xl font-bold text-center">
            {source.text}
          </span>
        </div>
      )
    
    case "overlay":
      return (
        <div 
          className="w-full h-full"
          style={{ 
            backgroundImage: source.url ? `url(${source.url})` : undefined,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            ...source.style
          }}
        />
      )
    
    default:
      return (
        <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-neutral-500">
          Unknown source type
        </div>
      )
  }
}
