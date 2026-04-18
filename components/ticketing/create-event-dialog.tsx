"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon, Loader2 } from "lucide-react"

interface CreateEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
}

export function CreateEventDialog({ open, onOpenChange, tenantId }: CreateEventDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [locationName, setLocationName] = useState("")
  const [locationCity, setLocationCity] = useState("")
  const [startDate, setStartDate] = useState<Date>()
  const [startTime, setStartTime] = useState("19:00")
  const [endDate, setEndDate] = useState<Date>()
  const [endTime, setEndTime] = useState("23:00")
  const [capacity, setCapacity] = useState("")
  const [isOnline, setIsOnline] = useState(false)
  const [onlineUrl, setOnlineUrl] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name || !startDate) {
      setError("Event name and start date are required")
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError("You must be logged in")
        return
      }

      // Combine date and time
      const startsAt = new Date(startDate)
      const [startHour, startMin] = startTime.split(":").map(Number)
      startsAt.setHours(startHour, startMin, 0, 0)

      const endsAt = endDate ? new Date(endDate) : new Date(startDate)
      const [endHour, endMin] = endTime.split(":").map(Number)
      endsAt.setHours(endHour, endMin, 0, 0)

      // Generate slug
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

      const { data: event, error: insertError } = await supabase
        .from("events")
        .insert({
          tenant_id: tenantId,
          name,
          slug,
          description,
          location_name: isOnline ? null : locationName,
          location_city: isOnline ? null : locationCity,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          capacity: capacity ? parseInt(capacity) : null,
          is_online: isOnline,
          online_url: isOnline ? onlineUrl : null,
          status: "draft",
          visibility: "public",
          created_by: user.id,
        })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === "23505") {
          setError("An event with this name already exists")
        } else {
          setError(insertError.message)
        }
        return
      }

      onOpenChange(false)
      router.push(`/dashboard/ticketing/${event.id}`)
      router.refresh()
    } catch (err) {
      setError("An unexpected error occurred")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setName("")
    setDescription("")
    setLocationName("")
    setLocationCity("")
    setStartDate(undefined)
    setStartTime("19:00")
    setEndDate(undefined)
    setEndTime("23:00")
    setCapacity("")
    setIsOnline(false)
    setOnlineUrl("")
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetForm()
      onOpenChange(newOpen)
    }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>
            Set up your event details. You can add ticket types after creating the event.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Summer Tournament 2024"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your event..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-4">
              <Switch
                id="isOnline"
                checked={isOnline}
                onCheckedChange={setIsOnline}
              />
              <Label htmlFor="isOnline">This is an online event</Label>
            </div>

            {isOnline ? (
              <div className="space-y-2">
                <Label htmlFor="onlineUrl">Event URL</Label>
                <Input
                  id="onlineUrl"
                  type="url"
                  placeholder="https://zoom.us/j/..."
                  value={onlineUrl}
                  onChange={(e) => setOnlineUrl(e.target.value)}
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="locationName">Venue Name</Label>
                  <Input
                    id="locationName"
                    placeholder="e.g., Convention Center"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locationCity">City</Label>
                  <Input
                    id="locationCity"
                    placeholder="e.g., Washington, DC"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Same as start"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Event Capacity (optional)</Label>
              <Input
                id="capacity"
                type="number"
                placeholder="Leave empty for unlimited"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                min="1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
