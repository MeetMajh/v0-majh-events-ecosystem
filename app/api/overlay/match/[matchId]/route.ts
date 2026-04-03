import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params
  const supabase = await createClient()

  // Get match with all related data
  const { data: match, error } = await supabase
    .from("tournament_matches")
    .select(`
      id, status, table_number, is_live, is_bye,
      player1_id, player2_id, winner_id, loser_id,
      player1_wins, player2_wins, draws,
      timer_started_at, timer_duration_seconds,
      tournament_rounds(
        round_number, status,
        tournament_phases(
          tournaments(id, name, slug)
        )
      )
    `)
    .eq("id", matchId)
    .single()

  if (error || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 })
  }

  // Get player profiles
  const playerIds = [match.player1_id, match.player2_id].filter(Boolean)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", playerIds)

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

  // Get player tournament stats (wins/losses in this tournament)
  const tournamentId = (match.tournament_rounds as any)?.tournament_phases?.tournaments?.id
  let player1Stats = { wins: 0, losses: 0, draws: 0 }
  let player2Stats = { wins: 0, losses: 0, draws: 0 }

  if (tournamentId) {
    // Get all confirmed matches for these players in this tournament
    const { data: playerMatches } = await supabase
      .from("tournament_matches")
      .select(`
        player1_id, player2_id, winner_id, status,
        tournament_rounds!inner(
          tournament_phases!inner(tournament_id)
        )
      `)
      .eq("tournament_rounds.tournament_phases.tournament_id", tournamentId)
      .eq("status", "confirmed")
      .or(`player1_id.eq.${match.player1_id},player2_id.eq.${match.player1_id},player1_id.eq.${match.player2_id},player2_id.eq.${match.player2_id}`)

    playerMatches?.forEach((m) => {
      if (m.player1_id === match.player1_id || m.player2_id === match.player1_id) {
        if (m.winner_id === match.player1_id) player1Stats.wins++
        else if (m.winner_id && m.winner_id !== match.player1_id) player1Stats.losses++
        else player1Stats.draws++
      }
      if (m.player1_id === match.player2_id || m.player2_id === match.player2_id) {
        if (m.winner_id === match.player2_id) player2Stats.wins++
        else if (m.winner_id && m.winner_id !== match.player2_id) player2Stats.losses++
        else player2Stats.draws++
      }
    })
  }

  // Get overlay config
  const { data: overlayConfig } = await supabase
    .from("match_overlays")
    .select("*")
    .eq("match_id", matchId)
    .single()

  const p1Profile = profileMap.get(match.player1_id!)
  const p2Profile = profileMap.get(match.player2_id!)

  // Calculate timer
  let timerRemaining = match.timer_duration_seconds || 3000
  if (match.timer_started_at) {
    const elapsed = Math.floor((Date.now() - new Date(match.timer_started_at).getTime()) / 1000)
    timerRemaining = Math.max(0, (match.timer_duration_seconds || 3000) - elapsed)
  }

  const response = {
    match: {
      id: match.id,
      status: match.status,
      tableNumber: match.table_number,
      isLive: match.is_live,
      isBye: match.is_bye,
    },
    round: {
      number: (match.tournament_rounds as any)?.round_number,
      status: (match.tournament_rounds as any)?.status,
    },
    tournament: {
      id: tournamentId,
      name: (match.tournament_rounds as any)?.tournament_phases?.tournaments?.name,
      slug: (match.tournament_rounds as any)?.tournament_phases?.tournaments?.slug,
    },
    players: [
      {
        id: match.player1_id,
        name: p1Profile ? `${p1Profile.first_name || ""} ${p1Profile.last_name || ""}`.trim() || "Player 1" : "Player 1",
        avatar: p1Profile?.avatar_url,
        gameWins: match.player1_wins ?? 0,
        record: player1Stats,
      },
      {
        id: match.player2_id,
        name: p2Profile ? `${p2Profile.first_name || ""} ${p2Profile.last_name || ""}`.trim() || "Player 2" : "Player 2",
        avatar: p2Profile?.avatar_url,
        gameWins: match.player2_wins ?? 0,
        record: player2Stats,
      },
    ],
    timer: {
      remaining: timerRemaining,
      total: match.timer_duration_seconds || 3000,
      isRunning: !!match.timer_started_at && timerRemaining > 0,
      startedAt: match.timer_started_at,
    },
    overlay: overlayConfig
      ? {
          theme: overlayConfig.theme,
          layout: overlayConfig.layout,
          showTimer: overlayConfig.show_timer,
          showRound: overlayConfig.show_round,
          showRecords: overlayConfig.show_records,
          showAvatars: overlayConfig.show_avatars,
          showTournamentName: overlayConfig.show_tournament_name,
          primaryColor: overlayConfig.primary_color,
          accentColor: overlayConfig.accent_color,
          backgroundOpacity: overlayConfig.background_opacity,
        }
      : {
          theme: "default",
          layout: "standard",
          showTimer: true,
          showRound: true,
          showRecords: true,
          showAvatars: true,
          showTournamentName: true,
          primaryColor: "#6366f1",
          accentColor: "#22c55e",
          backgroundOpacity: 0.85,
        },
  }

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
