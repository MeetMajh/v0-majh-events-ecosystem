import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

// Use service role for webhook (no user context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MuxWebhookEvent {
  type: string
  data: {
    id: string
    stream_key?: string
    status?: string
    playback_ids?: Array<{ id: string; policy: string }>
    asset_id?: string
  }
}

// Verify Mux webhook signature
function verifyMuxSignature(body: string, signature: string | null): boolean {
  const secret = process.env.MUX_WEBHOOK_SECRET
  if (!secret) {
    console.log("[v0] No MUX_WEBHOOK_SECRET configured, skipping verification")
    return true // Allow in development
  }
  if (!signature) {
    console.log("[v0] No signature provided")
    return false
  }

  // Mux signature format: t=timestamp,v1=signature
  const parts = signature.split(",")
  const timestampPart = parts.find(p => p.startsWith("t="))
  const signaturePart = parts.find(p => p.startsWith("v1="))

  if (!timestampPart || !signaturePart) {
    return false
  }

  const timestamp = timestampPart.split("=")[1]
  const expectedSig = signaturePart.split("=")[1]

  // Create the signed payload
  const signedPayload = `${timestamp}.${body}`
  const computedSig = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex")

  return crypto.timingSafeEqual(
    Buffer.from(expectedSig),
    Buffer.from(computedSig)
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("mux-signature")

    // Verify webhook signature
    if (!verifyMuxSignature(body, signature)) {
      console.error("[v0] Invalid Mux webhook signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const event: MuxWebhookEvent = JSON.parse(body)

    console.log("[v0] Mux webhook received:", event.type)

    switch (event.type) {
      // Stream started broadcasting
      case "video.live_stream.active": {
        const muxStreamId = event.data.id
        console.log("[v0] Stream active:", muxStreamId)

        // Update user_streams table
        const { error } = await supabase
          .from("user_streams")
          .update({
            status: "live",
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("mux_stream_id", muxStreamId)

        if (error) {
          console.error("[v0] Error updating stream to live:", error)
        }

        // Also update stream_sessions if exists
        await supabase
          .from("stream_sessions")
          .update({
            status: "live",
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("mux_stream_id", muxStreamId)

        break
      }

      // Stream stopped broadcasting
      case "video.live_stream.idle": {
        const muxStreamId = event.data.id
        console.log("[v0] Stream idle:", muxStreamId)

        // Update user_streams table
        const { error } = await supabase
          .from("user_streams")
          .update({
            status: "ended",
            ended_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("mux_stream_id", muxStreamId)

        if (error) {
          console.error("[v0] Error updating stream to ended:", error)
        }

        // Also update stream_sessions if exists
        await supabase
          .from("stream_sessions")
          .update({
            status: "ended",
            ended_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("mux_stream_id", muxStreamId)

        break
      }

      // VOD asset created after stream ends
      case "video.asset.ready": {
        const assetId = event.data.id
        const playbackId = event.data.playback_ids?.[0]?.id
        console.log("[v0] Asset ready:", assetId, "playback:", playbackId)

        // Find the stream that created this asset and update it
        if (playbackId) {
          // Update with VOD asset info
          await supabase
            .from("user_streams")
            .update({
              mux_asset_id: assetId,
              playback_url: `https://stream.mux.com/${playbackId}.m3u8`,
              updated_at: new Date().toISOString(),
            })
            .eq("mux_playback_id", playbackId)
        }

        break
      }

      // Stream was deleted
      case "video.live_stream.deleted": {
        console.log("[v0] Stream deleted:", event.data.id)
        break
      }

      default:
        console.log("[v0] Unhandled Mux event:", event.type)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[v0] Mux webhook error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
