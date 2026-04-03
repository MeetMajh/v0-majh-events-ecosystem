"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { generateSwissPairings, calculateSwissRounds, type PairingPlayer } from "@/lib/pairing-algorithms"

// ── Types ──

export type PhaseType = "swiss" | "single_elimination" | "double_elimination" | "round_robin"
export type TournamentStatus = "draft" | "published" | "registration_closed" | "in_progress" | "complete" | "cancelled"
export type MatchStatus = "pending" | "in_progress" | "player1_reported" | "player2_reported" | "confirmed" | "disputed"
export type RoundStatus = "pending" | "active" | "paused" | "complete"

export interface PlayerStanding {
  playerId: string
  displayName: string
  avatarUrl: string | null
  matchWins: number
  matchLosses: number
  matchDraws: number
  gameWins: number
  gameLosses: number
  gameDraws: number
  points: number
  omwPercent: number
  gwPercent: number
  ogwPercent: number
  standing: number
  isDropped: boolean
  opponents: string[]
}

// ── Auth Helpers ──

async function requireTournamentOrganizer(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Check if staff with organizer permissions
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  const isStaff = staffRole && ["owner", "manager", "organizer"].includes(staffRole.role)

  // Check if tournament creator
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("created_by")
    .eq("id", tournamentId)
    .single()

  const isCreator = tournament?.created_by === user.id

  if (!isStaff && !isCreator) {
    return { error: "Not authorized to manage this tournament" }
  }

  return { supabase, userId: user.id, role: staffRole?.role }
}

// ── Tournament Phase Management ──

export async function createTournamentPhase(
  tournamentId: string,
  data: {
    name: string
    phaseType: PhaseType
    phaseOrder: number
    bestOf?: number
    winPoints?: number
    drawPoints?: number
    lossPoints?: number
    roundsCount?: number
    advancementCount?: number
  }
) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase } = auth

  const { data: phase, error } = await supabase
    .from("tournament_phases")
    .insert({
      tournament_id: tournamentId,
      name: data.name,
      phase_type: data.phaseType,
      phase_order: data.phaseOrder,
      best_of: data.bestOf ?? 1,
      win_points: data.winPoints ?? 3,
      draw_points: data.drawPoints ?? 1,
      loss_points: data.lossPoints ?? 0,
      rounds_count: data.roundsCount,
      advancement_count: data.advancementCount,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true, phase }
}

export async function getTournamentPhases(tournamentId: string) {
  try {
    const supabase = createAdminClient()
    
    const { data: phases, error } = await supabase
      .from("tournament_phases")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("phase_order", { ascending: true })
    
    if (error) {
      console.error("[v0] getTournamentPhases error:", error)
      return []
    }
    
    return phases ?? []
  } catch (err) {
    console.error("[v0] getTournamentPhases exception:", err)
    return []
  }
}

export async function createSwissRound(tournamentId: string, phaseId: string) {
  try {
    const auth = await requireTournamentOrganizer(tournamentId)
    if ("error" in auth) return auth
    const { supabase, userId } = auth

    // Get phase settings
    const { data: phase, error: phaseError } = await supabase
      .from("tournament_phases")
      .select("*")
      .eq("id", phaseId)
      .single()

    if (phaseError) {
      console.error("[v0] createSwissRound phase error:", phaseError)
      return { error: `Phase error: ${phaseError.message}` }
    }
    if (!phase) return { error: "Phase not found" }

    // Get current round number
    const { data: existingRounds } = await supabase
      .from("tournament_rounds")
      .select("round_number")
      .eq("phase_id", phaseId)
      .order("round_number", { ascending: false })
      .limit(1)

    const roundNumber = (existingRounds?.[0]?.round_number ?? 0) + 1

    // Get all registered players from tournament_participants (not dropped)
    const { data: participants } = await supabase
      .from("tournament_participants")
      .select("user_id")
      .eq("tournament_id", tournamentId)
      .in("status", ["registered", "checked_in"])

    if (!participants || participants.length < 2) {
      return { error: "Need at least 2 active players" }
    }

    // Map participants to registrations format for compatibility
    const registrations = participants.map(p => ({ player_id: p.user_id }))

    // Get player stats for pairing
    const { data: stats } = await supabase
      .from("tournament_player_stats")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("phase_id", phaseId)

    // Get previous matches to track opponents
    const { data: previousMatches } = await supabase
      .from("tournament_matches")
      .select("player1_id, player2_id")
      .eq("tournament_id", tournamentId)
      .not("player1_id", "is", null)
      .not("player2_id", "is", null)

    // Build player data for Swiss pairing
    const playerMap = new Map<string, PairingPlayer>()
    for (const reg of registrations) {
      const playerStats = stats?.find(s => s.player_id === reg.player_id)
      const opponents: string[] = []
      
      // Find all previous opponents
      for (const match of previousMatches ?? []) {
        if (match.player1_id === reg.player_id && match.player2_id) {
          opponents.push(match.player2_id)
        } else if (match.player2_id === reg.player_id && match.player1_id) {
          opponents.push(match.player1_id)
        }
      }

      playerMap.set(reg.player_id, {
        id: reg.player_id,
        points: playerStats?.points ?? 0,
        opponents,
        hasHadBye: (playerStats?.byes ?? 0) > 0,
      })
    }

    const players = Array.from(playerMap.values())
    const pairings = generateSwissPairings(players)

    // Create round
    const { data: round, error: roundError } = await supabase
      .from("tournament_rounds")
      .insert({
        phase_id: phaseId,
        tournament_id: tournamentId,
        round_number: roundNumber,
        round_type: "swiss",
        status: "pending",
        time_limit_minutes: 50,
      })
      .select()
      .single()

    if (roundError || !round) return { error: roundError?.message ?? "Failed to create round" }

    // Create matches
    const matchInserts = pairings.map((pairing) => ({
      round_id: round.id,
      tournament_id: tournamentId,
      table_number: pairing.tableNumber,
      player1_id: pairing.player1Id,
      player2_id: pairing.player2Id,
      is_bye: pairing.player2Id === null,
      status: "pending" as const,
    }))

    const { error: matchError } = await supabase
      .from("tournament_matches")
      .insert(matchInserts)

    if (matchError) return { error: matchError.message }

    // Initialize player stats for new players
    for (const reg of registrations) {
      const existingStats = stats?.find(s => s.player_id === reg.player_id)
      if (!existingStats) {
        await supabase.from("tournament_player_stats").insert({
          tournament_id: tournamentId,
          phase_id: phaseId,
          player_id: reg.player_id,
        })
      }
    }

    // Auto-complete bye matches
    const byeMatches = pairings.filter((p) => p.player2Id === null)
    for (const byePairing of byeMatches) {
      const byePlayer = byePairing.player1Id
      const { data: byeMatch } = await supabase
        .from("tournament_matches")
        .select("id")
        .eq("round_id", round.id)
        .eq("player1_id", byePlayer)
        .eq("is_bye", true)
        .single()

      if (byeMatch) {
        await supabase.from("tournament_matches").update({
          winner_id: byePlayer,
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        }).eq("id", byeMatch.id)

        // Update player stats for bye - fetch current stats first
        const { data: currentStats } = await supabase
          .from("tournament_player_stats")
          .select("match_wins, byes, points")
          .eq("tournament_id", tournamentId)
          .eq("phase_id", phaseId)
          .eq("player_id", byePlayer)
          .single()

        if (currentStats) {
          await supabase.from("tournament_player_stats").update({
            match_wins: (currentStats.match_wins ?? 0) + 1,
            byes: (currentStats.byes ?? 0) + 1,
            points: (currentStats.points ?? 0) + phase.win_points,
          }).eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("player_id", byePlayer)
        }
      }
    }

    // Create announcement using admin client to bypass RLS
    const adminClient = createAdminClient()
    const { error: annError } = await adminClient.from("tournament_announcements").insert({
      tournament_id: tournamentId,
      author_id: userId,
      message: `Round ${round.round_number} pairings are now posted! Check the Matches tab to find your opponent and table number.`,
      priority: "high",
    })
    if (annError) console.error("[v0] Announcement insert error:", annError)

    revalidatePath(`/dashboard/tournaments/${tournamentId}`)
    return { success: true, roundId: round.id }
  } catch (err) {
    console.error("[v0] createSwissRound exception:", err)
    return { error: `Unexpected error: ${err instanceof Error ? err.message : String(err)}` }
  }
}

export async function regeneratePairings(tournamentId: string, roundId: string) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  // Get round info
  const { data: round } = await supabase
    .from("tournament_rounds")
    .select("phase_id, round_number")
    .eq("id", roundId)
    .single()

  if (!round) return { error: "Round not found" }

  // Delete existing matches for this round
  await supabase.from("tournament_matches").delete().eq("round_id", roundId)

  // Get phase settings
  const { data: phase } = await supabase
    .from("tournament_phases")
    .select("*")
    .eq("id", round.phase_id)
    .single()

  if (!phase) return { error: "Phase not found" }

  // Get active participants from tournament_participants
  const { data: participants } = await supabase
    .from("tournament_participants")
    .select("user_id")
    .eq("tournament_id", tournamentId)
    .in("status", ["registered", "checked_in"])

  if (!participants || participants.length < 2) {
    return { error: "Need at least 2 active players" }
  }

  // Map participants to registrations format for compatibility
  const registrations = participants.map(p => ({ player_id: p.user_id }))

  // Get player stats
  const { data: stats } = await supabase
    .from("tournament_player_stats")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("phase_id", round.phase_id)

  // Get previous matches (excluding this round)
  const { data: previousMatches } = await supabase
    .from("tournament_matches")
    .select("player1_id, player2_id")
    .eq("tournament_id", tournamentId)
    .neq("round_id", roundId)
    .not("player1_id", "is", null)
    .not("player2_id", "is", null)

  // Build player data for Swiss pairing
  const playerMap = new Map<string, PairingPlayer>()
  for (const reg of registrations) {
    const playerStats = stats?.find(s => s.player_id === reg.player_id)
    const opponents: string[] = []
    
    for (const match of previousMatches ?? []) {
      if (match.player1_id === reg.player_id && match.player2_id) {
        opponents.push(match.player2_id)
      } else if (match.player2_id === reg.player_id && match.player1_id) {
        opponents.push(match.player1_id)
      }
    }

    playerMap.set(reg.player_id, {
      id: reg.player_id,
      points: playerStats?.points ?? 0,
      opponents,
      hasHadBye: (playerStats?.byes ?? 0) > 0,
    })
  }

  const players = Array.from(playerMap.values())
  const pairings = generateSwissPairings(players)

  // Create matches
  const matchInserts = pairings.map((pairing) => ({
    round_id: roundId,
    tournament_id: tournamentId,
    table_number: pairing.tableNumber,
    player1_id: pairing.player1Id,
    player2_id: pairing.player2Id,
    is_bye: pairing.player2Id === null,
    status: "pending" as const,
  }))

  const { error: matchError } = await supabase
    .from("tournament_matches")
    .insert(matchInserts)

  if (matchError) return { error: matchError.message }

  // Create announcement using admin client
  const adminClient = createAdminClient()
  await adminClient.from("tournament_announcements").insert({
    tournament_id: tournamentId,
    author_id: userId,
    message: `Round ${round.round_number} pairings have been regenerated. Please check your new pairing.`,
    priority: "high",
  })

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true, pairingsCount: pairings.length }
}

export async function startRound(roundId: string) {
  const supabase = await createClient()

  const { data: round } = await supabase
    .from("tournament_rounds")
    .select("tournament_id, time_limit_minutes, round_number")
    .eq("id", roundId)
    .single()

  if (!round) return { error: "Round not found" }

  const auth = await requireTournamentOrganizer(round.tournament_id)
  if ("error" in auth) return auth
  const { userId } = auth

  const now = new Date()
  const endTime = new Date(now.getTime() + (round.time_limit_minutes ?? 50) * 60 * 1000)

  const { error } = await supabase
    .from("tournament_rounds")
    .update({
      status: "active",
      started_at: now.toISOString(),
      end_time: endTime.toISOString(),
    })
    .eq("id", roundId)

  if (error) return { error: error.message }

  // Update all pending matches to in_progress
  await supabase
    .from("tournament_matches")
    .update({ status: "in_progress" })
    .eq("round_id", roundId)
    .eq("status", "pending")

  // Create announcement using admin client
  const adminClient = createAdminClient()
  await adminClient.from("tournament_announcements").insert({
    tournament_id: round.tournament_id,
    author_id: userId,
    message: `Round ${round.round_number} has STARTED! You have ${round.time_limit_minutes ?? 50} minutes. Find your table and begin your match.`,
    priority: "high",
  })

  revalidatePath(`/dashboard/tournaments/${round.tournament_id}`)
  return { success: true }
}

export async function completeRound(roundId: string) {
  const supabase = await createClient()

  const { data: round } = await supabase
    .from("tournament_rounds")
    .select("tournament_id, phase_id, round_number")
    .eq("id", roundId)
    .single()

  if (!round) return { error: "Round not found" }

  const auth = await requireTournamentOrganizer(round.tournament_id)
  if ("error" in auth) return auth
  const { userId } = auth

  // Check all matches are confirmed
  const { data: matches } = await supabase
    .from("tournament_matches")
    .select("status")
    .eq("round_id", roundId)

  const unfinished = matches?.filter(m => !["confirmed"].includes(m.status))
  if (unfinished && unfinished.length > 0) {
    return { error: `${unfinished.length} matches still need results` }
  }

  const { error } = await supabase
    .from("tournament_rounds")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .eq("id", roundId)

  if (error) return { error: error.message }

  // Recalculate standings
  await recalculateStandings(round.tournament_id, round.phase_id)

  // Create announcement using admin client
  const adminClient = createAdminClient()
  await adminClient.from("tournament_announcements").insert({
    tournament_id: round.tournament_id,
    author_id: userId,
    message: `Round ${round.round_number} is now COMPLETE. Standings have been updated. Please wait for the next round to begin.`,
    priority: "normal",
  })

  revalidatePath(`/dashboard/tournaments/${round.tournament_id}`)
  return { success: true }
}

// ── Match Result Reporting ──

