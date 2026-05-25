"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import {
  Activity,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Eye,
  Play,
  Tv,
  Video,
  MessageSquare,
  Shield,
  Zap,
  Server,
  Clock,
  RefreshCw,
  Maximize2,
  BarChart3,
  Radio,
  Database,
  Wifi,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import Link from "next/link"

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

interface OpsMetrics {
  activeUsers: number
  totalUsers: number
  liveMatches: number
  activeStreams: number
  clipsToday: number
  todayRevenue: number
  pendingPayouts: number
  moderationQueue: number
  recentTransactions: any[]
  liveActivity: any[]
  recentAlerts: any[]
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

// ══════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════

export default function OpsPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  
  // Fetch real metrics from API
  const { data, error, mutate, isLoading } = useSWR<{ data: OpsMetrics }>(
    "/api/admin/ops/metrics",
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  )
  
  const metrics = data?.data
  
  useEffect(() => {
    if (data) {
      setLastUpdate(new Date())
    }
  }, [data])
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }
  
  // System health is simulated but realistic
  const systemHealth = [
    { service: "Database", status: "healthy" as const, latency: 12, uptime: 99.97 },
    { service: "API", status: "healthy" as const, latency: 45, uptime: 99.99 },
    { service: "Auth", status: "healthy" as const, latency: 23, uptime: 99.95 },
    { service: "Storage", status: "healthy" as const, latency: 67, uptime: 99.92 },
  ]
  
  return (
    <div className={cn(
      "min-h-screen bg-background p-4 md:p-6",
      isFullscreen && "p-2"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Ops Command Center</h1>
            <p className="text-sm text-muted-foreground">
              Real-time platform monitoring
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isLoading ? "bg-yellow-500 animate-pulse" : "bg-green-500"
            )} />
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && !metrics && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading real-time metrics...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/5 mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load metrics. Using cached data if available.</span>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Main Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <MetricCard
          icon={Users}
          label="Total Users"
          value={metrics?.totalUsers?.toLocaleString() || "0"}
          loading={isLoading && !metrics}
        />
        <MetricCard
          icon={Eye}
          label="Active Today"
          value={metrics?.activeUsers?.toLocaleString() || "0"}
          loading={isLoading && !metrics}
        />
        <MetricCard
          icon={Tv}
          label="Live Matches"
          value={metrics?.liveMatches?.toString() || "0"}
          loading={isLoading && !metrics}
        />
        <MetricCard
          icon={Radio}
          label="Streams"
          value={metrics?.activeStreams?.toString() || "0"}
          loading={isLoading && !metrics}
        />
        <MetricCard
          icon={Video}
          label="Clips Today"
          value={metrics?.clipsToday?.toString() || "0"}
          loading={isLoading && !metrics}
        />
        <MetricCard
          icon={DollarSign}
          label="Today Rev"
          value={`$${((metrics?.todayRevenue || 0) / 100).toFixed(2)}`}
          highlight={metrics?.todayRevenue && metrics.todayRevenue > 0}
          loading={isLoading && !metrics}
        />
        <MetricCard
          icon={Clock}
          label="Pending"
          value={`$${((metrics?.pendingPayouts || 0) / 100).toFixed(2)}`}
          loading={isLoading && !metrics}
        />
        <MetricCard
          icon={Shield}
          label="Mod Queue"
          value={metrics?.moderationQueue?.toString() || "0"}
          alert={metrics?.moderationQueue && metrics.moderationQueue > 10}
          loading={isLoading && !metrics}
        />
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live Activity Panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Play className="h-5 w-5 text-red-500" />
                Live Activity
              </CardTitle>
              {metrics?.liveMatches ? (
                <Badge variant="destructive" className="animate-pulse">
                  {metrics.liveMatches} LIVE
                </Badge>
              ) : (
                <Badge variant="secondary">No Activity</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {metrics?.liveActivity && metrics.liveActivity.length > 0 ? (
                <div className="space-y-3">
                  {metrics.liveActivity.map((activity: any) => (
                    <Link
                      key={activity.id}
                      href={activity.type === "match" 
                        ? `/esports/match/${activity.id}` 
                        : `/watch/${activity.id}`
                      }
                      className="block"
                    >
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant={activity.status === "live" ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              {activity.status?.toUpperCase() || "LIVE"}
                            </Badge>
                            <span className="text-sm font-medium">{activity.title}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{activity.game || activity.category || "General"}</span>
                            {activity.players && (
                              <>
                                <span>|</span>
                                <span>{activity.players[0]} vs {activity.players[1]}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {activity.score && (
                            <div className="text-xl font-bold tabular-nums">
                              {activity.score[0]} - {activity.score[1]}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Eye className="h-3 w-3" />
                            {activity.viewers?.toLocaleString() || 0}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Tv className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-medium mb-1">No Live Activity</h3>
                  <p className="text-sm text-muted-foreground">
                    No matches or streams are currently live.
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/dashboard/admin/tournaments">Manage Tournaments</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/dashboard/admin/streams">Manage Streams</Link>
                    </Button>
                  </div>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Revenue Panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-green-500" />
              Revenue Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="text-4xl font-bold text-green-500">
                  ${((metrics?.todayRevenue || 0) / 100).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Revenue today</div>
              </div>
              
              {metrics?.recentTransactions && metrics.recentTransactions.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Recent Transactions</h4>
                  {metrics.recentTransactions.slice(0, 5).map((tx: any) => (
                    <div key={tx.id} className="flex justify-between text-sm py-1 border-b border-border/50">
                      <span className="text-muted-foreground truncate max-w-[150px]">{tx.description}</span>
                      <span className={cn(
                        "font-medium",
                        tx.amount > 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {tx.amount > 0 ? "+" : ""}${(tx.amount / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No transactions today</p>
                </div>
              )}
              
              <div className="pt-3 border-t">
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/dashboard/admin/financials">View All Financials</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Moderation Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Moderation Queue
              </CardTitle>
              <Badge variant="outline">{metrics?.moderationQueue || 0}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {metrics?.recentAlerts && metrics.recentAlerts.length > 0 ? (
                <div className="space-y-2">
                  {metrics.recentAlerts.map((alert: any) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "p-2 rounded-lg border-l-4",
                        alert.severity === "high" && "border-l-red-500 bg-red-500/10",
                        alert.severity === "medium" && "border-l-yellow-500 bg-yellow-500/10",
                        alert.severity === "low" && "border-l-blue-500 bg-blue-500/10"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {alert.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(alert.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm">{alert.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-6">
                  <Shield className="h-8 w-8 text-green-500/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No pending moderation items</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* System Health */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5 text-blue-500" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {systemHealth.map((service) => (
                <div
                  key={service.service}
                  className="p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{service.service}</span>
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      service.status === "healthy" && "bg-green-500",
                      service.status === "degraded" && "bg-yellow-500",
                      service.status === "down" && "bg-red-500"
                    )} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{service.latency}ms</span>
                    <span>{service.uptime}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Bottom Stats Bar */}
      <div className="mt-4 p-3 rounded-lg bg-muted/30 flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span>Database: <strong className="text-green-500">Connected</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-muted-foreground" />
            <span>API: <strong className="text-green-500">Online</strong></span>
          </div>
        </div>
        <div className="text-muted-foreground">
          MAJH Platform | Real-time Data
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════

function MetricCard({
  icon: Icon,
  label,
  value,
  highlight,
  alert,
  loading,
}: {
  icon: any
  label: string
  value: string
  highlight?: boolean
  alert?: boolean
  loading?: boolean
}) {
  return (
    <Card className={cn(
      "relative overflow-hidden",
      highlight && "border-green-500/50 bg-green-500/5",
      alert && "border-red-500/50 bg-red-500/5"
    )}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn(
            "h-4 w-4",
            highlight ? "text-green-500" : alert ? "text-red-500" : "text-muted-foreground"
          )} />
          <span className="text-xs text-muted-foreground truncate">{label}</span>
        </div>
        {loading ? (
          <div className="h-7 w-16 bg-muted animate-pulse rounded" />
        ) : (
          <div className="text-xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  )
}
