"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  ArrowLeft,
  Edit,
  Globe,
  Lock,
  Eye,
  Ticket,
  QrCode,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  ExternalLink,
  Copy,
} from "lucide-react"
import { TicketTypeManager } from "./ticket-type-manager"

interface TicketType {
  id: string
  name: string
  description: string | null
  price_cents: number
  compare_at_price_cents: number | null
  quantity_total: number
  quantity_sold: number
  quantity_reserved: number
  min_per_order: number
  max_per_order: number
  sales_start_at: string | null
  sales_end_at: string | null
  visibility: string
  sort_order: number
  created_at: string
}

interface Event {
  id: string
  name: string
  slug: string
  description: string | null
  short_description: string | null
  location_name: string | null
  location_city: string | null
  location_state: string | null
  starts_at: string
  ends_at: string
  doors_open_at: string | null
  capacity: number | null
  is_online: boolean
  online_url: string | null
  status: string
  visibility: string
  cover_image_url: string | null
  created_at: string
  ticket_types: TicketType[]
}

interface EventStats {
  total_tickets: number
  valid_tickets: number
  checked_in: number
  cancelled: number
  check_in_rate: number
  total_revenue_cents: number
  total_orders: number
  capacity: number | null
  capacity_used: number
}

interface Order {
  id: string
  order_number: string
  email: string
  first_name: string | null
  last_name: string | null
  status: string
  total_cents: number
  paid_at: string | null
  created_at: string
}

interface CheckIn {
  id: string
  action: string
  created_at: string
  ticket: {
    ticket_number: string
    attendee_first_name: string | null
    attendee_last_name: string | null
  } | null
}

interface EventDetailViewProps {
  event: Event
  stats: EventStats | null
  recentOrders: Order[]
  checkIns: CheckIn[]
  tenantId: string
  userRole: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: "Draft", color: "text-zinc-500", bgColor: "bg-zinc-500/10" },
  published: { label: "Live", color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  cancelled: { label: "Cancelled", color: "text-red-500", bgColor: "bg-red-500/10" },
  completed: { label: "Completed", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  postponed: { label: "Postponed", color: "text-amber-500", bgColor: "bg-amber-500/10" },
}

export function EventDetailView({
  event,
  stats,
  recentOrders,
  checkIns,
  tenantId,
  userRole,
}: EventDetailViewProps) {
  const router = useRouter()
  const [publishing, setPublishing] = useState(false)
  const statusConfig = STATUS_CONFIG[event.status] || STATUS_CONFIG.draft
  const eventDate = new Date(event.starts_at)
  const isUpcoming = eventDate > new Date()
  const publicUrl = `/events/${event.slug}`

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const supabase = createClient()
      await supabase
        .from("events")
        .update({ 
          status: "published",
          published_at: new Date().toISOString(),
        })
        .eq("id", event.id)
      router.refresh()
    } catch (error) {
      console.error("Failed to publish:", error)
    } finally {
      setPublishing(false)
    }
  }

  const copyPublicUrl = () => {
    const fullUrl = `${window.location.origin}${publicUrl}`
    navigator.clipboard.writeText(fullUrl)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/dashboard/ticketing">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Events
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0`}>
              {statusConfig.label}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {eventDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {eventDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
            {event.location_name && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {event.location_name}
                {event.location_city && `, ${event.location_city}`}
              </div>
            )}
            {event.is_online && (
              <div className="flex items-center gap-1">
                <Globe className="h-4 w-4" />
                Online Event
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {event.status === "draft" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={event.ticket_types.length === 0}>
                  Publish Event
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publish Event</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will make your event live and tickets will be available for purchase.
                    Make sure all ticket types are configured correctly.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handlePublish} disabled={publishing}>
                    {publishing ? "Publishing..." : "Publish"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {event.status === "published" && (
            <Button variant="outline" onClick={copyPublicUrl}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/dashboard/ticketing/${event.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          {event.status === "published" && (
            <Button variant="outline" asChild>
              <Link href={`/dashboard/ticketing/${event.id}/check-in`}>
                <QrCode className="mr-2 h-4 w-4" />
                Check-In
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tickets Sold</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.valid_tickets || 0}</div>
            {stats?.capacity && stats.capacity > 0 && (
              <>
                <p className="text-xs text-muted-foreground">of {stats.capacity} capacity</p>
                <Progress value={stats.capacity_used} className="mt-2 h-1" />
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((stats?.total_revenue_cents || 0) / 100).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{stats?.total_orders || 0} orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Checked In</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.checked_in || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.check_in_rate || 0}% check-in rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.cancelled || 0}</div>
            <p className="text-xs text-muted-foreground">Refunds processed</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="tickets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tickets">
            <Ticket className="mr-2 h-4 w-4" />
            Ticket Types
          </TabsTrigger>
          <TabsTrigger value="orders">
            <DollarSign className="mr-2 h-4 w-4" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="checkins">
            <QrCode className="mr-2 h-4 w-4" />
            Check-Ins
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-4">
          <TicketTypeManager
            eventId={event.id}
            tenantId={tenantId}
            ticketTypes={event.ticket_types}
          />
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest ticket purchases for this event</CardDescription>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No orders yet</p>
              ) : (
                <div className="space-y-4">
                  {recentOrders.map(order => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between border-b pb-4 last:border-0"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{order.order_number}</span>
                          <Badge variant={order.status === "paid" ? "default" : "secondary"}>
                            {order.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.first_name} {order.last_name} ({order.email})
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${(order.total_cents / 100).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {recentOrders.length > 0 && (
                <Button variant="outline" className="w-full mt-4" asChild>
                  <Link href={`/dashboard/ticketing/${event.id}/orders`}>
                    View All Orders
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checkins" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Check-In Activity</CardTitle>
                <CardDescription>Recent check-in activity for this event</CardDescription>
              </div>
              <Button asChild>
                <Link href={`/dashboard/ticketing/${event.id}/check-in`}>
                  <QrCode className="mr-2 h-4 w-4" />
                  Open Check-In
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {checkIns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No check-ins yet</p>
              ) : (
                <div className="space-y-3">
                  {checkIns.map(checkIn => (
                    <div
                      key={checkIn.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      {checkIn.action === "check_in" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-mono">{checkIn.ticket?.ticket_number}</span>
                      <span className="text-muted-foreground">
                        {checkIn.ticket?.attendee_first_name} {checkIn.ticket?.attendee_last_name}
                      </span>
                      <span className="ml-auto text-muted-foreground">
                        {new Date(checkIn.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales Analytics</CardTitle>
              <CardDescription>Performance metrics for this event</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                Analytics dashboard coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
