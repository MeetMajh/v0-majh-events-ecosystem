import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { notFound } from "next/navigation"
import { formatDate, formatRelative } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { 
  Mail, Phone, Building2, MapPin, Calendar, Gift, MessageSquare, 
  FileText, Receipt, CalendarCheck, DollarSign, User, Clock,
  Cake, Heart
} from "lucide-react"
import Link from "next/link"
import { AddInteractionForm } from "@/components/carbardmv/add-interaction-form"
import { EditClientForm } from "@/components/carbardmv/edit-client-form"

export const metadata = { title: "Client Details | CARBARDMV" }

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-blue-500/10 text-blue-400",
  active: "bg-green-500/10 text-green-400",
  inactive: "bg-muted text-muted-foreground",
  vip: "bg-primary/10 text-primary",
}

const INTERACTION_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  call: Phone,
  meeting: CalendarCheck,
  note: MessageSquare,
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(["owner", "manager", "staff"])
  const { id } = await params
  const supabase = await createClient()

  // Fetch client with all related data
  const { data: client, error } = await supabase
    .from("cb_clients")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !client) notFound()

  // Fetch interactions
  const { data: interactions } = await supabase
    .from("cb_client_interactions")
    .select("*, profiles(display_name)")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(20)

  // Fetch bookings
  const { data: bookings } = await supabase
    .from("cb_bookings")
    .select("*, cb_event_packages(name)")
    .eq("contact_email", client.email)
    .order("event_date", { ascending: false })
    .limit(10)

  // Fetch proposals
  const { data: proposals } = await supabase
    .from("cb_proposals")
    .select("id, proposal_number, title, status, total_cents, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(10)

  // Fetch invoices
  const { data: invoices } = await supabase
    .from("cb_invoices")
    .select("id, invoice_number, title, status, total_cents, amount_paid_cents, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(10)

  // Fetch segments this client belongs to
  const { data: segments } = await supabase
    .from("crm_segment_members")
    .select("crm_segments(id, name)")
    .eq("client_id", id)

  // Calculate customer lifetime value
  const totalRevenue = client.total_revenue_cents || 0
  const bookingCount = bookings?.length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{client.contact_name}</h1>
            <Badge variant="outline" className={STATUS_COLORS[client.status] || STATUS_COLORS.lead}>
              {client.status}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {client.email}</span>
            {client.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {client.phone}</span>}
            {client.company_name && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {client.company_name}</span>}
          </div>
          {(client.city || client.state) && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {[client.address, client.city, client.state, client.zip].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
        <EditClientForm client={client} />
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-500/10 p-2">
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lifetime Value</p>
              <p className="text-lg font-semibold">${(totalRevenue / 100).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <CalendarCheck className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Bookings</p>
              <p className="text-lg font-semibold">{bookingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="text-lg font-semibold capitalize">{client.source || "N/A"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Client Since</p>
              <p className="text-lg font-semibold">{formatDate(client.created_at)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Activity Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Add Interaction */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Log Interaction</CardTitle>
            </CardHeader>
            <CardContent>
              <AddInteractionForm clientId={id} />
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {interactions && interactions.length > 0 ? (
                <div className="relative space-y-4 pl-6 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-border">
                  {interactions.map((interaction: any) => {
                    const Icon = INTERACTION_ICONS[interaction.type] || MessageSquare
                    return (
                      <div key={interaction.id} className="relative">
                        <div className="absolute -left-6 mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-card border border-border">
                          <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                        </div>
                        <div className="rounded-lg border border-border bg-card/50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium capitalize text-muted-foreground">{interaction.type}</span>
                            <span className="text-xs text-muted-foreground">{formatRelative(interaction.created_at)}</span>
                          </div>
                          {interaction.subject && <p className="mt-1 text-sm font-medium">{interaction.subject}</p>}
                          {interaction.body && <p className="mt-1 text-sm text-muted-foreground">{interaction.body}</p>}
                          {interaction.profiles?.display_name && (
                            <p className="mt-2 text-xs text-muted-foreground">by {interaction.profiles.display_name}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary Cards */}
        <div className="space-y-6">
          {/* Personal Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Personal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {client.birthday && (
                <div className="flex items-center gap-2">
                  <Cake className="h-4 w-4 text-muted-foreground" />
                  <span>Birthday: {formatDate(client.birthday)}</span>
                </div>
              )}
              {client.anniversary && (
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <span>Anniversary: {formatDate(client.anniversary)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>Email opt-in: {client.email_opted_in ? "Yes" : "No"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>SMS opt-in: {client.sms_opted_in ? "Yes" : "No"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>Preferred: {client.preferred_contact || "email"}</span>
              </div>
              {client.notes && (
                <>
                  <Separator />
                  <p className="text-muted-foreground italic">{client.notes}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Segments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Segments</CardTitle>
            </CardHeader>
            <CardContent>
              {segments && segments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {segments.map((s: any) => (
                    <Badge key={s.crm_segments?.id} variant="secondary">{s.crm_segments?.name}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not in any segments</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Bookings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarCheck className="h-4 w-4" /> Recent Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bookings && bookings.length > 0 ? (
                <div className="space-y-2">
                  {bookings.slice(0, 5).map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                      <div>
                        <p className="font-medium">{b.cb_event_packages?.name || "Event"}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(b.event_date)}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{b.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No bookings yet</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Proposals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> Proposals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {proposals && proposals.length > 0 ? (
                <div className="space-y-2">
                  {proposals.slice(0, 3).map((p: any) => (
                    <Link key={p.id} href={`/dashboard/carbardmv/proposals`} className="block rounded-lg border border-border p-2 text-sm hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{p.proposal_number}</span>
                        <Badge variant="outline" className="text-xs">{p.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">${(p.total_cents / 100).toFixed(0)}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No proposals yet</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4" /> Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoices && invoices.length > 0 ? (
                <div className="space-y-2">
                  {invoices.slice(0, 3).map((inv: any) => (
                    <Link key={inv.id} href={`/dashboard/carbardmv/invoices`} className="block rounded-lg border border-border p-2 text-sm hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{inv.invoice_number}</span>
                        <Badge variant="outline" className="text-xs">{inv.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ${(inv.amount_paid_cents / 100).toFixed(0)} / ${(inv.total_cents / 100).toFixed(0)}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No invoices yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
