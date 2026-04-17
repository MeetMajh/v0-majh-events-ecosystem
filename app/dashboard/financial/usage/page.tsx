import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { UsageBillingDashboard } from "@/components/financial/usage-billing-dashboard"

export const metadata = {
  title: "Usage & Billing | Financial Dashboard | MAJH Events",
  description: "View your plan usage and billing information",
}

export default async function UsagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // Get user's tenant membership
  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .single()

  if (!membership) {
    redirect("/dashboard/onboarding")
  }

  // Get tenant with subscription
  const { data: tenant } = await supabase
    .from("tenants")
    .select(`
      id,
      name,
      subscription_tier,
      max_api_calls_per_month,
      max_events_per_month,
      max_users
    `)
    .eq("id", membership.tenant_id)
    .single()

  // Get current subscription
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .eq("status", "active")
    .single()

  // Get pricing plan details
  const { data: plan } = await supabase
    .from("pricing_plans")
    .select("*")
    .eq("slug", tenant?.subscription_tier || "free")
    .single()

  // Get current month usage
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { data: usage } = await supabase
    .from("usage_records")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .gte("period_start", monthStart)
    .single()

  // Get recent invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: false })
    .limit(5)

  // Get API request count from logs this month
  const { count: apiCallsThisMonth } = await supabase
    .from("api_request_log")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", membership.tenant_id)
    .gte("created_at", monthStart)

  // Get team member count
  const { count: teamMemberCount } = await supabase
    .from("tenant_memberships")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", membership.tenant_id)

  // Transform tenant data to match component props
  const tenantForProps = tenant ? {
    id: tenant.id,
    name: tenant.name,
    subscription_tier: tenant.subscription_tier,
    max_api_calls: tenant.max_api_calls_per_month,
    max_events: tenant.max_events_per_month,
    max_users: tenant.max_users,
  } : null

  return (
    <UsageBillingDashboard
      tenant={tenantForProps}
      subscription={subscription}
      plan={plan}
      usage={{
        api_calls: apiCallsThisMonth || 0,
        events: usage?.events_created || 0,
        users: teamMemberCount || 0,
        storage_bytes: usage?.storage_bytes || 0,
      }}
      invoices={invoices || []}
    />
  )
}
