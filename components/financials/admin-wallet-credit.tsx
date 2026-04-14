"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CreditCard, CheckCircle, AlertTriangle } from "lucide-react"
import { adminCreditWallet, syncWalletBalance } from "@/lib/wallet-actions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RefreshCw } from "lucide-react"

export function AdminWalletCredit() {
  const [userId, setUserId] = useState("")
  const [syncUserId, setSyncUserId] = useState("")
  const [amountDollars, setAmountDollars] = useState("")
  const [description, setDescription] = useState("")
  const [stripeSessionId, setStripeSessionId] = useState("")
  const [loading, setLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [result, setResult] = useState<{
    success?: boolean
    error?: string
    previousBalance?: number
    newBalance?: number
    credited?: number
  } | null>(null)
  const [syncResult, setSyncResult] = useState<{
    success?: boolean
    error?: string
    previousBalance?: number
    newBalance?: number
    transactionCount?: number
    adjustment?: number
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

  async function handleSync(e: React.FormEvent) {
    e.preventDefault()
    setSyncLoading(true)
    setSyncResult(null)

    if (!syncUserId.trim()) {
      setSyncResult({ error: "Please enter a valid User ID" })
      setSyncLoading(false)
      return
    }

    const response = await syncWalletBalance(syncUserId)
    setSyncResult(response)
    setSyncLoading(false)

    if (response.success) {
      setSyncUserId("")
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
          Sync wallet balance or manually credit a user&apos;s wallet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sync" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="sync" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Sync Balance
            </TabsTrigger>
            <TabsTrigger value="credit" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Manual Credit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sync">
            <form onSubmit={handleSync} className="space-y-4">
              <Alert>
                <RefreshCw className="h-4 w-4" />
                <AlertDescription>
                  <strong>Recommended for failed webhooks:</strong> This recalculates the wallet balance 
                  from existing transactions without creating a new entry. Use this when a payment was 
                  recorded but the wallet balance wasn&apos;t updated.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="syncUserId">User ID</Label>
                <Input
                  id="syncUserId"
                  placeholder="UUID of the user"
                  value={syncUserId}
                  onChange={(e) => setSyncUserId(e.target.value)}
                  required
                />
              </div>

              {syncResult && (
                <Alert variant={syncResult.success ? "default" : "destructive"}>
                  {syncResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {syncResult.success ? (
                      <div className="space-y-1">
                        <p>Wallet synced successfully!</p>
                        <p className="text-sm">
                          Previous: {formatCurrency(syncResult.previousBalance || 0)} → 
                          New: {formatCurrency(syncResult.newBalance || 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Based on {syncResult.transactionCount} transactions 
                          (adjustment: {syncResult.adjustment && syncResult.adjustment >= 0 ? "+" : ""}
                          {formatCurrency(syncResult.adjustment || 0)})
                        </p>
                      </div>
                    ) : (
                      syncResult.error
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={syncLoading} className="w-full sm:w-auto">
                {syncLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Wallet Balance
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="credit">
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This creates a new deposit transaction. Only use this 
                if the payment was NOT recorded at all. For failed webhooks where the transaction 
                exists, use &quot;Sync Balance&quot; instead.
              </AlertDescription>
            </Alert>
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