export async function reportMatchResult(
  matchId: string,
  reportingPlayerId: string,
  player1Wins: number,
  player2Wins: number,
  draws: number = 0
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  const { data: match } = await supabase
    .from("tournament_matches")
    .select("*, tournament_rounds(phase_id, tournament_phases(win_points, draw_points, loss_points))")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }

  // Check if reporting player is in this match (player_id from registrations)
  const isPlayer1 = match.player1_id === reportingPlayerId || match.player1_id === user.id
  const isPlayer2 = match.player2_id === reportingPlayerId || match.player2_id === user.id
  const isPlayer = isPlayer1 || isPlayer2
  
  // Check if TO
  const auth = await requireTournamentOrganizer(match.tournament_id)
  const isTO = !("error" in auth)

  if (!isPlayer && !isTO) {
    return { error: "Not authorized to report this match" }
  }

  // Determine winner
  let winnerId: string | null = null
  if (player1Wins > player2Wins) {
    winnerId = match.player1_id
  } else if (player2Wins > player1Wins) {
    winnerId = match.player2_id
  }
  // If equal and no draws, it's a draw match

  // Update match based on who is reporting
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    updated_at: now,
  }

  if (isTO) {
    // TO confirms directly with final values
    updates.status = "confirmed"
    updates.confirmed_at = now
    updates.confirmed_by = user.id
    updates.player1_wins = player1Wins
    updates.player2_wins = player2Wins
    updates.draws = draws
    updates.winner_id = winnerId
    if (winnerId) {
      updates.loser_id = winnerId === match.player1_id ? match.player2_id : match.player1_id
    }
  } else if (isPlayer1) {
    // Player 1 is reporting - use reported_player1 columns
    updates.reported_player1_wins = player1Wins
    updates.reported_player1_draws = draws
    updates.player1_reported_at = now
    
    if (match.status === "player2_reported") {
      // Player 2 already reported - check if results match
      // Player 1 reports: player1Wins (my wins), player2Wins (opponent wins)
      // Player 2 reported: reported_player2_wins (their wins = my losses)
      const p2ReportedTheirWins = match.reported_player2_wins ?? 0
      const p2ReportedTheirDraws = match.reported_player2_draws ?? 0
      
      // Results match if: Player 1's claimed wins == Player 2's claimed losses
      // and Player 1's claimed losses == Player 2's claimed wins
      const resultsMatch = (player1Wins === (match.player2_wins ?? p2ReportedTheirWins) || 
                           player1Wins === p2ReportedTheirWins) &&
                          (player2Wins === p2ReportedTheirWins || p2ReportedTheirWins === player2Wins) &&
                          draws === p2ReportedTheirDraws
      
      // Simpler check: both players agree on the same result
      const p1ClaimsWin = player1Wins > player2Wins
      const p2ClaimsWin = p2ReportedTheirWins > (match.reported_player1_wins ?? player1Wins)
      const bothClaimDraw = player1Wins === player2Wins && p2ReportedTheirWins === player1Wins
      
      if (p1ClaimsWin === p2ClaimsWin || bothClaimDraw || resultsMatch) {
        // Results agree - confirm
        updates.status = "confirmed"
        updates.confirmed_at = now
        updates.player1_wins = player1Wins
        updates.player2_wins = player2Wins
        updates.draws = draws
        updates.winner_id = winnerId
        if (winnerId) {
          updates.loser_id = winnerId === match.player1_id ? match.player2_id : match.player1_id
        }
      } else {
        // Results disagree - mark as disputed
        updates.status = "disputed"
        updates.dispute_reason = `Result mismatch: Player 1 reports ${player1Wins}-${player2Wins}, Player 2 reported ${p2ReportedTheirWins} wins`
      }
    } else {
      updates.status = "player1_reported"
    }
  } else if (isPlayer2) {
    // Player 2 is reporting - use reported_player2 columns
    updates.reported_player2_wins = player2Wins
    updates.reported_player2_draws = draws
    updates.player2_reported_at = now
    
    if (match.status === "player1_reported") {
      // Player 1 already reported - check if results match
      const p1ReportedTheirWins = match.reported_player1_wins ?? 0
      const p1ReportedTheirDraws = match.reported_player1_draws ?? 0
      
      // Results match if both players agree on who won
      const p1ClaimsWin = p1ReportedTheirWins > (match.reported_player2_wins ?? player2Wins)
      const p2ClaimsWin = player2Wins > player1Wins
      const bothClaimDraw = p1ReportedTheirWins === player2Wins && player1Wins === player2Wins
      
      // Check if reported results are consistent
      const resultsMatch = p1ReportedTheirWins === player1Wins && 
                          draws === p1ReportedTheirDraws
      
      if ((!p1ClaimsWin && !p2ClaimsWin) || bothClaimDraw || resultsMatch) {
        // Results agree - confirm
        updates.status = "confirmed"
        updates.confirmed_at = now
        updates.player1_wins = player1Wins
        updates.player2_wins = player2Wins
        updates.draws = draws
        updates.winner_id = winnerId
        if (winnerId) {
          updates.loser_id = winnerId === match.player1_id ? match.player2_id : match.player1_id
        }
      } else {
        // Results disagree - mark as disputed
        updates.status = "disputed"
        updates.dispute_reason = `Result mismatch: Player 1 reported ${p1ReportedTheirWins} wins, Player 2 reports ${player2Wins}-${player1Wins}`
      }
    } else {
      updates.status = "player2_reported"
    }
  }

  const { error } = await supabase
    .from("tournament_matches")
    .update(updates)
    .eq("id", matchId)

  if (error) return { error: error.message }

  // If confirmed, update player stats
  if (updates.status === "confirmed") {
    try {
      const phaseId = match.tournament_rounds?.phase_id
      const winPoints = match.tournament_rounds?.tournament_phases?.win_points ?? 3
      const drawPoints = match.tournament_rounds?.tournament_phases?.draw_points ?? 1
      const lossPoints = match.tournament_rounds?.tournament_phases?.loss_points ?? 0

      // Update player 1 stats - use RPC or manual check for existing record
      if (match.player1_id && phaseId) {
        const p1Won = winnerId === match.player1_id
        const isDraw = winnerId === null && draws > 0
        const p1Points = p1Won ? winPoints : (isDraw ? drawPoints : lossPoints)
        
        // Check if stats exist
        const { data: existing1 } = await supabase
          .from("tournament_player_stats")
          .select("id, match_wins, match_losses, match_draws, game_wins, game_losses, game_draws, points")
          .eq("tournament_id", match.tournament_id)
          .eq("phase_id", phaseId)
          .eq("player_id", match.player1_id)
          .single()
        
        if (existing1) {
          // Update existing
          await supabase.from("tournament_player_stats").update({
            match_wins: (existing1.match_wins || 0) + (p1Won ? 1 : 0),
            match_losses: (existing1.match_losses || 0) + (!p1Won && !isDraw ? 1 : 0),
            match_draws: (existing1.match_draws || 0) + (isDraw ? 1 : 0),
            game_wins: (existing1.game_wins || 0) + player1Wins,
            game_losses: (existing1.game_losses || 0) + player2Wins,
            game_draws: (existing1.game_draws || 0) + draws,
            points: (existing1.points || 0) + p1Points,
          }).eq("id", existing1.id)
        } else {
          // Insert new
          await supabase.from("tournament_player_stats").insert({
            tournament_id: match.tournament_id,
            phase_id: phaseId,
            player_id: match.player1_id,
            match_wins: p1Won ? 1 : 0,
            match_losses: !p1Won && !isDraw ? 1 : 0,
            match_draws: isDraw ? 1 : 0,
            game_wins: player1Wins,
            game_losses: player2Wins,
            game_draws: draws,
            points: p1Points,
          })
        }
      }

      // Update player 2 stats
      if (match.player2_id && phaseId) {
        const p2Won = winnerId === match.player2_id
        const isDraw = winnerId === null && draws > 0
        const p2Points = p2Won ? winPoints : (isDraw ? drawPoints : lossPoints)
        
        // Check if stats exist
        const { data: existing2 } = await supabase
          .from("tournament_player_stats")
          .select("id, match_wins, match_losses, match_draws, game_wins, game_losses, game_draws, points")
          .eq("tournament_id", match.tournament_id)
          .eq("phase_id", phaseId)
          .eq("player_id", match.player2_id)
          .single()
        
        if (existing2) {
          // Update existing
          await supabase.from("tournament_player_stats").update({
            match_wins: (existing2.match_wins || 0) + (p2Won ? 1 : 0),
            match_losses: (existing2.match_losses || 0) + (!p2Won && !isDraw ? 1 : 0),
            match_draws: (existing2.match_draws || 0) + (isDraw ? 1 : 0),
            game_wins: (existing2.game_wins || 0) + player2Wins,
            game_losses: (existing2.game_losses || 0) + player1Wins,
            game_draws: (existing2.game_draws || 0) + draws,
            points: (existing2.points || 0) + p2Points,
          }).eq("id", existing2.id)
        } else {
          // Insert new
          await supabase.from("tournament_player_stats").insert({
            tournament_id: match.tournament_id,
            phase_id: phaseId,
            player_id: match.player2_id,
            match_wins: p2Won ? 1 : 0,
            match_losses: !p2Won && !isDraw ? 1 : 0,
            match_draws: isDraw ? 1 : 0,
            game_wins: player2Wins,
            game_losses: player1Wins,
            game_draws: draws,
            points: p2Points,
          })
        }
      }
    } catch (statsErr) {
      console.error("Error updating player stats:", statsErr)
      // Don't fail the match report just because stats update failed
    }
  }

  revalidatePath(`/dashboard/tournaments/${match.tournament_id}`)
  revalidatePath(`/esports/tournaments`)
  return { success: true }
}

// ── Tiebreaker Calculations ──

export async function recalculateStandings(tournamentId: string, phaseId: string) {
  try {
    const supabase = await createClient()

    // Get all player stats (no join - we don't need profiles for tiebreaker calculation)
    const { data: allStats, error: statsError } = await supabase
      .from("tournament_player_stats")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("phase_id", phaseId)

    if (statsError) {
      console.error("Error fetching player stats for recalculation:", statsError)
      return
    }
    
    if (!allStats || allStats.length === 0) return

    // Get all confirmed matches
    const { data: matches } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("status", "confirmed")

    // Build opponent map
    const opponentMap = new Map<string, string[]>()
    for (const match of matches ?? []) {
      if (match.player1_id && match.player2_id) {
        const p1Opponents = opponentMap.get(match.player1_id) ?? []
        p1Opponents.push(match.player2_id)
        opponentMap.set(match.player1_id, p1Opponents)

        const p2Opponents = opponentMap.get(match.player2_id) ?? []
        p2Opponents.push(match.player1_id)
        opponentMap.set(match.player2_id, p2Opponents)
      }
    }

    // Calculate tiebreakers for each player
    const playerStatsMap = new Map<string, typeof allStats[0]>()
    for (const stat of allStats) {
      playerStatsMap.set(stat.player_id, stat)
    }

    const standings: Array<{
      playerId: string
      points: number
      omw: number
      gw: number
      ogw: number
    }> = []

    for (const stat of allStats) {
      const opponents = opponentMap.get(stat.player_id) ?? []
      
      // OMW% - Opponent Match Win Percentage (min 33%)
      let omwSum = 0
      let omwCount = 0
      for (const oppId of opponents) {
        const oppStats = playerStatsMap.get(oppId)
        if (oppStats) {
          const oppMatches = oppStats.match_wins + oppStats.match_losses + oppStats.match_draws
          if (oppMatches > 0) {
            const oppMwp = oppStats.match_wins / oppMatches
            omwSum += Math.max(0.33, oppMwp)
            omwCount++
          }
        }
      }
      const omw = omwCount > 0 ? (omwSum / omwCount) * 100 : 33

      // GW% - Game Win Percentage (min 33%)
      const totalGames = stat.game_wins + stat.game_losses + stat.game_draws
      const gw = totalGames > 0 
        ? Math.max(33, (stat.game_wins / totalGames) * 100)
        : 33

      // OGW% - Opponent Game Win Percentage (min 33%)
      let ogwSum = 0
      let ogwCount = 0
      for (const oppId of opponents) {
        const oppStats = playerStatsMap.get(oppId)
        if (oppStats) {
          const oppGames = oppStats.game_wins + oppStats.game_losses + oppStats.game_draws
          if (oppGames > 0) {
            const oppGwp = oppStats.game_wins / oppGames
            ogwSum += Math.max(0.33, oppGwp)
            ogwCount++
          }
        }
      }
      const ogw = ogwCount > 0 ? (ogwSum / ogwCount) * 100 : 33

      standings.push({
        playerId: stat.player_id,
        points: stat.points,
        omw: Math.round(omw * 100) / 100,
        gw: Math.round(gw * 100) / 100,
        ogw: Math.round(ogw * 100) / 100,
      })
    }

    // Sort by points, then OMW%, then GW%, then OGW%
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.omw !== a.omw) return b.omw - a.omw
      if (b.gw !== a.gw) return b.gw - a.gw
      return b.ogw - a.ogw
    })

    // Update standings in database
    for (let i = 0; i < standings.length; i++) {
      const s = standings[i]
      await supabase
        .from("tournament_player_stats")
        .update({
          omw_percent: s.omw,
          gw_percent: s.gw,
          ogw_percent: s.ogw,
          standing: i + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("tournament_id", tournamentId)
        .eq("phase_id", phaseId)
        .eq("player_id", s.playerId)
    }

    revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  } catch (err) {
    console.error("Error recalculating standings:", err)
  }
}

// ── Player Management ──

export async function dropPlayer(tournamentId: string, playerId: string, roundNumber?: number) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  // Get player name for announcement
  const { data: player } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", playerId)
    .single()
  
  const playerName = player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown' : 'Unknown'

  // Update registration status with unenrolled timestamp
  const { error: regError } = await supabase
    .from("tournament_registrations")
    .update({
      status: "dropped",
      unenrolled_at: new Date().toISOString(),
    })
    .eq("tournament_id", tournamentId)
    .eq("player_id", playerId)

  if (regError) return { error: regError.message }

  // Mark player as dropped in stats (preserve stats for historical record)
  await supabase
    .from("tournament_player_stats")
    .update({
      is_dropped: true,
      dropped_at_round: roundNumber ?? null,
    })
    .eq("tournament_id", tournamentId)
    .eq("player_id", playerId)

  // Create announcement
  await createAdminClient().from("tournament_announcements").insert({
    tournament_id: tournamentId,
    author_id: userId,
    message: `Player ${playerName} has dropped from the tournament${roundNumber ? ` after round ${roundNumber}` : ''}.`,
    priority: "normal",
  })

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

// ── Tournament Lifecycle ──

export async function updateTournamentStatus(tournamentId: string, status: TournamentStatus) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  const { error } = await supabase
    .from("tournaments")
    .update({ status })
    .eq("id", tournamentId)

  if (error) return { error: error.message }

  // Create announcement for significant status changes
  const statusMessages: Record<string, string> = {
    registration: "Registration is now OPEN. New players can join the tournament.",
    registration_closed: "Registration is now CLOSED. No new players can join.",
    in_progress: "The tournament is now IN PROGRESS.",
    cancelled: "The tournament has been CANCELLED.",
    completed: "The tournament has been marked as COMPLETE.",
  }
  
  if (statusMessages[status]) {
    await createAdminClient().from("tournament_announcements").insert({
      tournament_id: tournamentId,
      author_id: userId,
      message: statusMessages[status],
      priority: status === "cancelled" ? "high" : "normal",
    })
  }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  revalidatePath(`/esports/tournaments`)
  return { success: true }
}

export async function startTournament(tournamentId: string) {
  try {
    const auth = await requireTournamentOrganizer(tournamentId)
    if ("error" in auth) return auth
    const { supabase, userId } = auth
    
    // Get tournament details for format
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("format")
      .eq("id", tournamentId)
      .single()
    
    if (!tournament) return { error: "Tournament not found" }
    
    // Verify enough players - count all who are registered or checked_in from tournament_participants
    const { count: playerCount } = await supabase
      .from("tournament_participants")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .in("status", ["registered", "checked_in"])
    
    if (!playerCount || playerCount < 2) {
      return { error: "Need at least 2 registered players" }
    }
    
    // Calculate recommended rounds based on player count
    const recommendedRounds = calculateSwissRounds(playerCount)
    
    // Check if tournament has phases, if not create a default one
    const { data: phases } = await supabase
      .from("tournament_phases")
      .select("id, rounds_count")
      .eq("tournament_id", tournamentId)
    
    if (!phases || phases.length === 0) {
      // Auto-create a default phase based on tournament format with calculated rounds
      const phaseType = tournament.format || "swiss"
      const { error: phaseError } = await supabase
        .from("tournament_phases")
        .insert({
          tournament_id: tournamentId,
          name: phaseType === "swiss" ? "Swiss Rounds" : phaseType === "single_elimination" ? "Bracket" : "Main Phase",
          phase_type: phaseType,
          phase_order: 1,
          is_current: true,
          started_at: new Date().toISOString(),
          win_points: 3,
          draw_points: 1,
          loss_points: 0,
          rounds_count: phaseType === "swiss" ? recommendedRounds : null,
        })
      
      if (phaseError) return { error: `Failed to create phase: ${phaseError.message}` }
    } else {
      // Update first phase with calculated rounds if not set, and set as current
      const firstPhase = phases[0]
      await supabase
        .from("tournament_phases")
        .update({ 
          is_current: true, 
          started_at: new Date().toISOString(),
          rounds_count: firstPhase.rounds_count ?? recommendedRounds,
        })
        .eq("id", firstPhase.id)
    }
    
    // Update tournament status
    const { error } = await supabase
      .from("tournaments")
      .update({ status: "in_progress" })
      .eq("id", tournamentId)
    
    if (error) return { error: error.message }
    
    // Create announcement
    await createAdminClient().from("tournament_announcements").insert({
      tournament_id: tournamentId,
      author_id: userId,
      message: `The tournament has officially STARTED! ${recommendedRounds} rounds of Swiss will be played. Please check the Matches tab for your first round pairing.`,
      priority: "high",
    })
    
    revalidatePath(`/dashboard/tournaments/${tournamentId}`)
    revalidatePath(`/esports/tournaments`)
    return { success: true, recommendedRounds }
  } catch (err) {
    console.error("[v0] startTournament exception:", err)
    return { error: `Unexpected error: ${err instanceof Error ? err.message : String(err)}` }
  }
}

