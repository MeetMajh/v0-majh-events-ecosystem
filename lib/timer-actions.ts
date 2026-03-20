"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

async function requireTournamentOrganizer(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("organizer_id")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return { error: "Tournament not found" }
  if (tournament.organizer_id !== user.id) {
    const { data: staff } = await supabase
      .from("tournament_staff")
      .select("role")
      .eq("tournament_id", tournamentId)
      .eq("user_id", user.id)
      .single()

    if (!staff) return { error: "Not authorized" }
  }

  return { supabase: createAdminClient(), userId: user.id }
}

export async function resetRoundTimer(tournamentId: string, roundId: string) {
  const auth = await requireTournamentOrganizer(tournamentId)
  if ("error" in auth) return auth
  const { supabase, userId } = auth

  const { data: round } = await supabase
    .from("tournament_rounds")
    .select("time_limit_minutes, status")
    .eq("id", roundId)
    .single()

  if (!round) return { error: "Round not found" }
  if (!round.time_limit_minutes) return { error: "Round has no time limit set" }

  const now = new Date()
  const newEndTime = new Date(now.getTime() + round.time_limit_minutes * 60 * 1000)

  const { error } = await supabase
    .from("tournament_rounds")
    .update({
      status: "active",
      end_time: newEndTime.toISOString(),
      paused_time_remaining_ms: null,
    })
    .eq("id", roundId)

  if (error) return { error: error.message }

  await supabase.from("tournament_announcements").insert({
    tournament_id: tournamentId,
    author_id: userId,
    message: `Round timer has been RESET to ${round.time_limit_minutes} minutes.`,
    priority: "high",
  })

  revalidatePath(`/dashboard/tournaments/${tournamentId}`)
  return { success: true, minutes: round.time_limit_minutes }
}
