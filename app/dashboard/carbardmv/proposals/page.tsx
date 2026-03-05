import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatCents, formatDate } from "@/lib/format"
import { updateProposalStatus } from "@/lib/carbardmv-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ExternalLink, FileText } from "lucide-react"
import { NewProposalForm } from "@/components/carbardmv/new-proposal-form"

export const metadata = { title: "Proposals | CARBARDMV" }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-400",
  viewed: "bg-cyan-500/10 text-cyan-400",
  accepted: "bg-green-500/10 text-green-400",
  declined: "bg-destructive/10 text-destructive",
  expired: "bg-yellow-500/10 text-yellow-400",
}

const STATUS_ACTIONS: Record<string, Array<{ status: string; label: string; variant?: "default" | "destructive" | "outline" }>> = {
  draft: [
    { status: "sent", label: "Mark Sent" },
  ],
  sent: [
    { status: "accepted", label: "Mark Accepted" },
    { status: "declined", label: "Mark Declined", variant: "destructive" },
  ],
  viewed: [
    { status: "accepted", label: "Mark Accepted" },
    { status: "declined", label: "Mark Declined", variant: "destructive" },
  ],
}

export default async function ProposalsPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const [{ data: proposals }, { data: clients }] = await Promise.all([
    supabase
      .from("cb_proposals")
      .select("*, cb_clients(contact_name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("cb_clients").select("id, contact_name, email").order("contact_name"),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Proposals</h1>
          <p className="text-sm text-muted-foreground">Create and manage event proposals</p>
        </div>
        <NewProposalForm clients={clients ?? []} />
      </div>

      <div className="space-y-3">
        {proposals?.map((p: Record<string, any>) => {
          const actions = STATUS_ACTIONS[p.status] ?? []
          return (
            <div key={p.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-primary">{p.proposal_number}</span>
                    <Badge variant="outline" className={STATUS_COLORS[p.status]}>
                      {p.status}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-foreground">{p.title}</h3>
                  {p.cb_clients && (
                    <p className="text-xs text-muted-foreground">Client: {(p.cb_clients as any).contact_name}</p>
                  )}
                  {p.valid_until && (
                    <p className="text-xs text-muted-foreground">Valid until: {formatDate(p.valid_until)}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{formatCents(p.total_cents)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(p.created_at)}</p>
                  <Link
                    href={`/share/proposal/${p.id}`}
                    target="_blank"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Share Link
                  </Link>
                </div>
              </div>

              {actions.length > 0 && (
                <div className="mt-4 flex gap-2 border-t border-border pt-4">
                  {actions.map((action) => (
                    <form key={action.status} action={async () => {
                      "use server"
                      await updateProposalStatus(p.id, action.status)
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

        {(!proposals || proposals.length === 0) && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No proposals yet. Create your first proposal above.</p>
          </div>
        )}
      </div>
    </div>
  )
}
