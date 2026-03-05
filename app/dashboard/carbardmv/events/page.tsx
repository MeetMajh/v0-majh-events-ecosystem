import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatCents, formatDate } from "@/lib/format"
import { updateBookingStatus } from "@/lib/carbardmv-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Calendar, MapPin } from "lucide-react"

export const metadata = { title: "Event Bookings | CARBARDMV" }

const STATUS_FLOW: Record<string, string[]> = {
  inquiry: ["pending", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["deposit_paid", "cancelled"],
  deposit_paid: ["completed"],
  completed: [],
  cancelled: [],
}

const STATUS_COLORS: Record<string, string> = {
  inquiry: "bg-blue-500/10 text-blue-400",
  pending: "bg-yellow-500/10 text-yellow-400",
  confirmed: "bg-cyan-500/10 text-cyan-400",
  deposit_paid: "bg-green-500/10 text-green-400",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
}

const STATUS_LABELS: Record<string, string> = {
  inquiry: "Review Inquiry",
  pending: "Mark Pending",
  confirmed: "Confirm",
  deposit_paid: "Deposit Received",
  completed: "Complete",
  cancelled: "Cancel",
}

export default async function EventBookingsPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from("cb_bookings")
    .select("*, cb_event_packages(name)")
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Event Bookings</h1>
        <p className="text-sm text-muted-foreground">Manage all CARBARDMV event bookings</p>
      </div>

      <div className="space-y-3">
        {bookings?.map((booking: Record<string, any>) => {
          const nextStatuses = STATUS_FLOW[booking.status] ?? []
          return (
            <div key={booking.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground">
                      {(booking.cb_event_packages as any)?.name || "Custom Event"}
                    </h3>
                    <Badge variant="outline" className={STATUS_COLORS[booking.status]}>
                      {booking.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{booking.contact_name}</p>
                  <p className="text-xs text-muted-foreground">{booking.contact_email}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {booking.event_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(booking.event_date)}
                      </span>
                    )}
                    {booking.guest_count && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {booking.guest_count} guests
                      </span>
                    )}
                    {booking.venue_notes && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {booking.venue_notes.slice(0, 40)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{formatCents(booking.total_cents || 0)}</p>
                  <p className="text-xs text-muted-foreground">
                    Deposit: {formatCents(booking.deposit_cents || 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(booking.created_at)}</p>
                </div>
              </div>

              {nextStatuses.length > 0 && (
                <div className="mt-4 flex gap-2 border-t border-border pt-4">
                  {nextStatuses.map((status) => (
                    <form key={status} action={async () => {
                      "use server"
                      await updateBookingStatus(booking.id, status)
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

        {(!bookings || bookings.length === 0) && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-muted-foreground">No event bookings yet. Bookings from the public events page will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
