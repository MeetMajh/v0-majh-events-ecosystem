import Link from "next/link"
import { Trophy, Medal, Award } from "lucide-react"

type LeaderboardEntry = {
  id: string
  total_wins: number
  total_losses: number
  tournaments_played: number
  tournaments_won: number
  ranking_points: number
  profiles: { id: string; display_name: string; avatar_url: string | null } | null
  games?: { name: string; slug: string } | null
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-primary" />
  if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />
  if (rank === 3) return <Award className="h-5 w-5 text-chart-5" />
  return <span className="flex h-5 w-5 items-center justify-center text-xs font-bold text-muted-foreground">{rank}</span>
}

export function LeaderboardTable({
  entries,
  showGame = false,
}: {
  entries: LeaderboardEntry[]
  showGame?: boolean
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">No rankings yet. Compete in tournaments to get ranked.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Rank</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Player</th>
            {showGame && <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">Game</th>}
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">W/L</th>
            <th className="hidden px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">Tournaments</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Points</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr key={entry.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
              <td className="px-4 py-3">
                <RankBadge rank={idx + 1} />
              </td>
              <td className="px-4 py-3">
                {entry.profiles ? (
                  <Link
                    href={`/esports/players/${entry.profiles.id}`}
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {entry.profiles.display_name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Unknown</span>
                )}
              </td>
              {showGame && (
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="text-sm text-muted-foreground">{entry.games?.name}</span>
                </td>
              )}
              <td className="px-4 py-3 text-center">
                <span className="text-sm">
                  <span className="font-medium text-chart-3">{entry.total_wins}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-destructive">{entry.total_losses}</span>
                </span>
              </td>
              <td className="hidden px-4 py-3 text-center text-sm text-muted-foreground sm:table-cell">
                {entry.tournaments_played}
                {entry.tournaments_won > 0 && (
                  <span className="ml-1 text-primary">({entry.tournaments_won} won)</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-bold text-primary">{entry.ranking_points.toLocaleString()}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
