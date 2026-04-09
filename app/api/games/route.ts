import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("games")
    .select("id, name, logo_url, slug")
    .eq("is_active", true)
    .order("name")

  if (error) {
    // If table doesn't exist, return empty array
    console.error("Error fetching games:", error)
    return NextResponse.json({ data: [] })
  }

  return NextResponse.json({ data: data || [] })
}
