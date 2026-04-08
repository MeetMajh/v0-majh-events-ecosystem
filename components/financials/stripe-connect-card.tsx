"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ExternalLink, Loader2, Zap, AlertCircle, CreditCard } from "lucide-react"

interface StripeConnectCardProps {
  status: string
  payoutsEnabled: boolean
  justConnected?: boolean
}

export function StripeConnectCard({ status, payoutsEnabled, justConnected }: StripeConnectCardProps) {
  const [loading, setLoading] = useState(false)
  const [dashboardLoading, setDashboardLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/stripe/connect/onboard", { method: "POST" })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("Failed to start onboarding:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDashboard = async () => {
    setDashboardLoading(true)
    try {
      const res = await fetch("/api/stripe/connect/dashboard", { method: "POST" })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, "_blank")
      }
    } catch (error) {
      console.error("Failed to open dashboard:", error)
    } finally {
      setDashboardLoading(false)
    }
  }

  const isComplete = status === "complete" && payoutsEnabled
  const isPending = status === "pending" || status === "incomplete"

  return (
    <Card className={isComplete ? "border-emerald-500/50 bg-emerald-500/5" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${isComplete ? "bg-emerald-500/10" : "bg-muted"}`}>
              <CreditCard className={`h-5 w-5 ${isComplete ? "text-emerald-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Direct Deposit
                <Badge variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Fastest
                </Badge>
              </CardTitle>
              <CardDescription>
                Receive payouts directly to your bank account via Stripe
              </CardDescription>
            </div>
          </div>
          {isComplete && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
          {isPending && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Setup Required
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {justConnected && isComplete && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 inline mr-2" />
            Your account is now connected. You can receive instant payouts.
          </div>
        )}

        {isComplete ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <p>Your bank account is connected and ready to receive payouts.</p>
              <p className="mt-1">Typical transfer time: <span className="font-medium text-foreground">1-2 business days</span></p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDashboard}
              disabled={dashboardLoading}
            >
              {dashboardLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Manage Account
                  <ExternalLink className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        ) : isPending ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your account setup is incomplete. Complete the onboarding to receive payouts.
            </p>
            <Button onClick={handleConnect} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Continue Setup
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Connect your bank account to receive tournament winnings directly.</p>
              <ul className="list-disc list-inside text-xs space-y-0.5 mt-2">
                <li>Fastest payout option (1-2 business days)</li>
                <li>No fees on prize payouts</li>
                <li>Secure, powered by Stripe</li>
              </ul>
            </div>
            <Button onClick={handleConnect} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Set Up Direct Deposit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
