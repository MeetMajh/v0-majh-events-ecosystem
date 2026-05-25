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

    // Fetch pending payouts with related data
    const { data: payouts, error } = await supabase
      .from("player_payouts")
      .select(`
        id,
        user_id,
        tournament_id,
        gross_amount_cents,
        platform_fee_cents,
        net_amount_cents,
        placement,
        payout_method,
        status,
        created_at,
        profiles!player_payouts_user_id_fkey (
          display_name,
          avatar_url,
          kyc_verified,
          stripe_connect_status
        ),
        tournaments (
          name
        )
      `)
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[Admin Payouts] Error fetching payouts:", error)
      return NextResponse.json({ error: "Failed to fetch payouts" }, { status: 500 })
    }

    return NextResponse.json({ payouts: payouts || [] })
  } catch (error) {
    console.error("[Admin Payouts] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
