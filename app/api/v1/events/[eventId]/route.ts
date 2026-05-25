import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateApiKey } from "@/lib/middleware/api-auth"
import { checkRateLimit } from "@/lib/middleware/rate-limit"
import { apiError, apiSuccess } from "@/lib/middleware/api-response"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const authResult = await validateApiKey(req)
    if (!authResult.valid) {
      return apiError("authentication_error", authResult.error || "Invalid API key", 401)
    }

    const rateLimitResult = await checkRateLimit(authResult.api_key_id, 60)
    if (!rateLimitResult.allowed) {
      return apiError("rate_limit_exceeded", "Rate limit exceeded", 429)
    }

    const supabase = await createClient()

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
          sort_order
        )
      `)
      .eq("tenant_id", authResult.tenant_id)
      .eq("id", eventId)
      .single()

    if (error || !event) {
      return apiError("not_found", "Event not found", 404)
    }

    // Get event stats
    const { data: stats } = await supabase.rpc("get_event_stats", { p_event_id: eventId })

    return apiSuccess({
      ...event,
      stats,
    }, {
      "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
    })
  } catch (error) {
    console.error("[API] Event GET error:", error)
    return apiError("internal_error", "An unexpected error occurred", 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const authResult = await validateApiKey(req)
    if (!authResult.valid) {
      return apiError("authentication_error", authResult.error || "Invalid API key", 401)
    }

    if (!authResult.scopes?.includes("write")) {
      return apiError("permission_denied", "API key does not have write permission", 403)
    }

    const supabase = await createClient()
    const body = await req.json()

    // Validate event belongs to tenant
    const { data: existing } = await supabase
      .from("events")
      .select("id, status")
      .eq("id", eventId)
      .eq("tenant_id", authResult.tenant_id)
      .single()

    if (!existing) {
      return apiError("not_found", "Event not found", 404)
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    
    const allowedFields = [
      "name", "description", "short_description", "location_name", "location_address",
      "location_city", "location_state", "location_country", "starts_at", "ends_at",
      "doors_open_at", "capacity", "is_online", "online_url", "cover_image_url",
      "visibility", "age_restriction", "tags", "status"
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Handle publish
    if (body.status === "published" && existing.status === "draft") {
      updateData.published_at = new Date().toISOString()
    }

    const { data: event, error } = await supabase
      .from("events")
      .update(updateData)
      .eq("id", eventId)
      .select()
      .single()

    if (error) {
      return apiError("database_error", error.message, 500)
    }

    return apiSuccess(event)
  } catch (error) {
    console.error("[API] Event PATCH error:", error)
    return apiError("internal_error", "An unexpected error occurred", 500)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const authResult = await validateApiKey(req)
    if (!authResult.valid) {
      return apiError("authentication_error", authResult.error || "Invalid API key", 401)
    }

    if (!authResult.scopes?.includes("write")) {
      return apiError("permission_denied", "API key does not have write permission", 403)
    }

    const supabase = await createClient()

    // Check for sold tickets
    const { count: soldTickets } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .in("status", ["valid", "checked_in"])

    if (soldTickets && soldTickets > 0) {
      return apiError("conflict", "Cannot delete event with sold tickets. Cancel tickets first.", 409)
    }

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId)
      .eq("tenant_id", authResult.tenant_id)

    if (error) {
      return apiError("database_error", error.message, 500)
    }

    return apiSuccess({ deleted: true, id: eventId })
  } catch (error) {
    console.error("[API] Event DELETE error:", error)
    return apiError("internal_error", "An unexpected error occurred", 500)
  }
}
