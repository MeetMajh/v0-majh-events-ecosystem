"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Loader2, 
  MoreHorizontal, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  PauseCircle,
  PlayCircle,
  DollarSign,
  Filter,
  ArrowUpDown,
  ExternalLink
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Payout {
  id: string
  user_id: string
  tournament_id: string
  amount_cents: number
  net_amount_cents: number
  placement: number
  status: string
  is_on_hold: boolean
  hold_reason: string | null
  hold_until: string | null
  failure_count: number
  failure_reason: string | null
  stripe_transfer_id: string | null
  created_at: string
  processed_at: string | null
  user_display_name: string
  user_email: string
  user_avatar_url: string | null
  stripe_connect_account_id: string | null
  stripe_connect_payouts_enabled: boolean
  tournament_name: string
}

const fetcher = async ([, tenantId, filters]: [string, string, Record<string, unknown>]) => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_payouts_advanced", {
    p_tenant_id: tenantId,
    p_status: filters.status || null,
    p_is_held: filters.isHeld ?? null,
    p_min_amount: filters.minAmount || null,
    p_max_amount: filters.maxAmount || null,
    p_search: filters.search || null,
    p_sort_by: filters.sortBy || "created_at",
    p_sort_order: filters.sortOrder || "desc",
    p_limit: 25,
    p_offset: (filters.page as number || 0) * 25,
  })
  if (error) throw error
  return data
}

