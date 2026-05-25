import { NextResponse } from "next/server";
import { getSchema, getRLS } from "@/lib/supabase/introspection";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return new Response("Unauthorized", { status: 401 });

  // Verify platform/tenant executive authority
  const { data: staffRole } = await supabase
    .from("organization_members")
    .select("role_key")
    .eq("user_id", user.id)
    .in("role_key", ["PLATFORM_OWNER", "TENANT_OWNER", "TENANT_SUPER_ADMIN"])
    .single()

  if (!staffRole) {
    // Check if they are legacy admin/owner as a fallback
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["owner", "admin"].includes(profile.role)) {
       return new Response("Unauthorized. Requires PLATFORM_OWNER or legacy admin.", { status: 401 })
    }
  }

  const { task } = await req.json();

  const [schema, rls] = await Promise.all([getSchema(), getRLS()]);
  const context = { schema, rls };

  const prompt = `
You are the MAJH OS Database Architect & Platform Assistant.

You are interacting with a verified Platform Owner or Tenant Executive.
You have live access to the production Supabase PostgreSQL schema and Row Level Security (RLS) policies.

Here is the LIVE SCHEMA:
${JSON.stringify(context)}

CORE PLATFORM RULES:
1. MAJH OS uses a 5-layer multi-tenant role hierarchy via the \`organization_members\` table. 
   Roles are SCREAMING_SNAKE_CASE (e.g., PLATFORM_OWNER, TENANT_OWNER, DEPARTMENT_MANAGER).
2. Financials MUST ALWAYS be scoped. \`ledger_transactions\` and \`ledger_entries\` must include \`department_id\` and \`location_id\`.
3. Do not suggest bypassing RLS. Use Service Role keys ONLY for cron jobs, webhooks, or absolute platform admin scripts.
4. When writing code, ensure backward compatibility for old \`staff_roles\` logic while migrating to \`organization_members\`.

TASK:
${task}

OUTPUT:
Plan, Code, Risks
`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CLAUDE_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
     return NextResponse.json({ error: await res.text() }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ result: data });
}
