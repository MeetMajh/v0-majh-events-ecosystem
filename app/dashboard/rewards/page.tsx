import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Gift, ShoppingBag, Ticket, CreditCard } from "lucide-react"

export const metadata = { title: "Points & Rewards" }

const REWARDS_CATALOG = [
  {
    icon: CreditCard,
    title: "$5 Gift Card",
    description: "Redeem for a $5 digital gift card",
    cost: 500,
  },
  {
    icon: ShoppingBag,
    title: "10% Bar Discount",
    description: "Get 10% off your next bar/cafe purchase",
    cost: 200,
  },
  {
    icon: Ticket,
    title: "Free Tournament Entry",
    description: "One free entry to any standard tournament",
    cost: 1000,
  },
  {
    icon: Gift,
    title: "MAJH Swag Pack",
    description: "Exclusive MAJH EVENTS merchandise bundle",
    cost: 2500,
  },
]

const EARN_METHODS = [
  { label: "Tournament participation", points: "+50 per event" },
  { label: "Tournament win", points: "+200 - 500" },
  { label: "Bar/Cafe purchase", points: "+1 per $1 spent" },
  { label: "Event booking", points: "+100 per booking" },
  { label: "Refer a friend", points: "+150" },
  { label: "Birthday bonus", points: "+100" },
]

export default async function RewardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("points_balance")
    .eq("id", user.id)
    .single()

  const points = profile?.points_balance ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Points & Rewards</h2>
        <p className="text-muted-foreground">Earn and redeem points across the MAJH ecosystem</p>
      </div>

      {/* Balance */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Current Balance</p>
            <p className="mt-1 text-5xl font-bold text-primary">{points.toLocaleString()}</p>
            <p className="mt-1 text-sm text-muted-foreground">MAJH Points</p>
          </div>
          <Gift className="h-12 w-12 text-primary/40" />
        </div>
      </div>

      {/* Rewards Catalog */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Rewards Catalog</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {REWARDS_CATALOG.map((reward) => (
            <div key={reward.title} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <reward.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">{reward.title}</h4>
                <p className="text-xs text-muted-foreground">{reward.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">{reward.cost.toLocaleString()} pts</span>
                  <button
                    disabled={points < reward.cost}
                    className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-30"
                  >
                    {points >= reward.cost ? "Redeem" : "Not enough points"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How to Earn */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">How to Earn Points</h3>
        <div className="rounded-xl border border-border bg-card">
          {EARN_METHODS.map((method, i) => (
            <div
              key={method.label}
              className={`flex items-center justify-between px-5 py-3 ${
                i < EARN_METHODS.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="text-sm text-foreground">{method.label}</span>
              <span className="text-sm font-medium text-primary">{method.points}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Redemption History Placeholder */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Redemption History</h3>
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {"No redemptions yet. Earn points and redeem them for real rewards!"}
          </p>
        </div>
      </div>
    </div>
  )
}
