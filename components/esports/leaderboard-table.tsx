import Link from "next/link"
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type LeaderboardEntry = {
  id: string
  total_wins: number
  total_losses: number
  tournaments_played: number
  tournaments_won: number
  ranking_points: number
  previous_rank?: number
  profiles: { id: string; display_name: string; username?: string | null; avatar_url: string | null } | null
  games?: { name: string; slug: string; icon_url?: string } | null
}

// Helper to get display name, preferring username if available
function getPlayerDisplayName(profile: { display_name?: string; username?: string | null; first_name?: string; last_name?: string } | null): string {
  if (!profile) return "Unknown"
  if (profile.username) return profile.username
  if (profile.display_name) return profile.display_name
  if (profile.first_name || profile.last_name) return `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
  return "Unknown"
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20">
      <Trophy className="h-4 w-4 text-yellow-500" />
    </div>
  )
  if (rank === 2) return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
      <Medal className="h-4 w-4 text-muted-foreground" />
    </div>
  )
  if (rank === 3) return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-700/20">
      <Award className="h-4 w-4 text-amber-700" />
    </div>
  )
  return (
    <span className="flex h-8 w-8 items-center justify-center text-sm font-bold text-muted-foreground">
      {rank}
    </span>
  )
}

function RankChange({ current, previous }: { current: number; previous?: number }) {
  if (!previous || previous === current) {
    return <Minus className="h-3 w-3 text-muted-foreground/50" />
  }
  if (current < previous) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-green-600">
        <TrendingUp className="h-3 w-3" />
        {previous - current}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-0.5 text-xs text-red-500">
      <TrendingDown className="h-3 w-3" />
      {current - previous}
    </span>
  )
}

export function LeaderboardTable({
  entries,
  showGame = false,
  showRankChange = false,
}: {
  entries: LeaderboardEntry[]
  showGame?: boolean
  showRankChange?: boolean
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <Trophy className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-muted-foreground">No rankings yet. Compete in tournaments to get ranked.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-20">Rank</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Player</th>
            {showGame && <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">Game</th>}
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Record</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">Win Rate</th>
            <th className="hidden px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">Events</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Points</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => {
            const winRate = entry.total_wins + entry.total_losses > 0
              ? Math.round((entry.total_wins / (entry.total_wins + entry.total_losses)) * 100)
              : 0
            const rank = idx + 1

            return (
              <tr 
                key={entry.id} 
                className={cn(
                  "border-b border-border/50 transition-colors hover:bg-muted/20",
                  rank <= 3 && "bg-gradient-to-r from-primary/5 to-transparent"
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <RankBadge rank={rank} />
                    {showRankChange && (
                      <RankChange current={rank} previous={entry.previous_rank} />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {entry.profiles ? (
                    <Link
                      href={`/esports/players/${entry.profiles.id}`}
                      className="flex items-center gap-3 group"
                    >
                      <Avatar className="h-8 w-8 ring-2 ring-border group-hover:ring-primary/50 transition-all">
                        <AvatarImage src={entry.profiles.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getPlayerDisplayName(entry.profiles).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {getPlayerDisplayName(entry.profiles)}
                        </span>
                        {entry.tournaments_won > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-yellow-600">
                            <Trophy className="h-2.5 w-2.5" />
                            {entry.tournaments_won}x Champion
                          </div>
                        )}
                      </div>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                </td>
                {showGame && (
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <Badge variant="outline" className="text-xs">
                      {entry.games?.name}
                    </Badge>
                  </td>
                )}
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  <span className="font-mono text-sm">
                    <span className="font-medium text-green-600">{entry.total_wins}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-red-500">{entry.total_losses}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div 
                        className="h-full rounded-full bg-green-500" 
                        style={{ width: `${winRate}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8">{winRate}%</span>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-center text-sm text-muted-foreground lg:table-cell">
                  {entry.tournaments_played}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-lg font-bold text-primary">{entry.ranking_points.toLocaleString()}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
