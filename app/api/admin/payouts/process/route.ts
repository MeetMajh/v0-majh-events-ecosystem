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
      .from("organization_members")
      .select("role:role_key")
      .eq("user_id", user.id)
      .in("role", ["owner", "manager", "TENANT_OWNER", "TENANT_SUPER_ADMIN", "TENANT_MANAGER", "DEPARTMENT_MANAGER", "PLATFORM_OWNER"])
      .single()

    if (!staffRole) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { payoutId, processAll, tournamentId } = await req.json()

    if (!payoutId && !processAll) {
      return NextResponse.json({ error: "Payout ID or processAll flag is required" }, { status: 400 })
    }

    if (processAll) {
      // Use atomic batch RPC function
      const { data: result, error: rpcError } = await supabase.rpc("process_all_pending_payouts", {
        p_admin_id: user.id,
        p_tournament_id: tournamentId || null
      })

      if (rpcError) {
        console.error("RPC error:", rpcError)
        return NextResponse.json({ error: rpcError.message }, { status: 500 })
      }

      if (!result?.success) {
        return NextResponse.json({ 
          success: false,
          error: result?.error || "Failed to process payouts" 
        }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: `Successfully processed ${result.processed} payout(s)`,
        processed: result.processed,
        failed: result.failed,
        total_amount: result.total_amount
      })
    } else {
      // Use atomic single payout RPC function
      const { data: result, error: rpcError } = await supabase.rpc("process_payout", {
        p_payout_id: payoutId,
        p_admin_id: user.id
      })

      if (rpcError) {
        console.error("RPC error:", rpcError)
        return NextResponse.json({ error: rpcError.message }, { status: 500 })
      }

      if (!result?.success) {
        return NextResponse.json({ 
          success: false,
          error: result?.error || "Failed to process payout" 
        }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: "Payout processed successfully",
        payout_id: result.payout_id,
        user_id: result.user_id,
        amount: result.amount,
        new_balance: result.new_balance,
        transaction_id: result.transaction_id
      })
    }

  } catch (error) {
    console.error("Payout processing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
