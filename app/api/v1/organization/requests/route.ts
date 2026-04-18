import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - List pending access requests (for admins)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Get user's tenant
    const { data: membership } = await supabase
      .from("organization_members")
      .select("tenant_id, role_key")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()
    
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 })
    }
    
    // Check permission
    const { data: hasPermission } = await supabase.rpc("has_permission", {
      p_user_id: user.id,
      p_tenant_id: membership.tenant_id,
      p_permission_key: "team.requests",
    })
    
    if (!hasPermission) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }
    
    // Get pending requests
    const { data: requests, error } = await supabase
      .rpc("get_pending_access_requests", { p_tenant_id: membership.tenant_id })
    
    if (error) {
      console.error("[v0] Error fetching requests:", error)
      return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 })
    }
    
    return NextResponse.json({ requests: requests || [] })
  } catch (error) {
    console.error("[v0] Requests API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Submit access request (for users)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const body = await request.json()
    const { tenant_id, requested_role, entity_type, entity_name, message } = body
    
    if (!tenant_id || !requested_role) {
      return NextResponse.json({ error: "Tenant ID and requested role are required" }, { status: 400 })
    }
    
    // Submit request via RPC
    const { data: result, error } = await supabase.rpc("request_access", {
      p_tenant_id: tenant_id,
      p_user_id: user.id,
      p_requested_role: requested_role,
      p_entity_type: entity_type || "individual",
      p_entity_name: entity_name || null,
      p_message: message || null,
    })
    
    if (error) {
      console.error("[v0] Error submitting request:", error)
      return NextResponse.json({ error: "Failed to submit request" }, { status: 500 })
    }
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Request submit API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
