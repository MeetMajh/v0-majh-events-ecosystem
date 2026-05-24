import Link from "next/link"
import { Trophy, Users, Calendar, DollarSign } from "lucide-react"
import { FORMAT_LABELS, type TournamentFormat } from "@/lib/bracket-utils"
import { formatCents, formatDate } from "@/lib/format"

type Tournament = {
  id: string
  name: string
  slug: string
  format: string
  status: string
  entry_fee_cents: number
  max_participants: number | null
  start_date: string | null
  games: { name: string; slug: string; category: string } | null
  tournament_participants: { count: number }[]
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  registration: { label: "Open", className: "bg-chart-3/10 text-chart-3 border-chart-3/30" },
  in_progress: { label: "Live", className: "bg-destructive/10 text-destructive border-destructive/30 animate-pulse" },
  completed: { label: "Completed", className: "bg-primary/10 text-primary border-primary/30" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
}

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const status = STATUS_STYLES[tournament.status] ?? STATUS_STYLES.draft
  const participantCount = tournament.tournament_participants?.[0]?.count ?? 0
  const isLive = tournament.status === "in_progress"

  return (
    <Link href={`/esports/tournaments/${tournament.slug}`} className="group block">
      <div className={`esports-card glass-panel rounded-xl border-0 p-5 ${isLive ? "glow-live ring-1 ring-destructive/30" : ""}`}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {tournament.games && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {tournament.games.name}
              </span>
            )}
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}>
              {status.label}
            </span>
          </div>
          {tournament.entry_fee_cents > 0 ? (
            <span className="flex items-center gap-0.5 text-xs font-medium text-primary">
              <DollarSign className="h-3 w-3" />
              {formatCents(tournament.entry_fee_cents)}
            </span>
          ) : (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">FREE</span>
          )}
        </div>

        <h3 className="mb-1 text-balance font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {tournament.name}
        </h3>

        <p className="esports-subheading mb-4 text-muted-foreground">
          {FORMAT_LABELS[tournament.format as TournamentFormat] ?? tournament.format}
        </p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {participantCount}{tournament.max_participants ? `/${tournament.max_participants}` : ""}
          </span>
          {tournament.start_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(tournament.start_date)}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-primary">
            <Trophy className="h-3.5 w-3.5" />
            Compete
          </span>
        </div>
      </div>
    </Link>
  )
}
