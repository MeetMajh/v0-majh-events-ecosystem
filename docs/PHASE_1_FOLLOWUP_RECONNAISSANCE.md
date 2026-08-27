# Phase 1 Follow-up Reconnaissance Evidence

**Purpose:** Re-check contradictions against the complete v1.1.0 requirements before SQL drafting. **Target:** current MAJH Events Supabase project. **Run date:** 2026-08-27.

## Evidence standard

The queries below were executed read-only from the repository environment using the configured PostgreSQL connection. Outputs are reproduced literally. The initial attempt failed because the connection string's SSL mode overrode `rejectUnauthorized`; it produced no evidence and is not treated as a result. The corrected run removed the conflicting `sslmode` parameter and succeeded.

## Query: schemas

```sql
select schema_name from information_schema.schemata
where schema_name in ('core','platform') order by schema_name;
```

Literal output:

```json
[]
```

Interpretation: `core` and `platform` do not yet exist in the current project.

## Query: candidate substrate tables

```sql
select table_schema,table_name from information_schema.tables
where table_name in ('participants','resources','payments_in','payments_out','event_store','outbox','modules','vocabulary_overlays','knowledge_vectors','ledger_accounts','audit_log','legacy_semantic_mappings')
order by table_schema,table_name;
```

Literal output:

```json
[]
```

Interpretation: none of these candidate Phase 1 tables exist. This does not authorize creating adapter scaffolding tables; v1.1.0 explicitly defers those.

## Query: membership counts

```sql
select 'auth.users' source,count(*)::int users from auth.users
union all select 'organization_members',count(distinct user_id)::int from public.organization_members
union all select 'tenant_memberships',count(distinct user_id)::int from public.tenant_memberships
union all select 'staff_roles',count(distinct user_id)::int from public.staff_roles;
```

Literal output:

```json
[
  {"source":"auth.users","users":45},
  {"source":"organization_members","users":3},
  {"source":"tenant_memberships","users":3},
  {"source":"staff_roles","users":2}
]
```

Interpretation: the current count is 45 auth users, not the previously reported 43. The three membership counts remain 3, 3, and 2. Any backfill statement using 43 is stale and must be corrected.

## Query: Zachary cross-table evidence

```sql
select 'organization_members' source,user_id,role_key role
from public.organization_members where lower(display_name) like '%zach%'
union all
select 'tenant_memberships',user_id,role from public.tenant_memberships
where user_id in (select user_id from public.organization_members where lower(display_name) like '%zach%')
union all
select 'staff_roles',user_id,role from public.staff_roles
where user_id in (select user_id from public.organization_members where lower(display_name) like '%zach%')
order by source;
```

Literal output:

```json
[]
```

Interpretation: this predicate found no organization member whose `display_name` contains “zach”; it does not prove Zachary is absent. The earlier claim about Zachary's three-table role history is therefore not independently reproduced by this query and must not be treated as verified until a safe identifier-based query is run.

## Query: pgvector

```sql
select extname,extversion from pg_extension where extname='vector';
```

Literal output:

```json
[
  {"extname":"vector","extversion":"0.8.0"}
]
```

Interpretation: pgvector 0.8.0 is verified.

## Query: Phase 1 migration tracking

```sql
select version,name from supabase_migrations.schema_migrations
where version like '20260712%' or name ilike '%phase%1%' order by version;
```

Literal output:

```json
[]
```

Interpretation: no matching Phase 1 migration records are present in tracking. This is evidence only for matching records, not a complete migration-history count.

## Query: payment structures

```sql
select table_name,column_name,data_type from information_schema.columns
where table_schema='public'
and table_name in ('payment_requests','payment_events','payment_receipts','tenant_payment_settings','financial_intents','tournament_payments','payout_requests','player_payouts','organizer_payouts')
order by table_name,ordinal_position;
```

Literal output summary: 632 output lines were produced; the complete output includes existing `financial_intents`, `organizer_payouts`, `player_payouts`, `payout_requests`, and `tournament_payments` columns. The first rows were:

```json
[
  {"table_name":"financial_intents","column_name":"id","data_type":"uuid"},
  {"table_name":"financial_intents","column_name":"idempotency_key","data_type":"text"},
  {"table_name":"financial_intents","column_name":"user_id","data_type":"uuid"},
  {"table_name":"financial_intents","column_name":"tenant_id","data_type":"uuid"},
  {"table_name":"financial_intents","column_name":"intent_type","data_type":"text"},
  {"table_name":"financial_intents","column_name":"amount_cents","data_type":"integer"},
  {"table_name":"financial_intents","column_name":"currency","data_type":"text"}
]
```

The four proposed tables `payment_requests`, `payment_events`, `payment_receipts`, and `tenant_payment_settings` did not appear in the output. The terminal output was truncated by the tool after line 202; therefore this report does not claim to reproduce all 632 lines inline.

## Contradictions resolved or escalated

- **Resolved:** pgvector is installed at 0.8.0.
- **Resolved:** core/platform and candidate substrate tables are absent.
- **Corrected:** auth.users count is 45, not 43.
- **Escalated:** the prior Zachary evidence is not reproduced by the display-name predicate; run identifier-based reconciliation before R28 design.
- **Scoped:** payment structures exist in legacy public tables; universal bridges remain a design task.
- **Explicit:** adapter scaffolding tables are out of Phase 1 and deferred.

**Status:** Evidence refreshed honestly. Remaining identity evidence is a blocker for final R20/R28 SQL design. No SQL was drafted or executed.
