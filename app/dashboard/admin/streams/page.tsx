"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  MoreHorizontal,
  Tv,
  Eye,
  Trash2,
  Edit2,
  Star,
  Power,
  ExternalLink,
  Youtube,
  Twitch,
} from "lucide-react"
import {
  createStreamSource,
  updateStreamSource,
  deleteStreamSource,
  toggleStreamSourceActive,
  toggleStreamSourceFeatured,
  toggleStreamSourceLive,
  type StreamSource,
  type CreateStreamSourceInput,
} from "@/lib/stream-sources-actions"

const fetcher = (url: string) => fetch(url).then(res => res.json())

const PLATFORMS = [
  { value: "twitch", label: "Twitch", icon: Twitch },
  { value: "youtube", label: "YouTube", icon: Youtube },
  { value: "kick", label: "Kick", icon: Tv },
  { value: "custom", label: "Custom RTMP", icon: Tv },
]

const CATEGORIES = [
  { value: "top_streamer", label: "Top Streamer" },
  { value: "sponsored", label: "Sponsored" },
  { value: "organization", label: "Organization" },
  { value: "community", label: "Community" },
]

export default function StreamSourcesAdminPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<StreamSource | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState<CreateStreamSourceInput>({
    title: "",
    description: "",
    platform: "twitch",
    channel_url: "",
    category: "community",
    priority: 50,
  })

  const { data, error, mutate } = useSWR<{ data: StreamSource[] }>(
    "/api/admin/stream-sources",
    fetcher
  )

  const sources = data?.data || []

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      platform: "twitch",
      channel_url: "",
      category: "community",
      priority: 50,
    })
    setEditingSource(null)
  }

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)
    
    try {
      let result
      if (editingSource) {
        result = await updateStreamSource(editingSource.id, formData)
      } else {
        result = await createStreamSource(formData)
      }
      
      if (result.error) {
        setErrorMessage(result.error)
        console.error("Error from server:", result.error)
        return
      }
      
      mutate()
      setIsAddDialogOpen(false)
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save stream source"
      setErrorMessage(message)
      console.error("Error saving stream source:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this stream source?")) return
    
    await deleteStreamSource(id)
    mutate()
  }

  const handleToggleActive = async (id: string, current: boolean) => {
    await toggleStreamSourceActive(id, !current)
    mutate()
  }

  const handleToggleFeatured = async (id: string, current: boolean) => {
    await toggleStreamSourceFeatured(id, !current)
    mutate()
  }

  const handleToggleLive = async (id: string, current: boolean) => {
    await toggleStreamSourceLive(id, !current)
    mutate()
  }

  const handleEdit = (source: StreamSource) => {
    setFormData({
      title: source.title,
      description: source.description || "",
      platform: source.platform,
      channel_url: source.channel_url,
      category: source.category,
      priority: source.priority,
      is_featured: source.is_featured,
      contact_email: source.contact_email || "",
    })
    setEditingSource(source)
    setIsAddDialogOpen(true)
  }

  const getPlatformIcon = (platform: string) => {
    const p = PLATFORMS.find(p => p.value === platform)
    return p ? <p.icon className="h-4 w-4" /> : <Tv className="h-4 w-4" />
  }

  return (
    <div className="container py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stream Sources</h1>
          <p className="text-muted-foreground mt-1">
            Manage external streams to display on the platform
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Stream Source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingSource ? "Edit Stream Source" : "Add Stream Source"}
              </DialogTitle>
              <DialogDescription>
                Add a Twitch, YouTube, or custom stream to display on the platform
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Top MTG Streamer - ChannelFireball"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="platform">Platform</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(value: any) => setFormData({ ...formData, platform: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center gap-2">
                          <p.icon className="h-4 w-4" />
                          {p.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="channel_url">Channel URL</Label>
                <Input
                  id="channel_url"
                  placeholder={
                    formData.platform === "twitch" 
                      ? "https://twitch.tv/channelname" 
                      : formData.platform === "youtube"
                      ? "https://youtube.com/watch?v=... or /live/..."
                      : "https://..."
                  }
                  value={formData.channel_url}
                  onChange={(e) => setFormData({ ...formData, channel_url: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this stream source"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority (1-100)</Label>
                <Input
                  id="priority"
                  type="number"
                  min={1}
                  max={100}
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 50 })}
                />
                <p className="text-xs text-muted-foreground">
                  Higher priority streams are shown first
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="contact_email">Contact Email (optional)</Label>
                <Input
                  id="contact_email"
                  type="email"
                  placeholder="contact@example.com"
                  value={formData.contact_email || ""}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                />
              </div>
            </div>
            
            <DialogFooter className="flex-col gap-3 sm:flex-row">
              {errorMessage && (
                <div className="w-full p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {errorMessage}
                </div>
              )}
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || !formData.title || !formData.channel_url}>
                  {isSubmitting ? "Saving..." : editingSource ? "Save Changes" : "Add Source"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sources.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Currently Live
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {sources.filter(s => s.is_live).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sources.filter(s => s.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Featured
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {sources.filter(s => s.is_featured).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stream Sources</CardTitle>
          <CardDescription>
            External streams from Twitch, YouTube, and other platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <div className="text-center py-12">
              <Tv className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Stream Sources Yet</h3>
              <p className="text-muted-foreground mb-4">
                Add external streams from Twitch, YouTube, or other platforms
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Source
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Viewers</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="font-medium flex items-center gap-2">
                            {source.title}
                            {source.is_featured && (
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            )}
                          </span>
                          {source.stream_title && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {source.stream_title}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(source.platform)}
                        <span className="capitalize">{source.platform}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {source.category.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {source.is_live ? (
                          <Badge variant="destructive" className="gap-1">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                            </span>
                            LIVE
                          </Badge>
                        ) : source.is_active ? (
                          <Badge variant="secondary">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {source.is_live && source.viewer_count > 0 && (
                        <div className="flex items-center gap-1 text-sm">
                          <Eye className="h-3 w-3" />
                          {source.viewer_count.toLocaleString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{source.priority}</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(source)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(source.id, source.is_active)}>
                            <Power className="h-4 w-4 mr-2" />
                            {source.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleFeatured(source.id, source.is_featured)}>
                            <Star className="h-4 w-4 mr-2" />
                            {source.is_featured ? "Unfeature" : "Feature"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleLive(source.id, source.is_live)}>
                            <Radio className="h-4 w-4 mr-2" />
                            {source.is_live ? "Mark Offline" : "Mark Live"}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={source.channel_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open Channel
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(source.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
