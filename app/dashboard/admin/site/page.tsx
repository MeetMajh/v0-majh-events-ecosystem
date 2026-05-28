import { requireStaff } from "@/lib/auth/require-staff"
import { getHomepageSections, getSiteInfo } from "@/lib/site-settings-actions"
import { HomepageEditor } from "@/components/admin/homepage-editor"

export const metadata = {
  title: "Site Settings | MAJH EVENTS",
  description: "Manage homepage layout and site-wide settings",
}

export default async function SiteSettingsPage() {
  await requireStaff("manager")
  
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
