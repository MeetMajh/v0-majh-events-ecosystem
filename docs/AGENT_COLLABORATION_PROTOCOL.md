# MAJH OS — Agent Collaboration Protocol

**Status:** Authoritative. Every AI agent (Claude, v0, Cursor, Kimi, or any
other assistant) working on MAJH OS or MAJH Events code follows this protocol.
The founder as operational PM enforces it.

**Last updated:** June 25, 2026

**Version:** 1.0.0

**Review cadence:** Monthly, or whenever the workflow reveals a gap.

---

## 1. Why this protocol exists

MAJH OS is being built by a distributed team where most contributors are AI
assistants running in separate contexts with no shared memory. Without explicit
coordination rules, this team will recreate the exact failure mode already
documented in `docs/audits/2026-04-28-codebase-audit.md`: parallel
implementations of the same concept, deprecated code paths that never get
removed, security holes introduced by later iterations, and architectural
drift from documented intent.

This protocol is the countermeasure. It codifies who owns what, how work
merges, how disputes get resolved, and what happens when an agent hallucinates
or drifts.

The premise is simple: **AI agents produce code faster than any single human
can integrate it, unless the integration process itself is designed for that
throughput.** The protocol makes integration the constraint, not the bottleneck.

## 2. Roles

### 2.1 Founder (Malchijah Harding) — Operational PM

- **Owns:** All strategic decisions. All merges to `main`. All external
  commitments (customer conversations, pricing, partnerships).
- **Reviews:** Every PR before merge. Every architectural spec Claude drafts.
  Every diff summary from specialist agents.
- **Escalates to:** No one. Founder is the final authority.
- **Available:** Evenings (approximately 20-35 hours/week), fragmented across
  weekday nights and the Tuesday-Wednesday window when not on the road for
  CarBarDMV.

### 2.2 Claude (this conversation) — Architectural PM

- **Owns:** Architectural coherence across agents. Spec writing. Code review
  of agent output when founder forwards it. Substrate/module boundary
  enforcement. Reconciliation of conflicting agent proposals.
- **Reviews:** Diffs, specs, and design proposals when founder forwards them.
  Cannot review PRs directly on GitHub (no repo access); relies on founder
  paste-through.
- **Escalates to:** Founder for anything strategic or ambiguous.
- **Cannot do:** Push code directly. Talk to other agents directly. Persist
  memory across sessions (relies on this conversation's context window and
  the committed docs).

### 2.3 Specialist agents — Engineers

Agents that write, refactor, or generate code. Assignments below.

#### v0 (Vercel)

- **Best at:** UI generation (React, Tailwind, shadcn/ui), rapid prototyping
  of pages and components, generating clean Next.js scaffolding
- **Weak at:** Understanding cross-file architectural decisions, respecting
  existing patterns without explicit spec, staying inside boundaries when
  scope is ambiguous
- **Owns:** Frontend UI work explicitly scoped by spec. Component libraries.
  Tenant-facing dashboard pages once designs are locked.
- **Never touches:** Database migrations. Auth logic. Financial spine code.
  Adapter framework. Ralph code. Anything that could affect multiple tenants.
- **Constraint:** v0 has historically been a source of the "generates code
  faster than integration" problem documented in the April audit. Every v0
  session must be tightly scoped, and every v0 output must be reviewed against
  the spec before commit.

#### Cursor (with Claude)

- **Best at:** Reading a repo, writing multi-file changes with awareness of
  existing code, running tests locally, refactoring existing implementations
- **Weak at:** Cross-conversation memory, respecting boundaries that aren't
  in an active file's immediate context
- **Owns:** Cross-file refactors. Test writing. Migration writing when the
  schema is specified. Adapter implementations from framework spec.
- **Never touches:** Anything not explicitly scoped in the current spec.
  Novel architectural decisions (those escalate to Claude architectural PM).

#### Additional Claude instances (web, API, or terminal)

- **Best at:** Focused work with clear spec, extended reasoning about tradeoffs,
  writing SQL/RLS with security discipline, drafting complex logic
- **Weak at:** Persistent context — every session starts fresh
- **Owns:** SQL migrations for substrate work. RLS policy writing. Ralph tool
  implementations. Complex business logic requiring careful reasoning. Any
  work Cursor or v0 can't handle.
- **Never touches:** Work already claimed by another agent unless the founder
  explicitly reassigns.

