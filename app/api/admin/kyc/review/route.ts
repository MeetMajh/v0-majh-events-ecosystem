import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { sessionId, userId, action, rejectionReason } = await req.json()

  if (!sessionId || !userId || !action) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const newStatus = action === "approve" ? "verified" : "rejected"

  // Update KYC session
  const { error: sessionError } = await supabase
    .from("kyc_sessions")
    .update({
      status: newStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)

  if (sessionError) {
    console.error("[Admin KYC Review] Session update error:", sessionError)
    return NextResponse.json({ error: sessionError.message }, { status: 500 })
  }

  // Update user profile
  const profileUpdate: Record<string, any> = {
    kyc_status: newStatus,
  }

  if (action === "reject" && rejectionReason) {
    profileUpdate.kyc_rejection_reason = rejectionReason
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId)

  if (profileError) {
    console.error("[Admin KYC Review] Profile update error:", profileError)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Create compliance alert for rejected verification
  if (action === "reject") {
    await supabase.from("compliance_alerts").insert({
      user_id: userId,
      alert_type: "kyc_rejected",
      severity: "medium",
      title: "KYC Verification Rejected",
      description: rejectionReason || "Identity verification was rejected by admin",
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolution_notes: `Admin rejected: ${rejectionReason}`,
    })
  }

  return NextResponse.json({ success: true, status: newStatus })
}
