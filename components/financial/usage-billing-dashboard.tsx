"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Activity, 
  Calendar,
  CreditCard,
  Download,
  ExternalLink,
  Sparkles,
  Users,
  Zap,
  HardDrive,
  ArrowUpRight,
  CheckCircle,
} from "lucide-react"
import { format } from "date-fns"

interface Tenant {
  id: string
  name: string
  subscription_tier: string | null
  max_api_calls: number | null
  max_events: number | null
  max_users: number | null
}

interface Subscription {
  id: string
  status: string
  current_period_start: string
  current_period_end: string
  stripe_subscription_id: string | null
}

interface Plan {
  id: string
  name: string
  slug: string
  price_monthly_cents: number
  price_yearly_cents: number
  max_api_calls: number
  max_events: number
  max_users: number
  features: string[]
}

interface Usage {
  api_calls: number
  events: number
  users: number
  storage_bytes: number
}

interface Invoice {
  id: string
  amount_cents: number
  status: string
  stripe_invoice_id: string | null
  created_at: string
  paid_at: string | null
}

interface UsageBillingDashboardProps {
  tenant: Tenant | null
  subscription: Subscription | null
  plan: Plan | null
  usage: Usage
  invoices: Invoice[]
}

const PLANS = [
  {
    name: "Free",
    slug: "free",
    price: 0,
    features: ["1,000 API calls/month", "5 events", "2 team members", "Community support"],
  },
  {
    name: "Starter",
    slug: "starter",
    price: 29,
    features: ["10,000 API calls/month", "50 events", "5 team members", "Email support", "API access"],
  },
  {
    name: "Pro",
    slug: "pro",
    price: 99,
    popular: true,
    features: ["100,000 API calls/month", "Unlimited events", "20 team members", "Priority support", "Advanced analytics", "Custom webhooks"],
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    price: null,
    features: ["Unlimited API calls", "Unlimited events", "Unlimited team members", "24/7 support", "SLA guarantee", "Custom integrations", "Dedicated account manager"],
  },
]

export function UsageBillingDashboard({
  tenant,
  subscription,
  plan,
  usage,
  invoices,
}: UsageBillingDashboardProps) {
  const currentTier = tenant?.subscription_tier || "free"
  const currentPlan = plan || PLANS.find(p => p.slug === currentTier) || PLANS[0]

  const maxApiCalls = tenant?.max_api_calls || currentPlan.max_api_calls || 1000
  const maxEvents = tenant?.max_events || currentPlan.max_events || 5
  const maxUsers = tenant?.max_users || currentPlan.max_users || 2

  const apiUsagePercent = Math.min((usage.api_calls / maxApiCalls) * 100, 100)
  const eventsUsagePercent = Math.min((usage.events / maxEvents) * 100, 100)
  const usersUsagePercent = Math.min((usage.users / maxUsers) * 100, 100)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-500">Paid</Badge>
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Usage & Billing</h2>
        <p className="text-muted-foreground">Monitor your plan usage and manage billing</p>
      </div>

      {/* Current Plan */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>Current Plan</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                {currentPlan.name}
                {currentTier === "pro" && (
                  <Badge className="bg-primary">Popular</Badge>
                )}
              </CardTitle>
            </div>
            <Button variant="outline">
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Price</p>
              <p className="text-xl font-semibold">
                {currentPlan.price === 0 ? "Free" : currentPlan.price ? `$${currentPlan.price}/mo` : "Custom"}
              </p>
            </div>
            {subscription && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Billing Period</p>
                  <p className="text-sm font-medium">
                    {format(new Date(subscription.current_period_start), "MMM d")} - {format(new Date(subscription.current_period_end), "MMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className="bg-emerald-500">{subscription.status}</Badge>
                </div>
              </>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Renewal</p>
              <p className="text-sm font-medium">
                {subscription 
                  ? format(new Date(subscription.current_period_end), "MMM d, yyyy")
                  : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>API Calls</CardDescription>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold">
                {usage.api_calls.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground"> / {maxApiCalls.toLocaleString()}</span>
              </p>
              <Progress value={apiUsagePercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {(100 - apiUsagePercent).toFixed(0)}% remaining
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Events</CardDescription>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold">
                {usage.events}
                <span className="text-sm font-normal text-muted-foreground"> / {maxEvents === -1 ? "Unlimited" : maxEvents}</span>
              </p>
              <Progress value={maxEvents === -1 ? 0 : eventsUsagePercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {maxEvents === -1 ? "Unlimited" : `${maxEvents - usage.events} remaining`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Team Members</CardDescription>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold">
                {usage.users}
                <span className="text-sm font-normal text-muted-foreground"> / {maxUsers === -1 ? "Unlimited" : maxUsers}</span>
              </p>
              <Progress value={maxUsers === -1 ? 0 : usersUsagePercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {maxUsers === -1 ? "Unlimited" : `${maxUsers - usage.users} remaining`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Storage</CardDescription>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold">{formatBytes(usage.storage_bytes)}</p>
              <Progress value={0} className="h-2" />
              <p className="text-xs text-muted-foreground">Included in plan</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Plans</CardTitle>
          <CardDescription>Compare plans and upgrade when ready</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div
                key={p.slug}
                className={`rounded-lg border p-4 ${
                  p.slug === currentTier 
                    ? "border-primary bg-primary/5" 
                    : p.popular 
                    ? "border-primary/50" 
                    : ""
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.popular && <Badge variant="secondary">Popular</Badge>}
                </div>
                <p className="text-2xl font-bold mb-4">
                  {p.price === 0 ? "Free" : p.price ? `$${p.price}` : "Custom"}
                  {p.price !== null && p.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                </p>
                <ul className="space-y-2 text-sm">
                  {p.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={p.slug === currentTier ? "outline" : "default"}
                  className="w-full mt-4"
                  disabled={p.slug === currentTier}
                >
                  {p.slug === currentTier ? "Current Plan" : p.price === null ? "Contact Sales" : "Upgrade"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Invoices</CardTitle>
              <CardDescription>Your billing history</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Payment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">${(invoice.amount_cents / 100).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(invoice.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(invoice.status)}
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <Activity className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="mb-2 font-medium">No invoices yet</p>
              <p className="text-sm text-muted-foreground">
                Your billing history will appear here
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
