import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// PATCH - Approve or deny request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const body = await request.json()
    const { action, role, resource_scopes, notes } = body
    
    if (!action || !["approve", "deny"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'deny'" }, { status: 400 })
    }
    
    if (action === "approve") {
      const { data: result, error } = await supabase.rpc("approve_access_request", {
        p_request_id: requestId,
        p_reviewer_id: user.id,
        p_role_key: role || null,
        p_resource_scopes: resource_scopes || [],
        p_notes: notes || null,
      })
      
      if (error) {
        console.error("[v0] Error approving request:", error)
        return NextResponse.json({ error: "Failed to approve request" }, { status: 500 })
      }
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      
      return NextResponse.json(result)
    } else {
      const { data: result, error } = await supabase.rpc("deny_access_request", {
        p_request_id: requestId,
        p_reviewer_id: user.id,
        p_notes: notes || null,
      })
      
      if (error) {
        console.error("[v0] Error denying request:", error)
        return NextResponse.json({ error: "Failed to deny request" }, { status: 500 })
      }
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      
      return NextResponse.json(result)
    }
  } catch (error) {
    console.error("[v0] Request action API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
