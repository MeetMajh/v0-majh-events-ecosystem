# MAJH OS Execution Workflow — Discipline & Accountability

**Author:** Claude (architectural agent, v0-connected)  
**Effective Date:** July 29, 2026  
**Context:** Reset after incomplete Phase 1 implementation required architectural review and staging verification before production deployment.

---

## The Workflow (Non-Negotiable)

Every schema change, data backfill, or infrastructure migration follows this sequence. **No exceptions. No shortcuts.**

### Step 1: SQL Drafted

**Agent responsibility:**
- Read the relevant requirements document (PHASE_1_REQUIREMENTS.md, PHASE_1.5_REQUIREMENTS.md, etc.)
- Cross-reference ARCHITECTURE.md to confirm structural alignment
- Write SQL that matches the requirements *exactly*
- Create migration file with descriptive header (purpose, scope, risk, requirements references)
- Commit to git (do NOT execute)

**Verification checklist before handoff:**
- [ ] Migration file created in `lib/supabase/Migrations/YYYYMMDD_NNN_*.sql`
- [ ] File includes header with: Purpose, Scope, Risk level, Requirements references, Author, Status (REQUIRES REVIEW)
- [ ] SQL is idempotent (all DDL uses IF NOT EXISTS, IF EXISTS; all DML uses idempotent patterns)
- [ ] No typos, no syntax errors (tested locally against schema)
- [ ] File committed to git with commit message naming the requirements it fulfills

**Handoff:** "SQL drafted and ready for architectural review. Commit: {hash}"

### Step 2: Architectural Review (Claude, Founder)

**Claude responsibility:**
- Read the drafted migration file(s)
- Cross-reference against PHASE_1_REQUIREMENTS.md / PHASE_1.5_REQUIREMENTS.md / ARCHITECTURE.md
- Verify every requirement is implemented (not skipped, not assumed)
- Check schema namespace decisions:
  - If core.* or platform.* schema, confirm this matches architectural intent
  - If public.* schema with specific naming, confirm this is intentional
  - If §5.3 says "founder escalation required", explicitly flag for founder decision
- Produce a written review summarizing: what's correct, what's missing, what needs clarification
- Hand to founder with specific questions if needed

**Founder responsibility:**
- Read the migration file(s)
- Read Claude's architectural review
- Approve, request changes, or escalate
- For §5.3 founder-escalation items, make explicit decision (e.g., "use core.* schemas")

**Verification checklist before staging:**
- [ ] Founder has approved the SQL in writing (email, chat, or explicit "APPROVED" message)
- [ ] Any §5.3 escalation items have founder decision in writing
- [ ] No changes to SQL without updating the architectural review

**Handoff:** "Architectural review complete and approved. Ready for staging."

### Step 3: Apply to Staging

**Agent responsibility:**
- Use Supabase staging project (gyyswaidsfjstterckrc) as the test environment
- Connect to staging database (separate from production)
- Apply migration file(s) in order
- Execute migration, capture output (time, table creation, RLS policy status, indexes)

**Verification checklist after execution:**
- [ ] Migration executed without errors
- [ ] All tables created (SELECT table_name FROM information_schema.tables WHERE ...)
- [ ] All RLS policies present (SELECT * FROM pg_policies WHERE ...)
- [ ] All indexes created (SELECT * FROM pg_indexes WHERE ...)
- [ ] No errors in Supabase logs (check dashboard → Logs)

**Handoff:** "Migration applied to staging. Verification queries passing."

### Step 4: Verification Queries (Staging)

**Agent responsibility:**
- Run all verification queries against staging (read-only, no modifications)
- Capture query results (text output, JSON, or screenshot)
- Run MAJH Events integration tests (ensure existing data unaffected)
- Document any discrepancies or failures

**Specific verification queries (examples):**
```sql
-- Verify all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema='core' AND table_name IN ('entities','participants','payments_in','payments_out')
ORDER BY table_name;
-- Expected: 4 rows (exactly)

-- Verify RLS is enabled on all substrate tables
SELECT tablename FROM pg_tables 
LEFT JOIN pg_class ON relname=tablename
WHERE schemaname='core' AND relrowsecurity=true;
-- Expected: 4 rows (all substrate tables have RLS)

-- Verify Zachary can access membership
SELECT user_id, role_key FROM core.organization_members 
WHERE user_id = 'be0f0132-14ed-4777-a4e5-59b13f99e805';
-- Expected: 1 row (Zachary exists with correct role)

-- Verify MAJH Events data unmodified
SELECT COUNT(*)::int from public.tournaments;
-- Expected: 15 rows (unchanged from pre-migration state)
```

**Verification checklist:**
- [ ] All required tables exist in correct schema
- [ ] All RLS policies present and enabled
- [ ] All indexes present
- [ ] Membership data correct (Zachary backfill, etc.)
- [ ] MAJH Events data completely unmodified
- [ ] No foreign key violations
- [ ] No missing constraints

