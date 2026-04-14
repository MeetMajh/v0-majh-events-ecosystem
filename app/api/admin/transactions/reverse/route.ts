import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * POST /api/admin/transactions/reverse
 * 
 * Reverses a financial transaction by creating an equal and opposite entry.
 * This is the correct way to undo money - never delete or edit.
 * 
 * Required:
 * - transactionId: UUID of the transaction to reverse
 * - reason: Text explanation for audit trail (required)
 * 
 * Returns:
 * - success: boolean
 * - reversalId: UUID of the new reversal transaction
 * - previousBalance: cents before reversal
 * - newBalance: cents after reversal
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    
    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { transactionId, reason } = await req.json()

    // Validate inputs
    if (!transactionId) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 })
    }

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json({ 
        error: "Reason is required and must be at least 10 characters for audit compliance" 
      }, { status: 400 })
    }

    // Call the atomic reversal function
    const { data, error } = await supabase.rpc("reverse_transaction", {
      p_transaction_id: transactionId,
      p_reason: reason.trim(),
      p_admin_id: user.id,
    })

    if (error) {
      console.error("Reversal RPC error:", error)
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 400 })
    }

    // The RPC returns a JSON object
    if (!data.success) {
      return NextResponse.json({ 
        success: false, 
        error: data.error || "Reversal failed" 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      reversalId: data.reversalId,
      previousBalance: data.previousBalance,
      newBalance: data.newBalance,
      message: "Transaction reversed successfully"
    })

  } catch (error) {
    console.error("Reversal endpoint error:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 })
  }
}
