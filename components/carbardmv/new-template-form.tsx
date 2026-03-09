"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createTemplate } from "@/lib/crm-actions"
import { Loader2, Plus } from "lucide-react"

export function NewTemplateForm() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setPending(true)
    const result = await createTemplate(formData)
    setPending(false)
    if (result.success) {
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Email Template</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input id="name" name="name" placeholder="e.g., Birthday Greeting" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue="email">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Email Subject</Label>
            <Input id="subject" name="subject" placeholder="Your email subject line" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Template Body *</Label>
            <Textarea 
              id="body" 
              name="body" 
              placeholder="Write your template content here.

Use {{first_name}} for the client's name.
Use {{company}} for the company name.
Use {{event_name}} for event details.
Use {{event_date}} for the event date."
              rows={10}
              required 
            />
            <p className="text-xs text-muted-foreground">
              Variables will be auto-detected from {"{{variable}}"} patterns
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Template
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
