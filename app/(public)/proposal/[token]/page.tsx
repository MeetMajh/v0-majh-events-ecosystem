import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { FileText, Calendar, CheckCircle, XCircle, Clock, Download } from "lucide-react"
import { AcceptProposalButton } from "@/components/carbardmv/accept-proposal-button"
import Image from "next/image"
import { IMAGES } from "@/lib/images"

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft: { label: "Draft", icon: FileText, color: "text-muted-foreground" },
  sent: { label: "Awaiting Response", icon: Clock, color: "text-amber-500" },
  viewed: { label: "Viewed", icon: Clock, color: "text-blue-500" },
  accepted: { label: "Accepted", icon: CheckCircle, color: "text-green-500" },
  declined: { label: "Declined", icon: XCircle, color: "text-destructive" },
  expired: { label: "Expired", icon: Clock, color: "text-muted-foreground" },
}

export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  // Fetch proposal by share token using service role would be ideal,
  // but for simplicity we'll use anon with the token lookup
  const { data: proposal } = await supabase
    .from("cb_proposals")
    .select(`
      *,
      client:cb_clients(contact_name, company_name, email),
      items:cb_proposal_items(*)
    `)
    .eq("share_token", token)
    .single()

  if (!proposal) notFound()

  const status = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.sent
  const StatusIcon = status.icon
  const isExpired = proposal.valid_until && new Date(proposal.valid_until) < new Date()
  const canAccept = ["sent", "viewed"].includes(proposal.status) && !isExpired

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Image
              src={IMAGES.logo}
              alt="CARBARDMV"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="text-xl font-bold">CARBARDMV</span>
          </div>
          <Badge variant="outline" className={status.color}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {status.label}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardHeader className="text-center">
            <p className="text-sm text-muted-foreground">PROPOSAL</p>
            <CardTitle className="text-2xl">{proposal.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              #{proposal.proposal_number}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Client & Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Prepared For</p>
                <p className="font-semibold">{proposal.client?.contact_name}</p>
                {proposal.client?.company_name && (
                  <p className="text-sm text-muted-foreground">{proposal.client.company_name}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Valid Until</p>
                <p className="font-semibold flex items-center justify-end gap-2">
                  <Calendar className="h-4 w-4" />
                  {proposal.valid_until
                    ? new Date(proposal.valid_until).toLocaleDateString()
                    : "No expiration"}
                </p>
                {isExpired && (
                  <p className="text-sm text-destructive">This proposal has expired</p>
                )}
              </div>
            </div>

            {/* Intro Text */}
            {proposal.intro_text && (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="whitespace-pre-wrap text-sm">{proposal.intro_text}</p>
              </div>
            )}

            <Separator />

            {/* Line Items */}
            <div>
              <h3 className="mb-4 font-semibold">Proposal Items</h3>
              <div className="space-y-2">
                {proposal.items
                  ?.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
                  .map((item: { id: string; description: string; quantity: number; unit_price_cents: number; line_total_cents: number }) => (
                    <div key={item.id} className="flex items-start justify-between py-2">
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} x ${(item.unit_price_cents / 100).toFixed(2)}
                        </p>
                      </div>
                      <p className="font-semibold">
                        ${(item.line_total_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${(proposal.subtotal_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              {proposal.tax_cents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({proposal.tax_rate}%)</span>
                  <span>${(proposal.tax_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${(proposal.total_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Terms */}
            {proposal.terms_text && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-2 font-semibold">Terms & Conditions</h3>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {proposal.terms_text}
                  </p>
                </div>
              </>
            )}

            {/* Actions */}
            {canAccept && (
              <>
                <Separator />
                <div className="flex flex-col items-center gap-4 pt-4">
                  <p className="text-center text-sm text-muted-foreground">
                    Ready to proceed? Accept this proposal to move forward.
                  </p>
                  <div className="flex gap-3">
                    <AcceptProposalButton proposalId={proposal.id} token={token} />
                  </div>
                </div>
              </>
            )}

            {proposal.status === "accepted" && (
              <div className="rounded-lg bg-green-500/10 p-4 text-center">
                <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
                <p className="font-semibold text-green-700">Proposal Accepted</p>
                <p className="text-sm text-muted-foreground">
                  Accepted on {proposal.accepted_at && new Date(proposal.accepted_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-col items-center gap-2">
          <a
            href={`/api/proposals/${proposal.id}/pdf`}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          <p className="text-xs text-muted-foreground">
            Questions? Contact us at events@carbardmv.com
          </p>
        </div>
      </main>
    </div>
  )
}
