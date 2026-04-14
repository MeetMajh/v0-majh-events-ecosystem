import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AuditLogViewer } from "@/components/control-panel/audit-log-viewer"

export default async function AuditLogPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Check admin/staff access
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single()

  if (!staffRole) redirect("/dashboard")

  // Fetch audit logs
  const { data: auditLogs } = await supabase
    .from("reconciliation_audit_log")
    .select(`
      id,
      action_type,
      target_type,
      target_id,
      user_id,
      performed_by,
      amount_cents,
      previous_balance_cents,
      new_balance_cents,
      reason,
      documentation,
      is_test_data,
      environment,
      status,
      created_at,
      profiles:user_id (
        display_name,
        email
      ),
      admin:performed_by (
        display_name,
        email
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100)

  return <AuditLogViewer logs={auditLogs || []} />
}
