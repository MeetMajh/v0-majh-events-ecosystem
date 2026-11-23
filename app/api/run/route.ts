import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { getSchema, getRLS } from "@/lib/supabase/introspection";
import { manifestFor } from "@/lib/grounding/manifest";
import { Session, gate } from "@/lib/grounding/gate";
import { guardIdentity } from "@/lib/grounding/identity";
import { ralphSystemPrompt, auditPrompt } from "@/lib/grounding/prompt";
import { persistTurn } from "@/lib/ralph/transcript";

export const dynamic = "force-dynamic";

/*
  Ralph — the in-product concierge.

  This route previously had four problems, and three of them meant it had
  almost certainly never returned a successful answer:

    1. NO AUTHENTICATION. Anyone who could reach the URL got the database's
       full schema AND its RLS configuration interpolated into a prompt, and
       spent this project's Anthropic credits doing it. The repository
       already had the right pattern next door: /api/ai/context calls
       requireAdmin(). This now does too.
    2. `model: "claude-3-opus"` is not a current model identifier.
    3. No `max_tokens`, which the Messages API requires.
    4. No `anthropic-version` header, which the Messages API also requires.

  And the thing that prompted the rewrite: Ralph was ungated while Cable —
  the local dev tool — had the grounding gate. That was backwards. The
  prompt here is now GENERATED from the tool registry, and the answer is
  checked against an evidence ledger before it is returned.

  See majh-foundry/03-deliverables/ralph/GROUNDING_FINDING.md for why a
  firmer instruction was not the fix.

  A fifth problem, closed 2026-11-22: the route answered and remembered
  nothing. public.guide_conversations and public.guide_messages have existed
  all along, correctly shaped and RLS-protected, at zero rows, because no
  code wrote them — guide_messages even carries a `tools_called` column for
  exactly the ledger this route builds and then threw away. Every turn is now
  recorded, including the ones the gate refuses, because a transcript that
  only keeps the successes is not evidence of anything.
*/

/*
  What this deployment can actually see.

  Derived from the tools this route really calls, not from a hand-kept list
  and not from anything a document claims. getSchema() and getRLS() are
  read-only introspection of the database's own structure, which is
  platform state — so `introspect_schema` is the one capability here.

  It cannot read the codebase, documentation, commit history, or tenant
  rows. The generated prompt says so in those words, and the gate refuses
  claims of those kinds rather than trusting the model to have noticed.
*/
const MOUNTED_TOOLS = ["introspect_schema"] as const;

const { capabilities, unspecified } = manifestFor([...MOUNTED_TOOLS]);
const SYSTEM_PROMPT = ralphSystemPrompt(capabilities);

// Boot guard: a prompt that names a tool this deployment does not have is a
// bug, and it should be loud here rather than quiet in an answer.
const audit = auditPrompt(SYSTEM_PROMPT, capabilities);

