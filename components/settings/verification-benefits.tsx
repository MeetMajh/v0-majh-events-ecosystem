"use client"

import { Card, CardContent } from "@/components/ui/card"
import { 
  Wallet, 
  TrendingUp, 
  Shield, 
  Zap,
  CheckCircle2,
  Lock
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  isVerified: boolean
  kycStatus: string
}

const benefits = [
  {
    icon: Wallet,
    title: "Unlimited Withdrawals",
    description: "Withdraw your earnings without restrictions",
    unverifiedLimit: "$100/day limit",
  },
  {
    icon: TrendingUp,
    title: "Higher Tournament Limits",
    description: "Enter tournaments with larger prize pools",
    unverifiedLimit: "$500 max entry",
  },
  {
    icon: Zap,
    title: "Instant Payouts",
    description: "Get your winnings faster with priority processing",
    unverifiedLimit: "3-5 day processing",
  },
  {
    icon: Shield,
    title: "Account Protection",
    description: "Enhanced security and fraud protection",
    unverifiedLimit: "Basic protection",
  },
]

export function VerificationBenefits({ isVerified, kycStatus }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {benefits.map((benefit) => {
        const Icon = benefit.icon
        
        return (
          <Card 
            key={benefit.title}
            className={cn(
              "relative overflow-hidden transition-all",
              isVerified 
                ? "border-emerald-500/20 bg-emerald-500/5" 
                : "border-border/50"
            )}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
                  isVerified ? "bg-emerald-500/10" : "bg-muted"
                )}>
                  <Icon className={cn(
                    "h-5 w-5",
                    isVerified ? "text-emerald-500" : "text-muted-foreground"
                  )} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-tight">{benefit.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {isVerified ? benefit.description : benefit.unverifiedLimit}
                  </p>
                </div>
              </div>
              
              {/* Status indicator */}
              <div className="mt-4 flex items-center gap-1.5">
                {isVerified ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-500">Unlocked</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Verify to unlock</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
