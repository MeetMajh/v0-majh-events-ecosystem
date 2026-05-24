import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ClaimPrizeForm } from "@/components/financials/claim-prize-form"

export const metadata = { title: "Claim Prize | Dashboard" }

export default async function ClaimPrizePage({
  searchParams,
}: {
  searchParams: Promise<{ tournament?: string; payout?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")

  const params = await searchParams

  // Build query for pending payouts
  let query = supabase
    .from("player_payouts")
    .select(`
      *,
      tournament:tournaments(id, name, game_id)
    `)
    .eq("user_id", user.id)
    .in("status", ["pending", "awaiting_details"])
    .order("created_at", { ascending: false })

  if (params.tournament) {
    query = query.eq("tournament_id", params.tournament)
  }

  if (params.payout) {
    query = query.eq("id", params.payout)
  }

  const { data: pendingPayouts } = await query

  // Get user's payout methods
  const { data: payoutMethods } = await supabase
    .from("payout_methods")
    .select("*")
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })

  // Get Stripe Connect status
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, stripe_connect_status, stripe_connect_payouts_enabled")
    .eq("id", user.id)
    .single()

  const hasStripeConnect = profile?.stripe_connect_payouts_enabled ?? false

  if (!pendingPayouts?.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Claim Winnings</h1>
          <p className="text-muted-foreground">No pending winnings to claim</p>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <p>You don&apos;t have any pending prize payouts.</p>
          <p className="text-sm mt-2">Check back after competing in tournaments!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Claim Winnings</h1>
        <p className="text-muted-foreground">Select how you want to receive your tournament prizes</p>
      </div>

      <ClaimPrizeForm
        payouts={pendingPayouts}
        payoutMethods={payoutMethods ?? []}
        hasStripeConnect={hasStripeConnect}
      />
    </div>
  )
}
