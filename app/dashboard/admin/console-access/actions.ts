"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

/**
 * The admin-console toggle.
 *
 * None of these actions decides anything. Each calls a database function
 * that checks `can_delegate_admin_capability` before it writes, so the
 * authority to appoint lives in one place and a screen cannot widen it:
 *
 *   - PLATFORM_OWNER and PLATFORM_ADMIN always hold the capability, so the
 *     platform can never lock itself out of its own console.
 *   - TENANT_OWNER holds it by default, being the highest tenant-level role.
 *   - Anyone else holds it only by grant, and that grant is the owner's to
 *     give.
 *   - A grantee may use the access. They may not pass it on unless an owner
 *     marked their grant delegable, and only an owner or a platform role can
 *     do that — so authority to appoint never leaks downward one grant at a
 *     time.
 *
 * Errors are returned rather than thrown so the page can show the database's
 * own sentence, which is more useful than a generic failure.
 */

const CAPABILITY = "admin_console"

export async function grantConsoleAccess(formData: FormData) {
  const supabase = await createClient()
  const userId = String(formData.get("user_id") || "")
  if (!userId) return { error: "Choose somebody first." }

  const { error } = await supabase.rpc("grant_admin_capability", {
    p_user: userId,
    p_capability: CAPABILITY,
    p_tenant: String(formData.get("tenant_id") || "") || null,
    p_can_delegate: formData.get("can_delegate") === "on",
    p_note: String(formData.get("note") || "") || null,
  })
  if (error) return { error: error.message }

  revalidatePath("/dashboard/admin/console-access")
  return { ok: true }
}

export async function grantConsoleAccessForm(formData: FormData): Promise<void> {
  await grantConsoleAccess(formData)
}

export async function revokeConsoleAccessForm(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const userId = String(formData.get("user_id") || "")
  const reason = String(formData.get("reason") || "").trim()
  // A reason is required by the function itself: a withdrawal of access to
  // payout approval and the audit log should always be explicable later.
  if (!userId || !reason) return

  await supabase.rpc("revoke_admin_capability", {
    p_user: userId,
    p_capability: CAPABILITY,
    p_tenant: String(formData.get("tenant_id") || "") || null,
    p_reason: reason,
  })
  revalidatePath("/dashboard/admin/console-access")
}
