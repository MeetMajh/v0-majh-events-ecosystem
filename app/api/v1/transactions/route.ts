import { createClient } from "@/lib/supabase/server"
import { validateApiKey, hasScope } from "@/lib/middleware/api-auth"
import { rateLimit } from "@/lib/middleware/rate-limit"
import { checkIdempotency, storeIdempotency, logApiRequest } from "@/lib/middleware/idempotency"
import { apiError, apiSuccess, apiList } from "@/lib/middleware/api-response"

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

    // 4. Parse query params
    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 100)
    const offset = parseInt(url.searchParams.get("offset") || "0")
    const type = url.searchParams.get("type") // deposit, withdrawal, etc.

    // 5. Fetch transactions from ledger
    const supabase = await createClient()
    let query = supabase
      .from("ledger_transactions")
      .select(`
        id,
        transaction_type,
        status,
        description,
        idempotency_key,
        reference_id,
        reference_type,
        posted_at,
        created_at,
        ledger_entries (
          id,
          direction,
          amount_cents,
          ledger_accounts (
            id,
            account_type,
            name
          )
        )
      `)
      .eq("tenant_id", auth.tenant_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit)

    if (type) {
      query = query.eq("transaction_type", type)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("[API v1/transactions] Query error:", error)
      return apiError("internal_error", "Failed to fetch transactions")
    }

    // 6. Log request
    const duration = Date.now() - startTime
    await logApiRequest(req, auth.tenant_id, auth.api_key_id, 200, duration)

    return apiList(data || [], {
      hasMore: (data?.length || 0) === limit,
      rateLimit: rateLimitResult,
    })
  } catch (err) {
    console.error("[API v1/transactions] Error:", err)
    return apiError("internal_error", "An unexpected error occurred")
  }
}

export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    // 1. Authenticate
    const auth = await validateApiKey(req)
    if (!auth.valid) {
      return apiError("authentication_error", auth.error || "Invalid API key")
    }

    // 2. Check scope
    if (!hasScope(auth, "write")) {
      return apiError("authorization_error", "API key does not have 'write' scope")
    }

    // 3. Rate limit (stricter for writes)
    const rateLimitResult = rateLimit(auth.tenant_id, 30) // 30/min for writes
    if (!rateLimitResult.allowed) {
      return apiError("rate_limit_exceeded", rateLimitResult.error || "Rate limit exceeded", {
        rateLimit: rateLimitResult,
      })
    }

    // 4. Check idempotency
    const idempotencyKey = req.headers.get("idempotency-key")
    if (idempotencyKey) {
      const cached = await checkIdempotency(req, auth.tenant_id)
      if (cached.found && cached.response) {
        return apiSuccess(cached.response.body, { rateLimit: rateLimitResult })
      }
    }

    // 5. Parse body
    const body = await req.json()
    const { type, amount_cents, user_id, description } = body

    if (!type || !amount_cents || !user_id) {
      return apiError("validation_error", "Missing required fields: type, amount_cents, user_id")
    }

    // 6. Process transaction based on type
    const supabase = await createClient()
    let result

    switch (type) {
      case "deposit":
        const { data: depositData, error: depositError } = await supabase.rpc("ledger_deposit", {
          p_tenant_id: auth.tenant_id,
          p_user_id: user_id,
          p_amount_cents: amount_cents,
          p_stripe_session_id: body.stripe_session_id || null,
          p_idempotency_key: idempotencyKey,
        })
        if (depositError) throw depositError
        result = depositData
        break

      case "withdrawal":
        const { data: withdrawData, error: withdrawError } = await supabase.rpc("ledger_withdrawal", {
          p_tenant_id: auth.tenant_id,
          p_user_id: user_id,
          p_amount_cents: amount_cents,
          p_idempotency_key: idempotencyKey,
        })
        if (withdrawError) throw withdrawError
        result = withdrawData
        break

      default:
        return apiError("validation_error", `Unknown transaction type: ${type}`, { param: "type" })
    }

    // 7. Store idempotency response
    const duration = Date.now() - startTime
    if (idempotencyKey) {
      await storeIdempotency(req, auth.tenant_id, auth.api_key_id, { status: 200, body: result }, duration)
    } else {
      await logApiRequest(req, auth.tenant_id, auth.api_key_id, 200, duration)
    }

    return apiSuccess(result, { rateLimit: rateLimitResult, status: 201 })
  } catch (err) {
    console.error("[API v1/transactions] Error:", err)
    return apiError("internal_error", "An unexpected error occurred")
  }
}
