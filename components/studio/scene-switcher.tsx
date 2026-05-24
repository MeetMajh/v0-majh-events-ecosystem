"use client"

import { useState } from "react"
import { useStudio } from "./studio-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Plus, 
  Trash2, 
  Play, 
  Eye, 
  ArrowRight,
  Pencil,
  Check,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"

export function SceneSwitcher() {
  const { 
    scenes, 
    activeSceneId, 
    previewSceneId, 
    addScene, 
    removeScene,
    renameScene,
    setActiveScene, 
    setPreviewScene,
    switchToPreview
  } = useStudio()
  
  const [newSceneName, setNewSceneName] = useState("")
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

  const handleAddScene = () => {
    if (newSceneName.trim()) {
      addScene(newSceneName.trim())
      setNewSceneName("")
    }
  }

  const handleStartEdit = (sceneId: string, currentName: string) => {
    setEditingSceneId(sceneId)
    setEditingName(currentName)
  }

  const handleSaveEdit = () => {
    if (editingSceneId && editingName.trim()) {
      renameScene(editingSceneId, editingName.trim())
    }
    setEditingSceneId(null)
    setEditingName("")
  }

  const handleCancelEdit = () => {
    setEditingSceneId(null)
    setEditingName("")
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Scenes</h3>
        <div className="flex gap-2">
          <Input
            value={newSceneName}
            onChange={(e) => setNewSceneName(e.target.value)}
            placeholder="New scene name"
            className="h-8 w-32 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAddScene()}
          />
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleAddScene}
            disabled={!newSceneName.trim()}
            className="h-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Transition button */}
      {previewSceneId && previewSceneId !== activeSceneId && (
        <Button
          onClick={switchToPreview}
          className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold"
        >
          <ArrowRight className="h-4 w-4 mr-2" />
          TRANSITION TO PREVIEW
        </Button>
      )}

      {/* Scene list */}
      <div className="grid grid-cols-2 gap-2">
        {scenes.map(scene => (
          <div
            key={scene.id}
            className={cn(
              "relative p-3 rounded-lg border transition-all",
              activeSceneId === scene.id 
                ? "border-red-500 bg-red-500/10" 
                : previewSceneId === scene.id
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-border bg-card hover:border-muted-foreground/50"
            )}
          >
            {/* Scene name / edit */}
            {editingSceneId === scene.id ? (
              <div className="flex items-center gap-1 mb-2">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="h-6 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit()
                    if (e.key === "Escape") handleCancelEdit()
                  }}
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEdit}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium truncate">{scene.name}</span>
                <div className="flex gap-1">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6"
                    onClick={() => handleStartEdit(scene.id, scene.name)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {scenes.length > 1 && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6 text-destructive"
                      onClick={() => removeScene(scene.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Status badges */}
            <div className="flex gap-1 mb-2">
              {activeSceneId === scene.id && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded">
                  LIVE
                </span>
              )}
              {previewSceneId === scene.id && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-black rounded">
                  PREVIEW
                </span>
              )}
              <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded">
                {scene.sources.length} sources
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={previewSceneId === scene.id ? "secondary" : "outline"}
                className="flex-1 h-7 text-xs"
                onClick={() => setPreviewScene(scene.id)}
                disabled={activeSceneId === scene.id}
              >
                <Eye className="h-3 w-3 mr-1" />
                Preview
              </Button>
              <Button
                size="sm"
                variant={activeSceneId === scene.id ? "destructive" : "default"}
                className="flex-1 h-7 text-xs"
                onClick={() => setActiveScene(scene.id)}
                disabled={activeSceneId === scene.id}
              >
                <Play className="h-3 w-3 mr-1" />
                {activeSceneId === scene.id ? "On Air" : "Go Live"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
