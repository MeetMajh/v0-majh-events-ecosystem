"use client"

import { useState, useTransition } from "react"
import { createReply } from "@/lib/community-actions"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function ReplyForm({ threadId }: { threadId: string }) {
  const [content, setContent] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setError(null)

    startTransition(async () => {
      const result = await createReply(threadId, content.trim())
      if (result?.error) {
        setError(result.error)
      } else {
        setContent("")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a reply..."
        rows={4}
        className="w-full rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      <div className="mt-2 flex justify-end">
        <Button type="submit" size="sm" disabled={pending || !content.trim()}>
          {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Post Reply
        </Button>
      </div>
    </form>
  )
}
