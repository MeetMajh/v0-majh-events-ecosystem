import { NextResponse } from "next/server"
import { RateLimitResult, addRateLimitHeaders } from "./rate-limit"

export type ApiErrorType =
  | "invalid_request"
  | "authentication_error"
  | "authorization_error"
  | "rate_limit_exceeded"
  | "resource_not_found"
  | "idempotency_error"
  | "insufficient_funds"
  | "validation_error"
  | "internal_error"

interface ApiError {
  type: ApiErrorType
  message: string
  code?: string
  param?: string
}

interface ApiErrorResponse {
  error: ApiError
}

const STATUS_CODES: Record<ApiErrorType, number> = {
  invalid_request: 400,
  authentication_error: 401,
  authorization_error: 403,
  rate_limit_exceeded: 429,
  resource_not_found: 404,
  idempotency_error: 409,
  insufficient_funds: 402,
  validation_error: 422,
  internal_error: 500,
}

/**
 * Create a structured error response (Stripe-style)
 */
export function apiError(
  type: ApiErrorType,
  message: string,
  options?: {
    code?: string
    param?: string
    rateLimit?: RateLimitResult
  }
): NextResponse<ApiErrorResponse> {
  const status = STATUS_CODES[type]
  const headers = new Headers()

  if (options?.rateLimit) {
    addRateLimitHeaders(headers, options.rateLimit)
  }

  return NextResponse.json(
    {
      error: {
        type,
        message,
        ...(options?.code && { code: options.code }),
        ...(options?.param && { param: options.param }),
      },
    },
    { status, headers }
  )
}

/**
 * Create a successful response with optional rate limit headers
 */
export function apiSuccess<T>(
  data: T,
  options?: {
    rateLimit?: RateLimitResult
    status?: number
  }
): NextResponse<T> {
  const headers = new Headers()

  if (options?.rateLimit) {
    addRateLimitHeaders(headers, options.rateLimit)
  }

  return NextResponse.json(data, {
    status: options?.status || 200,
    headers,
  })
}

/**
 * Create a paginated list response
 */
export function apiList<T>(
  data: T[],
  options: {
    hasMore: boolean
    rateLimit?: RateLimitResult
  }
): NextResponse<{ data: T[]; has_more: boolean }> {
  const headers = new Headers()

  if (options?.rateLimit) {
    addRateLimitHeaders(headers, options.rateLimit)
  }

  return NextResponse.json(
    {
      data,
      has_more: options.hasMore,
    },
    { headers }
  )
}
