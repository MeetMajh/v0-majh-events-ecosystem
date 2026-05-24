"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  RefreshCw,
  Settings,
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  DollarSign,
  Clock,
  Activity,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

interface OrganizerHealthScore {
  id: string
  organizer_id: string
  tenant_id: string
  overall_score: number
  dispute_score: number
  payout_score: number
  volume_score: number
  tenure_score: number
  total_volume_cents: number
  total_payouts_cents: number
  total_disputes: number
  disputes_won: number
  disputes_lost: number
  total_refunds_cents: number
  failed_payouts: number
  successful_payouts: number
  dispute_rate: number
  refund_rate: number
  payout_success_rate: number
  risk_tier: "low" | "standard" | "elevated" | "high" | "critical"
  reserve_rate: number
  min_reserve_cents: number
  current_reserve_cents: number
  auto_payout_enabled: boolean
  auto_payout_max_cents: number
  auto_payout_delay_hours: number
  first_transaction_at: string | null
  last_transaction_at: string | null
  last_calculated_at: string
  display_name: string
  email: string
  avatar_url: string | null
}

interface OrganizerHealthScoresProps {
  tenantId: string
}

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

const getRiskTierColor = (tier: string) => {
  switch (tier) {
    case "low":
      return "bg-green-100 text-green-800 border-green-200"
    case "standard":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "elevated":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "critical":
      return "bg-red-100 text-red-800 border-red-200"
    default:
      return "bg-muted text-muted-foreground"
  }
}

const getScoreColor = (score: number) => {
  if (score >= 85) return "text-green-600"
  if (score >= 70) return "text-blue-600"
  if (score >= 50) return "text-yellow-600"
  if (score >= 30) return "text-orange-600"
  return "text-red-600"
}

const getProgressColor = (score: number) => {
  if (score >= 85) return "bg-green-500"
  if (score >= 70) return "bg-blue-500"
  if (score >= 50) return "bg-yellow-500"
  if (score >= 30) return "bg-orange-500"
  return "bg-red-500"
}

