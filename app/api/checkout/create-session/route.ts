import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { amount_cents, tenant_id, type } = body

    if (!amount_cents || amount_cents < 100) {
      return NextResponse.json({ error: "Minimum amount is $1.00" }, { status: 400 })
    }

    if (amount_cents > 1000000) { // Max $10,000
      return NextResponse.json({ error: "Maximum amount is $10,000.00" }, { status: 400 })
    }

    // Verify user is member of tenant
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Not authorized for this tenant" }, { status: 403 })
    }

    // Get tenant info for Stripe metadata
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", tenant_id)
      .single()

    // Create Stripe Checkout Session
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Wallet Deposit",
              description: `Add funds to your ${tenant?.name || "MAJH Events"} wallet`,
            },
            unit_amount: amount_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: type || "wallet_deposit",
        tenant_id,
        user_id: user.id,
        amount_cents: amount_cents.toString(),
      },
      success_url: `${origin}/dashboard/financial?deposit=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/financial?deposit=cancelled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Failed to create checkout session:", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
