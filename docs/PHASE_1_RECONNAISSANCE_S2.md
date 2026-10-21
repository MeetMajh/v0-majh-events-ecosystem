# Phase 1 Reconnaissance — Section 2: Existing Primitives Ground Truth

**Status:** Section 2 complete (Q6-Q9)  
**Date:** July 12, 2026  
**For:** Architect (Claude) — Phase 1 SQL requirements validation

---

## Q6. Complete column definitions for entities table

**Query:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'entities'
ORDER BY ordinal_position;
```

**Result (14 rows):**

```json
[
  { "column_name": "id", "data_type": "uuid", "is_nullable": "NO", "column_default": "gen_random_uuid()" },
  { "column_name": "tenant_id", "data_type": "uuid", "is_nullable": "NO", "column_default": null },
  { "column_name": "department_id", "data_type": "uuid", "is_nullable": "YES", "column_default": null },
  { "column_name": "location_id", "data_type": "uuid", "is_nullable": "YES", "column_default": null },
  { "column_name": "entity_type", "data_type": "character varying", "is_nullable": "NO", "column_default": null },
  { "column_name": "name", "data_type": "text", "is_nullable": "NO", "column_default": null },
  { "column_name": "slug", "data_type": "text", "is_nullable": "YES", "column_default": null },
  { "column_name": "description", "data_type": "text", "is_nullable": "YES", "column_default": null },
  { "column_name": "status", "data_type": "character varying", "is_nullable": "YES", "column_default": "'active'::character varying" },
  { "column_name": "metadata", "data_type": "jsonb", "is_nullable": "YES", "column_default": "'{}'::jsonb" },
  { "column_name": "created_by", "data_type": "uuid", "is_nullable": "YES", "column_default": null },
  { "column_name": "created_at", "data_type": "timestamp with time zone", "is_nullable": "YES", "column_default": "now()" },
  { "column_name": "updated_at", "data_type": "timestamp with time zone", "is_nullable": "YES", "column_default": "now()" },
  { "column_name": "deleted_at", "data_type": "timestamp with time zone", "is_nullable": "YES", "column_default": null }
]
```

---

## Q7a. RLS policies on entities table

**Query:**
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'entities';
```

**Result (4 rows):**

```json
[
  {
    "policyname": "entities_delete_tenant_manager",
    "cmd": "DELETE",
    "qual": "(tenant_id IN ( SELECT organization_members.tenant_id FROM organization_members WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.role_key = ANY (ARRAY['TENANT_MANAGER'::text, 'TENANT_OWNER'::text, 'PLATFORM_OWNER'::text])))))",
    "with_check": null
  },
  {
    "policyname": "entities_insert_tenant_manager",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(tenant_id IN ( SELECT organization_members.tenant_id FROM organization_members WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.role_key = ANY (ARRAY['TENANT_MANAGER'::text, 'TENANT_OWNER'::text, 'PLATFORM_OWNER'::text])))))"
  },
  {
    "policyname": "entities_select_tenant_member",
    "cmd": "SELECT",
    "qual": "(tenant_id IN ( SELECT organization_members.tenant_id FROM organization_members WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.is_active = true))))",
    "with_check": null
  },
  {
    "policyname": "entities_update_tenant_manager",
    "cmd": "UPDATE",
    "qual": "(tenant_id IN ( SELECT organization_members.tenant_id FROM organization_members WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.role_key = ANY (ARRAY['TENANT_MANAGER'::text, 'TENANT_OWNER'::text, 'PLATFORM_OWNER'::text])))))",
    "with_check": "(tenant_id IN ( SELECT organization_members.tenant_id FROM organization_members WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.role_key = ANY (ARRAY['TENANT_MANAGER'::text, 'TENANT_OWNER'::text, 'PLATFORM_OWNER'::text])))))"
  }
]
```

---

## Q7b. RLS status on entities table

**Query:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'entities';
```

**Result (1 row):**

```json
[
  { "tablename": "entities", "rowsecurity": true }
]
```

---

## Q8. Complete column definitions for tenants table

**Query:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tenants'
ORDER BY ordinal_position;
```

**Result (19 rows):**

