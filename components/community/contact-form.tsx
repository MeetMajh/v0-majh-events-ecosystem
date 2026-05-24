"use client"

import { useState, useTransition } from "react"
import { submitContactForm } from "@/lib/content-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle2 } from "lucide-react"

export function ContactForm() {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <h3 className="text-lg font-semibold text-foreground">Message Sent</h3>
        <p className="text-sm text-muted-foreground">We have received your message and will get back to you as soon as possible.</p>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await submitContactForm(formData)
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
          <Label htmlFor="ct_name">Name</Label>
          <Input id="ct_name" name="name" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="ct_email">Email</Label>
          <Input id="ct_email" name="email" type="email" required className="mt-1" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ct_phone">Phone (optional)</Label>
          <Input id="ct_phone" name="phone" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="ct_type">Inquiry Type</Label>
          <Select name="type" defaultValue="general">
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="sponsor_inquiry">Sponsorship</SelectItem>
              <SelectItem value="tournament_inquiry">Tournament</SelectItem>
              <SelectItem value="partnership">Partnership</SelectItem>
              <SelectItem value="recruitment">Recruitment</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="ct_subject">Subject</Label>
        <Input id="ct_subject" name="subject" required className="mt-1" />
      </div>

      <div>
        <Label htmlFor="ct_message">Message</Label>
        <textarea
          id="ct_message"
          name="message"
          rows={5}
          required
          placeholder="Tell us how we can help..."
          className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        Send Message
      </Button>
    </form>
  )
}
