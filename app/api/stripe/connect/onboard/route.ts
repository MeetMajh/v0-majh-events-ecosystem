import { createStripeConnectAccount } from "@/lib/stripe-payout-service"
import { NextResponse } from "next/server"

export async function POST() {
  const result = await createStripeConnectAccount()

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ url: result.url })
}
