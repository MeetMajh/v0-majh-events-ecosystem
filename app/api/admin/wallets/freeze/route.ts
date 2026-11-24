import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { requireStaffRoute } from "@/lib/auth/require-staff-route"

/**
 * POST /api/admin/wallets/freeze
 * 
 * Freeze or unfreeze a user's wallet
 */
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
    const { userId, action, reason } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    if (!action || !["freeze", "unfreeze"].includes(action)) {
      return NextResponse.json({ error: "Action must be 'freeze' or 'unfreeze'" }, { status: 400 })
    }

    if (action === "freeze" && (!reason || reason.trim().length < 10)) {
      return NextResponse.json({ error: "Freeze reason is required (min 10 characters)" }, { status: 400 })
    }

    if (action === "freeze") {
      const { data: result, error: rpcError } = await supabase.rpc("freeze_user_wallet", {
        p_user_id: userId,
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
          error: result?.error || "Failed to freeze wallet" 
        }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: "Wallet frozen successfully",
        user_id: result.user_id,
        balance_frozen: result.balance_frozen
      })
    } else {
      const { data: result, error: rpcError } = await supabase.rpc("unfreeze_user_wallet", {
        p_user_id: userId,
        p_admin_id: user.id
      })

      if (rpcError) {
        console.error("RPC error:", rpcError)
        return NextResponse.json({ error: rpcError.message }, { status: 500 })
      }

      if (!result?.success) {
        return NextResponse.json({ 
          success: false,
          error: result?.error || "Failed to unfreeze wallet" 
        }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: "Wallet unfrozen successfully",
        user_id: result.user_id
      })
    }

  } catch (error) {
    console.error("Wallet freeze error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