export async function completeTournament(tournamentId: string) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  // Mark all phases as complete
  await supabase
    .from("tournament_phases")
    .update({ is_complete: true, completed_at: new Date().toISOString() })
    .eq("tournament_id", tournamentId)

  // Update tournament status
  const { error } = await supabase
    .from("tournaments")
    .update({ status: "complete" })
    .eq("id", tournamentId)

  if (error) return { error: error.message }

  // Award tournament results and update leaderboards
  await awardTournamentResults(tournamentId)

  // Create announcement
  await createAdminClient().from("tournament_announcements").insert({
    tournament_id: tournamentId,
    author_id: userId,
    message: `The tournament is now COMPLETE! Thank you for participating. Check the Standings tab for final results.`,
    priority: "high",
  })

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  revalidatePath(`/esports/tournaments`)
  revalidatePath(`/esports/leaderboards`)
  return { success: true }
}

// ── Queries ──

export async function getTournamentStandings(tournamentId: string, phaseId?: string): Promise<PlayerStanding[]> {
  try {
    // Use admin client to bypass RLS
    const supabase = createAdminClient()

    // Query player stats
    let query = supabase
      .from("tournament_player_stats")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("points", { ascending: false })

    if (phaseId) {
      query = query.eq("phase_id", phaseId)
    }

    const { data: stats, error: statsError } = await query

    if (statsError) {
      console.error("[v0] getTournamentStandings stats error:", statsError)
      return []
    }

    if (!stats || stats.length === 0) {
      return []
    }

    // Get player profiles separately (using first_name, last_name)
    const playerIds = stats.map(s => s.player_id)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", playerIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

    // Get opponents for each player
    const { data: matches } = await supabase
      .from("tournament_matches")
      .select("player1_id, player2_id")
      .eq("tournament_id", tournamentId)
      .eq("status", "confirmed")

    const opponentMap = new Map<string, string[]>()
    for (const match of matches ?? []) {
      if (match.player1_id && match.player2_id) {
        const p1Opponents = opponentMap.get(match.player1_id) ?? []
        p1Opponents.push(match.player2_id)
        opponentMap.set(match.player1_id, p1Opponents)

        const p2Opponents = opponentMap.get(match.player2_id) ?? []
        p2Opponents.push(match.player1_id)
        opponentMap.set(match.player2_id, p2Opponents)
      }
    }

    return stats.map((stat, index) => {
      const profile = profileMap.get(stat.player_id)
      const displayName = profile 
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown'
      
      return {
        playerId: stat.player_id,
        displayName,
        avatarUrl: profile?.avatar_url ?? null,
        matchWins: stat.match_wins ?? 0,
        matchLosses: stat.match_losses ?? 0,
        matchDraws: stat.match_draws ?? 0,
        gameWins: stat.game_wins ?? 0,
        gameLosses: stat.game_losses ?? 0,
        gameDraws: stat.game_draws ?? 0,
        points: stat.points ?? 0,
        omwPercent: stat.omw_percent ?? 0,
        gwPercent: stat.gw_percent ?? 0,
        ogwPercent: stat.ogw_percent ?? 0,
        standing: stat.standing ?? index + 1,
        isDropped: stat.is_dropped ?? false,
        opponents: opponentMap.get(stat.player_id) ?? [],
      }
    })
  } catch (err) {
    console.error("[v0] getTournamentStandings exception:", err)
    return []
  }
}

export async function getCurrentRound(tournamentId: string) {
  try {
    // Use admin client to bypass RLS
    const supabase = createAdminClient()
    
    const { data: round, error: roundError } = await supabase
      .from("tournament_rounds")
      .select("*, tournament_phases(*)")
      .eq("tournament_id", tournamentId)
      .in("status", ["pending", "active", "paused"])
      .order("round_number", { ascending: false })
      .limit(1)
      .single()
    
    if (roundError || !round) return null
    
    // Get matches without profile join
    const { data: rawMatches } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("round_id", round.id)
      .order("table_number")
    
    if (!rawMatches?.length) {
      return { ...round, matches: [] }
    }
    
    // Get all player IDs from matches
    const playerIds = new Set<string>()
    rawMatches.forEach(m => {
      if (m.player1_id) playerIds.add(m.player1_id)
      if (m.player2_id) playerIds.add(m.player2_id)
    })
    
    // Fetch profiles separately
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", Array.from(playerIds))

    // Create profile lookup
    const profileMap = new Map(profiles?.map(p => [p.id, {
      id: p.id,
      display_name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
      avatar_url: null
    }]) || [])

    // Map matches with player data
    const matches = rawMatches.map(match => ({
      ...match,
      player1: match.player1_id ? profileMap.get(match.player1_id) || null : null,
      player2: match.player2_id ? profileMap.get(match.player2_id) || null : null,
    }))

    return {
      ...round,
      matches,
    }
  } catch (err) {
    console.error("[v0] getCurrentRound exception:", err)
    return null
  }
}

// ── Get All Tournament Rounds ──
export async function getAllTournamentRounds(tournamentId: string) {
  try {
    const supabase = createAdminClient()
    
    // Get all rounds for the tournament
    const { data: rounds, error: roundsError } = await supabase
      .from("tournament_rounds")
      .select("*, tournament_phases(name)")
      .eq("tournament_id", tournamentId)
      .order("round_number", { ascending: true })
    
    if (roundsError || !rounds?.length) return []
    
    // Get all matches for all rounds
    const roundIds = rounds.map(r => r.id)
    const { data: allMatches } = await supabase
      .from("tournament_matches")
      .select("*")
      .in("round_id", roundIds)
      .order("table_number")
    
    if (!allMatches?.length) {
      return rounds.map(r => ({ ...r, matches: [] }))
    }
    
    // Get all unique player IDs
    const playerIds = new Set<string>()
    allMatches.forEach(m => {
      if (m.player1_id) playerIds.add(m.player1_id)
      if (m.player2_id) playerIds.add(m.player2_id)
    })
    
    // Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", Array.from(playerIds))
    
    const profileMap = new Map(profiles?.map(p => [p.id, {
      id: p.id,
      display_name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
    }]) || [])
    
    // Group matches by round and add player info
    const matchesByRound = new Map<string, any[]>()
    allMatches.forEach(match => {
      const roundMatches = matchesByRound.get(match.round_id) || []
      roundMatches.push({
        ...match,
        player1: match.player1_id ? profileMap.get(match.player1_id) || null : null,
        player2: match.player2_id ? profileMap.get(match.player2_id) || null : null,
      })
      matchesByRound.set(match.round_id, roundMatches)
    })
    
    // Combine rounds with their matches
    return rounds.map(round => ({
      ...round,
      matches: matchesByRound.get(round.id) || [],
    }))
  } catch (err) {
    console.error("[v0] getAllTournamentRounds exception:", err)
    return []
  }
}

export async function getRoundPairings(roundId: string) {
  const supabase = await createClient()

  const { data: matches } = await supabase
    .from("tournament_matches")
    .select(`
      *,
      player1:profiles!tournament_matches_player1_id_fkey(id, first_name, last_name, avatar_url),
      player2:profiles!tournament_matches_player2_id_fkey(id, first_name, last_name, avatar_url)
    `)
    .eq("round_id", roundId)
    .order("table_number")

  return matches ?? []
}

// ══════════════════════════════════════════════════════════════════════════════
// Elimination Bracket Generation
// ════════════════════════════════════════════════════════════════════════�����������═════

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

function generateBracketSeeding(playerCount: number): number[] {
  const size = nextPowerOf2(playerCount)
  const positions: number[] = [1]
  
  for (let round = 1; round < Math.log2(size); round++) {
    const newPositions: number[] = []
    const sum = Math.pow(2, round) + 1
    
    for (const pos of positions) {
      newPositions.push(pos)
      newPositions.push(sum - pos)
    }
    
    positions.length = 0
    positions.push(...newPositions)
  }
  
  return positions
}

export async function createEliminationBracket(
  tournamentId: string,
  phaseId: string,
  options?: {
    seedBy?: "standings" | "seed" | "random"
    playerIds?: string[]
  }
) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase } = auth

  // Get phase settings
  const { data: phase } = await supabase
    .from("tournament_phases")
    .select("*")
    .eq("id", phaseId)
    .single()

  if (!phase) return { error: "Phase not found" }
  if (!["single_elimination", "double_elimination"].includes(phase.phase_type)) {
    return { error: "Phase type must be single or double elimination" }
  }

  // Get players - either provided list or from standings/registrations
  let playerIds: string[] = options?.playerIds ?? []
  
  if (playerIds.length === 0) {
    if (options?.seedBy === "standings") {
      // Get top N from previous phase standings
      const { data: standings } = await supabase
        .from("tournament_player_stats")
        .select("player_id")
        .eq("tournament_id", tournamentId)
        .eq("is_dropped", false)
        .order("standing")
        .limit(phase.advancement_count ?? 8)
      
      playerIds = standings?.map(s => s.player_id) ?? []
    } else {
      // Get all registered players
      const { data: registrations } = await supabase
        .from("tournament_registrations")
        .select("player_id, seed")
        .eq("tournament_id", tournamentId)
        .eq("status", "registered")
        .order("seed", { nullsFirst: false })
      
      if (options?.seedBy === "random") {
        playerIds = (registrations ?? [])
          .sort(() => Math.random() - 0.5)
          .map(r => r.player_id)
      } else {
        playerIds = registrations?.map(r => r.player_id) ?? []
      }
    }
  }

  if (playerIds.length < 2) {
    return { error: "Need at least 2 players for elimination bracket" }
  }

  // Generate bracket seeding
  const bracketSize = nextPowerOf2(playerIds.length)
  const positions = generateBracketSeeding(bracketSize)
  
  // Map players to bracket slots
  const bracketSlots: (string | null)[] = new Array(bracketSize).fill(null)
  for (let i = 0; i < playerIds.length; i++) {
    const position = positions[i] - 1
    bracketSlots[position] = playerIds[i]
  }

  // Create round for first round
  const { data: round, error: roundError } = await supabase
    .from("tournament_rounds")
    .insert({
      phase_id: phaseId,
      tournament_id: tournamentId,
      round_number: 1,
      round_type: "elimination",
      status: "pending",
    })
    .select()
    .single()

  if (roundError || !round) return { error: roundError?.message ?? "Failed to create round" }

  // Create first round matches
  const matchInserts: Array<{
    round_id: string
    tournament_id: string
    table_number: number
    player1_id: string | null
    player2_id: string | null
    is_bye: boolean
    status: "pending"
    bracket_position: number
    bracket_round: number
  }> = []

  for (let i = 0; i < bracketSize; i += 2) {
    const p1 = bracketSlots[i]
    const p2 = bracketSlots[i + 1]
    const isBye = !p1 || !p2

    matchInserts.push({
      round_id: round.id,
      tournament_id: tournamentId,
      table_number: Math.floor(i / 2) + 1,
      player1_id: p1,
      player2_id: p2,
      is_bye: isBye,
      status: "pending",
      bracket_position: Math.floor(i / 2) + 1,
      bracket_round: 1,
    })
  }

  const { data: insertedMatches, error: matchError } = await supabase
    .from("tournament_matches")
    .insert(matchInserts)
    .select()

  if (matchError) return { error: matchError.message }

  // Auto-complete bye matches and advance winners
  for (const match of insertedMatches ?? []) {
    if (match.is_bye) {
      const winnerId = match.player1_id || match.player2_id
      if (winnerId) {
        await supabase.from("tournament_matches").update({
          winner_id: winnerId,
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        }).eq("id", match.id)
      }
    }
  }

  // Initialize player stats for elimination phase
  for (const playerId of playerIds) {
    await supabase.from("tournament_player_stats").upsert({
      tournament_id: tournamentId,
      phase_id: phaseId,
      player_id: playerId,
      match_wins: 0,
      match_losses: 0,
      match_draws: 0,
      game_wins: 0,
      game_losses: 0,
      game_draws: 0,
      points: 0,
    }, {
      onConflict: "tournament_id,phase_id,player_id",
    })
  }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true, roundId: round.id }
}

