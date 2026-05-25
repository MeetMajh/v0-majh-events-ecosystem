import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatCents, formatDateTime } from "@/lib/format"
import { updateOrderStatus } from "@/lib/admin-actions"
import { Button } from "@/components/ui/button"

const STATUS_FLOW: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400",
  confirmed: "bg-blue-500/10 text-blue-400",
  preparing: "bg-purple-500/10 text-purple-400",
  ready: "bg-green-500/10 text-green-400",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
}

export default async function OrdersAdminPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from("orders")
    .select("*, profiles(first_name, last_name, email:id)")
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-sm text-muted-foreground">Manage and track all orders</p>
      </div>

      <div className="space-y-3">
        {orders?.map((order: any) => {
          const nextStatuses = STATUS_FLOW[order.status] ?? []
          return (
            <div key={order.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-primary">{order.order_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                      {order.status}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {order.type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
                  {order.profiles && (
                    <p className="mt-1 text-sm text-foreground">
                      {order.profiles.first_name} {order.profiles.last_name}
                    </p>
                  )}
                  {order.notes && <p className="mt-1 text-xs text-muted-foreground italic">{order.notes}</p>}
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{formatCents(order.total_cents)}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className={order.payment_status === "paid" ? "text-green-400" : "text-yellow-400"}>
                      {order.payment_status}
                    </span>
                    {" via "}
                    {order.payment_method || "—"}
                  </div>
                  {order.points_earned > 0 && (
                    <p className="text-xs text-primary">+{order.points_earned} pts</p>
                  )}
                </div>
              </div>

              {nextStatuses.length > 0 && (
                <div className="mt-4 flex gap-2 border-t border-border pt-4">
                  {nextStatuses.map((status) => (
                    <form key={status} action={updateOrderStatus}>
                      <input type="hidden" name="order_id" value={order.id} />
                      <input type="hidden" name="status" value={status} />
                      <Button
                        size="sm"
                        variant={status === "cancelled" ? "destructive" : "default"}
                        type="submit"
                      >
                        {status === "confirmed" && "Confirm"}
                        {status === "preparing" && "Start Preparing"}
                        {status === "ready" && "Mark Ready"}
                        {status === "completed" && "Complete"}
                        {status === "cancelled" && "Cancel"}
                      </Button>
                    </form>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {(!orders || orders.length === 0) && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-muted-foreground">No orders yet. Create one from the POS terminal.</p>
          </div>
        )}
      </div>
    </div>
  )
}
