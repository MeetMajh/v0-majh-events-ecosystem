"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ── Get Player's Registered Tournaments ──
export async function getMyTournaments() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("tournament_registrations")
    .select(`
      id,
      status,
      check_in_at,
      registration_type,
      registered_at,
      tournaments (
        id,
        name,
        slug,
        status,
        format,
        start_date,
        end_date,
        decklist_required,
        decklist_deadline,
        games (name, slug, icon_url)
      )
    `)
    .eq("player_id", user.id)
    .order("registered_at", { ascending: false })

  if (error) {
    console.error("[v0] getMyTournaments error:", error)
    return []
  }

  return data ?? []
}

// ── Get Player's Tournament Data (for Player Controller) ──
export async function getPlayerTournamentData(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Get tournament details
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select(`
      *,
      games (name, slug, icon_url),
      organizer:profiles!tournaments_organizer_id_fkey (first_name, last_name)
    `)
    .eq("id", tournamentId)
    .single()

  if (tournamentError || !tournament) {
    return { error: "Tournament not found" }
  }

  // Get player's registration
  const { data: registration } = await supabase
    .from("tournament_registrations")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .single()

  if (!registration) {
    return { error: "Not registered for this tournament" }
  }

  // Get current phase
  const { data: currentPhase } = await supabase
    .from("tournament_phases")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("is_current", true)
    .single()

  // Get current round
  const { data: currentRound } = await supabase
    .from("tournament_rounds")
    .select("*")
    .eq("tournament_id", tournamentId)
    .in("status", ["active", "pending"])
    .order("round_number", { ascending: false })
    .limit(1)
    .single()

  // Get player's current match (if any)
  let currentMatch = null
  if (currentRound) {
    const { data: match } = await supabase
      .from("tournament_matches")
      .select(`
        *,
        player1:profiles!tournament_matches_player1_id_fkey (id, first_name, last_name, avatar_url),
        player2:profiles!tournament_matches_player2_id_fkey (id, first_name, last_name, avatar_url)
      `)
      .eq("round_id", currentRound.id)
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .single()
    
    currentMatch = match
  }

  // Get player's all matches
  const { data: myMatches } = await supabase
    .from("tournament_matches")
    .select(`
      *,
      round:tournament_rounds (round_number, status),
      player1:profiles!tournament_matches_player1_id_fkey (id, first_name, last_name, avatar_url),
      player2:profiles!tournament_matches_player2_id_fkey (id, first_name, last_name, avatar_url)
    `)
    .eq("tournament_id", tournamentId)
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .order("created_at", { ascending: true })

  // Get player's decklist
  const { data: decklist } = await supabase
    .from("tournament_decklists")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .single()

  // Get standings
  const { data: standings } = await supabase
    .from("tournament_standings")
    .select(`
      *,
      player:profiles!tournament_standings_player_id_fkey (id, first_name, last_name, avatar_url)
    `)
    .eq("tournament_id", tournamentId)
    .order("rank", { ascending: true })
    .limit(50)

  // Get announcements
  const adminClient = createAdminClient()
  const { data: announcements } = await adminClient
    .from("tournament_announcements")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(20)

  // Get player's tickets
  const { data: myTickets } = await supabase
    .from("tournament_issues")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("reported_by", user.id)
    .order("created_at", { ascending: false })

  // Get all rounds with matches
  const { data: allRoundsData } = await adminClient
    .from("tournament_rounds")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("round_number", { ascending: true })

  let allRounds: any[] = []
  if (allRoundsData?.length) {
    const roundIds = allRoundsData.map(r => r.id)
    const { data: allMatches } = await adminClient
      .from("tournament_matches")
      .select("*")
      .in("round_id", roundIds)
      .order("table_number")

    // Get profiles for all matches
    const playerIds = new Set<string>()
    allMatches?.forEach(m => {
      if (m.player1_id) playerIds.add(m.player1_id)
      if (m.player2_id) playerIds.add(m.player2_id)
    })

    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", Array.from(playerIds))

    const profileMap = new Map(profiles?.map(p => [p.id, {
      id: p.id,
      display_name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
      avatar_url: p.avatar_url,
    }]) || [])

    allRounds = allRoundsData.map(round => ({
      ...round,
      matches: (allMatches ?? [])
        .filter(m => m.round_id === round.id)
        .map(m => ({
          ...m,
          player1: m.player1_id ? profileMap.get(m.player1_id) : null,
          player2: m.player2_id ? profileMap.get(m.player2_id) : null,
          isMyMatch: m.player1_id === user.id || m.player2_id === user.id,
        })),
    }))
  }

  return {
    tournament,
    registration,
    currentPhase,
    currentRound,
    currentMatch,
    myMatches: myMatches ?? [],
    decklist,
    standings: standings ?? [],
    announcements: announcements ?? [],
    myTickets: myTickets ?? [],
    allRounds,
    userId: user.id,
  }
}

