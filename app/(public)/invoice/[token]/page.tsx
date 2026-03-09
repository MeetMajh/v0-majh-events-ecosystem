import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { FileText, Calendar, CheckCircle, Clock, AlertCircle, CreditCard } from "lucide-react"
import Image from "next/image"
import { IMAGES } from "@/lib/images"
import Link from "next/link"

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", icon: FileText, variant: "outline" },
  sent: { label: "Awaiting Payment", icon: Clock, variant: "secondary" },
  viewed: { label: "Viewed", icon: Clock, variant: "secondary" },
  partial: { label: "Partially Paid", icon: AlertCircle, variant: "secondary" },
  paid: { label: "Paid", icon: CheckCircle, variant: "default" },
  overdue: { label: "Overdue", icon: AlertCircle, variant: "destructive" },
  void: { label: "Void", icon: FileText, variant: "outline" },
}

export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from("cb_invoices")
    .select(`
      *,
      client:cb_clients(contact_name, company_name, email, address, city, state, zip),
      items:cb_invoice_items(*)
    `)
    .eq("share_token", token)
    .single()

  if (!invoice) notFound()

  const status = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.sent
  const StatusIcon = status.icon
  const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== "paid"
  const amountDue = invoice.total_cents - invoice.amount_paid_cents
  const canPay = ["sent", "viewed", "partial", "overdue"].includes(invoice.status) && amountDue > 0

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
          <Badge variant={isOverdue ? "destructive" : status.variant}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {isOverdue ? "Overdue" : status.label}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardHeader className="text-center">
            <p className="text-sm text-muted-foreground">INVOICE</p>
            <CardTitle className="text-2xl">{invoice.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              #{invoice.invoice_number}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Client & Invoice Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bill To</p>
                <p className="font-semibold">{invoice.client?.contact_name}</p>
                {invoice.client?.company_name && (
                  <p className="text-sm">{invoice.client.company_name}</p>
                )}
                {invoice.client?.address && (
                  <p className="text-sm text-muted-foreground">
                    {invoice.client.address}<br />
                    {invoice.client.city}, {invoice.client.state} {invoice.client.zip}
                  </p>
                )}
              </div>
              <div className="sm:text-right">
                <div className="mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Invoice Date</p>
                  <p className="font-semibold">
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                  <p className={`font-semibold flex items-center gap-2 sm:justify-end ${isOverdue ? "text-destructive" : ""}`}>
                    <Calendar className="h-4 w-4" />
                    {invoice.due_date
                      ? new Date(invoice.due_date).toLocaleDateString()
                      : "Due on receipt"}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div>
              <div className="mb-2 grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Rate</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>
              <div className="space-y-2">
                {invoice.items
                  ?.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
                  .map((item: { id: string; description: string; quantity: number; unit_price_cents: number; line_total_cents: number }) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 py-2 text-sm">
                      <div className="col-span-6">{item.description}</div>
                      <div className="col-span-2 text-right">{item.quantity}</div>
                      <div className="col-span-2 text-right">${(item.unit_price_cents / 100).toFixed(2)}</div>
                      <div className="col-span-2 text-right font-medium">
                        ${(item.line_total_cents / 100).toFixed(2)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${(invoice.subtotal_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              {invoice.tax_cents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span>
                  <span>${(invoice.tax_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>${(invoice.total_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              {invoice.amount_paid_cents > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Amount Paid</span>
                  <span>-${(invoice.amount_paid_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Amount Due</span>
                <span className={isOverdue ? "text-destructive" : ""}>
                  ${(amountDue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-2 font-semibold">Notes</h3>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {invoice.notes}
                  </p>
                </div>
              </>
            )}

            {/* Payment Actions */}
            {canPay && invoice.stripe_payment_link && (
              <>
                <Separator />
                <div className="flex flex-col items-center gap-4 pt-4">
                  <p className="text-center text-sm text-muted-foreground">
                    Pay securely online with credit card
                  </p>
                  <Button asChild size="lg" className="gap-2">
                    <Link href={invoice.stripe_payment_link}>
                      <CreditCard className="h-4 w-4" />
                      Pay ${(amountDue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </Link>
                  </Button>
                </div>
              </>
            )}

            {invoice.status === "paid" && (
              <div className="rounded-lg bg-green-500/10 p-4 text-center">
                <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
                <p className="font-semibold text-green-700">Payment Received</p>
                <p className="text-sm text-muted-foreground">
                  Thank you for your payment
                  {invoice.paid_at && ` on ${new Date(invoice.paid_at).toLocaleDateString()}`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Questions about this invoice? Contact billing@carbardmv.com
        </p>
      </main>
    </div>
  )
}
