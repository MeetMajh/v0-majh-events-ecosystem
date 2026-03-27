import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Gamepad2, 
  Trophy, 
  MapPin, 
  Calendar, 
  Clock, 
  Users,
  ArrowRight,
  Swords,
  AlertCircle
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

export const metadata = {
  title: "Player Controller | MAJH Events",
  description: "Manage your active tournament participation",
}

export default async function PlayerControllerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get all matches for this user to find tournaments they're in
  const { data: userMatches } = await supabase
    .from("tournament_matches")
    .select(`
      id,
      tournament_id,
      status,
      result,
      player1_id,
      player2_id,
      player1_wins,
      player2_wins,
      table_number
    `)
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .order("created_at", { ascending: false })

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
        current_round,
        games (name, icon_url)
      `)
      .in("id", tournamentIds)
      .order("start_date", { ascending: false })

    tournaments = tournamentData || []
  }

  // Group tournaments by status
  const activeTournaments = tournaments.filter(t => t.status === "in_progress")
  const upcomingTournaments = tournaments.filter(t => t.status === "registration" || t.status === "pending")
  const pastTournaments = tournaments.filter(t => t.status === "completed" || t.status === "cancelled")

  // Calculate match stats per tournament
  const getTournamentStats = (tournamentId: string) => {
    const matches = userMatches?.filter(m => m.tournament_id === tournamentId) || []
    let wins = 0, losses = 0, draws = 0
    const currentMatch = matches.find(m => m.status === "in_progress" || m.status === "pending")
    
    matches.forEach(m => {
      if (m.status === "completed" || m.result) {
        const isPlayer1 = m.player1_id === user.id
        if (m.result === "draw") {
          draws++
        } else if ((isPlayer1 && m.player1_wins > m.player2_wins) || (!isPlayer1 && m.player2_wins > m.player1_wins)) {
          wins++
        } else if (m.result) {
          losses++
        }
      }
    })
    
    return { wins, losses, draws, currentMatch, totalMatches: matches.length }
  }

  const TournamentCard = ({ tournament, variant }: { tournament: any, variant: "active" | "upcoming" | "past" }) => {
    const stats = getTournamentStats(tournament.id)
    const isActive = variant === "active"
    
    return (
      <Card className={isActive ? "border-primary/50 bg-primary/5" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {tournament.games?.icon_url ? (
                <img src={tournament.games.icon_url} alt="" className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                  <Gamepad2 className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">{tournament.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{tournament.games?.name || "Tournament"}</p>
              </div>
            </div>
            <Badge variant={isActive ? "default" : variant === "upcoming" ? "secondary" : "outline"}>
              {tournament.status === "in_progress" ? "Live" : 
               tournament.status === "registration" ? "Registration Open" :
               tournament.status === "completed" ? "Completed" : tournament.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tournament Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {tournament.start_date ? format(new Date(tournament.start_date), "MMM d, yyyy") : "TBD"}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Trophy className="h-4 w-4" />
              {tournament.format || "Standard"}
            </div>
            {tournament.venue_name && (
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <MapPin className="h-4 w-4" />
                {tournament.venue_name}
              </div>
            )}
          </div>

          {/* Match Record */}
          {stats.totalMatches > 0 && (
            <div className="flex items-center gap-4 rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <Swords className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Match Record:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-bold">{stats.wins}</span>
                <span className="text-muted-foreground">-</span>
                <span className="text-red-500 font-bold">{stats.losses}</span>
                {stats.draws > 0 && (
                  <>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-yellow-500 font-bold">{stats.draws}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Current Match Alert for Active Tournaments */}
          {isActive && stats.currentMatch && (
            <div className="rounded-lg border border-primary/50 bg-primary/10 p-3">
              <div className="flex items-center gap-2 text-primary font-medium">
                <AlertCircle className="h-4 w-4" />
                <span>Active Match - Table {stats.currentMatch.table_number || "TBD"}</span>
              </div>
            </div>
          )}

          {/* Current Round for Active Tournaments */}
          {isActive && tournament.current_round && (
            <div className="text-sm text-muted-foreground">
              <Clock className="h-4 w-4 inline mr-1" />
              Currently on Round {tournament.current_round}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Link href={`/dashboard/player-portal/${tournament.id}`} className="flex-1">
              <Button className="w-full" variant={isActive ? "default" : "outline"}>
                {isActive ? "Open Player Controller" : "View Details"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/esports/tournaments/${tournament.slug}`}>
              <Button variant="ghost" size="icon" title="View Tournament Page">
                <Trophy className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-primary">
          <Gamepad2 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Player Controller</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Quick access to your active tournament matches and controls
        </p>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 bg-card w-fit">
        <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
        <span>MAJH Events Connection Active</span>
      </div>

      {/* Active Tournaments - Most Prominent */}
      {activeTournaments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Live Tournaments
          </h2>
          <div className="grid gap-4">
            {activeTournaments.map(tournament => (
              <TournamentCard key={tournament.id} tournament={tournament} variant="active" />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Tournaments */}
      {upcomingTournaments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Upcoming Tournaments</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingTournaments.map(tournament => (
              <TournamentCard key={tournament.id} tournament={tournament} variant="upcoming" />
            ))}
          </div>
        </div>
      )}

      {/* Past Tournaments */}
      {pastTournaments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">Past Tournaments</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {pastTournaments.slice(0, 4).map(tournament => (
              <TournamentCard key={tournament.id} tournament={tournament} variant="past" />
            ))}
          </div>
          {pastTournaments.length > 4 && (
            <Link href="/dashboard/player-portal" className="text-sm text-primary hover:underline">
              View all {pastTournaments.length} past tournaments
            </Link>
          )}
        </div>
      )}

      {/* Empty State */}
      {tournaments.length === 0 && (
        <Card className="p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Gamepad2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Tournament Activity</h3>
          <p className="text-muted-foreground mb-4">
            You haven&apos;t participated in any tournaments yet. Browse available tournaments to get started!
          </p>
          <Link href="/esports/tournaments">
            <Button variant="default">
              Browse Tournaments
            </Button>
          </Link>
        </Card>
      )}
    </div>
  )
}
