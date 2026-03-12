"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import { Plus, User, Calendar, Clock, Tag, Flag, X } from "lucide-react"
import { createPrepTask } from "@/lib/carbardmv-actions"
import { toast } from "sonner"

const CATEGORIES = [
  { value: "food_prep", label: "Food Prep", color: "bg-orange-500/20 text-orange-400" },
  { value: "setup", label: "Setup", color: "bg-blue-500/20 text-blue-400" },
  { value: "cleaning", label: "Cleaning", color: "bg-green-500/20 text-green-400" },
  { value: "inventory", label: "Inventory", color: "bg-purple-500/20 text-purple-400" },
  { value: "transport", label: "Transport", color: "bg-cyan-500/20 text-cyan-400" },
  { value: "equipment", label: "Equipment", color: "bg-yellow-500/20 text-yellow-400" },
  { value: "other", label: "Other", color: "bg-muted text-muted-foreground" },
]

const PRIORITIES = [
  { value: "low", label: "Low", color: "text-muted-foreground" },
  { value: "medium", label: "Medium", color: "text-blue-400" },
  { value: "high", label: "High", color: "text-orange-400" },
  { value: "urgent", label: "Urgent", color: "text-destructive" },
]

const PRESET_TAGS = ["pre-event", "day-of", "post-event", "vendor", "client", "recurring"]

interface NewPrepTaskFormProps {
  staffMembers?: Array<{ user_id: string; role: string; profiles: { first_name: string; last_name: string } | null }>
  bookings?: Array<{ id: string; contact_name: string; event_date: string }>
}

export function NewPrepTaskForm({ staffMembers = [], bookings = [] }: NewPrepTaskFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState("food_prep")
  const [priority, setPriority] = useState("medium")
  const [assignee, setAssignee] = useState("")
  const [linkedBooking, setLinkedBooking] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")

  const addTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim()
    if (normalizedTag && !tags.includes(normalizedTag)) {
      setTags([...tags, normalizedTag])
    }
    setNewTag("")
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string || undefined,
      category: category,
      priority: priority,
      assigned_to: assignee || undefined,
      booking_id: linkedBooking || undefined,
      start_date: formData.get("start_date") as string || undefined,
      due_date: formData.get("due_date") as string || undefined,
      due_time: formData.get("due_time") as string || undefined,
      time_estimate_minutes: parseInt(formData.get("time_estimate") as string) || undefined,
      tags: tags.length > 0 ? tags : undefined,
    }

    const result = await createPrepTask(data)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Prep task created")
      setOpen(false)
      // Reset form
      setCategory("food_prep")
      setPriority("medium")
      setAssignee("")
      setLinkedBooking("")
      setTags([])
      router.refresh()
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Prep Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input 
              id="title" 
              name="title" 
              required 
              placeholder="e.g., Prep pulled pork for Saturday wedding" 
              className="text-base"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              name="description" 
              rows={2} 
              placeholder="Additional details, instructions, or notes..." 
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
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${cat.color.split(" ")[0]}`} />
                        {cat.label}
                      </span>
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
                      <span className={p.color}>{p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee */}
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

          {/* Dates */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Start Date
              </Label>
              <Input id="start_date" name="start_date" type="date" />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input id="due_date" name="due_date" type="date" />
            </div>
            <div className="space-y-2">
              <Label>Due Time</Label>
              <Input id="due_time" name="due_time" type="time" />
            </div>
          </div>

          {/* Time Estimate */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Time Estimate (minutes)
            </Label>
            <Input 
              id="time_estimate" 
              name="time_estimate" 
              type="number" 
              min="0"
              placeholder="e.g., 30"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input 
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addTag(newTag)
                  }
                }}
                placeholder="Add custom tag..."
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => addTag(newTag)}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {PRESET_TAGS.filter(t => !tags.includes(t)).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="text-xs px-2 py-0.5 rounded-full border border-dashed border-border hover:border-primary hover:text-primary transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
