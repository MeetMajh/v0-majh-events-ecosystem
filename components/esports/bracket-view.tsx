"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Trophy,
  Swords,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Radio,
} from "lucide-react"

type Participant = {
  id: string
  profiles: { id: string; display_name: string; avatar_url: string | null } | null
  seed?: number
}

type Match = {
  id: string
  round_number: number
  match_number: number
  bracket_pool: string | null
  pool_number: number | null
  participant_1_id: string | null
  participant_2_id: string | null
  winner_id: string | null
  score_1: string | null
  score_2: string | null
  status: string
  is_feature_match?: boolean
  scheduled_time?: string
}

function getParticipantName(id: string | null, participants: Participant[]): string {
  if (!id) return "BYE"
  const p = participants.find((p) => p.id === id)
  return p?.profiles?.display_name ?? "TBD"
}

function getParticipant(id: string | null, participants: Participant[]): Participant | null {
  if (!id) return null
  return participants.find((p) => p.id === id) ?? null
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
}

// ══════════════════════════════════════════════════════════════════════════════
// Enhanced Match Card
// ══════════════════════════════════════════════════════════════════════════════

function EnhancedMatchCard({
  match,
  participants,
  onMatchClick,
  isSelected,
  showConnectors,
}: {
  match: Match
  participants: Participant[]
  onMatchClick?: (match: Match) => void
  isSelected?: boolean
  showConnectors?: boolean
}) {
  const p1 = getParticipant(match.participant_1_id, participants)
  const p2 = getParticipant(match.participant_2_id, participants)
  const p1Name = getParticipantName(match.participant_1_id, participants)
  const p2Name = getParticipantName(match.participant_2_id, participants)
  const isComplete = match.status === "completed"
  const isLive = match.status === "in_progress"
  const isPending = match.status === "pending"
  const isBye = !match.participant_1_id || !match.participant_2_id

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onMatchClick?.(match)}
            className={cn(
              "w-56 rounded-lg border bg-card text-xs transition-all duration-200",
              "hover:shadow-md hover:border-primary/30",
              isLive && "border-destructive/50 shadow-sm shadow-destructive/10 animate-pulse-subtle",
              isSelected && "ring-2 ring-primary border-primary",
              isComplete && "opacity-90",
              isBye && "opacity-60"
            )}
          >
            {/* Match Header */}
            <div className="flex items-center justify-between border-b border-border/50 px-2 py-1">
              <span className="text-[10px] font-medium text-muted-foreground">
                Match {match.match_number}
              </span>
              <div className="flex items-center gap-1">
                {match.is_feature_match && (
                  <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                    <Eye className="mr-0.5 h-2.5 w-2.5" />
                    Featured
                  </Badge>
                )}
                {isLive && (
                  <Badge variant="destructive" className="h-4 px-1 text-[9px] animate-pulse">
                    <Radio className="mr-0.5 h-2.5 w-2.5" />
                    LIVE
                  </Badge>
                )}
                {isPending && match.scheduled_time && (
                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(match.scheduled_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </div>

            {/* Player 1 */}
            <div
              className={cn(
                "flex items-center justify-between gap-2 px-2 py-1.5 transition-colors",
                match.winner_id === match.participant_1_id && isComplete && "bg-chart-3/10"
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {p1?.seed && (
                  <span className="text-[10px] font-bold text-muted-foreground w-4">
                    {p1.seed}
                  </span>
                )}
                <Avatar className="h-5 w-5">
                  <AvatarImage src={p1?.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px]">
                    {getInitials(p1Name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "truncate font-medium",
                    match.winner_id === match.participant_1_id ? "text-chart-3" : "text-foreground",
                    !match.participant_1_id && "text-muted-foreground italic"
                  )}
                >
                  {p1Name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {match.score_1 && (
                  <span
                    className={cn(
                      "font-bold tabular-nums",
                      match.winner_id === match.participant_1_id ? "text-chart-3" : "text-muted-foreground"
                    )}
                  >
                    {match.score_1}
                  </span>
                )}
                {match.winner_id === match.participant_1_id && isComplete && (
                  <Trophy className="h-3 w-3 text-chart-3" />
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border/50 mx-2" />

            {/* Player 2 */}
            <div
              className={cn(
                "flex items-center justify-between gap-2 px-2 py-1.5 transition-colors",
                match.winner_id === match.participant_2_id && isComplete && "bg-chart-3/10"
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {p2?.seed && (
                  <span className="text-[10px] font-bold text-muted-foreground w-4">
                    {p2.seed}
                  </span>
                )}
                <Avatar className="h-5 w-5">
                  <AvatarImage src={p2?.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px]">
                    {getInitials(p2Name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "truncate font-medium",
                    match.winner_id === match.participant_2_id ? "text-chart-3" : "text-foreground",
                    !match.participant_2_id && "text-muted-foreground italic"
                  )}
                >
                  {p2Name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {match.score_2 && (
                  <span
                    className={cn(
                      "font-bold tabular-nums",
                      match.winner_id === match.participant_2_id ? "text-chart-3" : "text-muted-foreground"
                    )}
                  >
                    {match.score_2}
                  </span>
                )}
                {match.winner_id === match.participant_2_id && isComplete && (
                  <Trophy className="h-3 w-3 text-chart-3" />
                )}
              </div>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{p1Name} vs {p2Name}</p>
            <p className="text-xs text-muted-foreground">
              Round {match.round_number}, Match {match.match_number}
            </p>
            {isComplete && (
              <p className="text-xs">
                Winner: <span className="font-medium text-chart-3">
                  {getParticipantName(match.winner_id, participants)}
                </span>
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Bracket Round Column
// ══════════════════════════════════════════════════════════════════════════════

function BracketRound({
  roundMatches,
  roundNumber,
  totalRounds,
  participants,
  onMatchClick,
  selectedMatchId,
}: {
  roundMatches: Match[]
  roundNumber: number
  totalRounds: number
  participants: Participant[]
  onMatchClick?: (match: Match) => void
  selectedMatchId?: string
}) {
  const roundLabel = useMemo(() => {
    if (roundNumber === totalRounds) return "Final"
    if (roundNumber === totalRounds - 1) return "Semifinal"
    if (roundNumber === totalRounds - 2 && totalRounds > 3) return "Quarterfinal"
    return `Round ${roundNumber}`
  }, [roundNumber, totalRounds])

  // Calculate spacing to align matches with previous round
  const spacing = Math.pow(2, roundNumber - 1) * 6 // rem

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 px-3 py-1 rounded-full bg-muted/50">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {roundLabel}
        </span>
      </div>
      <div
        className="flex flex-col justify-around"
        style={{ gap: `${spacing}rem`, minHeight: `${roundMatches.length * 5 + (roundMatches.length - 1) * spacing}rem` }}
      >
        {roundMatches.map((match) => (
          <div key={match.id} className="relative">
            <EnhancedMatchCard
              match={match}
              participants={participants}
              onMatchClick={onMatchClick}
              isSelected={selectedMatchId === match.id}
            />
            {/* Connector lines would go here for SVG implementation */}
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Pool/Bracket Labels
// ══════════════════════════════════════════════════════════════════════════════

const POOL_LABELS: Record<string, { label: string; color: string }> = {
  winners: { label: "Winners Bracket", color: "bg-chart-3/20 text-chart-3" },
  losers: { label: "Losers Bracket", color: "bg-destructive/20 text-destructive" },
  grand_final: { label: "Grand Final", color: "bg-primary/20 text-primary" },
  third_chance: { label: "Third Chance", color: "bg-chart-4/20 text-chart-4" },
  consolation: { label: "Consolation", color: "bg-muted text-muted-foreground" },
  north: { label: "North Region", color: "bg-blue-500/20 text-blue-600" },
  east: { label: "East Region", color: "bg-green-500/20 text-green-600" },
  south: { label: "South Region", color: "bg-orange-500/20 text-orange-600" },
  west: { label: "West Region", color: "bg-purple-500/20 text-purple-600" },
  pool_play: { label: "Pool Play", color: "bg-muted text-muted-foreground" },
  playoff: { label: "Playoffs", color: "bg-primary/20 text-primary" },
  round_robin: { label: "Round Robin", color: "bg-chart-2/20 text-chart-2" },
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Bracket View
// ══════════════════════════════════════════════════════════════════════════════

export function BracketView({
  tournamentId,
  matches: initialMatches,
  participants,
  format,
  isOrganizer = false,
}: {
  tournamentId: string
  matches: Match[]
  participants: Participant[]
  format: string
  isOrganizer?: boolean
}) {
  const [matches, setMatches] = useState(initialMatches)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)

  // Supabase Realtime subscription for live bracket updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`bracket-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          setMatches((prev) => {
            const updated = payload.new as Match
            const idx = prev.findIndex((m) => m.id === updated.id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = updated
              return next
            }
            return [...prev, updated]
          })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId])

  const pools = useMemo(
    () => [...new Set(matches.map((m) => m.bracket_pool ?? "winners"))],
    [matches]
  )
  const [activePool, setActivePool] = useState(pools[0])

  // Zoom controls
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.1, 1.5)), [])
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.1, 0.5)), [])
  const handleResetZoom = useCallback(() => setZoom(1), [])

  if (matches.length === 0) {
    if (format === "swiss") {
      return (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Swords className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Swiss tournaments use round-by-round pairings instead of a bracket.</p>
          <p className="mt-2 text-sm text-muted-foreground">Check the Pairings tab to see current round matchups.</p>
        </div>
      )
    }
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <Trophy className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">Bracket not yet generated.</p>
        <p className="mt-2 text-sm text-muted-foreground">Check back when the tournament starts.</p>
      </div>
    )
  }

  // Round robin: show results table
  if (format === "round_robin") {
    return <RoundRobinView matches={matches} participants={participants} />
  }

  const poolMatches = matches.filter((m) => (m.bracket_pool ?? "winners") === activePool)
  const rounds = [...new Set(poolMatches.map((m) => m.round_number))].sort((a, b) => a - b)
  const totalRounds = rounds.length

  // Stats
  const completedMatches = matches.filter((m) => m.status === "completed").length
  const liveMatches = matches.filter((m) => m.status === "in_progress").length
  const progress = Math.round((completedMatches / matches.length) * 100)

  return (
    <div className="space-y-4">
      {/* Bracket Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Pool tabs */}
        {pools.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {pools.map((pool) => {
              const config = POOL_LABELS[pool] ?? { label: pool, color: "bg-muted text-muted-foreground" }
              return (
                <button
                  key={pool}
                  onClick={() => setActivePool(pool)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    activePool === pool
                      ? cn("border-transparent", config.color)
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {config.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Stats and controls */}
        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="flex items-center gap-2 text-xs">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-muted-foreground">{progress}% complete</span>
          </div>

          {liveMatches > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              <Radio className="mr-1 h-3 w-3" />
              {liveMatches} live
            </Badge>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <button
              className="px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleResetZoom}
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleZoomIn}
              disabled={zoom >= 1.5}
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bracket Container */}
      <div className="relative overflow-x-auto rounded-xl border bg-muted/10 pb-4">
        <div
          className="flex gap-8 p-6 transition-transform duration-200"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            minWidth: `${rounds.length * 280}px`,
          }}
        >
          {rounds.map((round) => {
            const roundMatches = poolMatches
              .filter((m) => m.round_number === round)
              .sort((a, b) => a.match_number - b.match_number)
            return (
              <BracketRound
                key={round}
                roundMatches={roundMatches}
                roundNumber={round}
                totalRounds={totalRounds}
                participants={participants}
                onMatchClick={setSelectedMatch}
                selectedMatchId={selectedMatch?.id}
              />
            )
          })}

          {/* Champion display */}
          {activePool !== "losers" && activePool !== "consolation" && (
            <div className="flex flex-col items-center justify-center pl-4">
              <div className="mb-2 rounded-full bg-primary/20 p-4">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Champion
              </span>
              {(() => {
                const finalMatch = poolMatches.find(
                  (m) => m.round_number === totalRounds && m.status === "completed"
                )
                if (finalMatch?.winner_id) {
                  const winner = getParticipant(finalMatch.winner_id, participants)
                  return (
                    <div className="mt-2 flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={winner?.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(getParticipantName(finalMatch.winner_id, participants))}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-chart-3">
                        {getParticipantName(finalMatch.winner_id, participants)}
                      </span>
                    </div>
                  )
                }
                return <span className="mt-2 text-sm text-muted-foreground">TBD</span>
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Match details panel */}
      {selectedMatch && (
        <MatchDetailsPanel
          match={selectedMatch}
          participants={participants}
          onClose={() => setSelectedMatch(null)}
          isOrganizer={isOrganizer}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Match Details Panel
// ══════════════════════════════════════════════════════════════════════════════

function MatchDetailsPanel({
  match,
  participants,
  onClose,
  isOrganizer,
}: {
  match: Match
  participants: Participant[]
  onClose: () => void
  isOrganizer: boolean
}) {
  const p1 = getParticipant(match.participant_1_id, participants)
  const p2 = getParticipant(match.participant_2_id, participants)

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Match Details</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Player 1 */}
        <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={p1?.profiles?.avatar_url || undefined} />
            <AvatarFallback>{getInitials(getParticipantName(match.participant_1_id, participants))}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{getParticipantName(match.participant_1_id, participants)}</span>
          {match.score_1 && (
            <span className={cn("text-2xl font-bold", match.winner_id === match.participant_1_id && "text-chart-3")}>
              {match.score_1}
            </span>
          )}
          {match.winner_id === match.participant_1_id && (
            <Badge className="bg-chart-3 text-white">Winner</Badge>
          )}
        </div>

        {/* VS */}
        <div className="flex flex-col items-center justify-center gap-2">
          <span className="text-2xl font-bold text-muted-foreground">VS</span>
          <Badge variant="outline">Round {match.round_number}</Badge>
          <Badge variant={match.status === "in_progress" ? "destructive" : "secondary"}>
            {match.status === "completed" ? "Completed" : match.status === "in_progress" ? "In Progress" : "Pending"}
          </Badge>
        </div>

        {/* Player 2 */}
        <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={p2?.profiles?.avatar_url || undefined} />
            <AvatarFallback>{getInitials(getParticipantName(match.participant_2_id, participants))}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{getParticipantName(match.participant_2_id, participants)}</span>
          {match.score_2 && (
            <span className={cn("text-2xl font-bold", match.winner_id === match.participant_2_id && "text-chart-3")}>
              {match.score_2}
            </span>
          )}
          {match.winner_id === match.participant_2_id && (
            <Badge className="bg-chart-3 text-white">Winner</Badge>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Round Robin View
// ══════════════════════════════════════════════════════════════════════════════

function RoundRobinView({ matches, participants }: { matches: Match[]; participants: Participant[] }) {
  // Build standings from matches
  const standings = new Map<string, { wins: number; losses: number; draws: number; points: number; matchesPlayed: number }>()

  for (const p of participants) {
    standings.set(p.id, { wins: 0, losses: 0, draws: 0, points: 0, matchesPlayed: 0 })
  }

  for (const match of matches) {
    if (match.status !== "completed" || !match.winner_id) continue
    const winner = standings.get(match.winner_id)
    if (winner) {
      winner.wins++
      winner.points += 3
      winner.matchesPlayed++
    }
    const loserId = match.participant_1_id === match.winner_id ? match.participant_2_id : match.participant_1_id
    if (loserId) {
      const loser = standings.get(loserId)
      if (loser) {
        loser.losses++
        loser.matchesPlayed++
      }
    }
  }

  const sorted = [...standings.entries()]
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)

  const totalMatches = matches.length
  const completedMatches = matches.filter((m) => m.status === "completed").length
  const progress = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {completedMatches}/{totalMatches} matches ({progress}%)
        </span>
      </div>

      {/* Standings Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Player</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">MP</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">W</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">L</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Pts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, idx) => {
              const participant = participants.find((p) => p.id === entry.id)
              return (
                <tr
                  key={entry.id}
                  className={cn(
                    "border-b border-border/50 transition-colors hover:bg-muted/20",
                    idx === 0 && "bg-chart-3/5"
                  )}
                >
                  <td className="px-4 py-3 text-sm font-medium text-muted-foreground">
                    {idx === 0 ? (
                      <Trophy className="h-4 w-4 text-chart-3" />
                    ) : (
                      idx + 1
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={participant?.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(getParticipantName(entry.id, participants))}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground">
                        {getParticipantName(entry.id, participants)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-muted-foreground">{entry.matchesPlayed}</td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-chart-3">{entry.wins}</td>
                  <td className="px-4 py-3 text-center text-sm text-destructive">{entry.losses}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-primary">{entry.points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
