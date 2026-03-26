"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpCircle,
  MessageSquare,
  Plus,
  Filter,
  XCircle,
  Loader2,
  User,
  Shield,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  createIssue,
  updateIssueStatus,
  escalateIssue,
  addIssueComment,
} from "@/lib/tournament-issue-actions"
import { ISSUE_CATEGORIES, ESCALATION_LEVELS } from "@/lib/tournament-issue-constants"
import { cn } from "@/lib/utils"

type Issue = {
  id: string
  tournament_id: string
  category: string
  severity: string
  status: string
  escalation_level: number
  title: string
  description: string
  resolution?: string
  created_at: string
  resolved_at?: string
  reporter?: { id: string; display_name: string; avatar_url?: string }
  assignee?: { id: string; display_name: string; avatar_url?: string }
  affected_player?: { id: string; display_name: string; avatar_url?: string }
  comments?: {
    id: string
    comment: string
    is_internal: boolean
    created_at: string
    user?: { id: string; display_name: string; avatar_url?: string }
  }[]
}

const SEVERITY_CONFIG = {
  low: { label: "Low", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  medium: { label: "Medium", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  high: { label: "High", color: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  critical: { label: "Critical", color: "bg-red-500/10 text-red-600 border-red-500/30" },
}

const STATUS_CONFIG = {
  open: { label: "Open", icon: AlertTriangle, color: "text-yellow-600" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-blue-600" },
  escalated: { label: "Escalated", icon: ArrowUpCircle, color: "text-orange-600" },
  resolved: { label: "Resolved", icon: CheckCircle, color: "text-green-600" },
  closed: { label: "Closed", icon: XCircle, color: "text-muted-foreground" },
}

export function TournamentIssuesDashboard({
  tournamentId,
  initialIssues,
  stats,
  isStaff = false,
}: {
  tournamentId: string
  initialIssues: Issue[]
  stats: { open: number; inProgress: number; escalated: number; resolved: number; critical: number }
  isStaff?: boolean
}) {
  const [issues, setIssues] = useState(initialIssues)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterSeverity, setFilterSeverity] = useState<string>("all")
  const [isPending, startTransition] = useTransition()
  const [showNewIssue, setShowNewIssue] = useState(false)

  const filteredIssues = issues.filter(issue => {
    if (filterStatus !== "all" && issue.status !== filterStatus) return false
    if (filterSeverity !== "all" && issue.severity !== filterSeverity) return false
    return true
  })

  const handleCreateIssue = async (formData: FormData) => {
    formData.set("tournament_id", tournamentId)
    startTransition(async () => {
      const result = await createIssue(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Issue reported successfully")
        setShowNewIssue(false)
        // Refresh issues
        window.location.reload()
      }
    })
  }

  const handleStatusChange = async (issueId: string, status: string, resolution?: string) => {
    const formData = new FormData()
    formData.set("issue_id", issueId)
    formData.set("status", status)
    if (resolution) formData.set("resolution", resolution)
    
    startTransition(async () => {
      const result = await updateIssueStatus(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Status updated")
        setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status } : i))
        setSelectedIssue(null)
      }
    })
  }

  const handleEscalate = async (issueId: string, reason: string) => {
    const formData = new FormData()
    formData.set("issue_id", issueId)
    formData.set("reason", reason)
    
    startTransition(async () => {
      const result = await escalateIssue(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Issue escalated")
        window.location.reload()
      }
    })
  }

  const handleAddComment = async (issueId: string, comment: string, isInternal: boolean) => {
    const formData = new FormData()
    formData.set("issue_id", issueId)
    formData.set("comment", comment)
    formData.set("is_internal", isInternal.toString())
    
    startTransition(async () => {
      const result = await addIssueComment(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Comment added")
        window.location.reload()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.open}</p>
              <p className="text-xs text-muted-foreground">Open Issues</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <ArrowUpCircle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.escalated}</p>
              <p className="text-xs text-muted-foreground">Escalated</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              {Object.entries(SEVERITY_CONFIG).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Dialog open={showNewIssue} onOpenChange={setShowNewIssue}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Report Issue
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Report Tournament Issue</DialogTitle>
            </DialogHeader>
            <form action={handleCreateIssue} className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select name="category" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ISSUE_CATEGORIES).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select name="severity" defaultValue="medium">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY_CONFIG).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input name="title" placeholder="Brief description of the issue" required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  name="description" 
                  placeholder="Detailed description of what happened..." 
                  rows={4}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Affected Round (optional)</Label>
                <Input name="affected_round" type="number" min="1" placeholder="Round number" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowNewIssue(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Issue
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {filteredIssues.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="mb-3 h-8 w-8 text-green-600" />
              <p className="text-muted-foreground">No issues found</p>
            </CardContent>
          </Card>
        ) : (
          filteredIssues.map(issue => (
            <IssueCard
              key={issue.id}
              issue={issue}
              isStaff={isStaff}
              onSelect={() => setSelectedIssue(issue)}
              onStatusChange={handleStatusChange}
              onEscalate={handleEscalate}
            />
          ))
        )}
      </div>

      {/* Issue Detail Dialog */}
      {selectedIssue && (
        <IssueDetailDialog
          issue={selectedIssue}
          isStaff={isStaff}
          onClose={() => setSelectedIssue(null)}
          onStatusChange={handleStatusChange}
          onEscalate={handleEscalate}
          onAddComment={handleAddComment}
          isPending={isPending}
        />
      )}
    </div>
  )
}

