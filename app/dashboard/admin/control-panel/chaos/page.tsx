"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Zap,
  Shield,
  ShieldAlert,
  Clock,
  Activity,
  AlertCircle,
  Play,
  History
} from "lucide-react"

interface TestResult {
  test: string
  passed: boolean
  error?: string
  [key: string]: unknown
}

interface ChaosRun {
  id: string
  test_type: string
  status: "running" | "passed" | "failed" | "error"
  started_at: string
  completed_at: string | null
  results: TestResult[]
  triggered_by: string
}

interface ChaosState {
  chaosModeEnabled: boolean
  history: ChaosRun[]
}

const TEST_DESCRIPTIONS: Record<string, string> = {
  wallet_corruption: "Injects balance corruption and verifies reconciliation detects it",
  lockdown_enforcement: "Triggers emergency lockdown and verifies operations are blocked",
  risk_detection: "Injects suspicious activity patterns and verifies risk flags are raised",
  alert_pipeline: "Logs a critical alert and verifies it reaches the audit log",
  idempotency: "Attempts duplicate operations and verifies they are rejected",
  wallet_freeze: "Freezes a wallet and verifies withdrawals are blocked"
}

export default function ChaosTestPage() {
  const [state, setState] = useState<ChaosState | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [currentResults, setCurrentResults] = useState<TestResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchState = async () => {
    try {
      const res = await fetch("/api/admin/chaos")
      if (!res.ok) throw new Error("Failed to fetch chaos state")
      const data = await res.json()
      setState(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchState()
  }, [])

  const toggleChaosMode = async (enabled: boolean) => {
    try {
      const res = await fetch("/api/admin/chaos/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      })
      if (!res.ok) throw new Error("Failed to toggle chaos mode")
      setState(prev => prev ? { ...prev, chaosModeEnabled: enabled } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle")
    }
  }

  const runChaosTests = async () => {
    if (confirmText !== "RUN CHAOS") return
    
    setConfirmOpen(false)
    setConfirmText("")
    setRunning(true)
    setCurrentResults(null)
    setError(null)

    try {
      const res = await fetch("/api/admin/chaos", { method: "POST" })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to run chaos tests")
      }
      
      if (data.results) {
        setCurrentResults(data.results)
      }
      
      // Refresh history
      await fetchState()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setRunning(false)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const getTestIcon = (passed: boolean) => {
    return passed 
      ? <CheckCircle className="h-5 w-5 text-emerald-400" />
      : <XCircle className="h-5 w-5 text-red-400" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  const passedCount = currentResults?.filter(r => r.passed).length || 0
  const totalCount = currentResults?.length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Chaos Testing Harness</h1>
          <p className="text-zinc-400 mt-1">
            Automated integrity verification for financial operations
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={state?.chaosModeEnabled 
            ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
            : "border-zinc-700 text-zinc-500"
          }
        >
          {state?.chaosModeEnabled ? "CHAOS MODE ENABLED" : "CHAOS MODE DISABLED"}
        </Badge>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="bg-red-900/20 border-red-900">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Chaos Mode Toggle */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            Chaos Mode Control
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Enable chaos mode to allow running integrity tests. This is a safety gate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-zinc-200">Enable Chaos Testing</Label>
              <p className="text-xs text-zinc-500">
                Tests will inject temporary corruption to verify detection systems
              </p>
            </div>
            <Switch 
              checked={state?.chaosModeEnabled || false}
              onCheckedChange={toggleChaosMode}
            />
          </div>
        </CardContent>
      </Card>

      {/* Run Tests */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-400" />
            Run Chaos Suite
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Execute all integrity tests to verify financial system health
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-amber-900/20 border-amber-900/50">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <AlertTitle className="text-amber-200">Warning</AlertTitle>
            <AlertDescription className="text-amber-300/80">
              This will temporarily inject test data and corruption to verify detection systems.
              All changes are automatically rolled back after each test.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(TEST_DESCRIPTIONS).map(([test, desc]) => (
              <div key={test} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <p className="font-medium text-zinc-200 text-sm">
                  {test.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                </p>
                <p className="text-xs text-zinc-500 mt-1">{desc}</p>
              </div>
            ))}
          </div>

          <Button 
            onClick={() => setConfirmOpen(true)}
            disabled={!state?.chaosModeEnabled || running}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Chaos Test Suite
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Current Results */}
      {currentResults && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-400" />
              Latest Results
              <Badge 
                variant="outline" 
                className={passedCount === totalCount 
                  ? "ml-2 border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                  : "ml-2 border-red-500/50 bg-red-500/10 text-red-400"
                }
              >
                {passedCount}/{totalCount} PASSED
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentResults.map((result, i) => (
                <div 
                  key={i}
                  className={`p-4 rounded-lg border ${
                    result.passed 
                      ? "bg-emerald-900/10 border-emerald-900/30" 
                      : "bg-red-900/10 border-red-900/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getTestIcon(result.passed)}
                      <div>
                        <p className="font-medium text-zinc-200">
                          {result.test.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {TEST_DESCRIPTIONS[result.test] || "Test completed"}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={result.passed 
                        ? "border-emerald-500/50 text-emerald-400" 
                        : "border-red-500/50 text-red-400"
                      }
                    >
                      {result.passed ? "PASSED" : "FAILED"}
                    </Badge>
                  </div>
                  {result.error && (
                    <p className="mt-2 text-sm text-red-400 bg-red-900/20 p-2 rounded">
                      Error: {result.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <History className="h-5 w-5 text-zinc-400" />
            Test History
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Previous chaos test runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state?.history && state.history.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {state.history.map((run) => (
                  <div 
                    key={run.id}
                    className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {run.status === "passed" ? (
                          <Shield className="h-4 w-4 text-emerald-400" />
                        ) : run.status === "failed" ? (
                          <ShieldAlert className="h-4 w-4 text-red-400" />
                        ) : run.status === "running" ? (
                          <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-zinc-400" />
                        )}
                        <span className="font-medium text-zinc-200">
                          {run.test_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                      <Badge 
                        variant="outline"
                        className={
                          run.status === "passed" 
                            ? "border-emerald-500/50 text-emerald-400"
                            : run.status === "failed"
                            ? "border-red-500/50 text-red-400"
                            : run.status === "running"
                            ? "border-amber-500/50 text-amber-400"
                            : "border-zinc-700 text-zinc-500"
                        }
                      >
                        {run.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(run.started_at)}
                      </span>
                      {run.results && (
                        <span>
                          {run.results.filter(r => r.passed).length}/{run.results.length} tests passed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No test runs yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Confirm Chaos Test
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              This will run 6 automated integrity tests that temporarily inject test data
              and corruption into your system. All changes are automatically rolled back.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="bg-red-900/20 border-red-900/50">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300/80">
                Type <span className="font-mono font-bold">RUN CHAOS</span> to confirm
              </AlertDescription>
            </Alert>
            <Input 
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RUN CHAOS"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 font-mono"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setConfirmOpen(false); setConfirmText("") }}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={runChaosTests}
              disabled={confirmText !== "RUN CHAOS"}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Run Tests
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
