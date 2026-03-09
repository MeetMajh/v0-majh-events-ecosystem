import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Users, MapPin, DollarSign } from "lucide-react"
import Link from "next/link"

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  inquiry: { label: "Inquiry", variant: "outline" },
  proposal_sent: { label: "Proposal Sent", variant: "secondary" },
  confirmed: { label: "Confirmed", variant: "default" },
  deposit_paid: { label: "Deposit Paid", variant: "default" },
  in_progress: { label: "In Progress", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
}

export default async function MyEventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  // Get user's profile ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  // Get user's bookings
  const { data: bookings } = await supabase
    .from("cb_bookings")
    .select(`
      *,
      package:cb_event_packages(name)
    `)
    .eq("client_id", profile?.id || user.id)
    .order("event_date", { ascending: false })

  const upcomingBookings = bookings?.filter((b) =>
    new Date(b.event_date) >= new Date() && b.status !== "cancelled"
  ) || []

  const pastBookings = bookings?.filter((b) =>
    new Date(b.event_date) < new Date() || b.status === "cancelled"
  ) || []

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        title="My Events"
        description="View and manage your event bookings"
      />

      {bookings?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-2 text-lg font-medium">No event bookings yet</p>
            <p className="mb-4 text-muted-foreground">Book your first CARBARDMV event experience</p>
            <Button asChild>
              <Link href="/events">Browse Event Packages</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {upcomingBookings.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Upcoming Events</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingBookings.map((booking) => {
              const status = STATUS_BADGES[booking.status] || STATUS_BADGES.inquiry
              return (
                <Card key={booking.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">
                        {booking.package?.name || "Custom Event"}
                      </CardTitle>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(booking.event_date).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      {booking.start_time && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {booking.start_time}
                          {booking.end_time && ` - ${booking.end_time}`}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {booking.guest_count} guests
                      </div>
                      {booking.venue_notes && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {booking.venue_notes}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-2 font-semibold">
                        <DollarSign className="h-4 w-4" />
                        Total: ${(booking.total_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        {booking.deposit_paid && (
                          <Badge variant="outline" className="ml-2">Deposit Paid</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {pastBookings.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Past Events</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {pastBookings.map((booking) => {
              const status = STATUS_BADGES[booking.status] || STATUS_BADGES.inquiry
              return (
                <Card key={booking.id} className="opacity-75">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">
                        {booking.package?.name || "Custom Event"}
                      </CardTitle>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(booking.event_date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {booking.guest_count} guests
                      </div>
                      <div className="flex items-center gap-2 pt-2 font-semibold">
                        <DollarSign className="h-4 w-4" />
                        ${(booking.total_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
