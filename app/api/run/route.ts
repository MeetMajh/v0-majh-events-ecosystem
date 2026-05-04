import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { task } = await req.json();

  const context = await fetch("http://localhost:3000/api/ai/context", {
    method: "POST",
    body: JSON.stringify({
      scope: ["db.schema", "rls"]
    })
  }).then(res => res.json());

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