export function AdminPayoutManager({ tenantId }: { tenantId: string }) {
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [holdFilter, setHoldFilter] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [amountRange, setAmountRange] = useState<[number, number]>([0, 10000])
  const [sortBy, setSortBy] = useState("created_at")
  const [sortOrder, setSortOrder] = useState("desc")
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  // Dialogs
  const [rejectDialog, setRejectDialog] = useState<Payout | null>(null)
  const [holdDialog, setHoldDialog] = useState<Payout | null>(null)
  const [bulkApproveDialog, setBulkApproveDialog] = useState(false)
  const [bulkReleaseDialog, setBulkReleaseDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [holdReason, setHoldReason] = useState("")

  const [isPending, startTransition] = useTransition()

  const filters = {
    status: statusFilter || null,
    isHeld: holdFilter === "held" ? true : holdFilter === "not_held" ? false : null,
    minAmount: amountRange[0] > 0 ? amountRange[0] * 100 : null,
    maxAmount: amountRange[1] < 10000 ? amountRange[1] * 100 : null,
    search: searchQuery || null,
    sortBy,
    sortOrder,
    page,
  }

  const { data, error, isLoading, mutate } = useSWR(
    ["payouts_advanced", tenantId, filters],
    fetcher,
    { refreshInterval: 30000 }
  )

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

  const getStatusBadge = (payout: Payout) => {
    if (payout.is_on_hold) {
      return <Badge variant="secondary" className="gap-1"><PauseCircle className="h-3 w-3" />On Hold</Badge>
    }
    switch (payout.status) {
      case "pending":
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1"><Clock className="h-3 w-3" />Pending</Badge>
      case "eligible":
        return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 gap-1"><CheckCircle className="h-3 w-3" />Eligible</Badge>
      case "approved":
        return <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50 gap-1"><CheckCircle className="h-3 w-3" />Approved</Badge>
      case "processing":
        return <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50 gap-1"><Loader2 className="h-3 w-3 animate-spin" />Processing</Badge>
      case "completed":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 gap-1"><CheckCircle className="h-3 w-3" />Completed</Badge>
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>
      case "blocked":
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Blocked</Badge>
      default:
        return <Badge variant="secondary">{payout.status}</Badge>
    }
  }

  const handleApprovePayout = async (payoutId: string) => {
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc("admin_approve_payout", {
          p_payout_id: payoutId,
        })
        if (error) throw error
        if (!data?.success) throw new Error(data?.error || "Failed to approve")
        toast.success("Payout approved")
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to approve payout")
      }
    })
  }

  const handleRejectPayout = async () => {
    if (!rejectDialog) return
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc("admin_reject_payout", {
          p_payout_id: rejectDialog.id,
          p_reason: rejectReason || "Rejected by admin",
        })
        if (error) throw error
        if (!data?.success) throw new Error(data?.error || "Failed to reject")
        toast.success("Payout rejected")
        setRejectDialog(null)
        setRejectReason("")
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to reject payout")
      }
    })
  }

  const handleHoldPayout = async () => {
    if (!holdDialog) return
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc("hold_payout", {
          p_payout_id: holdDialog.id,
          p_reason: holdReason || "Manual hold by admin",
          p_hold_until: null,
        })
        if (error) throw error
        if (!data?.success) throw new Error(data?.error || "Failed to hold")
        toast.success("Payout placed on hold")
        setHoldDialog(null)
        setHoldReason("")
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to hold payout")
      }
    })
  }

  const handleReleaseHold = async (payoutId: string) => {
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc("release_payout_hold", {
          p_payout_id: payoutId,
        })
        if (error) throw error
        if (!data?.success) throw new Error(data?.error || "Failed to release")
        toast.success("Hold released")
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to release hold")
      }
    })
  }

  const handleBulkApprove = async () => {
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc("bulk_approve_payouts", {
          p_payout_ids: Array.from(selectedIds),
        })
        if (error) throw error
        toast.success(`Approved ${data.approved} payouts${data.skipped > 0 ? `, skipped ${data.skipped}` : ""}`)
        setSelectedIds(new Set())
        setBulkApproveDialog(false)
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to bulk approve")
      }
    })
  }

  const handleBulkReleaseHolds = async () => {
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc("bulk_release_holds", {
          p_payout_ids: Array.from(selectedIds),
        })
        if (error) throw error
        toast.success(`Released ${data.released} holds${data.skipped > 0 ? `, skipped ${data.skipped}` : ""}`)
        setSelectedIds(new Set())
        setBulkReleaseDialog(false)
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to release holds")
      }
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === payouts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(payouts.map((p: Payout) => p.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const payouts = data?.payouts || []
  const total = data?.total || 0
  const stats = data?.stats || {}
  const totalPages = Math.ceil(total / 25)

  if (isLoading && !data) {
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
              <CardTitle>Payout Management</CardTitle>
              <CardDescription>
                {total} total payouts | {formatCurrency(stats.total_amount_cents || 0)} total
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setBulkApproveDialog(true)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve ({selectedIds.size})
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setBulkReleaseDialog(true)}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Release Holds ({selectedIds.size})
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-lg font-semibold">{formatCurrency(stats.pending_amount_cents || 0)}</p>
              <p className="text-xs text-muted-foreground">{stats.pending_count || 0} payouts</p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-600">On Hold</p>
              <p className="text-lg font-semibold text-amber-700">{formatCurrency(stats.held_amount_cents || 0)}</p>
              <p className="text-xs text-amber-600">{stats.held_count || 0} payouts</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total Filtered</p>
              <p className="text-lg font-semibold">{formatCurrency(stats.total_amount_cents || 0)}</p>
              <p className="text-xs text-muted-foreground">{total} payouts</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Selected</p>
              <p className="text-lg font-semibold">{selectedIds.size}</p>
              <p className="text-xs text-muted-foreground">payouts selected</p>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="p-4 border rounded-lg space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Name, email, tournament..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setPage(0) }}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(0) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="eligible">Eligible</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hold Status</Label>
                  <Select value={holdFilter} onValueChange={(v) => { setHoldFilter(v === "all" ? "" : v); setPage(0) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="held">On Hold</SelectItem>
                      <SelectItem value="not_held">Not Held</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sort By</Label>
                  <Select value={`${sortBy}_${sortOrder}`} onValueChange={(v) => {
                    const [by, order] = v.split("_")
                    setSortBy(by)
                    setSortOrder(order)
                    setPage(0)
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at_desc">Newest First</SelectItem>
                      <SelectItem value="created_at_asc">Oldest First</SelectItem>
                      <SelectItem value="amount_desc">Highest Amount</SelectItem>
                      <SelectItem value="amount_asc">Lowest Amount</SelectItem>
                      <SelectItem value="status_asc">Status Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Amount Range: {formatCurrency(amountRange[0] * 100)} - {formatCurrency(amountRange[1] * 100)}</Label>
                <Slider
                  value={amountRange}
                  onValueChange={(v) => { setAmountRange(v as [number, number]); setPage(0) }}
                  min={0}
                  max={10000}
                  step={100}
                />
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.size === payouts.length && payouts.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">No payouts found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  payouts.map((payout: Payout) => (
                    <TableRow key={payout.id} className={payout.is_on_hold ? "bg-amber-50/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(payout.id)}
                          onCheckedChange={() => toggleSelect(payout.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={payout.user_avatar_url || undefined} />
                            <AvatarFallback>{payout.user_display_name?.charAt(0) || "?"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{payout.user_display_name}</p>
                            <p className="text-xs text-muted-foreground">{payout.user_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{payout.tournament_name}</p>
                          <Badge variant="secondary" className="text-xs">#{payout.placement}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{formatCurrency(payout.net_amount_cents || payout.amount_cents)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(payout)}
                          {payout.hold_reason && (
                            <p className="text-xs text-amber-600 max-w-[150px] truncate" title={payout.hold_reason}>
                              {payout.hold_reason}
                            </p>
                          )}
                          {payout.failure_reason && (
                            <p className="text-xs text-red-600 max-w-[150px] truncate" title={payout.failure_reason}>
                              {payout.failure_reason}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(payout.created_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isPending}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {["pending", "eligible"].includes(payout.status) && !payout.is_on_hold && (
                              <DropdownMenuItem onClick={() => handleApprovePayout(payout.id)}>
                                <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            {payout.is_on_hold && (
                              <DropdownMenuItem onClick={() => handleReleaseHold(payout.id)}>
                                <PlayCircle className="mr-2 h-4 w-4 text-blue-500" />
                                Release Hold
                              </DropdownMenuItem>
                            )}
                            {!payout.is_on_hold && !["completed", "blocked"].includes(payout.status) && (
                              <DropdownMenuItem onClick={() => setHoldDialog(payout)}>
                                <PauseCircle className="mr-2 h-4 w-4 text-amber-500" />
                                Place on Hold
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {!["completed", "blocked"].includes(payout.status) && (
                              <DropdownMenuItem onClick={() => setRejectDialog(payout)} className="text-destructive">
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject / Block
                              </DropdownMenuItem>
                            )}
                            {payout.stripe_transfer_id && (
                              <DropdownMenuItem onClick={() => window.open(`https://dashboard.stripe.com/transfers/${payout.stripe_transfer_id}`, "_blank")}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View in Stripe
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payout</DialogTitle>
            <DialogDescription>
              This will block the payout for {rejectDialog?.user_display_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm"><strong>Amount:</strong> {rejectDialog && formatCurrency(rejectDialog.amount_cents)}</p>
              <p className="text-sm"><strong>Tournament:</strong> {rejectDialog?.tournament_name}</p>
            </div>
            <div className="space-y-2">
              <Label>Reason for rejection</Label>
              <Textarea
                placeholder="Enter reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectPayout} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold Dialog */}
      <Dialog open={!!holdDialog} onOpenChange={() => setHoldDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Payout on Hold</DialogTitle>
            <DialogDescription>
              This will pause the payout for {holdDialog?.user_display_name} until manually released.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm"><strong>Amount:</strong> {holdDialog && formatCurrency(holdDialog.amount_cents)}</p>
              <p className="text-sm"><strong>Tournament:</strong> {holdDialog?.tournament_name}</p>
            </div>
            <div className="space-y-2">
              <Label>Reason for hold</Label>
              <Textarea
                placeholder="Enter reason..."
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldDialog(null)}>Cancel</Button>
            <Button onClick={handleHoldPayout} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Place on Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Approve Dialog */}
      <Dialog open={bulkApproveDialog} onOpenChange={setBulkApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Approve Payouts</DialogTitle>
            <DialogDescription>
              Approve {selectedIds.size} selected payouts. Only eligible payouts will be approved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkApproveDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkApprove} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Release Dialog */}
      <Dialog open={bulkReleaseDialog} onOpenChange={setBulkReleaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release All Holds</DialogTitle>
            <DialogDescription>
              Release holds on {selectedIds.size} selected payouts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkReleaseDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkReleaseHolds} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Release All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
