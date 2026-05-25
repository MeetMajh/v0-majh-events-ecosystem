import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { CheckInScanner } from "@/components/ticketing/check-in-scanner"

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const supabase = await createClient()
  
  const { data: event } = await supabase
    .from("events")
    .select("name")
    .eq("id", eventId)
    .single()

  return {
    title: event ? `Check-In: ${event.name}` : "Check-In | MAJH Ticketing",
  }
}

export default async function CheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
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

  // Get event
  const { data: event, error } = await supabase
    .from("events")
    .select("id, name, starts_at, status")
    .eq("id", eventId)
    .eq("tenant_id", membership.tenant_id)
    .single()

  if (error || !event) {
    return notFound()
  }

  // Get event stats
  const { data: stats } = await supabase.rpc("get_event_stats", { p_event_id: eventId })

  return (
    <div className="container max-w-4xl py-8">
      <CheckInScanner
        event={event}
        stats={stats}
        userId={user.id}
      />
    </div>
  )
}
