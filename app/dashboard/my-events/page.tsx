import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Trophy, Swords, Calendar, MapPin, Clock, ChevronRight, 
  Users, Gamepad2, Target, TrendingUp, Medal, Star
} from "lucide-react"
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns"

export const metadata = {
  title: "My Events | MAJH EVENTS",
  description: "View your tournament registrations and match history as a player",
}

async function getMyEvents(userId: string) {
  const supabase = await createClient()

  // Get user's tournament registrations - query all statuses except dropped
  const { data: registrations, error: regError } = await supabase
    .from("tournament_registrations")
    .select(`
      *,
      tournaments (
        id, name, slug, status, start_date, end_date, location, venue_name,
        games (id, name, category, icon_url)
      )
    `)
    .eq("player_id", userId)
    .order("created_at", { ascending: false })
  
  if (regError) {
    console.error("[v0] Error fetching registrations:", regError)
  }

  // Get user's match history
  const { data: matches } = await supabase
    .from("tournament_matches")
    .select(`
      *,
      tournament_rounds (round_number, status, tournament_id),
      player1:profiles!player1_id (id, first_name, last_name, avatar_url),
      player2:profiles!player2_id (id, first_name, last_name, avatar_url)
    `)
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(20)

  // Get user's leaderboard entries
  const { data: leaderboardEntries } = await supabase
    .from("leaderboard_entries")
    .select(`
      *,
      games (id, name, category, icon_url)
    `)
    .eq("player_id", userId)
    .order("ranking_points", { ascending: false })

  // Get user's tournament results
  const { data: results } = await supabase
    .from("tournament_results")
    .select(`
      *,
      tournaments (id, name, slug, start_date, games (name))
    `)
    .eq("player_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)

  return {
    registrations: registrations ?? [],
    matches: matches ?? [],
    leaderboardEntries: leaderboardEntries ?? [],
    results: results ?? [],
  }
}

export default async function MyEventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/dashboard/my-events")
  }

  const { registrations, matches, leaderboardEntries, results } = await getMyEvents(user.id)

  // Categorize registrations - be more lenient with status matching
  const activeEvents = registrations.filter(
    r => r.tournaments && r.tournaments.status === "in_progress" && !["dropped", "disqualified"].includes(r.status)
  )
  const upcomingEvents = registrations.filter(
    r => r.tournaments && (r.tournaments.status === "registration" || 
         (r.tournaments.start_date && isFuture(new Date(r.tournaments.start_date)))) && 
         !["dropped", "disqualified"].includes(r.status) &&
         r.tournaments.status !== "in_progress" &&
         r.tournaments.status !== "completed"
  )
  const pastEvents = registrations.filter(
    r => r.tournaments && r.tournaments.status === "completed"
  )

  // Calculate stats
  const totalWins = leaderboardEntries.reduce((sum, e) => sum + (e.total_wins ?? 0), 0)
  const totalLosses = leaderboardEntries.reduce((sum, e) => sum + (e.total_losses ?? 0), 0)
  const totalPoints = leaderboardEntries.reduce((sum, e) => sum + (e.ranking_points ?? 0), 0)
  const tournamentsWon = results.filter(r => r.placement === 1).length
  const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">My Events</h1>
        <p className="text-muted-foreground mt-1">
          View your tournament registrations, matches, and player stats
        </p>
      </div>

      {/* Player Stats Overview */}
      <div className="grid gap-4 md:grid-cols-5 mb-8">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{totalPoints.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Ranking Points</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Swords className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                <span className="text-green-600">{totalWins}</span>
                <span className="text-muted-foreground"> - </span>
                <span className="text-red-500">{totalLosses}</span>
              </p>
              <p className="text-xs text-muted-foreground">Match Record</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{winRate}%</p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Gamepad2 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{registrations.length}</p>
              <p className="text-xs text-muted-foreground">Events Entered</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
              <Trophy className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{tournamentsWon}</p>
              <p className="text-xs text-muted-foreground">Titles Won</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Active & Upcoming Events */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Events */}
          {activeEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  Active Events
                </CardTitle>
                <CardDescription>Tournaments currently in progress</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeEvents.map((reg) => (
                  <Link 
                    key={reg.id} 
                    href={`/dashboard/my-events/${reg.tournaments?.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Gamepad2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{reg.tournaments?.name}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {reg.tournaments?.games?.name}
                          </Badge>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {reg.tournaments?.venue_name || reg.tournaments?.location || "TBA"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                        {reg.status === "checked_in" ? "Checked In" : "Registered"}
                      </Badge>
                      <Button size="sm" variant="secondary">
                        Player Controller
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Events
                </CardTitle>
                <CardDescription>Tournaments you're registered for</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingEvents.map((reg) => (
                  <Link 
                    key={reg.id} 
                    href={`/dashboard/my-events/${reg.tournaments?.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                        <Gamepad2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{reg.tournaments?.name}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {reg.tournaments?.games?.name}
                          </Badge>
                          {reg.tournaments?.start_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(reg.tournaments.start_date), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{reg.status}</Badge>
                      <Button size="sm" variant="outline">
                        Player Controller
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent Matches */}
          {matches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Swords className="h-5 w-5 text-primary" />
                  Recent Matches
                </CardTitle>
                <CardDescription>Your latest match results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {matches.slice(0, 10).map((match) => {
                    const isPlayer1 = match.player1_id === user.id
                    const opponent = isPlayer1 ? match.player2 : match.player1
                    const opponentName = opponent 
                      ? `${opponent.first_name || ''} ${opponent.last_name || ''}`.trim() || 'Unknown'
                      : 'BYE'
                    const isWinner = match.winner_id === user.id
                    const isDraw = match.status === "confirmed" && !match.winner_id

                    return (
                      <div 
                        key={match.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={opponent?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {opponentName[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">vs {opponentName}</p>
                            <p className="text-xs text-muted-foreground">
                              Round {match.tournament_rounds?.round_number}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {match.status === "confirmed" ? (
                            <Badge className={
                              match.is_bye ? "bg-blue-500/20 text-blue-600" :
                              isWinner ? "bg-green-500/20 text-green-600" :
                              isDraw ? "bg-yellow-500/20 text-yellow-600" :
                              "bg-red-500/20 text-red-600"
                            }>
                              {match.is_bye ? "BYE" : isWinner ? "WIN" : isDraw ? "DRAW" : "LOSS"}
                            </Badge>
                          ) : (
                            <Badge variant="outline">{match.status}</Badge>
                          )}
                          {match.player1_score !== null && match.player2_score !== null && (
                            <span className="text-sm font-mono">
                              {isPlayer1 ? match.player1_score : match.player2_score}
                              {" - "}
                              {isPlayer1 ? match.player2_score : match.player1_score}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Events State */}
          {activeEvents.length === 0 && upcomingEvents.length === 0 && matches.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <Gamepad2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No active events</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You're not currently registered for any tournaments.
                </p>
                <Button asChild>
                  <Link href="/esports/tournaments">Browse Tournaments</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Game Rankings */}
          {leaderboardEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  Game Rankings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {leaderboardEntries.map((entry) => (
                  <div 
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div>
                      <p className="font-medium text-sm">{entry.games?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.total_wins}W - {entry.total_losses}L
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{entry.ranking_points}</p>
                      <p className="text-[10px] text-muted-foreground">points</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent Results */}
          {results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Medal className="h-5 w-5 text-primary" />
                  Recent Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.slice(0, 5).map((result) => (
                  <Link 
                    key={result.id}
                    href={`/esports/tournaments/${result.tournaments?.slug}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm line-clamp-1">{result.tournaments?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.tournaments?.start_date && format(new Date(result.tournaments.start_date), "MMM d, yyyy")}
                      </p>
                    </div>
                    {result.placement === 1 ? (
                      <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                        <Trophy className="mr-1 h-3 w-3" />
                        1st
                      </Badge>
                    ) : result.placement === 2 ? (
                      <Badge variant="secondary">2nd</Badge>
                    ) : result.placement === 3 ? (
                      <Badge className="bg-amber-700/20 text-amber-700">3rd</Badge>
                    ) : (
                      <Badge variant="outline">{result.placement}th</Badge>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/esports/tournaments">
                  <Gamepad2 className="mr-2 h-4 w-4" />
                  Browse Tournaments
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/esports/leaderboards">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Leaderboards
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/esports/players/${user.id}`}>
                  <Users className="mr-2 h-4 w-4" />
                  My Public Profile
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
