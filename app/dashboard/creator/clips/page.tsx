import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, Play, Eye, Trash2, Share2, Calendar, Lock, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DeleteClipDialog } from "@/components/clips/delete-clip-dialog"

export const metadata = { title: "My Clips | Creator Dashboard" }

interface Clip {
  id: string
  title: string
  description: string | null
  url: string
  thumbnail_url: string | null
  views: number
  visibility: string
  moderation_status: string
  created_at: string
  duration_seconds: number | null
}

export default async function CreatorClipsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")

  // Get user's clips
  const { data: clips, error } = await supabase
    .from("player_media")
    .select("*")
    .eq("player_id", user.id)
    .order("created_at", { ascending: false })

  const userClips = (clips || []) as Clip[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Clips</h1>
          <p className="text-muted-foreground mt-1">
            {userClips.length} {userClips.length === 1 ? "clip" : "clips"} uploaded
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/dashboard/media/upload">
            <Plus className="h-5 w-5 mr-2" />
            Upload Clip
          </Link>
        </Button>
      </div>

      {userClips.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Play className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No clips yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Upload your first clip to get started
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/media/upload">
                <Plus className="h-4 w-4 mr-2" />
                Upload Your First Clip
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {userClips.map((clip) => (
            <Card key={clip.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative bg-muted h-40 overflow-hidden group">
                {clip.thumbnail_url ? (
                  <img
                    src={clip.thumbnail_url}
                    alt={clip.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Link href={`/watch/clip/${clip.id}`}>
                    <Button size="sm" variant="secondary">
                      <Play className="h-4 w-4 mr-2" />
                      Watch
                    </Button>
                  </Link>
                </div>
                <Badge className="absolute top-2 right-2 bg-destructive/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-white mr-1 animate-pulse" />
                  LIVE
                </Badge>
              </div>

              <CardContent className="pt-4 space-y-3">
                <div>
                  <h3 className="font-semibold line-clamp-2">{clip.title}</h3>
                  {clip.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {clip.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {clip.views} views
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(clip.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {clip.visibility}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={
                      clip.moderation_status === "approved"
                        ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                        : clip.moderation_status === "pending"
                          ? "bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20"
                          : "bg-red-500/10 text-red-700 hover:bg-red-500/20"
                    }
                  >
                    {clip.moderation_status === "approved" && "Approved"}
                    {clip.moderation_status === "pending" && "Pending"}
                    {clip.moderation_status === "rejected" && "Rejected"}
                  </Badge>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/dashboard/creator/analytics/${clip.id}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      Analytics
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const shareUrl = `${typeof window !== "undefined" ? window.location.origin : "https://majhevents.com"}/watch/clip/${clip.id}`
                      navigator.clipboard.writeText(shareUrl)
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <DeleteClipDialog clipId={clip.id} clipTitle={clip.title} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
