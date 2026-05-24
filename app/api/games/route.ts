import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("games")
    .select("id, name, slug, icon_url")
    .eq("is_active", true)
    .order("name")

  if (error) {
    // If table doesn't exist, return empty array
    console.error("Error fetching games:", error)
    return NextResponse.json({ data: [] })
  }

  // Map icon_url to logo_url for compatibility
  const mappedData = (data || []).map(game => ({
    ...game,
    logo_url: game.icon_url
  }))

  return NextResponse.json({ data: mappedData })
}
