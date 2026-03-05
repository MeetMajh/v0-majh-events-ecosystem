"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createTeam } from "@/lib/esports-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"

export function CreateTeamForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createTeam(form)
      if (result.error) {
        setError(result.error)
      } else if (result.slug) {
        router.push(`/esports/teams/${result.slug}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label htmlFor="name">Team Name</Label>
        <Input id="name" name="name" required placeholder="e.g. Team Phoenix" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="tag">Tag (2-5 chars)</Label>
        <Input id="tag" name="tag" maxLength={5} placeholder="e.g. PHX" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} placeholder="Tell others about your team" className="mt-1" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create Team
      </Button>
    </form>
  )
}
