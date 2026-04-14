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
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { addFundsToWallet } from "@/lib/wallet-actions"
import { useRouter } from "next/navigation"

const QUICK_AMOUNTS = [5, 10, 25, 50, 100]

export function AddFundsButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAddFunds = async () => {
    const amountCents = Math.round(parseFloat(amount) * 100)
    
    if (isNaN(amountCents) || amountCents < 100) {
      toast.error("Minimum amount is $1.00")
      return
    }

    if (amountCents > 50000) {
      toast.error("Maximum amount is $500.00")
      return
    }

    setLoading(true)
    try {
      const result = await addFundsToWallet(amountCents)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Added $${(amountCents / 100).toFixed(2)} to your wallet!`)
        setOpen(false)
        setAmount("")
        router.refresh()
      }
    } catch (err) {
      toast.error("Failed to add funds")
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
            <Label htmlFor="amount">Custom Amount</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="amount"
                type="number"
                min="1"
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
            disabled={loading || !amount}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add ${amount || "0.00"} to Wallet
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            For testing: Funds are added directly without payment processing.
            In production, this would integrate with Stripe.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
