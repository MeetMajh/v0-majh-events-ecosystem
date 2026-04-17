import { createClient } from "@/lib/supabase/server"
import { validateApiKey, hasScope } from "@/lib/middleware/api-auth"
import { rateLimit } from "@/lib/middleware/rate-limit"
import { logApiRequest } from "@/lib/middleware/idempotency"
import { apiError, apiSuccess } from "@/lib/middleware/api-response"

export async function GET(req: Request) {
  const startTime = Date.now()

  try {
    // 1. Authenticate
    const auth = await validateApiKey(req)
    if (!auth.valid) {
      return apiError("authentication_error", auth.error || "Invalid API key")
    }

    // 2. Check scope
    if (!hasScope(auth, "read")) {
      return apiError("authorization_error", "API key does not have 'read' scope")
    }

    // 3. Rate limit
    const rateLimitResult = rateLimit(auth.tenant_id)
    if (!rateLimitResult.allowed) {
      return apiError("rate_limit_exceeded", rateLimitResult.error || "Rate limit exceeded", {
        rateLimit: rateLimitResult,
      })
    }

    // 4. Get tenant usage from Supabase RPC
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("get_tenant_usage", {
      p_tenant_id: auth.tenant_id,
    })

    if (error) {
      console.error("[API v1/usage] RPC error:", error)
      return apiError("internal_error", "Failed to fetch usage data")
    }

    // 5. Log request
    const duration = Date.now() - startTime
    await logApiRequest(req, auth.tenant_id, auth.api_key_id, 200, duration)

    return apiSuccess(data, { rateLimit: rateLimitResult })
  } catch (err) {
    console.error("[API v1/usage] Error:", err)
    return apiError("internal_error", "An unexpected error occurred")
  }
}
