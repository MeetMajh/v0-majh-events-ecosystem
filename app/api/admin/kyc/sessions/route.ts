import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check admin access
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single()

  if (!staffRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") || "all"
  const search = searchParams.get("search") || ""

  let query = supabase
    .from("kyc_sessions")
    .select(`
      id,
      user_id,
      stripe_session_id,
      status,
      risk_score,
      risk_signals,
      document_type,
      document_country,
      created_at,
      completed_at,
      profiles!inner(id, username, display_name, email, kyc_status)
    `)
    .order("created_at", { ascending: false })
    .limit(50)

  if (status !== "all") {
    query = query.eq("status", status)
  }

  if (search) {
    query = query.or(`profiles.username.ilike.%${search}%,profiles.display_name.ilike.%${search}%,profiles.email.ilike.%${search}%`)
  }

  const { data: sessions, error } = await query

  if (error) {
    console.error("[Admin KYC Sessions] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sessions: sessions || [] })
}
