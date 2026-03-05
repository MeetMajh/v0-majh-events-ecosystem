import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { formatCents, formatDateTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ShoppingCart } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400",
  confirmed: "bg-blue-500/10 text-blue-400",
  preparing: "bg-purple-500/10 text-purple-400",
  ready: "bg-green-500/10 text-green-400",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
}

export default async function CustomerOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*, menu_items(name))")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
          <p className="text-sm text-muted-foreground">{orders?.length ?? 0} total orders</p>
        </div>
        <Button asChild>
          <Link href="/bar-cafe">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Order Now
          </Link>
        </Button>
      </div>

      {(!orders || orders.length === 0) ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="mb-4 text-muted-foreground">{"You haven't placed any orders yet."}</p>
          <Button asChild>
            <Link href="/bar-cafe">Browse Menu</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => (
            <div key={order.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-primary">{order.order_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{formatCents(order.total_cents)}</p>
                  {order.points_earned > 0 && (
                    <p className="text-xs text-primary">+{order.points_earned} pts earned</p>
                  )}
                  {order.discount_cents > 0 && (
                    <p className="text-xs text-green-400">-{formatCents(order.discount_cents)} points discount</p>
                  )}
                </div>
              </div>

              {order.order_items && order.order_items.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="space-y-1">
                    {order.order_items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.quantity}x {item.menu_items?.name}
                        </span>
                        <span className="font-mono text-foreground">{formatCents(item.total_cents)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
