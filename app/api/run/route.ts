import { NextResponse } from "next/server";
import { getSchema, getRLS } from "@/lib/supabase/introspection";

export async function POST(req: Request) {
  const { task } = await req.json();

  const [schema, rls] = await Promise.all([getSchema(), getRLS()]);
  const context = { schema, rls };

  const prompt = `
You are the MAJH Architect.

CONTEXT:
${JSON.stringify(context)}

TASK:
${task}

OUTPUT:
Plan, Code, Risks
`;

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

  return NextResponse.json({ result: data });
}
