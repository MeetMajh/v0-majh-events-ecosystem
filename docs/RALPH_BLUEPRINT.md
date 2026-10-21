# Ralph — Build Blueprint

**Status:** Authoritative build plan for Ralph, the MAJH OS AI
concierge. Referenced by `docs/ARCHITECTURE.md` §11.

**Purpose:** Define what Ralph is, what Ralph is not, how Ralph is
built in phases, and what safety and cost boundaries apply to each
phase.

**Owner:** Malchijah Harding (Founder). Ralph implementation may
involve other AI agents (v0, Cursor, additional Claude instances,
possibly a friend who has offered agent-loop help) but architectural
decisions remain founder-owned per `AGENT_COLLABORATION_PROTOCOL.md`.

**Last updated:** June 26, 2026

**Version:** 1.0.0

**Reviewed cadence:** After each phase completes. Phase completion
is what merits blueprint revision, not calendar time.

---

## 1. What Ralph is

Ralph is an AI concierge native to MAJH OS. Ralph knows the platform,
explains it to users, diagnoses issues, drafts changes, and
remembers context across time. Ralph is a substrate-level service
per `ARCHITECTURE.md` §11 — every tenant gets Ralph when it becomes
tenant-facing (which is later phases; early phases are founder-only).

Ralph exists because the founder cannot mentor every tenant, cannot
respond to every question, cannot diagnose every issue in real time.
Ralph is the second pair of hands that scales when the founder does
not. Ralph is not a replacement for the founder — Ralph is what
lets the founder ship platform work while tenants still receive
timely, competent, contextually-aware help.

**The concrete framing:** Ralph is the IT guy at a small company
who has been there for 10 years and knows where every cable goes.
Except this one is software, and it scales.

## 2. What Ralph is NOT

Naming what Ralph is not is more important than naming what Ralph
is. The Ralph blueprint's failure mode is over-scoping into a
science-fiction agent legion. Explicit non-goals:

**Ralph is not autonomous financial infrastructure.** Ralph does not
move money without going through the same financial intents pattern
and MFA gates a human user would. Ralph is a query layer over the
substrate, not a replacement for the substrate's discipline (see
`ARCHITECTURE.md` §11.4).

**Ralph is not a 5,000-agent legion.** Any grandiose architecture
proposing thousands of agents, cosmic knowledge pillars, or
recursive intelligence cores is out of scope. Ralph is one primary
LLM interface, backed by 5-10 tools, with a memory store and a
grounding discipline.

**Ralph is not a load-bearing production dependency.** If Ralph is
down, MAJH OS still functions. Tenants still transact. Ledger
entries still write. Cron jobs still run. Ralph makes the platform
more usable and diagnosable; Ralph does not make the platform run.

**Ralph is not a replacement for documentation.** Ralph queries
knowledge pools that draw from documentation. The documentation is
still the source of truth. Ralph makes it navigable and searchable
in context; Ralph does not obviate it.

**Ralph is not general-purpose AI.** Ralph is scoped to MAJH OS
operations. Ralph does not draft marketing copy for tenants. Ralph
does not write tenant business strategy. Ralph does not counsel
tenants on personal matters. Ralph knows MAJH OS and its verticals
deeply and stays in that lane.

**Ralph is not a compliance advisor.** Per the compliance boundary
in `ARCHITECTURE.md` §2.4, MAJH OS does not provide accounting, tax,
or legal advice. Ralph inherits this boundary. Ralph can surface
information, but Ralph does not advise.

## 3. Technology stack

Ralph's implementation stack is chosen to match reality: single-
founder capacity, ~$300-500/month operating budget through Phase 5,
sovereignty per `STRATEGIC_DIRECTION.md` §8.

**Reasoning model:** Anthropic Claude API for reasoning-heavy tasks.
Cloud inference is a burst-only fallback per sovereignty principle;
Ralph's baseline operations run on models that could be self-hosted
if needed.