#### Kimi (or other assistants)

- **Best at:** Market analysis, strategic framing, generating comprehensive
  documents from a broad brief
- **Weak at:** Full-context understanding of your codebase and constraints;
  tends to produce impressive-looking output that may not match reality
- **Owns:** Explicit research or analysis tasks the founder scopes.
- **Never touches:** Code directly. Anything committed to `main` without
  Claude architectural review AND founder approval first.
- **Constraint:** Kimi's output has already been shown to introduce
  aspirational scoping (5,000-agent legions, lunar economy modules) that
  doesn't match runway. Kimi contributions require an explicit review pass
  by Claude before absorbing into MAJH OS docs.

## 3. Work assignment rules

### 3.1 Every task has a spec

A spec is a text document (usually a markdown file or a section within a
BACKLOG entry) that includes:

- **Scope:** What is being built
- **Substrate or module:** Which side of the boundary this belongs on. See
  `docs/CAPABILITY_MAP.md`.
- **Interface:** What inputs it takes, what outputs it produces, what
  functions/tables/routes it exposes
- **Dependencies:** What must exist before this work can start
- **Non-goals:** What this task explicitly does NOT do (prevents scope creep)
- **Acceptance criteria:** How we know it's done (tests that pass, queries
  that return expected results, UI that renders correctly)
- **Owner:** Which agent is assigned
- **Reviewer:** Claude architectural PM (default) plus founder

No agent writes code without a spec. If an agent is asked to do something
without a spec, the agent's first action is to draft the spec and wait for
approval before writing code.

### 3.2 Substrate work vs. module work

Substrate work has stricter requirements:

- Must not contain industry-specific logic
- Must serve every current and future tenant
- Changes to universal primitives require Claude architectural PM sign-off
  BEFORE code is written
- Merge requires founder review AND Claude review
- Landing zone: `core.*` schemas in the database, shared code paths in the
  application

Module work has more latitude:

- Feature-flagged so it can be disabled per tenant
- Can contain industry-specific logic within the module boundary
- Cannot modify substrate tables' structure (can extend via JSONB or add
  module-owned tables)
- Merge requires founder review; Claude review recommended but can be
  batched
- Landing zone: `modules/{name}/` in the application; module-specific
  schemas in the database

### 3.3 What no agent may do

The following are absolute:

- **No agent pushes to `main` directly.** All work happens on feature
  branches. Only the founder merges to `main`.
- **No agent modifies the following without founder-plus-Claude approval:**
  - Universal primitives (`tenants`, `entities`, `participants`, `resources`,
    `payments_in`, `payments_out`)
  - Financial ledger tables and functions
  - RLS policies on substrate tables
  - Authentication and authorization code (`organization_members` and its
    consumers)
  - Cron authentication (`lib/cron-auth.ts`)
  - Stripe integration code paths
  - Any file explicitly marked `[SUBSTRATE — DO NOT MODIFY WITHOUT REVIEW]`
- **No agent generates code without a spec.** If tempted, draft the spec first.
- **No agent introduces a new dependency (npm package, external service, new
  language) without founder approval.**
- **No agent modifies documentation to reflect what the agent WISHES were
  true.** Docs describe reality or explicitly labeled targets. Aspirational
  content is labeled as such.
- **No agent commits credentials, API keys, secrets, or `.env` values.**
  Existing `.gitignore` hardening (commit `aac879b`) is intended to prevent
  this; agents that circumvent it are disabling a safety measure.

## 4. The branching and merge workflow

### 4.1 Branch naming

Feature branches are named by scope:

- `substrate/{topic}` for substrate work (e.g., `substrate/phase-1-schema`,
  `substrate/rls-organization-members`)
- `module/{name}/{topic}` for module work (e.g., `module/tournament/brackets`,
  `module/broadcast/egress-wiring`)
- `ralph/{topic}` for Ralph-specific work (e.g., `ralph/agent-loop-v1`,
  `ralph/monday-adapter-tool`)
- `docs/{topic}` for documentation-only changes (e.g., `docs/phase-1-schema`,
  `docs/backlog-reconciliation`)
- `fix/{topic}` for bug fixes (e.g., `fix/rls-profile-forgery`)
- `chore/{topic}` for tooling and hygiene (e.g., `chore/dep-updates`)