```json
[
  { "column_name": "id", "data_type": "uuid", "is_nullable": "NO", "column_default": "gen_random_uuid()" },
  { "column_name": "name", "data_type": "text", "is_nullable": "NO", "column_default": null },
  { "column_name": "slug", "data_type": "text", "is_nullable": "NO", "column_default": null },
  { "column_name": "owner_id", "data_type": "uuid", "is_nullable": "NO", "column_default": null },
  { "column_name": "stripe_customer_id", "data_type": "text", "is_nullable": "YES", "column_default": null },
  { "column_name": "subscription_tier", "data_type": "text", "is_nullable": "NO", "column_default": "'free'::text" },
  { "column_name": "subscription_status", "data_type": "text", "is_nullable": "YES", "column_default": "'active'::text" },
  { "column_name": "trial_ends_at", "data_type": "timestamp with time zone", "is_nullable": "YES", "column_default": null },
  { "column_name": "max_users", "data_type": "integer", "is_nullable": "YES", "column_default": "5" },
  { "column_name": "max_api_calls_per_month", "data_type": "integer", "is_nullable": "YES", "column_default": "1000" },
  { "column_name": "max_events_per_month", "data_type": "integer", "is_nullable": "YES", "column_default": "10" },
  { "column_name": "current_month_api_calls", "data_type": "integer", "is_nullable": "YES", "column_default": "0" },
  { "column_name": "current_month_events", "data_type": "integer", "is_nullable": "YES", "column_default": "0" },
  { "column_name": "usage_reset_at", "data_type": "timestamp with time zone", "is_nullable": "YES", "column_default": "(date_trunc('month'::text, now()) + '1 mon'::interval)" },
  { "column_name": "settings", "data_type": "jsonb", "is_nullable": "YES", "column_default": "'{}'::jsonb" },
  { "column_name": "features", "data_type": "jsonb", "is_nullable": "YES", "column_default": "'[]'::jsonb" },
  { "column_name": "created_at", "data_type": "timestamp with time zone", "is_nullable": "YES", "column_default": "now()" },
  { "column_name": "updated_at", "data_type": "timestamp with time zone", "is_nullable": "YES", "column_default": "now()" },
  { "column_name": "deleted_at", "data_type": "timestamp with time zone", "is_nullable": "YES", "column_default": null }
]
```

---

## Q8b. Phase 1 required columns check in tenants

**Query:**
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tenants'
  AND column_name IN ('industry_type', 'vocabulary_overlay_id', 'activated_modules', 
                      'default_currency', 'region', 'stripe_connect_account_id')
ORDER BY column_name;
```

**Result (0 rows):**

```json
[no rows]
```

**CRITICAL FINDING:** None of the Phase 1-required columns exist in tenants table. All 6 must be added in Phase 1:
- `industry_type` (TEXT, tenant vertical/classification)
- `vocabulary_overlay_id` (UUID, FK to vocabulary_overlays)
- `activated_modules` (JSONB, list of active module UUIDs)
- `default_currency` (VARCHAR, tenant base currency)
- `region` (TEXT, tenant geographic region)
- `stripe_connect_account_id` (TEXT, for platform-connected payments)

---

## Q9a. Complete column definitions for departments

**Query:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'departments'
ORDER BY ordinal_position;
```

**Result (9 rows):**

```json
[
  { "column_name": "id", "data_type": "uuid", "is_nullable": "NO", "column_default": "gen_random_uuid()" },
  { "column_name": "tenant_id", "data_type": "uuid", "is_nullable": "NO", "column_default": null },
  { "column_name": "slug", "data_type": "text", "is_nullable": "NO", "column_default": null },
  { "column_name": "name", "data_type": "text", "is_nullable": "NO", "column_default": null },
  { "column_name": "description", "data_type": "text", "is_nullable": "YES", "column_default": null },
  { "column_name": "is_active", "data_type": "boolean", "is_nullable": "YES", "column_default": "true" },
  { "column_name": "sort_order", "data_type": "integer", "is_nullable": "YES", "column_default": "0" },
  { "column_name": "created_at", "data_type": "timestamp with time zone", "is_nullable": "YES", "column_default": "now()" },
  { "column_name": "updated_at", "data_type": "timestamp with time zone", "is_nullable": "YES", "column_default": "now()" }
]
```

---

## Q9b. Complete column definitions for locations

