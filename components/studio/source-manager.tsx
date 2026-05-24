"use client"

import { useState, useRef } from "react"
import { useStudio, type StudioSource } from "./studio-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { 
  Camera, 
  Monitor, 
  Image as ImageIcon, 
  Video, 
  Type, 
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function SourceManager() {
  const { 
    scenes,
    activeSceneId, 
    selectedSourceId,
    addSource, 
    removeSource, 
    updateSource,
    selectSource,
    startWebcam,
    startScreenShare,
    stopCapture
  } = useStudio()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [addSourceType, setAddSourceType] = useState<StudioSource["type"] | null>(null)

  const activeScene = scenes.find(s => s.id === activeSceneId)
  const sources = activeScene?.sources || []
  const selectedSource = sources.find(s => s.id === selectedSourceId)

  const handleAddWebcam = async () => {
    if (!activeSceneId) return
    const stream = await startWebcam()
    if (stream) {
      addSource(activeSceneId, {
        type: "webcam",
        label: "Webcam",
        x: 50,
        y: 50,
        width: 640,
        height: 480,
        zIndex: sources.length + 1,
        visible: true,
        locked: false,
        opacity: 1,
        stream
      })
    }
  }

  const handleAddScreenShare = async () => {
    if (!activeSceneId) return
    const stream = await startScreenShare()
    if (stream) {
      addSource(activeSceneId, {
        type: "screen",
        label: "Screen Share",
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        zIndex: sources.length + 1,
        visible: true,
        locked: false,
        opacity: 1,
        stream
      })
    }
  }

  const handleAddImage = () => {
    setAddSourceType("image")
    fileInputRef.current?.click()
  }

  const handleAddVideo = () => {
    setAddSourceType("video")
    fileInputRef.current?.click()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeSceneId || !e.target.files?.length) return
    
    const file = e.target.files[0]
    const url = URL.createObjectURL(file)
    const type = addSourceType || "image"
    
    addSource(activeSceneId, {
      type,
      label: file.name,
      x: 100,
      y: 100,
      width: 640,
      height: 360,
      zIndex: sources.length + 1,
      visible: true,
      locked: false,
      opacity: 1,
      url
    })
    
    setAddSourceType(null)
    e.target.value = ""
  }

  const handleAddText = () => {
    if (!activeSceneId) return
    addSource(activeSceneId, {
      type: "text",
      label: "Text Overlay",
      x: 100,
      y: 100,
      width: 400,
      height: 100,
      zIndex: sources.length + 1,
      visible: true,
      locked: false,
      opacity: 1,
      text: "Enter text here",
      style: {
        backgroundColor: "rgba(0,0,0,0.7)",
        color: "#ffffff",
        fontSize: "24px"
      }
    })
  }

  const handleRemoveSource = (sourceId: string) => {
    if (!activeSceneId) return
    const source = sources.find(s => s.id === sourceId)
    if (source?.stream) {
      stopCapture(source.stream)
    }
    removeSource(activeSceneId, sourceId)
  }

  const handleMoveLayer = (sourceId: string, direction: "up" | "down") => {
    if (!activeSceneId) return
    const source = sources.find(s => s.id === sourceId)
    if (!source) return
    
    const newZIndex = direction === "up" 
      ? source.zIndex + 1 
      : Math.max(1, source.zIndex - 1)
    
    updateSource(activeSceneId, sourceId, { zIndex: newZIndex })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Sources</h3>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8">
              <Plus className="h-4 w-4 mr-1" />
              Add Source
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleAddWebcam}>
              <Camera className="h-4 w-4 mr-2" />
              Webcam
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddScreenShare}>
              <Monitor className="h-4 w-4 mr-2" />
              Screen Share
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddImage}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddVideo}>
              <Video className="h-4 w-4 mr-2" />
              Video
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddText}>
              <Type className="h-4 w-4 mr-2" />
              Text
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={addSourceType === "video" ? "video/*" : "image/*"}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Source list */}
      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {sources.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No sources added yet
          </div>
        )}
        
        {sources
          .sort((a, b) => b.zIndex - a.zIndex)
          .map(source => (
            <div
              key={source.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded border cursor-pointer transition-all",
                selectedSourceId === source.id 
                  ? "border-amber-500 bg-amber-500/10" 
                  : "border-border bg-card hover:border-muted-foreground/50"
              )}
              onClick={() => selectSource(source.id)}
            >
              <SourceIcon type={source.type} />
              
              <span className="flex-1 text-sm truncate">{source.label}</span>
              
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    updateSource(activeSceneId!, source.id, { visible: !source.visible })
                  }}
                >
                  {source.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </Button>
                
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    updateSource(activeSceneId!, source.id, { locked: !source.locked })
                  }}
                >
                  {source.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </Button>
                
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMoveLayer(source.id, "up")
                  }}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMoveLayer(source.id, "down")
                  }}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveSource(source.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        }
      </div>

      {/* Selected source properties */}
      {selectedSource && (
        <div className="border-t border-border pt-3 mt-2">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">
            Properties: {selectedSource.label}
          </h4>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Label</Label>
              <Input
                value={selectedSource.label}
                onChange={(e) => updateSource(activeSceneId!, selectedSource.id, { label: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            
            <div>
              <Label className="text-xs">Opacity: {Math.round(selectedSource.opacity * 100)}%</Label>
              <Slider
                value={[selectedSource.opacity * 100]}
                onValueChange={([value]) => updateSource(activeSceneId!, selectedSource.id, { opacity: value / 100 })}
                max={100}
                step={1}
                className="mt-1"
              />
            </div>
            
            {selectedSource.type === "text" && (
              <div>
                <Label className="text-xs">Text</Label>
                <Input
                  value={selectedSource.text || ""}
                  onChange={(e) => updateSource(activeSceneId!, selectedSource.id, { text: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Width</Label>
                <Input
                  type="number"
                  value={selectedSource.width}
                  onChange={(e) => updateSource(activeSceneId!, selectedSource.id, { width: parseInt(e.target.value) || 100 })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Height</Label>
                <Input
                  type="number"
                  value={selectedSource.height}
                  onChange={(e) => updateSource(activeSceneId!, selectedSource.id, { height: parseInt(e.target.value) || 100 })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SourceIcon({ type }: { type: StudioSource["type"] }) {
  switch (type) {
    case "webcam":
      return <Camera className="h-4 w-4 text-blue-500" />
    case "screen":
      return <Monitor className="h-4 w-4 text-green-500" />
    case "image":
      return <ImageIcon className="h-4 w-4 text-purple-500" />
    case "video":
      return <Video className="h-4 w-4 text-red-500" />
    case "text":
      return <Type className="h-4 w-4 text-amber-500" />
    case "overlay":
      return <Layers className="h-4 w-4 text-cyan-500" />
    default:
      return <Layers className="h-4 w-4" />
  }
}
