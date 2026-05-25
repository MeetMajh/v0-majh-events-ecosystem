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

    // Use atomic RPC function for withdrawal approval
    const { data: result, error: rpcError } = await supabase.rpc("approve_withdrawal", {
      p_withdrawal_id: withdrawalId,
      p_admin_id: user.id
    })

    if (rpcError) {
      console.error("RPC error:", rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    if (!result?.success) {
      return NextResponse.json({ 
        success: false,
        error: result?.error || "Failed to approve withdrawal" 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: "Withdrawal approved and processing initiated",
      withdrawal_id: result.withdrawal_id,
      amount: result.amount,
      user_id: result.user_id
    })

  } catch (error) {
    console.error("Withdrawal approval error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
