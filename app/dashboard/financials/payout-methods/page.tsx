import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PayoutMethodsList } from "@/components/financials/payout-methods-list"
import { AddPayoutMethodForm } from "@/components/financials/add-payout-method-form"

export const metadata = { title: "Payout Methods | Dashboard" }

export default async function PayoutMethodsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")

  // Get payout methods
  const { data: payoutMethods } = await supabase
    .from("payout_methods")
    .select("*")
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })

  // Get profile for preferred method
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_payout_method, kyc_verified")
    .eq("id", user.id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payout Methods</h1>
        <p className="text-muted-foreground">Manage how you receive your tournament winnings</p>
      </div>

      {/* Add New Method */}
      <AddPayoutMethodForm />

      {/* Existing Methods */}
      <PayoutMethodsList 
        payoutMethods={payoutMethods ?? []} 
        preferredMethod={profile?.preferred_payout_method}
      />
    </div>
  )
}
