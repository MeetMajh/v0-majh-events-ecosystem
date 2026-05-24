import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const username = searchParams.get("username")

  if (!username) {
    return NextResponse.json({ available: false, error: "Username is required" }, { status: 400 })
  }

  // Validate format
  const sanitized = username.toLowerCase().replace(/[^a-z0-9_-]/g, "")
  if (sanitized !== username.toLowerCase()) {
    return NextResponse.json({ 
      available: false, 
      error: "Username can only contain letters, numbers, underscores, and hyphens" 
    })
  }

  if (sanitized.length < 3) {
    return NextResponse.json({ available: false, error: "Username must be at least 3 characters" })
  }

  if (sanitized.length > 30) {
    return NextResponse.json({ available: false, error: "Username must be 30 characters or less" })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if username exists (excluding current user if logged in)
  let query = supabase
    .from("profiles")
    .select("id")
    .ilike("username", sanitized)

  if (user) {
    query = query.neq("id", user.id)
  }

  const { data: existingUser } = await query.single()

  if (existingUser) {
    return NextResponse.json({ available: false, error: "Username is already taken" })
  }

  return NextResponse.json({ available: true, username: sanitized })
}
