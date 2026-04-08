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

    // Get user's latest KYC session
    const { data: kycSession } = await supabase
      .from("kyc_sessions")
      .select("stripe_session_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (!kycSession?.stripe_session_id) {
      return NextResponse.json({ error: "No KYC session found" }, { status: 404 })
    }

    // Fetch status from Stripe
    const session = await stripe.identity.verificationSessions.retrieve(
      kycSession.stripe_session_id
    )

    // Map Stripe status to our status
    let kycStatus: string
    switch (session.status) {
      case "verified":
        kycStatus = "verified"
        break
      case "requires_input":
        kycStatus = "requires_input"
        break
      case "processing":
        kycStatus = "pending"
        break
      case "canceled":
        kycStatus = "rejected"
        break
      default:
        kycStatus = "pending"
    }

    // Update KYC session
    await supabase
      .from("kyc_sessions")
      .update({
        status: session.status,
        completed_at: session.status === "verified" ? new Date().toISOString() : null,
      })
      .eq("stripe_session_id", kycSession.stripe_session_id)

    // Update profile
    await supabase
      .from("profiles")
      .update({
        kyc_status: kycStatus,
        kyc_verified: kycStatus === "verified",
        kyc_submitted_at: kycStatus === "verified" ? new Date().toISOString() : null,
      })
      .eq("id", user.id)

    return NextResponse.json({
      status: kycStatus,
      stripeStatus: session.status,
    })
  } catch (error) {
    console.error("KYC status refresh error:", error)
    return NextResponse.json(
      { error: "Failed to refresh status" },
      { status: 500 }
    )
  }
}
