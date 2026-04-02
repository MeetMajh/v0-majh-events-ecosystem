import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatCents } from "@/lib/format"
import Link from "next/link"
import { Package, ShoppingCart, AlertTriangle, Users, Trophy, Play, Calendar, DollarSign, Scale } from "lucide-react"

export default async function AdminOverviewPage() {
  const { role } = await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const [
    { count: menuCount },
    { count: orderCount },
    { data: lowStock },
    { data: todayOrders },
    { count: liveTournaments },
    { count: upcomingTournaments },
    { data: disputedMatches },
  ] = await Promise.all([
    supabase.from("menu_items").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["pending", "confirmed", "preparing", "ready"]),
    supabase.from("inventory").select("*, menu_items(name)").eq("track_inventory", true).lt("quantity_on_hand", 10),
    supabase.from("orders").select("total_cents, status").gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase.from("tournaments").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.from("tournaments").select("*", { count: "exact", head: true }).in("status", ["published", "registration_open"]),
    supabase.from("tournament_matches").select("id").eq("status", "disputed"),
  ])

  const todayRevenue = todayOrders?.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.total_cents, 0) ?? 0

  const stats = [
    { label: "Live Tournaments", value: liveTournaments ?? 0, icon: Play, href: "/dashboard/admin/tournaments?filter=in_progress", highlight: (liveTournaments ?? 0) > 0 },
    { label: "Upcoming", value: upcomingTournaments ?? 0, icon: Calendar, href: "/dashboard/admin/tournaments?filter=published" },
    { label: "Disputes", value: disputedMatches?.length ?? 0, icon: Scale, href: "/dashboard/admin/tournaments", alert: (disputedMatches?.length ?? 0) > 0 },
    { label: "Menu Items", value: menuCount ?? 0, icon: Package, href: "/dashboard/admin/menu" },
    { label: "Active Orders", value: orderCount ?? 0, icon: ShoppingCart, href: "/dashboard/admin/orders" },
    { label: "Low Stock", value: lowStock?.length ?? 0, icon: AlertTriangle, href: "/dashboard/admin/inventory", alert: (lowStock?.length ?? 0) > 0 },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          {"Welcome back. You are signed in as "}
          <span className="font-medium text-primary">{role}</span>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {stats.map((s: any) => (
          <Link
            key={s.label}
            href={s.href}
            className={`flex items-center gap-4 rounded-xl border p-5 transition-colors hover:border-primary/40 ${
              s.alert ? "border-destructive/50 bg-destructive/5" : 
              s.highlight ? "border-green-500/50 bg-green-500/5" : 
              "border-border bg-card"
            }`}
          >
            <div className={`rounded-lg p-3 ${
              s.alert ? "bg-destructive/10" : 
              s.highlight ? "bg-green-500/10" : 
              "bg-primary/10"
            }`}>
              <s.icon className={`h-5 w-5 ${
                s.alert ? "text-destructive" : 
                s.highlight ? "text-green-600" : 
                "text-primary"
              }`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Match Disputes Alert */}
      {disputedMatches && disputedMatches.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="mb-1 flex items-center gap-2 font-semibold text-destructive">
                <Scale className="h-4 w-4" />
                Match Disputes Pending
              </h2>
              <p className="text-sm text-muted-foreground">
                {disputedMatches.length} match{disputedMatches.length !== 1 ? "es" : ""} need TO resolution
              </p>
            </div>
            <Link 
              href="/dashboard/admin/tournaments"
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              View Tournaments
            </Link>
          </div>
        </div>
      )}

      {/* Low Stock Alerts */}
      {lowStock && lowStock.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            Low Stock Alerts
          </h2>
          <div className="space-y-2">
            {lowStock.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{item.menu_items?.name}</span>
                <span className="font-mono text-amber-600">{item.quantity_on_hand} left</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
