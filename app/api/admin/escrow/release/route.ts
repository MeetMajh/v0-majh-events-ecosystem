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

    // Use atomic RPC function for escrow release
    const { data: result, error: rpcError } = await supabase.rpc("release_escrow", {
      p_escrow_id: escrowId,
      p_admin_id: user.id
    })

    if (rpcError) {
      console.error("RPC error:", rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    if (!result?.success) {
      return NextResponse.json({ 
        success: false,
        error: result?.error || "Failed to release escrow" 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: "Escrow released successfully",
      escrow_id: result.escrow_id,
      tournament_id: result.tournament_id,
      released_amount: result.released_amount
    })

  } catch (error) {
    console.error("Escrow release error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
