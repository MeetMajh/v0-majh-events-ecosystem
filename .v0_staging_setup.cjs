const { Client } = require('pg');

// Production connection (from env)
let prodUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.SUPABASE_DB_URL;
prodUrl = prodUrl.replace(/([?&])sslmode=[^&]*/,'$1').replace(/[?&]$/,'');

const stagingProjectRef = 'gyyswaidsfjstterckrc';
const stagingRegion = 'us-east-1';

// Construct staging URL (standard Supabase pattern)
// Format: postgres://postgres:{password}@db.{region}.supabase.co:5432/postgres
// We'll need to get the password from the user, but first show what we can determine

console.log(`
=== STAGING PROJECT SETUP ===

Staging Project Information:
- Project Ref: ${stagingProjectRef}
- Region: ${stagingRegion}
- Dashboard: https://supabase.com/dashboard/project/${stagingProjectRef}

CRITICAL NEXT STEP:

I need the staging database password to construct the connection string.

To get it:
1. Go to https://supabase.com/dashboard/project/${stagingProjectRef}
2. Settings → Database → New Password (or view existing)
3. Or: Settings → Database → Connection Pooler → Database URL
4. Copy the full connection string OR just the password part

The staging connection string will be:
postgres://postgres:{PASSWORD}@db.${stagingRegion}.supabase.co:5432/postgres?sslmode=require

OR you can paste the full connection pooler URL from the dashboard.

ONCE I HAVE THE STAGING URL, I WILL:

1. Test staging connection (verify it's accessible)
2. Dump production schema via pg_dump
3. Restore schema to staging
4. Verify structural match (tables, columns, RLS, indexes)
5. Run Phase 1 reconnaissance queries against both
6. Produce ground truth report
7. Draft Phase 1 SQL with full confidence
8. Bring to you for final review before deployment

WAITING FOR:
Your staging database password or full connection string
`);
