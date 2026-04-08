"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Trophy, ArrowRight, Loader2, Banknote, CreditCard, Wallet } from "lucide-react"
import { toast } from "sonner"
import { selectPayoutMethod, claimToPlatformBalance } from "@/lib/player-payout-actions"
import type { PayoutMethod } from "@/lib/tournament-financial-actions"

interface Payout {
  id: string
  tournament_id: string
  placement: number
  gross_amount_cents: number
  net_amount_cents: number
  status: string
  payout_method?: string
  tournaments?: {
    id: string
    name: string
    slug: string
    sponsor_name?: string
  }
}

interface PendingWinningsProps {
  payouts: Payout[]
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

function getPlacementLabel(placement: number) {
  if (placement === 1) return "1st Place"
  if (placement === 2) return "2nd Place"
  if (placement === 3) return "3rd Place"
  return `${placement}th Place`
}

function getStatusBadge(status: string) {
  switch (status) {
    case "awaiting_details":
      return <Badge variant="outline" className="text-amber-600 border-amber-600">Action Required</Badge>
    case "pending":
      return <Badge variant="outline" className="text-blue-600 border-blue-600">Pending</Badge>
    case "processing":
      return <Badge variant="outline" className="text-purple-600 border-purple-600">Processing</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function PendingWinnings({ payouts }: PendingWinningsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Pending Winnings
        </CardTitle>
        <CardDescription>
          Claim your tournament prizes by selecting a payout method
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {payouts.map((payout) => (
            <PayoutItem key={payout.id} payout={payout} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PayoutItem({ payout }: { payout: Payout }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod>("platform_balance")
  const [isLoading, setIsLoading] = useState(false)

  const needsSelection = payout.status === "awaiting_details"

  async function handleClaim() {
    setIsLoading(true)
    try {
      if (selectedMethod === "platform_balance") {
        const result = await claimToPlatformBalance(payout.id)
        if ("error" in result) {
          toast.error(result.error)
        } else {
          toast.success("Winnings added to your wallet!")
          setIsOpen(false)
        }
      } else {
        const result = await selectPayoutMethod(payout.id, selectedMethod)
        if ("error" in result) {
          toast.error(result.error)
        } else {
          toast.success("Payout method selected! Processing will begin shortly.")
          setIsOpen(false)
        }
      }
    } catch {
      toast.error("Failed to process payout")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">
              {payout.tournaments?.name || "Tournament"}
            </p>
            {payout.tournaments?.sponsor_name && (
              <Badge variant="secondary" className="text-xs">
                Sponsored
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {getPlacementLabel(payout.placement)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(payout.net_amount_cents)}
          </p>
          {getStatusBadge(payout.status)}
        </div>

        {needsSelection ? (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                Claim <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Select Payout Method</DialogTitle>
                <DialogDescription>
                  Choose how you want to receive your {formatCurrency(payout.net_amount_cents)} winnings
                </DialogDescription>
              </DialogHeader>

              <RadioGroup
                value={selectedMethod}
                onValueChange={(value) => setSelectedMethod(value as PayoutMethod)}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="platform_balance" id="platform_balance" />
                  <Label htmlFor="platform_balance" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-primary" />
                      <span className="font-medium">Platform Wallet</span>
                      <Badge variant="secondary" className="text-xs">Instant</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add to your platform balance for instant access
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="bank" id="bank" />
                  <Label htmlFor="bank" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Bank Transfer</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Direct deposit to your bank account (1-3 business days)
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="paypal" id="paypal" />
                  <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">PayPal</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Send to your PayPal account
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="venmo" id="venmo" />
                  <Label htmlFor="venmo" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-cyan-600" />
                      <span className="font-medium">Venmo</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Send to your Venmo account
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="cashapp" id="cashapp" />
                  <Label htmlFor="cashapp" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                      <span className="font-medium">Cash App</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Send to your Cash App account
                    </p>
                  </Label>
                </div>
              </RadioGroup>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleClaim} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Payout
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Link href={`/esports/tournaments/${payout.tournaments?.slug}`}>
            <Button variant="outline" size="sm">
              View Tournament
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
