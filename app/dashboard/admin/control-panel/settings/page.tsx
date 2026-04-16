"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Settings,
  Shield,
  Bell,
  Database,
  Zap,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react"

interface SystemControl {
  control_type: string
  is_enabled: boolean
  threshold_value: number | null
  updated_at: string
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [controls, setControls] = useState<SystemControl[]>([])
  const [thresholds, setThresholds] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const supabase = createClient()

  const fetchControls = async () => {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from("system_controls")
      .select("*")
      .order("control_type")

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setControls(data || [])
      const initialThresholds: Record<string, string> = {}
      data?.forEach(c => {
        if (c.threshold_value !== null) {
          initialThresholds[c.control_type] = c.threshold_value.toString()
        }
      })
      setThresholds(initialThresholds)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchControls()
  }, [])

  const handleToggle = async (controlType: string, newValue: boolean) => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    const res = await fetch("/api/admin/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        control_type: controlType,
        is_enabled: newValue,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "Failed to update control")
    } else {
      setSuccess(`${controlType.replace(/_/g, " ")} ${newValue ? "enabled" : "disabled"}`)
      await fetchControls()
    }
    setSaving(false)
  }

  const handleThresholdSave = async (controlType: string) => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    const value = parseInt(thresholds[controlType] || "0", 10)

    const res = await fetch("/api/admin/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        control_type: controlType,
        threshold_value: value,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "Failed to update threshold")
    } else {
      setSuccess(`${controlType.replace(/_/g, " ")} threshold updated`)
      await fetchControls()
    }
    setSaving(false)
  }

  const getControlIcon = (type: string) => {
    if (type.includes("withdrawal") || type.includes("deposit") || type.includes("payout")) {
      return <Zap className="h-4 w-4" />
    }
    if (type.includes("lockdown") || type.includes("chaos")) {
      return <Shield className="h-4 w-4" />
    }
    if (type.includes("alert") || type.includes("notification")) {
      return <Bell className="h-4 w-4" />
    }
    return <Settings className="h-4 w-4" />
  }

  const getControlDescription = (type: string): string => {
    const descriptions: Record<string, string> = {
      withdrawals_enabled: "Allow users to withdraw funds from their wallets",
      deposits_enabled: "Allow users to deposit funds via Stripe",
      payouts_enabled: "Allow tournament prize payouts to be processed",
      emergency_lockdown: "Block ALL financial operations system-wide",
      chaos_mode_enabled: "Enable chaos testing mode for integrity verification",
      high_value_threshold: "Flag transactions above this amount (in cents)",
      daily_withdrawal_limit: "Maximum daily withdrawal per user (in cents)",
    }
    return descriptions[type] || `Control setting for ${type.replace(/_/g, " ")}`
  }

  const toggleControls = controls.filter(c => 
    !c.control_type.includes("threshold") && !c.control_type.includes("limit")
  )
  
  const thresholdControls = controls.filter(c => 
    c.control_type.includes("threshold") || c.control_type.includes("limit")
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Control Panel Settings</h1>
          <p className="text-zinc-400 mt-1">
            Configure system controls, thresholds, and operational parameters
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchControls}
          disabled={loading}
          className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert className="bg-red-900/20 border-red-900/50">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-red-200">Error</AlertTitle>
          <AlertDescription className="text-red-300/80">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-emerald-900/20 border-emerald-900/50">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <AlertTitle className="text-emerald-200">Success</AlertTitle>
          <AlertDescription className="text-emerald-300/80">{success}</AlertDescription>
        </Alert>
      )}

      {/* Toggle Controls */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            System Controls
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Enable or disable core financial operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {toggleControls.map((control) => (
            <div
              key={control.control_type}
              className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  control.control_type === "emergency_lockdown"
                    ? "bg-red-500/20 text-red-400"
                    : control.is_enabled
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-700 text-zinc-400"
                }`}>
                  {getControlIcon(control.control_type)}
                </div>
                <div>
                  <p className="font-medium text-zinc-200 capitalize">
                    {control.control_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {getControlDescription(control.control_type)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={
                    control.control_type === "emergency_lockdown"
                      ? control.is_enabled
                        ? "border-red-500/50 bg-red-500/10 text-red-400"
                        : "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : control.is_enabled
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "border-zinc-600 bg-zinc-800 text-zinc-400"
                  }
                >
                  {control.control_type === "emergency_lockdown"
                    ? control.is_enabled ? "ACTIVE" : "INACTIVE"
                    : control.is_enabled ? "Enabled" : "Disabled"
                  }
                </Badge>
                <Switch
                  checked={control.is_enabled}
                  onCheckedChange={(checked) => handleToggle(control.control_type, checked)}
                  disabled={saving}
                  className={control.control_type === "emergency_lockdown" ? "data-[state=checked]:bg-red-500" : ""}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Threshold Controls */}
      {thresholdControls.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Database className="h-5 w-5 text-amber-400" />
              Thresholds & Limits
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Configure financial limits and alert thresholds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {thresholdControls.map((control) => (
              <div
                key={control.control_type}
                className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-zinc-200 capitalize">
                      {control.control_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {getControlDescription(control.control_type)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label htmlFor={control.control_type} className="text-zinc-400 text-xs">
                      Value (cents)
                    </Label>
                    <Input
                      id={control.control_type}
                      type="number"
                      value={thresholds[control.control_type] || ""}
                      onChange={(e) => setThresholds(prev => ({
                        ...prev,
                        [control.control_type]: e.target.value
                      }))}
                      className="bg-zinc-800 border-zinc-700 text-zinc-200"
                      placeholder="Enter value in cents"
                    />
                  </div>
                  <Button
                    onClick={() => handleThresholdSave(control.control_type)}
                    disabled={saving}
                    className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Current: {control.threshold_value !== null 
                    ? `$${(control.threshold_value / 100).toFixed(2)}` 
                    : "Not set"
                  }
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Database Info */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-400" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <p className="text-xs text-zinc-500">Total Controls</p>
              <p className="text-xl font-bold text-zinc-200">{controls.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <p className="text-xs text-zinc-500">Enabled</p>
              <p className="text-xl font-bold text-emerald-400">
                {controls.filter(c => c.is_enabled).length}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <p className="text-xs text-zinc-500">Disabled</p>
              <p className="text-xl font-bold text-zinc-400">
                {controls.filter(c => !c.is_enabled).length}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <p className="text-xs text-zinc-500">Environment</p>
              <p className="text-xl font-bold text-amber-400">
                {process.env.NODE_ENV === "production" ? "LIVE" : "TEST"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
