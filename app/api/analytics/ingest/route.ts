import { NextRequest, NextResponse } from "next/server"
import { ingestEvent, ingestEventBatch } from "@/lib/analytics-pipeline"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Support both single events and batches
    if (Array.isArray(body.events)) {
      const result = await ingestEventBatch(body.events)
      return NextResponse.json(result)
    }
    
    // Single event
    const result = await ingestEvent({
      event_type: body.event_type,
      event_name: body.event_name,
      user_id: body.user_id,
      session_id: body.session_id,
      device_id: body.device_id,
      target_type: body.target_type,
      target_id: body.target_id,
      properties: body.properties,
      platform: body.platform,
      device_type: body.device_type,
      country: body.country,
      utm_source: body.utm_source,
      utm_medium: body.utm_medium,
      utm_campaign: body.utm_campaign,
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("Analytics ingest error:", error)
    return NextResponse.json(
      { error: "Failed to ingest event" },
      { status: 500 }
    )
  }
}
