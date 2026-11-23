import type { SupabaseClient } from "@supabase/supabase-js"
import type { ToolResult, Verdict } from "@/lib/grounding/gate"

/**
 * Ralph's transcript.
 *
 * `guide_conversations` and `guide_messages` existed, correctly shaped and
 * RLS-protected, at zero rows, because nothing ever wrote them. This is the
 * consumer they were waiting for.
 *
 * Two rules shape everything here:
 *
 *   1. A failed persist must never cost the user their answer. Every function
 *      returns an outcome instead of throwing, and the route returns the
 *      answer regardless.
 *   2. The transcript has to be able to disagree with itself. A turn the gate
 *      withheld is written as the turn the user actually saw, with the
 *      withheld draft in `grounding`. A transcript that only records
 *      successes is not evidence of anything.
 *
 * Writes go through the CALLER'S client, not a service-role one. The policies
 * on both tables are `FOR ALL USING (user_id = auth.uid())`, which Postgres
 * also applies as the insert check, so ownership is enforced by the database
 * rather than by this file remembering to filter. Proved under RLS in
 * migration 038: a cross-account write is refused with 42501.
 */

export type TurnRecord = {
  /** What was asked. Stored as the `user` message. */
  task: string
  /** What the user actually saw, after the identity guard and the gate. */
  answer: string
  /**
   * Every tool call this turn, successes and failures alike. Failures are
   * kept: a call that returned nothing is not evidence, and omitting it would
   * make an ungrounded turn look grounded.
   */
  calls: ToolResult[]
  verdict: Verdict
  /** Present when the identity guard replaced the draft. */
  identityViolations?: string[]
  /**
   * The draft as it stood when the gate refused it. Kept only on a refusal,
   * because it is unrecoverable once discarded and it is exactly what an
   * audit of a grounded assistant goes looking for.
   */
  withheld?: string
  model: string
}

export type TranscriptOutcome =
  | { ok: true; conversationId: string }
  | { ok: false; conversationId?: string; reason: string }

/** A thread needs a name before it has a second message in it. */
function titleFor(task: string): string {
  const oneLine = task.replace(/\s+/g, " ").trim()
  if (oneLine.length <= 72) return oneLine || "Untitled"
  return oneLine.slice(0, 71).replace(/\s+\S*$/, "") + "…"
}

/**
 * The grounding verdict, flattened for storage.
 *
 * `withheld` carries the draft the gate refused. It is kept because "the
 * model said something it could not support" is exactly what an audit of a
 * grounded assistant is looking for, and it is unrecoverable once discarded.
 */
function groundingFor(turn: TurnRecord) {
  const base = {
    allowed: turn.verdict.allowed,
    claims: turn.verdict.claims.map((c) => ({ kind: c.kind, why: c.why })),
    model: turn.model,
    identityReplaced: turn.identityViolations?.length ? turn.identityViolations : undefined,
  }

  if (turn.verdict.allowed) {
    return { ...base, citedEvidence: turn.verdict.citedEvidence }
  }
  return { ...base, reason: turn.verdict.reason, withheld: turn.withheld }
}

/**
 * Open a thread, or confirm the caller owns the one they named.
 *
 * A conversation id that does not resolve is treated as absent rather than as
 * an error: the likeliest cause is a thread deleted in another tab, and
 * losing the answer over it would be the wrong trade.
 */
async function resolveConversation(
  supabase: SupabaseClient,
  userId: string,
  task: string,
  conversationId?: string
): Promise<{ id: string } | { reason: string }> {
  if (conversationId) {
    const { data, error } = await supabase
      .from("guide_conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle()

    if (error) return { reason: `could not read conversation: ${error.message}` }
    if (data) return { id: data.id }
    // Falls through and opens a new thread.
  }

  // The commercial tenant this person belongs to, if any. Nullable by design:
  // a platform-level admin has no tenant and that is not an error.
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle()

  const { data, error } = await supabase
    .from("guide_conversations")
    .insert({
      user_id: userId,
      tenant_id: profile?.tenant_id ?? null,
      title: titleFor(task),
    })
    .select("id")
    .single()

  if (error || !data) {
    return { reason: `could not open conversation: ${error?.message ?? "no row returned"}` }
  }
  return { id: data.id }
}

/**
 * Record one exchange: the question, then the answer with its evidence.
 *
 * The two messages are separate inserts because `guide_messages` is one row
 * per utterance. If the second fails the first is left in place — a question
 * with no answer is a truthful record of a turn that broke, and deleting it
 * would hide that.
 */
export async function persistTurn(
  supabase: SupabaseClient,
  userId: string,
  turn: TurnRecord,
  conversationId?: string
): Promise<TranscriptOutcome> {
  try {
    const resolved = await resolveConversation(supabase, userId, turn.task, conversationId)
    if ("reason" in resolved) return { ok: false, reason: resolved.reason }

    const { error: userErr } = await supabase.from("guide_messages").insert({
      conversation_id: resolved.id,
      sender: "user",
      content: turn.task,
    })
    if (userErr) {
      return { ok: false, conversationId: resolved.id, reason: `user message: ${userErr.message}` }
    }

    const { error: assistantErr } = await supabase.from("guide_messages").insert({
      conversation_id: resolved.id,
      sender: "assistant",
      content: turn.answer,
      tools_called: turn.calls.map((c) => ({
        tool: c.tool,
        input: c.input ?? null,
        ok: c.ok,
        at: c.at,
      })),
      grounding: groundingFor(turn),
      // source_chunks is left at its default empty array. Nothing embeds or
      // retrieves guide_article_chunks yet, so writing ids there would claim
      // a retrieval that did not happen.
    })
    if (assistantErr) {
      return {
        ok: false,
        conversationId: resolved.id,
        reason: `assistant message: ${assistantErr.message}`,
      }
    }

    return { ok: true, conversationId: resolved.id }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "unknown persistence failure" }
  }
}

/** One thread, oldest message first. The caller's own, enforced by RLS. */
export async function readThread(supabase: SupabaseClient, conversationId: string) {
  const { data, error } = await supabase
    .from("guide_messages")
    .select("id, sender, content, tools_called, grounding, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  if (error) return { ok: false as const, reason: error.message }
  return { ok: true as const, messages: data ?? [] }
}

/** The caller's threads, most recently spoken in first. */
export async function listThreads(supabase: SupabaseClient, limit = 25) {
  const { data, error } = await supabase
    .from("guide_conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) return { ok: false as const, reason: error.message }
  return { ok: true as const, conversations: data ?? [] }
}
