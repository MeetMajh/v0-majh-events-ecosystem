"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  ShieldCheck, 
  ShieldX, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Rocket,
  AlertTriangle,
  History,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TestResult {
  test: string
  passed: boolean
  detected?: boolean
  skipped?: boolean
  reason?: string
  operations_blocked?: boolean
  flags_detected?: boolean
  mismatches_found?: number
  details?: unknown
}

interface DeploymentRun {
  id: string
  status: "running" | "passed" | "failed" | "error"
  environment: string
  started_at: string
  completed_at: string | null
  git_commit_sha: string | null
  git_branch: string | null
  results: TestResult[] | null
  failed_checks: unknown[] | null
  triggered_by: string | null
}

interface CheckResult {
  success: boolean
  deploy_allowed: boolean
  run_id?: string
  tests_run?: number
  tests_failed?: number
  failures?: unknown[]
  results?: TestResult[]
  message?: string
  error?: string
}

export default function PreDeployCheckPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<DeploymentRun[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [lastResult, setLastResult] = useState<CheckResult | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch("/api/admin/predeploy-check")
      if (res.ok) {
        const data = await res.json()
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error("Failed to fetch history:", error)
    } finally {
      setHistoryLoading(false)
    }
  }

  const runCheck = async () => {
    setIsLoading(true)
    setLastResult(null)
    
    try {
      const res = await fetch("/api/admin/predeploy-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          git_sha: null,
          git_branch: null
        })
      })
      
      const data: CheckResult = await res.json()
      setLastResult(data)
      fetchHistory()
    } catch (error) {
      setLastResult({
        success: false,
        deploy_allowed: false,
        error: "Failed to run integrity check"
      })
    } finally {
      setIsLoading(false)
      setShowConfirmDialog(false)
      setConfirmText("")
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "passed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">PASSED</Badge>
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">FAILED</Badge>
      case "running":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">RUNNING</Badge>
      default:
        return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">ERROR</Badge>
    }
  }

  const getTestIcon = (passed: boolean) => {
    return passed 
      ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      : <XCircle className="h-4 w-4 text-red-400" />
  }

  const formatTestName = (test: string) => {
    return test
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Pre-Deployment Integrity Check</h1>
          <p className="text-zinc-400 mt-1">
            Verify financial system integrity before deploying to production
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHistory}
          disabled={historyLoading}
          className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", historyLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Main Action Card */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-zinc-100">Integrity Verification Gate</CardTitle>
              <CardDescription className="text-zinc-400">
                Run all financial integrity tests before deploying
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* What This Checks */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Reconciliation", desc: "No mismatches" },
              { label: "Corruption Detection", desc: "Catches tampering" },
              { label: "Lockdown", desc: "Blocks operations" },
              { label: "Risk Detection", desc: "Flags patterns" },
              { label: "System Controls", desc: "All configured" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-3">
                <p className="font-medium text-zinc-200 text-sm">{item.label}</p>
                <p className="text-xs text-zinc-500">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Run Button */}
          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              onClick={() => setShowConfirmDialog(true)}
              disabled={isLoading}
              className="bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white px-8"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Running Integrity Check...
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5 mr-2" />
                  Run Pre-Deployment Check
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Last Result */}
      {lastResult && (
        <Alert className={cn(
          "border-2",
          lastResult.deploy_allowed 
            ? "bg-emerald-500/10 border-emerald-500/50" 
            : "bg-red-500/10 border-red-500/50"
        )}>
          {lastResult.deploy_allowed ? (
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          ) : (
            <ShieldX className="h-5 w-5 text-red-400" />
          )}
          <AlertTitle className={lastResult.deploy_allowed ? "text-emerald-400" : "text-red-400"}>
            {lastResult.deploy_allowed ? "SAFE TO DEPLOY" : "DEPLOYMENT BLOCKED"}
          </AlertTitle>
          <AlertDescription className="text-zinc-300">
            {lastResult.message || lastResult.error}
            {lastResult.tests_run && (
              <span className="ml-2 text-zinc-400">
                ({lastResult.tests_run} tests run, {lastResult.tests_failed || 0} failed)
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Test Results */}
      {lastResult?.results && lastResult.results.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100 text-lg">Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">Test</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                  <TableHead className="text-zinc-400">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lastResult.results.map((result, idx) => (
                  <TableRow key={idx} className="border-zinc-800">
                    <TableCell className="text-zinc-200 font-medium">
                      {formatTestName(result.test)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTestIcon(result.passed)}
                        <span className={result.passed ? "text-emerald-400" : "text-red-400"}>
                          {result.passed ? "Passed" : "Failed"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      {result.skipped && <span>Skipped: {result.reason}</span>}
                      {result.detected !== undefined && <span>Detection: {result.detected ? "Yes" : "No"}</span>}
                      {result.operations_blocked !== undefined && <span>Blocked: {result.operations_blocked ? "Yes" : "No"}</span>}
                      {result.flags_detected !== undefined && <span>Flags: {result.flags_detected ? "Detected" : "None"}</span>}
                      {result.mismatches_found !== undefined && <span>Mismatches: {result.mismatches_found}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-zinc-400" />
            <CardTitle className="text-zinc-100 text-lg">Check History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              No integrity checks have been run yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">Date</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                  <TableHead className="text-zinc-400">Environment</TableHead>
                  <TableHead className="text-zinc-400">Duration</TableHead>
                  <TableHead className="text-zinc-400">Branch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((run) => (
                  <TableRow key={run.id} className="border-zinc-800">
                    <TableCell className="text-zinc-200">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-zinc-500" />
                        {new Date(run.started_at).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell className="text-zinc-400">{run.environment}</TableCell>
                    <TableCell className="text-zinc-400">
                      {run.completed_at 
                        ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                        : "-"
                      }
                    </TableCell>
                    <TableCell className="text-zinc-400 font-mono text-xs">
                      {run.git_branch || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Confirm Integrity Check
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              This will run all financial integrity tests. The system will temporarily trigger lockdown 
              and inject test data to verify detection mechanisms.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm text-amber-300">
                Type <span className="font-mono font-bold">DEPLOY CHECK</span> to confirm
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-zinc-400">Confirmation</Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DEPLOY CHECK"
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={runCheck}
              disabled={confirmText !== "DEPLOY CHECK" || isLoading}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                "Run Check"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
