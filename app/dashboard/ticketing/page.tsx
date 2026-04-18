import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EventsManager } from "@/components/ticketing/events-manager"

export const metadata = {
  title: "Ticketing | MAJH Dashboard",
  description: "Manage your events and ticket sales",
}

export default async function TicketingPage() {
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No organization found. Please contact support.</p>
      </div>
    )
  }

  // Get events with stats
  const { data: events } = await supabase
    .from("events")
    .select(`
      id,
      name,
      slug,
      short_description,
      location_name,
      location_city,
      starts_at,
      ends_at,
      capacity,
      status,
      visibility,
      cover_image_url,
      created_at,
      ticket_types (
        id,
        name,
        price_cents,
        quantity_total,
        quantity_sold
      )
    `)
    .eq("tenant_id", membership.tenant_id)
    .order("starts_at", { ascending: false })

  // Calculate stats for each event
  const eventsWithStats = events?.map(event => {
    const ticketTypes = event.ticket_types || []
    const totalSold = ticketTypes.reduce((sum, t) => sum + (t.quantity_sold || 0), 0)
    const totalCapacity = ticketTypes.reduce((sum, t) => sum + (t.quantity_total || 0), 0)
    const totalRevenue = ticketTypes.reduce((sum, t) => sum + ((t.quantity_sold || 0) * (t.price_cents || 0)), 0)
    
    return {
      ...event,
      stats: {
        tickets_sold: totalSold,
        total_capacity: totalCapacity,
        revenue_cents: totalRevenue,
        sell_through_rate: totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0,
      },
    }
  }) || []

  return (
    <div className="container max-w-7xl py-8">
      <EventsManager 
        events={eventsWithStats}
        tenantId={membership.tenant_id}
        userRole={membership.role}
      />
    </div>
  )
}
