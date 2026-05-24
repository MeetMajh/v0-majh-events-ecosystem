"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Shield,
  ShieldAlert,
  ShieldOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Lock,
  Unlock,
  DollarSign,
  Wallet,
  TrendingDown,
  Activity,
  Users,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface SystemControl {
  id: string
  control_type: string
  is_enabled: boolean
  threshold_value: number | null
  triggered_at: string | null
  triggered_by: string | null
  reason: string | null
}

interface RiskFlag {
  user_id: string
  deposits_24h: number
  withdrawals_24h: number
  reversals_7d: number
  deposit_amount_24h: number
  withdrawal_amount_24h: number
  flags: string[]
}

interface FrozenWallet {
  user_id: string
  balance_cents: number
  is_frozen: boolean
  frozen_at: string | null
  freeze_reason: string | null
  profile: {
    display_name: string | null
    email: string | null
  } | null
}

interface SystemControlsPanelProps {
  controls: SystemControl[]
  reconciliation: {
    success: boolean
    mismatches_found: number
    mismatches: Array<{
      user_id: string
      wallet_balance: number
      transaction_sum: number
      discrepancy: number
    }>
  } | null
  riskFlags: {
    success: boolean
    flagged_users: number
    flags: RiskFlag[]
  } | null
  frozenWallets: FrozenWallet[]
}

const controlLabels: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  withdrawals_enabled: {
    label: "Withdrawals",
    description: "Allow users to withdraw funds",
    icon: <TrendingDown className="h-5 w-5" />,
  },
  deposits_enabled: {
    label: "Deposits",
    description: "Allow users to deposit funds",
    icon: <DollarSign className="h-5 w-5" />,
  },
  payouts_enabled: {
    label: "Payouts",
    description: "Allow tournament payouts to be processed",
    icon: <Wallet className="h-5 w-5" />,
  },
  daily_withdrawal_limit: {
    label: "Daily Withdrawal Limit",
    description: "Maximum withdrawal per user per day (cents)",
    icon: <Shield className="h-5 w-5" />,
  },
  circuit_breaker_withdrawals: {
    label: "Circuit Breaker",
    description: "System-wide withdrawal limit before auto-disable (cents)",
    icon: <ShieldAlert className="h-5 w-5" />,
  },
}

