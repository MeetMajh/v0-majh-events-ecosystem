"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Loader2, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { createWalletDepositCheckout } from "@/lib/wallet-actions"

const QUICK_AMOUNTS = [10, 25, 50, 100, 250]

export function AddFundsButton() {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAddFunds = async () => {
    const amountCents = Math.round(parseFloat(amount) * 100)
    
    if (isNaN(amountCents) || amountCents < 500) {
      toast.error("Minimum deposit is $5.00")
      return
    }

    if (amountCents > 50000) {
      toast.error("Maximum deposit is $500.00")
      return
    }

    setLoading(true)
    try {
      const result = await createWalletDepositCheckout(amountCents)
      
      if (result.error) {
        toast.error(result.error)
      } else if (result.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = result.checkoutUrl
      }
    } catch (err) {
      toast.error("Failed to start checkout")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Funds
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Funds to Wallet</DialogTitle>
          <DialogDescription>
            Add money to your wallet to pay for tournament entry fees
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Quick Amount Buttons */}
          <div>
            <Label className="text-sm text-muted-foreground">Quick Select</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant={amount === String(quickAmount) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAmount(String(quickAmount))}
                >
                  ${quickAmount}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div>
            <Label htmlFor="amount">Custom Amount (min $5)</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="amount"
                type="number"
                min="5"
                max="500"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          <Button
            onClick={handleAddFunds}
            disabled={loading || !amount || parseFloat(amount) < 5}
            className="w-full gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            {loading ? "Redirecting..." : `Pay $${amount || "0.00"} with Stripe`}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Secure payment powered by Stripe. Funds will be added to your wallet instantly after payment.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
