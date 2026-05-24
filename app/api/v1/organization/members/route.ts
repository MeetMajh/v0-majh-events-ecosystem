import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateApiKey } from "@/lib/middleware/api-auth"

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
    
    if (!membership) {
      // Fallback to legacy tenant_memberships
      const { data: legacyMembership } = await supabase
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single()
      
      if (!legacyMembership) {
        return NextResponse.json({ error: "No organization found" }, { status: 404 })
      }
      
      // Return legacy members
      const { data: members } = await supabase
        .from("tenant_memberships")
        .select(`
          id,
          user_id,
          role,
          created_at,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq("tenant_id", legacyMembership.tenant_id)
      
      return NextResponse.json({ members, legacy: true })
    }
    
    // Get organization members via RPC
    const { data: members, error } = await supabase
      .rpc("get_organization_members", { p_tenant_id: membership.tenant_id })
    
    if (error) {
      console.error("[v0] Error fetching members:", error)
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }
    
    return NextResponse.json({ members: members || [] })
  } catch (error) {
    console.error("[v0] Members API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const body = await request.json()
    const { email, role, message, resource_scopes, custom_permissions } = body
    
    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 })
    }
    
    // Get user's tenant
    const { data: membership } = await supabase
      .from("organization_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()
    
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 })
    }
    
    // Invite member via RPC
    const { data: result, error } = await supabase.rpc("invite_organization_member", {
      p_tenant_id: membership.tenant_id,
      p_inviter_id: user.id,
      p_email: email,
      p_role_key: role,
      p_message: message || null,
      p_resource_scopes: resource_scopes || [],
      p_custom_permissions: custom_permissions || [],
    })
    
    if (error) {
      console.error("[v0] Error inviting member:", error)
      return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 })
    }
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Invite API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
