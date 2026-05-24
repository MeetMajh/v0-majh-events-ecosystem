"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Eye,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Clock,
  Shield,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type KycSession = {
  id: string
  user_id: string
  stripe_session_id: string
  status: string
  risk_score: number | null
  risk_signals: string[]
  document_type: string | null
  document_country: string | null
  created_at: string
  completed_at: string | null
  profiles: {
    id: string
    username: string
    display_name: string
    email: string
    kyc_status: string
  }
}

export function KycReviewQueue() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSession, setSelectedSession] = useState<KycSession | null>(null)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [processing, setProcessing] = useState(false)
  const { toast } = useToast()

  const { data, error, mutate } = useSWR<{ sessions: KycSession[] }>(
    `/api/admin/kyc/sessions?status=${statusFilter}&search=${searchQuery}`,
    fetcher,
    { refreshInterval: 30000 }
  )

  const sessions = data?.sessions || []
  const isLoading = !data && !error

  const handleReview = async () => {
    if (!selectedSession || !reviewAction) return
    
    setProcessing(true)
    try {
      const response = await fetch("/api/admin/kyc/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          userId: selectedSession.user_id,
          action: reviewAction,
          rejectionReason: reviewAction === "reject" ? rejectionReason : undefined,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      toast({
        title: reviewAction === "approve" ? "Verification Approved" : "Verification Rejected",
        description: `User ${selectedSession.profiles.display_name || selectedSession.profiles.username} has been ${reviewAction === "approve" ? "verified" : "rejected"}.`,
      })

      setShowReviewDialog(false)
      setSelectedSession(null)
      setReviewAction(null)
      setRejectionReason("")
      mutate()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to process review",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const getRiskBadge = (score: number | null) => {
    if (score === null) return null
    if (score < 30) return <Badge className="bg-green-500/10 text-green-500">Low Risk</Badge>
    if (score < 70) return <Badge className="bg-yellow-500/10 text-yellow-600">Medium Risk</Badge>
    return <Badge className="bg-red-500/10 text-red-500">High Risk</Badge>
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle2 className="mr-1 h-3 w-3" />Verified</Badge>
      case "requires_input":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pending</Badge>
      case "processing":
        return <Badge variant="outline"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Processing</Badge>
      case "canceled":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Canceled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              KYC Review Queue
            </CardTitle>
            <CardDescription>Review and manage identity verification submissions</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="w-[200px] pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="requires_input">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <Shield className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">No KYC submissions</h3>
            <p className="text-sm text-muted-foreground">
              {statusFilter !== "all" ? "No submissions match the selected filter" : "No identity verifications to review"}
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {session.profiles?.display_name || session.profiles?.username}
                        </p>
                        <p className="text-xs text-muted-foreground">{session.profiles?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {session.document_type ? (
                        <div>
                          <p className="text-sm capitalize">{session.document_type.replace("_", " ")}</p>
                          <p className="text-xs text-muted-foreground">{session.document_country}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getRiskBadge(session.risk_score)}</TableCell>
                    <TableCell>{getStatusBadge(session.status)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(session.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSession(session)
                            setShowReviewDialog(true)
                          }}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          Review
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review KYC Submission</DialogTitle>
            <DialogDescription>
              Review identity verification for {selectedSession?.profiles?.display_name || selectedSession?.profiles?.username}
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Username</span>
                    <span className="font-medium">{selectedSession.profiles?.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{selectedSession.profiles?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Document Type</span>
                    <span className="font-medium capitalize">
                      {selectedSession.document_type?.replace("_", " ") || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Country</span>
                    <span className="font-medium">{selectedSession.document_country || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risk Score</span>
                    <span>{getRiskBadge(selectedSession.risk_score)}</span>
                  </div>
                </div>
              </div>

              {/* Risk Signals */}
              {selectedSession.risk_signals && selectedSession.risk_signals.length > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Risk Signals Detected</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-yellow-600">
                    {selectedSession.risk_signals.map((signal, i) => (
                      <li key={i}>• {signal}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Selection */}
              <div className="space-y-3">
                <Label>Decision</Label>
                <div className="flex gap-2">
                  <Button
                    variant={reviewAction === "approve" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setReviewAction("approve")}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant={reviewAction === "reject" ? "destructive" : "outline"}
                    className="flex-1"
                    onClick={() => setReviewAction("reject")}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>

              {/* Rejection Reason */}
              {reviewAction === "reject" && (
                <div className="space-y-2">
                  <Label htmlFor="rejection-reason">Rejection Reason</Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="Provide a reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={!reviewAction || (reviewAction === "reject" && !rejectionReason) || processing}
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {reviewAction === "approve" ? "Approve Verification" : "Reject Verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
