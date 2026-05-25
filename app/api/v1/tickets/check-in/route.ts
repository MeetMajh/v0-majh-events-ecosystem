import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateApiKey } from "@/lib/middleware/api-auth"
import { checkRateLimit } from "@/lib/middleware/rate-limit"
import { apiError, apiSuccess } from "@/lib/middleware/api-response"

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateApiKey(req)
    if (!authResult.valid) {
      return apiError("authentication_error", authResult.error || "Invalid API key", 401)
    }

    if (!authResult.scopes?.includes("write")) {
      return apiError("permission_denied", "API key does not have write permission", 403)
    }

    const rateLimitResult = await checkRateLimit(authResult.api_key_id, 120) // Higher limit for check-ins
    if (!rateLimitResult.allowed) {
      return apiError("rate_limit_exceeded", "Rate limit exceeded", 429)
    }

    const supabase = await createClient()
    const body = await req.json()

    const { ticket_id, qr_code, location, performed_by } = body

    if (!ticket_id && !qr_code) {
      return apiError("invalid_request", "ticket_id or qr_code is required", 400)
    }

    let result

    if (qr_code) {
      // Scan by QR code
      const { data, error } = await supabase.rpc("scan_ticket_qr", {
        p_qr_code: qr_code,
        p_performed_by: performed_by || authResult.user_id,
        p_location: location || null,
      })

      if (error) {
        return apiError("database_error", error.message, 500)
      }
      result = data
    } else {
      // Check in by ticket ID
      const { data, error } = await supabase.rpc("check_in_ticket", {
        p_ticket_id: ticket_id,
        p_performed_by: performed_by || authResult.user_id,
        p_location: location || null,
      })

      if (error) {
        return apiError("database_error", error.message, 500)
      }
      result = data
    }

    if (!result?.success) {
      return apiError("check_in_failed", result?.error || "Check-in failed", 400, {}, {
        checked_in_at: result?.checked_in_at,
      })
    }

    return apiSuccess({
      success: true,
      ticket_id: result.ticket_id,
      ticket_number: result.ticket_number,
      attendee_name: result.attendee_name,
      event_name: result.event_name,
      checked_in_at: result.checked_in_at,
    })
  } catch (error) {
    console.error("[API] Ticket Check-in error:", error)
    return apiError("internal_error", "An unexpected error occurred", 500)
  }
}

// Bulk check-in for importing attendee lists
export async function PUT(req: NextRequest) {
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

    const { ticket_ids, location, performed_by } = body

    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return apiError("invalid_request", "ticket_ids array is required", 400)
    }

    if (ticket_ids.length > 100) {
      return apiError("invalid_request", "Maximum 100 tickets per batch", 400)
    }

    const results = await Promise.all(
      ticket_ids.map(async (ticketId: string) => {
        const { data } = await supabase.rpc("check_in_ticket", {
          p_ticket_id: ticketId,
          p_performed_by: performed_by || authResult.user_id,
          p_location: location || null,
        })
        return { ticket_id: ticketId, ...data }
      })
    )

    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    return apiSuccess({
      total: ticket_ids.length,
      successful: successful.length,
      failed: failed.length,
      results,
    })
  } catch (error) {
    console.error("[API] Bulk Check-in error:", error)
    return apiError("internal_error", "An unexpected error occurred", 500)
  }
}
