import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getUserRole } from "@/lib/roles"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  DollarSign,
  Calendar,
  TrendingUp,
  Users,
  Package,
  Utensils,
  Monitor,
} from "lucide-react"

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  const role = await getUserRole(user.id)
  if (role !== "admin" && role !== "staff") redirect("/dashboard")

  // Fetch all data for reports
  const [bookingsRes, cateringRes, rentalsRes, clientsRes, proposalsRes, invoicesRes] = await Promise.all([
    supabase.from("cb_bookings").select("*"),
    supabase.from("cb_catering_orders").select("*"),
    supabase.from("cb_rental_bookings").select("*"),
    supabase.from("cb_clients").select("*"),
    supabase.from("cb_proposals").select("*"),
    supabase.from("cb_invoices").select("*"),
  ])

  const bookings = bookingsRes.data || []
  const catering = cateringRes.data || []
  const rentals = rentalsRes.data || []
  const clients = clientsRes.data || []
  const proposals = proposalsRes.data || []
  const invoices = invoicesRes.data || []

  // Calculate metrics
  const totalBookingRevenue = bookings
    .filter((b) => b.status === "completed" || b.deposit_paid)
    .reduce((sum, b) => sum + b.total_cents, 0)

  const totalCateringRevenue = catering
    .filter((c) => c.status === "completed" || c.status === "delivered")
    .reduce((sum, c) => sum + c.total_cents, 0)

  const totalRentalRevenue = rentals
    .filter((r) => r.status === "returned" || r.deposit_paid)
    .reduce((sum, r) => sum + r.total_cents, 0)

  const totalRevenue = totalBookingRevenue + totalCateringRevenue + totalRentalRevenue

  const confirmedBookings = bookings.filter((b) =>
    ["confirmed", "deposit_paid", "in_progress", "completed"].includes(b.status)
  ).length

  const pendingInquiries = bookings.filter((b) => b.status === "inquiry").length +
    catering.filter((c) => c.status === "inquiry").length

  const activeClients = clients.filter((c) => c.status === "active" || c.status === "vip").length

  const acceptedProposals = proposals.filter((p) => p.status === "accepted").length
  const conversionRate = proposals.length > 0
    ? Math.round((acceptedProposals / proposals.length) * 100)
    : 0

  const paidInvoices = invoices.filter((i) => i.status === "paid").length
  const outstandingAmount = invoices
    .filter((i) => i.status !== "paid" && i.status !== "void")
    .reduce((sum, i) => sum + (i.total_cents - i.amount_paid_cents), 0)

  // Category breakdown
  const bookingsByCategory = bookings.reduce((acc, b) => {
    const pkg = b.package_id ? "package" : "custom"
    acc[pkg] = (acc[pkg] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const bookingsByStatus = bookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        title="CARBARDMV Reports"
        description="Business analytics and performance metrics"
      />

      {/* Revenue Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalRevenue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Events + Catering + Rentals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{confirmedBookings}</div>
            <p className="text-xs text-muted-foreground">{pendingInquiries} pending inquiries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeClients}</div>
            <p className="text-xs text-muted-foreground">{clients.length} total in CRM</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">{acceptedProposals} / {proposals.length} proposals</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Service */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Events Revenue</CardTitle>
              <CardDescription>{bookings.length} total bookings</CardDescription>
            </div>
            <Calendar className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${(totalBookingRevenue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Catering Revenue</CardTitle>
              <CardDescription>{catering.length} total orders</CardDescription>
            </div>
            <Utensils className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${(totalCateringRevenue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Rentals Revenue</CardTitle>
              <CardDescription>{rentals.length} total bookings</CardDescription>
            </div>
            <Monitor className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${(totalRentalRevenue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings Status & Invoices */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event Bookings by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(bookingsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      status === "completed" ? "default" :
                      status === "confirmed" || status === "deposit_paid" ? "secondary" :
                      status === "cancelled" ? "destructive" : "outline"
                    }>
                      {status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
              {Object.keys(bookingsByStatus).length === 0 && (
                <p className="text-muted-foreground">No bookings yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Invoices</span>
                <span className="font-semibold">{invoices.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-semibold text-green-600">{paidInvoices}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Outstanding Amount</span>
                <span className="font-semibold text-amber-600">
                  ${(outstandingAmount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{proposals.length}</p>
                <p className="text-sm text-muted-foreground">Total Proposals</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-500/10 p-3">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{paidInvoices}</p>
                <p className="text-sm text-muted-foreground">Paid Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-amber-500/10 p-3">
                <Users className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {clients.filter((c) => c.status === "vip").length}
                </p>
                <p className="text-sm text-muted-foreground">VIP Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-500/10 p-3">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${bookings.length > 0
                    ? Math.round(totalBookingRevenue / bookings.length / 100).toLocaleString()
                    : 0}
                </p>
                <p className="text-sm text-muted-foreground">Avg Booking Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
