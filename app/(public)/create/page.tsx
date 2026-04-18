"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Upload, 
  X, 
  Play, 
  Pause, 
  Check, 
  ChevronRight,
  Hash,
  Gamepad2,
  Globe,
  Lock,
  Users,
  Scissors,
  Loader2,
  Sparkles,
  Crop,
  Image,
  Type,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { uploadMediaFile, createMedia } from "@/lib/media-actions"
import { getGames } from "@/lib/esports-actions"
import { MobileNavSpacer } from "@/components/esports/mobile-nav"
import { VideoCropper, type Area } from "@/components/editor/video-cropper"
import { ThumbnailSelector } from "@/components/editor/thumbnail-selector"
import { TextOverlayEditor, TextOverlay } from "@/components/editor/text-overlay-editor"

type Step = "upload" | "edit" | "details" | "posting"
type Game = { id: string; name: string; slug: string }

export default function CreateClipPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [gameId, setGameId] = useState("")
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [games, setGames] = useState<Game[]>([])
  
  // Editor state
  const [showCropper, setShowCropper] = useState(false)
  const [showThumbnailSelector, setShowThumbnailSelector] = useState(false)
  const [showTextEditor, setShowTextEditor] = useState(false)
  const [cropArea, setCropArea] = useState<Area | null>(null)
  const [customThumbnail, setCustomThumbnail] = useState<string | null>(null)
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([])
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch games on mount
  useEffect(() => {
    getGames().then((data) => setGames(data || []))
  }, [])

  // Create object URL when file changes
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setVideoUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file])

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file
      if (!selectedFile.type.startsWith("video/")) {
        setError("Please select a video file")
        return
      }
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError("File must be under 100MB")
        return
      }
      setFile(selectedFile)
      setStep("edit")
      setError(null)
      // Haptic feedback
      navigator.vibrate?.(10)
    }
  }

  // Toggle video playback
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  // Add tag
  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, "")
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag])
      setTagInput("")
    }
  }

  // Remove tag
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  // Handle post
  const handlePost = async () => {
    if (!file || !title.trim()) return

    setStep("posting")
    setUploading(true)
    setUploadProgress(10)

    try {
      // Upload file - create FormData as expected by the server action
      const formData = new FormData()
      formData.append("file", file)
      const uploadResult = await uploadMediaFile(formData)
      setUploadProgress(60)

      if (uploadResult.error) {
        setError(uploadResult.error)
        setStep("details")
        setUploading(false)
        return
      }

      setUploadProgress(80)

      // Create media entry
      const createResult = await createMedia({
        title: title.trim(),
        description: description.trim() || undefined,
        mediaType: "clip",
        sourceType: "upload",
        videoUrl: uploadResult.url,
        storagePath: uploadResult.storagePath,
        gameId: gameId || undefined,
        visibility,
        tags: tags.length > 0 ? tags : undefined,
      })

      setUploadProgress(100)

      if (createResult.error) {
        setError(createResult.error)
        setStep("details")
        setUploading(false)
        return
      }

      // Success - haptic feedback and redirect
      navigator.vibrate?.([50, 50, 50])
      
      setTimeout(() => {
        router.push(`/media/${createResult.media?.id}`)
      }, 500)
    } catch {
      setError("Upload failed. Please try again.")
      setStep("details")
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass-panel-darker sticky top-0 z-40 border-b border-border/30">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (step === "upload") {
                router.back()
              } else if (step === "edit") {
                setFile(null)
                setVideoUrl(null)
                setStep("upload")
              } else if (step === "details") {
                setStep("edit")
              }
            }}
          >
            <X className="h-5 w-5" />
          </Button>

          <h1 className="font-semibold">
            {step === "upload" && "Create Clip"}
            {step === "edit" && "Edit"}
            {step === "details" && "Details"}
            {step === "posting" && "Posting..."}
          </h1>

          <div className="w-10" />
        </div>

        {/* Progress indicator */}
        <div className="flex gap-1 px-4 pb-3">
          {["upload", "edit", "details"].map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                ["upload", "edit", "details", "posting"].indexOf(step) >= i
                  ? "bg-primary"
                  : "bg-muted"
              )}
            />
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 flex flex-col items-center justify-center p-6"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="glass-panel border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-12 flex flex-col items-center gap-4 transition-colors w-full max-w-sm"
              >
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-10 w-10 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-lg">Upload Video</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    MP4, WebM, MOV up to 100MB
                  </p>
                </div>
              </motion.button>

              {error && (
                <p className="text-destructive text-sm mt-4">{error}</p>
              )}

              <div className="mt-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Share your best plays with the community
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 2: Edit/Preview */}
          {step === "edit" && videoUrl && (
            <motion.div
              key="edit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              {/* Video preview */}
              <div className="relative aspect-[9/16] max-h-[50vh] bg-black mx-auto w-full max-w-sm">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  loop
                  playsInline
                  onClick={togglePlay}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />

                {/* Render text overlays preview */}
                {textOverlays.map((overlay) => (
                  <div
                    key={overlay.id}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${overlay.x}%`,
                      top: `${overlay.y}%`,
                      transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
                    }}
                  >
                    <div
                      className="px-3 py-1.5 rounded whitespace-nowrap"
                      style={{
                        fontSize: `${overlay.fontSize * 0.6}px`,
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
                      {overlay.text}
                    </div>
                  </div>
                ))}

                {/* Crop indicator badge */}
                {cropArea && (
                  <div className="absolute top-2 left-2 px-2 py-1 rounded bg-primary/80 text-xs font-medium text-primary-foreground flex items-center gap-1">
                    <Crop className="h-3 w-3" />
                    Cropped
                  </div>
                )}

                {/* Custom thumbnail indicator */}
                {customThumbnail && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded bg-emerald-500/80 text-xs font-medium text-white flex items-center gap-1">
                    <Image className="h-3 w-3" />
                    Custom Thumb
                  </div>
                )}

                {/* Play/pause overlay */}
                <AnimatePresence>
                  {!isPlaying && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/30"
                      onClick={togglePlay}
                    >
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play className="h-8 w-8 text-white fill-white ml-1" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Trim indicator */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="glass-panel rounded-lg p-2 flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 h-1 bg-muted rounded-full">
                      <div className="h-full w-full bg-primary rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Editor tools */}
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Edit Tools</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-col h-auto py-3 gap-1",
                      cropArea && "border-primary bg-primary/10"
                    )}
                    onClick={() => setShowCropper(true)}
                  >
                    <Crop className="h-5 w-5" />
                    <span className="text-xs">Crop</span>
                  </Button>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-col h-auto py-3 gap-1",
                      customThumbnail && "border-emerald-500 bg-emerald-500/10"
                    )}
                    onClick={() => setShowThumbnailSelector(true)}
                  >
                    <Image className="h-5 w-5" />
                    <span className="text-xs">Thumbnail</span>
                  </Button>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-col h-auto py-3 gap-1",
                      textOverlays.length > 0 && "border-blue-500 bg-blue-500/10"
                    )}
                    onClick={() => setShowTextEditor(true)}
                  >
                    <Type className="h-5 w-5" />
                    <span className="text-xs">Text ({textOverlays.length})</span>
                  </Button>
                </div>
              </div>

              {/* Continue button */}
              <div className="p-4 mt-auto">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setStep("details")}
                >
                  Continue
                  <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Details */}
          {step === "details" && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col p-4 space-y-6"
            >
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Give your clip a catchy title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  className="glass-panel border-0"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {title.length}/100
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What happened in this clip?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="glass-panel border-0 resize-none"
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Add tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          addTag()
                        }
                      }}
                      className="glass-panel border-0 pl-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={addTag}
                    disabled={!tagInput.trim() || tags.length >= 5}
                    className="glass-panel border-0"
                  >
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="glass-panel border-0 gap-1 pr-1"
                      >
                        #{tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:bg-muted rounded p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {5 - tags.length} tags remaining
                </p>
              </div>

              {/* Game */}
              <div className="space-y-2">
                <Label>Game</Label>
                <Select value={gameId} onValueChange={setGameId}>
                  <SelectTrigger className="glass-panel border-0">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select game" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {games.map((game) => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.name}
                      </SelectItem>
                    ))}
                    {games.length === 0 && (
                      <SelectItem value="" disabled>Loading games...</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Visibility */}
              <div className="space-y-2">
                <Label>Visibility</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "public", icon: Globe, label: "Public" },
                    { value: "unlisted", icon: Users, label: "Unlisted" },
                    { value: "private", icon: Lock, label: "Private" },
                  ].map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.value}
                        onClick={() => setVisibility(option.value as typeof visibility)}
                        className={cn(
                          "glass-panel rounded-lg p-3 flex flex-col items-center gap-1 transition-all",
                          visibility === option.value
                            ? "ring-2 ring-primary bg-primary/10"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs">{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {error && (
                <p className="text-destructive text-sm">{error}</p>
              )}

              {/* Post button */}
              <div className="mt-auto pt-4">
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={handlePost}
                  disabled={!title.trim() || uploading}
                >
                  <Sparkles className="h-5 w-5" />
                  Post Clip
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Posting */}
          {step === "posting" && (
            <motion.div
              key="posting"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center p-6"
            >
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                {uploadProgress < 100 ? (
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                ) : (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <Check className="h-12 w-12 text-primary" />
                  </motion.div>
                )}
              </div>

              <p className="font-semibold text-lg mb-2">
                {uploadProgress < 100 ? "Uploading your clip..." : "Posted!"}
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-xs">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center mt-2">
                  {uploadProgress}%
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <MobileNavSpacer />

      {/* Editor Overlays */}
      <AnimatePresence>
        {showCropper && videoUrl && (
          <VideoCropper
            videoUrl={videoUrl}
            onCropComplete={(area) => {
              setCropArea(area)
              setShowCropper(false)
            }}
            onCancel={() => setShowCropper(false)}
          />
        )}

        {showThumbnailSelector && videoUrl && (
          <ThumbnailSelector
            videoUrl={videoUrl}
            onSelect={(thumbnail) => {
              setCustomThumbnail(thumbnail)
              setShowThumbnailSelector(false)
            }}
            onCancel={() => setShowThumbnailSelector(false)}
          />
        )}

        {showTextEditor && videoUrl && (
          <TextOverlayEditor
            videoUrl={videoUrl}
            overlays={textOverlays}
            onOverlaysChange={setTextOverlays}
            onComplete={() => setShowTextEditor(false)}
            onCancel={() => setShowTextEditor(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