**Embedding model:** OpenAI embeddings for the knowledge pool
initially. Self-hostable alternatives (nomic-embed-text via Ollama,
or self-hosted sentence-transformers) can substitute when
sovereignty triggers require it (per `ARCHITECTURE.md` §13.2).

**Vector storage:** Supabase pgvector, same database as the rest of
the platform. Ralph's memory and knowledge live in the same
PostgreSQL where every other MAJH OS record lives.

**Orchestration:** Custom TypeScript orchestration inside the
existing Next.js app. No new framework, no LangChain-style
abstraction layer. The orchestration is small enough to write by
hand and read on one screen.

**Deployment:** Same Vercel deployment as the rest of the app during
Phases 1-5. Ralph might move to dedicated infrastructure (perhaps a
Mac mini or dedicated server) at Phase 6+ if 24/7 continuous
operation is required and Vercel's model does not support it. That
decision is deferred until Phase 6 planning.

**Cost budget:** Target $220-450/month operational cost through Phase 5.
Actual cost will be primarily Claude API usage; embedding costs are
minor; storage and compute are already accounted for by Supabase
and Vercel.

## 4. Ralph's tool inventory

Ralph works through a small, well-defined set of tools. Each tool
has a manifest (name, description, parameters, permissions) and an
implementation. Ralph selects tools based on conversation context.

**The Phase 1 tool set (minimum viable):**

- `read_file(repo, path)` — read a specific file from the repo,
  scoped to what the user has access to. Ralph uses this to answer
  "what does this file contain?" without hallucinating.

- `git_log(repo, n)` — list the n most recent commits in the repo.
  Ralph uses this to answer questions about recent changes.

- `git_status(repo)` — show current uncommitted state. Founder-only
  in Phase 1; not useful for tenant-facing Ralph.

- `read_docs(query)` — semantic search over the platform's committed
  documentation. Returns relevant sections. Ralph uses this to
  answer conceptual questions.

- `search_memory(query, top_k)` — search Ralph's memory of prior
  conversations and decisions. Ralph uses this to maintain continuity
  across sessions.

- `write_memory(key, value)` — record something Ralph should
  remember. Requires user confirmation ("Should I remember X?") —
  never silent writes.

**Phase 3+ additional tools:**

- `query_db(sql, max_rows)` — read-only SELECT against the platform
  database. Uses a Postgres role with only SELECT permissions —
  defense in depth means Ralph literally cannot mutate data.

- `query_entities(tenant_id, filters)` — scoped query over the
  entities table. Wraps `query_db` with tenant-scope enforcement.

- `query_participants(tenant_id, filters)` — same pattern for
  participants.

- `query_payments(tenant_id, filters)` — same pattern for
  payments_in and payments_out.

**Phase 4+ additional tools:**

- `propose_change(repo, path, diff)` — Ralph proposes a code change
  as a diff. Human reviews and approves (or rejects) via the
  approval queue UI. Never applied without human approval.

- `propose_migration(name, sql)` — Ralph proposes a database
  migration. Same approval flow.

**Phase 5+ additional tools:**

- `run_diagnostic(playbook_name)` — Ralph runs a named diagnostic
  playbook (see §7 Phase 5). Playbooks are defined declaratively.

- `generate_report(report_type, params)` — Ralph invokes a
  finance-module report generator with parameters.

**Phase 6+ additional tools:**

- `invoke_module_tool(module, tool_name, params)` — Ralph invokes
  a tool registered by a specific module (per `ARCHITECTURE.md`
  §11.2). Modules register tools by placing them in
  `modules/{module}/ralph_tools/`.

**Bounded set:** Ralph will have somewhere between 15 and 25 tools
by Phase 7. Not 100. Not 1000. Not thousands. Each tool is
deliberate, tested, and audited.

## 5. Safety patterns

Ralph operates within multiple safety layers. These are not
optional and are not lifted for convenience.

### 5.1 Approval queue for every state change

Ralph never mutates state directly. Every proposed change (code
modification, migration, memory write, tool invocation with side
effects) goes to an approval queue. A human reviews and approves
before the change is applied.

