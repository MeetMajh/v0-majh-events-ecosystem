import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
})

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    // Create Stripe Identity Verification Session
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: {
        user_id: user.id,
      },
      options: {
        document: {
          require_matching_selfie: true,
          allowed_types: ["passport", "driving_license", "id_card"],
        },
      },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/verification?verified=true`,
    })

    // Store session in database
    const { error: sessionError } = await supabase
      .from("kyc_sessions")
      .insert({
        user_id: user.id,
        stripe_session_id: session.id,
        stripe_session_url: session.url,
        status: "created",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      })

    if (sessionError) {
      console.error("Failed to store KYC session:", sessionError)
      // Continue anyway - the session was created in Stripe
    }

    // Update profile status
    await supabase
      .from("profiles")
      .update({
        kyc_status: "pending",
        stripe_identity_session_id: session.id,
      })
      .eq("id", user.id)

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error("KYC session creation error:", error)
    return NextResponse.json(
      { error: "Failed to create verification session" },
      { status: 500 }
    )
  }
}
