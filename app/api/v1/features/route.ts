import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateApiKey } from "@/lib/middleware/api-auth"
import { checkRateLimit } from "@/lib/middleware/rate-limit"
import { apiError, apiSuccess } from "@/lib/middleware/api-response"

/**
 * GET /api/v1/features
 * Get all features and their enabled status for the authenticated tenant
 */
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

    const { data: features, error } = await supabase.rpc("get_tenant_features", {
      p_tenant_id: authResult.tenant_id,
    })

    if (error) {
      return apiError("database_error", error.message, 500)
    }

    return apiSuccess({
      object: "list",
      data: features,
    })
  } catch (error) {
    console.error("[API] Features GET error:", error)
    return apiError("internal_error", "An unexpected error occurred", 500)
  }
}

/**
 * POST /api/v1/features/check
 * Check if a specific feature is enabled
 * Body: { feature: "ticketing" }
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await validateApiKey(req)
    if (!authResult.valid) {
      return apiError("authentication_error", authResult.error || "Invalid API key", 401)
    }

    const supabase = await createClient()
    const body = await req.json()
    
    const { feature } = body

    if (!feature) {
      return apiError("invalid_request", "feature key is required", 400)
    }

    const { data: isEnabled, error } = await supabase.rpc("has_feature", {
      p_tenant_id: authResult.tenant_id,
      p_feature_key: feature,
    })

    if (error) {
      return apiError("database_error", error.message, 500)
    }

    return apiSuccess({
      feature,
      enabled: isEnabled === true,
      tenant_id: authResult.tenant_id,
    })
  } catch (error) {
    console.error("[API] Feature check error:", error)
    return apiError("internal_error", "An unexpected error occurred", 500)
  }
}
