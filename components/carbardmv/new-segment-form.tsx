"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createSegment } from "@/lib/crm-actions"
import { Loader2, Plus } from "lucide-react"

export function NewSegmentForm() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setPending(true)
    const result = await createSegment(formData)
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
          <Plus className="h-4 w-4" /> New Segment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Customer Segment</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Segment Name *</Label>
            <Input id="name" name="name" placeholder="e.g., High Value Clients" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="Describe this segment..." rows={2} />
          </div>

          <div className="space-y-4 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Criteria (filters)</p>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min_ltv">Min Lifetime Value ($)</Label>
                <Input id="min_ltv" name="min_ltv" type="number" min="0" placeholder="e.g., 1000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status_filter">Client Status</Label>
                <Select name="status_filter">
                  <SelectTrigger>
                    <SelectValue placeholder="Any status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any status</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city_filter">City</Label>
                <Input id="city_filter" name="city_filter" placeholder="e.g., Washington" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_filter">Source</Label>
                <Select name="source_filter">
                  <SelectTrigger>
                    <SelectValue placeholder="Any source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any source</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="has_birthday">Has Birthday Set</Label>
                <p className="text-xs text-muted-foreground">Only include clients with birthdays</p>
              </div>
              <Switch id="has_birthday" name="has_birthday" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-1">
              <Label htmlFor="is_dynamic">Dynamic Segment</Label>
              <p className="text-xs text-muted-foreground">Auto-update members based on criteria</p>
            </div>
            <Switch id="is_dynamic" name="is_dynamic" defaultChecked />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Segment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
