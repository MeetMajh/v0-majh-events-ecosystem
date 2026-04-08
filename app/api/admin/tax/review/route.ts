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

  const { formId, action, rejectionReason } = await req.json()

  if (!formId || !action) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  if (action !== "verify" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const newStatus = action === "verify" ? "verified" : "rejected"

  // Get the form to update user profile
  const { data: form } = await supabase
    .from("tax_forms")
    .select("user_id")
    .eq("id", formId)
    .single()

  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 })
  }

  // Update tax form
  const formUpdate: Record<string, any> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (action === "verify") {
    formUpdate.verified_at = new Date().toISOString()
  }

  const { error: formError } = await supabase
    .from("tax_forms")
    .update(formUpdate)
    .eq("id", formId)

  if (formError) {
    console.error("[Admin Tax Review] Form update error:", formError)
    return NextResponse.json({ error: formError.message }, { status: 500 })
  }

  // Update user profile tax status
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      tax_form_status: newStatus,
    })
    .eq("id", form.user_id)

  if (profileError) {
    console.error("[Admin Tax Review] Profile update error:", profileError)
    // Don't fail the request, just log
  }

  return NextResponse.json({ success: true, status: newStatus })
}
