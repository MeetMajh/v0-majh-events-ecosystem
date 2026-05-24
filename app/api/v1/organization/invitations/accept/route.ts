import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Accept invitation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const body = await request.json()
    const { token } = body
    
    if (!token) {
      return NextResponse.json({ error: "Invitation token is required" }, { status: 400 })
    }
    
    // Accept invitation via RPC
    const { data: result, error } = await supabase.rpc("accept_invitation", {
      p_token: token,
      p_user_id: user.id,
    })
    
    if (error) {
      console.error("[v0] Error accepting invitation:", error)
      return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 })
    }
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Accept invitation API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
