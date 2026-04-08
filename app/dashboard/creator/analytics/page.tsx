import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getCreatorOverview, getBestTimeToPost } from "@/lib/clip-analytics-actions"
import { CreatorAnalyticsDashboard } from "@/components/creator/analytics-dashboard"

export const metadata = { title: "Creator Analytics | Dashboard" }

export default async function CreatorAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")

  // Get player profile for this user
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <h1 className="text-2xl font-bold mb-2">No Creator Profile</h1>
        <p className="text-muted-foreground">
          You need a player profile to access creator analytics.
        </p>
      </div>
    )
  }

  const [overview, bestTimes] = await Promise.all([
    getCreatorOverview(player.id),
    getBestTimeToPost(player.id)
  ])

  if (!overview) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <h1 className="text-2xl font-bold mb-2">No Analytics Data</h1>
        <p className="text-muted-foreground">
          Upload some clips to see your analytics.
        </p>
      </div>
    )
  }

  return (
    <CreatorAnalyticsDashboard 
      overview={overview} 
      bestTimes={bestTimes}
      creatorId={player.id}
    />
  )
}
