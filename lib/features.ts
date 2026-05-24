import { createClient } from "@/lib/supabase/server"

export type FeatureKey =
  | "wallets"
  | "tournaments"
  | "ticketing"
  | "escrow"
  | "payouts"
  | "api_access"
  | "advanced_analytics"
  | "multi_currency"
  | "white_label"
  | "webhook_events"
  | "venue_management"
  | "pos_integration"
  | "staff_management"
  | "badge_printing"

export interface Feature {
  key: string
  name: string
  description: string
  category: string
  is_premium: boolean
  is_enabled: boolean
  expires_at: string | null
}

/**
 * Check if a tenant has access to a specific feature
 */
export async function hasFeature(tenantId: string, featureKey: FeatureKey): Promise<boolean> {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc("has_feature", {
    p_tenant_id: tenantId,
    p_feature_key: featureKey,
  })

  if (error) {
    console.error("[Features] Error checking feature:", error)
    return false
  }

  return data === true
}

/**
 * Get all features for a tenant with their enabled status
 */
export async function getTenantFeatures(tenantId: string): Promise<Feature[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc("get_tenant_features", {
    p_tenant_id: tenantId,
  })

  if (error) {
    console.error("[Features] Error getting tenant features:", error)
    return []
  }

  return data || []
}

/**
 * Enable a feature for a tenant
 */
export async function enableFeature(
  tenantId: string,
  featureKey: FeatureKey,
  enabledBy: string,
  expiresAt?: Date
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc("enable_tenant_feature", {
    p_tenant_id: tenantId,
    p_feature_key: featureKey,
    p_enabled_by: enabledBy,
    p_expires_at: expiresAt?.toISOString() || null,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: data?.success || false }
}

/**
 * Disable a feature for a tenant
 */
export async function disableFeature(
  tenantId: string,
  featureKey: FeatureKey,
  disabledBy: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc("disable_tenant_feature", {
    p_tenant_id: tenantId,
    p_feature_key: featureKey,
    p_disabled_by: disabledBy,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: data?.success || false }
}

/**
 * Feature check that throws an error if feature is not enabled
 * Use in API routes and server actions
 */
export async function requireFeature(tenantId: string, featureKey: FeatureKey): Promise<void> {
  const isEnabled = await hasFeature(tenantId, featureKey)
  
  if (!isEnabled) {
    throw new FeatureRequiredError(featureKey)
  }
}

/**
 * Custom error for missing features
 */
export class FeatureRequiredError extends Error {
  public featureKey: string
  public code: string = "FEATURE_REQUIRED"

  constructor(featureKey: string) {
    super(`Feature '${featureKey}' is not enabled. Upgrade required.`)
    this.name = "FeatureRequiredError"
    this.featureKey = featureKey
  }
}

/**
 * Feature category labels for UI
 */
export const FEATURE_CATEGORIES: Record<string, { label: string; description: string }> = {
  financial: {
    label: "Financial",
    description: "Payment processing, wallets, and money management",
  },
  events: {
    label: "Events",
    description: "Event creation, ticketing, and management",
  },
  platform: {
    label: "Platform",
    description: "API access, integrations, and advanced features",
  },
  general: {
    label: "General",
    description: "Core platform features",
  },
}

/**
 * Group features by category
 */
export function groupFeaturesByCategory(features: Feature[]): Record<string, Feature[]> {
  return features.reduce((acc, feature) => {
    const category = feature.category || "general"
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(feature)
    return acc
  }, {} as Record<string, Feature[]>)
}
