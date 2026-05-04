// /app/api/ai/run/route.ts
import { NextResponse } from "next/server";
import { getSchema, getRLS } from "@/lib/supabase/introspection";

// 🔬 Schema DNA builder
function buildSchemaDNA(schema: any[]) {
  return schema.map((table: any) => ({
    name: table.table_name,
    columns: table.columns?.reduce((acc: any, col: any) => {
      acc[col.column_name] = col.data_type;
      return acc;
    }, {}) || {},
    relationships:
      table.foreign_keys?.map((fk: any) => ({
        from: fk.column,
        to: fk.references_table
      })) || []
  }));
}

function translateRLS(policies: any[]) {
  return policies.map((p: any) => ({
    table: p.tablename,
    rule: p.qual?.includes("auth.uid()")
      ? "User owns this data"
      : "Custom policy"
  }));
}

export async function POST(req: Request) {
  const { task } = await req.json();

  // 🔐 Pull REAL system context
  const rawSchema = await getSchema();
  const rawRLS = await getRLS();

  const schemaDNA = buildSchemaDNA(rawSchema);
  const rls = translateRLS(rawRLS);

  // 🧠 Build controlled prompt
  const prompt = `
You are the MAJH Architect.

REAL SYSTEM (SOURCE OF TRUTH):
Schema:
${JSON.stringify(schemaDNA, null, 2)}

RLS:
${JSON.stringify(rls, null, 2)}

STRICT RULES:
- Do NOT recreate existing tables
- Only extend current schema
- Respect relationships
- Respect RLS
- If unsure, ask instead of assuming

TASK:
${task}

OUTPUT FORMAT:
1. Plan
2. Code
3. Risks
4. Required Env Vars (names only)
`;

  // 🤖 Call :contentReference[oaicite:0]{index=0}
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CLAUDE_API_KEY!,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-opus",
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();

  return NextResponse.json({
    result: data.content
  });
}
