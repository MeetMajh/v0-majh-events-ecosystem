"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { generateBracket, type TournamentFormat } from "@/lib/bracket-utils"

async function requireStaffRole(allowed: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!data || !allowed.includes(data.role)) {
    redirect("/dashboard")
  }
  return { supabase, userId: user.id, role: data.role }
}

// ── Games ──

export async function getGames() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
  return data ?? []
}

export async function getGameBySlug(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("slug", slug)
    .single()
  return data
}

export async function createGame(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const name = formData.get("name") as string
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const category = formData.get("category") as string

  const { error } = await supabase.from("games").insert({ name, slug, category })
  if (error) return { error: error.message }

  revalidatePath("/esports")
  revalidatePath("/dashboard/admin/esports")
  return { success: true }
}

export async function updateGame(formData: FormData) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const id = formData.get("id") as string
  const { error } = await supabase.from("games").update({
    name: formData.get("name") as string,
    category: formData.get("category") as string,
    is_active: formData.get("is_active") === "on",
  }).eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/esports")
  return { success: true }
}

// ── Tournaments ──

export async function getTournaments(filters?: { gameId?: string; status?: string; limit?: number }) {
  const supabase = await createClient()
  let query = supabase
    .from("tournaments")
    .select("*, games(name, slug, category, icon_url), tournament_registrations(count)")
    .order("start_date", { ascending: false })

  if (filters?.gameId) query = query.eq("game_id", filters.gameId)
  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.limit) query = query.limit(filters.limit)

  const { data } = await query
  return data ?? []
}

export async function getTournamentBySlug(slug: string) {
  const supabase = await createClient()
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*, games(name, slug, category)")
    .eq("slug", slug)
    .single()

  if (!tournament) return null

  const [
    { data: participants },
    { data: matches },
    { data: sponsors },
  ] = await Promise.all([
    supabase
      .from("tournament_registrations")
      .select("*, profiles:player_id(id, first_name, last_name, avatar_url)")
      .eq("tournament_id", tournament.id)
      .in("status", ["registered", "checked_in"]),
    supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("round_number")
      .order("match_number"),
    supabase
      .from("tournament_sponsors")
      .select("*, sponsors(*)")
      .eq("tournament_id", tournament.id),
  ])
  
  // Map participants to include display_name from first_name/last_name
  const mappedParticipants = (participants ?? []).map((p: any) => ({
    ...p,
    user_id: p.player_id,
    profiles: p.profiles ? {
      ...p.profiles,
      display_name: `${p.profiles.first_name || ''} ${p.profiles.last_name || ''}`.trim() || 'Unknown Player'
    } : null
  }))

  return {
    ...tournament,
    participants: mappedParticipants,
    matches: matches ?? [],
    sponsors: sponsors ?? [],
  }
}

export async function createTournament(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "You must be logged in to create a tournament" }
  }
  
  // Check staff role or organizer permissions
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()
  
  const allowedRoles = ["owner", "manager", "organizer"]
  if (!staffRole || !allowedRoles.includes(staffRole.role)) {
    return { error: "You don't have permission to create tournaments. Required role: owner, manager, or organizer" }
  }
  
  const userId = user.id

  const name = formData.get("name") as string
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

  const tournament = {
    game_id: formData.get("game_id") as string,
    name,
    slug,
    description: formData.get("description") as string,
    format: formData.get("format") as string,
    entry_fee_cents: Math.round(parseFloat(formData.get("entry_fee") as string || "0") * 100),
    prize_description: formData.get("prize_description") as string,
    max_participants: parseInt(formData.get("max_participants") as string) || null,
    rules_text: formData.get("rules_text") as string,
    start_date: formData.get("start_date") as string || null,
    end_date: formData.get("end_date") as string || null,
    registration_deadline: formData.get("registration_deadline") as string || null,
    created_by: userId,
    status: "registration" as const,
  }

const { data: insertedTournament, error } = await supabase
    .from("tournaments")
    .insert(tournament)
    .select()
    .single()
    
if (error) {
    return { error: error.message }
  }
  
  // Create the default phase based on format
  const format = formData.get("format") as string
  if (insertedTournament && format) {
    
    const { error: phaseError } = await supabase
      .from("tournament_phases")
      .insert({
        tournament_id: insertedTournament.id,
        name: format === "swiss" ? "Swiss Rounds" : format === "single_elimination" ? "Bracket" : format === "double_elimination" ? "Double Elimination" : "Main Event",
        phase_type: format,
        phase_order: 1,
        is_current: true,
        is_complete: false,
      })
    
    }

  revalidatePath("/esports")
  revalidatePath("/dashboard/admin/esports")
  revalidatePath("/dashboard/tournaments")
  return { success: true, slug: insertedTournament.slug, id: insertedTournament.id }
}

