"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Copy,
  Trash2,
  BarChart3,
  Ticket,
  QrCode,
} from "lucide-react"
import { CreateEventDialog } from "./create-event-dialog"

interface EventWithStats {
  id: string
  name: string
  slug: string
  short_description: string | null
  location_name: string | null
  location_city: string | null
  starts_at: string
  ends_at: string
  capacity: number | null
  status: string
  visibility: string
  cover_image_url: string | null
  created_at: string
  ticket_types: Array<{
    id: string
    name: string
    price_cents: number
    quantity_total: number
    quantity_sold: number
  }>
  stats: {
    tickets_sold: number
    total_capacity: number
    revenue_cents: number
    sell_through_rate: number
  }
}

interface EventsManagerProps {
  events: EventWithStats[]
  tenantId: string
  userRole: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-zinc-500" },
  published: { label: "Live", color: "bg-emerald-500" },
  cancelled: { label: "Cancelled", color: "bg-red-500" },
  completed: { label: "Completed", color: "bg-blue-500" },
  postponed: { label: "Postponed", color: "bg-amber-500" },
}

export function EventsManager({ events, tenantId, userRole }: EventsManagerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.location_city?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const upcomingEvents = filteredEvents.filter(e => 
    new Date(e.starts_at) >= new Date() && e.status !== "cancelled"
  )
  const pastEvents = filteredEvents.filter(e => 
    new Date(e.starts_at) < new Date() || e.status === "cancelled"
  )
  const draftEvents = filteredEvents.filter(e => e.status === "draft")

  // Stats
  const totalRevenue = events.reduce((sum, e) => sum + e.stats.revenue_cents, 0)
  const totalTicketsSold = events.reduce((sum, e) => sum + e.stats.tickets_sold, 0)
  const liveEvents = events.filter(e => e.status === "published").length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Ticketing</h1>
          <p className="text-muted-foreground">Create and manage ticketed events</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalRevenue / 100).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From all events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tickets Sold</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTicketsSold.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Live Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{liveEvents}</div>
            <p className="text-xs text-muted-foreground">Currently on sale</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events.length}</div>
            <p className="text-xs text-muted-foreground">{draftEvents.length} drafts</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Events Tabs */}
      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Past ({pastEvents.length})
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts ({draftEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingEvents.length === 0 ? (
            <EmptyState 
              title="No upcoming events"
              description="Create your first event to start selling tickets"
              onCreateClick={() => setShowCreateDialog(true)}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {pastEvents.length === 0 ? (
            <EmptyState 
              title="No past events"
              description="Your completed events will appear here"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pastEvents.map(event => (
                <EventCard key={event.id} event={event} isPast />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="drafts" className="space-y-4">
          {draftEvents.length === 0 ? (
            <EmptyState 
              title="No draft events"
              description="Events you create will appear here before publishing"
              onCreateClick={() => setShowCreateDialog(true)}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {draftEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateEventDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
        tenantId={tenantId}
      />
    </div>
  )
}

function EventCard({ event, isPast }: { event: EventWithStats; isPast?: boolean }) {
  const status = STATUS_CONFIG[event.status] || STATUS_CONFIG.draft
  const eventDate = new Date(event.starts_at)

  return (
    <Card className={isPast ? "opacity-75" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-lg line-clamp-1">{event.name}</CardTitle>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${status.color}`} />
              <span className="text-xs text-muted-foreground">{status.label}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/ticketing/${event.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/ticketing/${event.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Event
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/ticketing/${event.id}/check-in`}>
                  <QrCode className="mr-2 h-4 w-4" />
                  Check-In
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            {eventDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {" at "}
            {eventDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
          {event.location_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {event.location_name}
                {event.location_city && `, ${event.location_city}`}
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3">
          <div className="text-center">
            <div className="text-lg font-semibold">{event.stats.tickets_sold}</div>
            <div className="text-xs text-muted-foreground">Sold</div>
          </div>
          <div className="text-center border-x border-border">
            <div className="text-lg font-semibold">{event.stats.sell_through_rate}%</div>
            <div className="text-xs text-muted-foreground">Capacity</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">${(event.stats.revenue_cents / 100).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Revenue</div>
          </div>
        </div>

        {/* Ticket Types Preview */}
        {event.ticket_types.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.ticket_types.slice(0, 3).map(type => (
              <Badge key={type.id} variant="secondary" className="text-xs">
                {type.name}: ${(type.price_cents / 100).toFixed(0)}
              </Badge>
            ))}
            {event.ticket_types.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{event.ticket_types.length - 3} more
              </Badge>
            )}
          </div>
        )}

        <Button asChild variant="outline" className="w-full">
          <Link href={`/dashboard/ticketing/${event.id}`}>
            Manage Event
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function EmptyState({ 
  title, 
  description, 
  onCreateClick 
}: { 
  title: string
  description: string
  onCreateClick?: () => void 
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="mb-2 text-lg font-medium">{title}</p>
        <p className="mb-4 text-muted-foreground text-center max-w-sm">{description}</p>
        {onCreateClick && (
          <Button onClick={onCreateClick}>
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