The approval queue is implemented as a simple table
(`core.ralph_approval_queue`) with columns for the proposed action,
timestamps, requesting user, and approval state. The reviewer UI is
straightforward: list of pending approvals, approve or reject each.

In Phase 1-2, Ralph is founder-only, so the founder approves. In
Phase 6+ when Ralph becomes tenant-facing, tenant admins have their
own approval queue for changes Ralph proposes in their tenant scope.

### 5.2 Read-only database access

The Postgres role Ralph uses for `query_db` has SELECT permissions
only. Never INSERT, UPDATE, DELETE, DDL, or role management. Defense
in depth: even if Ralph's application-level code has a bug that
tries to mutate, the database denies it.

State-changing tools (`propose_change`, `propose_migration`, module
tool invocations with side effects) go through the approval queue,
not through Ralph's database role.

### 5.3 Grounding discipline

Ralph is required to ground its answers in tool call results, not
in the model's parametric memory. The system prompt teaches Ralph:
"When you need to answer a specific question about the codebase,
platform state, or tenant data, use tools. Do not guess. If you
guess, you will be wrong."

Grounding is enforced in two ways:

- **System prompt design.** Prompts explicitly forbid guessing when
  tools are available.

- **Grounding check.** Before returning a substantive answer, Ralph
  self-checks: "Did I use tools to answer this? If not, should I
  have?" If the check fails, Ralph either uses tools or explicitly
  says "I don't have specific information about that."

### 5.4 Spend caps

Every Ralph interaction is metered against a spend cap. Once the
monthly cap is reached, Ralph switches to a lower-cost model or
declines further requests until the next cycle.

**Phase 1-2 cap:** $50/month during founder-only phases (should be
plenty).

**Phase 3-4 cap:** $200/month.

**Phase 5+ cap:** $500/month, revisited as tenant use grows.

Alerts trigger at 50%, 80%, and 100% of the cap so nothing surprises
you.

### 5.5 Audit logging

Every Ralph interaction (query, tool call, proposed change) is
logged to `core.audit_log` with actor type `agent`. This ensures
Ralph's activity is auditable, and any anomalous behavior
(hallucination, boundary violation, cost spike) can be traced.

### 5.6 Tenant scoping enforcement

When Ralph becomes tenant-facing (Phase 6+), Ralph respects tenant
RLS at the same level as any user query. Ralph queries a tenant's
data using that tenant's context, never with elevated cross-tenant
access. A construction tenant chatting with Ralph gets construction
tenant data only.

## 6. Ralph's knowledge pool

Ralph queries a knowledge pool for context. The pool is scoped and
structured to prevent semantic pollution.

### 6.1 What's in the pool

**Platform-level knowledge (shared across all tenants):**
- The committed documentation in `docs/`
- Public architecture documents
- Ralph's own accumulated conversation notes and decisions
  (with tenant identifiers stripped before pool inclusion)

**Tenant-level knowledge (isolated per tenant):**
- Tenant-provided documents (SOPs, runbooks, onboarding materials)
- Tenant's own historical conversations with Ralph
- Tenant-specific decisions and configurations

**Module-level knowledge (associated with modules):**
- Module documentation
- Common patterns and playbooks for that module
- Module-specific vocabulary and terminology

### 6.2 Structure and scoping

The `core.knowledge_vectors` table stores document chunks with
embeddings and scope columns:

- `tenant_id` (nullable — null means platform-level, non-null means
  tenant-scoped)
- `origin_module` (nullable — which module the content came from,
  if any)
- `content` (the text chunk)
- `embedding` (the vector)
- `source_uri` (where this chunk came from — file path, doc ID)
- `chunk_index` (position within source)
- Standard audit columns

RLS enforces that a tenant's queries only return that tenant's
scope plus platform-level chunks. Ralph tool implementations
additionally filter by `origin_module` when relevant to prevent
cross-module semantic pollution (a finance question shouldn't
retrieve tournament docs).

### 6.3 Building the pool

