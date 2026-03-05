import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatCents } from "@/lib/format"
import Link from "next/link"
import { Package, ShoppingCart, AlertTriangle, Users } from "lucide-react"

export default async function AdminOverviewPage() {
  const { role } = await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const [
    { count: menuCount },
    { count: orderCount },
    { data: lowStock },
    { data: todayOrders },
  ] = await Promise.all([
    supabase.from("menu_items").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["pending", "confirmed", "preparing", "ready"]),
    supabase.from("inventory").select("*, menu_items(name)").eq("track_inventory", true).lt("quantity_on_hand", 10),
    supabase.from("orders").select("total_cents, status").gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ])

  const todayRevenue = todayOrders?.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.total_cents, 0) ?? 0

  const stats = [
    { label: "Menu Items", value: menuCount ?? 0, icon: Package, href: "/dashboard/admin/menu" },
    { label: "Active Orders", value: orderCount ?? 0, icon: ShoppingCart, href: "/dashboard/admin/orders" },
    { label: "Low Stock Alerts", value: lowStock?.length ?? 0, icon: AlertTriangle, href: "/dashboard/admin/inventory" },
    { label: "Today Revenue", value: formatCents(todayRevenue), icon: Users, href: "/dashboard/admin/orders" },
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div className="rounded-lg bg-primary/10 p-3">
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {lowStock && lowStock.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Low Stock Alerts
          </h2>
          <div className="space-y-2">
            {lowStock.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{item.menu_items?.name}</span>
                <span className="font-mono text-destructive">{item.quantity_on_hand} left</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
