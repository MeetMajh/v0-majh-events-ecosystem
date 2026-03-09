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
import { createCampaign } from "@/lib/crm-actions"
import { Loader2, Plus } from "lucide-react"

interface NewCampaignFormProps {
  segments: Array<{ id: string; name: string; member_count: number }>
  templates: Array<{ id: string; name: string; subject?: string; body: string }>
}

export function NewCampaignForm({ segments, templates }: NewCampaignFormProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const router = useRouter()

  function handleTemplateChange(templateId: string) {
    setSelectedTemplate(templateId)
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSubject(template.subject || "")
      setBody(template.body)
    }
  }

  async function handleSubmit(formData: FormData) {
    setPending(true)
    formData.set("subject", subject)
    formData.set("body", body)
    if (selectedTemplate) formData.set("template_id", selectedTemplate)
    const result = await createCampaign(formData)
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
          <Plus className="h-4 w-4" /> New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Email Campaign</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name *</Label>
            <Input id="name" name="name" placeholder="e.g., Summer Promo 2024" required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="space-y-2">
              <Label htmlFor="segment_id">Target Segment</Label>
              <Select name="segment_id">
                <SelectTrigger>
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {segments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.member_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Start from Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Email Subject *</Label>
            <Input 
              id="subject" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your email subject line" 
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Email Body *</Label>
            <Textarea 
              id="body" 
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email content here. Use {{first_name}} for personalization."
              rows={8}
              required 
            />
            <p className="text-xs text-muted-foreground">
              Available variables: {"{{first_name}}"}, {"{{company}}"}, {"{{email}}"}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Draft
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
