import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getAdsOverview, getCampaigns, getAdSets, getAds } from "@/lib/ads-manager-actions"
import { AdsManagerHeader } from "@/components/ads/ads-manager-header"
import { AdsManagerTabs } from "@/components/ads/ads-manager-tabs"
import { AdsDataTable } from "@/components/ads/ads-data-table"

export const metadata = { title: "Ads Manager | Dashboard" }

export default async function AdsManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; campaign?: string; adset?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")

  const params = await searchParams
  const activeTab = params.tab || "campaigns"

  // Get overview data
  const overview = await getAdsOverview()
  
  // Get data based on active tab
  let data: any[] = []
  let parentFilter: string | undefined
  
  if (activeTab === "campaigns") {
    data = await getCampaigns()
  } else if (activeTab === "adsets") {
    parentFilter = params.campaign
    data = await getAdSets(parentFilter)
  } else if (activeTab === "ads") {
    parentFilter = params.adset
    data = await getAds(parentFilter)
  }

  return (
    <div className="flex flex-col h-full">
      <AdsManagerHeader overview={overview} />
      
      <div className="flex-1 flex flex-col bg-background">
        <AdsManagerTabs activeTab={activeTab} />
        
        <div className="flex-1 p-4">
          <AdsDataTable 
            type={activeTab as "campaigns" | "adsets" | "ads"}
            data={data}
            parentFilter={parentFilter}
          />
        </div>
      </div>
    </div>
  )
}
