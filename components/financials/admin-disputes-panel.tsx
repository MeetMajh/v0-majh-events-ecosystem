"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
} from "@/components/ui/dialog"
import { Loader2, AlertTriangle, CheckCircle, XCircle, Clock, ExternalLink, FileText } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

interface Dispute {
  id: string
  stripe_dispute_id: string
  stripe_charge_id: string
  user_id: string
  organizer_id: string | null
  amount_cents: number
  reason: string
  status: string
  evidence_submitted: boolean
  evidence_due_by: string | null
  resolution: string | null
  organizer_liability_cents: number
  liability_collected: boolean
  created_at: string
  user_display_name: string | null
  user_email: string | null
  organizer_display_name: string | null
  original_intent_type: string | null
  reference_type: string | null
}

const fetcher = async (url: string) => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  
  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single()
  if (!profile?.tenant_id) throw new Error("No tenant")
  
  const statusParam = url.includes("status=") ? url.split("status=")[1].split("&")[0] : null
  
  const { data, error } = await supabase.rpc("get_admin_disputes", {
    p_tenant_id: profile.tenant_id,
    p_status: statusParam === "all" ? null : statusParam,
    p_limit: 50,
    p_offset: 0,
  })
  
  if (error) throw error
  return data
}

export function AdminDisputesPanel() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin/disputes?status=${statusFilter}`,
    fetcher,
    { refreshInterval: 30000 }
  )
  const [isPending, startTransition] = useTransition()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [evidenceDialog, setEvidenceDialog] = useState<Dispute | null>(null)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "needs_response":
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Needs Response</Badge>
      case "under_review":
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1"><Clock className="h-3 w-3" />Under Review</Badge>
      case "won":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 gap-1"><CheckCircle className="h-3 w-3" />Won</Badge>
      case "lost":
        return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 gap-1"><XCircle className="h-3 w-3" />Lost</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const handleSubmitEvidence = async (disputeId: string) => {
    setProcessingId(disputeId)
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc("admin_submit_dispute_evidence", {
          p_dispute_id: disputeId,
        })
        
        if (error) throw error
        if (!data?.success) throw new Error(data?.error || "Failed to submit evidence")

        toast.success("Evidence marked as submitted")
        setEvidenceDialog(null)
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to submit evidence")
      } finally {
        setProcessingId(null)
      }
    })
  }

  const disputes = data?.disputes || []
  const total = data?.total || 0

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Disputes</CardTitle>
              <CardDescription>
                {total} total disputes
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="needs_response">Needs Response</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
              <p className="mt-2 text-sm text-muted-foreground">No disputes found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispute ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Evidence Due</TableHead>
                  <TableHead>Liability</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute: Dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">{dispute.stripe_dispute_id.slice(0, 12)}...</span>
                        <span className="text-xs text-muted-foreground">{formatDate(dispute.created_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{dispute.user_display_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{dispute.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(dispute.amount_cents)}</TableCell>
                    <TableCell className="capitalize text-sm">{dispute.reason?.replace(/_/g, " ") || "Unknown"}</TableCell>
                    <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                    <TableCell>
                      {dispute.evidence_due_by ? (
                        <span className={`text-sm ${new Date(dispute.evidence_due_by) < new Date() ? "text-red-600" : "text-muted-foreground"}`}>
                          {formatDate(dispute.evidence_due_by)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {dispute.organizer_liability_cents > 0 ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-red-600">{formatCurrency(dispute.organizer_liability_cents)}</span>
                          {dispute.liability_collected ? (
                            <Badge variant="outline" className="text-xs text-emerald-600">Collected</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-amber-600">Pending</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`https://dashboard.stripe.com/disputes/${dispute.stripe_dispute_id}`, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {dispute.status === "needs_response" && !dispute.evidence_submitted && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEvidenceDialog(dispute)}
                            disabled={processingId === dispute.id}
                          >
                            {processingId === dispute.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!evidenceDialog} onOpenChange={() => setEvidenceDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Evidence</DialogTitle>
            <DialogDescription>
              Mark evidence as submitted for dispute {evidenceDialog?.stripe_dispute_id}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This will mark the dispute as having evidence submitted and move it to &quot;Under Review&quot; status.
              Make sure you have submitted evidence in the Stripe Dashboard first.
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm"><strong>Amount:</strong> {evidenceDialog && formatCurrency(evidenceDialog.amount_cents)}</p>
              <p className="text-sm"><strong>Reason:</strong> {evidenceDialog?.reason?.replace(/_/g, " ")}</p>
              <p className="text-sm"><strong>Customer:</strong> {evidenceDialog?.user_display_name}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvidenceDialog(null)}>Cancel</Button>
            <Button 
              onClick={() => evidenceDialog && handleSubmitEvidence(evidenceDialog.id)}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark Evidence Submitted
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