export async function advanceEliminationWinner(matchId: string) {
  const supabase = await createClient()

  const { data: match } = await supabase
    .from("tournament_matches")
    .select("*, tournament_rounds(phase_id, tournament_id)")
    .eq("id", matchId)
    .single()

  if (!match || !match.winner_id) return { error: "Match not complete or no winner" }

  const tournamentId = match.tournament_rounds?.tournament_id
  const phaseId = match.tournament_rounds?.phase_id
  if (!tournamentId || !phaseId) return { error: "Invalid match data" }

  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth

  // Find or create next round match
  const nextBracketRound = match.bracket_round + 1
  const nextBracketPosition = Math.ceil(match.bracket_position / 2)

  // Check if next round exists
  let { data: nextRound } = await supabase
    .from("tournament_rounds")
    .select("*")
    .eq("phase_id", phaseId)
    .eq("round_number", nextBracketRound)
    .single()

  if (!nextRound) {
    // Count matches in current round to see if we need next round
    const { count } = await supabase
      .from("tournament_matches")
      .select("*", { count: "exact", head: true })
      .eq("round_id", match.round_id)

    if (count && count > 1) {
      // Create next round
      const { data: newRound, error } = await supabase
        .from("tournament_rounds")
        .insert({
          phase_id: phaseId,
          tournament_id: tournamentId,
          round_number: nextBracketRound,
          round_type: count <= 2 ? "finals" : "elimination",
          status: "pending",
        })
        .select()
        .single()

      if (error) return { error: error.message }
      nextRound = newRound
    }
  }

  if (nextRound) {
    // Find or create next match
    let { data: nextMatch } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("round_id", nextRound.id)
      .eq("bracket_position", nextBracketPosition)
      .single()

    if (!nextMatch) {
      const { data: newMatch, error } = await supabase
        .from("tournament_matches")
        .insert({
          round_id: nextRound.id,
          tournament_id: tournamentId,
          table_number: nextBracketPosition,
          bracket_position: nextBracketPosition,
          bracket_round: nextBracketRound,
          status: "pending",
        })
        .select()
        .single()

      if (error) return { error: error.message }
      nextMatch = newMatch
    }

    // Place winner in next match
    const slot = match.bracket_position % 2 === 1 ? "player1_id" : "player2_id"
    await supabase
      .from("tournament_matches")
      .update({ [slot]: match.winner_id })
      .eq("id", nextMatch.id)

    // Link matches
    await supabase
      .from("tournament_matches")
      .update({ next_match_id: nextMatch.id })
      .eq("id", matchId)
  }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

// ═════���════════════════════════════════════════════════════════════════════════
// Player Registration & Check-in
// ══════════════════════════════════════════════════════════════════════════════

export async function registerForTournament(
  tournamentId: string,
  options?: {
    registrationCode?: string
    preregistrationEmail?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Get tournament settings
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return { error: "Tournament not found" }
  if (tournament.status !== "published" && tournament.status !== "registration") {
    return { error: "Registration is not open" }
  }

  // Check registration deadline
  if (tournament.registration_deadline) {
    if (new Date(tournament.registration_deadline) < new Date()) {
      return { error: "Registration deadline has passed" }
    }
  }

  // Check max participants
  const { count } = await supabase
    .from("tournament_registrations")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .neq("status", "dropped")
    .neq("status", "disqualified")

  if (tournament.max_participants && (count ?? 0) >= tournament.max_participants) {
    return { error: "Tournament is full" }
  }

  // Handle registration types
  let registrationType: "direct" | "paid" | "code" | "preregistered" = "direct"

  if (tournament.registration_type === "code_only") {
    if (!options?.registrationCode) {
      return { error: "Registration code required" }
    }
    
    // Validate code
    const { data: code } = await supabase
      .from("tournament_registration_codes")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("code", options.registrationCode)
      .single()

    if (!code) return { error: "Invalid registration code" }
    if (code.use_count >= (code.max_uses ?? 1)) return { error: "Code has been used" }
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return { error: "Code has expired" }
    }

    // Increment code usage
    await supabase
      .from("tournament_registration_codes")
      .update({ use_count: code.use_count + 1 })
      .eq("id", code.id)

    registrationType = "code"
  }

  if (tournament.registration_type === "invite_only") {
    // Check preregistration
    const { data: prereg } = await supabase
      .from("tournament_preregistrations")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("email", user.email)
      .single()

    if (!prereg) return { error: "You are not invited to this tournament" }
    if (prereg.is_claimed) return { error: "Invitation already claimed" }

    // Claim preregistration
    await supabase
      .from("tournament_preregistrations")
      .update({
        is_claimed: true,
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", prereg.id)

    registrationType = "preregistered"
  }

  if (tournament.registration_type === "paid" && (tournament.entry_fee_cents ?? 0) > 0) {
    registrationType = "paid"
  }

  // Create registration
  const { error } = await supabase.from("tournament_registrations").insert({
    tournament_id: tournamentId,
    player_id: user.id,
    registration_type: registrationType,
    registration_code: options?.registrationCode,
    preregistration_email: options?.preregistrationEmail ?? user.email,
    payment_status: registrationType === "paid" ? "pending" : "none",
    status: registrationType === "paid" ? "registered" : "registered",
  })

  if (error) {
    if (error.code === "23505") return { error: "Already registered" }
    return { error: error.message }
  }

  revalidatePath(`/esports/tournaments`)
  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true, requiresPayment: registrationType === "paid" }
}

export async function checkInPlayer(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Get tournament check-in settings
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("check_in_required, check_in_opens_at, check_in_closes_at")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return { error: "Tournament not found" }
  if (!tournament.check_in_required) return { error: "Check-in not required" }

  const now = new Date()
  if (tournament.check_in_opens_at && new Date(tournament.check_in_opens_at) > now) {
    return { error: "Check-in has not opened yet" }
  }
  if (tournament.check_in_closes_at && new Date(tournament.check_in_closes_at) < now) {
    return { error: "Check-in has closed" }
  }

  // Update registration
  const { error } = await supabase
    .from("tournament_registrations")
    .update({
      status: "checked_in",
      check_in_at: now.toISOString(),
    })
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .eq("status", "registered")

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

export async function adminCheckInPlayer(tournamentId: string, playerId: string, createAnnouncementFlag = false) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  // Get player name for announcement
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", playerId)
    .single()

  const { error } = await supabase
    .from("tournament_registrations")
    .update({
      status: "checked_in",
      check_in_at: new Date().toISOString(),
    })
    .eq("tournament_id", tournamentId)
    .eq("player_id", playerId)

  if (error) return { error: error.message }

  // Create announcement if requested
  if (createAnnouncementFlag && profile) {
    const playerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'A player'
    await createAdminClient().from("tournament_announcements").insert({
      tournament_id: tournamentId,
      author_id: userId,
      message: `${playerName} has been checked in by tournament staff.`,
      priority: "normal",
    })
  }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

// ══════════════════════════════════════════════════════════════════════════════
// Round Timer Controls
// ═══════════════════════════════════════════════════════���═��════════════════════

export async function pauseRound(tournamentId: string, roundId: string) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  // Get current round to store remaining time
  const { data: round } = await supabase
    .from("tournament_rounds")
    .select("end_time, status, time_limit_minutes")
    .eq("id", roundId)
    .single()

  if (!round) return { error: "Round not found" }
  if (round.status !== "active") return { error: "Round is not active" }

  const now = new Date()
  const endTime = round.end_time ? new Date(round.end_time) : null
  const remainingMs = endTime ? Math.max(0, endTime.getTime() - now.getTime()) : 0
  const remainingMinutes = Math.ceil(remainingMs / 60000)

  // Store remaining minutes in time_limit_minutes (will be used when resuming)
  // Set end_time to null to indicate paused state
  const { error } = await supabase
    .from("tournament_rounds")
    .update({
      status: "paused",
      time_limit_minutes: remainingMinutes,
      end_time: null,
    })
    .eq("id", roundId)

  if (error) return { error: error.message }

  // Create announcement
  await createAdminClient().from("tournament_announcements").insert({
    tournament_id: tournamentId,
    author_id: userId,
    message: `Round timer has been PAUSED. ${remainingMinutes} minutes remaining.`,
    priority: "high",
  })

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true, remainingMs }
}

export async function resumeRound(tournamentId: string, roundId: string) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  // Get current round
  const { data: round } = await supabase
    .from("tournament_rounds")
    .select("time_limit_minutes, status")
    .eq("id", roundId)
    .single()

  if (!round) return { error: "Round not found" }
  if (round.status !== "paused") return { error: "Round is not paused" }

  // Calculate new end time based on stored remaining time
  const now = new Date()
  const remainingMs = (round.time_limit_minutes || 50) * 60 * 1000
  const newEndTime = new Date(now.getTime() + remainingMs)

  const { error } = await supabase
    .from("tournament_rounds")
    .update({
      status: "active",
      end_time: newEndTime.toISOString(),
    })
    .eq("id", roundId)

  if (error) return { error: error.message }

  // Create announcement
  await createAdminClient().from("tournament_announcements").insert({
    tournament_id: tournamentId,
    author_id: userId,
    message: "Round timer has been RESUMED.",
    priority: "high",
  })

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

export async function addTimeToRound(tournamentId: string, roundId: string, minutesToAdd: number) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  // Get current round
  const { data: round } = await supabase
    .from("tournament_rounds")
    .select("end_time, status, time_limit_minutes")
    .eq("id", roundId)
    .single()

  if (!round) return { error: "Round not found" }

  if (round.status === "paused") {
    // If paused, add to the stored remaining time
    const { error } = await supabase
      .from("tournament_rounds")
      .update({
        time_limit_minutes: (round.time_limit_minutes || 0) + minutesToAdd,
      })
      .eq("id", roundId)

    if (error) return { error: error.message }
  } else if (round.status === "active") {
    // If active (including expired timer), extend the end time from current time or end_time
    const msToAdd = minutesToAdd * 60 * 1000
    const baseTime = round.end_time ? new Date(round.end_time) : new Date()
    // If timer already expired, start from now instead
    const startTime = baseTime.getTime() < Date.now() ? new Date() : baseTime
    const newEndTime = new Date(startTime.getTime() + msToAdd)
    
    const { error } = await supabase
      .from("tournament_rounds")
      .update({
        end_time: newEndTime.toISOString(),
      })
      .eq("id", roundId)

    if (error) return { error: error.message }
  } else if (round.status === "complete") {
    return { error: "Cannot add time to a completed round" }
  } else {
    return { error: "Cannot add time to this round" }
  }

  // Create announcement
  await createAdminClient().from("tournament_announcements").insert({
    tournament_id: tournamentId,
    author_id: userId,
    message: `${minutesToAdd} minute${minutesToAdd !== 1 ? 's' : ''} have been added to the round timer.`,
    priority: "high",
  })

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

// ════════════════════════════════════════════��═══════���═════════════════════════
// Manual Match Management
// ══════════════════��═══════════════════════════════════════════════════════════

export async function swapMatchPlayers(
  tournamentId: string,
  match1Id: string,
  match2Id: string,
  swapPlayer1: boolean // if true, swap player1s; if false, swap player2s
) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  // Get both matches
  const { data: matches } = await supabase
    .from("tournament_matches")
    .select("*")
    .in("id", [match1Id, match2Id])

  if (!matches || matches.length !== 2) {
    return { error: "Could not find both matches" }
  }

  const [m1, m2] = matches
  
  // Swap the players
  if (swapPlayer1) {
    await supabase.from("tournament_matches").update({ player1_id: m2.player1_id }).eq("id", match1Id)
    await supabase.from("tournament_matches").update({ player1_id: m1.player1_id }).eq("id", match2Id)
  } else {
    await supabase.from("tournament_matches").update({ player2_id: m2.player2_id }).eq("id", match1Id)
    await supabase.from("tournament_matches").update({ player2_id: m1.player2_id }).eq("id", match2Id)
  }

  // Create announcement
  await createAdminClient().from("tournament_announcements").insert({
    tournament_id: tournamentId,
    author_id: userId,
    message: "Match pairings have been updated. Please check your current pairing.",
    priority: "high",
  })

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

export async function createManualMatch(
  tournamentId: string,
  roundId: string,
  player1Id: string,
  player2Id: string | null, // null for bye
  tableNumber?: number
) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  // Get round info
  const { data: round } = await supabase
    .from("tournament_rounds")
    .select("phase_id")
    .eq("id", roundId)
    .single()

  if (!round) return { error: "Round not found" }

  // Get max table number if not provided
  if (!tableNumber) {
    const { data: maxTable } = await supabase
      .from("tournament_matches")
      .select("table_number")
      .eq("round_id", roundId)
      .order("table_number", { ascending: false })
      .limit(1)
      .single()
    
    tableNumber = (maxTable?.table_number || 0) + 1
  }

  // Create the match
  const { error } = await supabase.from("tournament_matches").insert({
    round_id: roundId,
    phase_id: round.phase_id,
    tournament_id: tournamentId,
    player1_id: player1Id,
    player2_id: player2Id,
    table_number: tableNumber,
    status: player2Id ? "pending" : "completed",
    is_bye: !player2Id,
    player1_wins: player2Id ? 0 : 2,
    player2_wins: 0,
    winner_id: player2Id ? null : player1Id,
  })

  if (error) return { error: error.message }

  // Create announcement
  await createAdminClient().from("tournament_announcements").insert({
    tournament_id: tournamentId,
    author_id: userId,
    message: "A new match has been manually added to the round.",
    priority: "normal",
  })

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

export async function deleteMatch(tournamentId: string, matchId: string) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  const { error } = await supabase
    .from("tournament_matches")
    .delete()
    .eq("id", matchId)

  if (error) return { error: error.message }

  // Create announcement
  await createAdminClient().from("tournament_announcements").insert({
    tournament_id: tournamentId,
    author_id: userId,
    message: "A match has been removed from the round. Please check your pairings.",
    priority: "high",
  })

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

export async function updateMatchPlayers(
  tournamentId: string,
  matchId: string,
  player1Id: string | null,
  player2Id: string | null
) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  const isBye = !player1Id || !player2Id
  
  const { error } = await supabase
    .from("tournament_matches")
    .update({
      player1_id: player1Id,
      player2_id: player2Id,
      is_bye: isBye,
      status: isBye ? "completed" : "pending",
      winner_id: isBye ? (player1Id || player2Id) : null,
      player1_wins: isBye ? 2 : 0,
      player2_wins: 0,
    })
    .eq("id", matchId)

  if (error) return { error: error.message }

  // Create announcement
  await createAdminClient().from("tournament_announcements").insert({
    tournament_id: tournamentId,
    author_id: userId,
    message: "Match pairings have been updated. Please check your current pairing.",
    priority: "high",
  })

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

// ═══��══════���════════════════════════════��═════════════════════���═════��══════════
// Decklist Management
// ══════════════════════════════�����══════════���═══════════════════════════════════

export async function submitDecklist(
  tournamentId: string,
  decklistData: {
    name?: string
    text: string
    url?: string
    format?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Must be signed in" }

  // Verify player is registered
  const { data: registration } = await supabase
    .from("tournament_registrations")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .single()

  if (!registration) return { error: "Not registered for this tournament" }

  // Check decklist deadline
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("decklist_required, decklist_deadline")
    .eq("id", tournamentId)
    .single()

  if (tournament?.decklist_deadline) {
    if (new Date(tournament.decklist_deadline) < new Date()) {
      return { error: "Decklist deadline has passed" }
    }
  }

  // Upsert decklist
  const { error } = await supabase.from("tournament_decklists").upsert({
    tournament_id: tournamentId,
    player_id: user.id,
    registration_id: registration.id,
    decklist_name: decklistData.name,
    decklist_text: decklistData.text,
    decklist_url: decklistData.url,
    format: decklistData.format,
    review_status: "pending",
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "tournament_id,player_id",
  })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

export async function reviewDecklist(
  decklistId: string,
  status: "approved" | "rejected" | "needs_revision",
  notes?: string
) {
  const supabase = await createClient()

  const { data: decklist } = await supabase
    .from("tournament_decklists")
    .select("tournament_id")
    .eq("id", decklistId)
    .single()

  if (!decklist) return { error: "Decklist not found" }

  const auth = await requireTournamentOrganizer(decklist.tournament_id)
  if ("error" in auth) return auth

  const { error } = await supabase
    .from("tournament_decklists")
    .update({
      review_status: status,
      review_notes: notes,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      is_valid: status === "approved",
    })
    .eq("id", decklistId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments/${decklist.tournament_id}`)
  return { success: true }
}

export async function getTournamentDecklists(tournamentId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("tournament_decklists")
    .select("*, profiles(id, first_name, last_name, avatar_url)")
    .eq("tournament_id", tournamentId)
    .order("submitted_at", { ascending: false })

  return data ?? []
}

// ═══════════════════════════════════════════════════════════════════════���══════
// Registration Codes & Preregistrations
// ═════════════════════════════════════════════��������══════���════════════��══════════

export async function createRegistrationCode(
  tournamentId: string,
  options: {
    code: string
    maxUses?: number
    expiresAt?: string
  }
) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  const { error } = await supabase.from("tournament_registration_codes").insert({
    tournament_id: tournamentId,
    code: options.code.toUpperCase(),
    max_uses: options.maxUses ?? 1,
    expires_at: options.expiresAt,
    created_by: userId,
  })

  if (error) {
    if (error.code === "23505") return { error: "Code already exists" }
    return { error: error.message }
  }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

export async function bulkCreateRegistrationCodes(
  tournamentId: string,
  count: number,
  options?: {
    prefix?: string
    maxUsesPerCode?: number
    expiresAt?: string
  }
) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  const codes: Array<{
    tournament_id: string
    code: string
    max_uses: number
    expires_at?: string
    created_by: string
  }> = []

  const prefix = options?.prefix?.toUpperCase() ?? ""
  
  for (let i = 0; i < count; i++) {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
    codes.push({
      tournament_id: tournamentId,
      code: `${prefix}${randomPart}`,
      max_uses: options?.maxUsesPerCode ?? 1,
      expires_at: options?.expiresAt,
      created_by: userId,
    })
  }

  const { error } = await supabase.from("tournament_registration_codes").insert(codes)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true, count: codes.length }
}

export async function addPreregistration(
  tournamentId: string,
  email: string,
  playerName?: string
) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase } = auth

  const { error } = await supabase.from("tournament_preregistrations").insert({
    tournament_id: tournamentId,
    email: email.toLowerCase(),
    player_name: playerName,
  })

  if (error) {
    if (error.code === "23505") return { error: "Email already preregistered" }
    return { error: error.message }
  }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true }
}

export async function bulkAddPreregistrations(
  tournamentId: string,
  entries: Array<{ email: string; playerName?: string }>
) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase } = auth

  const inserts = entries.map(e => ({
    tournament_id: tournamentId,
    email: e.email.toLowerCase(),
    player_name: e.playerName,
  }))

  const { error } = await supabase.from("tournament_preregistrations").insert(inserts)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true, count: entries.length }
}

// ══════════════════════════════════════════════════════════════════════════════
// Tournament Data Queries
// ═════════════════════════════════════════════════════════════════════����════════

export async function getTournamentRegistrations(tournamentId: string) {
  try {
    // Use admin client to bypass RLS - tournament organizers need to see all registrations
    const supabase = createAdminClient()

    // Step 1: Get registrations WITHOUT profile join
    const { data: registrations, error: regError } = await supabase
      .from("tournament_registrations")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("registered_at", { ascending: false })

    if (regError) {
      console.error("[v0] Error fetching registrations:", regError)
      return []
    }
    
    if (!registrations?.length) {
      return []
    }

    // Step 2: Get profiles for all player IDs
    const playerIds = registrations.map(r => r.player_id).filter(Boolean)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", playerIds)

    // Create a lookup map
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    // Step 3: Combine the data
    const transformed = registrations.map(reg => {
      const profile = profileMap.get(reg.player_id)
      return {
        ...reg,
        profiles: profile ? {
          id: profile.id,
          display_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown Player',
          avatar_url: null
        } : null
      }
    })

    return transformed
  } catch (err) {
    console.error("[v0] getTournamentRegistrations error:", err)
    return []
  }
}

export async function getPlayerTournamentHistory(playerId: string) {
  const supabase = await createClient()

  const { data: registrations } = await supabase
    .from("tournament_registrations")
    .select(`
      *,
      tournaments(id, name, slug, start_date, status, games(name, slug))
    `)
    .eq("player_id", playerId)
    .order("registered_at", { ascending: false })

  const { data: stats } = await supabase
    .from("tournament_player_stats")
    .select("*")
    .eq("player_id", playerId)

  return {
    registrations: registrations ?? [],
    stats: stats ?? [],
  }
}

export async function getTournamentMatches(tournamentId: string, roundId?: string) {
  const supabase = await createClient()

  let query = supabase
    .from("tournament_matches")
    .select(`
      *,
      player1:profiles!tournament_matches_player1_id_fkey(id, first_name, last_name, avatar_url),
      player2:profiles!tournament_matches_player2_id_fkey(id, first_name, last_name, avatar_url),
      tournament_rounds(round_number, round_type, status)
    `)
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })

  if (roundId) {
    query = query.eq("round_id", roundId)
  }

  const { data } = await query
  return data ?? []
}

// ══════════════════════════════════════════════════════════════════════════════
// Leaderboard & Stats Updates
// ═══════════════════════════���═��════════════════════════════════════════════════

// Point system for placements
const PLACEMENT_POINTS: Record<number, number> = {
  1: 100,
  2: 75,
  3: 50,
  4: 35,
  5: 25,
  6: 20,
  7: 15,
  8: 10,
}

function getPlacementPoints(placement: number, totalPlayers: number): number {
  if (PLACEMENT_POINTS[placement]) return PLACEMENT_POINTS[placement]
  if (placement <= 12) return 8
  if (placement <= 16) return 5
  if (placement <= 32) return 3
  return 1 // Participation points
}

export async function awardTournamentResults(tournamentId: string) {
  const supabase = await createClient()

  // Get tournament info
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, game_id, games(name, slug)")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return { error: "Tournament not found" }

  // Get final standings
  const { data: allStats, error: statsError } = await supabase
    .from("tournament_player_stats")
    .select("*, profiles(id, first_name, last_name)")
    .eq("tournament_id", tournamentId)
    .order("standing")

  if (statsError) {
    return { error: `Failed to get standings: ${statsError.message}` }
  }

  if (!allStats || allStats.length === 0) return { error: "No standings found" }

  const totalPlayers = allStats.length

  // Award points to each player
  for (const stat of allStats) {
    const placement = stat.standing ?? 999
    const points = getPlacementPoints(placement, totalPlayers)

    // Create tournament result record
    await supabase.from("tournament_results").upsert({
      tournament_id: tournamentId,
      user_id: stat.player_id,
      placement,
      ranking_points_awarded: points,
      match_wins: stat.match_wins ?? 0,
      match_losses: stat.match_losses ?? 0,
      match_draws: stat.match_draws ?? 0,
      game_wins: stat.game_wins ?? 0,
      game_losses: stat.game_losses ?? 0,
      game_draws: stat.game_draws ?? 0,
    }, { onConflict: "tournament_id,user_id" })

    // Update or create leaderboard entry
    const { data: existing } = await supabase
      .from("leaderboard_entries")
      .select("*")
      .eq("user_id", stat.player_id)
      .eq("game_id", tournament.game_id)
      .single()

    if (existing) {
      await supabase.from("leaderboard_entries").update({
        ranking_points: (existing.ranking_points ?? 0) + points,
        total_wins: (existing.total_wins ?? 0) + (stat.match_wins ?? 0),
        total_losses: (existing.total_losses ?? 0) + (stat.match_losses ?? 0),
        total_draws: (existing.total_draws ?? 0) + (stat.match_draws ?? 0),
        tournaments_played: (existing.tournaments_played ?? 0) + 1,
        tournaments_won: placement === 1 ? (existing.tournaments_won ?? 0) + 1 : (existing.tournaments_won ?? 0),
        best_placement: existing.best_placement ? Math.min(existing.best_placement, placement) : placement,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id)
    } else {
      await supabase.from("leaderboard_entries").insert({
        user_id: stat.player_id,
        game_id: tournament.game_id,
        ranking_points: points,
        total_wins: stat.match_wins ?? 0,
        total_losses: stat.match_losses ?? 0,
        total_draws: stat.match_draws ?? 0,
        tournaments_played: 1,
        tournaments_won: placement === 1 ? 1 : 0,
        best_placement: placement,
      })
    }

    // Note: career_wins/losses/tournaments columns don't exist in profiles table yet
    // Skip career stats update until migration is applied
  }

  revalidatePath("/esports/leaderboards")
  return { success: true, playersAwarded: allStats.length }
}

export async function getGameLeaderboard(gameId: string, limit = 50) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("leaderboard_entries")
      .select("*, profiles(id, first_name, last_name, avatar_url), games(name, slug, icon_url)")
      .eq("game_id", gameId)
      .order("ranking_points", { ascending: false })
      .limit(limit)

    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}

export async function getGlobalLeaderboard(limit = 100) {
  try {
    const supabase = await createClient()

    // Aggregate points across all games for each player
    const { data: entries, error } = await supabase
      .from("leaderboard_entries")
      .select("user_id, ranking_points, total_wins, total_losses, tournaments_played, tournaments_won")

    if (error || !entries || entries.length === 0) return []

    // Aggregate by user
    const userStats = new Map<string, {
      userId: string
      totalPoints: number
      totalWins: number
      totalLosses: number
      totalTournaments: number
      totalWon: number
    }>()

    for (const entry of entries) {
      const existing = userStats.get(entry.user_id)
      if (existing) {
        existing.totalPoints += entry.ranking_points
        existing.totalWins += entry.total_wins
        existing.totalLosses += entry.total_losses
        existing.totalTournaments += entry.tournaments_played
        existing.totalWon += entry.tournaments_won
      } else {
        userStats.set(entry.user_id, {
          userId: entry.user_id,
          totalPoints: entry.ranking_points,
          totalWins: entry.total_wins,
          totalLosses: entry.total_losses,
          totalTournaments: entry.tournaments_played,
          totalWon: entry.tournaments_won,
        })
      }
    }

    // Sort by total points
    const sorted = Array.from(userStats.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit)

    // Fetch profile data
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", sorted.map(s => s.userId))

    const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

    return sorted.map(s => ({
      ...s,
      profile: profileMap.get(s.userId) ?? null,
    }))
  } catch {
    return []
  }
}

export async function addPlayerToTournament(tournamentId: string, email: string) {
  try {
    const auth = await requireTournamentOrganizer(tournamentId)
    if ("error" in auth) return auth
    const { supabase } = auth

    const normalizedEmail = email.toLowerCase().trim()
    
    // Find user by email via admin API (email is stored in auth.users, not profiles)
    let userId: string | null = null
    let displayName: string | null = null
    
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()
    
    // Use admin API to find user by email
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers()
    
    if (listError) {
      return { error: `User lookup failed: ${listError.message}` }
    }
    
    const authUser = usersData?.users?.find(
      u => u.email?.toLowerCase() === normalizedEmail
    )
    
    if (authUser) {
      userId = authUser.id
      
      // Get profile for display name
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, display_name")
        .eq("id", authUser.id)
        .single()
        
      if (profile) {
        displayName = profile.display_name || 
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") || 
          normalizedEmail
      } else {
        displayName = authUser.user_metadata?.full_name || normalizedEmail
      }
    }

    // If user not found, return helpful message
    if (!userId) {
      return { 
        error: `No account found for ${normalizedEmail}. They need to sign up at majhevents.com/auth/sign-up first.`,
      }
    }

    // Check if already registered
    const { data: existing } = await supabase
      .from("tournament_registrations")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("player_id", userId)
      .single()

    if (existing) {
      return { error: "Player is already registered for this tournament" }
    }

    // Check max participants
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("max_participants")
      .eq("id", tournamentId)
      .single()

    if (tournament?.max_participants) {
      const { count } = await supabase
        .from("tournament_registrations")
        .select("*", { count: "exact", head: true })
        .eq("tournament_id", tournamentId)
        .neq("status", "dropped")
        .neq("status", "disqualified")

      if (count && count >= tournament.max_participants) {
        return { error: "Tournament is full" }
      }
    }

    // Add player to registrations
    const insertData = {
      tournament_id: tournamentId,
      player_id: userId,
      registration_type: "direct", // Valid values: direct, paid, code, preregistered
      status: "registered",
      payment_status: "paid", // Admin adds are considered paid
      registered_at: new Date().toISOString(),
    }
    
    const { error } = await supabase.from("tournament_registrations").insert(insertData)

    if (error) {
      return { error: `Failed to register player: ${error.message}` }
    }

    revalidatePath(`/dashboard/tournaments/${tournamentId}`)
    return { success: true, playerName: displayName || normalizedEmail }
  } catch (err) {
    console.error("[v0] addPlayerToTournament error:", err)
    return { error: `Unexpected error: ${err instanceof Error ? err.message : String(err)}` }
  }
}

export async function getPlayerStats(playerId: string) {
  const supabase = await createClient()

  // Get profile (without career stats - columns don't exist yet)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .eq("id", playerId)
    .single()

  // Try to get leaderboard entries (table may not exist)
  let leaderboardEntries: any[] = []
  try {
    const { data } = await supabase
      .from("leaderboard_entries")
      .select("*, games(id, name, slug, icon_url)")
      .eq("user_id", playerId)
      .order("ranking_points", { ascending: false })
    leaderboardEntries = data ?? []
  } catch {
    // Table doesn't exist yet
  }

  // Try to get recent tournament results (table may not exist)
  let recentResults: any[] = []
  try {
    const { data } = await supabase
      .from("tournament_results")
      .select("*, tournaments(id, name, slug, start_date, games(name, slug))")
      .eq("user_id", playerId)
      .order("created_at", { ascending: false })
      .limit(10)
    recentResults = data ?? []
  } catch {
    // Table doesn't exist yet
  }

  // Calculate aggregates from leaderboard entries
  const entries = leaderboardEntries
  const totalPoints = entries.reduce((sum, e) => sum + (e.ranking_points ?? 0), 0)
  const totalWins = entries.reduce((sum, e) => sum + (e.total_wins ?? 0), 0)
  const totalLosses = entries.reduce((sum, e) => sum + (e.total_losses ?? 0), 0)
  const totalTournaments = entries.reduce((sum, e) => sum + (e.tournaments_played ?? 0), 0)
  const tournamentsWon = entries.reduce((sum, e) => sum + (e.tournaments_won ?? 0), 0)

  return {
    profile,
    leaderboardEntries: entries,
    recentResults: recentResults ?? [],
    stats: {
      totalPoints,
      totalWins,
      totalLosses,
      totalTournaments,
      tournamentsWon,
      winRate: totalWins + totalLosses > 0 
        ? Math.round((totalWins / (totalWins + totalLosses)) * 100) 
        : 0,
    },
  }
}

// ── Announcements ──

export async function sendTournamentAnnouncement(
  tournamentId: string, 
  message: string,
  priority: "normal" | "high" | "urgent" = "normal"
) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  if (!message.trim()) {
    return { error: "Announcement message cannot be empty" }
  }

  // Insert announcement using admin client to bypass RLS
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from("tournament_announcements")
    .insert({
      tournament_id: tournamentId,
      message: message.trim(),
      priority,
      author_id: userId,
    })
    .select()
    .single()

  if (error) {
    // If table doesn't exist, provide helpful error
    if (error.code === "42P01") {
      return { error: "Announcements table not set up. Please contact support." }
    }
    console.error("[v0] sendTournamentAnnouncement error:", error)
    return { error: error.message }
  }

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  revalidatePath(`/esports/tournaments/${tournamentId}`)
  
  return { success: true, announcement: data }
}

export async function getTournamentAnnouncements(tournamentId: string) {
  const supabase = await createClient()

  // Fetch announcements first
  const { data: announcements, error } = await supabase
    .from("tournament_announcements")
    .select("id, message, priority, created_at, author_id")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })

  if (error) {
    // If table doesn't exist, return empty array
    if (error.code === "42P01") {
      return { announcements: [] }
    }
    console.error("[v0] getTournamentAnnouncements error:", error)
    return { announcements: [] }
  }

  if (!announcements || announcements.length === 0) {
    return { announcements: [] }
  }

  // Fetch profiles for all authors
  const authorIds = [...new Set(announcements.map(a => a.author_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", authorIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

  // Combine data
  const announcementsWithProfiles = announcements.map(a => ({
    ...a,
    profiles: profileMap.get(a.author_id) ?? null,
  }))

  return { announcements: announcementsWithProfiles }
}

export async function deleteAnnouncement(announcementId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Check staff role
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!staffRole || !["owner", "manager", "organizer"].includes(staffRole.role)) {
    return { error: "Not authorized to delete announcements" }
  }

  const { error } = await supabase
    .from("tournament_announcements")
    .delete()
    .eq("id", announcementId)

  if (error) return { error: error.message }

  return { success: true }
}

// ==========================================
// DISPUTE RESOLUTION
// ==========================================

export async function resolveDispute(
  matchId: string,
  resolution: "player1" | "player2" | "custom",
  customResult?: { player1Wins: number; player2Wins: number; draws: number }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Get match details
  const { data: match } = await supabase
    .from("tournament_matches")
    .select("*, tournament_rounds(phase_id, tournament_phases(win_points, draw_points, loss_points))")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }
  if (match.status !== "disputed") return { error: "Match is not disputed" }

  // Verify TO authorization
  const auth = await requireTournamentOrganizer(match.tournament_id)
  if ("error" in auth) return { error: auth.error }

  // Determine final result based on resolution type
  let player1Wins: number
  let player2Wins: number
  let draws: number

  if (resolution === "player1") {
    // Accept Player 1's report
    player1Wins = match.reported_player1_wins ?? 0
    player2Wins = match.player2_wins ?? 0
    draws = match.reported_player1_draws ?? 0
  } else if (resolution === "player2") {
    // Accept Player 2's report
    player1Wins = match.player1_wins ?? 0
    player2Wins = match.reported_player2_wins ?? 0
    draws = match.reported_player2_draws ?? 0
  } else if (resolution === "custom" && customResult) {
    // Use TO's custom result
    player1Wins = customResult.player1Wins
    player2Wins = customResult.player2Wins
    draws = customResult.draws
  } else {
    return { error: "Invalid resolution parameters" }
  }

  // Determine winner
  let winnerId: string | null = null
  let loserId: string | null = null
  if (player1Wins > player2Wins) {
    winnerId = match.player1_id
    loserId = match.player2_id
  } else if (player2Wins > player1Wins) {
    winnerId = match.player2_id
    loserId = match.player1_id
  }

  const now = new Date().toISOString()

  // Update match with resolved result
  const { error } = await supabase
    .from("tournament_matches")
    .update({
      status: "confirmed",
      player1_wins: player1Wins,
      player2_wins: player2Wins,
      draws: draws,
      winner_id: winnerId,
      loser_id: loserId,
      confirmed_at: now,
      confirmed_by: user.id,
      dispute_reason: `Resolved by TO: ${resolution}`,
      updated_at: now,
    })
    .eq("id", matchId)

  if (error) return { error: error.message }

  // Update player stats (same logic as reportMatchResult)
  try {
    const phaseId = match.tournament_rounds?.phase_id
    const winPoints = match.tournament_rounds?.tournament_phases?.win_points ?? 3
    const drawPoints = match.tournament_rounds?.tournament_phases?.draw_points ?? 1
    const lossPoints = match.tournament_rounds?.tournament_phases?.loss_points ?? 0

    // Update player 1 stats
    if (match.player1_id && phaseId) {
      const p1Won = winnerId === match.player1_id
      const isDraw = winnerId === null
      const p1Points = p1Won ? winPoints : (isDraw ? drawPoints : lossPoints)
      
      const { data: existing1 } = await supabase
        .from("tournament_player_stats")
        .select("id, match_wins, match_losses, match_draws, game_wins, game_losses, game_draws, points")
        .eq("tournament_id", match.tournament_id)
        .eq("phase_id", phaseId)
        .eq("player_id", match.player1_id)
        .single()
      
      if (existing1) {
        await supabase.from("tournament_player_stats").update({
          match_wins: (existing1.match_wins || 0) + (p1Won ? 1 : 0),
          match_losses: (existing1.match_losses || 0) + (!p1Won && !isDraw ? 1 : 0),
          match_draws: (existing1.match_draws || 0) + (isDraw ? 1 : 0),
          game_wins: (existing1.game_wins || 0) + player1Wins,
          game_losses: (existing1.game_losses || 0) + player2Wins,
          game_draws: (existing1.game_draws || 0) + draws,
          points: (existing1.points || 0) + p1Points,
        }).eq("id", existing1.id)
      } else {
        await supabase.from("tournament_player_stats").insert({
          tournament_id: match.tournament_id,
          phase_id: phaseId,
          player_id: match.player1_id,
          match_wins: p1Won ? 1 : 0,
          match_losses: !p1Won && !isDraw ? 1 : 0,
          match_draws: isDraw ? 1 : 0,
          game_wins: player1Wins,
          game_losses: player2Wins,
          game_draws: draws,
          points: p1Points,
        })
      }
    }

    // Update player 2 stats
    if (match.player2_id && phaseId) {
      const p2Won = winnerId === match.player2_id
      const isDraw = winnerId === null
      const p2Points = p2Won ? winPoints : (isDraw ? drawPoints : lossPoints)
      
      const { data: existing2 } = await supabase
        .from("tournament_player_stats")
        .select("id, match_wins, match_losses, match_draws, game_wins, game_losses, game_draws, points")
        .eq("tournament_id", match.tournament_id)
        .eq("phase_id", phaseId)
        .eq("player_id", match.player2_id)
        .single()
      
      if (existing2) {
        await supabase.from("tournament_player_stats").update({
          match_wins: (existing2.match_wins || 0) + (p2Won ? 1 : 0),
          match_losses: (existing2.match_losses || 0) + (!p2Won && !isDraw ? 1 : 0),
          match_draws: (existing2.match_draws || 0) + (isDraw ? 1 : 0),
          game_wins: (existing2.game_wins || 0) + player2Wins,
          game_losses: (existing2.game_losses || 0) + player1Wins,
          game_draws: (existing2.game_draws || 0) + draws,
          points: (existing2.points || 0) + p2Points,
        }).eq("id", existing2.id)
      } else {
        await supabase.from("tournament_player_stats").insert({
          tournament_id: match.tournament_id,
          phase_id: phaseId,
          player_id: match.player2_id,
          match_wins: p2Won ? 1 : 0,
          match_losses: !p2Won && !isDraw ? 1 : 0,
          match_draws: isDraw ? 1 : 0,
          game_wins: player2Wins,
          game_losses: player1Wins,
          game_draws: draws,
          points: p2Points,
        })
      }
    }
  } catch (statsError) {
    console.error("Error updating player stats after dispute resolution:", statsError)
  }

  return { success: true }
}

// Get disputed matches for a tournament
export async function getDisputedMatches(tournamentId: string): Promise<{ 
  matches?: Array<{
    id: string
    round_number: number
    table_number: number
    player1_id: string
    player2_id: string
    player1_name: string
    player2_name: string
    reported_player1_wins: number | null
    reported_player2_wins: number | null
    reported_player1_draws: number | null
    reported_player2_draws: number | null
    dispute_reason: string | null
  }>
  error?: string 
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Verify TO authorization
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return { error: auth.error }

  const { data: matches, error } = await supabase
    .from("tournament_matches")
    .select(`
      id,
      table_number,
      player1_id,
      player2_id,
      reported_player1_wins,
      reported_player2_wins,
      reported_player1_draws,
      reported_player2_draws,
      dispute_reason,
      tournament_rounds!inner(round_number)
    `)
    .eq("tournament_id", tournamentId)
    .eq("status", "disputed")

  if (error) return { error: error.message }

  // Get player names
  const playerIds = new Set<string>()
  matches?.forEach(m => {
    if (m.player1_id) playerIds.add(m.player1_id)
    if (m.player2_id) playerIds.add(m.player2_id)
  })

  let profilesMap: Record<string, string> = {}
  if (playerIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", Array.from(playerIds))
    
    profiles?.forEach(p => {
      profilesMap[p.id] = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown"
    })
  }

  return {
    matches: matches?.map(m => ({
      id: m.id,
      round_number: (m.tournament_rounds as { round_number: number })?.round_number ?? 0,
      table_number: m.table_number ?? 0,
      player1_id: m.player1_id,
      player2_id: m.player2_id,
      player1_name: profilesMap[m.player1_id] || "Unknown",
      player2_name: profilesMap[m.player2_id] || "Unknown",
      reported_player1_wins: m.reported_player1_wins,
      reported_player2_wins: m.reported_player2_wins,
      reported_player1_draws: m.reported_player1_draws,
      reported_player2_draws: m.reported_player2_draws,
      dispute_reason: m.dispute_reason,
    })) || []
  }
}

// ==========================================
// BULK ACTIONS FOR TO EFFICIENCY
// ==========================================

// Confirm all matches where both players reported matching results
export async function confirmAllMatchingReports(roundId: string): Promise<{ success?: boolean; confirmedCount?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Get round to verify tournament access
  const { data: round, error: roundError } = await supabase
    .from("tournament_rounds")
    .select("tournament_id")
    .eq("id", roundId)
    .single()

  if (roundError || !round) return { error: "Round not found" }

  const auth = await requireTournamentOrganizer(round.tournament_id)
  if ("error" in auth) return { error: auth.error }

  // Find all matches where:
  // - status is player1_reported or player2_reported
  // - both players have reported the same result
  const { data: matches, error: matchError } = await supabase
    .from("tournament_matches")
    .select("id, reported_player1_wins, reported_player2_wins, reported_player1_draws, reported_player2_draws")
    .eq("round_id", roundId)
    .in("status", ["player1_reported", "player2_reported"])
    .not("reported_player1_wins", "is", null)
    .not("reported_player2_wins", "is", null)

  if (matchError) return { error: matchError.message }

  // Filter to only matching reports
  const matchingMatches = matches?.filter(m => {
    // Check if the reports match (P1 says X-Y, P2 says X-Y)
    const p1ReportedP1Wins = m.reported_player1_wins
    const p2ReportedP1Wins = m.reported_player2_wins // P2's report of P1's wins
    const p1Draws = m.reported_player1_draws ?? 0
    const p2Draws = m.reported_player2_draws ?? 0
    
    // Match if both reported the same scores
    return p1ReportedP1Wins === p2ReportedP1Wins && p1Draws === p2Draws
  }) || []

  if (matchingMatches.length === 0) {
    return { success: true, confirmedCount: 0 }
  }

  // Confirm each match
  let confirmedCount = 0
  for (const match of matchingMatches) {
    const p1Wins = match.reported_player1_wins!
    const p2Wins = match.reported_player2_wins!
    const draws = match.reported_player1_draws ?? 0
    
    const winnerId = p1Wins > p2Wins ? "player1" : p2Wins > p1Wins ? "player2" : null
    
    const { error: updateError } = await supabase
      .from("tournament_matches")
      .update({
        player1_wins: p1Wins,
        player2_wins: p2Wins,
        draws,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: user.id,
      })
      .eq("id", match.id)

    if (!updateError) confirmedCount++
  }

  revalidatePath(`/dashboard/tournaments`)
  return { success: true, confirmedCount }
}

// Force complete all pending matches in a round (marks them as draws)
export async function forceCompleteRound(roundId: string): Promise<{ success?: boolean; forcedCount?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: round } = await supabase
    .from("tournament_rounds")
    .select("tournament_id")
    .eq("id", roundId)
    .single()

  if (!round) return { error: "Round not found" }

  const auth = await requireTournamentOrganizer(round.tournament_id)
  if ("error" in auth) return { error: auth.error }

  // Get all non-confirmed, non-bye matches
  const { data: pendingMatches, error: fetchError } = await supabase
    .from("tournament_matches")
    .select("id, is_bye")
    .eq("round_id", roundId)
    .not("status", "eq", "confirmed")
    .eq("is_bye", false)

  if (fetchError) return { error: fetchError.message }

  if (!pendingMatches || pendingMatches.length === 0) {
    return { success: true, forcedCount: 0 }
  }

  // Force complete as draws (0-0-0)
  const { error: updateError } = await supabase
    .from("tournament_matches")
    .update({
      player1_wins: 0,
      player2_wins: 0,
      draws: 0,
      winner_id: null,
      loser_id: null,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmed_by: user.id,
    })
    .in("id", pendingMatches.map(m => m.id))

  if (updateError) return { error: updateError.message }

  revalidatePath(`/dashboard/tournaments`)
  return { success: true, forcedCount: pendingMatches.length }
}

// Get round statistics for the control panel
export async function getRoundStats(roundId: string): Promise<{
  totalMatches: number
  confirmedMatches: number
  pendingMatches: number
  reportedMatches: number
  disputedMatches: number
  byeMatches: number
  progressPercent: number
}> {
  const supabase = await createClient()

  const { data: matches } = await supabase
    .from("tournament_matches")
    .select("id, status, is_bye")
    .eq("round_id", roundId)

  if (!matches) {
    return {
      totalMatches: 0,
      confirmedMatches: 0,
      pendingMatches: 0,
      reportedMatches: 0,
      disputedMatches: 0,
      byeMatches: 0,
      progressPercent: 0,
    }
  }

  const byeMatches = matches.filter(m => m.is_bye).length
  const nonByeMatches = matches.filter(m => !m.is_bye)
  const confirmedMatches = nonByeMatches.filter(m => m.status === "confirmed").length
  const pendingMatches = nonByeMatches.filter(m => m.status === "pending" || m.status === "in_progress").length
  const reportedMatches = nonByeMatches.filter(m => m.status === "player1_reported" || m.status === "player2_reported").length
  const disputedMatches = nonByeMatches.filter(m => m.status === "disputed").length

  const totalPlayableMatches = nonByeMatches.length
  const progressPercent = totalPlayableMatches > 0 
    ? Math.round((confirmedMatches / totalPlayableMatches) * 100) 
    : 100

  return {
    totalMatches: matches.length,
    confirmedMatches,
    pendingMatches,
    reportedMatches,
    disputedMatches,
    byeMatches,
    progressPercent,
  }
}

// ==========================================
// FEATURE MATCH + STREAMING SYSTEM
// ==========================================

// Set or unset a match as a feature match
export async function setFeatureMatch(
  matchId: string,
  isFeature: boolean,
  streamUrl?: string,
  streamPlatform?: "youtube" | "twitch" | "kick" | "custom"
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Get match to verify tournament access
  const { data: match } = await supabase
    .from("tournament_matches")
    .select("round_id, tournament_rounds(tournament_id)")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }

  const tournamentId = (match.tournament_rounds as any)?.tournament_id
  if (!tournamentId) return { error: "Tournament not found" }

  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return { error: auth.error }

  // Update the match
  const updateData: Record<string, any> = {
    is_feature_match: isFeature,
  }
  
  if (streamUrl) {
    updateData.stream_url = streamUrl
    updateData.stream_platform = streamPlatform || "custom"
  }
  
  if (!isFeature) {
    // Clear streaming info when removing feature status
    updateData.stream_url = null
    updateData.stream_platform = null
    updateData.stream_embed_url = null
  }

  const { error } = await supabase
    .from("tournament_matches")
    .update(updateData)
    .eq("id", matchId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments`)
  revalidatePath(`/esports/tournaments`)
  return { success: true }
}

// Update stream URL for a match
export async function updateMatchStream(
  matchId: string,
  streamUrl: string,
  streamPlatform: "youtube" | "twitch" | "kick" | "custom"
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: match } = await supabase
    .from("tournament_matches")
    .select("round_id, tournament_rounds(tournament_id)")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }

  const tournamentId = (match.tournament_rounds as any)?.tournament_id
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return { error: auth.error }

  const { error } = await supabase
    .from("tournament_matches")
    .update({
      stream_url: streamUrl,
      stream_platform: streamPlatform,
    })
    .eq("id", matchId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments`)
  return { success: true }
}

// Get all feature matches for a tournament
export async function getFeatureMatches(tournamentId: string) {
  const supabase = await createClient()

  const { data: matches, error } = await supabase
    .from("tournament_matches")
    .select(`
      id, player1_id, player2_id, player1_wins, player2_wins, draws,
      status, table_number, is_feature_match, stream_url, stream_platform, stream_embed_url,
      tournament_rounds(round_number, status, tournament_id)
    `)
    .eq("is_feature_match", true)
    .order("created_at", { ascending: false })

  if (error) return []

  // Filter by tournament and get player info
  const tournamentMatches = matches.filter(
    (m) => (m.tournament_rounds as any)?.tournament_id === tournamentId
  )

  // Get player profiles
  const playerIds = new Set<string>()
  tournamentMatches.forEach((m) => {
    if (m.player1_id) playerIds.add(m.player1_id)
    if (m.player2_id) playerIds.add(m.player2_id)
  })

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", Array.from(playerIds))

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

  return tournamentMatches.map((m) => ({
    ...m,
    player1: profileMap.get(m.player1_id!) || null,
    player2: profileMap.get(m.player2_id!) || null,
    roundNumber: (m.tournament_rounds as any)?.round_number,
    roundStatus: (m.tournament_rounds as any)?.status,
  }))
}

// Get live feature matches across all tournaments
export async function getLiveFeatureMatches() {
  const supabase = await createClient()

  // Get all feature matches from active tournaments
  const { data: matches, error } = await supabase
    .from("tournament_matches")
    .select(`
      id, player1_id, player2_id, player1_wins, player2_wins, draws,
      status, table_number, is_feature_match, stream_url, stream_platform, stream_embed_url, viewer_count,
      tournament_rounds(
        round_number, status,
        tournament_phases(
          tournaments(id, name, slug, status, games(name, slug))
        )
      )
    `)
    .eq("is_feature_match", true)
    .in("status", ["pending", "in_progress", "player1_reported", "player2_reported"])

  if (error || !matches) return []

  // Filter to only matches from in_progress tournaments
  const liveMatches = matches.filter((m) => {
    const tournament = (m.tournament_rounds as any)?.tournament_phases?.tournaments
    return tournament?.status === "in_progress"
  })

  // Get player profiles
  const playerIds = new Set<string>()
  liveMatches.forEach((m) => {
    if (m.player1_id) playerIds.add(m.player1_id)
    if (m.player2_id) playerIds.add(m.player2_id)
  })

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", Array.from(playerIds))

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

  return liveMatches.map((m) => {
    const tournament = (m.tournament_rounds as any)?.tournament_phases?.tournaments
    return {
      id: m.id,
      player1: profileMap.get(m.player1_id!) || null,
      player2: profileMap.get(m.player2_id!) || null,
      player1Wins: m.player1_wins,
      player2Wins: m.player2_wins,
      draws: m.draws,
      status: m.status,
      tableNumber: m.table_number,
      streamUrl: m.stream_url,
      streamPlatform: m.stream_platform,
      streamEmbedUrl: m.stream_embed_url,
      viewerCount: m.viewer_count,
      roundNumber: (m.tournament_rounds as any)?.round_number,
      tournament: tournament
        ? {
            id: tournament.id,
            name: tournament.name,
            slug: tournament.slug,
            gameName: tournament.games?.name,
            gameSlug: tournament.games?.slug,
          }
        : null,
    }
  })
}

// Tournament stream management
export async function addTournamentStream(
  tournamentId: string,
  data: {
    name: string
    platform: "youtube" | "twitch" | "kick" | "custom"
    streamUrl: string
    isPrimary?: boolean
  }
): Promise<{ success?: boolean; streamId?: string; error?: string }> {
  const supabase = await createClient()
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return { error: auth.error }

  // If setting as primary, unset other primary streams
  if (data.isPrimary) {
    await supabase
      .from("tournament_streams")
      .update({ is_primary: false })
      .eq("tournament_id", tournamentId)
  }

  const { data: stream, error } = await supabase
    .from("tournament_streams")
    .insert({
      tournament_id: tournamentId,
      name: data.name,
      platform: data.platform,
      stream_url: data.streamUrl,
      is_primary: data.isPrimary ?? false,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments`)
  return { success: true, streamId: stream.id }
}

export async function updateStreamStatus(
  streamId: string,
  isLive: boolean
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("tournament_streams")
    .update({ is_live: isLive, updated_at: new Date().toISOString() })
    .eq("id", streamId)

  if (error) return { error: error.message }

  revalidatePath(`/esports`)
  revalidatePath(`/live`)
  return { success: true }
}

export async function getTournamentStreams(tournamentId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("tournament_streams")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })

  return data || []
}

