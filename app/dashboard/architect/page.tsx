import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ArchitectClient from "./architect-client"
import AIAssistantClient from "./ai-assistant-client"

export default async function ArchitectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?next=/dashboard/architect")
  }

  // Attempt to Verify platform/tenant executive authority via T-204 Organization Members
  let authorizedRole = null;
  const { data: orgRole } = await supabase
    .from("organization_members")
    .select("role_key")
    .eq("user_id", user.id)
    .in("role_key", ["PLATFORM_OWNER", "TENANT_OWNER", "TENANT_SUPER_ADMIN"])
    .single()

  if (orgRole) {
    authorizedRole = orgRole.role_key;
  } else {
    // Fallback: Check Legacy Profiles for Owner/Admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile && ["owner", "admin", "PLATFORM_OWNER"].includes(profile.role)) {
       authorizedRole = profile.role === "owner" ? "PLATFORM_OWNER (Legacy)" : "TENANT_ADMIN (Legacy)";
    }
  }

  if (!authorizedRole) {
    redirect("/dashboard?error=unauthorized_architect")
  }

  return (
    <main className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-7xl mx-auto p-6">
        {/* Page Header */}
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">MAJH Architect</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Database schema introspection, RLS validation, and AI-assisted engineering.
            </p>
          </div>
          <div className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 font-medium">
            Authorization: {authorizedRole}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Data Introspection */}
          <div className="lg:col-span-5">
            <div className="border border-border rounded-lg bg-card overflow-hidden h-[700px] flex flex-col">
              <ArchitectClient />
            </div>
          </div>

          {/* Right Column: AI Assistant */}
          <div className="lg:col-span-7">
            <AIAssistantClient />
          </div>
        </div>
      </div>
    </main>
  )
}
