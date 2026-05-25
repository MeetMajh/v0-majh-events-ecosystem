import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TeamManagement } from "@/components/team/team-management"

export const metadata = {
  title: "Team Management | MAJH Events",
  description: "Manage your organization team members, roles, and access requests",
}

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect("/login")
  }
  
  // Get user's tenant and permissions
  const { data: membership } = await supabase
    .from("organization_members")
    .select("tenant_id, role_key")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single()
  
  let tenantId = membership?.tenant_id
  let userRole = membership?.role_key
  
  if (!tenantId) {
    // Fallback to legacy
    const { data: legacyMembership } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single()
    
    if (!legacyMembership) {
      return (
        <div className="flex min-h-[400px] items-center justify-center">
          <p className="text-muted-foreground">No organization found. Please contact support.</p>
        </div>
      )
    }
    
    tenantId = legacyMembership.tenant_id
    userRole = legacyMembership.role
  }
  
  // Get tenant info
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("id", tenantId)
    .single()
  
  return (
    <div className="container mx-auto py-6">
      <TeamManagement 
        tenantId={tenantId} 
        tenantName={tenant?.name || "Organization"}
        currentUserId={user.id}
        currentUserRole={userRole || "member"}
      />
    </div>
  )
}
