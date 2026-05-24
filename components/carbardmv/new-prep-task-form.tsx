"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Loader2, User, Tag, Flag } from "lucide-react"
import { toast } from "sonner"

const CATEGORIES = [
  { value: "food_prep", label: "Food Prep" },
  { value: "setup", label: "Setup" },
  { value: "cleaning", label: "Cleaning" },
  { value: "inventory", label: "Inventory" },
  { value: "other", label: "Other" },
]

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

interface NewPrepTaskFormProps {
  staffMembers?: Array<{ user_id: string; role: string; profiles: { first_name: string; last_name: string } | null }>
  bookings?: Array<{ id: string; contact_name: string; event_date: string }>
}

export function NewPrepTaskForm({ staffMembers = [], bookings = [] }: NewPrepTaskFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("food_prep")
  const [priority, setPriority] = useState("medium")
  const [assignee, setAssignee] = useState("")
  const [linkedBooking, setLinkedBooking] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [dueTime, setDueTime] = useState("")

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("Please enter a task title")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/carbardmv/prep-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category,
          priority,
          assigned_to: assignee || null,
          booking_id: linkedBooking || null,
          due_date: dueDate || null,
          due_time: dueTime || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || "Failed to create task")
        setLoading(false)
        return
      }

      toast.success("Prep task created!")
      setOpen(false)
      // Reset form
      setTitle("")
      setDescription("")
      setCategory("food_prep")
      setPriority("medium")
      setAssignee("")
      setLinkedBooking("")
      setDueDate("")
      setDueTime("")
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to create task")
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Prep Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Task Title *</Label>
            <Input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Prep pulled pork for Saturday wedding" 
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2} 
              placeholder="Additional details..." 
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5" />
                Priority
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee */}
          {staffMembers.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Assignee
              </Label>
              <Select value={assignee || "unassigned"} onValueChange={(v) => setAssignee(v === "unassigned" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staffMembers.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.profiles?.first_name} {s.profiles?.last_name} ({s.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Linked Booking */}
          {bookings.length > 0 && (
            <div className="space-y-2">
              <Label>Linked Event/Booking</Label>
              <Select value={linkedBooking || "none"} onValueChange={(v) => setLinkedBooking(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="No linked event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked event</SelectItem>
                  {bookings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.contact_name} - {b.event_date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Due Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Time</Label>
              <Input 
                type="time" 
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !title.trim()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