export async function updateTournamentStatus(tournamentId: string, status: string) {
  const { supabase } = await requireStaffRole(["owner", "manager"])
  const { error } = await supabase.from("tournaments").update({ status }).eq("id", tournamentId)
  if (error) return { error: error.message }
  revalidatePath("/esports")
  return { success: true }
}

// ── Registration ──

export async function registerForTournament(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in" }

  // Check capacity
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("max_participants, status, entry_fee_cents, slug")
    .eq("id", tournamentId)
    .single()

  if (!tournament || tournament.status !== "registration") {
    return { error: "Registration is closed" }
  }

  // Check existing registration using tournament_registrations table
  const { data: existingReg } = await supabase
    .from("tournament_registrations")
    .select("id, status")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .single()

  if (existingReg) {
    return { error: "Already registered for this tournament" }
  }

  // Count current registrations
  const { count } = await supabase
    .from("tournament_registrations")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .in("status", ["registered", "checked_in", "pending"])

  if (tournament.max_participants && (count ?? 0) >= tournament.max_participants) {
    return { error: "Tournament is full" }
  }

  // If there's an entry fee, create pending registration and redirect to payment
  if (tournament.entry_fee_cents > 0) {
    const { data: registration, error } = await supabase
      .from("tournament_registrations")
      .insert({
        tournament_id: tournamentId,
        player_id: user.id,
        registration_type: "paid",
        payment_status: "pending",
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") return { error: "Already registered" }
      return { error: error.message }
    }

    revalidatePath("/esports")
    return { 
      success: true, 
      requiresPayment: true,
      registrationId: registration.id,
      tournamentSlug: tournament.slug
    }
  }

  // Free tournament - register directly
  const { error } = await supabase
    .from("tournament_registrations")
    .insert({
      tournament_id: tournamentId,
      player_id: user.id,
      registration_type: "free",
      payment_status: "free",
      status: "registered",
    })

  if (error) {
    if (error.code === "23505") return { error: "Already registered" }
    return { error: error.message }
  }

  revalidatePath("/esports")
  return { success: true }
}

export async function withdrawFromTournament(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in" }

  // Check if user has a paid registration that needs refund
  const { data: registration } = await supabase
    .from("tournament_registrations")
    .select("id, payment_status, status")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .single()

  if (!registration) {
    return { error: "Not registered for this tournament" }
  }

  if (registration.payment_status === "paid") {
    // Mark as dropped - refund must be processed separately
    await supabase
      .from("tournament_registrations")
      .update({ 
        status: "dropped",
        updated_at: new Date().toISOString()
      })
      .eq("id", registration.id)
  } else {
    // No payment, can delete registration
    await supabase
      .from("tournament_registrations")
      .delete()
      .eq("id", registration.id)
  }

  revalidatePath("/esports")
  return { success: true }
}

// ── Bracket Generation ──

export async function generateTournamentBracket(tournamentId: string) {
  const { supabase } = await requireStaffRole(["owner", "manager"])

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("format")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return { error: "Tournament not found" }

  const { data: participants } = await supabase
    .from("tournament_participants")
    .select("id")
    .eq("tournament_id", tournamentId)
    .order("seed_number", { nullsFirst: false })

  if (!participants || participants.length < 2) {
    return { error: "Need at least 2 participants" }
  }

  // Delete existing matches
  await supabase.from("matches").delete().eq("tournament_id", tournamentId)

  const bracketMatches = generateBracket(
    tournament.format as TournamentFormat,
    participants.map((p) => p.id)
  )

  // Insert matches (first pass without next_match references)
  const insertData = bracketMatches.map((m) => ({
    tournament_id: tournamentId,
    round_number: m.round_number,
    match_number: m.match_number,
    bracket_pool: m.bracket_pool,
    pool_number: m.pool_number,
    participant_1_id: m.participant_1_id || null,
    participant_2_id: m.participant_2_id || null,
    status: m.status,
  }))

  const { data: inserted, error } = await supabase
    .from("matches")
    .insert(insertData)
    .select("id")

  if (error || !inserted) return { error: error?.message || "Failed to create matches" }

  // Map temp IDs to real IDs and wire next_match references
  const idMap = new Map<number, string>()
  bracketMatches.forEach((m, i) => {
    if (m._temp_id && inserted[i]) {
      idMap.set(m._temp_id, inserted[i].id)
    }
  })

  // Update next_winner_match_id and next_loser_match_id
  for (const m of bracketMatches) {
    if (!m._temp_id) continue
    const realId = idMap.get(m._temp_id)
    if (!realId) continue

    const updates: Record<string, string | null> = {}
    if (m._next_winner_temp) {
      const nextWinnerId = idMap.get(m._next_winner_temp)
      if (nextWinnerId) updates.next_winner_match_id = nextWinnerId
    }
    if (m._next_loser_temp) {
      const nextLoserId = idMap.get(m._next_loser_temp)
      if (nextLoserId) updates.next_loser_match_id = nextLoserId
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("matches").update(updates).eq("id", realId)
    }
  }

  // Auto-advance BYE matches
  const { data: allMatches } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId)

  if (allMatches) {
    for (const match of allMatches) {
      const p1 = match.participant_1_id
      const p2 = match.participant_2_id
      if ((p1 && !p2) || (!p1 && p2)) {
        const winnerId = p1 || p2
        const loserId = null
        await supabase.from("matches").update({
          winner_id: winnerId,
          loser_id: loserId,
          status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", match.id)

        // Advance winner to next match
        if (match.next_winner_match_id && winnerId) {
          const { data: nextMatch } = await supabase
            .from("matches")
            .select("participant_1_id")
            .eq("id", match.next_winner_match_id)
            .single()

          await supabase.from("matches").update({
            [nextMatch?.participant_1_id ? "participant_2_id" : "participant_1_id"]: winnerId,
          }).eq("id", match.next_winner_match_id)
        }
      }
    }
  }

  // Update tournament status
  await supabase.from("tournaments").update({ status: "in_progress" }).eq("id", tournamentId)

  revalidatePath("/esports")
  return { success: true }
}

// ── Match Reporting ──

export async function reportMatchResult(matchId: string, winnerId: string, score1: string, score2: string) {
  const { supabase } = await requireStaffRole(["owner", "manager", "staff"])

  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }

  const loserId = match.participant_1_id === winnerId ? match.participant_2_id : match.participant_1_id

  // Update match
  await supabase.from("matches").update({
    winner_id: winnerId,
    loser_id: loserId,
    score_1: score1,
    score_2: score2,
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", matchId)

  // Advance winner
  if (match.next_winner_match_id) {
    const { data: nextMatch } = await supabase
      .from("matches")
      .select("participant_1_id")
      .eq("id", match.next_winner_match_id)
      .single()

    await supabase.from("matches").update({
      [nextMatch?.participant_1_id ? "participant_2_id" : "participant_1_id"]: winnerId,
    }).eq("id", match.next_winner_match_id)
  }

  // Drop loser to loser bracket match
  if (match.next_loser_match_id && loserId) {
    const { data: nextLoserMatch } = await supabase
      .from("matches")
      .select("participant_1_id")
      .eq("id", match.next_loser_match_id)
      .single()

    await supabase.from("matches").update({
      [nextLoserMatch?.participant_1_id ? "participant_2_id" : "participant_1_id"]: loserId,
    }).eq("id", match.next_loser_match_id)
  }

  // Update participant statuses
  if (loserId) {
    // Check if loser has another match coming
    const hasNext = match.next_loser_match_id
    if (!hasNext) {
      await supabase.from("tournament_participants").update({ status: "eliminated" }).eq("id", loserId)
    }
  }

  revalidatePath("/esports")
  return { success: true }
}

// ── Leaderboards ──

export async function getLeaderboard(gameSlug?: string, season?: string) {
  const supabase = await createClient()
  
  // Default to all-time if no season specified
  const seasonFilter = season || "all-time"

  if (gameSlug) {
    const { data: game } = await supabase.from("games").select("id").eq("slug", gameSlug).single()
    if (!game) return []

    const { data } = await supabase
      .from("leaderboard_entries")
      .select("*, profiles(id, first_name, last_name, avatar_url, username), games(name, slug)")
      .eq("game_id", game.id)
      .eq("season", seasonFilter)
      .order("ranking_points", { ascending: false })
      .limit(100)

    return data ?? []
  }

  // Global leaderboard: aggregate across games for the specified season
  const { data } = await supabase
    .from("leaderboard_entries")
    .select("*, profiles(id, first_name, last_name, avatar_url, username), games(name, slug)")
    .eq("season", seasonFilter)
    .order("ranking_points", { ascending: false })
    .limit(100)

  return data ?? []
}

// Get available seasons
export async function getSeasons() {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("leaderboard_entries")
    .select("season")
    .order("season", { ascending: false })
  
  // Get unique seasons
  const uniqueSeasons = [...new Set(data?.map(d => d.season) || [])]
  
  return uniqueSeasons.map(s => ({
    value: s,
    label: s === "all-time" ? "All Time" : formatSeasonLabel(s),
    isCurrent: s.includes(getCurrentSeasonId()),
  }))
}

// Helper to format season labels
function formatSeasonLabel(season: string): string {
  if (season === "all-time") return "All Time"
  // Format: "season-2024-Q1" -> "Q1 2024"
  const match = season.match(/season-(\d{4})-Q(\d)/)
  if (match) {
    return `Q${match[2]} ${match[1]}`
  }
  return season
}

// Get current season ID
function getCurrentSeasonId(): string {
  const now = new Date()
  const quarter = Math.ceil((now.getMonth() + 1) / 3)
  return `season-${now.getFullYear()}-Q${quarter}`
}

// ── Player Profile ──

export async function getPlayerProfile(userId: string) {
  const supabase = await createClient()

  const [
    { data: profile },
    { data: leaderboardEntries },
    { data: tournamentResults },
    { data: teamMemberships },
    { data: recentMatchesAsP1 },
    { data: recentMatchesAsP2 },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("leaderboard_entries").select("*, games(name, slug, category)").eq("user_id", userId).eq("season", "all-time"),
    supabase
      .from("tournament_results")
      .select("*, tournaments(name, slug, format, start_date, games(name))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("team_members")
      .select("*, teams(id, name, slug, tag, logo_url)")
      .eq("user_id", userId),
    // Get recent matches where this user is player1
    supabase
      .from("tournament_matches")
      .select(`
        id, player1_id, player2_id, winner_id, loser_id, 
        player1_wins, player2_wins, draws, status, created_at,
        tournament_rounds(round_number, tournament_phases(name)),
        tournaments(id, name, slug)
      `)
      .eq("player1_id", userId)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(15),
    // Get recent matches where this user is player2
    supabase
      .from("tournament_matches")
      .select(`
        id, player1_id, player2_id, winner_id, loser_id, 
        player1_wins, player2_wins, draws, status, created_at,
        tournament_rounds(round_number, tournament_phases(name)),
        tournaments(id, name, slug)
      `)
      .eq("player2_id", userId)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(15),
  ])

  if (!profile) return null

  // Combine and sort matches, then get opponent info
  const allMatches = [...(recentMatchesAsP1 || []), ...(recentMatchesAsP2 || [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
  
  // Get opponent IDs
  const opponentIds = allMatches.map(m => 
    m.player1_id === userId ? m.player2_id : m.player1_id
  ).filter(Boolean)
  
  // Fetch opponent profiles
  let opponentProfiles: Record<string, { first_name: string | null; last_name: string | null; avatar_url: string | null }> = {}
  if (opponentIds.length > 0) {
    const { data: opponents } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", opponentIds)
    
    opponents?.forEach(o => {
      opponentProfiles[o.id] = o
    })
  }
  
  // Format matches with opponent info
  const recentMatches = allMatches.map(match => {
    const isPlayer1 = match.player1_id === userId
    const opponentId = isPlayer1 ? match.player2_id : match.player1_id
    const opponent = opponentProfiles[opponentId]
    const opponentName = opponent 
      ? `${opponent.first_name || ""} ${opponent.last_name || ""}`.trim() || "Unknown"
      : "Unknown"
    
    const isWinner = match.winner_id === userId
    const isLoser = match.loser_id === userId
    const isDraw = !match.winner_id && !match.loser_id
    
    return {
      id: match.id,
      opponentId,
      opponentName,
      opponentAvatar: opponent?.avatar_url,
      result: isWinner ? "win" : isLoser ? "loss" : "draw",
      myWins: isPlayer1 ? match.player1_wins : match.player2_wins,
      opponentWins: isPlayer1 ? match.player2_wins : match.player1_wins,
      draws: match.draws,
      roundNumber: (match.tournament_rounds as any)?.round_number,
      phaseName: (match.tournament_rounds as any)?.tournament_phases?.name,
      tournament: match.tournaments,
      createdAt: match.created_at,
    }
  })

  const totalWins = leaderboardEntries?.reduce((sum, e) => sum + e.total_wins, 0) ?? 0
  const totalLosses = leaderboardEntries?.reduce((sum, e) => sum + e.total_losses, 0) ?? 0
  const totalDraws = leaderboardEntries?.reduce((sum, e) => sum + (e.total_draws ?? 0), 0) ?? 0
  const totalTournaments = leaderboardEntries?.reduce((sum, e) => sum + e.tournaments_played, 0) ?? 0
  const totalRankingPoints = leaderboardEntries?.reduce((sum, e) => sum + e.ranking_points, 0) ?? 0
  const bestPlacement = leaderboardEntries?.reduce((best, e) => 
    e.best_placement && (!best || e.best_placement < best) ? e.best_placement : best, 
    null as number | null
  )

  return {
    ...profile,
    leaderboardEntries: leaderboardEntries ?? [],
    tournamentResults: tournamentResults ?? [],
    recentMatches,
    teams: teamMemberships?.map((m) => ({ ...m.teams, memberRole: m.role })) ?? [],
    stats: { totalWins, totalLosses, totalDraws, totalTournaments, totalRankingPoints, bestPlacement },
  }
}

// ── Teams ──

export async function getTeams() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("teams")
    .select("*, team_members(count), profiles!teams_captain_id_fkey(first_name, last_name)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function getTeamBySlug(slug: string) {
  const supabase = await createClient()
  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("slug", slug)
    .single()

  if (!team) return null

  const { data: members } = await supabase
    .from("team_members")
    .select("*, profiles(id, first_name, last_name, avatar_url)")
    .eq("team_id", team.id)

  return { ...team, members: members ?? [] }
}

export async function createTeam(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in" }

  const name = formData.get("name") as string
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

  const { data: team, error } = await supabase.from("teams").insert({
    name,
    slug,
    tag: formData.get("tag") as string,
    description: formData.get("description") as string,
    captain_id: user.id,
  }).select().single()

  if (error) return { error: error.message }

  // Add captain as team member
  await supabase.from("team_members").insert({
    team_id: team.id,
    user_id: user.id,
    role: "captain",
  })

  revalidatePath("/esports/teams")
  return { success: true, slug }
}

export async function joinTeam(teamId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in" }

  const { error } = await supabase.from("team_members").insert({
    team_id: teamId,
    user_id: user.id,
    role: "member",
  })

  if (error) {
    if (error.code === "23505") return { error: "Already a member of this team" }
    return { error: error.message }
  }

  revalidatePath("/esports/teams")
  return { success: true }
}

export async function leaveTeam(teamId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in" }

  // Check if captain
  const { data: team } = await supabase.from("teams").select("captain_id").eq("id", teamId).single()
  if (team?.captain_id === user.id) {
    return { error: "Captain cannot leave. Transfer ownership first." }
  }

  await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", user.id)
  revalidatePath("/esports/teams")
  return { success: true }
}

export async function inviteTeamMember(teamId: string, email: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in" }

  // Verify captain
  const { data: team } = await supabase.from("teams").select("captain_id").eq("id", teamId).single()
  if (!team || team.captain_id !== user.id) {
    return { error: "Only the team captain can invite members" }
  }

  // Find user by email
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("id", `%`)
    .limit(1)

  // Use auth.admin if available, otherwise search profiles
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const targetUser = authUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  if (!targetUser) {
    return { error: "No user found with that email" }
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", targetUser.id)
    .single()

  if (existing) {
    return { error: "User is already a team member" }
  }

  // Add as member
  const { error } = await supabase.from("team_members").insert({
    team_id: teamId,
    user_id: targetUser.id,
    role: "member",
  })

  if (error) return { error: error.message }

  revalidatePath("/esports/teams")
  return { success: true }
}

export async function removeTeamMember(teamId: string, memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in" }

  // Verify captain
  const { data: team } = await supabase.from("teams").select("captain_id").eq("id", teamId).single()
  if (!team || team.captain_id !== user.id) {
    return { error: "Only the team captain can remove members" }
  }

  // Cannot remove captain
  if (memberId === team.captain_id) {
    return { error: "Cannot remove the team captain" }
  }

  await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", memberId)
  revalidatePath("/esports/teams")
  return { success: true }
}

export async function promoteTeamMember(teamId: string, memberId: string, role: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in" }

  // Verify captain
  const { data: team } = await supabase.from("teams").select("captain_id").eq("id", teamId).single()
  if (!team || team.captain_id !== user.id) {
    return { error: "Only the team captain can change roles" }
  }

  const validRoles = ["member", "officer"]
  if (!validRoles.includes(role)) {
    return { error: "Invalid role" }
  }

  await supabase.from("team_members").update({ role }).eq("team_id", teamId).eq("user_id", memberId)
  revalidatePath("/esports/teams")
  return { success: true }
}

// ── Social Links ──

export async function getSocialLinks() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("social_links")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
  return data ?? []
}