// ── Check In to Tournament ──
export async function checkInToTournament(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Verify registered
  const { data: registration } = await supabase
    .from("tournament_registrations")
    .select("id, status")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .single()

  if (!registration) return { error: "Not registered for this tournament" }
  if (registration.status === "checked_in") return { error: "Already checked in" }

  // Check tournament allows check-in
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("status, check_in_open")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return { error: "Tournament not found" }
  if (!tournament.check_in_open && tournament.status !== "registration") {
    return { error: "Check-in is not currently open" }
  }

  // Update registration
  const { error } = await supabase
    .from("tournament_registrations")
    .update({
      status: "checked_in",
      check_in_at: new Date().toISOString(),
    })
    .eq("id", registration.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/my-events/${tournamentId}`)
  return { success: true }
}

// ── Drop from Tournament ──
export async function dropFromTournament(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: registration } = await supabase
    .from("tournament_registrations")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .single()

  if (!registration) return { error: "Not registered for this tournament" }

  const { error } = await supabase
    .from("tournament_registrations")
    .update({ status: "dropped" })
    .eq("id", registration.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/my-events/${tournamentId}`)
  revalidatePath("/dashboard/my-events")
  return { success: true }
}

// ── Submit Player Ticket ──
export async function submitPlayerTicket(
  tournamentId: string,
  data: {
    category: string
    severity: string
    title: string
    description: string
    affectedRound?: number
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Verify player is registered
  const { data: registration } = await supabase
    .from("tournament_registrations")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .single()

  if (!registration) return { error: "Not registered for this tournament" }

  const { error } = await supabase
    .from("tournament_issues")
    .insert({
      tournament_id: tournamentId,
      reported_by: user.id,
      category: data.category,
      severity: data.severity,
      title: data.title,
      description: data.description,
      affected_round: data.affectedRound || null,
      status: "open",
      escalation_level: 1,
    })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/my-events/${tournamentId}`)
  return { success: true }
}

// ── Get All Rounds for Player View ──
export async function getPlayerTournamentRounds(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const adminClient = createAdminClient()

  // Get all rounds
  const { data: rounds } = await adminClient
    .from("tournament_rounds")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("round_number", { ascending: true })

  if (!rounds?.length) return []

  // Get all matches for these rounds
  const roundIds = rounds.map(r => r.id)
  const { data: allMatches } = await adminClient
    .from("tournament_matches")
    .select("*")
    .in("round_id", roundIds)
    .order("table_number")

  // Get profiles
  const playerIds = new Set<string>()
  allMatches?.forEach(m => {
    if (m.player1_id) playerIds.add(m.player1_id)
    if (m.player2_id) playerIds.add(m.player2_id)
  })

  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", Array.from(playerIds))

  const profileMap = new Map(profiles?.map(p => [p.id, {
    id: p.id,
    display_name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
    avatar_url: p.avatar_url,
  }]) || [])

  // Group matches by round
  return rounds.map(round => ({
    ...round,
    matches: (allMatches ?? [])
      .filter(m => m.round_id === round.id)
      .map(m => ({
        ...m,
        player1: m.player1_id ? profileMap.get(m.player1_id) : null,
        player2: m.player2_id ? profileMap.get(m.player2_id) : null,
        isMyMatch: m.player1_id === user.id || m.player2_id === user.id,
      })),
  }))
}
