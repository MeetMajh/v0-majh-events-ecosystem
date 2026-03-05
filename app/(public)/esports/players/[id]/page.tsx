import { notFound } from "next/navigation"
import Link from "next/link"
import { getPlayerProfile } from "@/lib/esports-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Swords, BarChart3, Users, Target } from "lucide-react"

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

  const winRate = player.stats.totalWins + player.stats.totalLosses > 0
    ? Math.round((player.stats.totalWins / (player.stats.totalWins + player.stats.totalLosses)) * 100)
    : 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <Link href="/esports/leaderboards" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors">
        &larr; Leaderboards
      </Link>

      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
          {player.display_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{player.display_name}</h1>
          {player.teams.length > 0 && (
            <div className="mt-1 flex gap-2">
              {player.teams.map((team: any) => (
                <Link key={team.id} href={`/esports/teams/${team.slug}`}>
                  <Badge variant="outline" className="text-xs hover:border-primary/30">
                    {team.tag ? `[${team.tag}]` : ""} {team.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Ranking Points</p>
              <p className="text-xl font-bold text-primary">{player.stats.totalRankingPoints.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <Swords className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Win / Loss</p>
              <p className="text-xl font-bold">
                <span className="text-chart-3">{player.stats.totalWins}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-destructive">{player.stats.totalLosses}</span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Win Rate</p>
              <p className="text-xl font-bold text-foreground">{winRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <Trophy className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Tournaments</p>
              <p className="text-xl font-bold text-foreground">{player.stats.totalTournaments}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Game Rankings */}
      {player.leaderboardEntries.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-foreground">Game Rankings</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {player.leaderboardEntries.map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">{entry.games?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.total_wins}W - {entry.total_losses}L | {entry.tournaments_played} tournaments
                  </p>
                </div>
                <span className="text-lg font-bold text-primary">{entry.ranking_points}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tournament History */}
      {player.tournamentResults.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-foreground">Tournament History</h2>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Tournament</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Place</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Points</th>
                </tr>
              </thead>
              <tbody>
                {player.tournamentResults.map((result: any) => (
                  <tr key={result.id} className="border-b border-border/50">
                    <td className="px-4 py-2">
                      <Link href={`/esports/tournaments/${result.tournaments?.slug}`} className="text-sm font-medium text-foreground hover:text-primary">
                        {result.tournaments?.name}
                      </Link>
                      <p className="text-[10px] text-muted-foreground">{result.tournaments?.games?.name}</p>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {result.placement <= 3 ? (
                        <Badge className={result.placement === 1 ? "bg-primary/10 text-primary" : result.placement === 2 ? "bg-muted text-muted-foreground" : "bg-chart-5/10 text-chart-5"}>
                          {result.placement === 1 ? "1st" : result.placement === 2 ? "2nd" : "3rd"}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">{result.placement}th</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-bold text-primary">+{result.ranking_points_awarded}</td>
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
