import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Wallet, ArrowUpRight, ArrowDownLeft, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddFundsButton } from "@/components/wallet/add-funds-button"
import { formatDistanceToNow } from "date-fns"

export const metadata = {
  title: "Wallet | MAJH EVENTS",
  description: "Manage your wallet balance",
}

export default async function WalletPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // Get wallet - create if doesn't exist
  let { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!wallet) {
    const { data: newWallet } = await supabase
      .from("wallets")
      .insert({ user_id: user.id, balance_cents: 0 })
      .select()
      .single()
    wallet = newWallet
  }

  // Get recent transactions
  const { data: transactions } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Wallet</h2>
        <p className="text-muted-foreground">Manage your funds for tournament entry fees</p>
      </div>

      {/* Balance Card */}
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-8">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Available Balance</p>
            <p className="mt-2 text-5xl font-bold text-green-500">
              ${((wallet?.balance_cents ?? 0) / 100).toFixed(2)}
            </p>
          </div>
          <div className="mt-6 flex gap-3 sm:mt-0">
            <AddFundsButton />
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Transaction History</h3>
        {transactions && transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((tx: any) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    tx.amount_cents > 0 
                      ? "bg-green-500/10 text-green-500" 
                      : "bg-red-500/10 text-red-500"
                  }`}>
                    {tx.amount_cents > 0 ? (
                      <ArrowDownLeft className="h-5 w-5" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground capitalize">{tx.type?.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.description || tx.type}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${
                    tx.amount_cents > 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {tx.amount_cents > 0 ? "+" : ""}${(tx.amount_cents / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.created_at && formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="mb-2 font-medium text-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground">
              Add funds to your wallet to join paid tournaments
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