**Phase 2:** Initial pool is the committed documentation. A build
script walks `docs/` at deploy time, chunks each document, generates
embeddings, and writes to `core.knowledge_vectors`.

**Phase 4:** Pool expansion to include tenant-provided documents
(uploaded via UI, from adapters, from event store historical
context).

**Phase 6:** Pool becomes contributed to by tenant activity (with
tenant permission) — Ralph learns from what tenants actually do,
not just from what documentation says.

### 6.4 Retrieval

Semantic search uses pgvector's cosine similarity. Ralph queries
with a natural language question, retrieves the top-k relevant
chunks (typically 3-5), and includes them in the model's context
window for reasoning.

Retrieval is bounded: Ralph never returns more than a fixed number
of chunks per query, and never chunks larger than a fixed token
count. This keeps context window usage predictable and cost
manageable.

## 7. Phased build plan

Ralph is built in seven phases. Each phase has a defined goal,
concrete deliverables, and completion criteria. Phase N+1 does not
start until Phase N is stable in production.

### Phase 1: Foundational agent loop

**Goal:** Ralph answers a specific factual question about a specific
file correctly, using tools rather than hallucination.

**Concrete example:** "What does `app/api/cron/auto-payouts/route.ts`
do?" — Ralph reads the file, summarizes accurately, does not invent
functions or logic that isn't there.

**Deliverables:**
- Basic chat UI (founder-facing, on a protected route)
- Tool-call parsing (Ralph outputs a tool call marker; orchestrator
  parses and executes)
- Tool execution and result injection (executed tool result is
  written back into the conversation for Ralph to reason with)
- Multi-pass loop (Ralph can call multiple tools in a single
  conversation turn, capped at 5 tool calls to prevent runaway)
- Grounding check (before answering, Ralph self-checks whether tools
  should have been used)
- Approval gate scaffolding (queue table, minimal reviewer UI)
- Phase 1 tool set: `read_file`, `git_log`, `git_status`, `read_docs`

**Completion criteria:** Three deterministic test cases pass:
1. Ask about a specific file's contents → Ralph reads it correctly
2. Ask about recent commits → Ralph reports actual commit history
3. Ask a conceptual question about MAJH OS architecture → Ralph
   uses `read_docs` and quotes correctly

**Estimated effort:** 15-25 hours over 2-3 weeks.

**Cost:** Under $50 while testing.

### Phase 2: Memory grounding

**Goal:** Ralph maintains continuity across sessions. Ask Ralph a
question today, refer to it tomorrow, and Ralph knows what was
discussed.

**Deliverables:**
- `core.knowledge_vectors` table with pgvector
- Embedding pipeline (script that walks `docs/`, chunks content,
  generates embeddings via OpenAI API, writes to table)
- `search_memory` tool
- `write_memory` tool with user confirmation gate
- Conversation history persistence
- Session-startup memory hydration (Ralph loads relevant prior
  context at the start of each conversation)

**Completion criteria:**
- Ask Ralph to remember a specific fact; end the session; start a
  new session; ask about the fact — Ralph recalls it
- Ask Ralph a documentation question; Ralph retrieves the relevant
  doc section via semantic search rather than parametric memory

**Estimated effort:** 10-15 hours over 1-2 weeks.

**Cost:** ~$5-15 additional (embedding generation is a small
one-time cost per document chunk).

### Phase 3: Diagnostic capability

**Goal:** Ralph looks at platform state and identifies problems.

**Concrete example:** "Ralph, is the auto-payouts cron working?"
— Ralph reads recent Vercel logs, queries recent ledger entries,
checks recent audit log activity, and reports whether the system
appears healthy.

**Deliverables:**
- Read-only database role for Ralph
- `query_db` tool with SQL whitelist (Ralph can only issue SELECT
  against approved tables; no arbitrary SQL)
- `query_entities`, `query_participants`, `query_payments` scoped
  wrappers
- Diagnostic playbooks (declarative playbook definitions Ralph can
  invoke): cron health check, RLS coverage check, tenant activity
  summary, financial spine integrity check
