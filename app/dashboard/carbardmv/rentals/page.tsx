import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatCents, formatDate } from "@/lib/format"
import { updateRentalStatus } from "@/lib/carbardmv-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Mail } from "lucide-react"

export const metadata = { title: "Rental Bookings | CARBARDMV" }

const STATUS_FLOW: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["deposit_paid", "cancelled"],
  deposit_paid: ["picked_up"],
  picked_up: ["returned"],
  returned: ["completed"],
  completed: [],
  cancelled: [],
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400",
  confirmed: "bg-blue-500/10 text-blue-400",
  deposit_paid: "bg-cyan-500/10 text-cyan-400",
  picked_up: "bg-purple-500/10 text-purple-400",
  returned: "bg-green-500/10 text-green-400",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirm",
  deposit_paid: "Deposit Received",
  picked_up: "Mark Picked Up",
  returned: "Mark Returned",
  completed: "Complete",
  cancelled: "Cancel",
  pending: "Pending",
}

export default async function RentalBookingsPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const { data: rentals } = await supabase
    .from("cb_rental_bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rental Bookings</h1>
        <p className="text-sm text-muted-foreground">Manage equipment rental orders</p>
      </div>

      <div className="space-y-3">
        {rentals?.map((rental: Record<string, any>) => {
          const nextStatuses = STATUS_FLOW[rental.status] ?? []
          return (
            <div key={rental.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground">{rental.contact_name}</h3>
                    <Badge variant="outline" className={STATUS_COLORS[rental.status]}>
                      {rental.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {rental.contact_email}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {rental.pickup_date ? formatDate(rental.pickup_date) : "TBD"} - {rental.return_date ? formatDate(rental.return_date) : "TBD"}
                    </span>
                  </div>
                  {rental.notes && <p className="text-xs text-muted-foreground italic">{rental.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{formatCents(rental.total_cents || 0)}</p>
                  <p className="text-xs text-muted-foreground">Deposit: {formatCents(rental.deposit_cents || 0)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(rental.created_at)}</p>
                </div>
              </div>

              {nextStatuses.length > 0 && (
                <div className="mt-4 flex gap-2 border-t border-border pt-4">
                  {nextStatuses.map((status) => (
                    <form key={status} action={async () => {
                      "use server"
                      await updateRentalStatus(rental.id, status)
                    }}>
                      <Button
                        size="sm"
                        variant={status === "cancelled" ? "destructive" : "default"}
                        type="submit"
                      >
                        {STATUS_LABELS[status] || status}
                      </Button>
                    </form>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {(!rentals || rentals.length === 0) && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-muted-foreground">No rental bookings yet. Orders from the rentals page will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
