import { notFound } from "next/navigation"
import Link from "next/link"
import { getForumThread } from "@/lib/community-actions"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { Pin, Lock, ChevronRight } from "lucide-react"
import { ReplyForm } from "@/components/community/reply-form"

export async function generateMetadata({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params
  const thread = await getForumThread(threadId)
  if (!thread) return { title: "Not Found" }
  return { title: `${thread.title} | MAJH EVENTS` }
}

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params
  const thread = await getForumThread(threadId)
  if (!thread) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/community" className="hover:text-foreground transition-colors">Community</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground line-clamp-1">{thread.title}</span>
      </nav>

      {/* Thread Header */}
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize">{thread.category.replace("_", " ")}</Badge>
          {thread.is_pinned && (
            <Badge variant="outline" className="gap-1 border-primary/30 text-primary text-xs">
              <Pin className="h-3 w-3" /> Pinned
            </Badge>
          )}
          {thread.is_locked && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Lock className="h-3 w-3" /> Locked
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold text-balance text-foreground">{thread.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            {thread.profiles?.full_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <span>{thread.profiles?.full_name ?? "Unknown"}</span>
          <span>{formatDate(thread.created_at)}</span>
        </div>
      </div>

      {/* Replies */}
      <div className="space-y-4">
        {thread.replies?.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No replies yet. Be the first to respond.</p>
        ) : (
          thread.replies?.map((reply: any) => (
            <div key={reply.id} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {reply.profiles?.full_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <span className="text-sm font-medium text-foreground">{reply.profiles?.full_name ?? "Unknown"}</span>
                <span className="text-xs text-muted-foreground">{formatDate(reply.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">{reply.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Reply Form */}
      {user && !thread.is_locked && (
        <div className="mt-6">
          <ReplyForm threadId={thread.id} />
        </div>
      )}

      {thread.is_locked && (
        <div className="mt-6 rounded-xl border border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
          This thread has been locked by a moderator.
        </div>
      )}

      {!user && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-primary hover:underline">Sign in</Link> to reply to this thread.
        </div>
      )}
    </div>
  )
}
