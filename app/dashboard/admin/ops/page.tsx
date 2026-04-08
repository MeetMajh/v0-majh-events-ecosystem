"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

interface LiveMatch {
  id: string
  tournament: string
  game: string
  players: [string, string]
  score: [number, number]
  viewers: number
  status: "live" | "starting" | "ending"
}

interface RevenueMetric {
  current: number
  previous: number
  change: number
}

interface ModerationAlert {
  id: string
  type: "content" | "chat" | "user"
  severity: "low" | "medium" | "high"
  message: string
  timestamp: Date
}

interface SystemHealth {
  service: string
  status: "healthy" | "degraded" | "down"
  latency: number
  uptime: number
}

// ══════════════════════════════════════════
// MOCK DATA GENERATORS
// ══════════════════════════════════════════

function generateLiveMatches(): LiveMatch[] {
  return [
    {
      id: "1",
      tournament: "MAJH Pro League",
      game: "Magic: The Gathering",
      players: ["DragonSlayer99", "MysticMage"],
      score: [2, 1],
      viewers: 1247,
      status: "live",
    },
    {
      id: "2",
      tournament: "Yu-Gi-Oh Championship",
      game: "Yu-Gi-Oh!",
      players: ["DuelMaster", "CardKing"],
      score: [1, 1],
      viewers: 892,
      status: "live",
    },
    {
      id: "3",
      tournament: "Pokemon Worlds",
      game: "Pokemon TCG",
      players: ["PikaMain", "CharizardPro"],
      score: [0, 0],
      viewers: 2103,
      status: "starting",
    },
  ]
}

function generateSystemHealth(): SystemHealth[] {
  return [
    { service: "API Gateway", status: "healthy", latency: 45, uptime: 99.99 },
    { service: "Database", status: "healthy", latency: 12, uptime: 99.97 },
    { service: "CDN", status: "healthy", latency: 8, uptime: 100 },
    { service: "Stream Server", status: "healthy", latency: 23, uptime: 99.95 },
    { service: "Worker Queue", status: "healthy", latency: 156, uptime: 99.89 },
    { service: "Search Index", status: "healthy", latency: 67, uptime: 99.92 },
  ]
}

// ══════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════

