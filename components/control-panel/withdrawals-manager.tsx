"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  ArrowDownToLine,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface Withdrawal {
  id: string
  user_id: string
  amount_cents: number
  status: string
  description: string | null
  stripe_session_id: string | null
  created_at: string
  profiles: {
    display_name: string | null
    email: string | null
  } | null
}

export function WithdrawalsManager({ withdrawals }: { withdrawals: Withdrawal[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [actionDialog, setActionDialog] = useState<{ type: "approve" | "reject" | "retry"; withdrawal: Withdrawal } | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [processing, setProcessing] = useState(false)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { class: string; icon: React.ReactNode }> = {
      pending: { 
        class: "bg-amber-500/20 text-amber-400 border-amber-500/30", 
        icon: <Clock className="h-3 w-3 mr-1" /> 
      },
      processing: { 
        class: "bg-blue-500/20 text-blue-400 border-blue-500/30", 
        icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" /> 
      },
      completed: { 
        class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", 
        icon: <CheckCircle className="h-3 w-3 mr-1" /> 
      },
      failed: { 
        class: "bg-red-500/20 text-red-400 border-red-500/30", 
        icon: <XCircle className="h-3 w-3 mr-1" /> 
      },
    }
    const style = styles[status] || styles.pending
    return (
      <Badge className={cn("flex items-center", style.class)}>
        {style.icon}
        {status}
      </Badge>
    )
  }

  const filteredWithdrawals = withdrawals.filter((w) => {
    const matchesSearch = 
      w.id.toLowerCase().includes(search.toLowerCase()) ||
      w.profiles?.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      w.profiles?.email?.toLowerCase().includes(search.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || w.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const pendingCount = withdrawals.filter(w => w.status === "pending").length
  const processingCount = withdrawals.filter(w => w.status === "processing").length
  const completedCount = withdrawals.filter(w => w.status === "completed").length
  const failedCount = withdrawals.filter(w => w.status === "failed").length

  const handleAction = async () => {
    if (!actionDialog) return
    
    setProcessing(true)
    try {
      let endpoint = ""
      let body: Record<string, string> = {}
      
      if (actionDialog.type === "approve") {
        endpoint = "/api/admin/withdrawals/approve"
        body = { withdrawalId: actionDialog.withdrawal.id }
      } else if (actionDialog.type === "reject") {
        endpoint = "/api/admin/withdrawals/reject"
        body = { withdrawalId: actionDialog.withdrawal.id, reason: rejectionReason }
      } else {
        // Retry - resubmit as approve
        endpoint = "/api/admin/withdrawals/approve"
        body = { withdrawalId: actionDialog.withdrawal.id }
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: actionDialog.type === "approve" ? "Withdrawal Approved" : 
                 actionDialog.type === "reject" ? "Withdrawal Rejected" : "Retry Initiated",
          description: result.message || "Successfully processed withdrawal request",
        })
        
        setActionDialog(null)
        setRejectionReason("")
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to process request",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to process request",
        variant: "destructive",
      })
    }
    setProcessing(false)
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-zinc-400">Pending</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-zinc-400">Processing</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{processingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-zinc-400">Completed</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{completedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-zinc-400">Failed</span>
            </div>
            <p className="text-2xl font-bold text-red-400">{failedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search by ID or user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawals Table */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-zinc-100">Withdrawal Requests</CardTitle>
          <CardDescription className="text-zinc-500">
            {filteredWithdrawals.length} requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredWithdrawals.length > 0 ? (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">User</TableHead>
                    <TableHead className="text-zinc-400 text-right">Amount</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                    <TableHead className="text-zinc-400">Stripe Payout</TableHead>
                    <TableHead className="text-zinc-400">Created</TableHead>
                    <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWithdrawals.map((w) => (
                    <TableRow key={w.id} className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableCell>
                        <div>
                          <p className="text-zinc-100 text-sm font-medium">
                            {w.profiles?.display_name || "Unknown"}
                          </p>
                          <p className="text-zinc-500 text-xs">{w.profiles?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-400">
                        -{formatCurrency(Math.abs(w.amount_cents))}
                      </TableCell>
                      <TableCell>{getStatusBadge(w.status)}</TableCell>
                      <TableCell className="text-zinc-500 text-xs font-mono">
                        {w.stripe_session_id ? w.stripe_session_id.slice(0, 15) + "..." : "—"}
                      </TableCell>
                      <TableCell className="text-zinc-400 text-sm">
                        {new Date(w.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {w.status === "pending" && (
                            <>
                              <Button 
                                size="sm" 
                                onClick={() => setActionDialog({ type: "approve", withdrawal: w })}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                              >
                                Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setActionDialog({ type: "reject", withdrawal: w })}
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8"
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {w.status === "failed" && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setActionDialog({ type: "retry", withdrawal: w })}
                              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-8"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <ArrowDownToLine className="h-12 w-12 mb-4" />
              <p>No withdrawal requests found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {actionDialog?.type === "approve" ? "Approve Withdrawal" :
               actionDialog?.type === "reject" ? "Reject Withdrawal" : "Retry Withdrawal"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {actionDialog?.type === "approve" 
                ? "This will initiate the Stripe payout to the user" 
                : actionDialog?.type === "reject"
                ? "The funds will be returned to the user's wallet"
                : "This will retry the failed payout"}
            </DialogDescription>
          </DialogHeader>

          {actionDialog && (
            <div className="space-y-4">
              <div className="bg-zinc-800 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-zinc-500">User</span>
                  <span className="text-zinc-100">{actionDialog.withdrawal.profiles?.display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Amount</span>
                  <span className="font-mono text-red-400">
                    -{formatCurrency(Math.abs(actionDialog.withdrawal.amount_cents))}
                  </span>
                </div>
              </div>

              {actionDialog.type === "reject" && (
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Rejection Reason</label>
                  <Textarea
                    placeholder="Enter reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setActionDialog(null)}
              disabled={processing}
              className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing || (actionDialog?.type === "reject" && !rejectionReason)}
              className={cn(
                actionDialog?.type === "approve" ? "bg-emerald-600 hover:bg-emerald-700" :
                actionDialog?.type === "reject" ? "bg-red-600 hover:bg-red-700" :
                "bg-blue-600 hover:bg-blue-700",
                "text-white"
              )}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                actionDialog?.type === "approve" ? "Approve & Process" :
                actionDialog?.type === "reject" ? "Reject" : "Retry"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
