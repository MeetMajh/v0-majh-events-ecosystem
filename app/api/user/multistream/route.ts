import { NextResponse } from "next/server"
import { getStreamDestinations } from "@/lib/multistream-actions"

export async function GET() {
  const result = await getStreamDestinations()
  return NextResponse.json(result)
}
