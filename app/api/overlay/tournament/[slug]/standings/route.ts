import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()

  // Get tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, name, status")
    .eq("slug", slug)
    .single()

  if (tournamentError || !tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 })
  }

  // Get current round
  const { data: phases } = await supabase
    .from("tournament_phases")
    .select("id")
    .eq("tournament_id", tournament.id)
    .eq("is_current", true)
    .single()

  let currentRound = 1
  if (phases) {
    const { data: rounds } = await supabase
      .from("tournament_rounds")
      .select("round_number")
      .eq("phase_id", phases.id)
      .order("round_number", { ascending: false })
      .limit(1)

    if (rounds && rounds.length > 0) {
      currentRound = rounds[0].round_number
    }
  }

  // Get standings
  const { data: standingsData } = await supabase
    .from("tournament_standings")
    .select(`
      rank,
      points,
      match_wins,
      match_losses,
      match_draws,
      game_wins,
      game_losses,
      opponent_win_percentage,
      profiles(id, first_name, last_name, avatar_url)
    `)
    .eq("tournament_id", tournament.id)
    .order("rank", { ascending: true })
    .limit(16)

  // Get player count
  const { count: totalPlayers } = await supabase
    .from("tournament_registrations")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournament.id)
    .eq("status", "confirmed")

  const standings = (standingsData || []).map((s) => {
    const profile = s.profiles as any
    return {
      rank: s.rank,
      player: {
        id: profile?.id || "",
        name: profile
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
          : "Unknown",
        avatar: profile?.avatar_url || null,
      },
      points: s.points || 0,
      matchWins: s.match_wins || 0,
      matchLosses: s.match_losses || 0,
      gameWins: s.game_wins || 0,
      gameLosses: s.game_losses || 0,
      opponentWinPercentage: s.opponent_win_percentage || 0,
    }
  })

  // Default overlay settings (could be stored in DB per tournament)
  const settings = {
    primaryColor: "#6366f1",
    accentColor: "#22c55e",
    backgroundOpacity: 0.85,
    showTop: 8,
  }

  return NextResponse.json({
    tournament: {
      name: tournament.name,
      currentRound,
      totalPlayers: totalPlayers || 0,
    },
    standings,
    settings,
  })
}