export default function OpsPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)
  
  // Real-time metrics (simulated)
  const [metrics, setMetrics] = useState({
    activeUsers: 3247,
    concurrentViewers: 4521,
    liveMatches: 12,
    activeStreams: 8,
    clipsUploaded: 47,
    revenuePerMinute: 234,
    fillRate: 87.3,
    moderationQueue: 23,
  })
  
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>(generateLiveMatches())
  const [systemHealth, setSystemHealth] = useState<SystemHealth[]>(generateSystemHealth())
  const [recentAlerts, setRecentAlerts] = useState<ModerationAlert[]>([
    { id: "1", type: "content", severity: "medium", message: "Flagged clip awaiting review", timestamp: new Date() },
    { id: "2", type: "chat", severity: "low", message: "Chat filter triggered in Match #1247", timestamp: new Date(Date.now() - 60000) },
    { id: "3", type: "user", severity: "high", message: "Multiple reports on user: ToxicPlayer123", timestamp: new Date(Date.now() - 120000) },
  ])
  
  // Simulated real-time updates
  useEffect(() => {
    if (!autoRefresh) return
    
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        activeUsers: prev.activeUsers + Math.floor(Math.random() * 20 - 10),
        concurrentViewers: prev.concurrentViewers + Math.floor(Math.random() * 50 - 25),
        revenuePerMinute: Math.max(0, prev.revenuePerMinute + Math.floor(Math.random() * 40 - 20)),
        fillRate: Math.min(100, Math.max(60, prev.fillRate + (Math.random() * 2 - 1))),
      }))
      setLastUpdate(new Date())
    }, 5000)
    
    return () => clearInterval(interval)
  }, [autoRefresh])
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }
  
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
              autoRefresh ? "bg-green-500 animate-pulse" : "bg-gray-400"
            )} />
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", autoRefresh && "animate-spin")} />
            {autoRefresh ? "Auto" : "Paused"}
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Main Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <MetricCard
          icon={Users}
          label="Active Users"
          value={metrics.activeUsers.toLocaleString()}
          trend={+3.2}
        />
        <MetricCard
          icon={Eye}
          label="Viewers"
          value={metrics.concurrentViewers.toLocaleString()}
          trend={+5.1}
        />
        <MetricCard
          icon={Tv}
          label="Live Matches"
          value={metrics.liveMatches.toString()}
          trend={0}
        />
        <MetricCard
          icon={Radio}
          label="Streams"
          value={metrics.activeStreams.toString()}
          trend={+2}
        />
        <MetricCard
          icon={Video}
          label="Clips Today"
          value={metrics.clipsUploaded.toString()}
          trend={+12}
        />
        <MetricCard
          icon={DollarSign}
          label="Rev/Min"
          value={`$${(metrics.revenuePerMinute / 100).toFixed(2)}`}
          trend={+8.4}
          highlight
        />
        <MetricCard
          icon={BarChart3}
          label="Fill Rate"
          value={`${metrics.fillRate.toFixed(1)}%`}
          trend={-0.3}
        />
        <MetricCard
          icon={Shield}
          label="Mod Queue"
          value={metrics.moderationQueue.toString()}
          trend={-5}
          alert={metrics.moderationQueue > 50}
        />
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live Matches Panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Play className="h-5 w-5 text-red-500" />
                Live Activity
              </CardTitle>
              <Badge variant="destructive" className="animate-pulse">
                {liveMatches.length} LIVE
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {liveMatches.map((match) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={match.status === "live" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {match.status.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-medium">{match.tournament}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{match.game}</span>
                        <span className="text-muted-foreground">|</span>
                        <span>{match.players[0]} vs {match.players[1]}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold tabular-nums">
                        {match.score[0]} - {match.score[1]}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {match.viewers.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Revenue Panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-green-500" />
              Revenue (Real-Time)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="text-4xl font-bold text-green-500">
                  ${(metrics.revenuePerMinute * 60 / 100).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Revenue this hour</div>
              </div>
              
              <div className="space-y-3">
                <RevenueRow label="Ad Revenue" value={156} percent={67} />
                <RevenueRow label="Sponsorships" value={45} percent={19} />
                <RevenueRow label="Subscriptions" value={23} percent={10} />
                <RevenueRow label="Tips" value={10} percent={4} />
              </div>
              
              <div className="pt-3 border-t">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Top Campaign</span>
                  <span className="font-medium">GameStop TCG</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fill Rate</span>
                  <span className="font-medium">{metrics.fillRate.toFixed(1)}%</span>
                </div>
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
                Moderation Alerts
              </CardTitle>
              <Badge variant="outline">{recentAlerts.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {recentAlerts.map((alert) => (
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
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{alert.message}</p>
                  </div>
                ))}
              </div>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Avg Response: <strong>45ms</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span>Worker Queue: <strong>12 jobs</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span>Chat Messages/min: <strong>1,247</strong></span>
          </div>
        </div>
        <div className="text-muted-foreground">
          MAJH Platform v2.0 | All Systems Operational
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
  trend,
  highlight,
  alert,
}: {
  icon: any
  label: string
  value: string
  trend: number
  highlight?: boolean
  alert?: boolean
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
        <div className="text-xl font-bold">{value}</div>
        {trend !== 0 && (
          <div className={cn(
            "text-xs flex items-center gap-1",
            trend > 0 ? "text-green-500" : "text-red-500"
          )}>
            <TrendingUp className={cn("h-3 w-3", trend < 0 && "rotate-180")} />
            {Math.abs(trend)}%
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RevenueRow({
  label,
  value,
  percent,
}: {
  label: string
  value: number
  percent: number
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">${value}</span>
      </div>
      <Progress value={percent} className="h-1.5" />
    </div>
  )
}
