import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
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

    // Fetch escrow accounts with tournament details
    const { data: escrows, error } = await supabase
      .from("escrow_accounts")
      .select(`
        id,
        tournament_id,
        funded_amount_cents,
        released_amount_cents,
        status,
        funded_at,
        created_at,
        tournaments (
          id,
          name,
          status,
          start_date,
          prize_pool_cents
        )
      `)
      .in("status", ["pending", "funded", "partially_released", "disputed"])
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[Admin Escrow] Error fetching escrows:", error)
      return NextResponse.json({ error: "Failed to fetch escrow accounts" }, { status: 500 })
    }

    return NextResponse.json({ escrows: escrows || [] })
  } catch (error) {
    console.error("[Admin Escrow] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
