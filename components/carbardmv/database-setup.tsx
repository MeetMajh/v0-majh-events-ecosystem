"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, AlertTriangle, Database, Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface TableStatus {
  table: string
  exists: boolean
}

export function DatabaseSetup() {
  const [status, setStatus] = useState<{ ready: boolean; results: TableStatus[]; sql?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
    setLoading(true)
    try {
      const res = await fetch("/api/migrate/carbardmv")
      const data = await res.json()
      setStatus(data)
    } catch {
      toast.error("Failed to check database status")
    }
    setLoading(false)
  }

  async function runMigration() {
    setRunning(true)
    try {
      const res = await fetch("/api/migrate/carbardmv", { method: "POST" })
      const data = await res.json()
      
      if (data.success) {
        toast.success("Database tables are ready!")
        checkStatus()
      } else {
        toast.error("Some tables need manual setup")
        setStatus(prev => prev ? { ...prev, sql: data.sql } : null)
      }
    } catch {
      toast.error("Migration failed")
    }
    setRunning(false)
  }

  function copySQL() {
    if (status?.sql) {
      navigator.clipboard.writeText(status.sql)
      toast.success("SQL copied to clipboard")
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="h-4 w-4 animate-pulse" />
            Checking database status...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status?.ready) {
    return null // Don't show anything if database is ready
  }

  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Database Setup Required
        </CardTitle>
        <CardDescription>
          Some database tables need to be created before you can use staff scheduling and prep lists.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Table Status */}
        <div className="flex flex-wrap gap-2">
          {status?.results.map((r) => (
            <Badge 
              key={r.table} 
              variant={r.exists ? "default" : "destructive"}
              className="gap-1"
            >
              {r.exists ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {r.table}
            </Badge>
          ))}
        </div>

        {/* SQL to run manually */}
        {status?.sql && (
          <Alert>
            <AlertTitle>Manual Setup Required</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p className="text-sm">
                Tables cannot be created automatically. Please run the following SQL in your Supabase dashboard:
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copySQL}>
                  <Copy className="mr-2 h-3 w-3" />
                  Copy SQL
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a 
                    href="https://supabase.com/dashboard/project/_/sql/new" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-3 w-3" />
                    Open Supabase SQL Editor
                  </a>
                </Button>
              </div>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-3 text-xs">
                {status.sql}
              </pre>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button onClick={runMigration} disabled={running}>
            {running ? "Setting up..." : "Run Setup"}
          </Button>
          <Button variant="outline" onClick={checkStatus}>
            Refresh Status
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
