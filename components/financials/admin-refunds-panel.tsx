"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw, Plus } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

interface Refund {
  id: string
  user_id: string
  amount_cents: number
  status: string
  original_intent_id: string
  reference_type: string | null
  stripe_refund_id: string | null
  created_at: string
  reconciled_at: string | null
  reason: string | null
  initiated_by: string | null
  user_display_name: string | null
  user_email: string | null
  original_amount_cents: number | null
  original_intent_type: string | null
}

const fetcher = async (url: string) => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  
  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single()
  if (!profile?.tenant_id) throw new Error("No tenant")
  
  const statusParam = url.includes("status=") ? url.split("status=")[1].split("&")[0] : null
  
  const { data, error } = await supabase.rpc("get_admin_refunds", {
    p_tenant_id: profile.tenant_id,
    p_status: statusParam === "all" ? null : statusParam,
    p_limit: 50,
    p_offset: 0,
  })
  
  if (error) throw error
  return data
}

export function AdminRefundsPanel() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin/refunds?status=${statusFilter}`,
    fetcher,
    { refreshInterval: 30000 }
  )
  const [isPending, startTransition] = useTransition()
  const [forceRefundDialog, setForceRefundDialog] = useState(false)
  const [forceRefundIntentId, setForceRefundIntentId] = useState("")
  const [forceRefundAmount, setForceRefundAmount] = useState("")
  const [forceRefundReason, setForceRefundReason] = useState("")

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
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1"><Clock className="h-3 w-3" />Pending</Badge>
      case "processing":
        return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 gap-1"><RefreshCw className="h-3 w-3" />Processing</Badge>
      case "succeeded":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 gap-1"><CheckCircle className="h-3 w-3" />Completed</Badge>
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const handleForceRefund = async () => {
    if (!forceRefundIntentId || !forceRefundAmount || !forceRefundReason) {
      toast.error("Please fill in all fields")
      return
    }

    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc("admin_force_refund", {
          p_intent_id: forceRefundIntentId,
          p_amount_cents: Math.round(parseFloat(forceRefundAmount) * 100),
          p_reason: forceRefundReason,
        })
        
        if (error) throw error
        if (!data?.success) throw new Error(data?.error || "Failed to create refund")

        toast.success("Refund initiated successfully")
        setForceRefundDialog(false)
        setForceRefundIntentId("")
        setForceRefundAmount("")
        setForceRefundReason("")
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create refund")
      }
    })
  }

  const refunds = data?.refunds || []
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
              <CardTitle>Refunds</CardTitle>
              <CardDescription>
                {total} total refunds
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="succeeded">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setForceRefundDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Force Refund
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {refunds.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
              <p className="mt-2 text-sm text-muted-foreground">No refunds found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Original Payment</TableHead>
                  <TableHead>Refund Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refunds.map((refund: Refund) => (
                  <TableRow key={refund.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{refund.user_display_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{refund.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{refund.original_amount_cents ? formatCurrency(refund.original_amount_cents) : "-"}</span>
                        <span className="text-xs text-muted-foreground capitalize">{refund.original_intent_type?.replace(/_/g, " ") || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-red-600">
                      -{formatCurrency(refund.amount_cents)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {refund.reason || "No reason provided"}
                    </TableCell>
                    <TableCell>{getStatusBadge(refund.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(refund.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={forceRefundDialog} onOpenChange={setForceRefundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Refund</DialogTitle>
            <DialogDescription>
              Create a manual refund for a payment intent. This bypasses normal validation checks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="intentId">Payment Intent ID</Label>
              <Input
                id="intentId"
                placeholder="UUID of the original financial_intent"
                value={forceRefundIntentId}
                onChange={(e) => setForceRefundIntentId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Refund Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="25.00"
                value={forceRefundAmount}
                onChange={(e) => setForceRefundAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Explain why this refund is being forced..."
                value={forceRefundReason}
                onChange={(e) => setForceRefundReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceRefundDialog(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={handleForceRefund}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Force Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
