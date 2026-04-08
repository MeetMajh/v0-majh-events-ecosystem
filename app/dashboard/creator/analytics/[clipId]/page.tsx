import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { getClipAnalytics } from "@/lib/clip-analytics-actions"
import { ClipAnalyticsDetail } from "@/components/creator/clip-analytics-detail"

export const metadata = { title: "Clip Analytics | Dashboard" }

export default async function ClipAnalyticsPage({
  params
}: {
  params: Promise<{ clipId: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")

  const { clipId } = await params
  const analytics = await getClipAnalytics(clipId)

  if (!analytics) {
    notFound()
  }

  return <ClipAnalyticsDetail analytics={analytics} />
}
