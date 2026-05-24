import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
})

const MIN_WITHDRAWAL_CENTS = 1000 // $10 minimum

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { amountCents, payoutMethodId, useStripeConnect } = await request.json()

    // Validate amount
    if (!amountCents || amountCents < MIN_WITHDRAWAL_CENTS) {
      return NextResponse.json(
        { message: `Minimum withdrawal is $${MIN_WITHDRAWAL_CENTS / 100}` },
        { status: 400 }
      )
    }

    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (walletError || !wallet) {
      return NextResponse.json({ message: "Wallet not found" }, { status: 404 })
    }

    if (wallet.balance_cents < amountCents) {
      return NextResponse.json({ message: "Insufficient balance" }, { status: 400 })
    }

    // Get profile for Stripe Connect
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_payouts_enabled, kyc_verified")
      .eq("id", user.id)
      .single()

    // Check KYC for large withdrawals
    if (amountCents >= 60000 && !profile?.kyc_verified) {
      return NextResponse.json(
        { message: "KYC verification required for withdrawals over $600" },
        { status: 400 }
      )
    }

    let payoutMethod = "platform"
    let payoutDetails = {}

    if (useStripeConnect) {
      // Validate Stripe Connect
      if (!profile?.stripe_connect_account_id || !profile?.stripe_connect_payouts_enabled) {
        return NextResponse.json(
          { message: "Stripe Connect not set up" },
          { status: 400 }
        )
      }
      payoutMethod = "stripe_connect"
      payoutDetails = { stripeConnectId: profile.stripe_connect_account_id }
    } else if (payoutMethodId) {
      // Validate payout method
      const { data: method, error: methodError } = await supabase
        .from("payout_methods")
        .select("*")
        .eq("id", payoutMethodId)
        .eq("user_id", user.id)
        .single()

      if (methodError || !method) {
        return NextResponse.json({ message: "Invalid payout method" }, { status: 400 })
      }
      payoutMethod = method.method_type
      payoutDetails = method
    }

    // Begin transaction
    // 1. Deduct from wallet
    const { error: deductError } = await supabase
      .from("wallets")
      .update({ 
        balance_cents: wallet.balance_cents - amountCents,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id)
      .eq("balance_cents", wallet.balance_cents) // Optimistic lock

    if (deductError) {
      return NextResponse.json({ message: "Failed to process withdrawal" }, { status: 500 })
    }

    // 2. Create financial transaction
    const { error: txError } = await supabase
      .from("financial_transactions")
      .insert({
        user_id: user.id,
        type: "withdrawal",
        amount_cents: -amountCents,
        status: "pending",
        description: `Withdrawal via ${payoutMethod}`,
      })

    if (txError) {
      // Rollback
      await supabase
        .from("wallets")
        .update({ balance_cents: wallet.balance_cents })
        .eq("user_id", user.id)

      return NextResponse.json({ message: "Failed to create transaction" }, { status: 500 })
    }

    // 3. Process Stripe payout if using Stripe Connect
    if (useStripeConnect && profile?.stripe_connect_account_id) {
      try {
        // Transfer to connected account
        const transfer = await stripe.transfers.create({
          amount: amountCents,
          currency: "usd",
          destination: profile.stripe_connect_account_id,
          metadata: {
            userId: user.id,
            type: "withdrawal",
          },
        })

        // Update transaction with transfer ID
        await supabase
          .from("financial_transactions")
          .update({
            status: "processing",
            stripe_transfer_id: transfer.id,
          })
          .eq("user_id", user.id)
          .eq("type", "withdrawal")
          .order("created_at", { ascending: false })
          .limit(1)

      } catch (stripeError) {
        console.error("[Withdraw] Stripe transfer failed:", stripeError)
        
        // Rollback wallet
        await supabase
          .from("wallets")
          .update({ balance_cents: wallet.balance_cents })
          .eq("user_id", user.id)

        // Mark transaction as failed
        await supabase
          .from("financial_transactions")
          .update({ status: "failed" })
          .eq("user_id", user.id)
          .eq("type", "withdrawal")
          .order("created_at", { ascending: false })
          .limit(1)

        return NextResponse.json(
          { message: "Stripe transfer failed. Please try again." },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: "Withdrawal initiated successfully",
    })

  } catch (error) {
    console.error("[Withdraw] Unexpected error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
