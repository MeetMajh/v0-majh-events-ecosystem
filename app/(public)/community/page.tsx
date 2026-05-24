import Link from "next/link"
import { getForumThreads } from "@/lib/community-actions"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import { MessageSquare, Pin, Lock, Plus, Hash } from "lucide-react"
import { ForumCategoryFilter } from "@/components/community/forum-category-filter"

export const metadata = { title: "Community Forums | MAJH EVENTS" }

const CATEGORY_COLORS: Record<string, string> = {
  general: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  match_discussion: "border-primary/30 bg-primary/10 text-primary",
  lfg: "border-green-500/30 bg-green-500/10 text-green-400",
  off_topic: "border-muted-foreground/30 bg-muted text-muted-foreground",
  announcements: "border-destructive/30 bg-destructive/10 text-destructive",
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const threads = await getForumThreads(category)

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <MessageSquare className="h-3 w-3" />
            Forums
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Community</h1>
          <p className="mt-1 text-muted-foreground">Discuss matches, find groups, and connect with fellow players.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/community/chat">
              <Hash className="mr-1.5 h-3.5 w-3.5" />
              Live Chat
            </Link>
          </Button>
          {user && (
            <Button asChild size="sm">
              <Link href="/community/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Thread
              </Link>
            </Button>
          )}
        </div>
      </div>

      <ForumCategoryFilter current={category} />

      {threads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium text-foreground">No threads yet</p>
          <p className="text-sm text-muted-foreground">Be the first to start a discussion.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {threads.map((thread: any) => (
            <Link
              key={thread.id}
              href={`/community/${thread.id}`}
              className="flex items-start gap-4 p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {thread.profiles?.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  {thread.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                  {thread.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                  <span className="font-semibold text-foreground line-clamp-1">{thread.title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[thread.category] ?? ""}`}>
                    {thread.category.replace("_", " ")}
                  </Badge>
                  <span>{thread.profiles?.display_name ?? "Unknown"}</span>
                  <span>{formatDate(thread.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                {thread.reply_count}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