// ==========================================
// OBS OVERLAY SYSTEM
// ==========================================

// Set match as live (for overlay tracking)
export async function setMatchLive(
  matchId: string,
  isLive: boolean
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: match } = await supabase
    .from("tournament_matches")
    .select("round_id, tournament_rounds(tournament_id)")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }

  const tournamentId = (match.tournament_rounds as any)?.tournament_id
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return { error: auth.error }

  const { error } = await supabase
    .from("tournament_matches")
    .update({ 
      is_live: isLive,
      stream_status: isLive ? "live" : "offline"
    })
    .eq("id", matchId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments`)
  return { success: true }
}

// Start match timer
export async function startMatchTimer(
  matchId: string,
  durationSeconds?: number
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: match } = await supabase
    .from("tournament_matches")
    .select("round_id, tournament_rounds(tournament_id)")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }

  const tournamentId = (match.tournament_rounds as any)?.tournament_id
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return { error: auth.error }

  const updateData: Record<string, any> = {
    timer_started_at: new Date().toISOString(),
  }
  
  if (durationSeconds) {
    updateData.timer_duration_seconds = durationSeconds
  }

  const { error } = await supabase
    .from("tournament_matches")
    .update(updateData)
    .eq("id", matchId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments`)
  return { success: true }
}

