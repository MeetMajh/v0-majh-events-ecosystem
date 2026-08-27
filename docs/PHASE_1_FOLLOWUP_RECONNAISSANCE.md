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

Exact predicate previously run:

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

This predicate was insufficient because it depended on `organization_members.display_name`. It did not definitively resolve Zachary's identity or role history.

## Query: complete membership role union

```sql
SELECT 'organization_members' AS src, user_id, role_key FROM public.organization_members
UNION ALL SELECT 'tenant_memberships', user_id, role FROM public.tenant_memberships
UNION ALL SELECT 'staff_roles', user_id, role FROM public.staff_roles
ORDER BY user_id, src;
```

Literal output:

```json
[{"src":"organization_members","user_id":"69d91884-a1ca-415a-b96d-2fcda4ff6d78","role_key":"PLATFORM_OWNER"},{"src":"staff_roles","user_id":"69d91884-a1ca-415a-b96d-2fcda4ff6d78","role_key":"PLATFORM_OWNER"},{"src":"tenant_memberships","user_id":"69d91884-a1ca-415a-b96d-2fcda4ff6d78","role_key":"owner"},{"src":"organization_members","user_id":"be0f0132-14ed-4777-a4e5-59b13f99e805","role_key":"TENANT_MANAGER"},{"src":"staff_roles","user_id":"be0f0132-14ed-4777-a4e5-59b13f99e805","role_key":"TENANT_MANAGER"},{"src":"tenant_memberships","user_id":"be0f0132-14ed-4777-a4e5-59b13f99e805","role_key":"admin"},{"src":"organization_members","user_id":"e04db1dd-bf0c-4aa0-82b9-e344f3901282","role_key":"TENANT_OWNER"},{"src":"tenant_memberships","user_id":"e04db1dd-bf0c-4aa0-82b9-e344f3901282","role_key":"owner"}]
```

The result definitively shows three organization members, three tenant memberships, and two staff-role rows. It does not identify which UUID is Zachary without a safe join to `auth.users` or another approved identity field; Zachary's specific history remains unresolved.

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

## Query: payment structures — scoped rerun

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('payment_requests','payment_events','payment_receipts')
ORDER BY table_name, ordinal_position;
```

Literal output:

```json
[]
```

The scoped structure query returned no rows: none of the three requested tables exists in `public`.

## Query: payment rows — complete table checks

Requested queries:

```sql
SELECT * FROM public.payment_requests;
SELECT * FROM public.payment_events;
SELECT * FROM public.payment_receipts;
```

Literal outputs:

```text
ERROR: 42P01: relation "public.payment_requests" does not exist
```

```text
ERROR: 42P01: relation "public.payment_events" does not exist
```

```text
ERROR: 42P01: relation "public.payment_receipts" does not exist
```

These results supersede the earlier 632-line, broad metadata query for the purposes of R21. R21 cannot currently be analyzed through those three named tables because they are absent from the connected current project. Existing payment-related legacy tables require a separately scoped query before any correlation design is drafted.

## Contradictions resolved or escalated

- **Resolved:** pgvector is installed at 0.8.0.
- **Resolved:** core/platform and candidate substrate tables are absent.
- **Corrected:** auth.users count is 45, not 43.
- **Escalated:** the prior Zachary evidence is not reproduced by the display-name predicate; run identifier-based reconciliation before R28 design.
- **Scoped:** payment structures exist in legacy public tables; universal bridges remain a design task.
- **Explicit:** adapter scaffolding tables are out of Phase 1 and deferred.

**Status:** Evidence refreshed honestly. Remaining identity evidence is a blocker for final R20/R28 SQL design. No SQL was drafted or executed.