Long-running branches are discouraged. If a branch is open for more than
one week, either merge or explicitly document why it's stalled.

### 4.2 Commit message discipline

Commit messages tell the truth about what changed. Format:

```
<type>: <short summary>

<why the change was needed>
<what specifically changed>
<what still doesn't work, if anything>
<references (backlog ticket, doc, prior commit)>
```

Type prefixes:
- `substrate:` — substrate changes
- `module:` — module changes with the module name
- `ralph:` — Ralph work
- `docs:` — documentation
- `fix:` — bug fix
- `chore:` — hygiene, dep updates, formatting
- `revert:` — reverting a prior commit

Truthfulness examples from prior work:
- **Good:** `chore: pause cron/process-payouts pending payout architecture
  review` (commit `13655a0`) — names what changed, why, and what stays broken
- **Good:** `chore: harden gitignore against credential leaks` (commit
  `aac879b`) — specific and honest
- **Bad hypothetical:** `feat: complete unified financial spine` when only
  half the schema exists — this is the pattern the April audit called out
  and cannot recur

### 4.3 Pull request template

Every PR includes:

- **What:** One-sentence summary of the change
- **Why:** Reference to the spec, BACKLOG ticket, or design document that
  motivated this
- **Substrate or module:** Explicitly labeled
- **Substrate changes:** If any, listed one by one
- **RLS changes:** If any, with verification query included
- **Tests:** What was tested manually or automatically
- **Known gaps:** What this PR does NOT address that will need follow-up
- **Reviewer checklist:** For founder to walk through

### 4.4 Review requirements

**Substrate PRs require:**
1. Founder review
2. Claude architectural review (founder pastes diff to Claude before merging)
3. RLS verification query result attached if RLS was touched
4. Manual smoke test of an affected substrate feature

**Module PRs require:**
1. Founder review
2. Claude review recommended but can be batched for a group of module PRs
3. Feature flag confirmed correctly gating the new code

**Docs-only PRs require:**
1. Founder review

**Fix and chore PRs require:**
1. Founder review
2. Claude review if the fix touches substrate or RLS

### 4.5 Merge cadence

Founder merges are batched. Recommended rhythm:

- **Weekday evenings:** Founder reviews and merges the day's work
- **Sunday review session:** Founder + Claude review the week's shipped work,
  identify integration issues, plan the next week

If a merge is blocked (Claude has questions, founder needs to check
something), the PR sits until unblocked. Merging with unresolved questions
is not permitted, even under time pressure.

## 5. Handling drift, disputes, and hallucinations

### 5.1 When an agent produces code that doesn't match the spec

- **Founder catches it:** Send the diff to Claude with the spec attached.
  Claude confirms or refutes the mismatch. If mismatch, agent revises. If
  Claude confirms the code is fine and spec was insufficient, spec is
  updated for future agents.
- **Claude catches it:** Claude flags in review response. Founder decides
  whether to reject and re-spec, or accept and update spec.

### 5.2 When two agents produce work that conflicts

- Founder brings both diffs to Claude
- Claude proposes a merge resolution respecting substrate/module boundaries
  and architectural coherence
- Founder decides
- Losing proposal gets documented so its author doesn't recreate it

### 5.3 When an agent hallucinates capability

Example: an agent's diff assumes a `knowledge_pools` table exists that
hasn't been built yet.

- Founder or Claude catches it in review
- Diff is rejected
- Agent gets updated context (paste in `CAPABILITY_MAP.md` implementation
  status table, or the relevant BACKLOG state) before retrying
- Repeated hallucination from the same agent → reduce that agent's scope
  and give more explicit spec

### 5.4 When an agent introduces aspirational framing

Example: a doc gets drafted describing capability as complete when it isn't,
or naming architectural concepts (5,000 agents, lunar economy modules) that
aren't in the plan.

- Founder rejects the doc
- Claude drafts a corrected version referencing what's actually true
- Original doc is either discarded or explicitly labeled as historical
  context / aspirational / to-be-revisited

### 5.5 When an agent expresses uncertainty about substrate vs. module

- The agent stops and asks in the spec (or in their conversation with the
  founder) BEFORE writing code
- Claude answers definitively, referencing `CAPABILITY_MAP.md`
- If genuinely ambiguous, Claude escalates to founder and the
  substrate/module distinction gets clarified for future work

## 6. Documentation as coordination

