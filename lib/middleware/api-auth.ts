import { createClient } from "@/lib/supabase/server"

export interface ApiAuthResult {
  valid: boolean
  tenant_id: string
  api_key_id: string
  environment: "test" | "live"
  scopes: string[]
  error?: string
}

/**
 * Validates an API key from the Authorization header
 * Returns tenant context for the request
 */
export async function validateApiKey(req: Request): Promise<ApiAuthResult> {
  const authHeader = req.headers.get("authorization")
  
  if (!authHeader) {
    return {
      valid: false,
      tenant_id: "",
      api_key_id: "",
      environment: "test",
      scopes: [],
      error: "Missing Authorization header. Use: Authorization: Bearer sk_live_xxx",
    }
  }

  const key = authHeader.replace("Bearer ", "").trim()
  
  if (!key.startsWith("sk_live_") && !key.startsWith("sk_test_")) {
    return {
      valid: false,
      tenant_id: "",
      api_key_id: "",
      environment: "test",
      scopes: [],
      error: "Invalid API key format. Keys must start with sk_live_ or sk_test_",
    }
  }

  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc("validate_api_key", {
    p_key: key,
  })

  if (error) {
    console.error("[API Auth] Validation error:", error)
    return {
      valid: false,
      tenant_id: "",
      api_key_id: "",
      environment: "test",
      scopes: [],
      error: "Failed to validate API key",
    }
  }

  if (!data?.valid) {
    return {
      valid: false,
      tenant_id: "",
      api_key_id: "",
      environment: "test",
      scopes: [],
      error: data?.error || "Invalid or expired API key",
    }
  }

  return {
    valid: true,
    tenant_id: data.tenant_id,
    api_key_id: data.api_key_id,
    environment: data.environment,
    scopes: data.scopes || ["read", "write"],
  }
}

/**
 * Check if a scope is allowed for the API key
 */
export function hasScope(auth: ApiAuthResult, scope: string): boolean {
  return auth.scopes.includes(scope) || auth.scopes.includes("*")
}
