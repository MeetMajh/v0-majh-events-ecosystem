import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { KycVerificationCard } from "@/components/settings/kyc-verification-card"
import { TaxFormCard } from "@/components/settings/tax-form-card"
import { VerificationBenefits } from "@/components/settings/verification-benefits"

export const metadata = { 
  title: "Identity Verification | Settings",
  description: "Verify your identity to unlock withdrawals and higher limits"
}

export default async function VerificationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/login")

  // Get profile with KYC status
  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      email,
      kyc_status,
      kyc_verified,
      kyc_submitted_at,
      kyc_rejection_reason,
      tax_form_status,
      country
    `)
    .eq("id", user.id)
    .single()

  // Get latest KYC session if exists
  const { data: kycSession } = await supabase
    .from("kyc_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  // Get tax form if exists
  const { data: taxForm } = await supabase
    .from("tax_forms")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  // Check if user needs tax form (US residents earning over $600)
  const { data: earnings } = await supabase
    .from("player_payouts")
    .select("gross_amount_cents")
    .eq("player_id", user.id)
    .eq("status", "completed")
    .gte("created_at", `${new Date().getFullYear()}-01-01`)

  const yearlyEarnings = earnings?.reduce((sum, e) => sum + e.gross_amount_cents, 0) ?? 0
  const needsTaxForm = (profile?.country === "US" || profile?.country === "United States") && yearlyEarnings >= 60000 // $600

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Identity Verification</h1>
        <p className="text-muted-foreground">
          Verify your identity to unlock withdrawals and access higher limits
        </p>
      </div>

      {/* Benefits Section */}
      <VerificationBenefits 
        isVerified={profile?.kyc_verified ?? false}
        kycStatus={profile?.kyc_status ?? "not_started"}
      />

      {/* Main Verification Card */}
      <KycVerificationCard 
        profile={profile}
        kycSession={kycSession}
      />

      {/* Tax Form Card (only show if needed or already submitted) */}
      {(needsTaxForm || taxForm) && (
        <TaxFormCard 
          taxForm={taxForm}
          profile={profile}
          yearlyEarnings={yearlyEarnings}
        />
      )}
    </div>
  )
}
