import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Gift, Gamepad2, CalendarCheck, Monitor } from "lucide-react"

export default async function DashboardOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const firstName = profile?.first_name || "there"
  const points = profile?.points_balance ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">Your MAJH EVENTS command center</p>
      </div>

      {/* Points Card */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Your Points Balance</p>
            <p className="mt-1 text-4xl font-bold text-primary">{points.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">Earn points from tournaments, purchases, and events</p>
          </div>
          <Gift className="h-10 w-10 text-primary/50" />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            icon={Gamepad2}
            title="Esports"
            description="Browse tournaments and compete"
            status="Coming Soon"
          />
          <QuickActionCard
            icon={CalendarCheck}
            title="Book an Event"
            description="Schedule a CARBARDMV experience"
            status="Coming Soon"
          />
          <QuickActionCard
            icon={Monitor}
            title="Rent Equipment"
            description="Browse available gaming gear"
            status="Coming Soon"
          />
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Recent Activity</h3>
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {"No recent activity yet. Start exploring the MAJH ecosystem to see your activity here!"}
          </p>
        </div>
      </div>
    </div>
  )
}

function QuickActionCard({
  icon: Icon,
  title,
  description,
  status,
}: {
  icon: React.ElementType
  title: string
  description: string
  status: string
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
        <span className="mt-2 inline-block rounded bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {status}
        </span>
      </div>
    </div>
  )
}
