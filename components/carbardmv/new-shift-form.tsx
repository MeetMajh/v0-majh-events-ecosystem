"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createStaffShift } from "@/lib/carbardmv-actions"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function NewShiftForm({ staffMembers }: { staffMembers: Array<Record<string, any>> }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    const result = await createStaffShift(formData)
    setLoading(false)
    
    if (result && "error" in result) {
      toast.error(result.error)
      return
    }
    
    toast.success("Shift created successfully!")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-3 w-3" /> Add Shift</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Staff Shift</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs">Staff Member *</Label>
            <Select name="staff_id" required>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {staffMembers.map((s) => {
                  const p = s.profiles as any
                  return (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {p?.first_name} {p?.last_name} ({s.role})
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Role *</Label>
            <Select name="role" defaultValue="bartender">
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bartender">Bartender</SelectItem>
                <SelectItem value="server">Server</SelectItem>
                <SelectItem value="setup_crew">Setup Crew</SelectItem>
                <SelectItem value="event_lead">Event Lead</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Date *</Label>
              <Input name="shift_date" type="date" required className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Start *</Label>
              <Input name="start_time" type="time" required className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">End *</Label>
              <Input name="end_time" type="time" required className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Location</Label>
            <Input name="location" className="mt-1" placeholder="Event venue / address" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea name="notes" rows={2} className="mt-1" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            {loading ? "Saving..." : "Add Shift"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
