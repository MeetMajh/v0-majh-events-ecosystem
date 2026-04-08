"use client"

import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, TrendingUp, DollarSign, Users, Trophy } from "lucide-react"

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
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function PlatformRevenue() {
  const { data, error, isLoading } = useSWR<RevenueData>(
    "/api/admin/revenue",
    fetcher,
    { refreshInterval: 300000 } // 5 minutes
  )

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-destructive">Failed to load revenue data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Revenue Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Fees</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.platformFees)}</div>
            <p className="text-xs text-muted-foreground">5% of transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tournaments</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.tournamentCount}</div>
            <p className="text-xs text-muted-foreground">Paid tournaments hosted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeUsers}</div>
            <p className="text-xs text-muted-foreground">Made a payment</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Revenue</CardTitle>
          <CardDescription>Revenue breakdown by month</CardDescription>
        </CardHeader>
        <CardContent>
          {data.monthlyData.length > 0 ? (
            <div className="space-y-4">
              {data.monthlyData.map((month) => (
                <div key={month.month} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{month.month}</p>
                    <p className="text-xs text-muted-foreground">{month.tournaments} tournaments</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(month.revenue)}</p>
                    <p className="text-xs text-emerald-600">+{formatCurrency(month.fees)} fees</p>
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
