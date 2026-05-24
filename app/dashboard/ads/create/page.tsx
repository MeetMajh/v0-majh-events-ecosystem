import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CreateCampaignWizard } from "@/components/ads/create-campaign-wizard"

export const metadata = { title: "Create Campaign | Ads Manager" }

export default async function CreateCampaignPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")

  // Get games for targeting
  const { data: games } = await supabase
    .from("games")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name")

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Create New Campaign</h1>
        <p className="text-sm text-muted-foreground mt-1">Set up your campaign, targeting, and creative</p>
      </div>
      
      <div className="flex-1 p-6 overflow-auto">
        <CreateCampaignWizard games={games || []} />
      </div>
    </div>
  )
}
