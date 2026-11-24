import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { requireStaffRoute } from "@/lib/auth/require-staff-route"

export async function GET(req: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Tier: "manager". Technical/operational authority; financial reads.
  const guard = await requireStaffRoute("manager")
  if (!guard.ok) return guard.response
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
      profiles!inner(username, display_name)
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
    // email dropped from the search for the same reason as the select above.
    query = query.or(`legal_name.ilike.%${search}%,profiles.username.ilike.%${search}%`)
  }

  const { data: forms, error } = await query

  if (error) {
    console.error("[Admin Tax Forms] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ forms: forms || [] })
}
