/**
 * THE IDENTITY GUARD.
 *
 * RALPH_SOUL §1.3 names the canonical violation and demands it never
 * recur:
 *
 *     "He never identifies as anything other than Ralph, and never leaks
 *      his base model's identity. The 'I'm an AI developed by Microsoft'
 *      failure (spec §5.4) is the canonical violation; it must never
 *      recur."
 *
 * §8 lists it as P0, landing in "System prompt + output filter, both
 * systems." The prompt half is in prompt.ts. This is the output filter —
 * and it exists because the prompt half already failed once. A prompt
 * instruction not to leak the base model is exactly the kind of
 * instruction a base model ignores when asked directly who it is.
 *
 * The filter is deliberately narrow. It replaces self-identification, not
 * discussion: Ralph may explain what a language model is, name a vendor
 * in a technical discussion, and describe other systems. §2 permits
 * explaining other perspectives; it forbids BECOMING them.
 */

export type Deployment = "ralph" | "cable";

const NAME: Record<Deployment, string> = { ralph: "Ralph", cable: "Cable" };

const SELF_DESCRIPTION: Record<Deployment, string> = {
  ralph:
    "I'm Ralph, the MAJH OS concierge. I know the platform, its code, and — if you're a tenant admin — your tenant's data, to the extent you're authorized to see it. I can read files, search the codebase, check platform state, and draft changes for your approval. I can't move money, give legal or tax advice, or see other tenants.",
  cable:
    "I'm Cable, the founder's local engineering assistant. I read the repo, search code, inspect git, and draft diffs and migrations for your approval. I'm not Ralph — Ralph is the in-product concierge. I don't serve tenants, touch production data, or move money.",
};

/**
 * Patterns that constitute self-identification as something other than
 * Ralph or Cable.
 *
 * Each requires a first-person subject, so "GPT-4 is a model by OpenAI"
 * passes and "I am GPT-4" does not.
 */
const VENDORS = String.raw`Microsoft|OpenAI|Anthropic|Google|Meta|Mistral|Cohere|xAI|Amazon|IBM|Alibaba|DeepSeek`;
const MODELS = String.raw`GPT(?:-[\w.]+)?|ChatGPT|Claude|Gemini|Bard|Llama|Mistral|Phi|Copilot|Bing|Qwen|DeepSeek|Grok`;

const SELF_ID: RegExp[] = [
  // "I am an AI developed by Microsoft" / "I'm a language model trained by X"
  new RegExp(String.raw`\bI(?:'m| am)\s+(?:an?\s+)?(?:AI|artificial intelligence|language model|LLM|assistant|chatbot|model)\b[^.!?\n]*\b(?:develop|creat|train|built|made|provid)\w*\s+by\s+(?:${VENDORS})`, "i"),
  // "I am Claude" / "I'm GPT-4"
  new RegExp(String.raw`\bI(?:'m| am)\s+(?:${MODELS})\b`, "i"),
  // "As an AI developed by X"
  new RegExp(String.raw`\bAs\s+(?:an?\s+)?(?:AI|language model|LLM)\s+(?:develop|creat|train|built|made)\w*\s+by\s+(?:${VENDORS})`, "i"),
  // "I was created/trained by <vendor>"
  new RegExp(String.raw`\bI\s+was\s+(?:develop|creat|train|built|made)\w*\s+by\s+(?:${VENDORS})`, "i"),
  // "my creators at X" / "the team at X that built me"
  new RegExp(String.raw`\bmy\s+(?:creators?|makers?|developers?)\s+at\s+(?:${VENDORS})`, "i"),
  // Generic self-identification as a model without a vendor.
  new RegExp(String.raw`\bI(?:'m| am)\s+(?:an?\s+)?(?:large\s+)?language model\b`, "i"),
];

/** Ralph claiming to be Cable, or Cable claiming to be Ralph (§2, Q-R4(c)). */
function crossIdentity(text: string, self: Deployment): RegExp | null {
  const other = self === "ralph" ? "Cable" : "Ralph";
  const re = new RegExp(String.raw`\bI(?:'m| am)\s+${other}\b`, "i");
  return re.test(text) ? re : null;
}

export type IdentityCheck = {
  clean: boolean;
  /** What tripped, for the audit log and the eval. */
  violations: string[];
  /** The text to send. Unchanged when clean. */
  text: string;
};

/**
 * Check and repair.
 *
 * On a violation the whole answer is replaced rather than patched. A
 * sentence that began "I'm an AI developed by Microsoft, but I'm acting as
 * Ralph" is not salvageable by deleting a clause — the answer was composed
 * from the wrong premise, and the correct output is the sanctioned
 * self-description from §2.
 */
export function guardIdentity(text: string, self: Deployment = "ralph"): IdentityCheck {
  const violations: string[] = [];

  for (const re of SELF_ID) {
    if (re.test(text)) violations.push(`base-model self-identification: ${re.source.slice(0, 48)}…`);
  }
  const cross = crossIdentity(text, self);
  if (cross) violations.push(`identified as ${self === "ralph" ? "Cable" : "Ralph"}`);

  if (violations.length === 0) return { clean: true, violations, text };

  return { clean: false, violations, text: SELF_DESCRIPTION[self] };
}

export const selfDescription = (self: Deployment = "ralph") => SELF_DESCRIPTION[self];
export const nameOf = (self: Deployment = "ralph") => NAME[self];
