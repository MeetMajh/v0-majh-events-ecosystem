"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Ticket,
  Loader2,
  Keyboard,
} from "lucide-react"

interface Event {
  id: string
  name: string
  starts_at: string
  status: string
}

interface Stats {
  total_tickets: number
  valid_tickets: number
  checked_in: number
  check_in_rate: number
}

interface ScanResult {
  success: boolean
  ticket_id?: string
  ticket_number?: string
  attendee_name?: string
  event_name?: string
  checked_in_at?: string
  error?: string
}

interface CheckInScannerProps {
  event: Event
  stats: Stats | null
  userId: string
}

export function CheckInScanner({ event, stats: initialStats, userId }: CheckInScannerProps) {
  const [stats, setStats] = useState<Stats | null>(initialStats)
  const [searchInput, setSearchInput] = useState("")
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const [recentScans, setRecentScans] = useState<ScanResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Auto-focus input for barcode scanner
  useEffect(() => {
    inputRef.current?.focus()

    const handleKeyDown = () => {
      inputRef.current?.focus()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Refresh stats periodically
  useEffect(() => {
    const refreshStats = async () => {
      const { data } = await supabase.rpc("get_event_stats", { p_event_id: event.id })
      if (data) setStats(data)
    }

    const interval = setInterval(refreshStats, 10000) // Every 10 seconds
    return () => clearInterval(interval)
  }, [event.id, supabase])

  const handleScan = async (input: string) => {
    if (!input.trim() || scanning) return

    setScanning(true)
    setLastResult(null)

    try {
      // Determine if input is QR code or ticket number
      const isQrCode = input.length === 32 // Hex encoded 16 bytes

      const { data, error } = isQrCode
        ? await supabase.rpc("scan_ticket_qr", {
            p_qr_code: input.trim(),
            p_performed_by: userId,
            p_location: "main_entrance",
          })
        : await supabase
            .from("tickets")
            .select("id")
            .eq("event_id", event.id)
            .eq("ticket_number", input.trim().toUpperCase())
            .single()
            .then(async ({ data: ticket, error: ticketError }) => {
              if (ticketError || !ticket) {
                return { data: { success: false, error: "Ticket not found" }, error: null }
              }
              return supabase.rpc("check_in_ticket", {
                p_ticket_id: ticket.id,
                p_performed_by: userId,
                p_location: "main_entrance",
              })
            })

      if (error) {
        setLastResult({ success: false, error: error.message })
      } else {
        setLastResult(data as ScanResult)
        if (data?.success) {
          setRecentScans(prev => [data as ScanResult, ...prev.slice(0, 9)])
          // Refresh stats
          const { data: newStats } = await supabase.rpc("get_event_stats", { p_event_id: event.id })
          if (newStats) setStats(newStats)
        }
      }
    } catch (err) {
      setLastResult({ success: false, error: "Scan failed" })
    } finally {
      setScanning(false)
      setSearchInput("")
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleScan(searchInput)
  }

  const checkInRate = stats ? stats.check_in_rate : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={`/dashboard/ticketing/${event.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Event
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-muted-foreground">Check-In Station</p>
        </div>
        <Badge variant={event.status === "published" ? "default" : "secondary"} className="text-sm">
          {event.status === "published" ? "Live" : event.status}
        </Badge>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{stats?.checked_in || 0}</div>
            <div className="text-sm text-muted-foreground">Checked In</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{stats?.valid_tickets || 0}</div>
            <div className="text-sm text-muted-foreground">Total Tickets</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{checkInRate}%</div>
            <div className="text-sm text-muted-foreground">Check-In Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Check-In Progress</span>
            <span className="font-medium">{stats?.checked_in || 0} / {stats?.valid_tickets || 0}</span>
          </div>
          <Progress value={checkInRate} className="h-3" />
        </CardContent>
      </Card>

      {/* Scanner Input */}
      <Card className="border-2 border-primary/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Scan Ticket
          </CardTitle>
          <CardDescription>
            Scan QR code or enter ticket number manually
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="Scan QR code or enter ticket number..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 h-12 text-lg"
                autoComplete="off"
                autoFocus
              />
            </div>
            <Button type="submit" size="lg" disabled={scanning || !searchInput.trim()}>
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check In"}
            </Button>
          </form>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Keyboard className="h-3 w-3" />
            Scanner input is auto-focused. Just scan!
          </div>
        </CardContent>
      </Card>

      {/* Last Scan Result */}
      {lastResult && (
        <Card className={lastResult.success ? "border-emerald-500 bg-emerald-500/5" : "border-red-500 bg-red-500/5"}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {lastResult.success ? (
                <CheckCircle2 className="h-12 w-12 text-emerald-500 flex-shrink-0" />
              ) : lastResult.error?.includes("Already") ? (
                <AlertCircle className="h-12 w-12 text-amber-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-12 w-12 text-red-500 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className={`text-xl font-bold ${lastResult.success ? "text-emerald-600" : "text-red-600"}`}>
                  {lastResult.success ? "Check-In Successful" : "Check-In Failed"}
                </h3>
                {lastResult.success ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-lg">{lastResult.attendee_name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{lastResult.ticket_number}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground mt-1">{lastResult.error}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Check-Ins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentScans.map((scan, i) => (
                <div
                  key={`${scan.ticket_id}-${i}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="font-medium">{scan.attendee_name}</span>
                    <span className="text-sm text-muted-foreground font-mono">
                      {scan.ticket_number}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {scan.checked_in_at && new Date(scan.checked_in_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
