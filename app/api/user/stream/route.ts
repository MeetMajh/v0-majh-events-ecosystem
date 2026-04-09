import { NextResponse } from "next/server"
import { getMyStream } from "@/lib/go-live-actions"

export async function GET() {
  const result = await getMyStream()
  return NextResponse.json(result)
}
