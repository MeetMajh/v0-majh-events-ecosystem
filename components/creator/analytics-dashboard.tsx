"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  Play,
  ChevronRight,
  BarChart3,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { cn } from "@/lib/utils"
import type { CreatorOverview } from "@/lib/clip-analytics-actions"

interface CreatorAnalyticsDashboardProps {
  overview: CreatorOverview
  bestTimes: Array<{ hour: number; day: string; score: number }>
  creatorId: string
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
  change, 
  icon: Icon,
  trend = "neutral"
}: { 
  title: string
  value: string | number
  change?: string
  icon: React.ElementType
  trend?: "up" | "down" | "neutral"
}) {
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change && (
              <p className={cn(
                "text-xs mt-1",
                trend === "up" && "text-emerald-500",
                trend === "down" && "text-red-500",
                trend === "neutral" && "text-muted-foreground"
              )}>
                {change}
              </p>
            )}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TopClipsTable({ clips }: { clips: CreatorOverview["topPerformingClips"] }) {
  return (
    <div className="space-y-3">
      {clips.map((clip, index) => (
        <Link
          key={clip.id}
          href={`/dashboard/creator/analytics/${clip.id}`}
          className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
        >
          <span className="text-lg font-bold text-muted-foreground w-6">
            {index + 1}
          </span>
          
          <div className="relative w-16 h-10 rounded overflow-hidden bg-muted">
            {clip.thumbnail_url ? (
              <img 
                src={clip.thumbnail_url} 
                alt={clip.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Play className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{clip.title}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {formatNumber(clip.views)}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {clip.engagementRate.toFixed(1)}%
              </span>
            </div>
          </div>
          
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
    </div>
  )
}

function BestTimesChart({ times }: { times: CreatorAnalyticsDashboardProps["bestTimes"] }) {
  return (
    <div className="space-y-3">
      {times.map((time, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="w-20 text-sm text-muted-foreground">
            {time.day.slice(0, 3)}
          </div>
          <div className="flex-1">
            <div 
              className="h-6 rounded bg-primary/20 relative overflow-hidden"
              style={{ width: `${time.score * 100}%` }}
            >
              <div 
                className="absolute inset-0 bg-primary"
                style={{ width: `${time.score * 100}%` }}
              />
            </div>
          </div>
          <div className="w-16 text-sm font-medium">
            {time.hour}:00
          </div>
        </div>
      ))}
    </div>
  )
}

export function CreatorAnalyticsDashboard({
  overview,
  bestTimes,
  creatorId
}: CreatorAnalyticsDashboardProps) {
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("7d")
  
  // Sample chart data (would come from actual data)
  const chartData = [
    { date: "Mon", views: 1200, engagement: 89 },
    { date: "Tue", views: 1800, engagement: 124 },
    { date: "Wed", views: 2400, engagement: 178 },
    { date: "Thu", views: 1600, engagement: 112 },
    { date: "Fri", views: 3200, engagement: 245 },
    { date: "Sat", views: 4100, engagement: 320 },
    { date: "Sun", views: 3800, engagement: 289 },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Creator Analytics</h1>
          <p className="text-muted-foreground">
            Track your content performance and grow your audience
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={period === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("7d")}
          >
            7 Days
          </Button>
          <Button
            variant={period === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("30d")}
          >
            30 Days
          </Button>
          <Button
            variant={period === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("all")}
          >
            All Time
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Views"
          value={formatNumber(overview.totalViews)}
          change="+12% from last week"
          icon={Eye}
          trend="up"
        />
        <StatCard
          title="Followers"
          value={formatNumber(overview.totalFollowers)}
          change={`+${overview.followersGained7d} this week`}
          icon={Users}
          trend="up"
        />
        <StatCard
          title="Engagement Rate"
          value={`${overview.avgEngagementRate.toFixed(1)}%`}
          change="Above average"
          icon={TrendingUp}
          trend="up"
        />
        <StatCard
          title="Est. Earnings"
          value={`$${overview.estimatedEarnings.toFixed(2)}`}
          change="Based on views"
          icon={DollarSign}
          trend="neutral"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Views Chart */}
        <Card className="lg:col-span-2 bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Views Over Time</CardTitle>
            <CardDescription>Daily view count for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#viewsGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Best Times */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Best Time to Post
            </CardTitle>
            <CardDescription>When your audience is most active</CardDescription>
          </CardHeader>
          <CardContent>
            <BestTimesChart times={bestTimes} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Clips */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Top Performing Clips</CardTitle>
              <CardDescription>Your best content by views</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/creator/clips">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <TopClipsTable clips={overview.topPerformingClips} />
          </CardContent>
        </Card>

        {/* Quick Insights */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Quick Insights
            </CardTitle>
            <CardDescription>AI-powered recommendations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-emerald-500 mt-0.5" />
                <div>
                  <p className="font-medium text-emerald-500">Growing Audience</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You gained {overview.followersGained7d} followers this week. Keep posting consistently!
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-500">Engagement Tip</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your best performing clips are under 30 seconds. Consider keeping clips short and punchy.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <p className="font-medium text-purple-500">Optimal Posting</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your audience is most active on {bestTimes[0]?.day || "Friday"} around {bestTimes[0]?.hour || 18}:00.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
