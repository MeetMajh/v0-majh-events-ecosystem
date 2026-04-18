import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - Get available roles and permissions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get role templates
    const { data: roles, error: rolesError } = await supabase
      .from("organization_role_templates")
      .select("*")
      .order("sort_order")
    
    if (rolesError) {
      console.error("[v0] Error fetching roles:", rolesError)
      return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 })
    }
    
    // Get permission definitions
    const { data: permissions, error: permsError } = await supabase
      .from("permission_definitions")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true })
    
    if (permsError) {
      console.error("[v0] Error fetching permissions:", permsError)
      return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 })
    }
    
    // Get role-permission mappings
    const { data: rolePermissions, error: mappingError } = await supabase
      .from("role_template_permissions")
      .select("role_key, permission_key")
    
    if (mappingError) {
      console.error("[v0] Error fetching role permissions:", mappingError)
      return NextResponse.json({ error: "Failed to fetch role permissions" }, { status: 500 })
    }
    
    // Group permissions by role
    const permissionsByRole: Record<string, string[]> = {}
    rolePermissions?.forEach(({ role_key, permission_key }) => {
      if (!permissionsByRole[role_key]) {
        permissionsByRole[role_key] = []
      }
      permissionsByRole[role_key].push(permission_key)
    })
    
    // Group permissions by category
    const permissionsByCategory: Record<string, typeof permissions> = {}
    permissions?.forEach((perm) => {
      if (!permissionsByCategory[perm.category]) {
        permissionsByCategory[perm.category] = []
      }
      permissionsByCategory[perm.category].push(perm)
    })
    
    return NextResponse.json({
      roles: roles || [],
      permissions: permissions || [],
      permissions_by_category: permissionsByCategory,
      permissions_by_role: permissionsByRole,
    })
  } catch (error) {
    console.error("[v0] Roles API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
