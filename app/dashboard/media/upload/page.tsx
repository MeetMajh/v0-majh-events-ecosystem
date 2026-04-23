"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Upload, X, Film, FileVideo, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type UploadStatus = "idle" | "uploading" | "processing" | "complete" | "error"

interface UploadFile {
  file: File
  preview: string
  status: UploadStatus
  progress: number
  url?: string
  error?: string
}

export default function MediaUploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("highlight")
  const [visibility, setVisibility] = useState("public")
  const [isUploading, setIsUploading] = useState(false)
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: file.type.startsWith("image/") || file.type.startsWith("video/")
        ? URL.createObjectURL(file)
        : "",
      status: "idle" as UploadStatus,
      progress: 0
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "video/*": [".mp4", ".webm", ".mov"]
    },
    maxSize: 50 * 1024 * 1024, // 50MB for Supabase
  })

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev]
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview)
      }
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const uploadFile = async (uploadFile: UploadFile, index: number) => {
    setFiles(prev => {
      const newFiles = [...prev]
      newFiles[index] = { ...newFiles[index], status: "uploading", progress: 10 }
      return newFiles
    })

    try {
      // Build form data for API
      const formData = new FormData()
      formData.append("file", uploadFile.file)
      formData.append("title", title || uploadFile.file.name)
      formData.append("description", description)
      formData.append("category", category)
      formData.append("visibility", visibility)
      
      // Add scheduled date if set
      if (scheduledDate && scheduledTime) {
        const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)
        formData.append("scheduled_live_at", scheduledAt.toISOString())
      }

      setFiles(prev => {
        const newFiles = [...prev]
        newFiles[index] = { ...newFiles[index], progress: 30 }
        return newFiles
      })

      // Upload via API (uses Vercel Blob)
      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      })

      setFiles(prev => {
        const newFiles = [...prev]
        newFiles[index] = { ...newFiles[index], progress: 70 }
        return newFiles
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Upload failed")
      }

      setFiles(prev => {
        const newFiles = [...prev]
        newFiles[index] = { 
          ...newFiles[index], 
          status: "complete", 
          progress: 100,
          url: result.url 
        }
        return newFiles
      })

      if (result.scheduledLiveAt) {
        toast.success(`Scheduled ${uploadFile.file.name} to go live at ${new Date(result.scheduledLiveAt).toLocaleString()}`)
      } else if (result.isLive) {
        toast.success(`${uploadFile.file.name} is now live!`)
      } else {
        toast.success(`Uploaded ${uploadFile.file.name}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed"
      setFiles(prev => {
        const newFiles = [...prev]
        newFiles[index] = { 
          ...newFiles[index], 
          status: "error", 
          error: errorMessage
        }
        return newFiles
      })
      toast.error(errorMessage)
    }
  }

  const handleUploadAll = async () => {
    if (files.length === 0) return
    
    setIsUploading(true)
    
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "idle" || files[i].status === "error") {
        await uploadFile(files[i], i)
      }
    }
    
    setIsUploading(false)
  }

  const pendingFiles = files.filter(f => f.status === "idle" || f.status === "error")
  const pendingCount = pendingFiles.length
  const hasIdleFiles = pendingCount > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Media</h1>
        <p className="text-muted-foreground">Upload clips, highlights, and images to your library</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Files</CardTitle>
              <CardDescription>Drag and drop or click to select files to upload</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragActive 
                    ? "border-primary bg-primary/5" 
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">
                  Drag &amp; drop files here, or click to select
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports: MP4, WebM, MOV, PNG, JPG, GIF (max 50MB)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* File List */}
          {files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Files ({files.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {files.map((uploadFile, index) => (
                    <div
                      key={`${uploadFile.file.name}-${index}`}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                    >
                      {/* Preview */}
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {uploadFile.file.type.startsWith("image/") && uploadFile.preview ? (
                          <img
                            src={uploadFile.preview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : uploadFile.file.type.startsWith("video/") ? (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <FileVideo className="h-8 w-8 text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{uploadFile.file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(uploadFile.file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        
                        {uploadFile.status === "uploading" && (
                          <Progress value={uploadFile.progress} className="h-1 mt-2" />
                        )}
                        
                        {uploadFile.status === "error" && (
                          <p className="text-sm text-destructive mt-1">{uploadFile.error}</p>
                        )}
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2">
                        {uploadFile.status === "complete" && (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        {uploadFile.status === "error" && (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        )}
                        {uploadFile.status === "uploading" && (
                          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        )}
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                          disabled={uploadFile.status === "uploading"}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Settings Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Add metadata to your uploads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Epic combo finish"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your clip..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="highlight">Highlight</SelectItem>
                    <SelectItem value="tournament">Tournament</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="funny">Funny Moment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public (Go Live Immediately)</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Schedule for later */}
              <div className="space-y-2 pt-4 border-t border-border">
                <Label className="text-sm font-medium">Schedule for Later (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Set a date and time for your content to go live
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
                {scheduledDate && scheduledTime && (
                  <p className="text-xs text-primary">
                    Will go live: {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={handleUploadAll}
            disabled={!hasIdleFiles || isUploading}
          >
            {isUploading ? (
              <>
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {pendingCount} File{pendingCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
