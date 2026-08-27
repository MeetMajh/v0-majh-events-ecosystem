# MAJH OS Architecture and Placement Review

## Assessment

MAJH OS should be built as a substrate-first operating platform whose primary job is reconciliation: absorb fractured legacy conventions, retain lineage and ambiguity, and expose coherent operational views without forcing MAJH Events to become a preset. MAJH Events is therefore the proving ground, not the architecture template.

## Recommended placement

For Phase 1, keep the platform in the current repository and current MAJH Events Supabase project. Build the shared substrate in `core.*` and `platform.*`, while preserving existing `public.*` tables unless v1.1.0 explicitly requires a bounded relocation such as `public.entities` to `core.entities`. This is the lowest-risk way to test the philosophy against live legacy data and avoids inventing a second source of truth.

Do not rebuild MAJH Events separately during substrate work. Do not use the separate Supabase project for Phase 1. The separate project can become a later extraction target only after reconciliation, RLS, lineage, drift, and R28 verification are demonstrated in the current project.

## Future placement

After substrate stabilization, extract into the proposed monorepo:

```text
apps/platform       # MAJH OS operator surface
apps/majh-events    # tenant surface
packages/substrate-client
packages/modules
packages/vocabulary
packages/adapters
packages/ralph-client
packages/ui
supabase/            # shared migrations
```

Deploy `apps/platform` and `apps/majh-events` as separate Vercel projects/domains only after the extraction is verified. This creates product separation without prematurely creating database separation. A shared substrate with strict tenant isolation is the correct default; physical database isolation is a later compliance or data-residency decision.

## Architectural test

The test is not whether MAJH Events fits six tables. The test is whether the primitives can represent:

- multiple membership vocabularies without collapsing legitimate identities;
- payments and payouts distributed across several legacy tables;
- changed conventions and unfinished work;
- source lineage, confidence, conflict, and drift;
- stable canonical views while legacy tables remain intact.

R20 must reconcile identity into `core.participants`; R21/R22 must correlate payment and payout records; R26/R27 must preserve lineage and detect divergence; R28 must prove coherent identity behavior. Adapter scaffolding tables are explicitly out of Phase 1 and deferred to adapter framework work.

## Review gates

The agent's architecture review and gap matrix are documentation deliverables only. They do not authorize database execution. Execution is blocked until the complete Phase 1 SQL draft receives Claude's written architectural approval; staging verification follows that approval, and production requires written approval from both founder and Claude after staging passes.

## Recommendation

Proceed current-project-first, substrate-first, and extract-later. The current codebase is the correct laboratory because it contains the fracture the platform must solve. Preserve the legacy surface, add canonical substrate primitives and explicit bridges, and make R28 the completion gate before treating the platform as proven.

**Status:** Rechecked against complete v1.1.0 (R1-R28). No SQL executed.
