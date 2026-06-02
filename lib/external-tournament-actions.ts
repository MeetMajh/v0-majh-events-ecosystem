"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { requireStaffAction } from "@/lib/auth/require-staff"
import { fetchTopDeckTournaments, mapTopDeckToExternal, TopDeckSearchParams } from "./topdeck-api"

/**
 * Get external tournaments from our database
 */
export async function getExternalTournaments(filters?: {
  game?: string
  source?: string
  startDate?: string
  endDate?: string
  limit?: number
}) {
  const supabase = await createClient()

  let query = supabase
    .from("external_tournaments")
    .select("*")
    .order("start_date", { ascending: true })

  if (filters?.game) {
    query = query.eq("game", filters.game)
  }
  if (filters?.source) {
    query = query.eq("source", filters.source)
  }
  if (filters?.startDate) {
    query = query.gte("start_date", filters.startDate)
  }
  if (filters?.endDate) {
    query = query.lte("start_date", filters.endDate)
  }
  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching external tournaments:", error)
    return []
  }

  return data || []
}

/**
 * Get upcoming external tournaments (next 30 days)
 */
export async function getUpcomingExternalTournaments(limit = 10) {
  const now = new Date().toISOString()
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  return getExternalTournaments({
    startDate: now,
    endDate: thirtyDaysLater,
    limit,
  })
}

/**
 * Sync tournaments from TopDeck.gg
 */
export async function syncTopDeckTournaments(params: TopDeckSearchParams = {}) {
  const { supabase } = await requireStaffAction("organizer")

  const { tournaments, total } = await fetchTopDeckTournaments({
    ...params,
    limit: params.limit || 50,
  })

  if (tournaments.length === 0) {
    return { success: true, synced: 0, message: "No tournaments found" }
  }

  const records = tournaments.map(mapTopDeckToExternal)

  const { error } = await supabase
    .from("external_tournaments")
    .upsert(records, {
      onConflict: "source,external_id",
      ignoreDuplicates: false,
    })

  if (error) {
    console.error("Error syncing tournaments:", error)
    return { error: error.message }
  }

  revalidatePath("/esports")
  revalidatePath("/dashboard/admin/tournaments")

  return {
    success: true,
    synced: tournaments.length,
    total,
    message: `Synced ${tournaments.length} tournaments from TopDeck.gg`,
  }
}

/**
 * Manually add an external tournament
 */
export async function addManualTournament(formData: FormData) {
  const { supabase } = await requireStaffAction("organizer")

  const name = formData.get("name") as string
  const externalId = `manual-${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

  const { error } = await supabase
    .from("external_tournaments")
    .insert({
      source: "manual",
      external_id: externalId,
      name,
      game: formData.get("game") as string,
      format: formData.get("format") as string || null,
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string || null,
      location: formData.get("location") as string || null,
      is_online: formData.get("is_online") === "on",
      entry_fee_cents: formData.get("entry_fee")
        ? Math.round(parseFloat(formData.get("entry_fee") as string) * 100)
        : null,
      max_players: formData.get("max_players")
        ? parseInt(formData.get("max_players") as string)
        : null,
      organizer_name: formData.get("organizer_name") as string || null,
      external_url: formData.get("external_url") as string || null,
      tournament_status: "upcoming",
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/esports")
  revalidatePath("/dashboard/admin/tournaments")

  return { success: true }
}

/**
 * Delete an external tournament
 */
export async function deleteExternalTournament(id: string) {
  const { supabase } = await requireStaffAction("manager")

  const { error } = await supabase
    .from("external_tournaments")
    .delete()
    .eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/esports")
  revalidatePath("/dashboard/admin/tournaments")

  return { success: true }
}
