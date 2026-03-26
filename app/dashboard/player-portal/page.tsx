import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Gamepad2, 
  Calendar, 
  MapPin, 
  Users, 
  ChevronRight, 
  Trophy,
  Clock,
  AlertCircle,
  CheckCircle2,
  Joystick
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Player Portal | MAJH Events",
  description: "Access your tournament player controllers",
}

export default async function PlayerPortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get all tournament registrations for this user
  const { data: registrations } = await supabase
    .from("tournament_registrations")
    .select(`
      id,
      status,
      check_in_at,
      registered_at,
      tournaments (
        id,
        name,
        slug,
        status,
        format,
        start_date,
        venue_name,
        location,
        max_participants,
        games (name, icon_url)
      )
    `)
    .eq("player_id", user.id)
    .order("registered_at", { ascending: false })

  const tournaments = registrations ?? []

  // Group by status
  const activeTournaments = tournaments.filter(
    (t) => t.tournaments?.status === "in_progress"
  )
  const upcomingTournaments = tournaments.filter(
    (t) => t.tournaments?.status === "registration" || t.tournaments?.status === "pending"
  )
  const pastTournaments = tournaments.filter(
    (t) => t.tournaments?.status === "completed" || t.tournaments?.status === "cancelled"
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Joystick className="h-8 w-8 text-primary" />
          Player Portal
        </h1>
        <p className="text-muted-foreground mt-1">
          Access your tournament player controllers to view matches, submit decklists, and more
        </p>
      </div>

      {tournaments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Gamepad2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">No Tournament Registrations</h3>
            <p className="text-muted-foreground text-center mt-2 max-w-md">
              You haven&apos;t registered for any tournaments yet. Browse available tournaments to get started!
            </p>
            <Button asChild className="mt-6">
              <Link href="/esports/tournaments">Browse Tournaments</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active Tournaments - Most Important */}
          {activeTournaments.length > 0 && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-500">
                  <AlertCircle className="h-5 w-5" />
                  Active Tournaments
                </CardTitle>
                <CardDescription>Tournaments currently in progress - click to open Player Controller</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeTournaments.map((reg) => (
                  <TournamentCard key={reg.id} registration={reg} variant="active" />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Tournaments */}
          {upcomingTournaments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Tournaments
                </CardTitle>
                <CardDescription>Tournaments you&apos;re registered for</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingTournaments.map((reg) => (
                  <TournamentCard key={reg.id} registration={reg} variant="upcoming" />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Past Tournaments */}
          {pastTournaments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-muted-foreground" />
                  Past Tournaments
                </CardTitle>
                <CardDescription>View your match history and results</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pastTournaments.map((reg) => (
                  <TournamentCard key={reg.id} registration={reg} variant="past" />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function TournamentCard({ 
  registration, 
  variant 
}: { 
  registration: any
  variant: "active" | "upcoming" | "past"
}) {
  const tournament = registration.tournaments
  if (!tournament) return null

  return (
    <Link
      href={`/dashboard/player-portal/${tournament.id}`}
      className={cn(
        "flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-md",
        variant === "active" && "border-green-500/30 bg-green-500/5 hover:border-green-500/50",
        variant === "upcoming" && "border-border hover:border-primary/30 hover:bg-muted/30",
        variant === "past" && "border-border/50 bg-muted/20 hover:bg-muted/40"
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "flex h-14 w-14 items-center justify-center rounded-xl",
          variant === "active" && "bg-green-500/20",
          variant === "upcoming" && "bg-primary/10",
          variant === "past" && "bg-muted"
        )}>
          <Gamepad2 className={cn(
            "h-7 w-7",
            variant === "active" && "text-green-500",
            variant === "upcoming" && "text-primary",
            variant === "past" && "text-muted-foreground"
          )} />
        </div>
        <div>
          <p className="font-semibold text-foreground text-lg">{tournament.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              {tournament.games?.name}
            </Badge>
            <Badge variant="outline" className="text-[10px] capitalize">
              {tournament.format}
            </Badge>
            {tournament.venue_name && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {tournament.venue_name}
              </span>
            )}
            {tournament.start_date && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {variant === "upcoming" 
                  ? formatDistanceToNow(new Date(tournament.start_date), { addSuffix: true })
                  : format(new Date(tournament.start_date), "MMM d, yyyy")
                }
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <Badge className={cn(
            "mb-1",
            variant === "active" && "bg-green-500/20 text-green-600 border-green-500/30",
            variant === "upcoming" && registration.check_in_at && "bg-blue-500/20 text-blue-600 border-blue-500/30",
            variant === "past" && tournament.status === "completed" && "bg-muted text-muted-foreground"
          )}>
            {variant === "active" && "Live Now"}
            {variant === "upcoming" && (registration.check_in_at ? "Checked In" : "Registered")}
            {variant === "past" && (tournament.status === "completed" ? "Completed" : "Cancelled")}
          </Badge>
          <p className="text-xs text-muted-foreground capitalize">{registration.status}</p>
        </div>
        <Button size="sm" variant={variant === "active" ? "default" : "secondary"} className="gap-1">
          {variant === "active" ? "Open Controller" : "View"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </Link>
  )
}
