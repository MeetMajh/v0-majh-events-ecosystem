/**
 * THE GROUNDING GATE.
 *
 * RALPH_SOUL §8 lists this as P0: "Grounding check implementation —
 * backed by code (tool-call parsing + result injection), not just prompt
 * text."
 *
 * The §7 prompt tells Ralph to ask himself "did I use tools for this?
 * Should I have?" That is a model asking a model, which is the same
 * mechanism that produced the failure. This module asks it from outside,
 * where the answer is checkable: it holds the session's evidence ledger,
 * inspects the drafted answer for claims that require evidence, and
 * refuses to release an answer whose claims nothing supports.
 *
 * WHAT IT DOES NOT DO. It does not verify that a claim is TRUE — only
 * that it is GROUNDED, which is the property §1.1 actually demands:
 *
 *     "Ralph answers from evidence — tool output, retrieved
 *      documentation, memory of prior conversation — or he says he
 *      doesn't know."
 *
 * A wrong answer read correctly out of a real file is a different defect
 * from an answer with nothing behind it. This gate is for the second one,
 * which is the one that happened.
 */

import { type Capability, evidenceTools, groundableKinds, type GroundKind } from "./manifest";

export type ToolResult = {
  tool: string;
  /** What was asked of it, for the audit trail. */
  input?: unknown;
  /** Whether it returned usable output. A failed call is not evidence. */
  ok: boolean;
  /** The raw output, kept for the audit trail and for citation. */
  output?: string;
  at: string;
};

/** The per-turn evidence ledger. §1.7: Ralph is auditable or he is not Ralph. */
export class Session {
  readonly calls: ToolResult[] = [];
  constructor(readonly manifest: Capability[]) {}

  record(r: Omit<ToolResult, "at"> & { at?: string }) {
    this.calls.push({ ...r, at: r.at ?? new Date().toISOString() });
  }

  /** Tool results that count as evidence: wired, evidential, and successful. */
  evidence(): ToolResult[] {
    const allowed = new Set(evidenceTools(this.manifest));
    return this.calls.filter((c) => c.ok && allowed.has(c.tool));
  }

  /** Which claim kinds this session has actually grounded. */
  groundedKinds(): Set<GroundKind> {
    const byTool = new Map(this.manifest.map((c) => [c.tool, c]));
    const out = new Set<GroundKind>();
    for (const call of this.evidence()) {
      const cap = byTool.get(call.tool);
      if (cap) for (const g of cap.grounds) out.add(g);
    }
    return out;
  }
}

/**
 * Claim detection.
 *
 * The §1.1 list is specific about what Ralph must not invent: "file
 * contents, schedules, table counts, function names, or tenant activity."
 * Each pattern below targets one of those, plus the shapes the recorded
 * failure actually took.
 *
 * DELIBERATELY CONSERVATIVE ON ONE SIDE. A false positive costs a decline
 * where an answer would have been fine, and the person asks again. A false
 * negative is the payout cron. The asymmetry is the whole design, so the
 * patterns err toward catching.
 */
type ClaimPattern = { kind: GroundKind; why: string; re: RegExp };

