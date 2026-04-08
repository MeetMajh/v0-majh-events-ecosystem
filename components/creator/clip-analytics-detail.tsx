"use client"

import Link from "next/link"
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Clock,
  RotateCcw,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info,
  Play,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import { cn } from "@/lib/utils"
import type { ClipAnalytics } from "@/lib/clip-analytics-actions"

interface ClipAnalyticsDetailProps {
  analytics: ClipAnalytics
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function StatCard({ 
  title, 
  value, 
  icon: Icon,
  subtitle
}: { 
  title: string
  value: string | number
  icon: React.ElementType
  subtitle?: string
}) {
  return (
    <div className="p-4 rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{title}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  )
}

function RetentionChart({ data }: { data: ClipAnalytics["retentionCurve"] }) {
  // Sample to reduce data points for visualization
  const sampledData = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 30)) === 0)
  
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sampledData}>
          <defs>
            <linearGradient id="retentionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="second" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickFormatter={(v) => `${v}s`}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, "Viewers"]}
            labelFormatter={(label) => `${label} seconds`}
          />
          <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="percentage"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#retentionGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function DropoffHeatmap({ segments }: { segments: ClipAnalytics["dropoffHeatmap"] }) {
  return (
    <div className="space-y-2">
      <div className="flex h-8 rounded-lg overflow-hidden">
        {segments.map((segment, index) => (
          <div
            key={index}
            className="flex-1 relative group cursor-pointer"
            style={{
              backgroundColor: `rgba(239, 68, 68, ${segment.intensity})`,
            }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/50 flex items-center justify-center transition-opacity">
              <span className="text-xs text-white font-medium">
                -{segment.dropoffRate.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0s</span>
        <span>Video End</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Hover over segments to see drop-off rates. Darker = more drop-off.
      </p>
    </div>
  )
}

function InsightCard({ insight }: { insight: ClipAnalytics["insights"][0] }) {
  const icons = {
    success: CheckCircle,
    warning: AlertTriangle,
    info: Info
  }
  const colors = {
    success: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    warning: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    info: "text-blue-500 bg-blue-500/10 border-blue-500/20"
  }
  
  const Icon = icons[insight.type]
  
  return (
    <div className={cn("p-4 rounded-lg border", colors[insight.type])}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5" />
        <div>
          <p className="font-medium">{insight.title}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {insight.description}
          </p>
          {insight.action && (
            <p className="text-sm font-medium mt-2">
              Tip: {insight.action}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function ClipAnalyticsDetail({ analytics }: ClipAnalyticsDetailProps) {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/creator/analytics">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{analytics.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatTime(analytics.duration_seconds)} duration
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Video + Stats */}
        <div className="space-y-6">
          {/* Video Preview */}
          <div className="aspect-[9/16] rounded-lg bg-muted overflow-hidden relative">
            {analytics.thumbnail_url ? (
              <img 
                src={analytics.thumbnail_url}
                alt={analytics.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Play className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Views"
              value={formatNumber(analytics.totalViews)}
              icon={Eye}
              subtitle={`${analytics.uniqueViewers} unique`}
            />
            <StatCard
              title="Likes"
              value={formatNumber(analytics.likes)}
              icon={Heart}
            />
            <StatCard
              title="Comments"
              value={formatNumber(analytics.comments)}
              icon={MessageSquare}
            />
            <StatCard
              title="Shares"
              value={formatNumber(analytics.shares)}
              icon={Share2}
            />
          </div>
        </div>

        {/* Center + Right - Charts + Insights */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Metrics */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold">
                    {analytics.avgWatchPercentage.toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg. Watch %</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold">
                    {analytics.completionRate.toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Completion Rate</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold">
                    {analytics.replayRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Replay Rate</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold">
                    {analytics.engagementRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Engagement</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Retention Curve */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Audience Retention</CardTitle>
              <CardDescription>
                Percentage of viewers watching at each point
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RetentionChart data={analytics.retentionCurve} />
            </CardContent>
          </Card>

          {/* Drop-off Heatmap */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Drop-off Heatmap</CardTitle>
              <CardDescription>
                Where viewers stop watching
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DropoffHeatmap segments={analytics.dropoffHeatmap} />
            </CardContent>
          </Card>

          {/* AI Insights */}
          {analytics.insights.length > 0 && (
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">AI Insights</CardTitle>
                <CardDescription>
                  Recommendations to improve your content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.insights.map((insight, index) => (
                  <InsightCard key={index} insight={insight} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
