import { notFound } from "next/navigation"
import Link from "next/link"
import { getTournamentBySlug } from "@/lib/esports-actions"
import { createClient } from "@/lib/supabase/server"
import { getTournamentStandings, getCurrentRound, getTournamentPhases, getAllTournamentRounds, getFeatureMatches, getTournamentVods } from "@/lib/tournament-controller-actions"
import { RegistrationButton } from "@/components/esports/registration-button"
import { TournamentTabs } from "@/components/esports/tournament-tabs"
import { FeatureMatchCard } from "@/components/esports/feature-match-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FORMAT_LABELS, type TournamentFormat } from "@/lib/bracket-utils"
import { formatCents, formatDate, formatDateTime } from "@/lib/format"
import { Calendar, Users, DollarSign, Gamepad2, Trophy, Clock, ChevronRight, Radio, Mic } from "lucide-react"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tournament = await getTournamentBySlug(slug)
  if (!tournament) return { title: "Tournament Not Found" }
  return { title: `${tournament.name} | MAJH EVENTS` }
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  registration: { label: "Registration Open", className: "bg-chart-3/10 text-chart-3 border-chart-3/30" },
  in_progress: { label: "In Progress", className: "bg-destructive/10 text-destructive border-destructive/30" },
  completed: { label: "Completed", className: "bg-primary/10 text-primary border-primary/30" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
}

export default async function TournamentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tournament = await getTournamentBySlug(slug)
  if (!tournament) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isRegistered = tournament.participants.some((p: any) => p.user_id === user?.id)
  const isFull = tournament.max_participants ? tournament.participants.length >= tournament.max_participants : false
  const status = STATUS_STYLES[tournament.status] ?? STATUS_STYLES.draft

  // Fetch phases, standings, current round, all rounds, feature matches, and VODs
  const [phases, currentRound, allRounds, featureMatches, vods] = await Promise.all([
    getTournamentPhases(tournament.id),
    getCurrentRound(tournament.id),
    getAllTournamentRounds(tournament.id),
    tournament.status === "in_progress" ? getFeatureMatches(tournament.id) : Promise.resolve([]),
    getTournamentVods(tournament.id),
  ])

  const currentPhase = phases.find((p: any) => p.is_current) || phases[0]
  const standings = currentPhase 
    ? await getTournamentStandings(tournament.id, currentPhase.id)
    : []

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/esports" className="hover:text-foreground transition-colors">Esports</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/esports/tournaments" className="hover:text-foreground transition-colors">Tournaments</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{tournament.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {tournament.games && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Gamepad2 className="h-3 w-3" />
                {tournament.games.name}
              </Badge>
            )}
            <Badge className={`text-xs ${status.className}`}>{status.label}</Badge>
            <Badge variant="outline" className="text-xs">
              {FORMAT_LABELS[tournament.format as TournamentFormat] ?? tournament.format}
            </Badge>
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-balance text-foreground md:text-4xl">{tournament.name}</h1>
          {tournament.description && (
            <p className="max-w-2xl text-muted-foreground">{tournament.description}</p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          {tournament.status === "in_progress" && (
            <>
              <Button asChild variant="destructive" className="gap-2">
                <Link href={`/esports/tournaments/${slug}/live`}>
                  <Radio className="h-4 w-4 animate-pulse" />
                  Watch Live
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/esports/tournaments/${slug}/cast`}>
                  <Mic className="h-4 w-4" />
                  Cast
                </Link>
              </Button>
            </>
          )}
          {user ? (
            <RegistrationButton
              tournamentId={tournament.id}
              isRegistered={isRegistered}
              isOpen={tournament.status === "registration"}
              isFull={isFull}
            />
          ) : (
            tournament.status === "registration" && (
              <Button asChild>
                <Link href="/auth/login">Sign in to Register</Link>
              </Button>
            )
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={Users} label="Participants" value={`${tournament.participants.length}${tournament.max_participants ? ` / ${tournament.max_participants}` : ""}`} />
        <InfoCard icon={DollarSign} label="Entry Fee" value={tournament.entry_fee_cents > 0 ? formatCents(tournament.entry_fee_cents) : "FREE"} />
        <InfoCard icon={Calendar} label="Start Date" value={tournament.start_date ? formatDate(tournament.start_date) : "TBD"} />
        <InfoCard icon={Trophy} label="Prize" value={tournament.prize_description || "TBD"} />
      </div>

      {/* Feature Matches Section */}
      {featureMatches.length > 0 && (
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">
              <Radio className="h-3 w-3 animate-pulse" />
              Feature Match{featureMatches.length > 1 ? "es" : ""}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {featureMatches.slice(0, 2).map((match: any) => (
              <FeatureMatchCard
                key={match.id}
                match={{
                  id: match.id,
                  player1: match.player1,
                  player2: match.player2,
                  player1Wins: match.player1_wins,
                  player2Wins: match.player2_wins,
                  draws: match.draws,
                  status: match.status,
                  tableNumber: match.table_number,
                  streamUrl: match.stream_url,
                  streamPlatform: match.stream_platform,
                  streamEmbedUrl: match.stream_embed_url,
                  roundNumber: match.roundNumber,
                  tournament: {
                    id: tournament.id,
                    name: tournament.name,
                    slug: tournament.slug,
                    gameName: tournament.games?.name,
                    gameSlug: tournament.games?.slug,
                  },
                }}
                showStream={true}
                size="large"
              />
            ))}
          </div>
        </div>
      )}

      {/* Sponsor Banners */}
      {tournament.sponsors && tournament.sponsors.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card/50 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sponsored by</span>
          {tournament.sponsors.map((ts: any) => (
            <a
              key={ts.id}
              href={ts.sponsors?.website_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              {ts.sponsors?.name}
            </a>
          ))}
        </div>
      )}

      {/* Tabbed Content */}
      <TournamentTabs
        tournament={tournament}
        matches={tournament.matches ?? []}
        participants={tournament.participants ?? []}
        standings={standings}
        currentRound={currentRound}
        allRounds={allRounds}
        currentUserId={user?.id}
        vods={vods}
      />
    </div>
  )
}

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}
