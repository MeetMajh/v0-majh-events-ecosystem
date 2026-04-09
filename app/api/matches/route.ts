import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const isFeature = searchParams.get("feature") === "true"
  
  const supabase = await createClient()

  let query = supabase
    .from("matches")
    .select(`
      id,
      round_number,
      table_number,
      status,
      player1_score,
      player2_score,
      player1:profiles!matches_player1_id_fkey(id, display_name),
      player2:profiles!matches_player2_id_fkey(id, display_name),
      tournament:tournaments(id, name, slug)
    `)
    .in("status", ["in_progress", "pending"])
    .order("created_at", { ascending: false })
    .limit(10)

  if (isFeature) {
    query = query.eq("is_featured", true)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching matches:", error)
    return NextResponse.json({ data: [] })
  }

  // Transform data for the frontend
  const matches = (data || []).map((m: any) => ({
    id: m.id,
    round_number: m.round_number,
    table_number: m.table_number,
    status: m.status,
    player1_name: m.player1?.display_name || "TBD",
    player2_name: m.player2?.display_name || "TBD",
    player1_score: m.player1_score,
    player2_score: m.player2_score,
    tournament_name: m.tournament?.name || "Unknown Tournament",
    tournament_slug: m.tournament?.slug,
  }))

  return NextResponse.json({ data: matches })
}
