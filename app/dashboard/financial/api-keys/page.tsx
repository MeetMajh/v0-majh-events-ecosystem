import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ApiKeysManager } from "@/components/financial/api-keys-manager"

export const metadata = {
  title: "API Keys | Financial Dashboard | MAJH Events",
  description: "Manage your API keys for developer access",
}

export default async function ApiKeysPage() {
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

  // Get API keys for this tenant
  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("id, key_prefix, name, environment, scopes, last_used_at, created_at, revoked_at")
    .eq("tenant_id", membership.tenant_id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })

  // Get revoked keys (for history)
  const { data: revokedKeys } = await supabase
    .from("api_keys")
    .select("id, key_prefix, name, environment, revoked_at")
    .eq("tenant_id", membership.tenant_id)
    .not("revoked_at", "is", null)
    .order("revoked_at", { ascending: false })
    .limit(10)

  return (
    <ApiKeysManager
      apiKeys={apiKeys || []}
      revokedKeys={revokedKeys || []}
      tenantId={membership.tenant_id}
      userRole={membership.role}
    />
  )
}
