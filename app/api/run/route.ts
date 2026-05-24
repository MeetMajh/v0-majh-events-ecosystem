import { NextResponse } from "next/server"
import { getSchema, getRLS } from "@/lib/supabase/introspection"
import { createClient } from "@/lib/supabase/server"

// Vercel AI SDK integration for streaming responses
import { generateText, streamText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"

// Ensures only authorized admins/owners can hit this route
async function authorize() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Ensure they are a platform owner or tenant executive
  const { data: staffRole } = await supabase
    .from("organization_members")
    .select("role_key")
    .eq("user_id", user.id)
    .in("role_key", ["PLATFORM_OWNER", "TENANT_OWNER", "TENANT_SUPER_ADMIN"])
    .single()

  if (!staffRole) return null

  return user
}

export async function POST(req: Request) {
  try {
    const user = await authorize()
    if (!user) {
      return new Response("Unauthorized. Requires PLATFORM_OWNER, TENANT_OWNER, or TENANT_SUPER_ADMIN.", { status: 401 })
    }

    const { messages } = await req.json()

    // Grab live introspection data
    const [schema, rls] = await Promise.all([getSchema(), getRLS()])

    // Format the context for the AI
    const systemPrompt = `
You are the MAJH OS Database Architect & Platform Assistant.

You are interacting with a verified Platform Owner or Tenant Executive.
You have live access to the production Supabase PostgreSQL schema and Row Level Security (RLS) policies.

Here is the LIVE SCHEMA:
${JSON.stringify(schema)}

Here are the LIVE RLS POLICIES:
${JSON.stringify(rls)}

CORE PLATFORM RULES:
1. MAJH OS uses a 5-layer multi-tenant role hierarchy via the \`organization_members\` table. 
   Roles are SCREAMING_SNAKE_CASE (e.g., PLATFORM_OWNER, TENANT_OWNER, DEPARTMENT_MANAGER).
2. Financials MUST ALWAYS be scoped. \`ledger_transactions\` and \`ledger_entries\` must include \`department_id\` and \`location_id\`.
3. Do not suggest bypassing RLS. Use Service Role keys ONLY for cron jobs, webhooks, or absolute platform admin scripts.
4. When writing code, ensure backward compatibility for old \`staff_roles\` logic while migrating to \`organization_members\`.

Answer the user's architectural questions, write SQL migrations, review RLS policies, and generate Next.js/React code as requested.
Think step-by-step, outline the plan, then provide the code. Warn about any security or tenant-leak risks.
`

    // Stream the response back using AI SDK
    const result = streamText({
      model: anthropic("claude-3-5-sonnet-20240620", { apiKey: process.env.CLAUDE_API_KEY }),
      system: systemPrompt,
      messages,
      temperature: 0.2, // Keep it deterministic and factual for architecture
    })

    return result.toDataStreamResponse()

  } catch (err: any) {
    console.error("[Architect API] Error:", err)
    return new Response(err.message || "Internal Server Error", { status: 500 })
  }
}
