import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * GET /api/admin/controls
 * 
 * Get all system control settings
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check admin access
    const { data: staffRole } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "manager"])
      .single()

    if (!staffRole) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { data: controls, error } = await supabase
      .from("system_controls")
      .select("*")
      .order("control_type")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      controls: controls || []
    })

  } catch (error) {
    console.error("System controls fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/controls
 * 
 * Toggle system control (kill switch, circuit breaker, etc.)
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check admin access - only owner can toggle controls
    const { data: staffRole } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .single()

    if (!staffRole) {
      return NextResponse.json({ error: "Owner access required for system controls" }, { status: 403 })
    }

    const { controlType, enabled, reason, thresholdValue } = await req.json()

    if (!controlType) {
      return NextResponse.json({ error: "Control type is required" }, { status: 400 })
    }

    // Handle threshold update
    if (thresholdValue !== undefined) {
      const { data, error: updateError } = await supabase
        .from("system_controls")
        .update({ 
          threshold_value: thresholdValue,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq("control_type", controlType)
        .select()
        .single()

      if (updateError) {
        console.error("Threshold update error:", updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Threshold ${controlType} updated to ${thresholdValue}`,
        control: data
      })
    }

    // Handle toggle
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Enabled must be a boolean" }, { status: 400 })
    }

    // Use atomic RPC for toggle
    const { data: result, error: rpcError } = await supabase.rpc("toggle_system_control", {
      p_control_type: controlType,
      p_enabled: enabled,
      p_admin_id: user.id,
      p_reason: reason || null
    })

    if (rpcError) {
      console.error("RPC error:", rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    if (!result?.success) {
      return NextResponse.json({ 
        success: false,
        error: result?.error || "Failed to toggle control" 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `System control ${controlType} ${enabled ? "enabled" : "disabled"}`,
      control_type: result.control_type,
      is_enabled: result.is_enabled
    })

  } catch (error) {
    console.error("System control toggle error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
