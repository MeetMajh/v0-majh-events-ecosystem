import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Get user profile
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("id", user.id)
    .single()

  // Get matches where user is player1 or player2
  const { data: userMatches, error: matchError } = await supabase
    .from("tournament_matches")
    .select("id, tournament_id, player1_id, player2_id, status, result")
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .limit(20)

  // Get recent matches (to compare player IDs)
  const { data: recentMatches } = await supabase
    .from("tournament_matches")
    .select("id, player1_id, player2_id, tournament_id")
    .order("created_at", { ascending: false })
    .limit(10)

  // Get Test 9 tournament specifically
  const { data: test9Tournament } = await supabase
    .from("tournaments")
    .select("id, name, status")
    .ilike("name", "%test 9%")
    .single()

  // If we found Test 9, get its matches
  let test9Matches = null
  if (test9Tournament) {
    const { data: matches } = await supabase
      .from("tournament_matches")
      .select("id, player1_id, player2_id, status")
      .eq("tournament_id", test9Tournament.id)
    test9Matches = matches
  }

  // Get user's registrations by player_id
  const { data: registrations } = await supabase
    .from("tournament_registrations")
    .select("id, tournament_id, player_id, user_id, status")
    .eq("player_id", user.id)
    .limit(10)

  // Also try by user_id (the column might be named differently)
  const { data: registrationsByUserId } = await supabase
    .from("tournament_registrations")
    .select("id, tournament_id, player_id, user_id, status")
    .eq("user_id", user.id)
    .limit(10)

  // Get Test 9 registrations specifically (to see what player_ids are used)
  let test9Registrations = null
  if (test9Tournament) {
    const { data: regs } = await supabase
      .from("tournament_registrations")
      .select("id, tournament_id, player_id, user_id, status, profiles!inner(id, first_name, last_name)")
      .eq("tournament_id", test9Tournament.id)
    test9Registrations = regs
  }

  // Get tournament IDs from matches
  const tournamentIds = [...new Set(userMatches?.map(m => m.tournament_id).filter(Boolean) || [])]

  return NextResponse.json({
    authUserId: user.id,
    userEmail: user.email,
    userProfile,
    matchesForUser: {
      count: userMatches?.length ?? 0,
      error: matchError?.message,
      matches: userMatches
    },
    recentMatchesSample: recentMatches?.map(m => ({
      id: m.id,
      player1_id: m.player1_id,
      player2_id: m.player2_id,
      tournament_id: m.tournament_id
    })),
    test9Tournament,
    test9Matches: test9Matches?.map(m => ({
      id: m.id,
      player1_id: m.player1_id,
      player2_id: m.player2_id,
      status: m.status,
      isUserPlayer1: m.player1_id === user.id,
      isUserPlayer2: m.player2_id === user.id
    })),
    registrationsByPlayerId: registrations,
    registrationsByUserId: registrationsByUserId,
    test9Registrations: test9Registrations?.map(r => ({
      id: r.id,
      player_id: r.player_id,
      user_id: r.user_id,
      status: r.status,
      profile: r.profiles
    })),
    tournamentIdsFromMatches: tournamentIds,
    analysis: {
      userIdMatchesInTest9: test9Matches?.some(m => m.player1_id === user.id || m.player2_id === user.id) ?? false,
      samplePlayer1Id: recentMatches?.[0]?.player1_id,
      idsMatch: recentMatches?.[0]?.player1_id === user.id,
      userFoundInTest9Registrations: test9Registrations?.some(r => r.player_id === user.id || r.user_id === user.id) ?? false
    }
  }, { status: 200 })
}
