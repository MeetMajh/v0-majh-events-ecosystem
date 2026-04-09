"use client"

import { useStudio } from "./studio-context"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Volume2, VolumeX, Mic, MicOff } from "lucide-react"
import { cn } from "@/lib/utils"

export function AudioMixer() {
  const { volume, setVolume, isMuted, toggleMute, scenes, activeSceneId } = useStudio()
  
  const activeScene = scenes.find(s => s.id === activeSceneId)
  const audioSources = activeScene?.sources.filter(s => 
    s.type === "webcam" || s.type === "screen"
  ) || []

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Audio</h3>
      
      {/* Master volume */}
      <div className="p-3 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">Master</span>
          <Button
            size="icon"
            variant="ghost"
            className={cn("h-6 w-6", isMuted && "text-destructive")}
            onClick={toggleMute}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Slider
            value={[isMuted ? 0 : volume]}
            onValueChange={([value]) => setVolume(value)}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-8 text-right">
            {isMuted ? "0" : volume}%
          </span>
        </div>
        
        {/* Simple level meter */}
        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all",
              isMuted ? "bg-muted" : volume > 80 ? "bg-red-500" : volume > 50 ? "bg-amber-500" : "bg-green-500"
            )}
            style={{ width: `${isMuted ? 0 : volume}%` }}
          />
        </div>
      </div>

      {/* Audio sources */}
      {audioSources.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Sources</span>
          {audioSources.map(source => (
            <div key={source.id} className="p-2 rounded border border-border bg-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs truncate">{source.label}</span>
                <Button size="icon" variant="ghost" className="h-5 w-5">
                  <Mic className="h-3 w-3" />
                </Button>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-green-500" />
              </div>
            </div>
          ))}
        </div>
      )}

      {audioSources.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-2">
          Add webcam or screen share for audio
        </div>
      )}
    </div>
  )
}
