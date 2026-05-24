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

  // Fetch audit logs - query without joins first for reliability
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
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(100)

  // Fetch profile info separately for reliability
  const userIds = [...new Set([
    ...(auditLogs?.map(l => l.user_id).filter(Boolean) || []),
    ...(auditLogs?.map(l => l.performed_by).filter(Boolean) || [])
  ])]

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", userIds.length > 0 ? userIds : [""])

  const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || [])

  // Merge profiles into logs
  const enrichedLogs = auditLogs?.map(log => ({
    ...log,
    profiles: log.user_id ? profilesMap.get(log.user_id) || null : null,
    admin: log.performed_by ? profilesMap.get(log.performed_by) || null : null,
  })) || []

  return <AuditLogViewer logs={enrichedLogs} />
}
