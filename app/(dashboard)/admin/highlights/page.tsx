"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Sparkles,
  Play,
  Clock,
  Trophy,
  Zap,
  Target,
  Users,
  RefreshCw,
  CheckCircle,
  XCircle,
  Edit,
  Film,
  TrendingUp,
  Star,
  Scissors,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface HighlightCandidate {
  id: string
  match_id: string
  timestamp_seconds: number
  duration_seconds: number
  highlight_type: string
  confidence: number
  description: string
  title_suggestion: string
  status: "pending" | "approved" | "rejected" | "clipped"
  created_at: string
  match?: {
    player1_name?: string
    player2_name?: string
    tournament_name?: string
    game_name?: string
  }
}

const typeIcons: Record<string, typeof Sparkles> = {
  clutch_play: Target,
  comeback: TrendingUp,
  upset: Zap,
  skill_display: Star,
  crowd_moment: Users,
  hype_moment: Sparkles,
  close_finish: Trophy,
}

const typeLabels: Record<string, string> = {
  clutch_play: "Clutch Play",
  comeback: "Comeback",
  upset: "Upset",
  skill_display: "Skill Display",
  crowd_moment: "Crowd Moment",
  hype_moment: "Hype Moment",
  close_finish: "Close Finish",
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function HighlightCard({
  highlight,
  onApprove,
  onReject,
  onEdit,
  onCreateClip,
}: {
  highlight: HighlightCandidate
  onApprove: () => void
  onReject: () => void
  onEdit: () => void
  onCreateClip: () => void
}) {
  const Icon = typeIcons[highlight.highlight_type] || Sparkles
  const confidenceColor = 
    highlight.confidence >= 0.8 ? "text-green-500" :
    highlight.confidence >= 0.6 ? "text-yellow-500" : "text-orange-500"
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass-panel rounded-lg overflow-hidden border border-border/30"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <Badge variant="secondary" className="text-xs">
                {typeLabels[highlight.highlight_type] || highlight.highlight_type}
              </Badge>
              <p className={cn("text-xs mt-1", confidenceColor)}>
                {Math.round(highlight.confidence * 100)}% confidence
              </p>
            </div>
          </div>
          <Badge 
            variant={
              highlight.status === "pending" ? "secondary" :
              highlight.status === "approved" ? "default" :
              highlight.status === "clipped" ? "default" : "destructive"
            }
            className={highlight.status === "clipped" ? "bg-green-500" : ""}
          >
            {highlight.status}
          </Badge>
        </div>
        
        {/* Title suggestion */}
        <h3 className="font-medium text-sm mb-2 line-clamp-2">
          {highlight.title_suggestion}
        </h3>
        
        {/* Description */}
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {highlight.description}
        </p>
        
        {/* Match info */}
        {highlight.match && (
          <div className="text-xs text-muted-foreground mb-3 p-2 bg-muted/30 rounded">
            <p className="font-medium">
              {highlight.match.player1_name || "Player 1"} vs {highlight.match.player2_name || "Player 2"}
            </p>
            <p className="opacity-75">
              {highlight.match.tournament_name} - {highlight.match.game_name}
            </p>
          </div>
        )}
        
        {/* Timing info */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatTimestamp(highlight.timestamp_seconds)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Film className="h-3 w-3" />
            <span>{highlight.duration_seconds}s duration</span>
          </div>
        </div>
        
        {/* Confidence bar */}
        <div className="mt-3">
          <Progress value={highlight.confidence * 100} className="h-1" />
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-1 p-2 border-t border-border/30 bg-muted/20">
        {highlight.status === "pending" && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-green-500 hover:bg-green-500/10 hover:text-green-500"
              onClick={onApprove}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onReject}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </>
        )}
        {highlight.status === "approved" && (
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            onClick={onCreateClip}
          >
            <Scissors className="h-4 w-4 mr-1" />
            Create Clip
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={onEdit}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
}

export default function HighlightsAdminPage() {
  const [highlights, setHighlights] = useState<HighlightCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected" | "clipped">("pending")
  const [editHighlight, setEditHighlight] = useState<HighlightCandidate | null>(null)
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    timestamp: 0,
    duration: 30,
  })
  
  const fetchHighlights = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from("highlight_candidates")
      .select("*")
      .eq("status", activeTab)
      .order("confidence", { ascending: false })
      .limit(50)
    
    if (error) {
      // Table might not exist
      console.error("Failed to fetch highlights:", error)
      setHighlights([])
    } else {
      setHighlights(data || [])
    }
    
    setLoading(false)
  }, [activeTab])
  
  useEffect(() => {
    fetchHighlights()
  }, [fetchHighlights])
  
  const processNewHighlights = async () => {
    setProcessing(true)
    try {
      const response = await fetch("/api/highlights/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(`Processed ${result.processed} matches, found ${result.highlights_found} highlights`)
        fetchHighlights()
      } else {
        toast.error("Failed to process highlights")
      }
    } catch {
      toast.error("Error processing highlights")
    }
    setProcessing(false)
  }
  
  const updateHighlightStatus = async (id: string, status: string) => {
    const supabase = createClient()
    
    const { error } = await supabase
      .from("highlight_candidates")
      .update({ status })
      .eq("id", id)
    
    if (error) {
      toast.error("Failed to update highlight")
      return
    }
    
    setHighlights(prev => prev.filter(h => h.id !== id))
    toast.success(`Highlight ${status}`)
  }
  
  const handleEdit = (highlight: HighlightCandidate) => {
    setEditHighlight(highlight)
    setEditForm({
      title: highlight.title_suggestion,
      description: highlight.description,
      timestamp: highlight.timestamp_seconds,
      duration: highlight.duration_seconds,
    })
  }
  
  const saveEdit = async () => {
    if (!editHighlight) return
    
    const supabase = createClient()
    
    const { error } = await supabase
      .from("highlight_candidates")
      .update({
        title_suggestion: editForm.title,
        description: editForm.description,
        timestamp_seconds: editForm.timestamp,
        duration_seconds: editForm.duration,
      })
      .eq("id", editHighlight.id)
    
    if (error) {
      toast.error("Failed to update highlight")
      return
    }
    
    setHighlights(prev => prev.map(h => 
      h.id === editHighlight.id 
        ? { ...h, title_suggestion: editForm.title, description: editForm.description, timestamp_seconds: editForm.timestamp, duration_seconds: editForm.duration }
        : h
    ))
    
    setEditHighlight(null)
    toast.success("Highlight updated")
  }
  
  const stats = {
    pending: highlights.filter(h => h.status === "pending").length,
    approved: highlights.filter(h => h.status === "approved").length,
    avgConfidence: highlights.length > 0 
      ? Math.round(highlights.reduce((sum, h) => sum + h.confidence, 0) / highlights.length * 100)
      : 0,
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">AI Highlights</h1>
            <p className="text-muted-foreground">Review AI-detected highlight candidates</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchHighlights} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={processNewHighlights} disabled={processing}>
            {processing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Process Matches
          </Button>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="glass-panel border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-500 mt-1">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 opacity-50 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Ready to Clip</p>
                <p className="text-2xl font-bold text-green-500 mt-1">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 opacity-50 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Confidence</p>
                <p className="text-2xl font-bold text-primary mt-1">{stats.avgConfidence}%</p>
              </div>
              <Target className="h-8 w-8 opacity-50 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Approved
          </TabsTrigger>
          <TabsTrigger value="clipped" className="gap-2">
            <Scissors className="h-4 w-4" />
            Clipped
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4" />
            Rejected
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : highlights.length === 0 ? (
            <div className="glass-panel rounded-xl p-16 text-center">
              <Sparkles className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium">No {activeTab} highlights</p>
              <p className="text-muted-foreground mt-1">
                {activeTab === "pending" 
                  ? "Click 'Process Matches' to detect new highlights" 
                  : `No ${activeTab} highlights to display`}
              </p>
              {activeTab === "pending" && (
                <Button onClick={processNewHighlights} className="mt-4" disabled={processing}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Process Matches
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {highlights.map((highlight) => (
                  <HighlightCard
                    key={highlight.id}
                    highlight={highlight}
                    onApprove={() => updateHighlightStatus(highlight.id, "approved")}
                    onReject={() => updateHighlightStatus(highlight.id, "rejected")}
                    onEdit={() => handleEdit(highlight)}
                    onCreateClip={() => {
                      toast.info("Clip creation feature coming soon!")
                      updateHighlightStatus(highlight.id, "clipped")
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Edit Dialog */}
      <Dialog open={!!editHighlight} onOpenChange={() => setEditHighlight(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Highlight</DialogTitle>
            <DialogDescription>
              Adjust the highlight details before creating a clip
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input 
                value={editForm.title} 
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea 
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Timestamp (seconds)</Label>
                <Input 
                  type="number"
                  value={editForm.timestamp}
                  onChange={(e) => setEditForm(prev => ({ ...prev, timestamp: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label>Duration (seconds)</Label>
                <Input 
                  type="number"
                  value={editForm.duration}
                  onChange={(e) => setEditForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 30 }))}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditHighlight(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