**Query:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'locations'
ORDER BY ordinal_position;
```

**Result (11 rows):**

```json
[
  { "column_name": "id", "data_type": "uuid", "is_nullable": "NO", "column_default": "gen_random_uuid()" },
  { "column_name": "tenant_id", "data_type": "uuid", "is_nullable": "NO", "column_default": null },
  { "column_name": "department_id", "data_type": "uuid", "is_nullable": "NO", "column_default": null },
  { "column_name": "slug", "data_type": "text", "is_nullable": "NO", "column_default": null },
  { "column_name": "name", "data_type": "text", "is_nullable": "NO", "column_default": null },
  { "column_name": "currency", "data_type": "character varying", "is_nullable": "YES", "column_default": "'USD'::character varying" },
  { "column_name": "timezone", "data_type": "text", "is_nullable": "YES", "column_default": "'UTC'::text" },
  { "column_name": "tax_rate", "data_type": "numeric", "is_nullable": "YES", "column_default": "0.0000" },
  { "column_name": "is_active", "data_type": "boolean", "is_nullable": "YES", "column_default": "true" },
  { "column_name": "created_at", "data_type": "timestamp with time zone", "is_nullable": "YES", "column_default": "now()" },
  { "column_name": "updated_at", "data_type": "timestamp with time zone", "is_nullable": "YES", "column_default": "now()" }
]
```

---

## Q9c. Departments content

**Query:**
```sql
SELECT id, tenant_id, slug, name, sort_order
FROM public.departments
ORDER BY sort_order;
```

**Result (4 rows):**

```json
[
  { "id": "87479c4f-b6ec-4465-8634-84f60929987f", "tenant_id": "8dd63bc0-1742-478e-8743-dc55ce2b7127", "slug": "esports", "name": "MAJH Esports", "sort_order": 10 },
  { "id": "1ba49e91-a20c-44ad-b65b-2ba0d2ff846d", "tenant_id": "8dd63bc0-1742-478e-8743-dc55ce2b7127", "slug": "carbadmv", "name": "CarBadMV", "sort_order": 20 },
  { "id": "c3eb72a5-6501-448d-a9d4-a3a139649a24", "tenant_id": "8dd63bc0-1742-478e-8743-dc55ce2b7127", "slug": "tradewinds-rb", "name": "Tradewinds RB", "sort_order": 30 },
  { "id": "80a6d34e-8d61-47cb-940d-35b2eac85d67", "tenant_id": "8dd63bc0-1742-478e-8743-dc55ce2b7127", "slug": "trs", "name": "The Rest Stop (T.R.S.)", "sort_order": 40 }
]
```

---

## Q9d. Locations content

**Query:**
```sql
SELECT id, tenant_id, department_id, slug, name, currency, timezone, tax_rate
FROM public.locations
ORDER BY department_id, slug;
```

**Result (5 rows):**

```json
[
  { "id": "50c977f9-8cbd-4aad-8709-5a8bfeeb2015", "tenant_id": "8dd63bc0-1742-478e-8743-dc55ce2b7127", "department_id": "1ba49e91-a20c-44ad-b65b-2ba0d2ff846d", "slug": "dc-metro", "name": "DC Metro Area", "currency": "USD", "timezone": "America/New_York", "tax_rate": "0.0600" },
  { "id": "5a693a12-6043-4b00-8699-996e50f75cd3", "tenant_id": "8dd63bc0-1742-478e-8743-dc55ce2b7127", "department_id": "80a6d34e-8d61-47cb-940d-35b2eac85d67", "slug": "bgi-airport", "name": "Barbados Airport Kiosk", "currency": "BBD", "timezone": "America/Barbados", "tax_rate": "0.1750" },
  { "id": "1664d175-074c-4067-8e13-2c40efd7d35e", "tenant_id": "8dd63bc0-1742-478e-8743-dc55ce2b7127", "department_id": "87479c4f-b6ec-4465-8634-84f60929987f", "slug": "digital", "name": "Digital Operations", "currency": "USD", "timezone": "America/New_York", "tax_rate": "0.0000" },
  { "id": "3a9c29b7-f248-4c0b-8169-5862b86a5791", "tenant_id": "8dd63bc0-1742-478e-8743-dc55ce2b7127", "department_id": "c3eb72a5-6501-448d-a9d4-a3a139649a24", "slug": "barbados", "name": "Barbados HQ", "currency": "BBD", "timezone": "America/Barbados", "tax_rate": "0.1750" },
  { "id": "66e2ec28-6e55-4426-a2ab-2a4bb6ab588a", "tenant_id": "8dd63bc0-1742-478e-8743-dc55ce2b7127", "department_id": "c3eb72a5-6501-448d-a9d4-a3a139649a24", "slug": "st-lucia", "name": "St. Lucia Hub", "currency": "XCD", "timezone": "America/St_Lucia", "tax_rate": "0.1250" }
]
```

---

## Key Findings

### Entities Table
- **Structure:** Well-designed generic entity container with type, tenant, department, location scoping
- **RLS:** 4 policies in place (select for active members, insert/update/delete for managers)
- **Ready for Phase 1:** Yes, can be used as-is or extended

### Tenants Table
- **Structure:** 19 columns (subscription tier, limits, usage tracking, settings)
- **Critical gap:** 0 of 6 Phase 1-required columns present (industry_type, vocabulary_overlay_id, activated_modules, default_currency, region, stripe_connect_account_id)
- **Impact:** Phase 1 must ADD these columns

### Departments (4 active)
- MAJH Esports
- CarBadMV
- Tradewinds RB
- The Rest Stop (T.R.S.)

### Locations (5 total)
- Multi-currency: USD (DC, Digital), BBD (Barbados, Airport), XCD (St. Lucia)
- Multi-timezone: America/New_York, America/Barbados, America/St_Lucia
- Tax rates: 0%, 6%, 12.5%, 17.5%
- All tied to parent departments correctly

---

## Status

Ground truth documented. Section 2 complete and committed.

**AWAITING:** Architect review before proceeding to Section 3 (financial spine).

DO NOT PROCEED TO PHASE 1 SQL until architect confirms:
1. Tenants table column additions approach (ALTER TABLE vs migration strategy)
2. Entities table usage (keep as-is vs extend for Phase 1)
3. Namespace decision confirmation (core.* and platform.* schemas)