// Stop/reset match timer
export async function stopMatchTimer(
  matchId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: match } = await supabase
    .from("tournament_matches")
    .select("round_id, tournament_rounds(tournament_id)")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }

  const tournamentId = (match.tournament_rounds as any)?.tournament_id
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return { error: auth.error }

  const { error } = await supabase
    .from("tournament_matches")
    .update({ timer_started_at: null })
    .eq("id", matchId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments`)
  return { success: true }
}

// Update overlay config
export async function updateOverlayConfig(
  matchId: string,
  config: {
    theme?: string
    layout?: string
    showTimer?: boolean
    showRound?: boolean
    showRecords?: boolean
    showAvatars?: boolean
    showTournamentName?: boolean
    primaryColor?: string
    accentColor?: string
    backgroundOpacity?: number
  }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: match } = await supabase
    .from("tournament_matches")
    .select("round_id, tournament_rounds(tournament_id)")
    .eq("id", matchId)
    .single()

  if (!match) return { error: "Match not found" }

  const tournamentId = (match.tournament_rounds as any)?.tournament_id
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return { error: auth.error }

  const updateData: Record<string, any> = {}
  if (config.theme !== undefined) updateData.theme = config.theme
  if (config.layout !== undefined) updateData.layout = config.layout
  if (config.showTimer !== undefined) updateData.show_timer = config.showTimer
  if (config.showRound !== undefined) updateData.show_round = config.showRound
  if (config.showRecords !== undefined) updateData.show_records = config.showRecords
  if (config.showAvatars !== undefined) updateData.show_avatars = config.showAvatars
  if (config.showTournamentName !== undefined) updateData.show_tournament_name = config.showTournamentName
  if (config.primaryColor !== undefined) updateData.primary_color = config.primaryColor
  if (config.accentColor !== undefined) updateData.accent_color = config.accentColor
  if (config.backgroundOpacity !== undefined) updateData.background_opacity = config.backgroundOpacity

  // Upsert overlay config
  const { error } = await supabase
    .from("match_overlays")
    .upsert({
      match_id: matchId,
      ...updateData,
      updated_at: new Date().toISOString(),
    }, { onConflict: "match_id" })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/tournaments`)
  return { success: true }
}