export function OrganizerHealthScores({ tenantId }: OrganizerHealthScoresProps) {
  const [scores, setScores] = useState<OrganizerHealthScore[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [riskTierFilter, setRiskTierFilter] = useState<string>("all")
  const [selectedOrganizer, setSelectedOrganizer] = useState<OrganizerHealthScore | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  const supabase = createClient()

  const loadScores = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("get_organizer_health_scores", {
        p_tenant_id: tenantId,
        p_risk_tier: riskTierFilter === "all" ? null : riskTierFilter,
        p_limit: 50,
        p_offset: 0,
      })

      if (error) throw error

      setScores(data?.scores || [])
      setTotal(data?.total || 0)
    } catch (error) {
      console.error("Error loading health scores:", error)
      toast.error("Failed to load health scores")
    } finally {
      setLoading(false)
    }
  }, [tenantId, riskTierFilter, supabase])

  useEffect(() => {
    if (tenantId) {
      loadScores()
    }
  }, [tenantId, loadScores])

  const recalculateAll = async () => {
    setRecalculating(true)
    try {
      const { data, error } = await supabase.rpc("recalculate_all_health_scores", {
        p_tenant_id: tenantId,
      })

      if (error) throw error

      toast.success(`Recalculated ${data?.recalculated || 0} health scores`)
      loadScores()
    } catch (error) {
      console.error("Error recalculating:", error)
      toast.error("Failed to recalculate health scores")
    } finally {
      setRecalculating(false)
    }
  }

  const updateAutoPayoutSettings = async (
    organizerId: string,
    settings: {
      enabled?: boolean
      maxCents?: number
      delayHours?: number
    }
  ) => {
    try {
      const { error } = await supabase.rpc("update_organizer_auto_payout_settings", {
        p_organizer_id: organizerId,
        p_enabled: settings.enabled,
        p_max_cents: settings.maxCents,
        p_delay_hours: settings.delayHours,
      })

      if (error) throw error

      toast.success("Auto-payout settings updated")
      loadScores()
      setSettingsOpen(false)
    } catch (error) {
      console.error("Error updating settings:", error)
      toast.error("Failed to update settings")
    }
  }

  // Stats summary
  const stats = {
    total: scores.length,
    low: scores.filter(s => s.risk_tier === "low").length,
    standard: scores.filter(s => s.risk_tier === "standard").length,
    elevated: scores.filter(s => s.risk_tier === "elevated").length,
    high: scores.filter(s => s.risk_tier === "high").length,
    critical: scores.filter(s => s.risk_tier === "critical").length,
    autoEnabled: scores.filter(s => s.auto_payout_enabled).length,
    avgScore: scores.length > 0 
      ? Math.round(scores.reduce((sum, s) => sum + s.overall_score, 0) / scores.length)
      : 0,
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Avg Score</span>
            </div>
            <p className={`text-2xl font-bold ${getScoreColor(stats.avgScore)}`}>
              {stats.avgScore}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Low Risk</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.low}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-muted-foreground">Elevated</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{stats.elevated}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-muted-foreground">High/Critical</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.high + stats.critical}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">Auto-Payout</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.autoEnabled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organizer Health Scores</CardTitle>
              <CardDescription>
                Financial health and risk assessment for all organizers
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={riskTierFilter} onValueChange={setRiskTierFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Risk Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="elevated">Elevated</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={recalculateAll}
                disabled={recalculating}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? "animate-spin" : ""}`} />
                Recalculate All
              </Button>

              <Button variant="outline" size="sm" onClick={loadScores}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organizer</TableHead>
                <TableHead>Overall Score</TableHead>
                <TableHead>Risk Tier</TableHead>
                <TableHead>Scores Breakdown</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Disputes</TableHead>
                <TableHead>Reserve</TableHead>
                <TableHead>Auto-Payout</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Loading health scores...
                  </TableCell>
                </TableRow>
              ) : scores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No organizer health scores found
                  </TableCell>
                </TableRow>
              ) : (
                scores.map((score) => (
                  <TableRow
                    key={score.id}
                    className={
                      score.risk_tier === "critical"
                        ? "bg-red-50"
                        : score.risk_tier === "high"
                        ? "bg-orange-50"
                        : ""
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={score.avatar_url || undefined} />
                          <AvatarFallback>
                            {score.display_name?.charAt(0) || "O"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{score.display_name}</p>
                          <p className="text-xs text-muted-foreground">{score.email}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${getScoreColor(score.overall_score)}`}>
                          {score.overall_score}
                        </span>
                        <div className="w-16">
                          <Progress
                            value={score.overall_score}
                            className="h-2"
                          />
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge className={getRiskTierColor(score.risk_tier)}>
                        {score.risk_tier.toUpperCase()}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <TooltipProvider>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${getScoreColor(score.dispute_score)}`}>
                                D{score.dispute_score}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Dispute Score</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger>
                              <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${getScoreColor(score.payout_score)}`}>
                                P{score.payout_score}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Payout Score</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger>
                              <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${getScoreColor(score.volume_score)}`}>
                                V{score.volume_score}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Volume Score</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger>
                              <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${getScoreColor(score.tenure_score)}`}>
                                T{score.tenure_score}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Tenure Score</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{formatCurrency(score.total_volume_cents)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(score.total_payouts_cents)} paid
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{score.total_disputes} total</p>
                        <p className="text-xs">
                          <span className="text-green-600">{score.disputes_won}W</span>
                          {" / "}
                          <span className="text-red-600">{score.disputes_lost}L</span>
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{(score.reserve_rate * 100).toFixed(0)}%</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(score.current_reserve_cents)}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      {score.auto_payout_enabled ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          <Zap className="h-3 w-3 mr-1" />
                          ON
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          OFF
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <Dialog open={settingsOpen && selectedOrganizer?.id === score.id} onOpenChange={(open) => {
                        setSettingsOpen(open)
                        if (open) setSelectedOrganizer(score)
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Auto-Payout Settings</DialogTitle>
                            <DialogDescription>
                              Configure auto-payout for {score.display_name}
                            </DialogDescription>
                          </DialogHeader>
                          <AutoPayoutSettingsForm
                            score={score}
                            onSave={updateAutoPayoutSettings}
                          />
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function AutoPayoutSettingsForm({
  score,
  onSave,
}: {
  score: OrganizerHealthScore
  onSave: (organizerId: string, settings: {
    enabled?: boolean
    maxCents?: number
    delayHours?: number
  }) => void
}) {
  const [enabled, setEnabled] = useState(score.auto_payout_enabled)
  const [maxAmount, setMaxAmount] = useState(score.auto_payout_max_cents / 100)
  const [delayHours, setDelayHours] = useState(score.auto_payout_delay_hours)

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Enable Auto-Payout</Label>
          <p className="text-sm text-muted-foreground">
            Automatically approve low-risk payouts
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="space-y-2">
        <Label>Maximum Auto-Payout Amount</Label>
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            value={maxAmount}
            onChange={(e) => setMaxAmount(Number(e.target.value))}
            className="w-32"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Payouts above this amount require manual approval
        </p>
      </div>

      <div className="space-y-2">
        <Label>Delay Hours: {delayHours}h</Label>
        <Slider
          value={[delayHours]}
          onValueChange={([v]) => setDelayHours(v)}
          min={0}
          max={72}
          step={1}
        />
        <p className="text-xs text-muted-foreground">
          Time to wait before processing auto-approved payouts
        </p>
      </div>

      <div className="rounded-lg bg-muted p-4 space-y-2">
        <p className="text-sm font-medium">Organizer Risk Profile</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Risk Tier:</span>{" "}
            <Badge className={getRiskTierColor(score.risk_tier)}>
              {score.risk_tier.toUpperCase()}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Score:</span>{" "}
            <span className={getScoreColor(score.overall_score)}>
              {score.overall_score}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Reserve Rate:</span>{" "}
            {(score.reserve_rate * 100).toFixed(0)}%
          </div>
          <div>
            <span className="text-muted-foreground">Disputes:</span>{" "}
            {score.total_disputes} ({score.disputes_lost} lost)
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          onClick={() =>
            onSave(score.organizer_id, {
              enabled,
              maxCents: maxAmount * 100,
              delayHours,
            })
          }
        >
          Save Settings
        </Button>
      </div>
    </div>
  )
}
