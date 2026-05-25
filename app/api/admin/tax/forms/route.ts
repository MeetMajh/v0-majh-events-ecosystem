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
  const status = searchParams.get("status") || "submitted"
  const year = searchParams.get("year") || "all"
  const search = searchParams.get("search") || ""

  let query = supabase
    .from("tax_forms")
    .select(`
      id,
      user_id,
      form_type,
      tax_year,
      legal_name,
      business_name,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      ssn_last_four,
      signature_date,
      certification_accepted,
      status,
      created_at,
      verified_at,
      profiles!inner(username, display_name, email)
    `)
    .order("created_at", { ascending: false })
    .limit(50)

  if (status !== "all") {
    query = query.eq("status", status)
  }

  if (year !== "all") {
    query = query.eq("tax_year", parseInt(year))
  }

  if (search) {
    query = query.or(`legal_name.ilike.%${search}%,profiles.username.ilike.%${search}%,profiles.email.ilike.%${search}%`)
  }

  const { data: forms, error } = await query

  if (error) {
    console.error("[Admin Tax Forms] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ forms: forms || [] })
}
