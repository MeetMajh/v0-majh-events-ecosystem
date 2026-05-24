"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  Bell,
  Slack,
  Webhook,
  Mail,
  DollarSign,
  AlertTriangle,
  Save,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

interface AlertConfig {
  id: string
  alert_type: string
  is_enabled: boolean
  threshold_amount_cents: number | null
  threshold_fraud_score: number | null
  webhook_url: string | null
  slack_webhook_url: string | null
  email_recipients: string[] | null
}

interface AlertConfigurationProps {
  tenantId: string
}

const alertTypes = [
  {
    type: "dispute_created",
    label: "Dispute Created",
    description: "When a new dispute is filed",
    hasAmountThreshold: false,
    hasFraudThreshold: false,
  },
  {
    type: "dispute_lost",
    label: "Dispute Lost",
    description: "When a dispute is lost",
    hasAmountThreshold: false,
    hasFraudThreshold: false,
  },
  {
    type: "high_fraud_score",
    label: "High Fraud Score",
    description: "When a payout has a high fraud score (auto-holds)",
    hasAmountThreshold: false,
    hasFraudThreshold: true,
  },
  {
    type: "large_payout",
    label: "Large Payout",
    description: "When a payout exceeds the threshold",
    hasAmountThreshold: true,
    hasFraudThreshold: false,
  },
  {
    type: "payout_failed",
    label: "Payout Failed",
    description: "When a payout fails to process",
    hasAmountThreshold: false,
    hasFraudThreshold: false,
  },
  {
    type: "refund_requested",
    label: "Refund Requested",
    description: "When a refund is initiated",
    hasAmountThreshold: true,
    hasFraudThreshold: false,
  },
  {
    type: "hold_triggered",
    label: "Hold Triggered",
    description: "When a payout is placed on hold",
    hasAmountThreshold: false,
    hasFraudThreshold: false,
  },
  {
    type: "reconciliation_failed",
    label: "Reconciliation Failed",
    description: "When reconciliation encounters errors",
    hasAmountThreshold: false,
    hasFraudThreshold: false,
  },
]

