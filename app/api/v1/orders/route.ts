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
    const status = searchParams.get("status")
    const email = searchParams.get("email")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    let query = supabase
      .from("ticket_orders")
      .select(`
        id,
        order_number,
        email,
        first_name,
        last_name,
        status,
        subtotal_cents,
        fees_cents,
        discount_cents,
        total_cents,
        amount_refunded_cents,
        paid_at,
        created_at,
        event:events (
          id,
          name,
          starts_at
        ),
        items:ticket_order_items (
          id,
          quantity,
          unit_price_cents,
          total_cents,
          ticket_type:ticket_types (
            id,
            name
          )
        )
      `, { count: "exact" })
      .eq("tenant_id", authResult.tenant_id)

    if (eventId) query = query.eq("event_id", eventId)
    if (status) query = query.eq("status", status)
    if (email) query = query.ilike("email", `%${email}%`)

    const { data: orders, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return apiError("database_error", error.message, 500)
    }

    return apiSuccess({
      object: "list",
      data: orders,
      has_more: (count || 0) > offset + limit,
      total_count: count,
    })
  } catch (error) {
    console.error("[API] Orders GET error:", error)
    return apiError("internal_error", "An unexpected error occurred", 500)
  }
}
