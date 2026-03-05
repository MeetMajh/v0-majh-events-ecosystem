"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createThread } from "@/lib/community-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "match_discussion", label: "Match Discussion" },
  { value: "lfg", label: "Looking for Group" },
  { value: "off_topic", label: "Off Topic" },
]

export function NewThreadForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createThread(formData)
      if (result?.error) {
        setError(result.error)
      } else if (result?.threadId) {
        router.push(`/community/${result.threadId}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required placeholder="Thread title..." className="mt-1" />
      </div>

      <div>
        <Label htmlFor="category">Category</Label>
        <Select name="category" defaultValue="general">
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="content">Content</Label>
        <textarea
          id="content"
          name="content"
          rows={6}
          required
          placeholder="What's on your mind?"
          className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Create Thread
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
