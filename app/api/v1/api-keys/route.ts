import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

// Generate a Stripe-style API key
function generateApiKey(environment: string): { key: string; prefix: string; hash: string } {
  const prefix = environment === "live" ? "sk_live_" : "sk_test_"
  const randomPart = crypto.randomBytes(24).toString("base64url")
  const key = prefix + randomPart
  const hash = crypto.createHash("sha256").update(key).digest("hex")
  return { key, prefix: prefix + randomPart.slice(0, 8), hash }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's tenant
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 })
    }

    // Get API keys for this tenant
    const { data: apiKeys, error } = await supabase
      .from("api_keys")
      .select("id, key_prefix, name, environment, scopes, last_used_at, created_at")
      .eq("tenant_id", membership.tenant_id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ api_keys: apiKeys })
  } catch (error) {
    console.error("Failed to get API keys:", error)
    return NextResponse.json({ error: "Failed to get API keys" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, environment = "test", scopes = ["read", "write"], tenant_id } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Verify user has permission (owner or admin)
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .single()

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Generate the API key
    const { key, prefix, hash } = generateApiKey(environment)

    // Store the key (hashed)
    const { data: apiKey, error } = await supabase
      .from("api_keys")
      .insert({
        tenant_id: membership.tenant_id,
        key_hash: hash,
        key_prefix: prefix,
        name: name.trim(),
        environment,
        scopes,
        created_by: user.id,
      })
      .select("id")
      .single()

    if (error) throw error

    // Return the full key only once
    return NextResponse.json({ 
      id: apiKey.id,
      key,
      key_prefix: prefix,
      message: "Store this key securely. You won't be able to see it again."
    })
  } catch (error) {
    console.error("Failed to create API key:", error)
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const keyId = searchParams.get("id")

    if (!keyId) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 })
    }

    // Get the key to verify ownership
    const { data: apiKey } = await supabase
      .from("api_keys")
      .select("tenant_id")
      .eq("id", keyId)
      .single()

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 })
    }

    // Verify user has permission
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", apiKey.tenant_id)
      .single()

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Revoke the key
    const { error } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", keyId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to revoke API key:", error)
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 })
  }
}
