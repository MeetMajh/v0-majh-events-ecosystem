"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { CreditCard, Loader2 } from "lucide-react"
import { createInvoicePaymentCheckout } from "@/lib/carbardmv-actions"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface InvoicePaymentProps {
  invoiceId: string
  amountDue: number
}

export function InvoicePayment({ invoiceId, amountDue }: InvoicePaymentProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  const handlePayNow = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await createInvoicePaymentCheckout(invoiceId)
      if (result.clientSecret) {
        setClientSecret(result.clientSecret)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start checkout")
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  if (clientSecret) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 pt-4">
      <p className="text-center text-sm text-muted-foreground">
        Pay securely online with credit card
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="lg" className="gap-2" onClick={handlePayNow} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {loading ? "Loading..." : `Pay $${(amountDue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
      </Button>
    </div>
  )
}
