import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { requireStaffRoute } from "@/lib/auth/require-staff-route"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Tier: "owner". Moves money, so account authority only.
    const guard = await requireStaffRoute("owner")
    if (!guard.ok) return guard.response
    const { withdrawalId, reason } = await req.json()

    if (!withdrawalId) {
      return NextResponse.json({ error: "Withdrawal ID is required" }, { status: 400 })
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: "Rejection reason is required (min 5 characters)" }, { status: 400 })
    }

    // Use atomic RPC function for withdrawal rejection
    const { data: result, error: rpcError } = await supabase.rpc("reject_withdrawal", {
      p_withdrawal_id: withdrawalId,
      p_admin_id: user.id,
      p_reason: reason.trim()
    })

    if (rpcError) {
      console.error("RPC error:", rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    if (!result?.success) {
      return NextResponse.json({ 
        success: false,
        error: result?.error || "Failed to reject withdrawal" 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: "Withdrawal rejected and funds returned to wallet",
      withdrawal_id: result.withdrawal_id,
      refunded_amount: result.refunded_amount,
      new_balance: result.new_balance
    })

  } catch (error) {
    console.error("Withdrawal rejection error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
