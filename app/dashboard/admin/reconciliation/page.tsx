import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { FinancialReconciliationDashboard } from "@/components/financials/financial-reconciliation-dashboard"

export const metadata = {
  title: "Financial Reconciliation | Admin",
  description: "Reconcile Stripe payments, database records, and wallet balances",
}

export default async function ReconciliationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Check admin access
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Reconciliation</h1>
        <p className="text-muted-foreground">
          Verify that Stripe payments, database records, and wallet balances are in sync
        </p>
      </div>
      
      <FinancialReconciliationDashboard />
    </div>
  )
}
