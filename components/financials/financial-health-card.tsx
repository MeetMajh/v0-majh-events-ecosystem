"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Loader2,
  TrendingUp,
  Wallet,
  Shield,
  Activity
} from "lucide-react"

interface FinancialHealth {
  healthy: boolean
  score: number
  issues: string[]
  walletTotal: number
  transactionTotal: number
  escrowTotal: number
  delta: number
  deposits: number
  entryFees: number
  prizes: number
  withdrawals: number
  testEscrowTotal: number
  failedCount: number
  pendingCount: number
  orphanedStripe: number
  checkedAt: string
}

export function FinancialHealthCard() {
  const [health, setHealth] = useState<FinancialHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchHealth() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/financial-health")
      const result = await response.json()
      
      if (result.success) {
        setHealth(result.health)
      } else {
        setError(result.error || "Failed to fetch health data")
      }
    } catch {
      setError("Failed to connect to server")
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchHealth()
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchHealth, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-emerald-600"
    if (score >= 70) return "text-amber-600"
    return "text-red-600"
  }

  const getHealthBg = (score: number) => {
    if (score >= 90) return "bg-emerald-50 border-emerald-200"
    if (score >= 70) return "bg-amber-50 border-amber-200"
    return "bg-red-50 border-red-200"
  }

  const getIssueLabel = (issue: string) => {
    switch (issue) {
      case "wallet_mismatch": return "Wallet Balance Mismatch"
      case "failed_transactions": return "Failed Transactions"
      case "orphaned_payments": return "Orphaned Stripe Payments"
      case "test_escrow_present": return "Test Escrow Data Present"
      default: return issue
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={fetchHealth} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!health) return null

  return (
    <div className="space-y-4">
      {/* Main Health Status Card */}
      <Card className={`border-2 ${getHealthBg(health.score)}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {health.healthy ? (
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              ) : health.score >= 70 ? (
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600" />
              )}
              <div>
                <CardTitle className="text-xl">
                  {health.healthy ? "System Healthy" : "Issues Detected"}
                </CardTitle>
                <CardDescription>
                  Financial reconciliation status
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${getHealthColor(health.score)}`}>
                {health.score}%
              </div>
              <p className="text-xs text-muted-foreground">Health Score</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {health.issues.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {health.issues.map((issue) => (
                <Badge 
                  key={issue} 
                  variant="outline" 
                  className="bg-white text-amber-700 border-amber-300"
                >
                  {getIssueLabel(issue)}
                </Badge>
              ))}
            </div>
          )}

          {/* Delta Alert */}
          {Math.abs(health.delta) > 0 && (
            <Alert className={Math.abs(health.delta) > 100 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}>
              <Activity className="h-4 w-4" />
              <AlertDescription>
                <strong>Reconciliation Delta:</strong> {formatCurrency(health.delta)}
                {Math.abs(health.delta) > 100 
                  ? " — Investigate wallet vs transaction mismatch"
                  : " — Within acceptable variance"
                }
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <span className="text-xs text-muted-foreground">
              Last checked: {new Date(health.checkedAt).toLocaleString()}
            </span>
            <Button variant="ghost" size="sm" onClick={fetchHealth}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Funds */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Wallets</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(health.walletTotal)}
            </div>
          </CardContent>
        </Card>

        {/* Escrow */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Live Escrow</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(health.escrowTotal)}
            </div>
          </CardContent>
        </Card>

        {/* Total Deposits */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Deposits</span>
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(health.deposits)}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className={health.failedCount > 0 || health.orphanedStripe > 0 ? "border-amber-200" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Active Alerts</span>
            </div>
            <div className="text-2xl font-bold">
              {health.failedCount + health.orphanedStripe + health.pendingCount}
            </div>
            {(health.failedCount > 0 || health.orphanedStripe > 0) && (
              <p className="text-xs text-amber-600 mt-1">
                {health.failedCount} failed, {health.orphanedStripe} orphaned
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Test Data Warning */}
      {health.testEscrowTotal > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Test Data Present:</strong> {formatCurrency(health.testEscrowTotal)} in test escrow accounts.
            This is excluded from live totals but should be dismissed for accurate reporting.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
