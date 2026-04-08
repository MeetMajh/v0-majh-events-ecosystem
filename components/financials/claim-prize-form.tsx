"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { selectPayoutMethod, executeStripePayout } from "@/lib/stripe-payout-service"
import { 
  Trophy, Wallet, CreditCard, Building2, Loader2, 
  CheckCircle2, Zap, ExternalLink 
} from "lucide-react"
import Link from "next/link"

interface PayoutMethod {
  id: string
  method_type: string
  bank_name?: string
  bank_last_four?: string
  account_email?: string
  account_handle?: string
  is_primary: boolean
}

interface Payout {
  id: string
  tournament_id: string
  placement: number
  gross_amount_cents: number
  platform_fee_cents: number
  net_amount_cents: number
  status: string
  tournament?: {
    id: string
    name: string
  }
}

interface ClaimPrizeFormProps {
  payouts: Payout[]
  payoutMethods: PayoutMethod[]
  hasStripeConnect: boolean
}

export function ClaimPrizeForm({ payouts, payoutMethods, hasStripeConnect }: ClaimPrizeFormProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>(
    hasStripeConnect ? "stripe_connect" : "platform_balance"
  )
  const [selectedPayoutMethodId, setSelectedPayoutMethodId] = useState<string | undefined>()
  const [loading, setLoading] = useState<string | null>(null)
  const [claimed, setClaimed] = useState<Set<string>>(new Set())

  const totalNetAmount = payouts
    .filter((p) => !claimed.has(p.id))
    .reduce((sum, p) => sum + p.net_amount_cents, 0)

  const handleClaim = async (payoutId: string) => {
    setLoading(payoutId)
    try {
      // First select the payout method
      const selectResult = await selectPayoutMethod(
        payoutId,
        selectedMethod as "platform_balance" | "stripe_connect" | "bank" | "paypal" | "venmo" | "cashapp",
        selectedPayoutMethodId
      )

      if (selectResult.error) {
        alert(selectResult.error)
        return
      }

      // Then execute the payout
      const executeResult = await executeStripePayout(payoutId)

      if (executeResult.error) {
        alert(executeResult.error)
        return
      }

      setClaimed((prev) => new Set([...prev, payoutId]))
    } catch (error) {
      console.error("Failed to claim:", error)
      alert("Failed to process claim. Please try again.")
    } finally {
      setLoading(null)
    }
  }

  const handleClaimAll = async () => {
    setLoading("all")
    for (const payout of payouts) {
      if (claimed.has(payout.id)) continue
      
      const selectResult = await selectPayoutMethod(
        payout.id,
        selectedMethod as "platform_balance" | "stripe_connect" | "bank" | "paypal" | "venmo" | "cashapp",
        selectedPayoutMethodId
      )

      if (!selectResult.error) {
        const executeResult = await executeStripePayout(payout.id)
        if (!executeResult.error) {
          setClaimed((prev) => new Set([...prev, payout.id]))
        }
      }
    }
    setLoading(null)
  }

  const getPlacementLabel = (placement: number) => {
    switch (placement) {
      case 1: return "1st Place"
      case 2: return "2nd Place"
      case 3: return "3rd Place"
      default: return `${placement}th Place`
    }
  }

  return (
    <div className="space-y-6">
      {/* Payout Method Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Payout Method</CardTitle>
          <CardDescription>Choose how you want to receive your winnings</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
            {/* Platform Balance */}
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="platform_balance" id="platform_balance" />
              <Label htmlFor="platform_balance" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Platform Wallet</p>
                    <p className="text-sm text-muted-foreground">Instant - Use for future entry fees or withdraw later</p>
                  </div>
                </div>
              </Label>
              <Badge variant="secondary">Instant</Badge>
            </div>

            {/* Stripe Connect */}
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="stripe_connect" id="stripe_connect" disabled={!hasStripeConnect} />
              <Label htmlFor="stripe_connect" className={`flex-1 cursor-pointer ${!hasStripeConnect ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      Direct Deposit
                      <Zap className="h-3 w-3 text-amber-500" />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {hasStripeConnect 
                        ? "1-2 business days to your bank account" 
                        : "Set up direct deposit to use this option"}
                    </p>
                  </div>
                </div>
              </Label>
              {hasStripeConnect ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Link href="/dashboard/financials/payout-methods">
                  <Button variant="outline" size="sm">
                    Set Up
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              )}
            </div>

            {/* Saved Payout Methods */}
            {payoutMethods.map((method) => (
              <div 
                key={method.id}
                className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
              >
                <RadioGroupItem 
                  value={method.method_type} 
                  id={method.id}
                  onClick={() => setSelectedPayoutMethodId(method.id)}
                />
                <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium capitalize">
                        {method.method_type === "bank" 
                          ? `${method.bank_name || "Bank"} ****${method.bank_last_four}`
                          : method.method_type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {method.account_email || method.account_handle || "3-5 business days"}
                      </p>
                    </div>
                  </div>
                </Label>
                {method.is_primary && (
                  <Badge variant="outline">Primary</Badge>
                )}
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Pending Payouts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pending Winnings</h2>
          {payouts.length > 1 && !claimed.has("all") && (
            <Button 
              onClick={handleClaimAll} 
              disabled={loading !== null}
            >
              {loading === "all" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Claim All (${(totalNetAmount / 100).toFixed(2)})
            </Button>
          )}
        </div>

        {payouts.map((payout) => (
          <Card 
            key={payout.id} 
            className={claimed.has(payout.id) ? "opacity-50" : ""}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-amber-500/10 p-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium">{payout.tournament?.name || "Tournament"}</p>
                    <p className="text-sm text-muted-foreground">{getPlacementLabel(payout.placement)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-emerald-600">
                    ${(payout.net_amount_cents / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${(payout.gross_amount_cents / 100).toFixed(2)} - ${(payout.platform_fee_cents / 100).toFixed(2)} fee
                  </p>
                </div>
                <div>
                  {claimed.has(payout.id) ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Claimed
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleClaim(payout.id)}
                      disabled={loading !== null}
                    >
                      {loading === payout.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Claim"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
