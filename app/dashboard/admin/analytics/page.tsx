import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { getPlatformAnalytics } from "@/lib/analytics-pipeline"
import { formatCents } from "@/lib/format"
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard"
import { 
  BarChart3, 
  Users, 
  Eye, 
  TrendingUp, 
  DollarSign, 
  MousePointerClick,
  Calendar,
  Activity,
  Loader2
} from "lucide-react"

export const metadata = { title: "Analytics - Admin - MAJH EVENTS" }

async function getAnalyticsData(period: "today" | "7d" | "30d") {
  const supabase = await createClient()
  const now = new Date()
  
  let startDate: Date
  switch (period) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
  }

  // Get platform analytics from pipeline
  const platformAnalytics = await getPlatformAnalytics(period)

  // Get user metrics
  const [
    { count: totalUsers },
    { count: newUsers },
    { count: activeCreators },
    { count: totalEvents },
    { count: totalTournaments },
    { data: recentSignups },
    { data: eventViews },
    { data: clipViews },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", startDate.toISOString()),
    supabase.from("player_media").select("player_id", { count: "exact", head: true }).eq("visibility", "public"),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("tournaments").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("id, created_at").gte("created_at", startDate.toISOString()).order("created_at", { ascending: true }),
    supabase.from("events").select("id, title, view_count").order("view_count", { ascending: false }).limit(10),
    supabase.from("player_media").select("id, title, view_count, like_count").eq("visibility", "public").order("view_count", { ascending: false }).limit(10),
  ])

  // Get revenue data
  const { data: orders } = await supabase
    .from("orders")
    .select("total_cents, created_at, status")
    .gte("created_at", startDate.toISOString())
    .neq("status", "cancelled")

  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_cents || 0), 0) || 0
  const orderCount = orders?.length || 0

  // Get tournament prize pools
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("prize_pool_cents, created_at")
    .gte("created_at", startDate.toISOString())

  const totalPrizePool = tournaments?.reduce((sum, t) => sum + (t.prize_pool_cents || 0), 0) || 0

  // Generate time series data for charts
  const signupsByDay: Record<string, number> = {}
  const revenueByDay: Record<string, number> = {}
  
  // Initialize all days in the period
  const days = period === "today" ? 1 : period === "7d" ? 7 : 30
  for (let i = 0; i < days; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = date.toISOString().split("T")[0]
    signupsByDay[key] = 0
    revenueByDay[key] = 0
  }

  // Fill in signup data
  recentSignups?.forEach((user: any) => {
    const key = user.created_at?.split("T")[0]
    if (key && signupsByDay[key] !== undefined) {
      signupsByDay[key]++
    }
  })

  // Fill in revenue data
  orders?.forEach((order: any) => {
    const key = order.created_at?.split("T")[0]
    if (key && revenueByDay[key] !== undefined) {
      revenueByDay[key] += order.total_cents || 0
    }
  })

  // Convert to chart-friendly format
  const signupsChartData = Object.entries(signupsByDay)
    .map(([date, count]) => ({ date, signups: count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const revenueChartData = Object.entries(revenueByDay)
    .map(([date, cents]) => ({ date, revenue: cents / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    period,
    metrics: {
      totalUsers: totalUsers || 0,
      newUsers: newUsers || 0,
      activeCreators: activeCreators || 0,
      totalEvents: totalEvents || 0,
      totalTournaments: totalTournaments || 0,
      totalRevenue,
      orderCount,
      totalPrizePool,
      activeUsers: platformAnalytics.users.active,
      totalPageViews: platformAnalytics.events.total,
      adImpressions: platformAnalytics.ads.impressions,
      adClicks: platformAnalytics.ads.clicks,
      adCTR: platformAnalytics.ads.ctr,
      adSpend: platformAnalytics.ads.spend_cents,
    },
    eventsByType: platformAnalytics.events.byType,
    eventsByName: platformAnalytics.events.byName,
    topEvents: eventViews || [],
    topClips: clipViews || [],
    charts: {
      signups: signupsChartData,
      revenue: revenueChartData,
    },
  }
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

async function AnalyticsContent({ period }: { period: "today" | "7d" | "30d" }) {
  const data = await getAnalyticsData(period)
  return <AnalyticsDashboard data={data} />
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  await requireRole(["owner", "manager"])
  const params = await searchParams
  const period = (params.period as "today" | "7d" | "30d") || "7d"

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>
          <p className="text-muted-foreground">
            Track platform performance, user engagement, and revenue metrics.
          </p>
        </div>
        
        {/* Period Selector */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1">
          <PeriodButton period="today" currentPeriod={period} />
          <PeriodButton period="7d" currentPeriod={period} label="7 Days" />
          <PeriodButton period="30d" currentPeriod={period} label="30 Days" />
        </div>
      </div>

      <Suspense fallback={<LoadingState />}>
        <AnalyticsContent period={period} />
      </Suspense>
    </div>
  )
}

function PeriodButton({ 
  period, 
  currentPeriod, 
  label 
}: { 
  period: string
  currentPeriod: string
  label?: string 
}) {
  const isActive = period === currentPeriod
  const displayLabel = label || (period === "today" ? "Today" : period)
  
  return (
    <a
      href={`/dashboard/admin/analytics?period=${period}`}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {displayLabel}
    </a>
  )
}
