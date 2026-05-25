import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - Get current user's permissions
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
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()
    
    let tenantId = membership?.tenant_id
    
    if (!tenantId) {
      // Fallback to legacy
      const { data: legacyMembership } = await supabase
        .from("tenant_memberships")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .single()
      
      if (!legacyMembership) {
        return NextResponse.json({ 
          role: "none",
          permissions: [],
          is_member: false 
        })
      }
      
      // Legacy role mapping
      const legacyPermissions: Record<string, string[]> = {
        owner: ["*"],
        admin: ["events.view", "events.create", "events.edit", "tickets.view", "tickets.manage", "team.view", "team.invite"],
        member: ["events.view", "announcements.view"],
      }
      
      return NextResponse.json({
        role: legacyMembership.role,
        permissions: legacyPermissions[legacyMembership.role] || [],
        is_member: true,
        legacy: true,
      })
    }
    
    // Get permissions via RPC
    const { data: permissions, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: user.id,
      p_tenant_id: tenantId,
    })
    
    if (error) {
      console.error("[v0] Error fetching permissions:", error)
      return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 })
    }
    
    return NextResponse.json(permissions)
  } catch (error) {
    console.error("[v0] Permissions API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Check specific permission
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const body = await request.json()
    const { permission, resource_type, resource_id } = body
    
    if (!permission) {
      return NextResponse.json({ error: "Permission key is required" }, { status: 400 })
    }
    
    // Get user's tenant
    const { data: membership } = await supabase
      .from("organization_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()
    
    if (!membership) {
      return NextResponse.json({ allowed: false, reason: "No organization membership" })
    }
    
    // Check permission via RPC
    const { data: allowed, error } = await supabase.rpc("has_permission", {
      p_user_id: user.id,
      p_tenant_id: membership.tenant_id,
      p_permission_key: permission,
      p_resource_type: resource_type || null,
      p_resource_id: resource_id || null,
    })
    
    if (error) {
      console.error("[v0] Error checking permission:", error)
      return NextResponse.json({ error: "Failed to check permission" }, { status: 500 })
    }
    
    return NextResponse.json({ allowed, permission })
  } catch (error) {
    console.error("[v0] Permission check API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
