import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatCents, formatDate } from "@/lib/format"
import { updateInvoiceStatus } from "@/lib/carbardmv-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ExternalLink, Receipt, Download } from "lucide-react"
import { NewInvoiceForm } from "@/components/carbardmv/new-invoice-form"

export const metadata = { title: "Invoices | CARBARDMV" }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-400",
  viewed: "bg-cyan-500/10 text-cyan-400",
  partial: "bg-yellow-500/10 text-yellow-400",
  paid: "bg-green-500/10 text-green-400",
  overdue: "bg-destructive/10 text-destructive",
  void: "bg-muted text-muted-foreground",
}

const STATUS_ACTIONS: Record<string, Array<{ status: string; label: string; variant?: "default" | "destructive" | "outline" }>> = {
  draft: [{ status: "sent", label: "Mark Sent" }],
  sent: [
    { status: "paid", label: "Mark Paid" },
    { status: "void", label: "Void", variant: "destructive" },
  ],
  partial: [{ status: "paid", label: "Mark Fully Paid" }],
}

export default async function InvoicesPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const [{ data: invoices }, { data: clients }] = await Promise.all([
    supabase
      .from("cb_invoices")
      .select("*, cb_clients(contact_name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("cb_clients").select("id, contact_name, email").order("contact_name"),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">Create and manage invoices</p>
        </div>
        <NewInvoiceForm clients={clients ?? []} />
      </div>

      <div className="space-y-3">
        {invoices?.map((inv: Record<string, any>) => {
          const actions = STATUS_ACTIONS[inv.status] ?? []
          const paidPct = inv.total_cents > 0 ? Math.round((inv.amount_paid_cents / inv.total_cents) * 100) : 0
          return (
            <div key={inv.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-primary">{inv.invoice_number}</span>
                    <Badge variant="outline" className={STATUS_COLORS[inv.status]}>
                      {inv.status}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-foreground">{inv.title}</h3>
                  {inv.cb_clients && (
                    <p className="text-xs text-muted-foreground">Client: {(inv.cb_clients as any).contact_name}</p>
                  )}
                  {inv.due_date && (
                    <p className="text-xs text-muted-foreground">Due: {formatDate(inv.due_date)}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{formatCents(inv.total_cents)}</p>
                  <p className="text-xs text-muted-foreground">
                    Paid: {formatCents(inv.amount_paid_cents)} ({paidPct}%)
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(inv.created_at)}</p>
                  <div className="mt-1 flex items-center justify-end gap-3">
                    <Link
                      href={`/invoice/${inv.share_token}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> View
                    </Link>
                    <Link
                      href={`/api/invoices/${inv.id}/pdf`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-3 w-3" /> PDF
                    </Link>
                  </div>
                </div>
              </div>

              {/* Payment Progress */}
              {inv.total_cents > 0 && inv.status !== "draft" && (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, paidPct)}%` }}
                    />
                  </div>
                </div>
              )}

              {actions.length > 0 && (
                <div className="mt-4 flex gap-2 border-t border-border pt-4">
                  {actions.map((action) => (
                    <form key={action.status} action={async () => {
                      "use server"
                      await updateInvoiceStatus(inv.id, action.status)
                    }}>
                      <Button size="sm" variant={action.variant || "default"} type="submit">
                        {action.label}
                      </Button>
                    </form>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {(!invoices || invoices.length === 0) && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <Receipt className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No invoices yet. Create your first invoice above.</p>
          </div>
        )}
      </div>
    </div>
  )
}
