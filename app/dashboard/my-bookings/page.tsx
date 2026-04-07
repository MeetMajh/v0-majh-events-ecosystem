import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getUserBookings } from "@/lib/carbardmv-actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Calendar, Clock, Users, MapPin, ChevronRight, 
  PartyPopper, Building2, Trophy, Gamepad2, Plus,
  CreditCard, AlertCircle, CheckCircle2
} from "lucide-react"
import { format, isPast, isFuture, isToday } from "date-fns"

export const metadata = {
  title: "My Bookings | MAJH EVENTS",
  description: "View and manage your CARBARDMV event bookings",
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  inquiry: { label: "Inquiry Sent", variant: "secondary", icon: AlertCircle },
  pending: { label: "Pending Review", variant: "outline", icon: Clock },
  confirmed: { label: "Confirmed", variant: "default", icon: CheckCircle2 },
  deposit_paid: { label: "Deposit Paid", variant: "default", icon: CreditCard },
  completed: { label: "Completed", variant: "secondary", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", variant: "destructive", icon: AlertCircle },
}

const packageIcons: Record<string, typeof PartyPopper> = {
  birthday: PartyPopper,
  corporate: Building2,
  tournament: Trophy,
  private: Gamepad2,
}

export default async function MyBookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")
  
  const { bookings, error } = await getUserBookings()
  
  // Separate bookings by status
  const upcomingBookings = bookings.filter(b => 
    isFuture(new Date(b.event_date)) && !["cancelled", "completed"].includes(b.status)
  )
  const pastBookings = bookings.filter(b => 
    isPast(new Date(b.event_date)) || b.status === "completed"
  )
  const cancelledBookings = bookings.filter(b => b.status === "cancelled")
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground">Manage your CARBARDMV event reservations</p>
        </div>
        <Button asChild>
          <Link href="/events">
            <Plus className="mr-2 h-4 w-4" />
            Book New Event
          </Link>
        </Button>
      </div>
      
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingBookings.length}</p>
                <p className="text-sm text-muted-foreground">Upcoming Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-green-500/10 p-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pastBookings.length}</p>
                <p className="text-sm text-muted-foreground">Completed Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-muted p-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${((bookings.reduce((sum, b) => sum + (b.total_cents || 0), 0)) / 100).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Total Spent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Bookings Tabs */}
      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingBookings.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Past ({pastBookings.length})
          </TabsTrigger>
          {cancelledBookings.length > 0 && (
            <TabsTrigger value="cancelled">
              Cancelled ({cancelledBookings.length})
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="upcoming" className="space-y-4">
          {upcomingBookings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-medium">No upcoming bookings</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Ready to plan your next gaming event?
                </p>
                <Button asChild>
                  <Link href="/events">Browse Event Packages</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            upcomingBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))
          )}
        </TabsContent>
        
        <TabsContent value="past" className="space-y-4">
          {pastBookings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-medium">No past bookings</h3>
                <p className="text-sm text-muted-foreground">
                  Your completed events will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            pastBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} isPast />
            ))
          )}
        </TabsContent>
        
        {cancelledBookings.length > 0 && (
          <TabsContent value="cancelled" className="space-y-4">
            {cancelledBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function BookingCard({ booking, isPast = false }: { booking: any; isPast?: boolean }) {
  const status = statusConfig[booking.status] || statusConfig.inquiry
  const StatusIcon = status.icon
  const packageSlug = booking.cb_event_packages?.slug || "private"
  const PackageIcon = packageIcons[packageSlug] || Gamepad2
  const eventDate = new Date(booking.event_date)
  const isEventToday = isToday(eventDate)
  
  return (
    <Card className={isPast ? "opacity-75" : ""}>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Left: Package info */}
          <div className="flex flex-1 gap-4 p-4 sm:p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <PackageIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    {booking.cb_event_packages?.name || "Event Booking"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {booking.event_type || "Private Event"}
                  </p>
                </div>
                <Badge variant={status.variant} className="shrink-0">
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {status.label}
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {isEventToday ? (
                    <span className="font-medium text-primary">Today</span>
                  ) : (
                    format(eventDate, "MMM d, yyyy")
                  )}
                </span>
                {booking.start_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {booking.start_time.slice(0, 5)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {booking.guest_count} guests
                </span>
              </div>
            </div>
          </div>
          
          {/* Right: Price and action */}
          <div className="flex items-center justify-between border-t p-4 sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:px-6">
            <div className="text-right">
              <p className="text-lg font-bold">
                ${((booking.total_cents || 0) / 100).toLocaleString()}
              </p>
              {booking.deposit_paid && (
                <p className="text-xs text-green-600">Deposit paid</p>
              )}
            </div>
            <Button variant="ghost" size="sm" asChild className="sm:mt-2">
              <Link href={`/dashboard/my-bookings/${booking.id}`}>
                View Details
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
