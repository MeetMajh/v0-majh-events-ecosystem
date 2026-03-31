import { createClient, createAdminClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { 
  Gamepad2, 
  Trophy, 
  MapPin, 
  Calendar, 
  Clock, 
  Users,
  ArrowRight,
  Swords,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Megaphone,
  Table2,
  Medal,
  Target,
  History,
  TrendingUp
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { DebugPanel } from "@/components/player/debug-panel"

export const metadata = {
  title: "Player Controller | MAJH Events",
  description: "Manage your tournament participation and view match history",
}

export default async function PlayerControllerPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get user's profile
  const { data: userProfile } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("id", user.id)
    .single()

// Step 1: Get all registrations for this user from tournament_registrations
  // player_id in tournament_registrations references profiles.id which equals user.id
  const { data: registrationRecords, error: registrationsError } = await adminClient
    .from("tournament_registrations")
    .select("player_id, tournament_id")
    .eq("player_id", user.id)

  // Create a map of tournament_id -> player_id for match lookups
  const playerMap = new Map<string, string>(
    (registrationRecords || []).map(r => [r.tournament_id, r.player_id])
  )
  const playerIds = [...new Set((registrationRecords || []).map(r => r.player_id).filter(Boolean))]

  // Step 2: Get matches using the player_ids (not user.id)
  let userMatches: any[] = []
  if (playerIds.length > 0) {
    const { data: matchData } = await adminClient
      .from("tournament_matches")
      .select(`
        id,
        tournament_id,
        round_id,
        status,
        result,
        player1_id,
        player2_id,
        player1_wins,
        player2_wins,
        table_number,
        created_at,
        player1:profiles!tournament_matches_player1_id_fkey (id, first_name, last_name, avatar_url),
        player2:profiles!tournament_matches_player2_id_fkey (id, first_name, last_name, avatar_url),
        tournament_rounds (id, round_number, status)
      `)
      .or(playerIds.map(id => `player1_id.eq.${id},player2_id.eq.${id}`).join(","))
      .order("created_at", { ascending: false })
    
    userMatches = matchData || []
  }

  // Get unique tournament IDs from matches
  const tournamentIdsFromMatches = [...new Set(userMatches.map(m => m.tournament_id).filter(Boolean))]
  
  // Step 3: Get tournaments from tournament_participants (using user_id)
  const { data: participantData } = await adminClient
    .from("tournament_participants")
    .select("tournament_id")
    .eq("user_id", user.id)
  
  const tournamentIdsFromParticipants = [...new Set((participantData || []).map(r => r.tournament_id).filter(Boolean))]

  // Combine matches and participants sources
  const tournamentIds = [...new Set([
    ...tournamentIdsFromMatches, 
    ...tournamentIdsFromParticipants
  ])]

  // Debug data to display in UI
  const debugData = {
    userId: user.id,
    userEmail: user.email,
    registrationRecords: registrationRecords || [],
    registrationsError: registrationsError?.message || null,
    participantData: participantData || [],
    tournamentIdsFromMatches,
    tournamentIdsFromParticipants,
    tournamentIds,
    matchCount: userMatches.length,
  }

  // Fetch tournament details using admin client
  let tournaments: any[] = []
  let announcementsMap: Record<string, any[]> = {}
  let standingsMap: Record<string, any[]> = {}
  let roundsMap: Record<string, any[]> = {}

  if (tournamentIds.length > 0) {
    const { data: tournamentData } = await adminClient
      .from("tournaments")
      .select(`
        id,
        name,
        slug,
        status,
        format,
        start_date,
        end_date,
        venue_name,
        location,
        max_participants,
        current_round,
        games (name, icon_url)
      `)
      .in("id", tournamentIds)
      .order("start_date", { ascending: false })

    tournaments = tournamentData || []

    // Fetch announcements for all tournaments
    const { data: allAnnouncements } = await adminClient
      .from("tournament_announcements")
      .select("*")
      .in("tournament_id", tournamentIds)
      .order("created_at", { ascending: false })

    allAnnouncements?.forEach(a => {
      if (!announcementsMap[a.tournament_id]) {
        announcementsMap[a.tournament_id] = []
      }
      announcementsMap[a.tournament_id].push(a)
    })

    // Fetch standings for all tournaments (try player_id first, fall back to user_id)
    const { data: allStandings } = await adminClient
      .from("tournament_standings")
      .select(`
        *,
        player:profiles (id, first_name, last_name, avatar_url)
      `)
      .in("tournament_id", tournamentIds)
      .order("rank", { ascending: true })

    allStandings?.forEach(s => {
      if (!standingsMap[s.tournament_id]) {
        standingsMap[s.tournament_id] = []
      }
      standingsMap[s.tournament_id].push(s)
    })

    // Fetch rounds for all tournaments
    const { data: allRounds } = await adminClient
      .from("tournament_rounds")
      .select("*")
      .in("tournament_id", tournamentIds)
      .order("round_number", { ascending: true })

    allRounds?.forEach(r => {
      if (!roundsMap[r.tournament_id]) {
        roundsMap[r.tournament_id] = []
      }
      roundsMap[r.tournament_id].push(r)
    })
  }

  // Group tournaments by status
  // Live = in_progress
  // Upcoming = registration, pending, draft
  // History = completed, cancelled, ended, OR any tournament not in the other categories
  const activeTournaments = tournaments.filter(t => t.status === "in_progress")
  const upcomingTournaments = tournaments.filter(t => t.status === "registration" || t.status === "pending" || t.status === "draft")
  const pastTournaments = tournaments.filter(t => 
    t.status === "completed" || t.status === "cancelled" || t.status === "ended" ||
    // Include any tournaments that don't fit other categories (fallback)
    (!["in_progress", "registration", "pending", "draft"].includes(t.status))
  )
  
  // Calculate overall stats
  let totalWins = 0, totalLosses = 0, totalDraws = 0
  userMatches?.forEach(m => {
    if (m.status === "completed" || m.result) {
      const playerId = playerMap.get(m.tournament_id)
      const isPlayer1 = m.player1_id === playerId
      if (m.result === "draw") {
        totalDraws++
      } else if ((isPlayer1 && (m.player1_wins || 0) > (m.player2_wins || 0)) || (!isPlayer1 && (m.player2_wins || 0) > (m.player1_wins || 0))) {
        totalWins++
      } else if (m.result) {
        totalLosses++
      }
    }
  })
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0

  // Calculate match stats per tournament
  const getTournamentStats = (tournamentId: string) => {
    const matches = userMatches?.filter(m => m.tournament_id === tournamentId) || []
    const playerId = playerMap.get(tournamentId)
    let wins = 0, losses = 0, draws = 0
    const currentMatch = matches.find(m => m.status === "in_progress" || m.status === "pending")
    
    matches.forEach(m => {
      if (m.status === "completed" || m.result) {
        const isPlayer1 = m.player1_id === playerId
        if (m.result === "draw") {
          draws++
        } else if ((isPlayer1 && (m.player1_wins || 0) > (m.player2_wins || 0)) || (!isPlayer1 && (m.player2_wins || 0) > (m.player1_wins || 0))) {
          wins++
        } else if (m.result) {
          losses++
        }
      }
    })
    
    return { wins, losses, draws, currentMatch, totalMatches: matches.length, matches }
  }

  // Get player's standing in a tournament
  const getPlayerStanding = (tournamentId: string) => {
    const standings = standingsMap[tournamentId] || []
    const playerId = playerMap.get(tournamentId)
    return standings.find(s => s.player_id === playerId)
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
          Manage your tournament matches, view history, and track your stats
        </p>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 bg-card w-fit">
        <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
        <span>MAJH Events Connection Active</span>
      </div>

      {/* Debug Panel - Collapsible */}
      <DebugPanel debugData={debugData} />

      {/* Overall Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Ranking Points</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Swords className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  <span className="text-green-500">{totalWins}</span>
                  <span className="text-muted-foreground mx-1">-</span>
                  <span className="text-red-500">{totalLosses}</span>
                </p>
                <p className="text-xs text-muted-foreground">Match Record</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{winRate}%</p>
                <p className="text-xs text-muted-foreground">Win Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Calendar className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tournaments.length}</p>
                <p className="text-xs text-muted-foreground">Events Entered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Trophy className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Titles Won</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Organization */}
      <Tabs defaultValue={activeTournaments.length > 0 ? "active" : pastTournaments.length > 0 ? "history" : "upcoming"} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${activeTournaments.length > 0 ? "bg-green-500 animate-pulse" : "bg-muted"}`} />
            Live ({activeTournaments.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcomingTournaments.length})</TabsTrigger>
          <TabsTrigger value="history">History ({pastTournaments.length})</TabsTrigger>
        </TabsList>

        {/* Active Tournaments Tab */}
        <TabsContent value="active" className="space-y-4">
          {activeTournaments.length > 0 ? (
            activeTournaments.map(tournament => {
              const stats = getTournamentStats(tournament.id)
              const announcements = announcementsMap[tournament.id] || []
              const standing = getPlayerStanding(tournament.id)
              const rounds = roundsMap[tournament.id] || []
              
              return (
                <Card key={tournament.id} className="border-primary/50 bg-primary/5">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {tournament.games?.icon_url ? (
                          <img src={tournament.games.icon_url} alt="" className="h-12 w-12 rounded object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                            <Gamepad2 className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-xl">{tournament.name}</CardTitle>
                          <CardDescription>{tournament.games?.name} - {tournament.format}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="default" className="bg-green-500">Live - Round {tournament.current_round || 1}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Current Match Alert */}
                    {stats.currentMatch && (
                      <div className="rounded-lg border-2 border-primary bg-primary/10 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-semibold text-primary">Active Match - Table {stats.currentMatch.table_number || "TBD"}</p>
                              <p className="text-sm text-muted-foreground">
                                vs {stats.currentMatch.player1_id === user.id 
                                  ? `${stats.currentMatch.player2?.first_name || ''} ${stats.currentMatch.player2?.last_name || ''}`.trim() || 'Opponent'
                                  : `${stats.currentMatch.player1?.first_name || ''} ${stats.currentMatch.player1?.last_name || ''}`.trim() || 'Opponent'
                                }
                              </p>
                            </div>
                          </div>
                          <Link href={`/dashboard/player-portal/${tournament.id}`}>
                            <Button>Report Result</Button>
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-lg bg-card p-3 text-center">
                        <p className="text-lg font-bold">
                          <span className="text-green-500">{stats.wins}</span>-<span className="text-red-500">{stats.losses}</span>
                          {stats.draws > 0 && <span className="text-yellow-500">-{stats.draws}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">Record</p>
                      </div>
                      <div className="rounded-lg bg-card p-3 text-center">
                        <p className="text-lg font-bold">{standing?.rank || "-"}</p>
                        <p className="text-xs text-muted-foreground">Standing</p>
                      </div>
                      <div className="rounded-lg bg-card p-3 text-center">
                        <p className="text-lg font-bold">{standing?.match_points || 0}</p>
                        <p className="text-xs text-muted-foreground">Points</p>
                      </div>
                    </div>

                    {/* Announcements */}
                    {announcements.length > 0 && (
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-card p-3 hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Megaphone className="h-4 w-4 text-primary" />
                            <span className="font-medium">Announcements ({announcements.length})</span>
                          </div>
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-2">
                          {announcements.slice(0, 5).map(a => (
                            <div key={a.id} className="rounded-lg border border-border bg-card p-3">
                              <p className="text-sm">{a.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Action Button */}
                    <Link href={`/dashboard/player-portal/${tournament.id}`}>
                      <Button className="w-full">
                        Open Full Player Controller
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })
          ) : (
            <Card className="p-8 text-center">
              <Gamepad2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Live Tournaments</h3>
              <p className="text-muted-foreground text-sm">You don&apos;t have any active tournaments right now.</p>
            </Card>
          )}
        </TabsContent>

        {/* Upcoming Tab */}
        <TabsContent value="upcoming" className="space-y-4">
          {upcomingTournaments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {upcomingTournaments.map(tournament => (
                <Card key={tournament.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      {tournament.games?.icon_url ? (
                        <img src={tournament.games.icon_url} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                          <Gamepad2 className="h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">{tournament.name}</CardTitle>
                        <CardDescription>{tournament.games?.name}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {tournament.start_date ? format(new Date(tournament.start_date), "MMM d, yyyy 'at' h:mm a") : "TBD"}
                    </div>
                    {tournament.venue_name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {tournament.venue_name}
                      </div>
                    )}
                    <Link href={`/esports/tournaments/${tournament.slug}`}>
                      <Button variant="outline" className="w-full">View Tournament</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Upcoming Tournaments</h3>
              <p className="text-muted-foreground text-sm mb-4">Browse tournaments to find your next event.</p>
              <Link href="/esports/tournaments">
                <Button>Browse Tournaments</Button>
              </Link>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          {pastTournaments.length > 0 ? (
            pastTournaments.map(tournament => {
              const stats = getTournamentStats(tournament.id)
              const announcements = announcementsMap[tournament.id] || []
              const standing = getPlayerStanding(tournament.id)
              const rounds = roundsMap[tournament.id] || []
              
              return (
                <Collapsible key={tournament.id}>
                  <Card>
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {tournament.games?.icon_url ? (
                              <img src={tournament.games.icon_url} alt="" className="h-10 w-10 rounded object-cover" />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                                <Gamepad2 className="h-5 w-5" />
                              </div>
                            )}
                            <div className="text-left">
                              <CardTitle className="text-lg">{tournament.name}</CardTitle>
                              <CardDescription>
                                {tournament.start_date ? format(new Date(tournament.start_date), "MMM d, yyyy") : ""}
                                {" - "}
                                {tournament.games?.name}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Final Standing */}
                            {standing?.rank && (
                              <div className="text-right">
                                <p className="text-lg font-bold">#{standing.rank}</p>
                                <p className="text-xs text-muted-foreground">Final</p>
                              </div>
                            )}
                            {/* Record */}
                            <div className="text-right">
                              <p className="font-bold">
                                <span className="text-green-500">{stats.wins}</span>-<span className="text-red-500">{stats.losses}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">Record</p>
                            </div>
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-4">
                        {/* Match History */}
                        <div className="space-y-2">
                          <h4 className="font-medium flex items-center gap-2">
                            <Swords className="h-4 w-4" />
                            Match History
                          </h4>
                          <div className="space-y-2">
                            {stats.matches.map((match, idx) => {
                              const isPlayer1 = match.player1_id === user.id
                              const opponent = isPlayer1 ? match.player2 : match.player1
                              const myWins = isPlayer1 ? match.player1_wins : match.player2_wins
                              const oppWins = isPlayer1 ? match.player2_wins : match.player1_wins
                              const won = (myWins || 0) > (oppWins || 0)
                              const lost = (oppWins || 0) > (myWins || 0)
                              
                              return (
                                <div key={match.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`h-2 w-2 rounded-full ${won ? "bg-green-500" : lost ? "bg-red-500" : "bg-yellow-500"}`} />
                                    <div>
                                      <p className="text-sm font-medium">
                                        Round {match.tournament_rounds?.round_number || idx + 1}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        vs {opponent?.first_name || ''} {opponent?.last_name || 'Opponent'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className={`font-bold ${won ? "text-green-500" : lost ? "text-red-500" : "text-muted-foreground"}`}>
                                      {match.status === "completed" ? `${myWins || 0}-${oppWins || 0}` : match.status}
                                    </p>
                                    {match.table_number && (
                                      <p className="text-xs text-muted-foreground">Table {match.table_number}</p>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Announcements History */}
                        {announcements.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              <Megaphone className="h-4 w-4" />
                              Announcements ({announcements.length})
                            </h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {announcements.map(a => (
                                <div key={a.id} className="rounded-lg bg-muted/50 p-3">
                                  <p className="text-sm">{a.message}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(a.created_at), "MMM d, yyyy 'at' h:mm a")}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Rounds Summary */}
                        {rounds.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              <Table2 className="h-4 w-4" />
                              Rounds ({rounds.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {rounds.map(r => (
                                <Badge key={r.id} variant={r.status === "completed" ? "secondary" : "outline"}>
                                  Round {r.round_number}: {r.status}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tournament Quick Links */}
                        <div className="space-y-2">
                          <h4 className="font-medium">Tournament Details</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Link href={`/esports/tournaments/${tournament.slug}?tab=bracket`}>
                              <Button variant="outline" size="sm" className="w-full">
                                <Trophy className="h-3 w-3 mr-1" />
                                Bracket
                              </Button>
                            </Link>
                            <Link href={`/esports/tournaments/${tournament.slug}?tab=rounds`}>
                              <Button variant="outline" size="sm" className="w-full">
                                <Table2 className="h-3 w-3 mr-1" />
                                Rounds
                              </Button>
                            </Link>
                            <Link href={`/esports/tournaments/${tournament.slug}?tab=standings`}>
                              <Button variant="outline" size="sm" className="w-full">
                                <Medal className="h-3 w-3 mr-1" />
                                Standings
                              </Button>
                            </Link>
                            <Link href={`/esports/tournaments/${tournament.slug}?tab=participants`}>
                              <Button variant="outline" size="sm" className="w-full">
                                <Users className="h-3 w-3 mr-1" />
                                Participants
                              </Button>
                            </Link>
                          </div>
                        </div>

                        {/* Main Actions */}
                        <div className="flex gap-2">
                          <Link href={`/dashboard/player-portal/${tournament.id}`} className="flex-1">
                            <Button variant="outline" className="w-full">View Player Controller</Button>
                          </Link>
                          <Link href={`/esports/tournaments/${tournament.slug}`}>
                            <Button className="flex-1">
                              View Full Tournament
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )
            })
          ) : (
            <Card className="p-8 text-center">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Tournament History</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Tournaments you&apos;ve participated in will appear here with full match history, 
                announcements, standings, and results.
              </p>
              <Link href="/esports/tournaments">
                <Button>Find Tournaments</Button>
              </Link>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Links */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link href="/esports/tournaments" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
            <div className="flex items-center gap-3">
              <Gamepad2 className="h-5 w-5 text-muted-foreground" />
              <span>Browse Tournaments</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link href="/esports/leaderboards" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <span>Leaderboards</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link href="/dashboard/profile" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span>My Public Profile</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
