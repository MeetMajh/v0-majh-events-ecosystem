import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Gamepad2, 
  Calendar, 
  MapPin, 
  ChevronRight, 
  Trophy,
  Clock,
  AlertCircle,
  Joystick,
  ExternalLink
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

  // Get all matches for this user, then extract tournament IDs
  const { data: userMatches } = await supabase
    .from("tournament_matches")
    .select("id, tournament_id, player1_id, player2_id, status, result")
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)

  // Get unique tournament IDs
  const tournamentIds = [...new Set(userMatches?.map(m => m.tournament_id).filter(Boolean) || [])]

  // Fetch tournament details
  let tournaments: any[] = []
  if (tournamentIds.length > 0) {
    const { data: tournamentData } = await supabase
      .from("tournaments")
      .select(`
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
      `)
      .in("id", tournamentIds)
      .order("start_date", { ascending: false })
    
    if (tournamentData) {
      // Count matches for each tournament
      tournaments = tournamentData.map(t => {
        const matchesInTournament = userMatches?.filter(m => m.tournament_id === t.id) || []
        const wins = matchesInTournament.filter(m => 
          (m.player1_id === user.id && m.result === "player1") ||
          (m.player2_id === user.id && m.result === "player2")
        ).length
        const losses = matchesInTournament.filter(m => 
          (m.player1_id === user.id && m.result === "player2") ||
          (m.player2_id === user.id && m.result === "player1")
        ).length
        
        return {
          ...t,
          matchCount: matchesInTournament.length,
          wins,
          losses,
          draws: matchesInTournament.filter(m => m.result === "draw").length,
          pendingMatches: matchesInTournament.filter(m => m.status === "pending" || m.status === "in_progress").length
        }
      })
    }
  }

  // Group by status
  const activeTournaments = tournaments.filter(t => t.status === "in_progress")
  const upcomingTournaments = tournaments.filter(t => t.status === "registration" || t.status === "pending")
  const pastTournaments = tournaments.filter(t => t.status === "completed" || t.status === "cancelled")

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Joystick className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Player Portal</h1>
        </div>
        <p className="text-muted-foreground">
          Designed for mobile &amp; in-person tournaments
        </p>
        <Link 
          href="/esports/tournaments" 
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
        >
          <ExternalLink className="h-3 w-3" />
          Find Events
        </Link>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-muted-foreground">MAJH Events Connection</span>
      </div>

      {tournaments.length === 0 ? (
        <Card className="border-dashed">
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-green-500" />
                <h2 className="text-lg font-semibold text-green-500">Live Tournaments</h2>
              </div>
              <div className="space-y-2">
                {activeTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} variant="active" />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Tournaments */}
          {upcomingTournaments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Upcoming Tournaments</h2>
              </div>
              <div className="space-y-2">
                {upcomingTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} variant="upcoming" />
                ))}
              </div>
            </div>
          )}

          {/* Past Tournaments */}
          {pastTournaments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-muted-foreground">Past Tournaments</h2>
              </div>
              <div className="space-y-2">
                {pastTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} variant="past" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TournamentCard({ 
  tournament, 
  variant 
}: { 
  tournament: any
  variant: "active" | "upcoming" | "past"
}) {
  return (
    <Link href={`/dashboard/player-portal/${tournament.id}`}>
      <Card className={cn(
        "transition-all hover:shadow-md cursor-pointer",
        variant === "active" && "border-green-500/50 bg-green-500/5 hover:border-green-500",
        variant === "upcoming" && "hover:border-primary/50",
        variant === "past" && "opacity-80 hover:opacity-100"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg",
                variant === "active" && "bg-green-500/20",
                variant === "upcoming" && "bg-primary/10",
                variant === "past" && "bg-muted"
              )}>
                <Gamepad2 className={cn(
                  "h-6 w-6",
                  variant === "active" && "text-green-500",
                  variant === "upcoming" && "text-primary",
                  variant === "past" && "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-semibold text-lg">{tournament.name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {tournament.games?.name && (
                    <Badge variant="outline" className="text-[10px]">
                      {tournament.games.name}
                    </Badge>
                  )}
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
            
            <div className="flex items-center gap-4">
              {/* Match Record */}
              {(tournament.matchCount > 0) && (
                <div className="text-right mr-2">
                  <p className="text-sm font-medium">
                    {tournament.wins}-{tournament.losses}{tournament.draws > 0 ? `-${tournament.draws}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">Record</p>
                </div>
              )}
              
              {/* Status Badge */}
              <Badge className={cn(
                variant === "active" && "bg-green-500 text-white",
                variant === "upcoming" && "bg-primary/20 text-primary",
                variant === "past" && "bg-muted text-muted-foreground"
              )}>
                {variant === "active" && "Live"}
                {variant === "upcoming" && "Upcoming"}
                {variant === "past" && (tournament.status === "completed" ? "Ended" : "Cancelled")}
              </Badge>
              
              <Button size="sm" variant={variant === "active" ? "default" : "ghost"}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Active match indicator */}
          {variant === "active" && tournament.pendingMatches > 0 && (
            <div className="mt-3 pt-3 border-t border-green-500/20">
              <p className="text-sm text-green-500 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                You have {tournament.pendingMatches} active match{tournament.pendingMatches > 1 ? "es" : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
