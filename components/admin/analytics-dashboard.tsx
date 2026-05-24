"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCents } from "@/lib/format"
import { 
  BarChart3, 
  Users, 
  Eye, 
  TrendingUp, 
  DollarSign, 
  MousePointerClick,
  Calendar,
  Activity,
  Trophy,
  Video,
  ShoppingCart
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"

interface AnalyticsData {
  period: string
  metrics: {
    totalUsers: number
    newUsers: number
    activeCreators: number
    totalEvents: number
    totalTournaments: number
    totalRevenue: number
    orderCount: number
    totalPrizePool: number
    activeUsers: number
    totalPageViews: number
    adImpressions: number
    adClicks: number
    adCTR: number
    adSpend: number
  }
  eventsByType: Record<string, number>
  eventsByName: Record<string, number>
  topEvents: Array<{ id: string; title: string; view_count: number }>
  topClips: Array<{ id: string; title: string; view_count: number; like_count: number }>
  charts: {
    signups: Array<{ date: string; signups: number }>
    revenue: Array<{ date: string; revenue: number }>
  }
}

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const { metrics, charts, topEvents, topClips } = data

  // Chart colors
  const primaryColor = "#D4AF37"
  const secondaryColor = "#6366f1"

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Users"
          value={metrics.totalUsers.toLocaleString()}
          change={`+${metrics.newUsers} new`}
          icon={Users}
          trend="up"
        />
        <MetricCard
          title="Active Creators"
          value={metrics.activeCreators.toLocaleString()}
          icon={Video}
        />
        <MetricCard
          title="Total Revenue"
          value={formatCents(metrics.totalRevenue)}
          change={`${metrics.orderCount} orders`}
          icon={DollarSign}
          trend="up"
        />
        <MetricCard
          title="Page Views"
          value={metrics.totalPageViews.toLocaleString()}
          icon={Eye}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Events"
          value={metrics.totalEvents.toLocaleString()}
          icon={Calendar}
        />
        <MetricCard
          title="Tournaments"
          value={metrics.totalTournaments.toLocaleString()}
          change={formatCents(metrics.totalPrizePool) + " prizes"}
          icon={Trophy}
        />
        <MetricCard
          title="Ad Impressions"
          value={metrics.adImpressions.toLocaleString()}
          change={`${metrics.adCTR.toFixed(2)}% CTR`}
          icon={MousePointerClick}
        />
        <MetricCard
          title="Ad Revenue"
          value={formatCents(metrics.adSpend)}
          change={`${metrics.adClicks} clicks`}
          icon={BarChart3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Signups Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              User Signups
            </CardTitle>
            <CardDescription>New user registrations over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.signups}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: "#888", fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return `${date.getMonth() + 1}/${date.getDate()}`
                    }}
                  />
                  <YAxis tick={{ fill: "#888", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a2e",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="signups"
                    stroke={primaryColor}
                    fill={primaryColor}
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Revenue
            </CardTitle>
            <CardDescription>Daily revenue from orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.revenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: "#888", fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return `${date.getMonth() + 1}/${date.getDate()}`
                    }}
                  />
                  <YAxis 
                    tick={{ fill: "#888", fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a2e",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Content Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Top Events
            </CardTitle>
            <CardDescription>Most viewed events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topEvents.length > 0 ? (
                topEvents.slice(0, 5).map((event, index) => (
                  <div key={event.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium truncate max-w-[200px]">
                        {event.title || "Untitled Event"}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {(event.view_count || 0).toLocaleString()} views
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No events data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Clips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Top Clips
            </CardTitle>
            <CardDescription>Most viewed clips</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topClips.length > 0 ? (
                topClips.slice(0, 5).map((clip, index) => (
                  <div key={clip.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium truncate max-w-[200px]">
                        {clip.title || "Untitled Clip"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{(clip.view_count || 0).toLocaleString()} views</span>
                      <span>{(clip.like_count || 0).toLocaleString()} likes</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No clips data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  trend,
}: {
  title: string
  value: string
  change?: string
  icon: React.ElementType
  trend?: "up" | "down"
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change && (
              <p className={`text-xs ${trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
                {change}
              </p>
            )}
          </div>
          <div className="rounded-full bg-primary/10 p-3">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