export function AlertConfiguration({ tenantId }: AlertConfigurationProps) {
  const [configs, setConfigs] = useState<AlertConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingConfig, setEditingConfig] = useState<{
    type: string
    config: Partial<AlertConfig>
  } | null>(null)

  const supabase = createClient()

  const fetchConfigs = async () => {
    if (!tenantId) return

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("get_alert_configurations", {
        p_tenant_id: tenantId,
      })

      if (error) throw error

      setConfigs(data?.configurations || [])
    } catch (err) {
      console.error("Error fetching alert configs:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfigs()
  }, [tenantId])

  const getConfigForType = (alertType: string): Partial<AlertConfig> => {
    return configs.find((c) => c.alert_type === alertType) || {}
  }

  const saveConfig = async () => {
    if (!editingConfig) return

    setSaving(true)
    try {
      const { error } = await supabase.rpc("upsert_alert_configuration", {
        p_tenant_id: tenantId,
        p_alert_type: editingConfig.type,
        p_is_enabled: editingConfig.config.is_enabled ?? true,
        p_threshold_amount_cents: editingConfig.config.threshold_amount_cents || null,
        p_threshold_fraud_score: editingConfig.config.threshold_fraud_score || null,
        p_webhook_url: editingConfig.config.webhook_url || null,
        p_slack_webhook_url: editingConfig.config.slack_webhook_url || null,
        p_email_recipients: editingConfig.config.email_recipients || null,
      })

      if (error) throw error

      toast.success("Alert configuration saved")
      setEditingConfig(null)
      fetchConfigs()
    } catch (err) {
      console.error("Error saving config:", err)
      toast.error("Failed to save configuration")
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (alertType: string, currentEnabled: boolean) => {
    try {
      const { error } = await supabase.rpc("upsert_alert_configuration", {
        p_tenant_id: tenantId,
        p_alert_type: alertType,
        p_is_enabled: !currentEnabled,
      })

      if (error) throw error

      setConfigs((prev) =>
        prev.map((c) =>
          c.alert_type === alertType ? { ...c, is_enabled: !currentEnabled } : c
        )
      )
      toast.success(`Alert ${!currentEnabled ? "enabled" : "disabled"}`)
    } catch (err) {
      console.error("Error toggling alert:", err)
      toast.error("Failed to update configuration")
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5" />
            <div>
              <CardTitle>Alert Configuration</CardTitle>
              <CardDescription>
                Configure which alerts to receive and how
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchConfigs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alert Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Thresholds</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alertTypes.map((alertType) => {
              const config = getConfigForType(alertType.type)
              const isEnabled = config.is_enabled ?? false

              return (
                <TableRow key={alertType.type}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{alertType.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {alertType.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() =>
                        toggleEnabled(alertType.type, isEnabled)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {alertType.hasAmountThreshold && config.threshold_amount_cents && (
                        <Badge variant="outline" className="text-xs">
                          <DollarSign className="h-3 w-3 mr-1" />
                          ${(config.threshold_amount_cents / 100).toFixed(0)}+
                        </Badge>
                      )}
                      {alertType.hasFraudThreshold && config.threshold_fraud_score && (
                        <Badge variant="outline" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Score {config.threshold_fraud_score}+
                        </Badge>
                      )}
                      {!config.threshold_amount_cents && !config.threshold_fraud_score && (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {config.slack_webhook_url && (
                        <Badge variant="secondary" className="text-xs">
                          <Slack className="h-3 w-3 mr-1" />
                          Slack
                        </Badge>
                      )}
                      {config.webhook_url && (
                        <Badge variant="secondary" className="text-xs">
                          <Webhook className="h-3 w-3 mr-1" />
                          Webhook
                        </Badge>
                      )}
                      {config.email_recipients && config.email_recipients.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Mail className="h-3 w-3 mr-1" />
                          Email
                        </Badge>
                      )}
                      {!config.slack_webhook_url &&
                        !config.webhook_url &&
                        (!config.email_recipients || config.email_recipients.length === 0) && (
                          <span className="text-xs text-muted-foreground">
                            Not configured
                          </span>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog
                      open={editingConfig?.type === alertType.type}
                      onOpenChange={(open) => {
                        if (open) {
                          setEditingConfig({
                            type: alertType.type,
                            config: { ...config, is_enabled: config.is_enabled ?? true },
                          })
                        } else {
                          setEditingConfig(null)
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          Configure
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Configure {alertType.label}</DialogTitle>
                          <DialogDescription>
                            {alertType.description}
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          <div className="flex items-center justify-between">
                            <Label>Enable Alert</Label>
                            <Switch
                              checked={editingConfig?.config.is_enabled ?? true}
                              onCheckedChange={(checked) =>
                                setEditingConfig((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        config: { ...prev.config, is_enabled: checked },
                                      }
                                    : null
                                )
                              }
                            />
                          </div>

                          {alertType.hasAmountThreshold && (
                            <div className="space-y-2">
                              <Label>Amount Threshold ($)</Label>
                              <Input
                                type="number"
                                placeholder="e.g., 1000"
                                value={
                                  editingConfig?.config.threshold_amount_cents
                                    ? editingConfig.config.threshold_amount_cents / 100
                                    : ""
                                }
                                onChange={(e) =>
                                  setEditingConfig((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          config: {
                                            ...prev.config,
                                            threshold_amount_cents: e.target.value
                                              ? Number(e.target.value) * 100
                                              : null,
                                          },
                                        }
                                      : null
                                  )
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                Alert when amount exceeds this value
                              </p>
                            </div>
                          )}

                          {alertType.hasFraudThreshold && (
                            <div className="space-y-2">
                              <Label>Fraud Score Threshold</Label>
                              <Input
                                type="number"
                                placeholder="e.g., 70"
                                min={0}
                                max={100}
                                value={editingConfig?.config.threshold_fraud_score || ""}
                                onChange={(e) =>
                                  setEditingConfig((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          config: {
                                            ...prev.config,
                                            threshold_fraud_score: e.target.value
                                              ? Number(e.target.value)
                                              : null,
                                          },
                                        }
                                      : null
                                  )
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                Alert and auto-hold when fraud score exceeds this (0-100)
                              </p>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Slack className="h-4 w-4" />
                              Slack Webhook URL
                            </Label>
                            <Input
                              type="url"
                              placeholder="https://hooks.slack.com/services/..."
                              value={editingConfig?.config.slack_webhook_url || ""}
                              onChange={(e) =>
                                setEditingConfig((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        config: {
                                          ...prev.config,
                                          slack_webhook_url: e.target.value || null,
                                        },
                                      }
                                    : null
                                )
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Webhook className="h-4 w-4" />
                              Custom Webhook URL
                            </Label>
                            <Input
                              type="url"
                              placeholder="https://your-webhook.com/alerts"
                              value={editingConfig?.config.webhook_url || ""}
                              onChange={(e) =>
                                setEditingConfig((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        config: {
                                          ...prev.config,
                                          webhook_url: e.target.value || null,
                                        },
                                      }
                                    : null
                                )
                              }
                            />
                          </div>
                        </div>

                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setEditingConfig(null)}
                          >
                            Cancel
                          </Button>
                          <Button onClick={saveConfig} disabled={saving}>
                            {saving ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Save
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
