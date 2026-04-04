"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Link2,
  Upload,
  Youtube,
  Tv,
  AlertCircle,
  CheckCircle,
  Loader2,
  Play,
  Image as ImageIcon,
} from "lucide-react"
import { createMedia } from "@/lib/media-actions"
import { extractVideoId, generateThumbnailUrl, type MediaType, type SourceType } from "@/lib/media-utils"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"

interface MediaUploadFormProps {
  trigger?: React.ReactNode
  onSuccess?: (mediaId: string) => void
  defaultGameId?: string
  defaultTournamentId?: string
  defaultMatchId?: string
}

interface Game {
  id: string
  name: string
}

export function MediaUploadForm({
  trigger,
  onSuccess,
  defaultGameId,
  defaultTournamentId,
  defaultMatchId,
}: MediaUploadFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  // Form state
  const [uploadMethod, setUploadMethod] = useState<"url" | "upload">("url")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [mediaType, setMediaType] = useState<MediaType>("clip")
  const [gameId, setGameId] = useState(defaultGameId || "")
  const [tournamentId] = useState(defaultTournamentId || "")
  const [matchId] = useState(defaultMatchId || "")
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public")
  
  // File upload state
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  // URL validation
  const [urlValid, setUrlValid] = useState<boolean | null>(null)
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  
  // Games list
  const [games, setGames] = useState<Game[]>([])
  
  useEffect(() => {
    async function loadGames() {
      const supabase = createClient()
      const { data } = await supabase
        .from("games")
        .select("id, name")
        .order("name")
      setGames(data || [])
    }
    loadGames()
  }, [])
  
  // Validate URL on change
  useEffect(() => {
    if (!videoUrl) {
      setUrlValid(null)
      setDetectedPlatform(null)
      setThumbnailPreview(null)
      return
    }
    
    const extracted = extractVideoId(videoUrl)
    if (extracted) {
      setUrlValid(true)
      setDetectedPlatform(extracted.platform)
      const thumbnail = generateThumbnailUrl(videoUrl)
      setThumbnailPreview(thumbnail)
    } else {
      setUrlValid(false)
      setDetectedPlatform(null)
      setThumbnailPreview(null)
    }
  }, [videoUrl])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setUploadProgress(0)
    
    try {
      let finalVideoUrl = videoUrl
      let storagePath: string | undefined
      
      // Handle file upload
      if (uploadMethod === "upload" && file) {
        setUploadProgress(10)
        
        // Upload file via API route (server actions can't handle File objects)
        const formData = new FormData()
        formData.append("file", file)
        
        const uploadResponse = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
        })
        
        const uploadResult = await uploadResponse.json()
        
        if (!uploadResponse.ok || uploadResult.error) {
          setError(uploadResult.error || "Upload failed")
          setLoading(false)
          return
        }
        
        finalVideoUrl = uploadResult.url || ""
        storagePath = uploadResult.storagePath
        setUploadProgress(50)
      }
      
      setUploadProgress(70)
      
      const result = await createMedia({
        title,
        description: description || undefined,
        mediaType,
        sourceType: uploadMethod === "url" ? (detectedPlatform as SourceType || "external") : "upload",
        videoUrl: finalVideoUrl || undefined,
        storagePath,
        gameId: gameId || undefined,
        tournamentId: tournamentId || undefined,
        matchId: matchId || undefined,
        visibility,
        thumbnailUrl: thumbnailPreview || undefined,
      })
      
      setUploadProgress(100)
      
      if (result.error) {
        setError(result.error)
        return
      }
      
      setSuccess(true)
      
      setTimeout(() => {
        setOpen(false)
        if (result.media) {
          onSuccess?.(result.media.id)
          router.push(`/media/${result.media.id}`)
        }
      }, 1500)
    } catch (err) {
      console.error("[v0] Upload error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }
  
  const resetForm = () => {
    setTitle("")
    setDescription("")
    setVideoUrl("")
    setMediaType("clip")
    setGameId(defaultGameId || "")
    setVisibility("public")
    setError(null)
    setSuccess(false)
    setUrlValid(null)
    setDetectedPlatform(null)
    setThumbnailPreview(null)
    setFile(null)
    setUploadProgress(0)
  }
  
  const getPlatformIcon = () => {
    switch (detectedPlatform) {
      case "youtube": return <Youtube className="h-4 w-4 text-red-500" />
      case "twitch": return <Tv className="h-4 w-4 text-purple-500" />
      default: return <Link2 className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm() }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Media
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
          <DialogDescription>
            Share your clips, highlights, and gameplay with the community
          </DialogDescription>
        </DialogHeader>
        
        {success ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="mb-4 h-12 w-12 text-green-500" />
            <p className="text-lg font-medium">Media uploaded successfully!</p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {/* Upload Method */}
            <Tabs value={uploadMethod} onValueChange={(v) => setUploadMethod(v as "url" | "upload")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url" className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Video URL
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload File
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="url" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="videoUrl">Video URL</Label>
                  <div className="relative">
                    <Input
                      id="videoUrl"
                      placeholder="https://youtube.com/watch?v=... or https://twitch.tv/..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      className="pr-10"
                    />
                    {urlValid !== null && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {urlValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    )}
                  </div>
                  {detectedPlatform && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {getPlatformIcon()}
                      <span>Detected: {detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Supported: YouTube, Twitch, Kick
                  </p>
                </div>
                
                {/* Thumbnail preview */}
                {thumbnailPreview && (
                  <Card>
                    <CardContent className="p-3">
                      <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
                        <Image
                          src={thumbnailPreview}
                          alt="Video thumbnail"
                          fill
                          className="object-cover"
                        />
                        <div className="absolute bottom-2 left-2">
                          <Badge variant="secondary" className="gap-1">
                            <ImageIcon className="h-3 w-3" />
                            Auto-detected thumbnail
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="upload" className="mt-4 space-y-4">
                <Card className="border-dashed glass-panel border-0">
                  <CardContent className="py-8">
                    {file ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                            <Play className="h-8 w-8 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFile(null)}
                          >
                            Remove
                          </Button>
                        </div>
                        {uploadProgress > 0 && uploadProgress < 100 && (
                          <div className="space-y-2">
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div 
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                              Uploading... {uploadProgress}%
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center justify-center">
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          className="hidden"
                          onChange={(e) => {
                            const selectedFile = e.target.files?.[0]
                            if (selectedFile) {
                              setFile(selectedFile)
                            }
                          }}
                        />
                        <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                        <p className="font-medium">Drop your video here or click to browse</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          MP4, WebM, MOV up to 100MB
                        </p>
                      </label>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Give your clip a catchy title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />
              <p className="text-xs text-muted-foreground">{title.length}/200 characters</p>
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add context about your clip (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Media Type */}
              <div className="space-y-2">
                <Label>Content Type *</Label>
                <Select value={mediaType} onValueChange={(v) => setMediaType(v as MediaType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clip">Clip (15-60 sec)</SelectItem>
                    <SelectItem value="highlight">Highlight Reel</SelectItem>
                    <SelectItem value="vod">VOD / Stream</SelectItem>
                    <SelectItem value="full_match">Full Match</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Game */}
              <div className="space-y-2">
                <Label>Game *</Label>
                <Select value={gameId} onValueChange={setGameId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a game" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map((game) => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Visibility */}
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public - Anyone can see</SelectItem>
                  <SelectItem value="unlisted">Unlisted - Only with link</SelectItem>
                  <SelectItem value="private">Private - Only you</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Guidelines reminder */}
            <Alert>
              <Play className="h-4 w-4" />
              <AlertDescription>
                All content must be related to gaming/esports. No NSFW, hate speech, or spam.
                Content may be reviewed before publishing.
              </AlertDescription>
            </Alert>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || !title || !gameId || (uploadMethod === "url" && !urlValid) || (uploadMethod === "upload" && !file)}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
