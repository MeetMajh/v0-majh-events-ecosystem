import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatCents } from "@/lib/format"
import Link from "next/link"
import {
  CalendarCheck,
  UtensilsCrossed,
  Monitor,
  UserCheck,
  FileText,
  Receipt,
  TrendingUp,
  Clock,
} from "lucide-react"
import { DatabaseSetup } from "@/components/carbardmv/database-setup"

export const metadata = { title: "CARBARDMV Overview | Dashboard" }

export default async function CarbardmvOverviewPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { count: bookingCount },
    { count: pendingBookings },
    { count: rentalCount },
    { count: cateringInquiries },
    { count: clientCount },
    { count: proposalCount },
    { count: invoiceCount },
    { data: monthBookings },
  ] = await Promise.all([
    supabase.from("cb_bookings").select("*", { count: "exact", head: true }),
    supabase.from("cb_bookings").select("*", { count: "exact", head: true }).in("status", ["inquiry", "pending"]),
    supabase.from("cb_rental_bookings").select("*", { count: "exact", head: true }),
    supabase.from("cb_catering_inquiries").select("*", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("cb_clients").select("*", { count: "exact", head: true }),
    supabase.from("cb_proposals").select("*", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("cb_invoices").select("*", { count: "exact", head: true }).in("status", ["draft", "sent"]),
    supabase.from("cb_bookings").select("total_cents, status").gte("created_at", startOfMonth),
  ])

  const monthRevenue = monthBookings
    ?.filter((b) => !["cancelled"].includes(b.status))
    .reduce((sum, b) => sum + (b.total_cents || 0), 0) ?? 0

  const stats = [
    { label: "Total Bookings", value: bookingCount ?? 0, icon: CalendarCheck, href: "/dashboard/carbardmv/events", color: "text-blue-400" },
    { label: "Pending Bookings", value: pendingBookings ?? 0, icon: Clock, href: "/dashboard/carbardmv/events", color: "text-yellow-400" },
    { label: "Rental Orders", value: rentalCount ?? 0, icon: Monitor, href: "/dashboard/carbardmv/rentals", color: "text-purple-400" },
    { label: "New Catering Inquiries", value: cateringInquiries ?? 0, icon: UtensilsCrossed, href: "/dashboard/carbardmv/catering", color: "text-orange-400" },
    { label: "CRM Clients", value: clientCount ?? 0, icon: UserCheck, href: "/dashboard/carbardmv/clients", color: "text-green-400" },
    { label: "Draft Proposals", value: proposalCount ?? 0, icon: FileText, href: "/dashboard/carbardmv/proposals", color: "text-cyan-400" },
    { label: "Unpaid Invoices", value: invoiceCount ?? 0, icon: Receipt, href: "/dashboard/carbardmv/invoices", color: "text-red-400" },
    { label: "Month Revenue", value: formatCents(monthRevenue), icon: TrendingUp, href: "/dashboard/carbardmv/reports", color: "text-primary" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">CARBARDMV Dashboard</h1>
        <p className="text-muted-foreground">Mobile events, catering, and equipment rental management</p>
      </div>

      <DatabaseSetup />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div className="rounded-lg bg-secondary p-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
