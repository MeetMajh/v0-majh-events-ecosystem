"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, CreditCard, ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createConnectAccount, createConnectLoginLink } from "@/lib/tournament-financial-actions"

interface ConnectAccountStatusProps {
  profile: {
    stripe_connect_account_id?: string | null
    stripe_connect_status?: string | null
    stripe_connect_payouts_enabled?: boolean | null
  } | null
}

export function ConnectAccountStatus({ profile }: ConnectAccountStatusProps) {
  const [isLoading, setIsLoading] = useState(false)

  const status = profile?.stripe_connect_status ?? "not_started"
  const payoutsEnabled = profile?.stripe_connect_payouts_enabled ?? false

  async function handleSetupConnect() {
    setIsLoading(true)
    try {
      const result = await createConnectAccount()
      if ("error" in result) {
        toast.error(result.error)
      } else if (result.onboardingUrl) {
        window.location.href = result.onboardingUrl
      }
    } catch {
      toast.error("Failed to start setup")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleViewDashboard() {
    setIsLoading(true)
    try {
      const result = await createConnectLoginLink()
      if ("error" in result) {
        toast.error(result.error)
      } else if (result.loginUrl) {
        window.open(result.loginUrl, "_blank")
      }
    } catch {
      toast.error("Failed to open dashboard")
    } finally {
      setIsLoading(false)
    }
  }

  if (status === "complete" && payoutsEnabled) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            Payout Account Connected
          </CardTitle>
          <CardDescription className="text-green-600/80">
            Your Stripe account is fully set up and ready to receive payouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-green-600 border-green-600">
              Payouts Enabled
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleViewDashboard}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              View Stripe Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === "incomplete" || status === "pending") {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-5 w-5" />
            Complete Your Payout Setup
          </CardTitle>
          <CardDescription className="text-amber-600/80">
            Your Stripe account setup is incomplete. Finish the onboarding to receive payouts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleSetupConnect}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            Continue Setup
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          Set Up Payouts
        </CardTitle>
        <CardDescription>
          Connect a Stripe account to receive entry fee payouts from your tournaments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h4 className="font-medium text-foreground mb-2">Why connect Stripe?</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                Receive automatic payouts from entry fees
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                Track earnings and revenue in real-time
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                Secure, compliant payment processing
              </li>
            </ul>
          </div>
          <Button 
            onClick={handleSetupConnect}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            Set Up Payout Account
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