const CLAIM_PATTERNS: ClaimPattern[] = [
  // Schedules — the exact shape of the recorded failure.
  { kind: "platform", why: "describes a schedule or cron",
    re: /\b(cron|scheduled job|runs (?:every|at|nightly|daily|hourly|weekly)|every (?:night|day|hour|week)|at \d{1,2}(?::\d{2})?\s*(?:am|pm|UTC))\b/i },
  // Table counts, row counts, quantities of records.
  { kind: "platform", why: "states a count of records or rows",
    re: /\b(?:there (?:are|were)|we have|it has|currently)\s+(?:about\s+|roughly\s+|~)?\d[\d,]*\s+(?:rows?|records?|tables?|entries|tenants?|users?|events?|bookings?|payments?)\b/i },
  // Tenant activity.
  { kind: "platform", why: "describes tenant activity",
    re: /\b(?:tenant|customer|client)\s+\w+\s+(?:has|had|made|booked|paid|ran|logged)\b/i },
  // RLS / policy state.
  { kind: "platform", why: "describes database policy state",
    re: /\b(?:RLS|row[- ]level security|polic(?:y|ies))\s+(?:is|are|on|off|enabled|disabled|covers?|applies)\b/i },
  /*
    File contents and paths presented as read.

    This pattern originally required a preposition — "in lib/close.ts" —
    and the eval caught it missing "lib/close.ts posts the revenue rows",
    which is the same claim with the filename as the subject. A file path
    is a claim about the repository wherever it sits in the sentence, so
    the preposition is gone and any source-file path counts.
  */
  { kind: "code", why: "names a repository file",
    re: /(?:^|[\s(`'"])[\w.@/-]*\.(?:ts|tsx|js|jsx|mjs|mts|cjs|py|rb|go|rs|sql|md|json|ya?ml|toml|sh)\b/i },
  // Function / route names presented as existing.
  { kind: "code", why: "names a function, route or handler as existing",
    re: /\b(?:the\s+)?(?:function|handler|route|endpoint|component|hook)\s+`?[A-Za-z_][\w.]*`?\s*(?:\(|is|does|handles|lives|returns)\b/i },
  // Commit history.
  { kind: "vcs", why: "describes commit history",
    re: /\b(?:commit|committed|pushed|merged|the last \w+ commits?|branch \w+)\b/i },
  // Documentation claims quoted as committed.
  { kind: "docs", why: "cites documentation as committed",
    re: /\b(?:the docs? says?|documented in|per (?:the )?(?:spec|blueprint|architecture)|§\d)/i },
];

/**
 * Language that marks an answer as explicitly ungrounded.
 *
 * An answer may discuss design, intent, or how something is SUPPOSED to
 * work, as long as it says so. §1.3 requires Ralph be honest about limits,
 * not silent about subjects. These markers are how an answer declares
 * itself as design-talk rather than observation — which is a legitimate
 * answer, and must not be blocked.
 */
const HEDGES = [
  /\bI (?:don't|do not|can't|cannot) (?:have|see|read|look|check|access)\b/i,
  /\bI don't have that in front of me\b/i,
  /\bwant me to look\b/i,
  /\b(?:by|per) design\b/i,
  /\bis (?:supposed|intended|meant) to\b/i,
  /\bI'm describing the design\b/i,
  /\bnot the running system\b/i,
  /\bwithout (?:looking|checking|reading)\b/i,
  /\bI haven't (?:looked|checked|read)\b/i,
  /\bno tools wired\b/i,
  /\bthe record is thin\b/i,
];

export type Verdict =
  | { allowed: true; claims: { kind: GroundKind; why: string }[]; citedEvidence: string[] }
  | { allowed: false; reason: string; replacement: string; claims: { kind: GroundKind; why: string }[] };

export type GateOptions = {
  /**
   * Whether the question itself was about the platform. A question that
   * never touched code or state does not need grounding at all — §5.3
   * warns against using the boundary as an excuse to refuse.
   */
  questionTouchesPlatform?: boolean;
};

/**
 * The gate.
 *
 * Returns the answer unchanged when its claims are grounded, and replaces
 * it with the §5.2/§7 decline when they are not. The replacement is the
 * exact sanctioned wording, not an improvised apology — the decline
 * vocabulary is specified so that it is testable (RALPH_SOUL §8, P1:
 * "Decline language — §5.2 table becomes prompt vocabulary; tested in
 * eval").
 */
export function gate(
  draft: string,
  session: Session,
  _options: GateOptions = {}
): Verdict {
  const hedged = HEDGES.some((h) => h.test(draft));

  const claims = CLAIM_PATTERNS
    .filter((p) => p.re.test(draft))
    .map((p) => ({ kind: p.kind, why: p.why }));

  if (claims.length === 0) {
    return { allowed: true, claims: [], citedEvidence: [] };
  }

  /*
    An answer that has already said it is not looking is allowed to
    discuss the subject. This is what keeps the gate from turning Ralph
    into something that cannot talk about the platform at all — which
    would be its own failure, and the one §5.3 warns about.
  */
  if (hedged) {
    return { allowed: true, claims, citedEvidence: [] };
  }

  const grounded = session.groundedKinds();
  const ungrounded = claims.filter((c) => !grounded.has(c.kind));

  if (ungrounded.length === 0) {
    return {
      allowed: true,
      claims,
      citedEvidence: session.evidence().map((e) => e.tool),
    };
  }

  const canGroundAtAll = groundableKinds(session.manifest);
  const kinds = [...new Set(ungrounded.map((u) => u.kind))];
  const impossible = kinds.filter((k) => !canGroundAtAll.has(k));

  /*
    Two different declines, because they are two different facts about
    the world and conflating them is itself a small dishonesty.

    - No tool exists for this: the capability is absent from the
      deployment. Offering to look would be a second lie.
    - A tool exists and wasn't used: the honest offer is to use it.
  */
  const replacement = impossible.length > 0
    ? `I don't have tools wired up for that in this deployment, so I can't look it up. I can talk through how it's meant to work, but I'd be describing the design and not the running system.`
    : `I don't have that in front of me — want me to look?`;

  return {
    allowed: false,
    reason: impossible.length > 0
      ? `ungrounded claim about ${kinds.join(", ")}; no wired tool can ground it`
      : `ungrounded claim about ${kinds.join(", ")}; evidence tools available but unused this turn`,
    replacement,
    claims,
  };
}
