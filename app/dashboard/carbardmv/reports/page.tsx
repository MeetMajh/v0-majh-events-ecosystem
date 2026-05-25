import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getUserRole } from "@/lib/roles"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart3,
  DollarSign,
  Calendar,
  TrendingUp,
  Users,
  Package,
  Utensils,
  Monitor,
  Clock,
  Trophy,
} from "lucide-react"
import { RevenueChart } from "@/components/carbardmv/reports/revenue-chart"
import { BookingsChart } from "@/components/carbardmv/reports/bookings-chart"
import { TopClientsTable } from "@/components/carbardmv/reports/top-clients-table"

export const metadata = { title: "Reports & Analytics | CARBARDMV" }

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  const role = await getUserRole(user.id)
  if (role !== "admin" && role !== "staff" && role !== "owner" && role !== "manager") {
    redirect("/dashboard")
  }

  // Fetch all data for reports
  const [bookingsRes, cateringRes, rentalsRes, clientsRes, proposalsRes, invoicesRes, staffRes] = await Promise.all([
    supabase.from("cb_bookings").select("*"),
    supabase.from("cb_catering_orders").select("*"),
    supabase.from("cb_rental_bookings").select("*"),
    supabase.from("cb_clients").select("*").order("total_revenue_cents", { ascending: false }),
    supabase.from("cb_proposals").select("*"),
    supabase.from("cb_invoices").select("*"),
    supabase.from("cb_staff_shifts").select("*, profiles(display_name)"),
  ])

  const bookings = bookingsRes.data || []
  const catering = cateringRes.data || []
  const rentals = rentalsRes.data || []
  const clients = clientsRes.data || []
  const proposals = proposalsRes.data || []
  const invoices = invoicesRes.data || []
  const staffShifts = staffRes.data || []

  // Calculate metrics
  const totalBookingRevenue = bookings
    .filter((b) => b.status === "completed" || b.deposit_paid)
    .reduce((sum, b) => sum + (b.total_cents || 0), 0)

  const totalCateringRevenue = catering
    .filter((c) => c.status === "completed" || c.status === "delivered")
    .reduce((sum, c) => sum + (c.total_cents || 0), 0)

  const totalRentalRevenue = rentals
    .filter((r) => r.status === "returned" || r.deposit_paid)
    .reduce((sum, r) => sum + (r.total_cents || 0), 0)

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
    .reduce((sum, i) => sum + ((i.total_cents || 0) - (i.amount_paid_cents || 0)), 0)

  // Monthly revenue data for charts (last 6 months)
  const monthlyData = generateMonthlyData(bookings, catering, rentals)

  // Bookings by status for pie chart
  const bookingsByStatus = bookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Customer LTV stats
  const avgLtv = clients.length > 0
    ? Math.round(clients.reduce((sum, c) => sum + (c.total_revenue_cents || 0), 0) / clients.length)
    : 0
  const topClientLtv = clients[0]?.total_revenue_cents || 0

  // Staff performance
  const staffStats = calculateStaffStats(staffShifts)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-sm text-muted-foreground">Business performance metrics and insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalRevenue / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}
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

      {/* Tabs for different report sections */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="clients">Clients & LTV</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue Trend (6 Months)</CardTitle>
                <CardDescription>Monthly breakdown by service type</CardDescription>
              </CardHeader>
              <CardContent>
                <RevenueChart data={monthlyData} />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Events</CardTitle>
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(totalBookingRevenue / 100).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">{bookings.length} bookings</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Catering</CardTitle>
                    <Utensils className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(totalCateringRevenue / 100).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">{catering.length} orders</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Rentals</CardTitle>
                    <Monitor className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(totalRentalRevenue / 100).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">{rentals.length} rentals</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Invoice Summary */}
          <div className="grid gap-4 md:grid-cols-2">
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
                      ${(outstandingAmount / 100).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Averages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Avg Booking Value</span>
                    <span className="font-semibold">
                      ${bookings.length > 0 ? Math.round(totalBookingRevenue / bookings.length / 100).toLocaleString() : 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Avg Client LTV</span>
                    <span className="font-semibold">${(avgLtv / 100).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Avg Invoice Value</span>
                    <span className="font-semibold">
                      ${invoices.length > 0 ? Math.round(invoices.reduce((s, i) => s + (i.total_cents || 0), 0) / invoices.length / 100).toLocaleString() : 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Bookings by Status</CardTitle>
                <CardDescription>Current status distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <BookingsChart data={bookingsByStatus} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Breakdown</CardTitle>
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
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${(count / bookings.length) * 100}%` }}
                          />
                        </div>
                        <span className="font-semibold w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(bookingsByStatus).length === 0 && (
                    <p className="text-muted-foreground">No bookings yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Clients & LTV Tab */}
        <TabsContent value="clients" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Clients</p>
                  <p className="text-lg font-semibold">{clients.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">VIP Clients</p>
                  <p className="text-lg font-semibold">{clients.filter(c => c.status === "vip").length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg LTV</p>
                  <p className="text-lg font-semibold">${(avgLtv / 100).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Top Client LTV</p>
                  <p className="text-lg font-semibold">${(topClientLtv / 100).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Clients by Lifetime Value</CardTitle>
              <CardDescription>Your most valuable customers</CardDescription>
            </CardHeader>
            <CardContent>
              <TopClientsTable clients={clients.slice(0, 10)} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Shifts</p>
                  <p className="text-lg font-semibold">{staffShifts.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <Clock className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Completed Shifts</p>
                  <p className="text-lg font-semibold">{staffShifts.filter(s => s.status === "completed").length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Staff</p>
                  <p className="text-lg font-semibold">{new Set(staffShifts.map(s => s.staff_id)).size}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <Calendar className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Upcoming Shifts</p>
                  <p className="text-lg font-semibold">{staffShifts.filter(s => s.status === "scheduled").length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {staffStats.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Staff Performance</CardTitle>
                <CardDescription>Shifts completed by staff member</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {staffStats.map((staff, idx) => (
                    <div key={staff.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-medium">{staff.name}</p>
                          <p className="text-xs text-muted-foreground">{staff.completed} shifts completed</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${staff.completionRate}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-12 text-right">{staff.completionRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-4 text-center text-muted-foreground">
                  No staff shift data yet.<br />
                  Schedule shifts to see performance metrics.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Helper: Generate monthly data for charts
function generateMonthlyData(bookings: any[], catering: any[], rentals: any[]) {
  const months: { name: string; events: number; catering: number; rentals: number }[] = []
  const now = new Date()
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthName = date.toLocaleDateString("en-US", { month: "short" })
    const year = date.getFullYear()
    const month = date.getMonth()

    const eventsRevenue = bookings
      .filter((b) => {
        const d = new Date(b.created_at)
        return d.getFullYear() === year && d.getMonth() === month
      })
      .reduce((sum, b) => sum + (b.total_cents || 0), 0) / 100

    const cateringRevenue = catering
      .filter((c) => {
        const d = new Date(c.created_at)
        return d.getFullYear() === year && d.getMonth() === month
      })
      .reduce((sum, c) => sum + (c.total_cents || 0), 0) / 100

    const rentalsRevenue = rentals
      .filter((r) => {
        const d = new Date(r.created_at)
        return d.getFullYear() === year && d.getMonth() === month
      })
      .reduce((sum, r) => sum + (r.total_cents || 0), 0) / 100

    months.push({
      name: monthName,
      events: eventsRevenue,
      catering: cateringRevenue,
      rentals: rentalsRevenue,
    })
  }

  return months
}

// Helper: Calculate staff stats
function calculateStaffStats(shifts: any[]) {
  const staffMap = new Map<string, { name: string; total: number; completed: number }>()

  for (const shift of shifts) {
    const id = shift.staff_id
    const name = shift.profiles?.display_name || "Unknown"
    
    if (!staffMap.has(id)) {
      staffMap.set(id, { name, total: 0, completed: 0 })
    }
    
    const entry = staffMap.get(id)!
    entry.total++
    if (shift.status === "completed") {
      entry.completed++
    }
  }

  return Array.from(staffMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      total: data.total,
      completed: data.completed,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 10)
}
