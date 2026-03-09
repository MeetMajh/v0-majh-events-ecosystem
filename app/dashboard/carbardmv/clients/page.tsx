import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Mail, Phone, Building2, MapPin, ChevronRight } from "lucide-react"
import { NewClientForm } from "@/components/carbardmv/new-client-form"
import Link from "next/link"

export const metadata = { title: "Clients CRM | CARBARDMV" }

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-blue-500/10 text-blue-400",
  active: "bg-green-500/10 text-green-400",
  inactive: "bg-muted text-muted-foreground",
  vip: "bg-primary/10 text-primary",
}

export default async function ClientsCRMPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from("cb_clients")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients (CRM)</h1>
          <p className="text-sm text-muted-foreground">Manage your client relationships</p>
        </div>
        <NewClientForm />
      </div>

      <div className="space-y-3">
        {clients?.map((client: Record<string, any>) => (
          <Link 
            key={client.id} 
            href={`/dashboard/carbardmv/clients/${client.id}`}
            className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-card/80"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-foreground">{client.contact_name}</h3>
                  <Badge variant="outline" className={STATUS_COLORS[client.status] || STATUS_COLORS.lead}>
                    {client.status}
                  </Badge>
                  {client.source && (
                    <Badge variant="secondary" className="text-[10px]">{client.source}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {client.email}</span>
                  {client.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {client.phone}</span>}
                  {client.company_name && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {client.company_name}</span>}
                  {client.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {client.city}, {client.state}</span>}
                </div>
                {client.notes && <p className="text-xs text-muted-foreground italic line-clamp-1">{client.notes}</p>}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{formatDate(client.created_at)}</p>
                  <p className="text-xs font-medium text-foreground">{client.total_revenue_cents > 0 ? `$${(client.total_revenue_cents / 100).toLocaleString()}` : "$0"}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </Link>
        ))}

        {(!clients || clients.length === 0) && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-muted-foreground">No clients yet. Add your first client above.</p>
          </div>
        )}
      </div>
    </div>
  )
}
