"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Play,
  User,
  Trash2,
  Ban,
  Eye,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import {
  getFlaggedContent,
  getModerationStats,
  approveContent,
  rejectContent,
  deleteContent,
  type FlaggedContent,
  type ModerationStats,
} from "@/lib/moderation-actions"
import { toast } from "sonner"

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = "default" 
}: { 
  title: string
  value: number
  icon: typeof Shield
  variant?: "default" | "success" | "warning" | "destructive"
}) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-green-500",
    warning: "text-yellow-500",
    destructive: "text-destructive",
  }
  
  return (
    <Card className="glass-panel border-border/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={cn("text-2xl font-bold mt-1", variantStyles[variant])}>
              {value}
            </p>
          </div>
          <Icon className={cn("h-8 w-8 opacity-50", variantStyles[variant])} />
        </div>
      </CardContent>
    </Card>
  )
}

function ContentCard({
  content,
  onApprove,
  onReject,
  onDelete,
  onPreview,
}: {
  content: FlaggedContent
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
  onPreview: () => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  
  const handleAction = async (action: () => Promise<void>) => {
    setIsLoading(true)
    try {
      await action()
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass-panel rounded-lg overflow-hidden border border-border/30"
    >
      {/* Thumbnail */}
      <div 
        className="relative aspect-video bg-muted/50 cursor-pointer group"
        onClick={onPreview}
      >
        {content.thumbnail_url ? (
          <Image
            src={content.thumbnail_url}
            alt={content.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Eye className="h-8 w-8 text-white" />
        </div>
        
        {/* Status badge */}
        <div className="absolute top-2 left-2">
          <Badge 
            variant={
              content.moderation_status === "pending" ? "secondary" :
              content.moderation_status === "approved" ? "default" : "destructive"
            }
          >
            {content.moderation_status}
          </Badge>
        </div>
        
        {content.is_flagged && (
          <div className="absolute top-2 right-2">
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Flagged
            </Badge>
          </div>
        )}
      </div>
      
      {/* Content info */}
      <div className="p-3">
        <h3 className="font-medium text-sm line-clamp-1">{content.title}</h3>
        
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            {content.user_avatar ? (
              <Image
                src={content.user_avatar}
                alt=""
                width={16}
                height={16}
                className="rounded-full"
              />
            ) : (
              <User className="h-4 w-4" />
            )}
            <span>{content.user_name || "Unknown"}</span>
          </div>
          <span className="opacity-50">|</span>
          <Clock className="h-3 w-3" />
          <span>{new Date(content.created_at).toLocaleDateString()}</span>
        </div>
        
        {content.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {content.description}
          </p>
        )}
        
        {/* Flags */}
        {content.flags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {content.flags.map((flag, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {flag}
              </Badge>
            ))}
          </div>
        )}
        
        {/* AI confidence */}
        {content.confidence !== null && (
          <div className="mt-2 text-xs">
            <span className="text-muted-foreground">AI Confidence: </span>
            <span className={cn(
              "font-medium",
              content.confidence > 0.8 ? "text-green-500" :
              content.confidence > 0.5 ? "text-yellow-500" : "text-red-500"
            )}>
              {Math.round(content.confidence * 100)}%
            </span>
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex gap-1 p-2 border-t border-border/30 bg-muted/20">
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 text-green-500 hover:bg-green-500/10 hover:text-green-500"
          disabled={isLoading}
          onClick={() => handleAction(async () => { onApprove() })}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={isLoading}
          onClick={() => handleAction(async () => { onReject() })}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Reject
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          disabled={isLoading}
          onClick={() => handleAction(async () => { onDelete() })}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
}

export default function ModerationDashboard() {
  const [content, setContent] = useState<FlaggedContent[]>([])
  const [stats, setStats] = useState<ModerationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending")
  const [previewContent, setPreviewContent] = useState<FlaggedContent | null>(null)
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; contentId: string | null }>({
    open: false,
    contentId: null,
  })
  const [rejectReason, setRejectReason] = useState("")
  
  const fetchData = useCallback(async () => {
    setLoading(true)
    const [contentData, statsData] = await Promise.all([
      getFlaggedContent({ status: activeTab }),
      getModerationStats(),
    ])
    setContent(contentData)
    setStats(statsData)
    setLoading(false)
  }, [activeTab])
  
  useEffect(() => {
    fetchData()
  }, [fetchData])
  
  const handleApprove = async (contentId: string) => {
    try {
      await approveContent(contentId)
      setContent(prev => prev.filter(c => c.id !== contentId))
      toast.success("Content approved")
    } catch {
      toast.error("Failed to approve content")
    }
  }
  
  const handleReject = async (contentId: string, reason?: string) => {
    try {
      await rejectContent(contentId, "media", reason)
      setContent(prev => prev.filter(c => c.id !== contentId))
      toast.success("Content rejected")
    } catch {
      toast.error("Failed to reject content")
    }
  }
  
  const handleDelete = async (contentId: string) => {
    if (!confirm("Are you sure you want to permanently delete this content?")) return
    
    try {
      await deleteContent(contentId)
      setContent(prev => prev.filter(c => c.id !== contentId))
      toast.success("Content deleted")
    } catch {
      toast.error("Failed to delete content")
    }
  }
  
  const openRejectDialog = (contentId: string) => {
    setRejectDialog({ open: true, contentId })
    setRejectReason("")
  }
  
  const confirmReject = async () => {
    if (rejectDialog.contentId) {
      await handleReject(rejectDialog.contentId, rejectReason)
      setRejectDialog({ open: false, contentId: null })
    }
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Content Moderation</h1>
            <p className="text-muted-foreground">Review and manage flagged content</p>
          </div>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Pending Review"
            value={stats.total_pending}
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Approved Today"
            value={stats.total_approved_today}
            icon={CheckCircle}
            variant="success"
          />
          <StatCard
            title="Rejected Today"
            value={stats.total_rejected_today}
            icon={XCircle}
            variant="destructive"
          />
          <StatCard
            title="AI Flagged"
            value={stats.flagged_by_ai}
            icon={AlertTriangle}
            variant="warning"
          />
        </div>
      )}
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending
            {stats && stats.total_pending > 0 && (
              <Badge variant="secondary" className="ml-1">{stats.total_pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Approved
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
          ) : content.length === 0 ? (
            <div className="glass-panel rounded-xl p-16 text-center">
              <Shield className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium">No {activeTab} content</p>
              <p className="text-muted-foreground mt-1">
                {activeTab === "pending" 
                  ? "All content has been reviewed" 
                  : `No ${activeTab} content to display`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {content.map((item) => (
                  <ContentCard
                    key={item.id}
                    content={item}
                    onApprove={() => handleApprove(item.id)}
                    onReject={() => openRejectDialog(item.id)}
                    onDelete={() => handleDelete(item.id)}
                    onPreview={() => setPreviewContent(item)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Preview Dialog */}
      <Dialog open={!!previewContent} onOpenChange={() => setPreviewContent(null)}>
        <DialogContent className="max-w-4xl">
          {previewContent && (
            <>
              <DialogHeader>
                <DialogTitle>{previewContent.title}</DialogTitle>
                <DialogDescription>
                  Uploaded by {previewContent.user_name} on{" "}
                  {new Date(previewContent.created_at).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>
              
              <div className="aspect-video relative bg-black rounded-lg overflow-hidden">
                {previewContent.video_url ? (
                  <iframe
                    src={previewContent.video_url}
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                  />
                ) : previewContent.thumbnail_url ? (
                  <Image
                    src={previewContent.thumbnail_url}
                    alt={previewContent.title}
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No preview available</p>
                  </div>
                )}
              </div>
              
              {previewContent.description && (
                <p className="text-sm text-muted-foreground">
                  {previewContent.description}
                </p>
              )}
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPreviewContent(null)}
                >
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    openRejectDialog(previewContent.id)
                    setPreviewContent(null)
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    handleApprove(previewContent.id)
                    setPreviewContent(null)
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Reject Reason Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => !open && setRejectDialog({ open: false, contentId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Content</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this content (optional)
            </DialogDescription>
          </DialogHeader>
          
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ open: false, contentId: null })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              Reject Content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
