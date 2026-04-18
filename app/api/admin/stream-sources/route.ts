import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()

  // Direct query - no admin check needed for reading
  const { data, error } = await supabase
    .from("stream_sources")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching stream sources:", error)
    return NextResponse.json({ data: [], error: error.message })
  }

  return NextResponse.json({ data: data || [] })
}
