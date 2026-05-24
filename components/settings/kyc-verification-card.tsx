"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Camera,
  FileText
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  kyc_status: string | null
  kyc_verified: boolean | null
  kyc_submitted_at: string | null
  kyc_rejection_reason: string | null
}

interface KycSession {
  id: string
  stripe_session_id: string
  stripe_session_url: string | null
  status: string
  created_at: string
}

interface Props {
  profile: Profile | null
  kycSession: KycSession | null
}

const statusConfig: Record<string, { 
  label: string
  description: string
  color: string
  icon: React.ReactNode
  progress: number
}> = {
  not_started: {
    label: "Not Started",
    description: "Start the verification process to unlock withdrawals",
    color: "text-muted-foreground",
    icon: <Shield className="h-6 w-6" />,
    progress: 0,
  },
  pending: {
    label: "In Progress",
    description: "Your verification is being processed",
    color: "text-amber-500",
    icon: <Clock className="h-6 w-6 animate-pulse" />,
    progress: 50,
  },
  requires_input: {
    label: "Action Required",
    description: "Additional information is needed to complete verification",
    color: "text-amber-500",
    icon: <AlertCircle className="h-6 w-6" />,
    progress: 30,
  },
  verified: {
    label: "Verified",
    description: "Your identity has been verified successfully",
    color: "text-emerald-500",
    icon: <ShieldCheck className="h-6 w-6" />,
    progress: 100,
  },
  rejected: {
    label: "Rejected",
    description: "Your verification was not successful",
    color: "text-red-500",
    icon: <ShieldAlert className="h-6 w-6" />,
    progress: 0,
  },
  expired: {
    label: "Expired",
    description: "Your verification has expired and needs to be renewed",
    color: "text-amber-500",
    icon: <Clock className="h-6 w-6" />,
    progress: 0,
  },
}

export function KycVerificationCard({ profile, kycSession }: Props) {
  const [isPending, startTransition] = useTransition()
  const [sessionUrl, setSessionUrl] = useState<string | null>(kycSession?.stripe_session_url ?? null)
  
  const status = profile?.kyc_status ?? "not_started"
  const config = statusConfig[status] ?? statusConfig.not_started

  const handleStartVerification = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/kyc/create-session", {
          method: "POST",
        })
        
        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || "Failed to create verification session")
        }
        
        const data = await res.json()
        
        if (data.url) {
          setSessionUrl(data.url)
          window.open(data.url, "_blank")
          toast.success("Verification session started", {
            description: "Complete the verification in the new tab",
          })
        }
      } catch (error) {
        toast.error("Failed to start verification", {
          description: error instanceof Error ? error.message : "Please try again",
        })
      }
    })
  }

  const handleRefreshStatus = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/kyc/refresh-status", {
          method: "POST",
        })
        
        if (!res.ok) throw new Error("Failed to refresh status")
        
        window.location.reload()
      } catch {
        toast.error("Failed to refresh status")
      }
    })
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      {/* Progress bar at top */}
      <div className="h-1 bg-muted">
        <div 
          className={cn(
            "h-full transition-all duration-500",
            status === "verified" ? "bg-emerald-500" : 
            status === "rejected" ? "bg-red-500" : "bg-primary"
          )}
          style={{ width: `${config.progress}%` }}
        />
      </div>
      
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full",
              status === "verified" 
                ? "bg-emerald-500/10" 
                : status === "rejected" 
                  ? "bg-red-500/10"
                  : "bg-primary/10"
            )}>
              <span className={config.color}>{config.icon}</span>
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Identity Verification
                <Badge 
                  variant="outline" 
                  className={cn(
                    "ml-2",
                    status === "verified" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
                    status === "rejected" && "border-red-500/20 bg-red-500/10 text-red-500",
                    status === "pending" && "border-amber-500/20 bg-amber-500/10 text-amber-500",
                    status === "requires_input" && "border-amber-500/20 bg-amber-500/10 text-amber-500",
                  )}
                >
                  {config.label}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {config.description}
              </CardDescription>
            </div>
          </div>
          
          {status === "pending" && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefreshStatus}
              disabled={isPending}
            >
              <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Status-specific content */}
        {status === "verified" && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-500">Verification Complete</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You have full access to withdrawals and higher transaction limits.
                </p>
                {profile?.kyc_submitted_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Verified on {new Date(profile.kyc_submitted_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {status === "rejected" && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-500">Verification Rejected</p>
                {profile?.kyc_rejection_reason && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Reason: {profile.kyc_rejection_reason}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  You can try verifying again with clearer documents.
                </p>
              </div>
            </div>
          </div>
        )}

        {(status === "not_started" || status === "rejected" || status === "expired") && (
          <>
            {/* Verification steps */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">What you will need:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Government ID</p>
                    <p className="text-xs text-muted-foreground">Passport, license, or ID card</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Camera className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Selfie Photo</p>
                    <p className="text-xs text-muted-foreground">Live photo for verification</p>
                  </div>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleStartVerification} 
              disabled={isPending}
              className="w-full"
              size="lg"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Verification...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  {status === "rejected" || status === "expired" ? "Try Again" : "Start Verification"}
                </>
              )}
            </Button>
          </>
        )}

        {status === "pending" && sessionUrl && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-500">Verification In Progress</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your verification is being reviewed. This usually takes a few minutes.
                  </p>
                </div>
              </div>
            </div>

            <Button 
              variant="outline" 
              onClick={() => window.open(sessionUrl, "_blank")}
              className="w-full"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Continue Verification
            </Button>
          </div>
        )}

        {status === "requires_input" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-500">Additional Information Required</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please provide the requested information to complete your verification.
                  </p>
                </div>
              </div>
            </div>

            {sessionUrl && (
              <Button 
                onClick={() => window.open(sessionUrl, "_blank")}
                className="w-full"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Complete Verification
              </Button>
            )}
          </div>
        )}

        {/* Security note */}
        <p className="text-xs text-muted-foreground text-center">
          Your data is encrypted and processed securely by Stripe Identity.
          We never store your full ID documents.
        </p>
      </CardContent>
    </Card>
  )
}