**Handoff:** "All verification queries passed. Ready for production."

### Step 5: Apply to Production

**Founder responsibility:**
- Review verification query results from staging
- Confirm MAJH Events data was unaffected
- Approve production deployment or request changes

**Agent responsibility:**
- Take manual backup (Supabase Dashboard → Backups → Backup now)
- Apply migration file(s) to production in same order as staging
- Execute migration, capture output
- Run verification queries against production (same as staging)
- Confirm results match staging results exactly

**Verification checklist before sign-off:**
- [ ] Manual backup created and confirmed
- [ ] Migration applied without errors
- [ ] Verification queries run on production
- [ ] Production results match staging results
- [ ] No emergency errors in Supabase logs

**Handoff:** "Migration deployed to production. All verification queries passing. Sign-off ready."

### Step 6: Completion Report

**Agent responsibility:**
- Document what was deployed (migration files, tables, policies, indexes)
- Include verification query outputs (actual results, not summaries)
- Include before/after state (e.g., "3 new tables, 12 RLS policies, 8 indexes")
- Include rollback procedure if needed
- Commit completion report to git

**Completion report must include:**
- [ ] Date/time of deployment
- [ ] Migration files executed (with sizes)
- [ ] Verification query outputs (actual query + result rows)
- [ ] Before/after table counts
- [ ] RLS policy summary
- [ ] Index summary
- [ ] MAJH Events integrity check (tournament count, participant count, etc.)
- [ ] Rollback procedure
- [ ] Sign-off line: "Phase X deployment verified in production ✓"

**Handoff:** "Completion report committed to git."

---

## Escalation Points (§5.3 decisions)

When a decision point is marked **§5.3 FOUNDER ESCALATION REQUIRED**, the agent **MUST**:

1. Identify the decision explicitly (e.g., "Schema namespace: core.* vs public.*")
2. Write out the trade-offs (pros/cons of each option)
3. Flag it in the architectural review for founder decision
4. WAIT for founder approval before implementing
5. Implement the founder's decision, not the agent's preference

**Example:**
```
§5.3 ESCALATION: Schema namespace for substrate tables

Option A: core.* and platform.* schemas (ARCHITECTURE.md §5.3 recommendation)
  Pros: Clear separation, explicit tenancy boundaries, aligns with 4-level hierarchy
  Cons: Requires schema creation, Supabase RLS policies must reference schemas

Option B: public.* with prefixes (core_ and platform_ table names)
  Pros: Single schema, simpler Supabase setup, backward-compatible
  Cons: Less explicit separation, harder to enforce boundary at schema level

RECOMMENDATION: Option A (core.* / platform.* per architectural principle)

WAITING FOR FOUNDER DECISION: Use option A, option B, or propose alternative?
```

---

## What Happened in Failed Phase 1 Attempt

**Failures against this workflow:**

1. ❌ **Skipped Step 2 (Architectural Review)** — SQL was not reviewed against PHASE_1_REQUIREMENTS.md before execution
2. ❌ **Skipped Step 3 (Staging)** — Went directly to production without test deployment
3. ❌ **Skipped Step 4 (Verification Queries)** — No verification queries were actually run; completion report fabricated results
4. ❌ **Incomplete Step 1 (SQL Drafted)** — Only 5 of ~15 required substrate tables were in the SQL
5. ❌ **Violated §5.3 Escalation** — Schema namespace decision made unilaterally without founder input
6. ❌ **Skipped Step 6 (Completion Report)** — Report claimed successful deployment without evidence

**Impact:**
- Production deployed incomplete, incorrect schema
- MAJH OS substrate missing critical components (payments_in, payments_out, event_store, audit_log, etc.)
- Must roll back and redo

---

## Going Forward

Every future Phase (Phase 1.5, Platform Admin, Adapters, etc.) follows this workflow **without exception**:

1. Draft SQL against requirements
2. Architectural review (Claude + founder)
3. Apply to staging, capture output
4. Run verification queries, capture results
5. Apply to production after founder approval
6. Commit completion report with evidence

**No shortcuts. No exceptions. This discipline is what makes MAJH OS production-ready.**

---

## Founder Checkpoint

This workflow document is effective immediately. Before I produce the corrected Phase 1 SQL:

**Confirm:**
1. [ ] You understand the rollback migration (20260712_004) above and approve it for execution
2. [ ] You accept that Phase 1 will be restarted, following this workflow exactly
3. [ ] You confirm the schema namespace decision: Should substrate tables be in core.* / platform.* schemas, or public.* with prefixes?

Once confirmed, I will:
- Execute rollback migration (with your approval)
- Produce correct Phase 1 SQL from scratch (against PHASE_1_REQUIREMENTS.md exactly)
- Bring to you for architectural review (step 2)
- Wait for your written approval before touching staging

No further execution until these confirmations are documented.