function IssueCard({
  issue,
  isStaff,
  onSelect,
  onStatusChange,
  onEscalate,
}: {
  issue: Issue
  isStaff: boolean
  onSelect: () => void
  onStatusChange: (id: string, status: string) => void
  onEscalate: (id: string, reason: string) => void
}) {
  const StatusIcon = STATUS_CONFIG[issue.status as keyof typeof STATUS_CONFIG]?.icon || AlertTriangle
  const statusColor = STATUS_CONFIG[issue.status as keyof typeof STATUS_CONFIG]?.color || "text-muted-foreground"
  const severityConfig = SEVERITY_CONFIG[issue.severity as keyof typeof SEVERITY_CONFIG]
  const categoryLabel = ISSUE_CATEGORIES[issue.category as keyof typeof ISSUE_CATEGORIES]?.label || issue.category

  return (
    <Card 
      className={cn(
        "cursor-pointer border-border bg-card transition-colors hover:bg-muted/20",
        issue.severity === "critical" && "border-red-500/50"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusIcon className={cn("h-4 w-4", statusColor)} />
              <span className="font-medium text-foreground truncate">{issue.title}</span>
              <Badge variant="outline" className={severityConfig?.color}>
                {severityConfig?.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {categoryLabel}
              </Badge>
              {issue.escalation_level > 1 && (
                <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">
                  <Shield className="mr-1 h-3 w-3" />
                  Level {issue.escalation_level}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{issue.description}</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              {issue.reporter && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {issue.reporter.display_name}
                </span>
              )}
              <span>{format(new Date(issue.created_at), "MMM d, h:mm a")}</span>
              {issue.comments && issue.comments.length > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {issue.comments.length}
                </span>
              )}
            </div>
          </div>
          
          {isStaff && issue.status !== "resolved" && issue.status !== "closed" && (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatusChange(issue.id, "resolved")}
              >
                <CheckCircle className="mr-1 h-3 w-3" />
                Resolve
              </Button>
              {issue.escalation_level < 3 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-orange-600"
                  onClick={() => {
                    const reason = prompt("Reason for escalation:")
                    if (reason) onEscalate(issue.id, reason)
                  }}
                >
                  <ArrowUpCircle className="mr-1 h-3 w-3" />
                  Escalate
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function IssueDetailDialog({
  issue,
  isStaff,
  onClose,
  onStatusChange,
  onEscalate,
  onAddComment,
  isPending,
}: {
  issue: Issue
  isStaff: boolean
  onClose: () => void
  onStatusChange: (id: string, status: string, resolution?: string) => void
  onEscalate: (id: string, reason: string) => void
  onAddComment: (id: string, comment: string, isInternal: boolean) => void
  isPending: boolean
}) {
  const [newComment, setNewComment] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [resolution, setResolution] = useState("")

  const StatusIcon = STATUS_CONFIG[issue.status as keyof typeof STATUS_CONFIG]?.icon || AlertTriangle
  const statusColor = STATUS_CONFIG[issue.status as keyof typeof STATUS_CONFIG]?.color || "text-muted-foreground"
  const severityConfig = SEVERITY_CONFIG[issue.severity as keyof typeof SEVERITY_CONFIG]
  const categoryInfo = ISSUE_CATEGORIES[issue.category as keyof typeof ISSUE_CATEGORIES]
  const escalationInfo = ESCALATION_LEVELS[issue.escalation_level as 1 | 2 | 3]

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("h-5 w-5", statusColor)} />
            <DialogTitle>{issue.title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta Info */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={severityConfig?.color}>
              {severityConfig?.label} Severity
            </Badge>
            <Badge variant="secondary">{categoryInfo?.label}</Badge>
            <Badge className="bg-primary/10 text-primary">
              <Shield className="mr-1 h-3 w-3" />
              {escalationInfo?.label}
            </Badge>
          </div>

          {/* Description */}
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="text-sm text-foreground whitespace-pre-wrap">{issue.description}</p>
          </div>

          {/* People */}
          <div className="grid gap-3 sm:grid-cols-2">
            {issue.reporter && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={issue.reporter.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {issue.reporter.display_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  Reported by <strong className="text-foreground">{issue.reporter.display_name}</strong>
                </span>
              </div>
            )}
            {issue.assignee && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={issue.assignee.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {issue.assignee.display_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  Assigned to <strong className="text-foreground">{issue.assignee.display_name}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Resolution */}
          {issue.resolution && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <p className="text-sm font-medium text-green-600 mb-1">Resolution</p>
              <p className="text-sm text-foreground">{issue.resolution}</p>
            </div>
          )}

          {/* Comments */}
          {issue.comments && issue.comments.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Comments</h4>
              {issue.comments.map(comment => (
                <div
                  key={comment.id}
                  className={cn(
                    "rounded-lg p-3",
                    comment.is_internal ? "bg-orange-500/10 border border-orange-500/30" : "bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={comment.user?.avatar_url} />
                      <AvatarFallback className="text-[10px]">
                        {comment.user?.display_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground">
                      {comment.user?.display_name}
                    </span>
                    {comment.is_internal && (
                      <Badge variant="outline" className="text-[10px] h-4 text-orange-600">
                        Internal
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{comment.comment}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add Comment */}
          {isStaff && issue.status !== "closed" && (
            <div className="space-y-2 border-t border-border pt-4">
              <Label>Add Comment</Label>
              <Textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={2}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={e => setIsInternal(e.target.checked)}
                    className="rounded"
                  />
                  Internal (staff only)
                </label>
                <Button
                  size="sm"
                  disabled={!newComment.trim() || isPending}
                  onClick={() => {
                    onAddComment(issue.id, newComment, isInternal)
                    setNewComment("")
                  }}
                >
                  Add Comment
                </Button>
              </div>
            </div>
          )}

          {/* Resolution Input (when resolving) */}
          {isStaff && issue.status !== "resolved" && issue.status !== "closed" && (
            <div className="space-y-2 border-t border-border pt-4">
              <Label>Resolution (optional)</Label>
              <Textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                placeholder="Describe how this was resolved..."
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {isStaff && issue.status !== "resolved" && issue.status !== "closed" && (
            <>
              {issue.escalation_level < 3 && (
                <Button
                  variant="outline"
                  className="text-orange-600"
                  disabled={isPending}
                  onClick={() => {
                    const reason = prompt("Reason for escalation:")
                    if (reason) onEscalate(issue.id, reason)
                  }}
                >
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                  Escalate
                </Button>
              )}
              <Button
                disabled={isPending}
                onClick={() => onStatusChange(issue.id, "resolved", resolution)}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Resolved
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
