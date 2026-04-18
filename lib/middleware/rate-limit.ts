import { createClient } from "@/lib/supabase/server"

// In-memory store for rate limiting (upgrade to Redis/Upstash for production)
const memoryStore = new Map<string, { count: number; resetAt: number }>()

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetAt < now) {
      memoryStore.delete(key)
    }
  }
}, 60000)

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: Date
  reset?: number
  error?: string
}

/**
 * Check rate limit by API key ID (wrapper for API routes)
 * Returns result with reset timestamp as epoch seconds
 */
export async function checkRateLimit(
  apiKeyId: string,
  limit: number = 60
): Promise<RateLimitResult & { reset: number }> {
  const result = rateLimit(apiKeyId, limit)
  return {
    ...result,
    reset: Math.floor(result.resetAt.getTime() / 1000),
  }
}

/**
 * Rate limit requests per tenant per minute
 * Uses in-memory store (upgrade to Redis for multi-instance deployments)
 */
export function rateLimit(
  tenantId: string,
  limit: number = 60
): RateLimitResult {
  const now = Date.now()
  const windowMs = 60000 // 1 minute window
  const key = `rate:${tenantId}:${Math.floor(now / windowMs)}`

  const current = memoryStore.get(key) || { count: 0, resetAt: now + windowMs }

  if (current.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: new Date(current.resetAt),
      error: `Rate limit exceeded. Try again in ${Math.ceil((current.resetAt - now) / 1000)} seconds.`,
    }
  }

  current.count++
  memoryStore.set(key, current)

  return {
    allowed: true,
    limit,
    remaining: limit - current.count,
    resetAt: new Date(current.resetAt),
  }
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set("X-RateLimit-Limit", result.limit.toString())
  headers.set("X-RateLimit-Remaining", result.remaining.toString())
  headers.set("X-RateLimit-Reset", result.resetAt.toISOString())
}

/**
 * Database-backed rate limiter (more accurate, persists across deployments)
 * Use this for critical endpoints like payouts
 */
export async function rateLimitPersistent(
  tenantId: string,
  endpoint: string,
  limit: number = 10
): Promise<RateLimitResult> {
  const supabase = await createClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() - 60000) // 1 minute ago

  // Count requests in the last minute
  const { count, error } = await supabase
    .from("api_request_log")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("path", endpoint)
    .gte("created_at", windowStart.toISOString())

  if (error) {
    console.error("[Rate Limit] Database error:", error)
    // Fail open but log the error
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetAt: new Date(now.getTime() + 60000),
    }
  }

  const used = count || 0
  const remaining = Math.max(0, limit - used)

  if (used >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: new Date(now.getTime() + 60000),
      error: "Rate limit exceeded for this endpoint",
    }
  }

  return {
    allowed: true,
    limit,
    remaining,
    resetAt: new Date(now.getTime() + 60000),
  }
}
