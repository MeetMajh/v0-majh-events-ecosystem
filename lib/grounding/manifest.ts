/**
 * THE CAPABILITY MANIFEST — the single source of truth for what Ralph can
 * actually do.
 *
 * WHY THIS FILE EXISTS, AND WHY IT IS THE ACTUAL FIX.
 *
 * RALPH_SOUL §0 records the failure precisely:
 *
 *     "Ralph confabulates because the architecture gives the model no tools
 *      — and the prompt tells it it has tools anyway. The prompt lied. The
 *      model believed the prompt. The result was a confident description of
 *      a payout cron that never existed."
 *
 * Every remedy proposed for that failure has been a *second* assertion
 * layered on the first: a grounding sentence in the prompt, a self-check
 * the model performs on itself, a rule that says "do not invent." All of
 * them are text, and text cannot stop a model believing other text.
 *
 * The root cause is not that the prompt lacked a grounding instruction. It
 * is that THE PROMPT AND THE ARCHITECTURE WERE TWO INDEPENDENT
 * DECLARATIONS OF THE SAME FACT, and nothing forced them to agree. A
 * capability existed in one and not the other, and the one the model reads
 * is the prompt.
 *
 * So the manifest is the only place a capability is declared, and the
 * system prompt is GENERATED from it (see prompt.ts). A tool that is not
 * registered and wired here cannot be described to the model, because
 * nothing but this file writes that part of the prompt. The lie becomes
 * unrepresentable rather than discouraged.
 *
 * RALPH_SOUL §5.4 already states the principle this implements:
 *
 *     "A lane that exists only in the prompt is a suggestion. Ralph's lane
 *      exists in the database role, the tool registry, and the approval
 *      queue. The prompt is the fourth layer, not the first."
 *
 * This file is the tool-registry layer, and prompt.ts makes the fourth
 * layer a function of it.
 */

/** What kind of question a tool is able to ground. */
export type GroundKind =
  | "docs"          // committed documentation
  | "code"          // files, functions, routes, diffs
  | "vcs"           // commits, history, status
  | "platform"      // database state, crons, RLS, activity
  | "memory"        // prior conversations and decisions
  | "proposal";     // drafting a change for approval

export type Capability = {
  /** The tool name the model is told to call. */
  tool: string;
  /**
   * WIRED is the whole point. `false` means the tool is specified but no
   * implementation is reachable in this deployment — so the prompt
   * generator must not describe it, and the gate must not accept it as
   * evidence. Specified-but-not-wired is the exact state that produced
   * the payout-cron answer.
   */
  wired: boolean;
  /** What class of claim this tool can support. */
  grounds: GroundKind[];
  /** One line, in the prompt's voice, describing what it does. */
  describes: string;
  /**
   * Whether a result from this tool is sufficient on its own to make a
   * factual claim about the platform. A memory hit is context, not
   * evidence about current state: it tells Ralph what was said, not what
   * is true now.
   */
  isEvidence: boolean;
};

export type Deployment = "ralph" | "cable";

/**
 * The registry.
 *
 * `wired` must be set from the runtime that actually mounts the tool, not
 * by hand here — see `manifestFor()`. The defaults below are the
 * SPECIFICATION; a deployment narrows them to what it really has.
 */
export const SPECIFIED: Capability[] = [
  { tool: "read_docs",         wired: false, grounds: ["docs"],     isEvidence: true,
    describes: "read committed documentation" },
  { tool: "read_file",         wired: false, grounds: ["code"],     isEvidence: true,
    describes: "read a file from the repository" },
  { tool: "search_code",       wired: false, grounds: ["code"],     isEvidence: true,
    describes: "search the codebase" },
  { tool: "git_log",           wired: false, grounds: ["vcs"],      isEvidence: true,
    describes: "read commit history" },
  { tool: "git_status",        wired: false, grounds: ["vcs"],      isEvidence: true,
    describes: "read working-tree status" },
  { tool: "query_db",          wired: false, grounds: ["platform"], isEvidence: true,
    describes: "run a read-only query against platform state" },
  { tool: "introspect_schema", wired: false, grounds: ["platform"], isEvidence: true,
    describes: "read the database's own schema and RLS configuration" },
  { tool: "query_entities",    wired: false, grounds: ["platform"], isEvidence: true,
    describes: "read entities within the caller's authorization" },
  { tool: "query_participants", wired: false, grounds: ["platform"], isEvidence: true,
    describes: "read participants within the caller's authorization" },
  { tool: "query_payments",    wired: false, grounds: ["platform"], isEvidence: true,
    describes: "read payment records within the caller's authorization" },
  { tool: "search_memory",     wired: false, grounds: ["memory"],   isEvidence: false,
    describes: "recall prior conversations and decisions" },
  { tool: "write_memory",      wired: false, grounds: ["memory"],   isEvidence: false,
    describes: "record something to remember, after you confirm it" },
  { tool: "propose_change",    wired: false, grounds: ["proposal"], isEvidence: false,
    describes: "draft a code change for your approval" },
  { tool: "propose_migration", wired: false, grounds: ["proposal"], isEvidence: false,
    describes: "draft a migration for your approval" },
];

/**
 * Build the manifest for a deployment from the tool names the runtime has
 * ACTUALLY mounted.
 *
 * The runtime passes the names it registered — not a hand-maintained list.
 * Anything specified but not mounted comes back `wired: false` and is
 * therefore absent from the generated prompt and rejected as evidence.
 * Anything mounted but not specified is returned in `unspecified` so it
 * fails loudly rather than being silently described to the model.
 */
export function manifestFor(
  mountedToolNames: string[]
): { capabilities: Capability[]; unspecified: string[] } {
  const mounted = new Set(mountedToolNames);
  const capabilities = SPECIFIED.map((c) => ({ ...c, wired: mounted.has(c.tool) }));
  const specified = new Set(SPECIFIED.map((c) => c.tool));
  const unspecified = mountedToolNames.filter((n) => !specified.has(n));
  return { capabilities, unspecified };
}

export const wired = (m: Capability[]) => m.filter((c) => c.wired);

/** Tools whose output counts as evidence for a factual claim. */
export const evidenceTools = (m: Capability[]) =>
  m.filter((c) => c.wired && c.isEvidence).map((c) => c.tool);

/** Which claim kinds this deployment can currently ground at all. */
export function groundableKinds(m: Capability[]): Set<GroundKind> {
  const out = new Set<GroundKind>();
  for (const c of m) if (c.wired && c.isEvidence) for (const g of c.grounds) out.add(g);
  return out;
}
