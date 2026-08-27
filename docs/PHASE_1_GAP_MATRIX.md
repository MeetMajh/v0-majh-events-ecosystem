# Phase 1 v1.1.0 Requirements-to-Ground-Truth Gap Matrix

**Scope:** R1-R28, against current MAJH Events Supabase project. **Database target:** current project first. **No schema mutations performed.**

| Req | Ground truth | Gap / action | Decision or gate |
|---|---|---|---|
| R1 | Public legacy tables exist; no core schema | Create core substrate namespace | Draft |
| R2 | Tenant model exists in public.tenants | Extend without replacing legacy tenant data | Draft |
| R3 | tenants lacks revised tenant metadata columns | Add only fields required by v1.1.0 | Founder review |
| R4 | Existing feature/subscription tables are fragmented | Model module capability separately from legacy features | Draft |
| R5 | entities exists in public with 14 columns | Relocate `public.entities` to `core.entities`; preserve data and re-verify RLS | Blocking design check |
| R6 | Existing RLS is enabled but heterogeneous | New core tables need explicit tenant-scoped policies | Draft + security review |
| R7 | organization_members exists; other membership tables coexist | Use canonical gating while retaining reconciliation sources | Founder confirms canonical gate |
| R8 | Existing departments/locations are public tables | Map/extend rather than duplicate; preserve FKs during relocation decisions | Draft |
| R9 | public.entities has the required base shape | Relocate entities to core schema, then add hierarchy fields required by R9 | Blocking migration review |
| R10 | ledger_entries exists with no hash columns | Add immutable hash-chain fields and computation | Blocking |
| R11 | UPDATE/DELETE grants and policies exist on ledger_entries | Restrict mutation paths; preserve service operations only | Blocking security review |
| R12 | No verified hash-chain trigger exists | Add trigger/function plus tamper verification | Completion dependency |
| R13 | No core vocabulary overlay/mapping tables verified | Create display and semantic mapping structures | Draft |
| R14 | pgvector extension exists at 0.8.0 | Create knowledge vector table using installed extension | Draft |
| R15 | No core module gate verified | Create module capability model and function pattern | Draft |
| R16 | Existing resources/allocation concepts are public and fragmented | Create substrate resource model with lineage to legacy rows | Draft |
| R17 | Candidate substrate tables are absent; current DB has 268 tables | Create only approved primitives; do not infer adapter tables | Scope gate |
| R18 | pgvector is available; no core vector table verified | Create vector storage plus tenant/RLS policy | Draft |
| R19 | auth.users has 45 rows; no user_profiles table | Create core participant identity layer from auth source | Backfill decision |
| R20 | Three membership sources coexist; counts are 3/3/2 | Reconcile all sources into core.participants with lineage/conflict flags; do not consolidate sources | R28 gate |
| R21 | financial_intents and tournament_payments exist | Bridge payment concepts across sources, not 1:1 copy | Mapping review |
| R22 | payout_requests/player_payouts/organizer_payouts exist | Bridge payout concepts with correlation and provenance | Mapping review |
| R23 | Existing auth/profile identity data is fragmented | Define forward participant creation and source lineage | Draft |
| R24 | Existing audit logs include public access/reconciliation logs | Add core audit log without deleting legacy logs | Explicit coexistence |
| R25 | Existing migration history is present; Phase 1 history query returned no 20260712 rows | Use new migration sequence; verify tracking before execution | Workflow gate |
| R26 | v1.1.0 requires lineage/ambiguity preservation | Every bridge row needs source, source ID, run/version, and conflict state | Mandatory |
| R27 | No verified drift detector was found in current evidence | Add drift checks and operational reporting | Mandatory |
| R28 | No verified coherent-identity test exists | Implement the Malchijah/Zachary verification as completion gate | Mandatory completion gate |

## Explicit scope decision

**Adapter scaffolding tables are confirmed out of Phase 1 scope and deferred to adapter framework work.** Phase 1 creates substrate primitives and the minimum bridge/reconciliation structures required by R20-R28; it must not rebuild adapter scaffolding by inference.

## Current blockers

1. Confirm canonical RLS gate: `organization_members` versus legacy membership sources.
2. Confirm full R20 backfill population and role semantics.
3. Design the R21/R22 correlation keys and lineage model.
4. Define the MAJH Events chart-of-accounts and vocabulary seed values.
5. Treat R28 as the release gate, not as optional verification.

**Interpretation rule:** observed database output is distinguished from recommendation; absence in the query result does not prove absence from every code path.

**Status:** Reconciled against the complete v1.1.0 requirements file after full replacement.
🚫 No SQL has been drafted or executed.
