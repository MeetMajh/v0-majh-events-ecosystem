import { createClient, createAdminClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Gamepad2, 
  Calendar, 
  MapPin, 
  ChevronRight, 
  ChevronDown,
  Trophy,
  Clock,
  AlertCircle,
  Joystick,
  ExternalLink,
  Activity,
  Target,
  Users,
  Zap
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Player Portal | MAJH Events",
  description: "Access your tournament player controllers",
}

export default async function PlayerPortalPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get all matches for this user using adminClient to bypass RLS
  const { data: userMatches } = await adminClient
    .from("tournament_matches")
    .select("id, tournament_id, player1_id, player2_id, status, result, winner_id")
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)

  // Also get tournament_participants records for this user
  const { data: participantRecords } = await adminClient
    .from("tournament_participants")
    .select("tournament_id")
    .eq("user_id", user.id)

  // Combine tournament IDs from matches and participants
  const tournamentIdsFromMatches = userMatches?.map(m => m.tournament_id).filter(Boolean) || []
  const tournamentIdsFromParticipants = participantRecords?.map(p => p.tournament_id).filter(Boolean) || []
  const tournamentIds = [...new Set([...tournamentIdsFromMatches, ...tournamentIdsFromParticipants])]
  
  console.log("[v0] Player Portal Debug:", {
    userId: user.id,
    matchesFound: userMatches?.length || 0,
    participantsFound: participantRecords?.length || 0,
    tournamentIds,
  })

  // Fetch tournament details using adminClient (without games join to avoid FK issues)
  let tournaments: any[] = []
  let tournamentQueryError: string | null = null
  if (tournamentIds.length > 0) {
    const { data: tournamentData, error } = await adminClient
      .from("tournaments")
      .select(`
        id,
        name,
        slug,
        status,
        format,
        start_date,
        max_participants,
        game_id
      `)
      .in("id", tournamentIds)
      .order("start_date", { ascending: false })
    
    if (error) {
      console.log("[v0] Tournament query error:", error)
      tournamentQueryError = error.message
    }
    
    // Fetch games separately to avoid FK relationship issues
    let gamesMap: Record<string, { name: string; icon_url: string | null }> = {}
    if (tournamentData && tournamentData.length > 0) {
      const gameIds = [...new Set(tournamentData.map(t => t.game_id).filter(Boolean))]
      if (gameIds.length > 0) {
        const { data: gamesData } = await adminClient
          .from("games")
          .select("id, name, icon_url")
          .in("id", gameIds)
        
        gamesData?.forEach(g => {
          gamesMap[g.id] = { name: g.name, icon_url: g.icon_url }
        })
      }
    }
    
    if (tournamentData) {
      // Count matches for each tournament and attach games
      tournaments = tournamentData.map(t => {
        const matchesInTournament = userMatches?.filter(m => m.tournament_id === t.id) || []
        const wins = matchesInTournament.filter(m => 
          (m.player1_id === user.id && m.result === "player1") ||
          (m.player2_id === user.id && m.result === "player2") ||
          m.winner_id === user.id
        ).length
        const losses = matchesInTournament.filter(m => 
          (m.player1_id === user.id && m.result === "player2") ||
          (m.player2_id === user.id && m.result === "player1") ||
          (m.winner_id && m.winner_id !== user.id)
        ).length
        
        return {
          ...t,
          games: t.game_id ? gamesMap[t.game_id] : null,
          matchCount: matchesInTournament.length,
          wins,
          losses,
          draws: matchesInTournament.filter(m => m.result === "draw").length,
          pendingMatches: matchesInTournament.filter(m => m.status === "pending" || m.status === "in_progress").length
        }
      })
    }
  }

  console.log("[v0] Tournaments fetched:", tournaments.length, tournaments.map(t => ({ id: t.id, name: t.name, status: t.status })))

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

      {/* System Diagnostics Panel */}
      <Collapsible>
        <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/30 overflow-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 px-4 cursor-pointer hover:bg-primary/5 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">System Diagnostics</h4>
                    <p className="text-xs text-muted-foreground">Connection status and data sync</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={tournaments.length > 0 ? "default" : "destructive"} className="text-xs">
                    {tournaments.length > 0 ? "Synced" : "No Data"}
                  </Badge>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 px-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-background/50 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-3 w-3 text-primary" />
                    <span className="text-xs text-muted-foreground">Matches</span>
                  </div>
                  <p className="text-lg font-bold">{userMatches?.length || 0}</p>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-3 w-3 text-primary" />
                    <span className="text-xs text-muted-foreground">Registrations</span>
                  </div>
                  <p className="text-lg font-bold">{participantRecords?.length || 0}</p>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="h-3 w-3 text-primary" />
                    <span className="text-xs text-muted-foreground">Tournaments</span>
                  </div>
                  <p className="text-lg font-bold">{tournaments.length}</p>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-3 w-3 text-primary" />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                  <p className="text-lg font-bold">{activeTournaments.length}</p>
                </div>
              </div>
              
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 bg-background/30 rounded">
                  <span className="text-muted-foreground">Player ID</span>
                  <code className="bg-background px-2 py-0.5 rounded text-[10px]">{user.id.slice(0, 8)}...</code>
                </div>
                <div className="flex items-center justify-between p-2 bg-background/30 rounded">
                  <span className="text-muted-foreground">Tournament IDs Found</span>
                  <Badge variant="outline" className="text-[10px]">{tournamentIds.length}</Badge>
                </div>
                {tournamentQueryError && (
                  <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    <span>Query Error: {tournamentQueryError}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
