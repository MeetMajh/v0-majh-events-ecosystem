import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateApiKey } from "@/lib/middleware/api-auth"
import { checkRateLimit } from "@/lib/middleware/rate-limit"
import { apiError, apiSuccess } from "@/lib/middleware/api-response"

export async function GET(req: NextRequest) {
  try {
    const authResult = await validateApiKey(req)
    if (!authResult.valid) {
      return apiError("authentication_error", authResult.error || "Invalid API key", 401)
    }

    const rateLimitResult = await checkRateLimit(authResult.api_key_id, 60)
    if (!rateLimitResult.allowed) {
      return apiError("rate_limit_exceeded", "Rate limit exceeded", 429)
    }

    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return apiError("invalid_request", "event_id is required", 400)
    }

    const { data: ticketTypes, error } = await supabase
      .from("ticket_types")
      .select(`
        *,
        event:events (
          id,
          name,
          starts_at,
          status
        )
      `)
      .eq("tenant_id", authResult.tenant_id)
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })

    if (error) {
      return apiError("database_error", error.message, 500)
    }

    // Calculate availability for each type
    const typesWithAvailability = ticketTypes?.map(type => ({
      ...type,
      quantity_available: type.quantity_total - type.quantity_sold - type.quantity_reserved,
      is_sold_out: type.quantity_sold >= type.quantity_total,
      is_on_sale: 
        (!type.sales_start_at || new Date(type.sales_start_at) <= new Date()) &&
        (!type.sales_end_at || new Date(type.sales_end_at) >= new Date()),
    }))

    return apiSuccess({
      object: "list",
      data: typesWithAvailability,
    })
  } catch (error) {
    console.error("[API] Ticket Types GET error:", error)
    return apiError("internal_error", "An unexpected error occurred", 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateApiKey(req)
    if (!authResult.valid) {
      return apiError("authentication_error", authResult.error || "Invalid API key", 401)
    }

    if (!authResult.scopes?.includes("write")) {
      return apiError("permission_denied", "API key does not have write permission", 403)
    }

    const supabase = await createClient()
    const body = await req.json()

    const {
      event_id,
      name,
      description,
      price_cents,
      compare_at_price_cents,
      quantity_total,
      min_per_order,
      max_per_order,
      sales_start_at,
      sales_end_at,
      visibility,
      access_password,
      sort_order,
    } = body

    if (!event_id || !name || quantity_total === undefined) {
      return apiError("invalid_request", "event_id, name, and quantity_total are required", 400)
    }

    // Verify event belongs to tenant
    const { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("id", event_id)
      .eq("tenant_id", authResult.tenant_id)
      .single()

    if (!event) {
      return apiError("not_found", "Event not found", 404)
    }

    const { data: ticketType, error } = await supabase
      .from("ticket_types")
      .insert({
        tenant_id: authResult.tenant_id,
        event_id,
        name,
        description,
        price_cents: price_cents || 0,
        compare_at_price_cents,
        quantity_total,
        min_per_order: min_per_order || 1,
        max_per_order: max_per_order || 10,
        sales_start_at,
        sales_end_at,
        visibility: visibility || "visible",
        access_password,
        sort_order: sort_order || 0,
      })
      .select()
      .single()

    if (error) {
      return apiError("database_error", error.message, 500)
    }

    return apiSuccess(ticketType, {}, 201)
  } catch (error) {
    console.error("[API] Ticket Types POST error:", error)
    return apiError("internal_error", "An unexpected error occurred", 500)
  }
}
