# MAJH OS Architecture and Placement Review

## Decision

MAJH OS should be developed as a substrate-first platform in the current repository and current production Supabase project during Phase 1. MAJH Events remains the proving-ground tenant and must continue operating unchanged while `core.*` and `platform.*` are introduced alongside existing `public.*` legacy tables.

Do not rebuild MAJH Events separately yet. Do not make `gyyswaidsfjstterckrc.supabase.co` the Phase 1 target. The separate project can become an extraction or staging target only after the current substrate has passed R28 and production verification.

## Why this placement is correct

The thesis is reconciliation, not preset fitting. Keeping the tenant and substrate in one operational environment exposes the real seams: three membership vocabularies, overlapping payout systems, fragmented payment records, and incomplete lineage. A premature split would add migration risk and could hide precisely the legacy friction Phase 1 must prove it can absorb.

The eventual monorepo is still the right destination: `apps/platform` for operators, `apps/majh-events` for the tenant, and shared `packages/*` for substrate clients, modules, vocabulary, adapters, Ralph, and UI. That is an extraction boundary, not a prerequisite for proving the database substrate.

## Architectural principles

- Preserve legacy tables and application paths; reconcile beside them.
- Use `core.*` for universal substrate data and `platform.*` for registries.
- Every bridged row carries exact source-row lineage, bridge version, run time, and explicit conflict/ambiguity state.
- Semantic mappings are tenant-scoped and queryable; they are not hidden in bridge code.
- R26 makes reconciliation visible, R27 makes drift detectable, and mandatory R28 determines whether the thesis actually holds.
- RLS is enforced at tenant and hierarchy scope without assuming that legacy membership tables can be consolidated in Phase 1.
- Adapter scaffolding tables are deferred; Phase 1 proves substrate reconciliation before adapter-framework design.

## Execution gates

The agent's review is a document and does not authorize SQL. Claude's architectural review is a written approval against the complete drafted SQL, verification script, backfill plan, and rollback plan; only that written approval unblocks staging execution. Production requires successful staging verification plus explicit founder and Claude approval.

## Risks to manage

The highest risks are incorrect identity correlation, accidental legacy writes, over-broad RLS, hash-chain backfill mistakes, and bridge triggers that mutate payment behavior. Drafting must use idempotent functions, service-role-only mutation where required, explicit transaction boundaries, and literal verification output. The paused payout cron must remain paused and must never be coupled to bridge activation.

## Recommended sequence

1. Reconnaissance and decision closure.
2. Draft SQL, backfill, verification, and rollback artifacts.
3. Obtain Claude's written architectural approval.
4. Apply to a database branch/staging environment and run all checks, including R28.
5. Obtain founder and Claude written production approval.
6. Apply the exact reviewed migration to current production.
7. Extract the monorepo and separate Vercel surfaces only after substrate stability.

This placement preserves speed and safety while making MAJH Events a genuine stress test rather than a sanitized demo tenant.
