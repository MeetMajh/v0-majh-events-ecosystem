import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: "Not authenticated",
        authError: authError?.message 
      }, { status: 401 })
    }

    // Step 1: Check matches where user is player1 or player2
    const { data: userMatches, error: matchError } = await adminClient
      .from("tournament_matches")
      .select(`
        id,
        player1_id,
        player2_id,
        status,
        created_at,
        tournament_rounds (
          id,
          tournament_id,
          round_number
        )
      `)
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .limit(20)

    // Step 2: Get sample of ALL recent matches to see what player IDs look like
    const { data: sampleMatches, error: sampleError } = await adminClient
      .from("tournament_matches")
      .select("id, player1_id, player2_id, created_at")
      .order("created_at", { ascending: false })
      .limit(10)

    // Step 3: Check registrations for this user
    const { data: userRegistrations, error: regError } = await adminClient
      .from("tournament_registrations")
      .select("*")
      .eq("player_id", user.id)
      .limit(20)

    // Step 4: Get sample of ALL registrations to see what player_ids look like
    const { data: sampleRegistrations, error: sampleRegError } = await adminClient
      .from("tournament_registrations")
      .select("id, player_id, tournament_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10)

    // Step 5: Check if user has a profile
    const { data: userProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    // Step 6: Get tournaments that have any matches
    const tournamentIds = new Set<string>()
    sampleMatches?.forEach(m => {
      if (m.player1_id === user.id || m.player2_id === user.id) {
        // This shouldn't happen since userMatches query found nothing, but check anyway
      }
    })

    // Step 7: Check if there are any tournaments in progress
    const { data: activeTournaments } = await adminClient
      .from("tournaments")
      .select("id, name, status")
      .eq("status", "in_progress")
      .limit(5)

    // Step 8: For active tournaments, check their matches
    const activeMatchData: any[] = []
    for (const tournament of activeTournaments ?? []) {
      const { data: tournamentMatches } = await adminClient
        .from("tournament_matches")
        .select(`
          id, 
          player1_id, 
          player2_id,
          tournament_rounds!inner (tournament_id)
        `)
        .eq("tournament_rounds.tournament_id", tournament.id)
        .limit(5)
      
      activeMatchData.push({
        tournament: tournament.name,
        tournamentId: tournament.id,
        matchCount: tournamentMatches?.length ?? 0,
        samplePlayerIds: tournamentMatches?.map(m => ({ p1: m.player1_id, p2: m.player2_id }))
      })
    }

    return NextResponse.json({
      success: true,
      currentUser: {
        id: user.id,
        email: user.email
      },
      userProfile: {
        exists: !!userProfile,
        error: profileError?.message,
        data: userProfile
      },
      matchesForUser: {
        count: userMatches?.length ?? 0,
        error: matchError?.message,
        data: userMatches
      },
      registrationsForUser: {
        count: userRegistrations?.length ?? 0,
        error: regError?.message,
        data: userRegistrations
      },
      sampleAllMatches: {
        count: sampleMatches?.length ?? 0,
        error: sampleError?.message,
        data: sampleMatches?.map(m => ({
          id: m.id,
          player1_id: m.player1_id,
          player2_id: m.player2_id,
          isCurrentUser: m.player1_id === user.id || m.player2_id === user.id
        }))
      },
      sampleAllRegistrations: {
        count: sampleRegistrations?.length ?? 0,
        error: sampleRegError?.message,
        data: sampleRegistrations?.map(r => ({
          id: r.id,
          player_id: r.player_id,
          tournament_id: r.tournament_id,
          isCurrentUser: r.player_id === user.id
        }))
      },
      activeTournaments: {
        count: activeTournaments?.length ?? 0,
        data: activeMatchData
      }
    })
  } catch (err: any) {
    return NextResponse.json({ 
      error: err.message,
      stack: err.stack
    }, { status: 500 })
  }
}
