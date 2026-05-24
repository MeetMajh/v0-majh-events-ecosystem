"use client"

import { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Lock, Sparkles, ArrowRight } from "lucide-react"
import Link from "next/link"

interface FeatureGateProps {
  /** The feature key to check */
  featureKey: string
  /** Whether the feature is enabled (pass from server component) */
  isEnabled: boolean
  /** Children to render when feature is enabled */
  children: ReactNode
  /** Optional fallback when feature is disabled. Defaults to upgrade prompt. */
  fallback?: ReactNode
  /** Feature display name for the upgrade prompt */
  featureName?: string
  /** Hide component entirely when disabled instead of showing upgrade prompt */
  hideWhenDisabled?: boolean
}

/**
 * Feature Gate Component
 * 
 * Use this to conditionally render UI based on feature flags.
 * Accepts pre-checked isEnabled boolean from server components.
 * 
 * @example
 * ```tsx
 * // In a server component:
 * const hasTicketing = await hasFeature(tenantId, "ticketing")
 * 
 * // In the JSX:
 * <FeatureGate featureKey="ticketing" isEnabled={hasTicketing} featureName="Event Ticketing">
 *   <TicketingDashboard />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  featureKey,
  isEnabled,
  children,
  fallback,
  featureName,
  hideWhenDisabled = false,
}: FeatureGateProps) {
  if (isEnabled) {
    return <>{children}</>
  }

  if (hideWhenDisabled) {
    return null
  }

  if (fallback) {
    return <>{fallback}</>
  }

  // Default upgrade prompt
  return (
    <UpgradePrompt featureKey={featureKey} featureName={featureName} />
  )
}

interface UpgradePromptProps {
  featureKey: string
  featureName?: string
}

export function UpgradePrompt({ featureKey, featureName }: UpgradePromptProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="flex items-center justify-center gap-2">
          {featureName || formatFeatureName(featureKey)}
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="mr-1 h-3 w-3" />
            Premium
          </Badge>
        </CardTitle>
        <CardDescription>
          Upgrade your plan to unlock this feature and get access to advanced capabilities.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button asChild>
          <Link href="/dashboard/billing">
            View Plans
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * Inline feature lock for smaller UI elements
 */
export function FeatureLock({ 
  children, 
  isEnabled,
  tooltip = "Upgrade to unlock"
}: { 
  children: ReactNode
  isEnabled: boolean
  tooltip?: string
}) {
  if (isEnabled) {
    return <>{children}</>
  }

  return (
    <div className="relative group cursor-not-allowed">
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Badge variant="outline" className="bg-background">
          <Lock className="mr-1 h-3 w-3" />
          {tooltip}
        </Badge>
      </div>
    </div>
  )
}

/**
 * Feature badge for showing feature status
 */
export function FeatureBadge({ 
  isEnabled, 
  isPremium 
}: { 
  isEnabled: boolean
  isPremium: boolean 
}) {
  if (isEnabled) {
    return (
      <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
        Enabled
      </Badge>
    )
  }

  if (isPremium) {
    return (
      <Badge variant="secondary">
        <Sparkles className="mr-1 h-3 w-3" />
        Premium
      </Badge>
    )
  }

  return (
    <Badge variant="outline">Disabled</Badge>
  )
}

function formatFeatureName(key: string): string {
  return key
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
