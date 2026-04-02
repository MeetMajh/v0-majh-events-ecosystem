import { notFound } from "next/navigation"
import Link from "next/link"
import { getPlayerProfile } from "@/lib/esports-actions"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trophy, Swords, BarChart3, Users, Target, Medal, CalendarDays, TrendingUp, Gamepad2, CheckCircle2, XCircle, MinusCircle, Clock } from "lucide-react"
import { format } from "date-fns"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const player = await getPlayerProfile(id)
  if (!player) return { title: "Player Not Found" }
  return { title: `${player.display_name} | MAJH EVENTS` }
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const player = await getPlayerProfile(id)
  if (!player) notFound()

  const totalMatches = player.stats.totalWins + player.stats.totalLosses + (player.stats.totalDraws ?? 0)
  const winRate = totalMatches > 0
    ? Math.round((player.stats.totalWins / totalMatches) * 100)
    : 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <Link href="/esports/leaderboards" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors">
        &larr; Leaderboards
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <Avatar className="h-24 w-24 ring-4 ring-primary/20">
          <AvatarImage src={player.avatar_url ?? undefined} />
          <AvatarFallback className="text-3xl font-bold bg-primary/10 text-primary">
            {player.display_name?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-foreground">{player.display_name}</h1>
            {player.stats.totalRankingPoints > 0 && (
              <Badge className="bg-primary/10 text-primary border-primary/30">
                <TrendingUp className="mr-1 h-3 w-3" />
                {player.stats.totalRankingPoints.toLocaleString()} pts
              </Badge>
            )}
          </div>
          {player.teams.length > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {player.teams.map((team: any) => (
                <Link key={team.id} href={`/esports/teams/${team.slug}`}>
                  <Badge variant="outline" className="text-xs hover:border-primary/30 hover:bg-primary/5">
                    <Users className="mr-1 h-3 w-3" />
                    {team.tag ? `[${team.tag}]` : ""} {team.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
          {player.created_at && (
            <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Member since {format(new Date(player.created_at), "MMMM yyyy")}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{player.stats.totalRankingPoints.toLocaleString()}</p>
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
                <span className="text-green-600">{player.stats.totalWins}</span>
                <span className="text-muted-foreground"> - </span>
                {player.stats.totalDraws > 0 && (
                  <>
                    <span className="text-yellow-500">{player.stats.totalDraws}</span>
                    <span className="text-muted-foreground"> - </span>
                  </>
                )}
                <span className="text-red-500">{player.stats.totalLosses}</span>
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
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-foreground">{winRate}%</p>
                <div className="h-2 w-12 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${winRate}%` }} />
                </div>
              </div>
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
              <p className="text-2xl font-bold text-foreground">{player.stats.totalTournaments}</p>
              <p className="text-xs text-muted-foreground">Tournaments</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
              <Trophy className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {player.leaderboardEntries.reduce((sum: number, e: any) => sum + (e.tournaments_won ?? 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">Titles Won</p>
            </div>
          </CardContent>
        </Card>
        {player.stats.bestPlacement && (
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Medal className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {player.stats.bestPlacement === 1 ? "1st" : 
                   player.stats.bestPlacement === 2 ? "2nd" : 
                   player.stats.bestPlacement === 3 ? "3rd" : 
                   `${player.stats.bestPlacement}th`}
                </p>
                <p className="text-xs text-muted-foreground">Best Finish</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Game Rankings */}
      {player.leaderboardEntries.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-foreground flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            Game Rankings
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {player.leaderboardEntries.map((entry: any) => {
              const gameWinRate = entry.total_wins + entry.total_losses > 0
                ? Math.round((entry.total_wins / (entry.total_wins + entry.total_losses)) * 100)
                : 0
              
              return (
                <Card key={entry.id} className="border-border bg-card overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground">{entry.games?.name}</p>
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {entry.games?.category}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{entry.ranking_points}</p>
                        <p className="text-[10px] text-muted-foreground">points</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Record</span>
                        <span className="font-mono">
                          <span className="text-green-600">{entry.total_wins}</span>
                          <span className="text-muted-foreground"> - </span>
                          <span className="text-red-500">{entry.total_losses}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Win Rate</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-green-500" style={{ width: `${gameWinRate}%` }} />
                          </div>
                          <span className="text-xs">{gameWinRate}%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Events</span>
                        <span>{entry.tournaments_played}</span>
                      </div>
                      {entry.tournaments_won > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Titles</span>
                          <span className="flex items-center gap-1 text-yellow-500">
                            <Trophy className="h-3 w-3" />
                            {entry.tournaments_won}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* Recent Matches */}
      {player.recentMatches && player.recentMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-foreground flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            Recent Matches
          </h2>
          <div className="space-y-2">
            {player.recentMatches.slice(0, 10).map((match: any) => (
              <div 
                key={match.id} 
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/20"
              >
                {/* Result indicator */}
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  match.result === "win" && "bg-green-500/10",
                  match.result === "loss" && "bg-red-500/10",
                  match.result === "draw" && "bg-yellow-500/10"
                )}>
                  {match.result === "win" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                  {match.result === "loss" && <XCircle className="h-5 w-5 text-red-500" />}
                  {match.result === "draw" && <MinusCircle className="h-5 w-5 text-yellow-500" />}
                </div>
                
                {/* Match details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">vs</span>
                    <Link 
                      href={`/esports/players/${match.opponentId}`}
                      className="font-medium text-foreground hover:text-primary transition-colors truncate"
                    >
                      {match.opponentName}
                    </Link>
                    <Badge variant="outline" className="text-[10px]">
                      {match.result === "win" ? "WIN" : match.result === "loss" ? "LOSS" : "DRAW"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    {match.tournament && (
                      <Link 
                        href={`/esports/tournaments/${match.tournament.slug}`}
                        className="hover:text-foreground transition-colors truncate"
                      >
                        {match.tournament.name}
                      </Link>
                    )}
                    {match.roundNumber && (
                      <span className="text-muted-foreground/60">
                        • Round {match.roundNumber}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Score */}
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-bold">
                    <span className={match.result === "win" ? "text-green-600" : "text-muted-foreground"}>
                      {match.myWins ?? 0}
                    </span>
                    <span className="text-muted-foreground"> - </span>
                    <span className={match.result === "loss" ? "text-red-500" : "text-muted-foreground"}>
                      {match.opponentWins ?? 0}
                    </span>
                  </p>
                  {match.createdAt && (
                    <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {format(new Date(match.createdAt), "MMM d")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tournament History */}
      {player.tournamentResults.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-foreground flex items-center gap-2">
            <Medal className="h-5 w-5 text-primary" />
            Tournament History
          </h2>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Tournament</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Place</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground hidden md:table-cell">Record</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Points</th>
                </tr>
              </thead>
              <tbody>
                {player.tournamentResults.map((result: any) => (
                  <tr key={result.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/esports/tournaments/${result.tournaments?.slug}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                        {result.tournaments?.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">
                          {result.tournaments?.games?.name}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground hidden sm:table-cell">
                      {result.tournaments?.start_date && format(new Date(result.tournaments.start_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {result.placement === 1 ? (
                        <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                          <Trophy className="mr-1 h-3 w-3" />
                          1st
                        </Badge>
                      ) : result.placement === 2 ? (
                        <Badge variant="secondary">
                          <Medal className="mr-1 h-3 w-3" />
                          2nd
                        </Badge>
                      ) : result.placement === 3 ? (
                        <Badge className="bg-amber-700/20 text-amber-700 border-amber-700/30">
                          <Medal className="mr-1 h-3 w-3" />
                          3rd
                        </Badge>
                      ) : result.placement <= 8 ? (
                        <Badge variant="outline">Top 8</Badge>
                      ) : result.placement <= 16 ? (
                        <Badge variant="outline">Top 16</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">{result.placement}th</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm hidden md:table-cell">
                      {result.match_wins !== undefined && (
                        <>
                          <span className="text-green-600">{result.match_wins}</span>
                          <span className="text-muted-foreground"> - </span>
                          <span className="text-red-500">{result.match_losses}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold text-primary">+{result.ranking_points_awarded}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Teams */}
      {player.teams.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold text-foreground">Teams</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {player.teams.map((team: any) => (
              <Link key={team.id} href={`/esports/teams/${team.slug}`} className="group">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                    {team.tag ?? team.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-foreground group-hover:text-primary transition-colors">{team.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{team.memberRole}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
