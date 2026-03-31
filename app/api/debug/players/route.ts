import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  
  // Get all players with their user info
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select(`
      id,
      user_id,
      tournament_id,
      tournaments (id, name, status)
    `)
    .order("created_at", { ascending: false })
    .limit(50)

  // Get all tournament_participants for comparison
  const { data: participants, error: participantsError } = await supabase
    .from("tournament_participants")
    .select(`
      id,
      user_id,
      tournament_id,
      tournaments (id, name, status)
    `)
    .order("created_at", { ascending: false })
    .limit(50)

  // Get profiles to map user IDs to names
  const userIds = [...new Set([
    ...(players || []).map(p => p.user_id),
    ...(participants || []).map(p => p.user_id)
  ])].filter(Boolean)

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", userIds.length > 0 ? userIds : ["none"])

  const profileMap = new Map(
    (profiles || []).map(p => [p.id, p])
  )

  return NextResponse.json({
    players: (players || []).map(p => ({
      player_id: p.id,
      user_id: p.user_id,
      tournament_id: p.tournament_id,
      tournament_name: p.tournaments?.name,
      tournament_status: p.tournaments?.status,
      user_name: profileMap.get(p.user_id) 
        ? `${profileMap.get(p.user_id)?.first_name} ${profileMap.get(p.user_id)?.last_name}`
        : "Unknown",
      user_email: profileMap.get(p.user_id)?.email
    })),
    playersError,
    participants: (participants || []).map(p => ({
      participant_id: p.id,
      user_id: p.user_id,
      tournament_id: p.tournament_id,
      tournament_name: p.tournaments?.name,
      tournament_status: p.tournaments?.status,
      user_name: profileMap.get(p.user_id)
        ? `${profileMap.get(p.user_id)?.first_name} ${profileMap.get(p.user_id)?.last_name}`
        : "Unknown",
      user_email: profileMap.get(p.user_id)?.email
    })),
    participantsError,
    summary: {
      totalPlayers: players?.length || 0,
      totalParticipants: participants?.length || 0,
      uniqueUsersInPlayers: [...new Set((players || []).map(p => p.user_id))].length,
      uniqueUsersInParticipants: [...new Set((participants || []).map(p => p.user_id))].length,
    }
  })
}
