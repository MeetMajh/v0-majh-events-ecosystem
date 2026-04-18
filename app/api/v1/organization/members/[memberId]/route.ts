import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const body = await request.json()
    const { role, is_active, display_name, title, department } = body
    
    // If changing role, use RPC
    if (role) {
      const { data: result, error } = await supabase.rpc("update_member_role", {
        p_member_id: memberId,
        p_new_role: role,
        p_updater_id: user.id,
      })
      
      if (error) {
        console.error("[v0] Error updating role:", error)
        return NextResponse.json({ error: "Failed to update role" }, { status: 500 })
      }
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      
      return NextResponse.json(result)
    }
    
    // For other updates, direct update
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (is_active !== undefined) updates.is_active = is_active
    if (display_name !== undefined) updates.display_name = display_name
    if (title !== undefined) updates.title = title
    if (department !== undefined) updates.department = department
    
    const { error } = await supabase
      .from("organization_members")
      .update(updates)
      .eq("id", memberId)
    
    if (error) {
      console.error("[v0] Error updating member:", error)
      return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Member update API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Soft delete - set is_active to false
    const { error } = await supabase
      .from("organization_members")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", memberId)
    
    if (error) {
      console.error("[v0] Error removing member:", error)
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Member delete API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
