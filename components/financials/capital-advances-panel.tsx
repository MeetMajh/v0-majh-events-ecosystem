"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Banknote, 
  TrendingUp, 
  Clock, 
  User,
  CheckCircle,
  XCircle,
  RefreshCw,
  DollarSign,
  AlertTriangle,
  ArrowRight
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface CapitalAdvance {
  id: string
  organizer_id: string
  advance_amount_cents: number
  fee_amount_cents: number
  total_repayment_cents: number
  fee_rate_bps: number
  repayment_rate_bps: number
  status: string
  amount_repaid_cents: number
  remaining_balance_cents: number
  repayment_count: number
  health_score_at_approval?: number
  risk_tier_at_approval?: string
  created_at: string
  disbursed_at?: string
  organizer_display_name?: string
  organizer_email?: string
}

interface AdvanceStats {
  total_advanced_cents: number
  total_outstanding_cents: number
  total_repaid_cents: number
  active_count: number
  pending_count: number
  paid_off_count: number
  defaulted_count: number
}

interface CapitalAdvancesPanelProps {
  tenantId: string
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-yellow-500", label: "Pending Approval" },
  approved: { color: "bg-blue-500", label: "Approved" },
  active: { color: "bg-green-500", label: "Active" },
  repaying: { color: "bg-emerald-500", label: "Repaying" },
  paid_off: { color: "bg-gray-500", label: "Paid Off" },
  defaulted: { color: "bg-red-500", label: "Defaulted" },
  cancelled: { color: "bg-gray-400", label: "Cancelled" },
  rejected: { color: "bg-red-400", label: "Rejected" }
}

export function CapitalAdvancesPanel({ tenantId }: CapitalAdvancesPanelProps) {
  const [advances, setAdvances] = useState<CapitalAdvance[]>([])
  const [stats, setStats] = useState<AdvanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [processing, setProcessing] = useState<string | null>(null)
  
  const supabase = createClient()

  const loadAdvances = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("get_capital_advances", {
        p_tenant_id: tenantId,
        p_status: statusFilter === "all" ? null : statusFilter,
        p_limit: 50
      })

      if (error) throw error

      setAdvances(data?.advances || [])
      setStats(data?.stats || null)
    } catch (err) {
      console.error("Failed to load capital advances:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tenantId) {
      loadAdvances()
    }
  }, [tenantId, statusFilter])

  const approveAdvance = async (advanceId: string) => {
    setProcessing(advanceId)
    try {
      const { data: user } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from("capital_advances")
        .update({ 
          status: "active",
          approved_by: user.user?.id,
          approved_at: new Date().toISOString(),
          disbursed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", advanceId)

      if (error) throw error
      await loadAdvances()
    } catch (err) {
      console.error("Failed to approve advance:", err)
    } finally {
      setProcessing(null)
    }
  }

  const rejectAdvance = async (advanceId: string) => {
    setProcessing(advanceId)
    try {
      const { error } = await supabase
        .from("capital_advances")
        .update({ 
          status: "rejected",
          rejection_reason: "Admin rejected",
          updated_at: new Date().toISOString()
        })
        .eq("id", advanceId)

      if (error) throw error
      await loadAdvances()
    } catch (err) {
      console.error("Failed to reject advance:", err)
    } finally {
      setProcessing(null)
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(cents / 100)
  }

  if (loading && !advances.length) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Capital Advances
            </CardTitle>
            <CardDescription>
              Organizer lending against future payouts
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadAdvances}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-600">Total Advanced</div>
              <div className="text-xl font-bold text-blue-700">
                {formatCurrency(stats.total_advanced_cents)}
              </div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="text-sm text-orange-600">Outstanding</div>
              <div className="text-xl font-bold text-orange-700">
                {formatCurrency(stats.total_outstanding_cents)}
              </div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-sm text-green-600">Repaid</div>
              <div className="text-xl font-bold text-green-700">
                {formatCurrency(stats.total_repaid_cents)}
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Active / Pending</div>
              <div className="text-xl font-bold">
                {stats.active_count} / {stats.pending_count}
              </div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="mt-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="repaying">Repaying</SelectItem>
              <SelectItem value="paid_off">Paid Off</SelectItem>
              <SelectItem value="defaulted">Defaulted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {advances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Banknote className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No capital advances</p>
          </div>
        ) : (
          <div className="space-y-4">
            {advances.map((advance) => {
              const statusConfig = STATUS_CONFIG[advance.status] || STATUS_CONFIG.pending
              const repaymentProgress = advance.total_repayment_cents > 0
                ? ((advance.amount_repaid_cents / advance.total_repayment_cents) * 100)
                : 0

              return (
                <div
                  key={advance.id}
                  className={`p-4 rounded-lg border ${
                    advance.status === "pending" ? "border-yellow-300 bg-yellow-50/50" : ""
                  } ${advance.status === "defaulted" ? "border-red-300 bg-red-50/50" : ""}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">
                          {formatCurrency(advance.advance_amount_cents)}
                        </span>
                        <Badge className={statusConfig.color}>
                          {statusConfig.label}
                        </Badge>
                      </div>
                      
                      {advance.organizer_display_name && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <User className="h-3 w-3" />
                          {advance.organizer_display_name}
                          {advance.organizer_email && (
                            <span className="text-xs">({advance.organizer_email})</span>
                          )}
                        </div>
                      )}
                    </div>

                    {advance.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => approveAdvance(advance.id)}
                          disabled={processing === advance.id}
                        >
                          {processing === advance.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectAdvance(advance.id)}
                          disabled={processing === advance.id}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Advance Details */}
                  <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <div className="text-muted-foreground">Fee</div>
                      <div className="font-medium">
                        {formatCurrency(advance.fee_amount_cents)}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({(advance.fee_rate_bps / 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total Repayment</div>
                      <div className="font-medium">
                        {formatCurrency(advance.total_repayment_cents)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Repayment Rate</div>
                      <div className="font-medium">
                        {(advance.repayment_rate_bps / 100).toFixed(0)}% per payout
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Health Score</div>
                      <div className="font-medium">
                        {advance.health_score_at_approval || "N/A"}
                        {advance.risk_tier_at_approval && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            {advance.risk_tier_at_approval}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Repayment Progress */}
                  {["active", "repaying", "paid_off"].includes(advance.status) && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Repayment Progress</span>
                        <span className="font-medium">
                          {formatCurrency(advance.amount_repaid_cents)} / {formatCurrency(advance.total_repayment_cents)}
                        </span>
                      </div>
                      <Progress value={repaymentProgress} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span>{repaymentProgress.toFixed(1)}% complete</span>
                        <span>{advance.repayment_count} payments</span>
                      </div>
                    </div>
                  )}

                  {/* Remaining Balance */}
                  {advance.remaining_balance_cents > 0 && advance.status !== "paid_off" && (
                    <div className="mt-2 p-2 bg-orange-50 rounded text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-orange-600" />
                      <span className="text-orange-700">
                        Remaining balance: {formatCurrency(advance.remaining_balance_cents)}
                      </span>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground mt-3">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Created {formatDistanceToNow(new Date(advance.created_at), { addSuffix: true })}
                    {advance.disbursed_at && (
                      <span className="ml-3">
                        Disbursed {formatDistanceToNow(new Date(advance.disbursed_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
