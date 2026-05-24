"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Lock,
  Unlock,
  Activity,
  RefreshCw,
  Bell,
  CheckCircle2,
  XCircle,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"

type SystemHealth = "healthy" | "warning" | "critical"

interface SystemState {
  health: SystemHealth
  lockdown: boolean
  activeAlerts: number
  criticalAlerts: number
  mismatches: number
  riskFlags: number
  frozenWallets: number
  lastReconciliation: string | null
  chaosEnabled: boolean
  depositsEnabled: boolean
  withdrawalsEnabled: boolean
  payoutsEnabled: boolean
}

export function MissionControlStatus() {
  const [state, setState] = useState<SystemState | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()

  const fetchSystemState = useCallback(async () => {
    try {
      // Fetch all state in parallel
      const [
        { data: controls },
        { data: alerts },
        { data: frozenWallets },
        { data: reconResults },
        { data: riskResults },
      ] = await Promise.all([
        supabase.from("system_controls").select("control_type, is_enabled"),
        supabase.from("system_alerts").select("id, severity, acknowledged_at").is("acknowledged_at", null),
        supabase.from("wallets").select("id").eq("is_frozen", true),
        supabase.rpc("run_daily_reconciliation"),
        supabase.rpc("check_risk_flags"),
      ])

      const getControl = (type: string) => controls?.find(c => c.control_type === type)?.is_enabled ?? true

      const activeAlerts = alerts?.length || 0
      const criticalAlerts = alerts?.filter(a => a.severity === "critical").length || 0
      const mismatches = reconResults?.mismatches_found || 0
      const riskFlags = riskResults?.flagged_users || 0
      const frozenCount = frozenWallets?.length || 0
      const lockdown = getControl("emergency_lockdown")
      const chaosEnabled = getControl("chaos_mode_enabled")

      // Determine health status
      let health: SystemHealth = "healthy"
      if (lockdown || criticalAlerts > 0 || mismatches > 0) {
        health = "critical"
      } else if (riskFlags > 0 || activeAlerts > 0 || frozenCount > 0) {
        health = "warning"
      }

      setState({
        health,
        lockdown,
        activeAlerts,
        criticalAlerts,
        mismatches,
        riskFlags,
        frozenWallets: frozenCount,
        lastReconciliation: new Date().toISOString(),
        chaosEnabled,
        depositsEnabled: getControl("deposits_enabled"),
        withdrawalsEnabled: getControl("withdrawals_enabled"),
        payoutsEnabled: getControl("payouts_enabled"),
      })
    } catch (error) {
      // Fallback state on error
      setState({
        health: "warning",
        lockdown: false,
        activeAlerts: 0,
        criticalAlerts: 0,
        mismatches: 0,
        riskFlags: 0,
        frozenWallets: 0,
        lastReconciliation: null,
        chaosEnabled: false,
        depositsEnabled: true,
        withdrawalsEnabled: true,
        payoutsEnabled: true,
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchSystemState()

    // Subscribe to real-time changes
    const channel = supabase
      .channel("mission-control")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_controls" }, fetchSystemState)
      .on("postgres_changes", { event: "*", schema: "public", table: "system_alerts" }, fetchSystemState)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, fetchSystemState)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchSystemState])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchSystemState()
  }

  if (loading || !state) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-zinc-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading system state...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const healthConfig = {
    healthy: {
      color: "bg-emerald-500",
      borderColor: "border-emerald-500/30",
      bgColor: "bg-emerald-500/5",
      textColor: "text-emerald-400",
      icon: ShieldCheck,
      label: "HEALTHY",
      description: "All systems operational"
    },
    warning: {
      color: "bg-amber-500",
      borderColor: "border-amber-500/30",
      bgColor: "bg-amber-500/5",
      textColor: "text-amber-400",
      icon: AlertTriangle,
      label: "WARNING",
      description: "Issues detected - review recommended"
    },
    critical: {
      color: "bg-red-500",
      borderColor: "border-red-500/30",
      bgColor: "bg-red-500/5",
      textColor: "text-red-400",
      icon: ShieldAlert,
      label: "CRITICAL",
      description: "Immediate action required"
    },
  }

  const config = healthConfig[state.health]
  const StatusIcon = config.icon

  return (
    <Card className={cn("border transition-colors", config.borderColor, config.bgColor)}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Status Badge */}
          <div className="flex items-center gap-4">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg", config.bgColor)}>
              <StatusIcon className={cn("h-6 w-6", config.textColor)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge className={cn("font-mono text-xs", config.bgColor, config.textColor, "border-0")}>
                  {config.label}
                </Badge>
                {state.lockdown && (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    <Lock className="h-3 w-3 mr-1" />
                    LOCKDOWN
                  </Badge>
                )}
                {state.chaosEnabled && (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    <Zap className="h-3 w-3 mr-1" />
                    CHAOS MODE
                  </Badge>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-1">{config.description}</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-4">
            <StatPill 
              icon={Bell} 
              value={state.activeAlerts} 
              label="Alerts" 
              critical={state.criticalAlerts > 0}
            />
            <StatPill 
              icon={AlertTriangle} 
              value={state.mismatches} 
              label="Mismatches" 
              critical={state.mismatches > 0}
            />
            <StatPill 
              icon={Shield} 
              value={state.riskFlags} 
              label="Risk Flags" 
              warning={state.riskFlags > 0}
            />
            <StatPill 
              icon={Lock} 
              value={state.frozenWallets} 
              label="Frozen" 
              warning={state.frozenWallets > 0}
            />
          </div>

          {/* Controls Status */}
          <div className="flex items-center gap-2">
            <ControlIndicator enabled={state.depositsEnabled} label="Deposits" />
            <ControlIndicator enabled={state.withdrawalsEnabled} label="Withdrawals" />
            <ControlIndicator enabled={state.payoutsEnabled} label="Payouts" />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="ml-2 text-zinc-400 hover:text-zinc-100"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatPill({ 
  icon: Icon, 
  value, 
  label, 
  critical, 
  warning 
}: { 
  icon: React.ElementType
  value: number
  label: string
  critical?: boolean
  warning?: boolean
}) {
  const isActive = value > 0
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg px-3 py-2 border",
      critical && isActive ? "bg-red-500/10 border-red-500/30" :
      warning && isActive ? "bg-amber-500/10 border-amber-500/30" :
      "bg-zinc-800/50 border-zinc-700"
    )}>
      <Icon className={cn(
        "h-4 w-4",
        critical && isActive ? "text-red-400" :
        warning && isActive ? "text-amber-400" :
        "text-zinc-500"
      )} />
      <span className={cn(
        "text-sm font-medium",
        critical && isActive ? "text-red-400" :
        warning && isActive ? "text-amber-400" :
        "text-zinc-300"
      )}>
        {value}
      </span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  )
}

function ControlIndicator({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
      enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
    )}>
      {enabled ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      <span>{label}</span>
    </div>
  )
}
