# Phase 1 Follow-up Reconnaissance Evidence

**Date:** August 27, 2026
**Target:** Current project database, read-only queries
**Purpose:** Resolve contradictions before SQL drafting.

## Query outputs

### Schemas

```text
SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('core','platform') ORDER BY schema_name;
Output (0 rows): []
```

**Finding:** Neither substrate schema currently exists.

### Candidate substrate tables

```text
SELECT table_schema,table_name FROM information_schema.tables WHERE table_name IN ('participants','resources','payments_in','payments_out','event_store','outbox','modules','vocabulary_overlays','knowledge_vectors','ledger_accounts','audit_log') ORDER BY table_schema,table_name;
Output (0 rows): []
```

**Finding:** No candidate substrate tables were found by this exact-name query. This does not replace a complete schema inventory for similarly named legacy tables.

### Distinct membership populations

```json
[
  {"source":"auth.users","users":45},
  {"source":"organization_members","users":3},
  {"source":"staff_roles","users":2},
  {"source":"tenant_memberships","users":3}
]
```

**Finding:** The three membership sources are not interchangeable by population and must not be consolidated by inference.

### Zachary membership evidence

```json
[
  {"source":"organization_members","user_id":"be0f0132-14ed-4777-a4e5-59b13f99e805","role":"TENANT_MANAGER"},
  {"source":"tenant_memberships","user_id":"be0f0132-14ed-4777-a4e5-59b13f99e805","role":"admin"},
  {"source":"staff_roles","user_id":"be0f0132-14ed-4777-a4e5-59b13f99e805","role":"TENANT_MANAGER"}
]
```

**Finding:** Zachary is present in all three sources. The two TENANT_MANAGER values agree exactly; `admin` requires the documented approximate semantic mapping to `tenant_manager`. This case must be represented as one coherent participant with complete lineage and an explicit conflict state determined by the drafted reconciliation rule.

### pgvector

```json
[{"extname":"vector","extversion":"0.8.0"}]
```

**Finding:** The extension is enabled; R3 should verify and reuse it rather than attempt an unnecessary install.

### Migration tracking query

```text
SELECT version,name FROM supabase_migrations.schema_migrations WHERE version LIKE '20260712%' OR name ILIKE '%phase%1%' ORDER BY version;
Output (0 rows): []
```

**Finding:** This query found no matching migration records. It does not prove the full migration history is empty; a complete inventory and repository migration review remain required.

## Contradictions resolved or still open

Resolved: requirement count is 28; R26-R28 are mandatory; R28 is the completion gate. Resolved: the participant source is `auth.users`, not an assumed `user_profiles` table. Resolved: adapter scaffolding tables are explicitly deferred. Still open: exact tenant identity, Malchijah profile IDs, payment/payout correlation keys, entities dependents, ledger grants/order, and existing auth trigger behavior.

These are literal outputs from read-only reconnaissance, not completion evidence. They should be attached to the SQL review packet and extended before any mutation is drafted.
