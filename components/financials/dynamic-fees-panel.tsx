"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { 
  Percent, 
  TrendingDown, 
  TrendingUp,
  User,
  RefreshCw,
  Star,
  AlertTriangle,
  Check,
  Edit
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface OrganizerFee {
  id: string
  organizer_id: string
  platform_fee_bps: number
  processing_fee_bps: number
  payout_fee_bps: number
  tier: string
  fee_multiplier: number
  volume_discount_bps: number
  health_score_at_calculation: number
  volume_at_calculation: number
  is_override: boolean
  override_reason?: string
  created_at: string
  updated_at: string
  // Joined fields
  display_name?: string
  email?: string
}

interface DynamicFeesPanelProps {
  tenantId: string
}

const TIER_CONFIG: Record<string, { color: string; icon: typeof Star; label: string }> = {
  preferred: { color: "bg-green-500", icon: Star, label: "Preferred" },
  standard: { color: "bg-blue-500", icon: Check, label: "Standard" },
  elevated: { color: "bg-yellow-500", icon: TrendingUp, label: "Elevated" },
  high_risk: { color: "bg-red-500", icon: AlertTriangle, label: "High Risk" }
}

export function DynamicFeesPanel({ tenantId }: DynamicFeesPanelProps) {
  const [fees, setFees] = useState<OrganizerFee[]>([])
  const [loading, setLoading] = useState(true)
  const [tierFilter, setTierFilter] = useState<string>("all")
  const [editingFee, setEditingFee] = useState<OrganizerFee | null>(null)
  const [overrideValues, setOverrideValues] = useState({
    platform_fee_bps: 500,
    is_override: true,
    override_reason: ""
  })
  const [saving, setSaving] = useState(false)
  
  const supabase = createClient()

  const loadFees = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("organizer_fee_tiers")
        .select(`
          *,
          profiles!organizer_id (
            display_name,
            email
          )
        `)
        .eq("tenant_id", tenantId)
        .order("platform_fee_bps", { ascending: false })

      if (tierFilter !== "all") {
        query = query.eq("tier", tierFilter)
      }

      const { data, error } = await query.limit(50)

      if (error) throw error

      // Flatten the joined data
      const flattenedData = (data || []).map((item: OrganizerFee & { profiles?: { display_name?: string; email?: string } }) => ({
        ...item,
        display_name: item.profiles?.display_name,
        email: item.profiles?.email
      }))

      setFees(flattenedData)
    } catch (err) {
      console.error("Failed to load fee tiers:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tenantId) {
      loadFees()
    }
  }, [tenantId, tierFilter])

  const recalculateAllFees = async () => {
    setLoading(true)
    try {
      // Get all organizers with fee tiers
      for (const fee of fees) {
        await supabase.rpc("calculate_dynamic_fees", {
          p_organizer_id: fee.organizer_id
        })
      }
      await loadFees()
    } catch (err) {
      console.error("Failed to recalculate fees:", err)
    } finally {
      setLoading(false)
    }
  }

  const saveOverride = async () => {
    if (!editingFee) return
    
    setSaving(true)
    try {
      const { data: user } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from("organizer_fee_tiers")
        .update({
          platform_fee_bps: overrideValues.platform_fee_bps,
          is_override: true,
          override_reason: overrideValues.override_reason,
          override_by: user.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingFee.id)

      if (error) throw error
      
      setEditingFee(null)
      await loadFees()
    } catch (err) {
      console.error("Failed to save override:", err)
    } finally {
      setSaving(false)
    }
  }

  const removeOverride = async (feeId: string, organizerId: string) => {
    try {
      // Recalculate to remove override
      await supabase
        .from("organizer_fee_tiers")
        .update({
          is_override: false,
          override_reason: null,
          override_by: null
        })
        .eq("id", feeId)

      // Recalculate fees
      await supabase.rpc("calculate_dynamic_fees", {
        p_organizer_id: organizerId
      })

      await loadFees()
    } catch (err) {
      console.error("Failed to remove override:", err)
    }
  }

  const formatBps = (bps: number) => `${(bps / 100).toFixed(2)}%`
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(cents / 100)
  }

  if (loading && !fees.length) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Group stats
  const tierCounts = fees.reduce((acc, fee) => {
    acc[fee.tier] = (acc[fee.tier] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Dynamic Fee Tiers
              </CardTitle>
              <CardDescription>
                Risk-based fee adjustments per organizer
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={recalculateAllFees}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Recalculate All
              </Button>
            </div>
          </div>

          {/* Tier Summary */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            {Object.entries(TIER_CONFIG).map(([tier, config]) => (
              <div 
                key={tier} 
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  tierFilter === tier ? "ring-2 ring-primary" : ""
                } bg-opacity-10 ${config.color.replace("bg-", "bg-opacity-10 bg-")}`}
                onClick={() => setTierFilter(tierFilter === tier ? "all" : tier)}
              >
                <div className="flex items-center gap-2">
                  <config.icon className={`h-4 w-4 ${config.color.replace("bg-", "text-").replace("-500", "-600")}`} />
                  <span className="font-medium">{config.label}</span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {tierCounts[tier] || 0}
                </div>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="mt-4">
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="preferred">Preferred</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="elevated">Elevated</SelectItem>
                <SelectItem value="high_risk">High Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {fees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Percent className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No fee tiers configured</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fees.map((fee) => {
                const tierConfig = TIER_CONFIG[fee.tier] || TIER_CONFIG.standard
                const TierIcon = tierConfig.icon

                return (
                  <div
                    key={fee.id}
                    className={`p-4 rounded-lg border ${
                      fee.is_override ? "border-purple-300 bg-purple-50/50" : ""
                    } ${fee.tier === "high_risk" ? "border-red-200" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${tierConfig.color} bg-opacity-20`}>
                          <TierIcon className={`h-4 w-4 ${tierConfig.color.replace("bg-", "text-").replace("-500", "-600")}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{fee.display_name || "Unknown"}</span>
                            <Badge className={tierConfig.color}>{tierConfig.label}</Badge>
                            {fee.is_override && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                                Override
                              </Badge>
                            )}
                          </div>
                          
                          {fee.email && (
                            <div className="text-sm text-muted-foreground">
                              {fee.email}
                            </div>
                          )}

                          {/* Fee Breakdown */}
                          <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Platform:</span>{" "}
                              <span className="font-medium">{formatBps(fee.platform_fee_bps)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Processing:</span>{" "}
                              <span className="font-medium">{formatBps(fee.processing_fee_bps)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Payout:</span>{" "}
                              <span className="font-medium">{formatBps(fee.payout_fee_bps)}</span>
                            </div>
                          </div>

                          {/* Multiplier and Discount */}
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className={`flex items-center gap-1 ${
                              fee.fee_multiplier < 1 ? "text-green-600" : 
                              fee.fee_multiplier > 1 ? "text-red-600" : "text-muted-foreground"
                            }`}>
                              {fee.fee_multiplier < 1 ? <TrendingDown className="h-3 w-3" /> : 
                               fee.fee_multiplier > 1 ? <TrendingUp className="h-3 w-3" /> : null}
                              {((fee.fee_multiplier - 1) * 100).toFixed(0)}% {fee.fee_multiplier < 1 ? "discount" : fee.fee_multiplier > 1 ? "premium" : "standard"}
                            </span>
                            {fee.volume_discount_bps > 0 && (
                              <span className="text-green-600">
                                Volume discount: {formatBps(fee.volume_discount_bps)}
                              </span>
                            )}
                            <span className="text-muted-foreground">
                              Health: {fee.health_score_at_calculation}
                            </span>
                            <span className="text-muted-foreground">
                              Volume: {formatCurrency(fee.volume_at_calculation)}
                            </span>
                          </div>

                          {fee.override_reason && (
                            <div className="mt-2 text-xs text-purple-600">
                              Override reason: {fee.override_reason}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingFee(fee)
                            setOverrideValues({
                              platform_fee_bps: fee.platform_fee_bps,
                              is_override: true,
                              override_reason: fee.override_reason || ""
                            })
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {fee.is_override && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeOverride(fee.id, fee.organizer_id)}
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Override Dialog */}
      <Dialog open={!!editingFee} onOpenChange={(open) => !open && setEditingFee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Fee Tier</DialogTitle>
            <DialogDescription>
              Set custom fees for {editingFee?.display_name || "this organizer"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Platform Fee (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={overrideValues.platform_fee_bps / 100}
                onChange={(e) => setOverrideValues(prev => ({
                  ...prev,
                  platform_fee_bps: Math.round(parseFloat(e.target.value) * 100)
                }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Current: {formatBps(editingFee?.platform_fee_bps || 0)}
              </p>
            </div>

            <div>
              <Label>Override Reason</Label>
              <Input
                value={overrideValues.override_reason}
                onChange={(e) => setOverrideValues(prev => ({
                  ...prev,
                  override_reason: e.target.value
                }))}
                placeholder="e.g., Negotiated rate, Special partnership"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFee(null)}>
              Cancel
            </Button>
            <Button onClick={saveOverride} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
