"use client"

import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Bar, BarChart, Line, LineChart } from "recharts"
import { Loader2, TrendingUp, TrendingDown, DollarSign, Users, Trophy, ArrowUpRight, Calendar } from "lucide-react"
import { useState } from "react"

interface RevenueData {
  totalRevenue: number
  platformFees: number
  tournamentCount: number
  activeUsers: number
  monthlyData: {
    month: string
    revenue: number
    fees: number
    tournaments: number
  }[]
  dailyData?: {
    date: string
    revenue: number
    fees: number
  }[]
  growth?: {
    revenue: number
    fees: number
    users: number
  }
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
  fees: {
    label: "Fees",
    color: "hsl(var(--chart-2))",
  },
  tournaments: {
    label: "Tournaments",
    color: "hsl(var(--chart-3))",
  },
}

export function PlatformRevenue() {
  const [timeRange, setTimeRange] = useState("30d")
  const { data, error, isLoading } = useSWR<RevenueData>(
    `/api/admin/revenue?range=${timeRange}`,
    fetcher,
    { refreshInterval: 300000 }
  )

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100)
  }

  const formatCompactCurrency = (cents: number) => {
    const dollars = cents / 100
    if (dollars >= 1000000) return `$${(dollars / 1000000).toFixed(1)}M`
    if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}K`
    return `$${dollars.toFixed(0)}`
  }

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-destructive">Failed to load revenue data</p>
        </CardContent>
      </Card>
    )
  }

  const revenueGrowth = data.growth?.revenue ?? 0
  const feesGrowth = data.growth?.fees ?? 0
  const usersGrowth = data.growth?.users ?? 0

  // Generate sample daily data if not provided
  const dailyData = data.dailyData || data.monthlyData.map((m, i) => ({
    date: m.month,
    revenue: m.revenue,
    fees: m.fees,
  }))

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Revenue Analytics</span>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Revenue Stats - Vercel-style cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(data.totalRevenue)}</p>
                <div className="flex items-center gap-1">
                  {revenueGrowth >= 0 ? (
                    <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-xs">
                      <TrendingUp className="mr-1 h-3 w-3" />
                      +{revenueGrowth}%
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-red-500/20 bg-red-500/10 text-red-500 text-xs">
                      <TrendingDown className="mr-1 h-3 w-3" />
                      {revenueGrowth}%
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">vs last period</span>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Platform Fees
                </p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(data.platformFees)}</p>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-xs">
                    <TrendingUp className="mr-1 h-3 w-3" />
                    +{feesGrowth}%
                  </Badge>
                  <span className="text-xs text-muted-foreground">5% rate</span>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Tournaments
                </p>
                <p className="text-2xl font-bold tracking-tight">{data.tournamentCount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Paid tournaments hosted</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                <Trophy className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Paid Users
                </p>
                <p className="text-2xl font-bold tracking-tight">{data.activeUsers.toLocaleString()}</p>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-xs">
                    <TrendingUp className="mr-1 h-3 w-3" />
                    +{usersGrowth}%
                  </Badge>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
                <Users className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid - Vercel/Meta style */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Area Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Revenue</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-foreground">{formatCurrency(data.totalRevenue)}</span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Fees</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="feesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142 76% 36%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(142 76% 36%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCompactCurrency(value)}
                  className="text-muted-foreground"
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(217 91% 60%)"
                  fill="url(#revenueGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="fees"
                  stroke="hsl(142 76% 36%)"
                  fill="url(#feesGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Tournament Bar Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Tournaments</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-foreground">{data.tournamentCount}</span>
                  <span className="text-muted-foreground">total</span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={data.monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="tournaments"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Monthly Breakdown</CardTitle>
          <CardDescription>Detailed revenue by month</CardDescription>
        </CardHeader>
        <CardContent>
          {data.monthlyData.length > 0 ? (
            <div className="space-y-1">
              <div className="grid grid-cols-4 gap-4 border-b border-border pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <div>Month</div>
                <div className="text-right">Revenue</div>
                <div className="text-right">Fees</div>
                <div className="text-right">Tournaments</div>
              </div>
              {data.monthlyData.map((month) => (
                <div 
                  key={month.month} 
                  className="grid grid-cols-4 gap-4 border-b border-border/50 py-3 last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <div className="text-sm font-medium">{month.month}</div>
                  <div className="text-right text-sm">{formatCurrency(month.revenue)}</div>
                  <div className="text-right text-sm text-emerald-500">+{formatCurrency(month.fees)}</div>
                  <div className="text-right">
                    <Badge variant="secondary" className="text-xs">
                      {month.tournaments}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">No revenue data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
