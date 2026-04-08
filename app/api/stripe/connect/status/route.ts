import { getStripeConnectStatus } from "@/lib/stripe-payout-service"
import { NextResponse } from "next/server"

export async function GET() {
  const status = await getStripeConnectStatus()
  return NextResponse.json(status)
}
