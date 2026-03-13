"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface StaffMember {
  user_id: string
  role: string
  profiles: { first_name: string; last_name: string } | null
}

export function NewShiftForm({ staffMembers }: { staffMembers: StaffMember[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [staffId, setStaffId] = useState("")
  const [role, setRole] = useState("bartender")
  const [shiftDate, setShiftDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleSubmit() {
    setError(null)
    setSuccess(false)
    if (!staffId || !shiftDate || !startTime || !endTime) {
      toast.error("Please fill in all required fields")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/carbardmv/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: staffId,
          shift_date: shiftDate,
          start_time: startTime,
          end_time: endTime,
          role: role,
          location: location || null,
          notes: notes || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "Failed to create shift")
        toast.error(result.error || "Failed to create shift")
        setLoading(false)
        return
      }

      setSuccess(true)
      toast.success("Shift created successfully!")
      setOpen(false)
      // Reset form
      setStaffId("")
      setRole("bartender")
      setShiftDate("")
      setStartTime("")
      setEndTime("")
      setLocation("")
      setNotes("")
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Failed to create shift")
      toast.error(err.message || "Failed to create shift")
    }

    setLoading(false)
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
        
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive p-3 text-sm text-destructive">
            Error: {error}
          </div>
        )}
        {success && (
          <div className="rounded-md bg-green-500/10 border border-green-500 p-3 text-sm text-green-500">
            Shift created successfully!
          </div>
        )}
        
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Staff Member *</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {staffMembers.map((s) => (
                  <SelectItem key={s.user_id} value={s.user_id}>
                    {s.profiles?.first_name} {s.profiles?.last_name} ({s.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Role *</Label>
            <Select value={role} onValueChange={setRole}>
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
              <Input 
                type="date" 
                value={shiftDate} 
                onChange={(e) => setShiftDate(e.target.value)} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label className="text-xs">Start *</Label>
              <Input 
                type="time" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label className="text-xs">End *</Label>
              <Input 
                type="time" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)} 
                className="mt-1" 
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Location</Label>
            <Input 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
              className="mt-1" 
              placeholder="Event venue / address" 
            />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              rows={2} 
              className="mt-1" 
            />
          </div>
          <Button onClick={handleSubmit} className="w-full" disabled={loading || !staffId}>
            {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            {loading ? "Saving..." : "Add Shift"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
