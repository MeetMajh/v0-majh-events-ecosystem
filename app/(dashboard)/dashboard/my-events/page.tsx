import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getMyTournaments } from "@/lib/player-actions"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Calendar, Trophy, Gamepad2, ChevronRight, CheckCircle2, Clock, XCircle } from "lucide-react"

export const metadata = {
  title: "My Events | MAJH Events",
  description: "View and manage your tournament registrations",
}

export default async function MyEventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirect=/dashboard/my-events")
  }

  const registrations = await getMyTournaments()

  // Group by status
  const upcomingTournaments = registrations.filter(
    r => r.tournaments?.status === "registration" || r.tournaments?.status === "in_progress"
  )
  const pastTournaments = registrations.filter(
    r => r.tournaments?.status === "completed" || r.tournaments?.status === "cancelled"
  )

  const getStatusBadge = (tournamentStatus: string, regStatus: string) => {
    if (tournamentStatus === "in_progress") {
      return <Badge className="bg-primary/10 text-primary">Live</Badge>
    }
    if (tournamentStatus === "completed") {
      return <Badge variant="secondary">Completed</Badge>
    }
    if (regStatus === "checked_in") {
      return <Badge className="bg-green-500/10 text-green-500">Checked In</Badge>
    }
    if (regStatus === "dropped") {
      return <Badge variant="destructive">Dropped</Badge>
    }
    return <Badge variant="outline">Registered</Badge>
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Events</h1>
        <p className="text-muted-foreground mt-1">
          Manage your tournament registrations and view your match history
        </p>
      </div>

      {registrations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Tournaments Yet</h3>
            <p className="text-muted-foreground mb-4">
              You haven&apos;t registered for any tournaments yet.
            </p>
            <Button asChild>
              <Link href="/esports/tournaments">Browse Tournaments</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Active/Upcoming Tournaments */}
          {upcomingTournaments.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Active & Upcoming
              </h2>
              <div className="space-y-3">
                {upcomingTournaments.map((reg) => (
                  <Link
                    key={reg.id}
                    href={`/dashboard/my-events/${reg.tournaments?.id}`}
                    className="block"
                  >
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                              <Gamepad2 className="h-6 w-6 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold truncate">
                                  {reg.tournaments?.name}
                                </h3>
                                {getStatusBadge(reg.tournaments?.status ?? "", reg.status)}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {reg.tournaments?.start_date
                                    ? format(new Date(reg.tournaments.start_date), "MMM d, yyyy")
                                    : "TBD"}
                                </span>
                                <span className="capitalize">{reg.tournaments?.format}</span>
                                <span>{reg.tournaments?.games?.name}</span>
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Past Tournaments */}
          {pastTournaments.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                Past Events
              </h2>
              <div className="space-y-3">
                {pastTournaments.map((reg) => (
                  <Link
                    key={reg.id}
                    href={`/dashboard/my-events/${reg.tournaments?.id}`}
                    className="block"
                  >
                    <Card className="hover:border-border/80 transition-colors cursor-pointer opacity-75 hover:opacity-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                              <Gamepad2 className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold truncate">
                                  {reg.tournaments?.name}
                                </h3>
                                {getStatusBadge(reg.tournaments?.status ?? "", reg.status)}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {reg.tournaments?.start_date
                                    ? format(new Date(reg.tournaments.start_date), "MMM d, yyyy")
                                    : "TBD"}
                                </span>
                                <span className="capitalize">{reg.tournaments?.format}</span>
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
