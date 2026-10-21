# Phase 1 Implementation Decisions

**Status:** Locked decisions, ready for SQL implementation
**Decided:** July 12, 2026 by Founder (Malchijah)
**Ground truth:** Production reconnaissance Q1-Q36 (full report in execution notes)
**Architecture:** ARCHITECTURE.md v2.1.0, PHASE_1_REQUIREMENTS.md v1.0.0

---

## Decision 1: Membership Consolidation Approach

**Decision:** Backfill Zachary (be0f0132-14ed-4777-a4e5-59b13f99e805) into `organization_members` with role `TENANT_MANAGER`

**Rationale:**
- Current state: Zachary is in `tenant_memberships` and `staff_roles`, but missing from `organization_members`
- Phase 1 new tables will gate RLS on `organization_members` (chosen as canonical because it has dept/location columns needed for four-level hierarchy)
- Without Zachary in `organization_members`, he is locked out of all new substrate operations
- This is a one-row backfill with zero impact on existing functionality

**SQL approach:**
```sql
INSERT INTO organization_members 
  (tenant_id, user_id, role_key, is_active, invited_at, accepted_at)
VALUES 
  ('8dd63bc0-1742-478e-8743-dc55ce2b7127', 'be0f0132-14ed-4777-a4e5-59b13f99e805', 'TENANT_MANAGER', true, NOW(), NOW())
ON CONFLICT DO NOTHING;
```

**Scope:** Part of Phase 1 schema migration, executed before new RLS policies land

**Full membership consolidation (combining all three tables):** Deferred to separate ticket. Phase 1 uses `organization_members` as canonical for new tables; existing tables keep existing RLS until consolidation work is planned.

---

## Decision 2: Substrate Table Naming and Parallel Bridge Architecture

**Decision:** Create both universal substrate tables AND keep MAJH Events typed tables as bridge/module layer

**Universal substrate tables to create (per ARCHITECTURE.md §4):**
- `entities` (generic container for any resource type: tournament, event, player_group, etc.)
  - Columns: id, tenant_id, department_id, location_id, entity_type (ENUM), name, description, metadata, created_at, updated_at
- `participants` (universal person/role container)
  - Columns: id, tenant_id, entity_id, user_id, role_key, participation_status, joined_at, left_at, created_at, updated_at
- `resources` (equipment, venues, materials, anything with allocation)
  - Columns: id, tenant_id, location_id, resource_type (ENUM), name, quantity, unit, status, created_at, updated_at
- `resource_allocations` (who/what uses what resource in what context)
  - Columns: id, tenant_id, entity_id, resource_id, quantity_allocated, period_start, period_end, created_at, updated_at

**Existing MAJH Events tables kept as-is (bridge layer):**
- `tournaments` (typed entity, continues to exist)
- `tournament_participants` (typed participant, continues to exist)
- Will add FK pointers to substrate entities during Phase 1.5 backfill

**Rationale:**
- Universal primitives are mandatory for multi-tenant substrate (per ARCHITECTURE.md §2: "substrate must serve any tenant without tenant-specific code")
- Keeping MAJH Events typed tables in parallel allows gradual migration (Phase 1.5 backfill, Phase 2 cutover) with zero downtime
- This temporarily creates duplication (one tournament exists in both `tournaments` and `entities`), but that's resolved in Phase 1.5
- Bridge tables will have FK pointers to substrate entities: `tournaments.entity_id` → `entities.id`

**Scope:** Phase 1 creates both; Phase 1.5 backfills mappings; Phase 2 consolidates

---

## Decision 3: External System Mapping Tables — Scaffolding in Phase 1

**Decision:** Phase 1 includes mapping scaffolding (create the structure, don't populate)

**Tables to create (scaffolding only, no data):**

1. **`external_field_mappings`** — registry of how external system fields map to substrate
   ```
   Columns: id, tenant_id, external_system (ENUM: monday, quickbooks, square, pos), 
            external_field_name, substrate_entity_type, substrate_field_name, 
            data_type_mapping, direction (read/write/bidirectional), active, created_at
   ```

2. **`external_system_credentials`** — secure storage for API keys (not populated Phase 1)
   ```
   Columns: id, tenant_id, external_system, credential_type, credential_ref (pointer to secrets storage),
            verified_at, status, created_at
   ```

3. **`sync_queue`** — event queue for external system syncs (not populated Phase 1)
   ```
   Columns: id, tenant_id, external_system, sync_direction (inbound/outbound), 
            entity_id, change_type, status, scheduled_at, attempted_at, created_at
   ```

4. **`adapter_logs`** — audit trail for adapter operations (scaffolding for Phase 1.5+ use)
   ```
   Columns: id, tenant_id, adapter_name, operation, status, details (jsonb), created_at
   ```

**Rationale:**
- These tables enable Phase 1.5 adapter work (Monday.com, QB, Square, POS) without Phase 1 being blocked on their implementation
- Scaffolding now = zero rework when adapters land; structure is ready, just needs population
- Keeps Phase 1 scope clear: substrate + bridge + audit infrastructure; adapters are Phase 1.5+

**Scope:** Create tables with full schema and RLS policies; no initial data; documented in ADAPTER_MAPPINGS.md when first adapter uses them (Phase 1.5)

---

## Phase 1 Implementation Sequence

1. **Membership fix:** Backfill Zachary into organization_members
2. **Create universal substrate tables:** entities, participants, resources, resource_allocations
3. **Create bridge infrastructure:** external_field_mappings, external_system_credentials, sync_queue, adapter_logs
4. **Create event store:** platform_events table (append-only audit log)
5. **Create module registry:** modules table (vocabulary overlay registry per tenant)
6. **Enable RLS:** All new tables gate on organization_members with TENANT_MANAGER+ requirement
7. **Backfill data:** Tournaments → entities, tournament_participants → participants (read-only pointers for now)
8. **Verify:** Test all inserts/updates/reads against MAJH Events data; confirm no production impact

---

## Migration Files Generated

Phase 1 requires 3 migration files (format: `YYYYMMDD_NNN_description.sql`):

1. `20260712_001_phase_1_membership_consolidation.sql` — Zachary backfill
2. `20260712_002_phase_1_substrate_primitives.sql` — Create entities, participants, resources, resource_allocations, module registry, event store
3. `20260712_003_phase_1_bridge_and_adapters.sql` — Create external system mapping tables with RLS

All migrations idempotent (use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, etc.)

---

## Verification & Sign-off

- [ ] Supabase branch workflow verified end-to-end
- [ ] Production backup taken
- [ ] Phase 1 SQL drafted
- [ ] Applied to Supabase preview branch
- [ ] Tested against MAJH Events data (15 tournaments, 56 players, existing payouts)
- [ ] RLS policies verified (Zachary can now access all substrate tables)
- [ ] Founder approval before applying to production

---

## References

- Ground truth: Production reconnaissance report (Q1-Q36)
- Architecture: docs/ARCHITECTURE.md v2.1.0, especially §2 (Universal Primitives), §3 (Four-Level Hierarchy), §4 (Entity Model), §7 (RLS Strategy)
- Requirements: docs/PHASE_1_REQUIREMENTS.md v1.0.0
- Canon bridge doc: docs/CAPABILITY_MAP.md v1.0.1 (one-sentence rule: bridge layer is transparent to substrate)