export async function POST(req: Request) {
  // Same contract as /api/ai/context next door: { user } or { error: Response }.
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  if (!audit.ok) {
    return NextResponse.json(
      { error: "Prompt audit failed", claimedButNotWired: audit.claimedButNotWired },
      { status: 500 }
    );
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "CLAUDE_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let task: string;
  let conversationId: string | undefined;
  try {
    const body = await req.json();
    task = String(body?.task ?? "").trim();
    const raw = body?.conversationId;
    conversationId = typeof raw === "string" && raw.length > 0 ? raw : undefined;
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }
  if (!task) {
    return NextResponse.json({ error: "A task is required" }, { status: 400 });
  }

  /*
    The transcript is written with the CALLER'S client, not a service-role
    one. Both guide_* policies are `FOR ALL USING (user_id = auth.uid())`,
    which Postgres also applies as the insert check, so ownership is enforced
    by the database rather than by this route remembering to filter.
  */
  const supabase = await createClient();
  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-5";

  /*
    The evidence ledger for this turn.

    Each introspection call is recorded with whether it actually returned
    something. A failed or empty read is recorded as a FAILED call, not as
    an observation — that inversion is the whole defect this gate exists
    for, and it is why the ledger is built from results rather than from
    intentions.
  */
  const session = new Session(capabilities);

  const [schemaResult, rlsResult] = await Promise.allSettled([
    getSchema(),
    getRLS(),
  ]);

  const schema = schemaResult.status === "fulfilled" ? schemaResult.value : null;
  const rls = rlsResult.status === "fulfilled" ? rlsResult.value : null;

  session.record({
    tool: "introspect_schema",
    input: { of: "schema" },
    ok: schemaResult.status === "fulfilled" && !!schema,
    output: schema ? JSON.stringify(schema).slice(0, 2000) : undefined,
  });
  session.record({
    tool: "introspect_schema",
    input: { of: "rls" },
    ok: rlsResult.status === "fulfilled" && !!rls,
    output: rls ? JSON.stringify(rls).slice(0, 2000) : undefined,
  });

  const evidence = session.evidence();
  if (evidence.length === 0) {
    // Nothing was read, so nothing can be grounded. Say that rather than
    // asking a model to improvise around it.
    const answer =
      "I could not read the schema just now, so I have nothing to work " +
      "from. I would rather say that than describe the database from " +
      "memory.";

    /*
      This turn is recorded too. A thread that silently skips the times
      Ralph could not see anything would misrepresent how often that
      happens, which is one of the few things a transcript is uniquely able
      to tell you.
    */
    const transcript = await persistTurn(
      supabase,
      auth.user.id,
      {
        task,
        answer,
        calls: session.calls,
        verdict: {
          allowed: false,
          reason: "no successful tool call",
          replacement: answer,
          claims: [],
        },
        model,
      },
      conversationId
    );

    return NextResponse.json({
      result: answer,
      conversationId: transcript.conversationId,
      transcript: transcript.ok ? { saved: true } : { saved: false, reason: transcript.reason },
      grounding: { allowed: false, reason: "no successful tool call", evidence: [] },
    });
  }

  const userPrompt = [
    `TASK:\n${task}`,
    "",
    "WHAT YOU READ (this turn, the only thing you may treat as fact):",
    schema ? `schema: ${JSON.stringify(schema)}` : "schema: UNAVAILABLE",
    rls ? `rls: ${JSON.stringify(rls)}` : "rls: UNAVAILABLE",
    "",
    "Answer from the above only. Where it does not cover something, say so.",
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: "Model request failed", status: res.status, detail: detail.slice(0, 500) },
      { status: 502 }
    );
  }

  const data = await res.json();
  const draft: string =
    (Array.isArray(data?.content)
      ? data.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n")
      : "") || "";

  /*
    Two checks, in this order, both outside the model.

    Identity first: an answer that has introduced itself as somebody else's
    model is replaced wholesale, so the gate then sees the replacement
    rather than the leak.
  */
  const identity = guardIdentity(draft, "ralph");
  const afterIdentity = identity.clean ? draft : identity.text;

  const verdict = gate(afterIdentity, session);
  const answer = verdict.allowed ? afterIdentity : verdict.replacement;

  /*
    Persisted after the gate, so `content` is what the user was actually
    shown. When the gate refused, the draft it refused is kept in
    `grounding.withheld` — unrecoverable once discarded, and precisely what
    an audit of a grounded assistant goes looking for.

    A failed write never costs the user their answer: persistTurn returns an
    outcome rather than throwing, and the answer is returned either way with
    the failure reported alongside it.
  */
  const transcript = await persistTurn(
    supabase,
    auth.user.id,
    {
      task,
      answer,
      calls: session.calls,
      verdict,
      identityViolations: identity.clean ? undefined : identity.violations,
      withheld: verdict.allowed ? undefined : afterIdentity,
      model,
    },
    conversationId
  );

  return NextResponse.json({
    result: answer,
    conversationId: transcript.conversationId,
    transcript: transcript.ok ? { saved: true } : { saved: false, reason: transcript.reason },
    grounding: {
      allowed: verdict.allowed,
      claims: verdict.claims.map((c) => c.why),
      evidence: verdict.allowed ? verdict.citedEvidence : [],
      reason: verdict.allowed ? undefined : verdict.reason,
      identityReplaced: identity.clean ? undefined : identity.violations,
      withheld: verdict.allowed ? undefined : afterIdentity,
      unspecifiedTools: unspecified.length ? unspecified : undefined,
    },
  });
}
