import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { EventDetailView } from "@/components/ticketing/event-detail-view"

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const supabase = await createClient()
  
  const { data: event } = await supabase
    .from("events")
    .select("name")
    .eq("id", eventId)
    .single()

  return {
    title: event ? `${event.name} | MAJH Ticketing` : "Event | MAJH Ticketing",
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Get user's tenant
  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .single()

  if (!membership) {
    return notFound()
  }

  // Get event with details
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      ticket_types (
        id,
        name,
        description,
        price_cents,
        compare_at_price_cents,
        quantity_total,
        quantity_sold,
        quantity_reserved,
        min_per_order,
        max_per_order,
        sales_start_at,
        sales_end_at,
        visibility,
        sort_order,
        created_at
      )
    `)
    .eq("id", eventId)
    .eq("tenant_id", membership.tenant_id)
    .single()

  if (error || !event) {
    return notFound()
  }

  // Get event stats
  const { data: stats } = await supabase.rpc("get_event_stats", { p_event_id: eventId })

  // Get recent orders
  const { data: recentOrders } = await supabase
    .from("ticket_orders")
    .select(`
      id,
      order_number,
      email,
      first_name,
      last_name,
      status,
      total_cents,
      paid_at,
      created_at
    `)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(10)

  // Get check-in activity
  const { data: checkIns } = await supabase
    .from("ticket_check_ins")
    .select(`
      id,
      action,
      created_at,
      ticket:tickets (
        ticket_number,
        attendee_first_name,
        attendee_last_name
      )
    `)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(20)

  return (
    <div className="container max-w-7xl py-8">
      <EventDetailView
        event={event}
        stats={stats}
        recentOrders={recentOrders || []}
        checkIns={checkIns || []}
        tenantId={membership.tenant_id}
        userRole={membership.role}
      />
    </div>
  )
}
