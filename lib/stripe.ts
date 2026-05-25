import "server-only"

import Stripe from "stripe"

// Lazy initialization to avoid build-time errors when env vars are not available
let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured")
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2025-02-24.acacia",
    })
  }
  return stripeInstance
}

// Legacy export for backward compatibility (will be lazily initialized on first access)
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as any)[prop]
  }
})
