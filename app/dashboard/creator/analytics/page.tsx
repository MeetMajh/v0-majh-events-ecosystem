import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getCreatorOverview, getBestTimeToPost } from "@/lib/clip-analytics-actions"
import { CreatorAnalyticsDashboard } from "@/components/creator/analytics-dashboard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserPlus, TrendingUp, Video, Users } from "lucide-react"
import Link from "next/link"

export const metadata = { title: "Creator Analytics | Dashboard" }

export default async function CreatorAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")

  // Get user profile - all users can be creators via their profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", user.id)
    .single()

  // Check if user has any uploaded media (indicates they're using creator features)
  const { count: mediaCount } = await supabase
    .from("player_media")
    .select("id", { count: "exact", head: true })
    .eq("player_id", user.id)

  if (!profile || mediaCount === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4">
        <Card className="border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Become a Creator</CardTitle>
            <CardDescription className="text-base">
              Create your player profile to unlock creator analytics, upload clips, and track your growth.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4 py-4">
              <div className="text-center">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-2">
                  <Video className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Upload Clips</p>
                <p className="text-xs text-muted-foreground">Share your best moments</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Track Stats</p>
                <p className="text-xs text-muted-foreground">Views, likes, engagement</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Grow Audience</p>
                <p className="text-xs text-muted-foreground">Build your following</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <Button asChild size="lg" className="w-full">
                <Link href="/dashboard/media/upload">
                  <Video className="h-5 w-5 mr-2" />
                  Upload Your First Clip
                </Link>
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Upload clips from your tournaments and matches to start tracking your creator analytics.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const [overview, bestTimes] = await Promise.all([
    getCreatorOverview(user.id),
    getBestTimeToPost(user.id)
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
      creatorId={user.id}
    />
  )
}
