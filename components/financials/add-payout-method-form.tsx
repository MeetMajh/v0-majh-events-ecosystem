"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Building2, CreditCard, DollarSign, Loader2 } from "lucide-react"
import { addPayoutMethod } from "@/lib/player-payout-actions"

const PAYOUT_METHODS = [
  {
    id: "bank",
    name: "Bank Account",
    description: "Direct deposit to your bank account (2-3 business days)",
    icon: Building2,
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "Send to your PayPal email address",
    icon: DollarSign,
  },
  {
    id: "venmo",
    name: "Venmo",
    description: "Send to your Venmo handle",
    icon: CreditCard,
  },
  {
    id: "cashapp",
    name: "Cash App",
    description: "Send to your Cash App $cashtag",
    icon: DollarSign,
  },
] as const

type MethodType = (typeof PAYOUT_METHODS)[number]["id"]

export function AddPayoutMethodForm() {
  const router = useRouter()
  const [selectedMethod, setSelectedMethod] = useState<MethodType>("bank")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPrimary, setIsPrimary] = useState(false)

  // Bank fields
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [routingNumber, setRoutingNumber] = useState("")
  const [nickname, setNickname] = useState("")

  // Digital wallet fields
  const [accountEmail, setAccountEmail] = useState("")
  const [accountHandle, setAccountHandle] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const data: Parameters<typeof addPayoutMethod>[0] = {
        method_type: selectedMethod,
        is_primary: isPrimary,
        nickname: nickname || undefined,
      }

      if (selectedMethod === "bank") {
        if (!bankName || !accountNumber || !routingNumber) {
          toast.error("Please fill in all bank account fields")
          setIsSubmitting(false)
          return
        }
        data.bank_name = bankName
        data.bank_last_four = accountNumber.slice(-4)
        data.bank_routing_last_four = routingNumber.slice(-4)
      } else if (selectedMethod === "paypal") {
        if (!accountEmail) {
          toast.error("Please enter your PayPal email")
          setIsSubmitting(false)
          return
        }
        data.account_email = accountEmail
      } else {
        if (!accountHandle) {
          toast.error("Please enter your account handle")
          setIsSubmitting(false)
          return
        }
        data.account_handle = accountHandle
      }

      const result = await addPayoutMethod(data)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Payout method added successfully")
        router.refresh()
        // Reset form
        setBankName("")
        setAccountNumber("")
        setRoutingNumber("")
        setAccountEmail("")
        setAccountHandle("")
        setNickname("")
        setIsPrimary(false)
      }
    } catch (error) {
      toast.error("Failed to add payout method")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Payout Method</CardTitle>
        <CardDescription>
          Add a new way to receive your tournament winnings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <RadioGroup
            value={selectedMethod}
            onValueChange={(v) => setSelectedMethod(v as MethodType)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {PAYOUT_METHODS.map((method) => (
              <Label
                key={method.id}
                htmlFor={method.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                  selectedMethod === method.id
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <RadioGroupItem value={method.id} id={method.id} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <method.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{method.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {method.description}
                  </p>
                </div>
              </Label>
            ))}
          </RadioGroup>

          <div className="space-y-4">
            {selectedMethod === "bank" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    placeholder="e.g., Chase, Bank of America"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="routingNumber">Routing Number</Label>
                    <Input
                      id="routingNumber"
                      placeholder="9 digits"
                      value={routingNumber}
                      onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                      maxLength={9}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      placeholder="Account number"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {selectedMethod === "paypal" && (
              <div className="space-y-2">
                <Label htmlFor="paypalEmail">PayPal Email</Label>
                <Input
                  id="paypalEmail"
                  type="email"
                  placeholder="your@email.com"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  required
                />
              </div>
            )}

            {selectedMethod === "venmo" && (
              <div className="space-y-2">
                <Label htmlFor="venmoHandle">Venmo Username</Label>
                <Input
                  id="venmoHandle"
                  placeholder="@username"
                  value={accountHandle}
                  onChange={(e) => setAccountHandle(e.target.value)}
                  required
                />
              </div>
            )}

            {selectedMethod === "cashapp" && (
              <div className="space-y-2">
                <Label htmlFor="cashappHandle">Cash App $Cashtag</Label>
                <Input
                  id="cashappHandle"
                  placeholder="$cashtag"
                  value={accountHandle}
                  onChange={(e) => setAccountHandle(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname (optional)</Label>
              <Input
                id="nickname"
                placeholder="e.g., My main account"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isPrimary"
                checked={isPrimary}
                onCheckedChange={(checked) => setIsPrimary(checked === true)}
              />
              <Label htmlFor="isPrimary" className="cursor-pointer text-sm">
                Set as primary payout method
              </Label>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Payout Method"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
