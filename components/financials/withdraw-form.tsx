"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Wallet,
  CreditCard,
  Building2,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertTriangle,
  Loader2,
  Zap,
  Clock,
  ShieldCheck,
  ExternalLink,
  DollarSign,
  History,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface PayoutMethod {
  id: string
  method_type: string
  bank_name?: string
  bank_last_four?: string
  account_email?: string
  account_handle?: string
  is_primary: boolean
}

interface Transaction {
  id: string
  type: string
  amount_cents: number
  status: string
  description: string
  created_at: string
}

interface WithdrawFormProps {
  availableBalance: number
  payoutMethods: PayoutMethod[]
  hasStripeConnect: boolean
  kycVerified: boolean
  recentWithdrawals: Transaction[]
}

const QUICK_AMOUNTS = [25, 50, 100, 250, 500]
const MIN_WITHDRAWAL = 10
const PLATFORM_FEE_PERCENT = 0

export function WithdrawForm({
  availableBalance,
  payoutMethods,
  hasStripeConnect,
  kycVerified,
  recentWithdrawals,
}: WithdrawFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  const [step, setStep] = useState(1)
  const [amount, setAmount] = useState("")
  const [selectedMethod, setSelectedMethod] = useState<string>(
    hasStripeConnect ? "stripe_connect" : payoutMethods[0]?.id || ""
  )
  const [showConfirm, setShowConfirm] = useState(false)

  const amountCents = Math.round((parseFloat(amount) || 0) * 100)
  const feeCents = Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100))
  const netAmount = amountCents - feeCents
  const maxAmount = availableBalance / 100

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)

  const isValidAmount = amountCents >= MIN_WITHDRAWAL * 100 && amountCents <= availableBalance

  const handleQuickAmount = (dollars: number) => {
    if (dollars * 100 <= availableBalance) {
      setAmount(dollars.toString())
    }
  }

  const handleMaxAmount = () => {
    setAmount(maxAmount.toFixed(2))
  }

  const getSelectedMethodDetails = () => {
    if (selectedMethod === "stripe_connect") {
      return { name: "Direct Deposit", icon: CreditCard, time: "1-2 business days" }
    }
    const method = payoutMethods.find((m) => m.id === selectedMethod)
    if (!method) return null
    return {
      name: method.method_type === "bank" 
        ? `${method.bank_name} ****${method.bank_last_four}`
        : method.method_type,
      icon: method.method_type === "bank" ? Building2 : CreditCard,
      time: "3-5 business days",
    }
  }

  const handleWithdraw = async () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/wallet/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents,
            payoutMethodId: selectedMethod === "stripe_connect" ? null : selectedMethod,
            useStripeConnect: selectedMethod === "stripe_connect",
          }),
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.message || "Withdrawal failed")
        }

        toast.success("Withdrawal initiated successfully!")
        setShowConfirm(false)
        router.push("/dashboard/financials")
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Withdrawal failed")
      }
    })
  }

  const canProceed = () => {
    if (step === 1) return isValidAmount
    if (step === 2) return selectedMethod !== ""
    return true
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/financials">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Withdraw Funds</h1>
          <p className="text-muted-foreground">Transfer money from your wallet to your bank account</p>
        </div>
      </div>

      {/* KYC Warning */}
      {!kycVerified && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-500">Identity Verification Required</p>
              <p className="text-sm text-muted-foreground">
                Complete KYC verification to withdraw funds over $600 or to receive faster payouts.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/settings/verification">
                Verify Now
                <ExternalLink className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    step >= s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  step >= s ? "text-foreground" : "text-muted-foreground"
                )}>
                  {s === 1 ? "Amount" : s === 2 ? "Method" : "Review"}
                </span>
                {s < 3 && <div className="h-px w-8 bg-border" />}
              </div>
            ))}
          </div>

          {/* Step 1: Amount */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  Enter Amount
                </CardTitle>
                <CardDescription>
                  Available balance: <span className="font-semibold text-foreground">{formatCurrency(availableBalance)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Withdrawal Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-medium text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-8 text-2xl font-bold h-14"
                      min={MIN_WITHDRAWAL}
                      max={maxAmount}
                      step="0.01"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={handleMaxAmount}
                    >
                      Max
                    </Button>
                  </div>
                  {amountCents > 0 && amountCents < MIN_WITHDRAWAL * 100 && (
                    <p className="text-sm text-destructive">
                      Minimum withdrawal is ${MIN_WITHDRAWAL}
                    </p>
                  )}
                  {amountCents > availableBalance && (
                    <p className="text-sm text-destructive">
                      Amount exceeds available balance
                    </p>
                  )}
                </div>

                {/* Quick Amounts */}
                <div className="space-y-2">
                  <Label>Quick Select</Label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_AMOUNTS.map((dollars) => (
                      <Button
                        key={dollars}
                        variant={amount === dollars.toString() ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleQuickAmount(dollars)}
                        disabled={dollars * 100 > availableBalance}
                      >
                        ${dollars}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Payout Method */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>
                  Select Payout Method
                </CardTitle>
                <CardDescription>Choose where to receive your funds</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod} className="space-y-3">
                  {/* Stripe Connect */}
                  {hasStripeConnect && (
                    <div
                      className={cn(
                        "flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
                        selectedMethod === "stripe_connect"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <RadioGroupItem value="stripe_connect" id="stripe_connect" />
                      <Label htmlFor="stripe_connect" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                            <Zap className="h-5 w-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              Direct Deposit
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
                                Fastest
                              </Badge>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              1-2 business days to your bank account
                            </p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  )}

                  {/* Saved Payout Methods */}
                  {payoutMethods.map((method) => (
                    <div
                      key={method.id}
                      className={cn(
                        "flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
                        selectedMethod === method.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <RadioGroupItem value={method.id} id={method.id} />
                      <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium capitalize flex items-center gap-2">
                              {method.method_type === "bank"
                                ? `${method.bank_name || "Bank"} ****${method.bank_last_four}`
                                : method.method_type}
                              {method.is_primary && (
                                <Badge variant="secondary" className="text-xs">Primary</Badge>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {method.account_email || "3-5 business days"}
                            </p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}

                  {/* No Methods */}
                  {!hasStripeConnect && payoutMethods.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center">
                      <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
                      <p className="mt-2 font-medium">No payout methods</p>
                      <p className="text-sm text-muted-foreground">
                        Add a payout method to withdraw funds
                      </p>
                      <Button className="mt-4" asChild>
                        <Link href="/dashboard/financials/payout-methods">
                          Add Payout Method
                        </Link>
                      </Button>
                    </div>
                  )}
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  Review Withdrawal
                </CardTitle>
                <CardDescription>Confirm your withdrawal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Withdrawal Amount</span>
                    <span className="font-medium">{formatCurrency(amountCents)}</span>
                  </div>
                  {feeCents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processing Fee</span>
                      <span className="font-medium text-destructive">-{formatCurrency(feeCents)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-medium">You will receive</span>
                    <span className="text-xl font-bold text-emerald-500">{formatCurrency(netAmount)}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-2">Payout Method</p>
                  {(() => {
                    const details = getSelectedMethodDetails()
                    if (!details) return null
                    const Icon = details.icon
                    return (
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium capitalize">{details.name}</p>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {details.time}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-500">
                      Please verify all details before confirming. Withdrawals cannot be cancelled once processed.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            ) : (
              <div />
            )}
            
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={() => setShowConfirm(true)} 
                disabled={!canProceed()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Confirm Withdrawal
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Balance Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="text-2xl font-bold">{formatCurrency(availableBalance)}</p>
                </div>
              </div>
              {amountCents > 0 && amountCents <= availableBalance && (
                <div className="rounded-lg bg-background/50 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">After withdrawal:</span>
                    <span className="font-medium">{formatCurrency(availableBalance - amountCents)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Withdrawals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent Withdrawals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentWithdrawals.length > 0 ? (
                <div className="space-y-3">
                  {recentWithdrawals.slice(0, 3).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {tx.status === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : tx.status === "failed" ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="font-medium">{formatCurrency(tx.amount_cents)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No withdrawal history
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Withdrawal</DialogTitle>
            <DialogDescription>
              You are about to withdraw {formatCurrency(netAmount)} to your selected account.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">Amount to receive</p>
              <p className="text-3xl font-bold text-emerald-500">{formatCurrency(netAmount)}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleWithdraw} 
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Withdrawal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
