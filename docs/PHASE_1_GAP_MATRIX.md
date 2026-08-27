# Phase 1 Requirements-to-Ground-Truth Gap Matrix

Status labels: **Observed** means directly confirmed; **Inferred** means supported by existing documents but still requires query verification; **Decision** means a gate before SQL; **Deferred** means explicitly out of Phase 1.

| Requirement group | Ground truth / gap | Status | Required next step |
|---|---|---|---|
| R1-R3 schemas and pgvector | `core` and `platform` are absent; pgvector 0.8.0 is installed. | Observed | Create schemas; do not reinstall vector. |
| R4 tenants extensions | Existing tenant infrastructure is documented but exact columns/FKs need current schema inspection. | Inferred | Inspect before ALTER; preserve existing policies. |
| R5-R8 primitives | No matching substrate tables were found in the follow-up table query. | Observed | Draft additive tables and dependency order. |
| R9 entities relocation | Requirements v1.1 moves entities to `core`; current location and dependents require confirmation. | Decision | Inventory FKs, views, and code paths before relocation. |
| R10 ledger chain | Existing ledger shape/grants and ordering require direct inspection. | Decision | Choose computed backfill and prove chain in staging. |
| R11 audit immutability | New `core.audit_log` is required; existing access/reconciliation logs must remain untouched. | Decision | Inventory triggers/grants; add append-only enforcement only to required tables. |
| R12 chart of accounts | Seed values are proposed, not validated against MAJH Events usage. | Decision | Founder confirms account seed and tenant identity. |
| R13/R13b vocabulary | Six overlays and six MAJH role mappings are required; actual overlay content needs founder review. | Decision | Confirm terms, then seed exact/approximate confidence. |
| R14-R15 modules/helper | Registry and activated modules need architecture/capability cross-check. | Inferred | Confirm taxonomy and dependency diagram before seed. |
| R16-R18 event/outbox/knowledge | No matching substrate tables found; vector extension exists. | Observed | Draft tables, indexes, and RLS; choose vector index based on volume. |
| R19 RLS | Three legacy membership sources have different populations. Counts: organization_members 3 distinct users, staff_roles 2, tenant_memberships 3, auth.users 45. | Observed | Use organization_members only for new substrate RLS as specified; do not consolidate legacy sources. |
| R20 participants | Zachary appears in all three sources: TENANT_MANAGER, admin, TENANT_MANAGER. | Observed | Semantic-map admin≈tenant_manager as approximate; preserve source lineage and conflict state. |
| R21 payments-in | Three-table correlation strategy and exact keys remain to be inspected. | Decision | Inspect columns/rows; correlate before bridge/backfill. |
| R22 payments-out | Dual payout system is documented; exact correlation remains to be inspected. | Inferred | Inspect columns/rows; bridge observes transitions and does not resume cron. |
| R23 new participants | v1.1 corrects source from `user_profiles` to `auth.users`. | Decision | Inspect existing auth trigger before adding one; prevent duplicates. |
| R24 verification | Must include every requirement plus R26-R28 and literal PASS/FAIL output. | Decision | Draft executable verification script before apply. |
| R25 rollback | Required artifact, reverse dependency order, and data-loss notes. | Decision | Draft and review with SQL. |
| R26 reporting | New mandatory reporting surface; no table/function exists yet. | Observed | Define coverage, conflicts, ambiguity, unmapped, and orphan outputs. |
| R27 drift | New detection function; automatic healing is excluded. | Decision | Choose visible drift marker or audit event and test both unchanged/changed cases. |
| R28 coherent identity | New mandatory completion gate; known IDs and payment sample must be run against actual data. | Decision | Identify exact Malchijah IDs and payment correlation sample; paste literal output in completion report. |
| Adapter scaffolding tables | No adapter scaffolding tables are required by Phase 1. | **Deferred / confirmed out of scope** | Do not rebuild by inference; defer to adapter framework work. |
| Separate Supabase project | `gyyswaidsfjstterckrc` is not the Phase 1 execution target. | Decision | Keep current production project first; revisit after R28. |

## Blocking decisions before SQL

1. Confirm current entities location and safe relocation path.
2. Confirm exact MAJH Events tenant ID and the three Malchijah IDs.
3. Confirm chart-of-accounts seeds and events-base terminology.
4. Confirm payment/payout correlation keys and authoritative fields.
5. Confirm bridge trigger timing and function security model.
6. Confirm hash-chain backfill ordering and historical compatibility.
7. Confirm staging/branch mechanism and approval record format.
