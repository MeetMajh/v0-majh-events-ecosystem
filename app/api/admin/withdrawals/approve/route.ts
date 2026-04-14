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

    const { withdrawalId } = await req.json()

    if (!withdrawalId) {
      return NextResponse.json({ error: "Withdrawal ID is required" }, { status: 400 })
    }

    // Get the withdrawal to verify it exists and is pending
    const { data: withdrawal, error: fetchError } = await supabase
      .from("financial_transactions")
      .select("*, profiles:user_id(display_name, email)")
      .eq("id", withdrawalId)
      .eq("type", "withdrawal")
      .eq("status", "pending")
      .single()

    if (fetchError || !withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found or not pending" }, { status: 404 })
    }

    // Update to processing status
    const { error: updateError } = await supabase
      .from("financial_transactions")
      .update({ 
        status: "processing",
        description: withdrawal.description ? `${withdrawal.description} - Approved by admin` : "Approved by admin"
      })
      .eq("id", withdrawalId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log to audit trail
    await supabase
      .from("reconciliation_audit_log")
      .insert({
        action_type: "withdrawal_approved",
        target_type: "transaction",
        target_id: withdrawalId,
        user_id: withdrawal.user_id,
        performed_by: user.id,
        amount_cents: withdrawal.amount_cents,
        reason: "Manual approval by admin",
        status: "completed",
      })

    return NextResponse.json({
      success: true,
      message: "Withdrawal approved and processing initiated"
    })

  } catch (error) {
    console.error("Withdrawal approval error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
