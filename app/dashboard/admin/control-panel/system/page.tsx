import { createClient } from "@/lib/supabase/server"
import { SystemControlsPanel } from "@/components/control-panel/system-controls-panel"

export default async function SystemControlsPage() {
  const supabase = await createClient()

  // Fetch system controls
  const { data: controls } = await supabase
    .from("system_controls")
    .select("*")
    .order("control_type")

  // Fetch integrity status
  const { data: reconciliation } = await supabase.rpc("run_daily_reconciliation")
  const { data: riskFlags } = await supabase.rpc("check_risk_flags")

  // Fetch frozen wallets
  const { data: frozenWallets } = await supabase
    .from("wallets")
    .select(`
      user_id,
      balance_cents,
      is_frozen,
      frozen_at,
      freeze_reason
    `)
    .eq("is_frozen", true)

  // Fetch user profiles for frozen wallets
  const frozenUserIds = frozenWallets?.map(w => w.user_id) || []
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", frozenUserIds.length > 0 ? frozenUserIds : [""])

  const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

  const enrichedFrozenWallets = frozenWallets?.map(w => ({
    ...w,
    profile: profilesMap.get(w.user_id) || null
  })) || []

  return (
    <SystemControlsPanel 
      controls={controls || []}
      reconciliation={reconciliation}
      riskFlags={riskFlags}
      frozenWallets={enrichedFrozenWallets}
    />
  )
}
