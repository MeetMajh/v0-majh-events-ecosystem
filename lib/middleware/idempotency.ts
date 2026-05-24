import { createClient } from "@/lib/supabase/server"

export interface IdempotencyResult {
  found: boolean
  response?: {
    status: number
    body: unknown
  }
}

/**
 * Check if a request with this idempotency key was already processed
 * Returns the cached response if found
 */
export async function checkIdempotency(
  req: Request,
  tenantId: string
): Promise<IdempotencyResult> {
  const idempotencyKey = req.headers.get("idempotency-key")
  
  if (!idempotencyKey) {
    return { found: false }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("api_request_log")
    .select("response_status, response_body")
    .eq("tenant_id", tenantId)
    .eq("idempotency_key", idempotencyKey)
    .single()

  if (error || !data) {
    return { found: false }
  }

  return {
    found: true,
    response: {
      status: data.response_status || 200,
      body: data.response_body,
    },
  }
}

/**
 * Store the response for an idempotent request
 */
export async function storeIdempotency(
  req: Request,
  tenantId: string,
  apiKeyId: string | null,
  response: {
    status: number
    body: unknown
  },
  durationMs: number
): Promise<void> {
  const idempotencyKey = req.headers.get("idempotency-key")
  
  if (!idempotencyKey) {
    return // No idempotency key, nothing to store
  }

  const supabase = await createClient()
  const url = new URL(req.url)

  await supabase.from("api_request_log").insert({
    tenant_id: tenantId,
    api_key_id: apiKeyId,
    idempotency_key: idempotencyKey,
    method: req.method,
    path: url.pathname,
    response_status: response.status,
    response_body: response.body,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] || null,
    user_agent: req.headers.get("user-agent"),
    duration_ms: durationMs,
  })
}

/**
 * Alias for storeIdempotency (for backwards compatibility)
 */
export const storeIdempotentResponse = storeIdempotency

/**
 * Log an API request (without idempotency)
 */
export async function logApiRequest(
  req: Request,
  tenantId: string,
  apiKeyId: string | null,
  responseStatus: number,
  durationMs: number
): Promise<void> {
  const supabase = await createClient()
  const url = new URL(req.url)

  await supabase.from("api_request_log").insert({
    tenant_id: tenantId,
    api_key_id: apiKeyId,
    method: req.method,
    path: url.pathname,
    response_status: responseStatus,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] || null,
    user_agent: req.headers.get("user-agent"),
    duration_ms: durationMs,
  })
}
