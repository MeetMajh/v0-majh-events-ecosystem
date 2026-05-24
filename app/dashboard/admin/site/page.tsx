import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getHomepageSections, getSiteInfo } from "@/lib/site-settings-actions"
import { HomepageEditor } from "@/components/admin/homepage-editor"

export const metadata = {
  title: "Site Settings | MAJH EVENTS",
  description: "Manage homepage layout and site-wide settings",
}

export default async function SiteSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect("/auth/sign-in")
  }
  
  // Check if user is owner/manager
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()
  
  if (!staffRole || !["owner", "manager"].includes(staffRole.role)) {
    redirect("/dashboard")
  }
  
  const [sections, siteInfo] = await Promise.all([
    getHomepageSections(),
    getSiteInfo(),
  ])
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Site Settings</h1>
        <p className="text-muted-foreground">
          Customize the homepage layout and site-wide settings
        </p>
      </div>
      
      <HomepageEditor 
        initialSections={sections} 
        initialSiteInfo={siteInfo} 
      />
    </div>
  )
}
