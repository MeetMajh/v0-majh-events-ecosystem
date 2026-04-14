import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check admin/staff access
    const { data: staffRole } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "manager"])
      .single()

    if (!staffRole) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { escrowId } = await req.json()

    if (!escrowId) {
      return NextResponse.json({ error: "Escrow ID is required" }, { status: 400 })
    }

    // Get the escrow account
    const { data: escrow, error: fetchError } = await supabase
      .from("escrow_accounts")
      .select("*, tournaments(title)")
      .eq("id", escrowId)
      .eq("status", "funded")
      .single()

    if (fetchError || !escrow) {
      return NextResponse.json({ error: "Escrow not found or not in funded status" }, { status: 404 })
    }

    // Update escrow status to released
    const { error: updateError } = await supabase
      .from("escrow_accounts")
      .update({ status: "released" })
      .eq("id", escrowId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log to audit trail
    await supabase
      .from("reconciliation_audit_log")
      .insert({
        action_type: "escrow_release",
        target_type: "escrow",
        target_id: escrowId,
        performed_by: user.id,
        amount_cents: escrow.funded_amount_cents,
        reason: `Manual release by admin for tournament: ${escrow.tournaments?.title || escrow.tournament_id}`,
        status: "completed",
        is_test_data: escrow.is_test,
      })

    return NextResponse.json({
      success: true,
      message: "Escrow released successfully",
      amount: escrow.funded_amount_cents
    })

  } catch (error) {
    console.error("Escrow release error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