- Log-reading capability (if Vercel API exposes logs, or via
  self-managed log destination)

**Completion criteria:**
- Ralph identifies at least one known-broken thing in the platform
  correctly (e.g., "The process-payouts cron is currently paused
  per commit 13655a0")
- Ralph correctly reports RLS coverage for a specified table
- Ralph correctly summarizes tenant activity for a given tenant
  scope

**Estimated effort:** 20-30 hours over 2-3 weeks.

**Cost:** ~$20-30/month during active testing.

### Phase 4: Drafting capability

**Goal:** Ralph proposes code and migration changes. Founder reviews
and approves.

**Concrete example:** "Ralph, we need a new column on `entities`
for `priority_score`." — Ralph drafts the migration, drafts the
model update, drafts the affected route handler changes, submits
via approval queue. Founder reviews the diff, approves, and Ralph's
proposals become a real PR.

**Deliverables:**
- `propose_change` tool (diff-based, structured)
- `propose_migration` tool (SQL migration proposal)
- Approval queue with rich diff viewing UI
- Integration with GitHub PR creation (approved proposals become
  PRs automatically)
- Rollback path (rejected proposals discard; approved proposals can
  be reverted via a follow-up proposal)

**Completion criteria:**
- Ralph drafts a simple migration correctly on first try
- Ralph drafts a code change that a human approver can review in
  under 5 minutes
- Approved proposals become clean PRs that pass CI

**Estimated effort:** 20-25 hours over 2-3 weeks.

**Cost:** ~$50-100/month during active testing.

### Phase 5: Concierge interface (founder-facing polish)

**Goal:** Ralph feels like a colleague, not a script. Interface is
polished. Daily use is comfortable. Ralph proactively surfaces
things worth attention.

**Deliverables:**
- Polished chat UI with streaming, tool-call visualization, and
  clear approval queue integration
- Conversation history browser (revisit prior chats, search across
  them)
- Periodic system health checks (Ralph runs check-in loops every
  15-30 minutes and surfaces anomalies)
- "Ralph Briefing" morning summary (Ralph generates a daily brief:
  what shipped yesterday, what's broken, what's pending approval,
  what's on the calendar for today)
- `run_diagnostic` and `generate_report` tools
- Cost tracking dashboard (visible to the founder)

**Completion criteria:**
- Founder uses Ralph daily for at least 2 weeks without significant
  friction
- Ralph correctly surfaces at least one issue that would have
  otherwise required manual investigation
- Cost stays under $200/month during typical use

**Estimated effort:** 15-25 hours over 2-3 weeks.

**Cost:** ~$100-200/month during active use.

### Phase 6: Tenant-facing concierge (multi-tenant activation)

**Goal:** Tenant admins can chat with Ralph. Ralph respects tenant
RLS, uses tenant vocabulary, and remembers tenant-specific context.

**Deliverables:**
- Tenant-facing Ralph UI (embedded in tenant admin dashboard)
- Per-tenant conversation history isolation
- Per-tenant memory namespace
- Vocabulary overlay awareness (Ralph uses "your projects" for a
  construction tenant, "your tournaments" for an esports tenant)
- Module tool registration and invocation (`invoke_module_tool`)
- Tenant admin approval queue for Ralph's proposed tenant-scoped
  changes
- Tenant-specific spending caps

**Completion criteria:**
- One tenant (initially MAJH Events; then construction firm if that
  relationship materializes) uses Ralph productively for at least
  4 weeks
- Zero cross-tenant leaks detected in audit log analysis
- Tenant admin approves Ralph proposals at a healthy rate (not
  approving everything blindly, not rejecting everything reflexively)

**Estimated effort:** 30-40 hours over 4-6 weeks.

**Cost:** ~$300-500/month during multi-tenant use.

### Phase 7: Advanced capabilities (deferred)

**Goal:** Ralph gains sophistication where sophistication earns its
cost.

**Possible additions:**
- Multi-agent orchestration (Ralph can delegate specific tasks to
  specialized sub-agents; each sub-agent scoped narrowly and
  audited)
- Cross-tenant pattern learning (Ralph observes that a pattern that
  works for one tenant might benefit another; proposes suggestion
  without cross-tenant data leakage)
- Autonomous diagnostic response (Ralph diagnoses an issue and
  proposes a fix without waiting for a founder query)
- Voice interface (if voice becomes valuable for tenant admins)
- Custom fine-tuned models on tenant data (with explicit tenant
  consent)

**Not committed:** Phase 7 items are deferred until Phases 1-6 have
been in production long enough to reveal what actually matters. No
one should build Phase 7 features until the platform has revenue
sufficient to justify the cost.

## 8. Effort and cost summary

Total effort estimate through Phase 6: ~110-160 hours over 15-25
weeks, at 4-8 hours per week on Ralph specifically. This does not
displace other MAJH OS work; Ralph is a build track that runs in
parallel to platform work, using evening/weekend capacity when
possible.

Total operational cost through Phase 5 (founder-only use): ~$50-200/
month.

Total operational cost during Phase 6 (multi-tenant): ~$300-500/
month.

Phase 7 costs are unbounded and deferred.

**Sanity check:** These numbers are roughly one AI-lab-engineer-week
per phase, at operating costs that a small SaaS company can support
before revenue. That is Ralph's ceiling and floor. Beyond this
envelope, we are not building Ralph anymore — we are building
something else, and that requires explicit strategic reconsideration.

## 9. When Ralph replaces itself

Ralph's underlying model choice (Claude API) is a starting point,
not a permanent commitment. When any of these become true, Ralph's
inference layer should be reconsidered:

- **Cost trigger:** Monthly cost sustainably exceeds Phase target
  by more than 50% (e.g., Phase 5 running at $300+ when the target
  was $200)
- **Sovereignty trigger:** A tenant contract requires that no
  tenant data reach an external LLM provider
- **Latency trigger:** Response times degrade to the point that
  tenant admins reject Ralph interaction
- **Quality trigger:** A specific class of task consistently fails
  and a different model would predictably do better

Migration paths:
- Self-hosted Llama or Qwen models via Ollama or a dedicated
  server. Adequate for grounding queries and factual retrieval.
- Anthropic self-managed deployment if Anthropic offers one and
  tenant contracts require it.
- Hybrid: cloud inference for complex reasoning, self-hosted for
  routine queries.

The tool inventory, the safety patterns, the knowledge pool structure,
and the phased build plan do not depend on which model is running.
Only the specific inference call changes.

## 10. Ralph and the compliance boundary

Per `ARCHITECTURE.md` §11.4 and §2.4:

- Ralph cannot move money without going through the same financial
  intents pattern and MFA gates a human user would
- Ralph does not provide accounting, tax, or legal advice (Ralph
  responses include appropriate disclaimers when tenant questions
  approach these topics)
- Ralph does not certify financial statements
- Ralph does not cross tenant boundaries
- Ralph responses are logged to audit log
- High-risk Ralph actions require the same authorization checks as
  human-initiated actions

Ralph inherits the platform's compliance discipline. Ralph does not
weaken it.

## 11. Companion documents

- `docs/ARCHITECTURE.md` §11 — Ralph integration points at the
  substrate level
- `docs/ARCHITECTURE_OPEN_QUESTIONS.md` Q3 — dual-key RLS for
  knowledge pool cross-module isolation (implemented in Phase 6)
- `docs/CAPABILITY_MAP.md` §2.2 — Ralph as substrate service
- `docs/STRATEGIC_DIRECTION.md` §11 — "not a 5,000-agent legion"
  constraint that shapes this blueprint
- `docs/AGENT_COLLABORATION_PROTOCOL.md` §7 — Ralph's status as
  work product rather than workflow participant during Phases 1-6

---

*Small model. Small tool set. Small scope. Big impact when
disciplined. That is the Ralph blueprint.*