export function SystemControlsPanel({
  controls,
  reconciliation,
  riskFlags,
  frozenWallets,
}: SystemControlsPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [toggling, setToggling] = useState<string | null>(null)
  const [freezeDialog, setFreezeDialog] = useState<{ userId: string; action: "freeze" | "unfreeze" } | null>(null)
  const [freezeReason, setFreezeReason] = useState("")
  const [freezing, setFreezing] = useState(false)
  const [runningCheck, setRunningCheck] = useState<string | null>(null)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const handleToggleControl = async (controlType: string, currentEnabled: boolean) => {
    setToggling(controlType)
    
    try {
      const response = await fetch("/api/admin/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlType,
          enabled: !currentEnabled,
          reason: `Manual toggle by admin`,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Control Updated",
          description: result.message,
        })
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update control",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update control",
        variant: "destructive",
      })
    }
    
    setToggling(null)
  }

  const handleFreezeAction = async () => {
    if (!freezeDialog) return
    
    setFreezing(true)
    try {
      const response = await fetch("/api/admin/wallets/freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: freezeDialog.userId,
          action: freezeDialog.action,
          reason: freezeReason,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: freezeDialog.action === "freeze" ? "Wallet Frozen" : "Wallet Unfrozen",
          description: result.message,
        })
        setFreezeDialog(null)
        setFreezeReason("")
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
    setFreezing(false)
  }

  const handleRunCheck = async (checkType: "reconcile" | "check_risks") => {
    setRunningCheck(checkType)
    
    try {
      const response = await fetch("/api/admin/integrity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: checkType }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Check Complete",
          description: result.message,
        })
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to run check",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to run check",
        variant: "destructive",
      })
    }
    
    setRunningCheck(null)
  }

  // Calculate health score
  const mismatches = reconciliation?.mismatches_found || 0
  const flaggedUsers = riskFlags?.flagged_users || 0
  const disabledControls = controls.filter(c => !c.is_enabled && c.control_type.includes("enabled")).length
  
  let healthScore = 100
  healthScore -= mismatches * 15
  healthScore -= flaggedUsers * 10
  healthScore -= disabledControls * 5
  healthScore = Math.max(0, healthScore)

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-emerald-500"
    if (score >= 70) return "text-amber-500"
    return "text-red-500"
  }

  return (
    <div className="space-y-6">
      {/* Health Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-4xl font-bold", getHealthColor(healthScore))}>
              {healthScore}%
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {healthScore >= 90 ? "All systems operational" : healthScore >= 70 ? "Minor issues detected" : "Critical issues"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Balance Mismatches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-4xl font-bold", mismatches > 0 ? "text-red-500" : "text-emerald-500")}>
              {mismatches}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-1 h-7 text-xs text-zinc-400"
              onClick={() => handleRunCheck("reconcile")}
              disabled={runningCheck === "reconcile"}
            >
              {runningCheck === "reconcile" ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Run Check
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Risk Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-4xl font-bold", flaggedUsers > 0 ? "text-amber-500" : "text-emerald-500")}>
              {flaggedUsers}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-1 h-7 text-xs text-zinc-400"
              onClick={() => handleRunCheck("check_risks")}
              disabled={runningCheck === "check_risks"}
            >
              {runningCheck === "check_risks" ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Activity className="h-3 w-3 mr-1" />
              )}
              Scan Users
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Frozen Wallets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-zinc-100">
              {frozenWallets.length}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {frozenWallets.length > 0 ? "Active freezes" : "No frozen wallets"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Controls */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <Shield className="h-5 w-5" />
            System Controls
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Kill switches and circuit breakers for financial operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {controls.map((control) => {
            const meta = controlLabels[control.control_type] || {
              label: control.control_type,
              description: "",
              icon: <Shield className="h-5 w-5" />,
            }

            const isToggle = control.control_type.includes("enabled")

            return (
              <div
                key={control.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border",
                  control.is_enabled ? "border-zinc-700 bg-zinc-800/50" : "border-red-800/50 bg-red-950/20"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-2 rounded-lg",
                    control.is_enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {meta.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-100">{meta.label}</h3>
                    <p className="text-sm text-zinc-400">{meta.description}</p>
                    {control.triggered_at && !control.is_enabled && (
                      <p className="text-xs text-red-400 mt-1">
                        Disabled: {new Date(control.triggered_at).toLocaleString()}
                        {control.reason && ` - ${control.reason}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {!isToggle && control.threshold_value !== null && (
                    <Badge variant="outline" className="text-zinc-300 border-zinc-600">
                      {formatCurrency(control.threshold_value)}
                    </Badge>
                  )}
                  
                  {isToggle && (
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm",
                        control.is_enabled ? "text-emerald-500" : "text-red-500"
                      )}>
                        {control.is_enabled ? "ACTIVE" : "DISABLED"}
                      </span>
                      <Switch
                        checked={control.is_enabled}
                        onCheckedChange={() => handleToggleControl(control.control_type, control.is_enabled)}
                        disabled={toggling === control.control_type}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Risk Flags */}
      {riskFlags && riskFlags.flags && riskFlags.flags.length > 0 && (
        <Card className="bg-zinc-900 border-amber-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              Risk Flagged Users
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Users with suspicious activity patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">User ID</TableHead>
                  <TableHead className="text-zinc-400">Deposits (24h)</TableHead>
                  <TableHead className="text-zinc-400">Withdrawals (24h)</TableHead>
                  <TableHead className="text-zinc-400">Reversals (7d)</TableHead>
                  <TableHead className="text-zinc-400">Flags</TableHead>
                  <TableHead className="text-zinc-400">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskFlags.flags.map((flag) => (
                  <TableRow key={flag.user_id} className="border-zinc-800">
                    <TableCell className="font-mono text-xs text-zinc-300">
                      {flag.user_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      {flag.deposits_24h} ({formatCurrency(flag.deposit_amount_24h)})
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      {flag.withdrawals_24h} ({formatCurrency(flag.withdrawal_amount_24h)})
                    </TableCell>
                    <TableCell className="text-zinc-300">{flag.reversals_7d}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {flag.flags.filter(Boolean).map((f, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">
                            {f.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setFreezeDialog({ userId: flag.user_id, action: "freeze" })}
                      >
                        <Lock className="h-3 w-3 mr-1" />
                        Freeze
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Frozen Wallets */}
      {frozenWallets.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <ShieldOff className="h-5 w-5 text-red-500" />
              Frozen Wallets
            </CardTitle>
            <CardDescription className="text-zinc-400">
              User wallets currently locked from transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">User</TableHead>
                  <TableHead className="text-zinc-400">Balance</TableHead>
                  <TableHead className="text-zinc-400">Frozen At</TableHead>
                  <TableHead className="text-zinc-400">Reason</TableHead>
                  <TableHead className="text-zinc-400">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {frozenWallets.map((wallet) => (
                  <TableRow key={wallet.user_id} className="border-zinc-800">
                    <TableCell className="text-zinc-300">
                      <div>
                        <div className="font-medium">
                          {wallet.profile?.display_name || "Unknown"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {wallet.profile?.email || wallet.user_id.slice(0, 8)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-zinc-300">
                      {formatCurrency(wallet.balance_cents)}
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      {wallet.frozen_at ? new Date(wallet.frozen_at).toLocaleString() : "-"}
                    </TableCell>
                    <TableCell className="text-zinc-400 max-w-xs truncate">
                      {wallet.freeze_reason || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-zinc-600 text-zinc-300"
                        onClick={() => setFreezeDialog({ userId: wallet.user_id, action: "unfreeze" })}
                      >
                        <Unlock className="h-3 w-3 mr-1" />
                        Unfreeze
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Balance Mismatches */}
      {reconciliation && reconciliation.mismatches && reconciliation.mismatches.length > 0 && (
        <Card className="bg-zinc-900 border-red-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <XCircle className="h-5 w-5" />
              Balance Mismatches
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Wallets where balance does not match transaction sum
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                These wallets require manual investigation. Do not make changes without understanding the discrepancy.
              </AlertDescription>
            </Alert>
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">User ID</TableHead>
                  <TableHead className="text-zinc-400">Wallet Balance</TableHead>
                  <TableHead className="text-zinc-400">Transaction Sum</TableHead>
                  <TableHead className="text-zinc-400">Discrepancy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliation.mismatches.map((mismatch) => (
                  <TableRow key={mismatch.user_id} className="border-zinc-800">
                    <TableCell className="font-mono text-xs text-zinc-300">
                      {mismatch.user_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="font-mono text-zinc-300">
                      {formatCurrency(mismatch.wallet_balance)}
                    </TableCell>
                    <TableCell className="font-mono text-zinc-300">
                      {formatCurrency(mismatch.transaction_sum)}
                    </TableCell>
                    <TableCell className={cn(
                      "font-mono font-bold",
                      mismatch.discrepancy > 0 ? "text-emerald-500" : "text-red-500"
                    )}>
                      {mismatch.discrepancy > 0 ? "+" : ""}{formatCurrency(mismatch.discrepancy)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Freeze Dialog */}
      <Dialog open={freezeDialog !== null} onOpenChange={() => setFreezeDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {freezeDialog?.action === "freeze" ? "Freeze Wallet" : "Unfreeze Wallet"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {freezeDialog?.action === "freeze"
                ? "This will prevent the user from making any transactions."
                : "This will restore the user's ability to make transactions."}
            </DialogDescription>
          </DialogHeader>

          {freezeDialog?.action === "freeze" && (
            <div className="space-y-4">
              <div>
                <Label className="text-zinc-300">Reason for freeze</Label>
                <Textarea
                  placeholder="Enter reason for freezing this wallet (min 10 characters)..."
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  className="mt-2 bg-zinc-800 border-zinc-700 text-zinc-100"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFreezeDialog(null)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              variant={freezeDialog?.action === "freeze" ? "destructive" : "default"}
              onClick={handleFreezeAction}
              disabled={freezing || (freezeDialog?.action === "freeze" && freezeReason.length < 10)}
            >
              {freezing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : freezeDialog?.action === "freeze" ? (
                <Lock className="h-4 w-4 mr-2" />
              ) : (
                <Unlock className="h-4 w-4 mr-2" />
              )}
              {freezeDialog?.action === "freeze" ? "Freeze Wallet" : "Unfreeze Wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
