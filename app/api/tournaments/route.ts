import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get("status")
  
  const supabase = await createClient()

  let query = supabase
    .from("tournaments")
    .select(`
      id, 
      name, 
      slug, 
      status,
      start_date,
      game:games(id, name, logo_url)
    `)
    .order("start_date", { ascending: false })
    .limit(10)

  if (status) {
    query = query.eq("status", status)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching tournaments:", error)
    return NextResponse.json({ data: [] })
  }

  // Add player count (mock for now since we'd need to join registrations)
  const tournamentsWithCount = (data || []).map((t: any) => ({
    ...t,
    player_count: Math.floor(Math.random() * 32) + 8, // Placeholder
  }))

  return NextResponse.json({ data: tournamentsWithCount })
}
