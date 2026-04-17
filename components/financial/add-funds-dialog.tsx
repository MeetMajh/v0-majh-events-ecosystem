"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CreditCard, Loader2 } from "lucide-react"

interface AddFundsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
}

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000] // cents

export function AddFundsDialog({ open, onOpenChange, tenantId }: AddFundsDialogProps) {
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const handlePresetClick = (cents: number) => {
    setAmount((cents / 100).toString())
  }

  const handleSubmit = async () => {
    const cents = Math.round(parseFloat(amount) * 100)
    if (isNaN(cents) || cents < 100) return

    setLoading(true)
    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          amount_cents: cents,
          tenant_id: tenantId,
          type: "wallet_deposit"
        }),
      })

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("Failed to create checkout session:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Funds</DialogTitle>
          <DialogDescription>
            Add money to your wallet to enter tournaments and make purchases.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preset Amounts */}
          <div className="grid grid-cols-4 gap-2">
            {PRESET_AMOUNTS.map((cents) => (
              <Button
                key={cents}
                variant={amount === (cents / 100).toString() ? "default" : "outline"}
                onClick={() => handlePresetClick(cents)}
                className="h-12"
              >
                ${cents / 100}
              </Button>
            ))}
          </div>

          {/* Custom Amount */}
          <div className="space-y-2">
            <Label htmlFor="custom-amount">Custom Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="custom-amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          {/* Payment Info */}
          <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span>Secure payment via Stripe</span>
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            onClick={handleSubmit} 
            disabled={!amount || parseFloat(amount) < 1 || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Add $${amount || "0.00"} to Wallet`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
