"use client"

import { useState, useTransition } from "react"
import { submitRecruitmentApplication } from "@/lib/community-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle2 } from "lucide-react"

export function RecruitmentForm() {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <h3 className="text-lg font-semibold text-foreground">Application Submitted</h3>
        <p className="text-sm text-muted-foreground">Thank you for your interest! We will review your application and get back to you.</p>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await submitRecruitmentApplication(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="rec_name">Full Name</Label>
          <Input id="rec_name" name="name" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="rec_email">Email</Label>
          <Input id="rec_email" name="email" type="email" required className="mt-1" />
        </div>
      </div>

      <div>
        <Label htmlFor="rec_type">Role Type</Label>
        <Select name="type" defaultValue="player">
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="player">Player</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="volunteer">Volunteer</SelectItem>
            <SelectItem value="caster">Caster</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="rec_games">Game Interests</Label>
        <Input id="rec_games" name="game_interests" placeholder="e.g. Tekken 8, Yu-Gi-Oh!, Valorant" className="mt-1" />
      </div>

      <div>
        <Label htmlFor="rec_experience">Experience</Label>
        <textarea
          id="rec_experience"
          name="experience"
          rows={3}
          placeholder="Tell us about your gaming or event experience..."
          className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div>
        <Label htmlFor="rec_availability">Availability</Label>
        <Input id="rec_availability" name="availability" placeholder="e.g. Weekends, evenings" className="mt-1" />
      </div>

      <div>
        <Label htmlFor="rec_message">Additional Message</Label>
        <textarea
          id="rec_message"
          name="message"
          rows={3}
          placeholder="Anything else you want us to know..."
          className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        Submit Application
      </Button>
    </form>
  )
}
