"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createClient_CRM } from "@/lib/carbardmv-actions"
import { Plus, Loader2 } from "lucide-react"

export function NewClientForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    await createClient_CRM(formData)
    setLoading(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-3 w-3" /> Add Client</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nc-name" className="text-xs">Contact Name *</Label>
              <Input id="nc-name" name="contact_name" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="nc-email" className="text-xs">Email *</Label>
              <Input id="nc-email" name="email" type="email" required className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nc-phone" className="text-xs">Phone</Label>
              <Input id="nc-phone" name="phone" type="tel" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="nc-company" className="text-xs">Company</Label>
              <Input id="nc-company" name="company_name" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="nc-city" className="text-xs">City</Label>
              <Input id="nc-city" name="city" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="nc-state" className="text-xs">State</Label>
              <Input id="nc-state" name="state" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="nc-zip" className="text-xs">ZIP</Label>
              <Input id="nc-zip" name="zip" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Source</Label>
              <Select name="source" defaultValue="website">
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select name="status" defaultValue="lead">
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="nc-notes" className="text-xs">Notes</Label>
            <Textarea id="nc-notes" name="notes" rows={2} className="mt-1" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            {loading ? "Saving..." : "Add Client"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
