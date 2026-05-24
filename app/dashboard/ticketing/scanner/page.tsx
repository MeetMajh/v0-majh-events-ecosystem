import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, MapPin, QrCode, Users } from "lucide-react"

export const metadata = {
  title: "Check-In Scanner | MAJH Dashboard",
  description: "Select an event to start scanning tickets",
}

export default async function ScannerSelectPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Get user's tenant
  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .single()

  if (!membership) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">No organization found. Please contact support.</p>
        </div>
      </div>
    )
  }

  // Get published events for check-in (today and upcoming)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const { data: events } = await supabase
    .from("events")
    .select(`
      id,
      name,
      slug,
      location_name,
      location_city,
      starts_at,
      ends_at,
      capacity,
      status
    `)
    .eq("tenant_id", membership.tenant_id)
    .eq("status", "published")
    .gte("ends_at", today.toISOString())
    .order("starts_at", { ascending: true })

  // Get stats for each event
  const eventsWithStats = await Promise.all(
    (events || []).map(async (event) => {
      const { data: stats } = await supabase.rpc("get_event_stats", { p_event_id: event.id })
      return { ...event, stats }
    })
  )

  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/dashboard/ticketing">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Events
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Check-In Scanner</h1>
          <p className="text-muted-foreground">
            Select an event to start checking in attendees
          </p>
        </div>

        {/* Events List */}
        {eventsWithStats.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <QrCode className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="mb-2 text-lg font-medium">No Events Available</p>
              <p className="text-muted-foreground text-center max-w-sm">
                You don&apos;t have any published events to check-in for. Create and publish an event first.
              </p>
              <Button asChild className="mt-4">
                <Link href="/dashboard/ticketing">View Events</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {eventsWithStats.map((event) => {
              const eventDate = new Date(event.starts_at)
              const isToday = eventDate.toDateString() === new Date().toDateString()
              const isHappening = new Date() >= new Date(event.starts_at) && new Date() <= new Date(event.ends_at)
              
              return (
                <Card key={event.id} className={isHappening ? "border-primary" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">{event.name}</CardTitle>
                          {isHappening && (
                            <Badge className="bg-emerald-500">Live Now</Badge>
                          )}
                          {isToday && !isHappening && (
                            <Badge variant="secondary">Today</Badge>
                          )}
                        </div>
                        <CardDescription className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {eventDate.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                            {" at "}
                            {eventDate.toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          {event.location_name && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {event.location_name}
                              {event.location_city && `, ${event.location_city}`}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{event.stats?.checked_in || 0}</span>
                          <span className="text-muted-foreground">
                            / {event.stats?.valid_tickets || 0} checked in
                          </span>
                        </div>
                        {event.stats && event.stats.valid_tickets > 0 && (
                          <Badge variant="outline">
                            {event.stats.check_in_rate}% complete
                          </Badge>
                        )}
                      </div>
                      <Button asChild>
                        <Link href={`/dashboard/ticketing/${event.id}/check-in`}>
                          <QrCode className="mr-2 h-4 w-4" />
                          Start Scanning
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
