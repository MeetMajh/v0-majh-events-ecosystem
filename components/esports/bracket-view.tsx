"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

type Participant = {
  id: string
  profiles: { id: string; display_name: string; avatar_url: string | null } | null
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
}

function getParticipantName(id: string | null, participants: Participant[]): string {
  if (!id) return "BYE"
  const p = participants.find((p) => p.id === id)
  return p?.profiles?.display_name ?? "TBD"
}

function MatchCard({
  match,
  participants,
}: {
  match: Match
  participants: Participant[]
}) {
  const p1Name = getParticipantName(match.participant_1_id, participants)
  const p2Name = getParticipantName(match.participant_2_id, participants)
  const isComplete = match.status === "completed"
  const isLive = match.status === "in_progress"

  return (
    <div className={cn(
      "w-52 rounded-lg border bg-card text-xs transition-colors",
      isLive ? "border-destructive/50 shadow-sm shadow-destructive/10" : "border-border",
      isComplete && "opacity-80"
    )}>
      {isLive && (
        <div className="flex items-center gap-1.5 border-b border-destructive/20 bg-destructive/5 px-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
          <span className="text-[10px] font-medium text-destructive">LIVE</span>
        </div>
      )}
      <div className={cn(
        "flex items-center justify-between px-2 py-1.5",
        match.winner_id === match.participant_1_id && isComplete && "bg-primary/5"
      )}>
        <span className={cn(
          "truncate font-medium",
          match.winner_id === match.participant_1_id ? "text-primary" : "text-foreground",
          !match.participant_1_id && "text-muted-foreground italic"
        )}>
          {p1Name}
        </span>
        {match.score_1 && (
          <span className={cn(
            "ml-2 font-bold",
            match.winner_id === match.participant_1_id ? "text-primary" : "text-muted-foreground"
          )}>
            {match.score_1}
          </span>
        )}
      </div>
      <div className="border-t border-border/50" />
      <div className={cn(
        "flex items-center justify-between px-2 py-1.5",
        match.winner_id === match.participant_2_id && isComplete && "bg-primary/5"
      )}>
        <span className={cn(
          "truncate font-medium",
          match.winner_id === match.participant_2_id ? "text-primary" : "text-foreground",
          !match.participant_2_id && "text-muted-foreground italic"
        )}>
          {p2Name}
        </span>
        {match.score_2 && (
          <span className={cn(
            "ml-2 font-bold",
            match.winner_id === match.participant_2_id ? "text-primary" : "text-muted-foreground"
          )}>
            {match.score_2}
          </span>
        )}
      </div>
    </div>
  )
}

function BracketRound({
  roundMatches,
  roundNumber,
  totalRounds,
  participants,
}: {
  roundMatches: Match[]
  roundNumber: number
  totalRounds: number
  participants: Participant[]
}) {
  const roundLabel = roundNumber === totalRounds
    ? "Final"
    : roundNumber === totalRounds - 1
      ? "Semifinal"
      : `Round ${roundNumber}`

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {roundLabel}
      </span>
      <div className="flex flex-col justify-around gap-4" style={{ minHeight: roundMatches.length > 1 ? `${roundMatches.length * 80}px` : "auto" }}>
        {roundMatches.map((match) => (
          <MatchCard key={match.id} match={match} participants={participants} />
        ))}
      </div>
    </div>
  )
}

const POOL_LABELS: Record<string, string> = {
  winners: "Winners Bracket",
  losers: "Losers Bracket",
  grand_final: "Grand Final",
  third_chance: "Third Chance",
  consolation: "Consolation Bracket",
  north: "North",
  east: "East",
  south: "South",
  west: "West",
  pool_play: "Pool Play",
  playoff: "Playoffs",
  round_robin: "Round Robin",
}

export function BracketView({
  tournamentId,
  matches: initialMatches,
  participants,
  format,
}: {
  tournamentId: string
  matches: Match[]
  participants: Participant[]
  format: string
}) {
  const [matches, setMatches] = useState(initialMatches)

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
            if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next }
            return [...prev, updated]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournamentId])

  const pools = [...new Set(matches.map((m) => m.bracket_pool ?? "winners"))]
  const [activePool, setActivePool] = useState(pools[0])

  if (matches.length === 0) {
    // Show appropriate message based on format
    if (format === "swiss") {
      return (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Swiss tournaments use round-by-round pairings instead of a bracket.</p>
          <p className="text-sm text-muted-foreground mt-2">Check the Pairings tab to see current round matchups.</p>
        </div>
      )
    }
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">Bracket not yet generated. Check back when the tournament starts.</p>
      </div>
    )
  }

  // Round robin: show results table instead of bracket tree
  if (format === "round_robin") {
    return <RoundRobinView matches={matches} participants={participants} />
  }

  const poolMatches = matches.filter((m) => (m.bracket_pool ?? "winners") === activePool)
  const rounds = [...new Set(poolMatches.map((m) => m.round_number))].sort((a, b) => a - b)
  const totalRounds = rounds.length

  return (
    <div>
      {pools.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pools.map((pool) => (
            <button
              key={pool}
              onClick={() => setActivePool(pool)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activePool === pool
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/30"
              )}
            >
              {POOL_LABELS[pool] ?? pool}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-8 p-4" style={{ minWidth: `${rounds.length * 240}px` }}>
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
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Round Robin View ──

function RoundRobinView({ matches, participants }: { matches: Match[]; participants: Participant[] }) {
  // Build standings from matches
  const standings = new Map<string, { wins: number; losses: number; draws: number; points: number }>()

  for (const p of participants) {
    standings.set(p.id, { wins: 0, losses: 0, draws: 0, points: 0 })
  }

  for (const match of matches) {
    if (match.status !== "completed" || !match.winner_id) continue
    const winner = standings.get(match.winner_id)
    if (winner) {
      winner.wins++
      winner.points += 3
    }
    const loserId = match.participant_1_id === match.winner_id ? match.participant_2_id : match.participant_1_id
    if (loserId) {
      const loser = standings.get(loserId)
      if (loser) loser.losses++
    }
  }

  const sorted = [...standings.entries()]
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">#</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Player</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">W</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">L</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, idx) => (
            <tr key={entry.id} className="border-b border-border/50">
              <td className="px-4 py-2 text-sm font-medium text-muted-foreground">{idx + 1}</td>
              <td className="px-4 py-2 text-sm font-medium text-foreground">
                {getParticipantName(entry.id, participants)}
              </td>
              <td className="px-4 py-2 text-center text-sm font-medium text-chart-3">{entry.wins}</td>
              <td className="px-4 py-2 text-center text-sm text-destructive">{entry.losses}</td>
              <td className="px-4 py-2 text-right text-sm font-bold text-primary">{entry.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
