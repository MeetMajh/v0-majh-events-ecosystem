/*
  PRIVILEGED RPCs MOVED TO service_role, 2026-11-19.

  Six SECURITY DEFINER functions had NO caller authorization check of any
  kind — verified by reading every body for auth.uid(), a role predicate, or
  anything equivalent:

      adjust_wallet_balance        changes ANY user's balance
      post_ledger_transaction      posts arbitrary ledger entries
      trigger_emergency_lockdown   locks the platform down
      lift_emergency_lockdown      unlocks it
      toggle_system_control        flips system controls
      run_chaos_suite              runs chaos tests against production

  Each took the acting admin's identity as a PARAMETER (`p_admin_id`) rather
  than reading it from the session, which is worth nothing as authorization
  because the caller supplies it. And each was EXECUTE-able by `authenticated`,
  so any signed-in user could call it directly over PostgREST as
  POST /rest/v1/rpc/<name>, bypassing this route entirely.

  The routes themselves were never the hole — they gate on auth.getUser()
  plus profiles.is_admin. The hole was the direct RPC path around them.

  THE FIX, in two halves that only work together:
    1. this file now performs the privileged call with createAdminClient()
       (service_role), AFTER its own admin gate above;
    2. migration 20261119_010 revokes `authenticated` EXECUTE on all six,
       which closes the direct PostgREST path.

  Deliberately NOT fixed by adding an in-function check copied from the
  neighbouring admin_* functions. Those test

      staff_roles.role IN ('owner','manager','finance')

  while staff_roles actually holds PLATFORM_OWNER and TENANT_MANAGER — so
  that comparison cannot pass for any human, and those functions raise
  'Unauthorized' for everyone except service_role. They are not secured by
  design, they are secured by an always-false comparison, and normalising the
  role vocabulary would arm all of them at once. Copying that pattern would
  be fitting a lock already known not to turn. See majh-foundry D-011.
*/
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET - Fetch chaos test history
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check admin access
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  // Get chaos mode status
  const { data: chaosControl } = await supabase
    .from("system_controls")
    .select("is_enabled")
    .eq("control_type", "chaos_mode_enabled")
    .single()

  // Get test history
  const { data: history, error } = await supabase.rpc("get_chaos_test_history", { p_limit: 20 })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    chaosModeEnabled: chaosControl?.is_enabled || false,
    history: history || []
  })
}

// POST - Run chaos test suite
export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check admin access
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  // Run chaos suite
  const { data, error } = await createAdminClient().rpc("run_chaos_suite", {
    p_admin_id: user.id
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