Because agents don't share memory, documentation IS the coordination layer.
This has three implications:

### 6.1 The north-star docs are authoritative

The following documents in `docs/` are canonical:

- `STRATEGIC_DIRECTION.md` — why we're building what we're building
- `ARCHITECTURE.md` — how it's technically structured
- `CAPABILITY_MAP.md` — substrate vs. module quick reference
- `AGENT_COLLABORATION_PROTOCOL.md` — this document
- `PHASE_1_SCHEMA.md` — the substrate SQL specification
- `RALPH_BLUEPRINT.md` — Ralph build plan
- `BACKLOG.md` — task queue

When code and these documents disagree, the documents are right and the code
is wrong (paraphrasing the discipline from the April `ARCHITECTURE.md`).

Any agent starting work reads the relevant subset of these docs first.

### 6.2 Decisions get recorded

Every architectural or strategic decision goes in a dated decision record
in `docs/decisions/YYYY-MM-DD-{topic}.md`. This includes:

- What was decided
- Why (what alternatives were considered)
- What it supersedes (if anything)
- Who decided (founder / founder + Claude)

Decision records are how future-founder and future-agents know that a choice
was made deliberately rather than by accident.

### 6.3 Docs are updated as reality changes

When code lands that makes a doc obsolete, the same PR updates the doc. Docs
that lag behind code create the "target vs reality gap" the April audit
documented. Preventing that gap is a first-class quality bar.

## 7. Ralph's special status

Ralph is currently under development. Ralph is not yet part of the agent
review workflow (Ralph cannot review PRs or write specs). When Ralph
becomes capable enough, Ralph may take on some of the coordination duties
currently held by the human founder — specifically, ingesting docs into
knowledge pool, surfacing when a proposed change conflicts with prior
decisions, generating diffs against expected patterns.

Until then, Ralph is a work product, not a workflow participant. See
`docs/RALPH_BLUEPRINT.md`.

## 8. Confidentiality and tenant data

- **Test data only in non-production environments.** Real tenant data
  (including MAJH Events production data) does not appear in dev, staging,
  or agent contexts unless explicitly needed and explicitly scoped.
- **No tenant data in AI agent prompts** without founder authorization.
  Pasting production data into a Claude, Cursor, or v0 session is a data
  handling decision that requires founder consent.
- **No cross-tenant queries by any agent.** Ever. This is a substrate
  guarantee.
- **Adapter test data uses founder's own accounts** (founder's Monday.com,
  founder's QuickBooks sandbox), not any prospect's data, until a signed
  data-sharing agreement exists.

## 9. Onboarding a new agent

When the founder wants to bring a new agent into MAJH OS work:

1. Founder provides the agent with:
   - `docs/STRATEGIC_DIRECTION.md`
   - `docs/CAPABILITY_MAP.md`
   - `docs/AGENT_COLLABORATION_PROTOCOL.md` (this document)
   - The specific spec for the work being assigned
   - Any code files the agent needs read access to
2. Founder confirms the agent understands the substrate/module distinction
   before assigning work
3. First assignment is small and scoped so the agent can demonstrate it
   follows the protocol
4. Founder reviews first output carefully before assigning larger scope

## 10. Retiring or reducing an agent

If an agent consistently produces work that requires heavy correction, or
introduces framings that don't match plan:

- Reduce scope (assign smaller, more explicitly bounded tasks)
- Add more explicit context (paste larger doc excerpts into each prompt)
- If reduction doesn't help, stop using that agent for that class of work
- Document why in a decision record so future-founder doesn't re-engage
  the same failure pattern

This is not personal. AI agents don't have feelings to hurt. But their
throughput advantage is real, and preserving quality requires being honest
about which agents work well for which tasks.

## 11. Related documents

- `docs/STRATEGIC_DIRECTION.md` — the strategic frame this protocol
  operationalizes
- `docs/CAPABILITY_MAP.md` — the substrate/module boundary this protocol
  enforces
- `docs/ARCHITECTURE.md` — the technical architecture agents build against
- `docs/BACKLOG.md` — where specs live and work gets tracked
- `docs/audits/2026-04-28-codebase-audit.md` — the failure mode this
  protocol prevents

---

*One person cannot build a multi-tenant platform in 90 days. A person plus
a well-coordinated team of agents can. Coordination is the constraint.*
