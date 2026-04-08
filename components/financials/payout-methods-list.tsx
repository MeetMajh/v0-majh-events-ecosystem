"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  CreditCard, 
  Banknote, 
  Star, 
  Trash2, 
  Loader2, 
  CheckCircle,
  Clock
} from "lucide-react"
import { toast } from "sonner"
import { setPrimaryPayoutMethod, deletePayoutMethod } from "@/lib/tournament-financial-actions"

interface PayoutMethod {
  id: string
  method_type: string
  is_primary: boolean
  is_verified: boolean
  verification_status: string
  bank_name?: string
  bank_last_four?: string
  account_email?: string
  account_handle?: string
  nickname?: string
  created_at: string
}

interface PayoutMethodsListProps {
  payoutMethods: PayoutMethod[]
  preferredMethod?: string
}

function getMethodIcon(type: string) {
  switch (type) {
    case "bank":
      return <Banknote className="h-5 w-5 text-green-600" />
    case "paypal":
      return <CreditCard className="h-5 w-5 text-blue-600" />
    case "venmo":
      return <CreditCard className="h-5 w-5 text-cyan-600" />
    case "cashapp":
      return <CreditCard className="h-5 w-5 text-emerald-600" />
    case "western_union":
      return <Banknote className="h-5 w-5 text-yellow-600" />
    default:
      return <CreditCard className="h-5 w-5 text-muted-foreground" />
  }
}

function getMethodLabel(type: string) {
  const labels: Record<string, string> = {
    bank: "Bank Account",
    paypal: "PayPal",
    venmo: "Venmo",
    cashapp: "Cash App",
    western_union: "Western Union",
  }
  return labels[type] || type
}

function getMethodDetails(method: PayoutMethod) {
  if (method.bank_name && method.bank_last_four) {
    return `${method.bank_name} ****${method.bank_last_four}`
  }
  if (method.account_email) {
    return method.account_email
  }
  if (method.account_handle) {
    return `@${method.account_handle}`
  }
  return "No details"
}

export function PayoutMethodsList({ payoutMethods, preferredMethod }: PayoutMethodsListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleSetPrimary(methodId: string) {
    setLoadingId(methodId)
    try {
      const result = await setPrimaryPayoutMethod(methodId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Primary payout method updated")
      }
    } catch {
      toast.error("Failed to update")
    } finally {
      setLoadingId(null)
    }
  }

  async function handleDelete(methodId: string) {
    setLoadingId(methodId)
    try {
      const result = await deletePayoutMethod(methodId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Payout method removed")
      }
    } catch {
      toast.error("Failed to remove")
    } finally {
      setLoadingId(null)
    }
  }

  if (!payoutMethods.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Payout Methods</CardTitle>
          <CardDescription>
            You have not added any payout methods yet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No payout methods</p>
            <p className="text-sm text-muted-foreground/70">
              Add a payout method to receive your tournament winnings
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Payout Methods</CardTitle>
        <CardDescription>
          Methods you can use to receive tournament winnings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {payoutMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  {getMethodIcon(method.method_type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">
                      {method.nickname || getMethodLabel(method.method_type)}
                    </p>
                    {method.is_primary && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="mr-1 h-3 w-3" />
                        Primary
                      </Badge>
                    )}
                    {method.verification_status === "verified" ? (
                      <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs">
                        <Clock className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getMethodDetails(method)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!method.is_primary && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetPrimary(method.id)}
                    disabled={loadingId === method.id}
                  >
                    {loadingId === method.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Set Primary"
                    )}
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Payout Method</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove this payout method? You can add it again later.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(method.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
