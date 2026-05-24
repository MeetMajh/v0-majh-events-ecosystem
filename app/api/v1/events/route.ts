import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateApiKey } from "@/lib/middleware/api-auth"
import { checkRateLimit } from "@/lib/middleware/rate-limit"
import { apiError, apiSuccess } from "@/lib/middleware/api-response"

export async function GET(req: NextRequest) {
  try {
    // Validate API key
    const authResult = await validateApiKey(req)
    if (!authResult.valid) {
      return apiError("authentication_error", authResult.error || "Invalid API key")
    }

    // Rate limit
    const rateLimitResult = await checkRateLimit(authResult.api_key_id, 60)
    if (!rateLimitResult.allowed) {
      return apiError("rate_limit_exceeded", "Rate limit exceeded", { rateLimit: rateLimitResult })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    
    const status = searchParams.get("status") || "published"
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    const { data: events, error, count } = await supabase
      .from("events")
      .select(`
        id,
        name,
        slug,
        description,
        short_description,
        location_name,
        location_city,
        location_state,
        starts_at,
        ends_at,
        doors_open_at,
        capacity,
        status,
        visibility,
        cover_image_url,
        tags,
        created_at,
        ticket_types (
          id,
          name,
          price_cents,
          quantity_total,
          quantity_sold,
          sales_start_at,
          sales_end_at
        )
      `, { count: "exact" })
      .eq("tenant_id", authResult.tenant_id)
      .eq("status", status)
      .order("starts_at", { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      return apiError("internal_error", error.message)
    }

    return apiSuccess({
      object: "list",
      data: events,
      has_more: (count || 0) > offset + limit,
      total_count: count,
    }, { rateLimit: rateLimitResult })
  } catch (error) {
    console.error("[API] Events GET error:", error)
    return apiError("internal_error", "An unexpected error occurred")
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateApiKey(req)
    if (!authResult.valid) {
      return apiError("authentication_error", authResult.error || "Invalid API key")
    }

    if (!authResult.scopes?.includes("write")) {
      return apiError("authorization_error", "API key does not have write permission")
    }

    const rateLimitResult = await checkRateLimit(authResult.api_key_id, 60)
    if (!rateLimitResult.allowed) {
      return apiError("rate_limit_exceeded", "Rate limit exceeded", { rateLimit: rateLimitResult })
    }

    const supabase = await createClient()
    const body = await req.json()

    const {
      name,
      slug,
      description,
      short_description,
      location_name,
      location_address,
      location_city,
      location_state,
      location_country,
      starts_at,
      ends_at,
      doors_open_at,
      capacity,
      is_online,
      online_url,
      cover_image_url,
      visibility,
      age_restriction,
      tags,
    } = body

    if (!name || !starts_at || !ends_at) {
      return apiError("invalid_request", "name, starts_at, and ends_at are required")
    }

    // Generate slug if not provided
    const eventSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

    const { data: event, error } = await supabase
      .from("events")
      .insert({
        tenant_id: authResult.tenant_id,
        name,
        slug: eventSlug,
        description,
        short_description,
        location_name,
        location_address,
        location_city,
        location_state,
        location_country: location_country || "US",
        starts_at,
        ends_at,
        doors_open_at,
        capacity,
        is_online: is_online || false,
        online_url,
        cover_image_url,
        visibility: visibility || "public",
        age_restriction,
        tags: tags || [],
        status: "draft",
        created_by: authResult.user_id || authResult.tenant_id, // Use tenant owner if no user
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return apiError("idempotency_error", "An event with this slug already exists", { code: "duplicate_slug" })
      }
      return apiError("internal_error", error.message)
    }

    return apiSuccess(event, { status: 201 })
  } catch (error) {
    console.error("[API] Events POST error:", error)
    return apiError("internal_error", "An unexpected error occurred")
  }
}
