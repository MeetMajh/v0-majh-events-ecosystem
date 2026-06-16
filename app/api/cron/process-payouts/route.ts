import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireCronAuth } from "@/lib/cron-auth"
import { getStripe } from "@/lib/stripe"

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUT EXECUTION WORKER — PAUSED
// Processes eligible payouts via Stripe Connect transfers
// Runs every 5 minutes via Vercel Cron
//
// PAUSED 2026-06-16. See GET handler below for context.
// ═══════════════════════════════════════════════════════════════════════════════

// Lazy initialization for service role client
// Kept for when this route is rebuilt against the unified payout architecture.
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase env vars not configured")
  return createClient(url, key)
}

// Original payout shape — kept as a reference for the rebuild.
// The unified architecture will replace `tournament_id` with polymorphic
// `source_type` + `source_id` fields (see docs/ARCHITECTURE_VISION.md).
interface EligiblePayout {
  id: string
  user_id: string
  tournament_id: string
  amount_cents: number
  placement: number
  stripe_connect_account_id: string
  user_email: string
  tournament_name: string
  failure_count: number
}

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  // ─────────────────────────────────────────────────────────────
  // PAUSED: Payout architecture under review.
  //
  // The previous implementation queried `payout_requests` via
  // `get_eligible_payouts()`, which references `pr.tournament_id`
  // (column does not exist in payout_requests). This cron has
  // been failing every 5 minutes since June 11 (288+ errors/day).
  //
  // Investigation revealed two coexisting payout systems:
  //   - player_payouts + tournament_payouts + escrow_accounts
  //     (legacy, has 3 real rows, escrow-linked, tournament-specific)
  //   - payout_requests + organizer_payouts
  //     (new, empty, incomplete migration, no escrow link, multi-tenant aware)
  //
  // No real money is currently flowing through either system.
  // All historical events on the platform were test runs.
  //
  // Re-enable this cron only after:
  //   1. The unified financial spine is designed (see
  //      docs/ARCHITECTURE_VISION.md — universal primitives,
  //      polymorphic source_type, escrow + retries + holds fused)
  //   2. Construction-client escrow requirements are documented
  //      (milestone-unlock model)
  //   3. The 3 legacy player_payouts rows are migrated to the
  //      unified schema
  //
  // Manual payouts via Stripe dashboard remain available if needed
  // before the unified system ships.
  // ─────────────────────────────────────────────────────────────

  return NextResponse.json({
    success: true,
    paused: true,
    message: "Payout processing paused pending architecture review",
    timestamp: new Date().toISOString(),
  })
}