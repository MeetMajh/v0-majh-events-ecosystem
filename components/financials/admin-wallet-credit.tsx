"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CreditCard, CheckCircle, AlertTriangle } from "lucide-react"
import { adminCreditWallet } from "@/lib/wallet-actions"

export function AdminWalletCredit() {
  const [userId, setUserId] = useState("")
  const [amountDollars, setAmountDollars] = useState("")
  const [description, setDescription] = useState("")
  const [stripeSessionId, setStripeSessionId] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success?: boolean
    error?: string
    previousBalance?: number
    newBalance?: number
    credited?: number
  } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const amountCents = Math.round(parseFloat(amountDollars) * 100)

    if (isNaN(amountCents) || amountCents <= 0) {
      setResult({ error: "Please enter a valid amount" })
      setLoading(false)
      return
    }

    const response = await adminCreditWallet(
      userId,
      amountCents,
      description || "Admin manual credit",
      stripeSessionId || undefined
    )

    setResult(response)
    setLoading(false)

    if (response.success) {
      setUserId("")
      setAmountDollars("")
      setDescription("")
      setStripeSessionId("")
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Manual Wallet Credit
        </CardTitle>
        <CardDescription>
          Manually credit a user&apos;s wallet (for failed webhook recovery or adjustments)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                placeholder="UUID of the user"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="10.00"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Reason for manual credit (e.g., Failed webhook recovery for Stripe session cs_xxx)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stripeSessionId">Stripe Session ID (optional)</Label>
            <Input
              id="stripeSessionId"
              placeholder="cs_live_xxx (for deduplication)"
              value={stripeSessionId}
              onChange={(e) => setStripeSessionId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              If provided, prevents duplicate credits for the same Stripe payment
            </p>
          </div>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>
                {result.success ? (
                  <div className="space-y-1">
                    <p>Wallet credited successfully!</p>
                    <p className="text-sm">
                      Previous: {formatCurrency(result.previousBalance || 0)} → 
                      New: {formatCurrency(result.newBalance || 0)} 
                      (+{formatCurrency(result.credited || 0)})
                    </p>
                  </div>
                ) : (
                  result.error
                )}
              </AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Credit Wallet"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