// ==========================================
// VOD ARCHIVE SYSTEM
// ==========================================

export interface VODData {
  id?: string
  tournamentId: string
  matchId?: string
  title: string
  description?: string
  platform: "youtube" | "twitch" | "kick" | "custom"
  videoUrl: string
  thumbnailUrl?: string
  durationSeconds?: number
  roundNumber?: number
  isFeatured?: boolean
  isHighlight?: boolean
  player1Id?: string
  player2Id?: string
  recordedAt?: string
}

// Add a VOD to a tournament
export async function addTournamentVod(data: VODData): Promise<{ success?: boolean; vodId?: string; error?: string }> {
  const supabase = await createClient()
  const auth = await requireTournamentOrganizer(data.tournamentId)
  if ("error" in auth) return { error: auth.error }

  const { data: vod, error } = await supabase
    .from("tournament_vods")
    .insert({
      tournament_id: data.tournamentId,
      match_id: data.matchId || null,
      title: data.title,
      description: data.description || null,
      platform: data.platform,
      video_url: data.videoUrl,
      thumbnail_url: data.thumbnailUrl || null,
      duration_seconds: data.durationSeconds || null,
      round_number: data.roundNumber || null,
      is_featured: data.isFeatured || false,
      is_highlight: data.isHighlight || false,
      player1_id: data.player1Id || null,
      player2_id: data.player2Id || null,
      recorded_at: data.recordedAt || null,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/esports/tournaments`)
  return { success: true, vodId: vod.id }
}

// Update a VOD
export async function updateTournamentVod(
  vodId: string,
  data: Partial<VODData>
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  
  // Get VOD to verify tournament access
  const { data: vod } = await supabase
    .from("tournament_vods")
    .select("tournament_id")
    .eq("id", vodId)
    .single()

  if (!vod) return { error: "VOD not found" }

  const auth = await requireTournamentOrganizer(vod.tournament_id)
  if ("error" in auth) return { error: auth.error }

  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.platform !== undefined) updateData.platform = data.platform
  if (data.videoUrl !== undefined) updateData.video_url = data.videoUrl
  if (data.thumbnailUrl !== undefined) updateData.thumbnail_url = data.thumbnailUrl
  if (data.durationSeconds !== undefined) updateData.duration_seconds = data.durationSeconds
  if (data.isFeatured !== undefined) updateData.is_featured = data.isFeatured
  if (data.isHighlight !== undefined) updateData.is_highlight = data.isHighlight

  const { error } = await supabase
    .from("tournament_vods")
    .update(updateData)
    .eq("id", vodId)

  if (error) return { error: error.message }

  revalidatePath(`/esports/tournaments`)
  return { success: true }
}

// Delete a VOD
export async function deleteTournamentVod(vodId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  
  const { data: vod } = await supabase
    .from("tournament_vods")
    .select("tournament_id")
    .eq("id", vodId)
    .single()

  if (!vod) return { error: "VOD not found" }

  const auth = await requireTournamentOrganizer(vod.tournament_id)
  if ("error" in auth) return { error: auth.error }

  const { error } = await supabase
    .from("tournament_vods")
    .delete()
    .eq("id", vodId)

  if (error) return { error: error.message }

  revalidatePath(`/esports/tournaments`)
  return { success: true }
}

// Get VODs for a tournament
export async function getTournamentVods(tournamentId: string) {
  const supabase = await createClient()

  const { data: vods } = await supabase
    .from("tournament_vods")
    .select(`
      *,
      player1:profiles!tournament_vods_player1_id_fkey(id, first_name, last_name, avatar_url),
      player2:profiles!tournament_vods_player2_id_fkey(id, first_name, last_name, avatar_url)
    `)
    .eq("tournament_id", tournamentId)
    .order("published_at", { ascending: false })

  return vods || []
}

// Get featured VODs across all tournaments
export async function getFeaturedVods(limit: number = 6) {
  const supabase = await createClient()

  const { data: vods } = await supabase
    .from("tournament_vods")
    .select(`
      *,
      tournaments(id, name, slug, games(name, slug)),
      player1:profiles!tournament_vods_player1_id_fkey(id, first_name, last_name, avatar_url),
      player2:profiles!tournament_vods_player2_id_fkey(id, first_name, last_name, avatar_url)
    `)
    .eq("is_featured", true)
    .order("published_at", { ascending: false })
    .limit(limit)

  return vods || []
}

// Get recent VODs
export async function getRecentVods(limit: number = 12) {
  const supabase = await createClient()

  const { data: vods } = await supabase
    .from("tournament_vods")
    .select(`
      *,
      tournaments(id, name, slug, games(name, slug)),
      player1:profiles!tournament_vods_player1_id_fkey(id, first_name, last_name, avatar_url),
      player2:profiles!tournament_vods_player2_id_fkey(id, first_name, last_name, avatar_url)
    `)
    .order("published_at", { ascending: false })
    .limit(limit)

  return vods || []
}

// Add timestamp/chapter to a VOD
export async function addVodTimestamp(
  vodId: string,
  label: string,
  timestampSeconds: number,
  description?: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  
  const { data: vod } = await supabase
    .from("tournament_vods")
    .select("tournament_id")
    .eq("id", vodId)
    .single()

  if (!vod) return { error: "VOD not found" }

  const auth = await requireTournamentOrganizer(vod.tournament_id)
  if ("error" in auth) return { error: auth.error }

  const { error } = await supabase
    .from("vod_timestamps")
    .insert({
      vod_id: vodId,
      label,
      timestamp_seconds: timestampSeconds,
      description: description || null,
    })

  if (error) return { error: error.message }

  revalidatePath(`/esports/tournaments`)
  return { success: true }
}

// Get timestamps for a VOD
export async function getVodTimestamps(vodId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("vod_timestamps")
    .select("*")
    .eq("vod_id", vodId)
    .order("timestamp_seconds", { ascending: true })

  return data || []
}

// ==========================================
// ENGAGEMENT SYSTEM
// ==========================================

// Track viewer session
export async function trackViewerSession(
  matchId: string,
  sessionId: string
): Promise<{ sessionId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check for existing active session
  const { data: existing } = await supabase
    .from("match_viewer_sessions")
    .select("id")
    .eq("match_id", matchId)
    .eq("session_id", sessionId)
    .is("ended_at", null)
    .single()

  if (existing) {
    // Update last ping
    await supabase
      .from("match_viewer_sessions")
      .update({ last_ping_at: new Date().toISOString() })
      .eq("id", existing.id)
    return { sessionId: existing.id }
  }

  // Create new session
  const { data: session, error } = await supabase
    .from("match_viewer_sessions")
    .insert({
      match_id: matchId,
      user_id: user?.id || null,
      session_id: sessionId,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  return { sessionId: session.id }
}

// End viewer session
export async function endViewerSession(
  matchId: string,
  sessionId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("match_viewer_sessions")
    .update({ 
      ended_at: new Date().toISOString(),
    })
    .eq("match_id", matchId)
    .eq("session_id", sessionId)
    .is("ended_at", null)

  if (error) return { error: error.message }
  return { success: true }
}

// Get viewer count for a match
export async function getMatchViewerCount(matchId: string): Promise<number> {
  const supabase = await createClient()
  
  const cutoff = new Date(Date.now() - 60000).toISOString() // 60 seconds ago

  const { count } = await supabase
    .from("match_viewer_sessions")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId)
    .is("ended_at", null)
    .gte("last_ping_at", cutoff)

  return count || 0
}

// Add reaction to a match
export async function addMatchReaction(
  matchId: string,
  reactionType: "fire" | "shocked" | "clap" | "sad" | "laugh",
  sessionId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from("match_reactions")
    .insert({
      match_id: matchId,
      user_id: user?.id || null,
      session_id: sessionId,
      reaction_type: reactionType,
    })

  if (error) return { error: error.message }
  return { success: true }
}

// Get reaction counts for a match
export async function getMatchReactionCounts(matchId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("match_reaction_counts")
    .select("*")
    .eq("match_id", matchId)
    .single()

  return data || {
    fire_count: 0,
    shocked_count: 0,
    clap_count: 0,
    sad_count: 0,
    laugh_count: 0,
    total_count: 0,
  }
}

// Send chat message
export async function sendChatMessage(
  matchId: string,
  message: string
): Promise<{ success?: boolean; messageId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Must be logged in to chat" }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url")
    .eq("id", user.id)
    .single()

  const displayName = profile 
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Anonymous"
    : "Anonymous"

  // Check if user is a caster/moderator for this match
  const { data: match } = await supabase
    .from("tournament_matches")
    .select("round_id, tournament_rounds(tournament_id)")
    .eq("id", matchId)
    .single()

  let isCaster = false
  let isModerator = false
  
  if (match) {
    const tournamentId = (match.tournament_rounds as any)?.tournament_id
    if (tournamentId) {
      const { data: staff } = await supabase
        .from("staff_roles")
        .select("role")
        .eq("user_id", user.id)
        .single()
      
      if (staff?.role) {
        isModerator = ["owner", "manager", "organizer"].includes(staff.role)
        isCaster = staff.role === "caster" || isModerator
      }
    }
  }

  const { data: msg, error } = await supabase
    .from("match_chat_messages")
    .insert({
      match_id: matchId,
      user_id: user.id,
      display_name: displayName,
      avatar_url: profile?.avatar_url || null,
      message: message.slice(0, 500),
      is_caster: isCaster,
      is_moderator: isModerator,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  return { success: true, messageId: msg.id }
}

// Get chat messages for a match
export async function getMatchChatMessages(matchId: string, limit: number = 50) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("match_chat_messages")
    .select("*")
    .eq("match_id", matchId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit)

  return (data || []).reverse()
}

// Follow a player
export async function followPlayer(playerId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Must be logged in to follow" }
  if (user.id === playerId) return { error: "Cannot follow yourself" }

  const { error } = await supabase
    .from("player_follows")
    .insert({
      follower_id: user.id,
      player_id: playerId,
    })

  if (error) {
    if (error.code === "23505") return { error: "Already following this player" }
    return { error: error.message }
  }

  revalidatePath(`/players`)
  return { success: true }
}

// Unfollow a player
export async function unfollowPlayer(playerId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Must be logged in" }

  const { error } = await supabase
    .from("player_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("player_id", playerId)

  if (error) return { error: error.message }

  revalidatePath(`/players`)
  return { success: true }
}

// Check if following a player
export async function isFollowingPlayer(playerId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false

  const { data } = await supabase
    .from("player_follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("player_id", playerId)
    .single()

  return !!data
}

// Get followed players
export async function getFollowedPlayers() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data } = await supabase
    .from("player_follows")
    .select(`
      player_id,
      profiles!player_follows_player_id_fkey(
        id, first_name, last_name, avatar_url, follower_count
      )
    `)
    .eq("follower_id", user.id)
    .order("created_at", { ascending: false })

  return data?.map(d => d.profiles) || []
}

// Get trending matches
export async function getTrendingMatches(limit: number = 10) {
  const supabase = await createClient()

  // Get live feature matches with engagement data
  const { data: matches } = await supabase
    .from("tournament_matches")
    .select(`
      id, player1_id, player2_id, player1_wins, player2_wins, draws,
      status, table_number, is_feature_match, stream_url, stream_platform,
      viewer_count, total_reactions, peak_viewer_count,
      tournament_rounds(
        round_number,
        tournament_phases(
          tournaments(id, name, slug, games(name, slug))
        )
      )
    `)
    .eq("is_feature_match", true)
    .in("status", ["pending", "in_progress", "player1_reported", "player2_reported"])
    .order("viewer_count", { ascending: false })
    .limit(limit)

  if (!matches) return []

  // Get player profiles
  const playerIds = new Set<string>()
  matches.forEach(m => {
    if (m.player1_id) playerIds.add(m.player1_id)
    if (m.player2_id) playerIds.add(m.player2_id)
  })

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", Array.from(playerIds))

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

  return matches.map(m => {
    const tournament = (m.tournament_rounds as any)?.tournament_phases?.tournaments
    return {
      id: m.id,
      player1: profileMap.get(m.player1_id!) || null,
      player2: profileMap.get(m.player2_id!) || null,
      player1Wins: m.player1_wins,
      player2Wins: m.player2_wins,
      status: m.status,
      streamUrl: m.stream_url,
      streamPlatform: m.stream_platform,
      viewerCount: m.viewer_count || 0,
      totalReactions: m.total_reactions || 0,
      roundNumber: (m.tournament_rounds as any)?.round_number,
      tournament: tournament ? {
        id: tournament.id,
        name: tournament.name,
        slug: tournament.slug,
        gameName: tournament.games?.name,
      } : null,
    }
  })
}

// ==========================================
// TRENDING SYSTEM
// ==========================================

export type TrendingBadge = "hot" | "rising" | "chat_exploding" | "peak_viewers" | "clutch_moment" | "upset_alert"

export interface TrendingMatch {
  id: string
  player1: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null
  player2: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null
  player1Wins: number
  player2Wins: number
  status: string
  streamUrl: string | null
  streamPlatform: string | null
  viewerCount: number
  reactionsPerMinute: number
  chatPerMinute: number
  viewerVelocity: number
  trendingScore: number
  trendingBadge: TrendingBadge | null
  momentumBadge: MomentumBadge | null
  momentumStreak: number
  leadChanges: number
  isDecidingGame: boolean
  roundNumber: number | null
  tournament: {
  id: string
  name: string
  slug: string
  gameName: string | null
  } | null
  }

// Get trending matches with full metrics
export async function getTrendingMatchesWithMetrics(limit: number = 10): Promise<TrendingMatch[]> {
  const supabase = await createClient()

  const { data: matches } = await supabase
    .from("tournament_matches")
    .select(`
      id, player1_id, player2_id, player1_wins, player2_wins,
      status, stream_url, stream_platform,
      viewer_count, reactions_per_minute, chat_per_minute, viewer_velocity,
      trending_score, trending_badge,
      momentum_badge, momentum_streak, lead_changes, is_deciding_game,
      tournament_rounds(
        round_number,
        tournament_phases(
          tournaments(id, name, slug, games(name))
        )
      )
    `)
    .eq("is_feature_match", true)
    .in("status", ["pending", "in_progress", "player1_reported", "player2_reported"])
    .order("trending_score", { ascending: false })
    .limit(limit)

  if (!matches || matches.length === 0) return []

  // Get player profiles
  const playerIds = new Set<string>()
  matches.forEach(m => {
    if (m.player1_id) playerIds.add(m.player1_id)
    if (m.player2_id) playerIds.add(m.player2_id)
  })

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", Array.from(playerIds))

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

  return matches.map(m => {
    const tournament = (m.tournament_rounds as any)?.tournament_phases?.tournaments
    return {
      id: m.id,
      player1: profileMap.get(m.player1_id!) || null,
      player2: profileMap.get(m.player2_id!) || null,
      player1Wins: m.player1_wins || 0,
      player2Wins: m.player2_wins || 0,
      status: m.status,
      streamUrl: m.stream_url,
      streamPlatform: m.stream_platform,
      viewerCount: m.viewer_count || 0,
      reactionsPerMinute: Number(m.reactions_per_minute) || 0,
      chatPerMinute: Number(m.chat_per_minute) || 0,
      viewerVelocity: m.viewer_velocity || 0,
      trendingScore: Number(m.trending_score) || 0,
      trendingBadge: m.trending_badge as TrendingBadge | null,
      momentumBadge: (m as any).momentum_badge as MomentumBadge | null,
      momentumStreak: (m as any).momentum_streak || 0,
      leadChanges: (m as any).lead_changes || 0,
      isDecidingGame: (m as any).is_deciding_game || false,
      roundNumber: (m.tournament_rounds as any)?.round_number || null,
      tournament: tournament ? {
        id: tournament.id,
        name: tournament.name,
        slug: tournament.slug,
        gameName: tournament.games?.name || null,
      } : null,
    }
  })
}

// Get trending tournaments
export async function getTrendingTournaments(limit: number = 5) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("tournaments")
    .select(`
      id, name, slug, status, current_round,
      trending_score, total_viewers, total_reactions,
      games(name, slug),
      participants:tournament_participants(count)
    `)
    .eq("status", "in_progress")
    .order("trending_score", { ascending: false })
    .limit(limit)

  return data?.map(t => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    currentRound: t.current_round,
    trendingScore: Number(t.trending_score) || 0,
    totalViewers: t.total_viewers || 0,
    totalReactions: t.total_reactions || 0,
    gameName: (t.games as any)?.name || null,
    participantCount: (t.participants as any)?.[0]?.count || 0,
  })) || []
}

// Update trending metrics for a match (call periodically)
export async function refreshMatchTrending(matchId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.rpc("update_match_trending_metrics", { p_match_id: matchId })

  if (error) return { error: error.message }
  return { success: true }
}

// Get live stats summary
export async function getLiveStats() {
  const supabase = await createClient()

  const cutoff = new Date(Date.now() - 60000).toISOString()

  const [
    { count: activeViewers },
    { count: liveMatches },
    { count: liveTournaments }
  ] = await Promise.all([
    supabase
      .from("match_viewer_sessions")
      .select("*", { count: "exact", head: true })
      .is("ended_at", null)
      .gte("last_ping_at", cutoff),
    supabase
      .from("tournament_matches")
      .select("*", { count: "exact", head: true })
      .eq("is_feature_match", true)
      .in("status", ["in_progress", "player1_reported", "player2_reported"]),
    supabase
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_progress"),
  ])

  return {
    activeViewers: activeViewers || 0,
    liveMatches: liveMatches || 0,
    liveTournaments: liveTournaments || 0,
  }
}

// ==========================================
// MOMENTUM SYSTEM
// ==========================================

export type MomentumBadge = "on_fire" | "comeback" | "clutch_game" | "final_game" | "upset_brewing" | "dominant"

export interface MatchMomentum {
  momentumPlayerId: string | null
  momentumStreak: number
  leadChanges: number
  comebackPlayerId: string | null
  maxDeficitOvercome: number
  isDecidingGame: boolean
  momentumBadge: MomentumBadge | null
}

// Record a game result and recalculate momentum
export async function recordGameResult(
  matchId: string,
  gameNumber: number,
  winnerId: string
): Promise<{ success?: boolean; momentum?: MatchMomentum; error?: string }> {
  const supabase = await createClient()
  
  // Get current match state
  const { data: match } = await supabase
    .from("tournament_matches")
    .select("player1_id, player2_id, player1_wins, player2_wins")
    .eq("id", matchId)
    .single()
  
  if (!match) return { error: "Match not found" }
  
  // Calculate new scores
  const player1Score = winnerId === match.player1_id 
    ? (match.player1_wins || 0) + 1 
    : (match.player1_wins || 0)
  const player2Score = winnerId === match.player2_id 
    ? (match.player2_wins || 0) + 1 
    : (match.player2_wins || 0)
  
  // Insert game result
  const { error: insertError } = await supabase
    .from("match_game_results")
    .upsert({
      match_id: matchId,
      game_number: gameNumber,
      winner_id: winnerId,
      player1_score: player1Score,
      player2_score: player2Score,
    }, { onConflict: "match_id,game_number" })
  
  if (insertError) return { error: insertError.message }
  
  // Recalculate momentum
  const { error: momentumError } = await supabase.rpc("calculate_match_momentum", { p_match_id: matchId })
  if (momentumError) console.error("Momentum calculation error:", momentumError)
  
  // Check for auto-feature
  await supabase.rpc("check_auto_feature_match", { p_match_id: matchId })
  
  // Get updated momentum
  const { data: updated } = await supabase
    .from("tournament_matches")
    .select("momentum_player_id, momentum_streak, lead_changes, comeback_player_id, max_deficit_overcome, is_deciding_game, momentum_badge")
    .eq("id", matchId)
    .single()
  
  revalidatePath(`/esports/tournaments`)
  
  return {
    success: true,
    momentum: updated ? {
      momentumPlayerId: updated.momentum_player_id,
      momentumStreak: updated.momentum_streak || 0,
      leadChanges: updated.lead_changes || 0,
      comebackPlayerId: updated.comeback_player_id,
      maxDeficitOvercome: updated.max_deficit_overcome || 0,
      isDecidingGame: updated.is_deciding_game || false,
      momentumBadge: updated.momentum_badge as MomentumBadge | null,
    } : undefined,
  }
}

// Get match momentum data
export async function getMatchMomentum(matchId: string): Promise<MatchMomentum | null> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("tournament_matches")
    .select(`
      momentum_player_id, momentum_streak, lead_changes, 
      comeback_player_id, max_deficit_overcome, is_deciding_game, momentum_badge,
      momentum_player:profiles!tournament_matches_momentum_player_id_fkey(id, first_name, last_name),
      comeback_player:profiles!tournament_matches_comeback_player_id_fkey(id, first_name, last_name)
    `)
    .eq("id", matchId)
    .single()
  
  if (!data) return null
  
  return {
    momentumPlayerId: data.momentum_player_id,
    momentumStreak: data.momentum_streak || 0,
    leadChanges: data.lead_changes || 0,
    comebackPlayerId: data.comeback_player_id,
    maxDeficitOvercome: data.max_deficit_overcome || 0,
    isDecidingGame: data.is_deciding_game || false,
    momentumBadge: data.momentum_badge as MomentumBadge | null,
  }
}

// Get game history for a match
export async function getMatchGameHistory(matchId: string) {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("match_game_results")
    .select(`
      *,
      winner:profiles!match_game_results_winner_id_fkey(id, first_name, last_name, avatar_url)
    `)
    .eq("match_id", matchId)
    .order("game_number", { ascending: true })
  
  return data || []
}

// Get auto-feature config for a tournament
export async function getAutoFeatureConfig(tournamentId?: string) {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("auto_feature_config")
    .select("*")
    .or(`tournament_id.eq.${tournamentId},tournament_id.is.null`)
    .order("tournament_id", { nullsFirst: false })
    .limit(1)
    .single()
  
  return data
}

// Update auto-feature config
export async function updateAutoFeatureConfig(
  tournamentId: string | null,
  config: {
    enabled?: boolean
    trendingScoreThreshold?: number
    viewerThreshold?: number
    reactionRateThreshold?: number
    maxAutoFeatures?: number
    notifyOnAutoFeature?: boolean
  }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (config.enabled !== undefined) updateData.enabled = config.enabled
  if (config.trendingScoreThreshold !== undefined) updateData.trending_score_threshold = config.trendingScoreThreshold
  if (config.viewerThreshold !== undefined) updateData.viewer_threshold = config.viewerThreshold
  if (config.reactionRateThreshold !== undefined) updateData.reaction_rate_threshold = config.reactionRateThreshold
  if (config.maxAutoFeatures !== undefined) updateData.max_auto_features = config.maxAutoFeatures
  if (config.notifyOnAutoFeature !== undefined) updateData.notify_on_auto_feature = config.notifyOnAutoFeature
  
  const { error } = await supabase
    .from("auto_feature_config")
    .upsert({
      tournament_id: tournamentId,
      ...updateData,
    }, { onConflict: "tournament_id" })
  
  if (error) return { error: error.message }
  return { success: true }
}

// ==========================================
// VIEWER ENGAGEMENT SYSTEM
// ==========================================

export type ReactionType = "hype" | "gg" | "clutch" | "sadge" | "pog" | "lul" | "fire" | "skull"

// Send a reaction to a match
export async function sendMatchReaction(
  matchId: string,
  reactionType: ReactionType,
  sessionId?: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from("match_reactions")
    .insert({
      match_id: matchId,
      user_id: user?.id || null,
      reaction_type: reactionType,
      session_id: sessionId || null,
    })

  if (error) return { error: error.message }
  return { success: true }
}

// Get recent reactions for a match
export async function getMatchReactions(matchId: string, limit: number = 50) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("match_reactions")
    .select("id, reaction_type, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(limit)

  return data || []
}

// Get reaction counts for a match
export async function getReactionCounts(matchId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("match_reactions")
    .select("reaction_type")
    .eq("match_id", matchId)

  const counts: Record<string, number> = {}
  data?.forEach((r) => {
    counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1
  })

  return counts
}

// Make a prediction
export async function makeMatchPrediction(
  matchId: string,
  predictedWinnerId: string,
  predictedScore?: string,
  confidence?: number
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to make predictions" }

  // Check if match has already started
  const { data: match } = await supabase
    .from("tournament_matches")
    .select("status")
    .eq("id", matchId)
    .single()

  if (match?.status !== "pending") {
    return { error: "Match has already started" }
  }

  const { error } = await supabase
    .from("match_predictions")
    .upsert({
      match_id: matchId,
      user_id: user.id,
      predicted_winner_id: predictedWinnerId,
      predicted_score: predictedScore || null,
      confidence: confidence || 50,
    }, { onConflict: "match_id,user_id" })

  if (error) return { error: error.message }
  return { success: true }
}

// Get predictions for a match
export async function getMatchPredictions(matchId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("match_predictions")
    .select(`
      *,
      user:profiles(id, first_name, last_name, avatar_url),
      predicted_winner:profiles!match_predictions_predicted_winner_id_fkey(id, first_name, last_name)
    `)
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })

  return data || []
}

// Get user's prediction for a match
export async function getUserPrediction(matchId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("match_predictions")
    .select("*")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .single()

  return data
}

// Update viewer presence (heartbeat)
export async function updateViewerPresence(
  matchId: string,
  sessionId?: string
): Promise<{ viewerCount?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Upsert viewer presence
  if (user) {
    await supabase
      .from("match_viewers")
      .upsert({
        match_id: matchId,
        user_id: user.id,
        session_id: null,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "match_id,user_id" })
  } else if (sessionId) {
    await supabase
      .from("match_viewers")
      .upsert({
        match_id: matchId,
        user_id: null,
        session_id: sessionId,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "match_id,session_id" })
  }

  // Get current viewer count
  const { count } = await supabase
    .from("match_viewers")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId)
    .gte("last_seen_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())

  // Update peak viewers if needed
  if (count) {
    await supabase.rpc("update_peak_viewers", { p_match_id: matchId, p_count: count })
  }

  return { viewerCount: count || 0 }
}

// Get prediction leaderboard
export async function getPredictionLeaderboard(limit: number = 10) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, prediction_points, predictions_correct, predictions_total")
    .gt("predictions_total", 0)
    .order("prediction_points", { ascending: false })
    .limit(limit)

  return data || []
}

// Get match engagement stats
export async function getMatchEngagement(matchId: string) {
  const supabase = await createClient()

  const [
    { count: viewerCount },
    { count: reactionCount },
    { count: predictionCount },
    { data: match }
  ] = await Promise.all([
    supabase
      .from("match_viewers")
      .select("*", { count: "exact", head: true })
      .eq("match_id", matchId)
      .gte("last_seen_at", new Date(Date.now() - 2 * 60 * 1000).toISOString()),
    supabase
      .from("match_reactions")
      .select("*", { count: "exact", head: true })
      .eq("match_id", matchId),
    supabase
      .from("match_predictions")
      .select("*", { count: "exact", head: true })
      .eq("match_id", matchId),
    supabase
      .from("tournament_matches")
      .select("hype_score, peak_viewers")
      .eq("id", matchId)
      .single()
  ])

  return {
    viewers: viewerCount || 0,
    reactions: reactionCount || 0,
    predictions: predictionCount || 0,
    hypeScore: match?.hype_score || 0,
    peakViewers: match?.peak_viewers || 0,
  }
}
