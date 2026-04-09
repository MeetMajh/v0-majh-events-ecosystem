import { NextResponse } from "next/server"
import { getStreamSources } from "@/lib/stream-sources-actions"

export async function GET() {
  const result = await getStreamSources()
  return NextResponse.json(result)
}
