import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-03-31.basil",
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check admin access
    const { data: staffRole } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "manager"])
      .single()

    if (!staffRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { payoutId } = await request.json()

    if (!payoutId) {
      return NextResponse.json({ error: "Payout ID required" }, { status: 400 })
    }

    // Get payout details
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from("player_payouts")
      .select(`
        *,
        profiles!player_payouts_user_id_fkey (
          stripe_connect_account_id,
          kyc_verified
        )
      `)
      .eq("id", payoutId)
      .single()

    if (payoutError || !payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 })
    }

    if (payout.status !== "pending") {
      return NextResponse.json({ error: "Payout already processed" }, { status: 400 })
    }

    // Verify user has Stripe Connect and KYC
    const profile = payout.profiles
    if (!profile?.stripe_connect_account_id) {
      return NextResponse.json({ error: "User has not set up Stripe Connect" }, { status: 400 })
    }

    if (!profile?.kyc_verified) {
      return NextResponse.json({ error: "User has not completed KYC verification" }, { status: 400 })
    }

    // Update payout status to processing
    await supabaseAdmin
      .from("player_payouts")
      .update({
        status: "processing",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutId)

    // Create Stripe Transfer
    try {
      const transfer = await stripe.transfers.create({
        amount: payout.net_amount_cents,
        currency: "usd",
        destination: profile.stripe_connect_account_id,
        metadata: {
          type: "player_prize",
          payout_id: payoutId,
          tournament_id: payout.tournament_id,
          user_id: payout.user_id,
          placement: payout.placement.toString(),
        },
      })

      // Update payout with transfer ID
      await supabaseAdmin
        .from("player_payouts")
        .update({
          stripe_transfer_id: transfer.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutId)

      // Record transaction
      await supabaseAdmin.from("financial_transactions").insert({
        user_id: payout.user_id,
        tournament_id: payout.tournament_id,
        type: "payout",
        amount_cents: payout.net_amount_cents,
        status: "processing",
        description: `Prize payout for placement #${payout.placement}`,
        stripe_transfer_id: transfer.id,
      })

      return NextResponse.json({ 
        success: true, 
        transferId: transfer.id,
        message: "Payout approved and processing" 
      })
    } catch (stripeError) {
      // Revert status on Stripe failure
      await supabaseAdmin
        .from("player_payouts")
        .update({
          status: "failed",
          failure_reason: stripeError instanceof Error ? stripeError.message : "Stripe transfer failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutId)

      console.error("[Admin Payouts] Stripe error:", stripeError)
      return NextResponse.json({ 
        error: "Failed to process Stripe transfer" 
      }, { status: 500 })
    }
  } catch (error) {
    console.error("[Admin Payouts] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
