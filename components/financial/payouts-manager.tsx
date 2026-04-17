"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  ArrowUpRight, 
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  CreditCard,
  Building,
  Plus,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { format } from "date-fns"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface PayoutMethod {
  id: string
  type: string
  card_brand: string | null
  card_last4: string | null
  is_default: boolean
}

interface Withdrawal {
  id: string
  transaction_type: string
  description: string | null
  status: string
  created_at: string
  ledger_entries: {
    amount_cents: number
    direction: string
    ledger_accounts: {
      account_type: string
      reference_id: string | null
    }
  }[]
}

interface PayoutsManagerProps {
  availableBalanceCents: number
  withdrawals: Withdrawal[]
  payoutMethods: PayoutMethod[]
  userId: string
  tenantId: string
}

export function PayoutsManager({
  availableBalanceCents,
  withdrawals,
  payoutMethods,
  userId,
  tenantId,
}: PayoutsManagerProps) {
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [selectedMethod, setSelectedMethod] = useState<string | null>(
    payoutMethods.find(m => m.is_default)?.id || payoutMethods[0]?.id || null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minWithdrawal = 1000 // $10 minimum
  const maxWithdrawal = availableBalanceCents

  const handleWithdraw = async () => {
    const cents = Math.round(parseFloat(amount) * 100)
    
    if (isNaN(cents) || cents < minWithdrawal) {
      setError("Minimum withdrawal is $10.00")
      return
    }
    if (cents > maxWithdrawal) {
      setError("Insufficient balance")
      return
    }
    if (!selectedMethod) {
      setError("Please select a payout method")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/v1/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: cents,
          payout_method_id: selectedMethod,
          tenant_id: tenantId,
        }),
      })

      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to request payout")
      }

      setWithdrawOpen(false)
      setAmount("")
      // Refresh page to show updated data
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request payout")
    } finally {
      setLoading(false)
    }
  }

  const getWithdrawalAmount = (withdrawal: Withdrawal): number => {
    const entry = withdrawal.ledger_entries?.find(
      e => e.ledger_accounts?.account_type === "user_wallet"
    )
    return entry?.amount_cents || 0
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "posted":
        return <Clock className="h-4 w-4 text-amber-500" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "posted":
        return <Badge variant="secondary">Processing</Badge>
      case "completed":
        return <Badge className="bg-emerald-500">Completed</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payouts</h2>
          <p className="text-muted-foreground">Request withdrawals from your wallet</p>
        </div>
        <Button onClick={() => setWithdrawOpen(true)} disabled={availableBalanceCents < minWithdrawal}>
          <ArrowUpRight className="mr-2 h-4 w-4" />
          Request Payout
        </Button>
      </div>

      {/* Balance Card */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-2">
            <CardDescription>Available for Withdrawal</CardDescription>
            <CardTitle className="text-3xl text-primary">
              ${(availableBalanceCents / 100).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Minimum withdrawal: $10.00
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Payout Methods</CardDescription>
            <CardTitle className="text-lg">{payoutMethods.length} Connected</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Method
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Processing Time</CardDescription>
            <CardTitle className="text-lg">1-3 Business Days</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Standard bank transfer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payout Methods</CardTitle>
          <CardDescription>Where your funds will be sent</CardDescription>
        </CardHeader>
        <CardContent>
          {payoutMethods.length > 0 ? (
            <div className="space-y-3">
              {payoutMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    {method.type === "card" ? (
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                    ) : (
                      <Building className="h-8 w-8 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">
                        {method.card_brand ? `${method.card_brand} ` : "Bank Account "}
                        {method.card_last4 && `****${method.card_last4}`}
                      </p>
                      <p className="text-sm text-muted-foreground capitalize">{method.type}</p>
                    </div>
                  </div>
                  {method.is_default && (
                    <Badge variant="secondary">Default</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <CreditCard className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="mb-2 font-medium">No payout methods</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add a bank account or card to receive payouts
              </p>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Payout Method
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Withdrawal History</CardTitle>
          <CardDescription>Your recent payout requests</CardDescription>
        </CardHeader>
        <CardContent>
          {withdrawals.length > 0 ? (
            <div className="space-y-3">
              {withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(withdrawal.status)}
                    <div>
                      <p className="font-medium">
                        ${(getWithdrawalAmount(withdrawal) / 100).toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(withdrawal.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(withdrawal.status)}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="mb-2 font-medium">No withdrawals yet</p>
              <p className="text-sm text-muted-foreground">
                Your withdrawal history will appear here
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Withdraw funds from your wallet to your bank account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="10"
                  step="0.01"
                  max={maxWithdrawal / 100}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Available: ${(availableBalanceCents / 100).toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Payout Method</Label>
              <Select value={selectedMethod || ""} onValueChange={setSelectedMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payout method" />
                </SelectTrigger>
                <SelectContent>
                  {payoutMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.card_brand || "Bank"} ****{method.card_last4}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Processing Time</p>
              <p className="text-muted-foreground">
                Payouts typically arrive within 1-3 business days
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleWithdraw} 
              disabled={!amount || parseFloat(amount) < 10 || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Withdraw $${amount || "0.00"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
