import Mux from "@mux/mux-node"

// Initialize Mux client
export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

/**
 * Create a new Mux live stream
 * Returns stream key, RTMP URL, and playback ID
 */
export async function createMuxLiveStream() {
  const stream = await mux.video.liveStreams.create({
    playback_policy: ["public"],
    new_asset_settings: { playback_policy: ["public"] },
    reconnect_window: 60,
    latency_mode: "low", // 3-5s latency
  })

  return {
    streamKey: stream.stream_key!,
    rtmpUrl: "rtmps://global-live.mux.com:443/app",
    playbackId: stream.playback_ids?.[0]?.id,
    muxStreamId: stream.id,
  }
}

/**
 * Get a Mux live stream by ID
 */
export async function getMuxLiveStream(muxStreamId: string) {
  try {
    const stream = await mux.video.liveStreams.retrieve(muxStreamId)
    return stream
  } catch (error) {
    console.error("Error fetching Mux stream:", error)
    return null
  }
}

/**
 * Delete a Mux live stream
 */
export async function deleteMuxLiveStream(muxStreamId: string) {
  try {
    await mux.video.liveStreams.delete(muxStreamId)
    return { success: true }
  } catch (error) {
    console.error("Error deleting Mux stream:", error)
    return { error: "Failed to delete stream" }
  }
}

/**
 * Get Mux asset (VOD) after stream ends
 */
export async function getMuxAsset(assetId: string) {
  try {
    const asset = await mux.video.assets.retrieve(assetId)
    return asset
  } catch (error) {
    console.error("Error fetching Mux asset:", error)
    return null
  }
}

/**
 * Verify Mux webhook signature
 */
export function verifyMuxWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Mux webhook verification
  const crypto = require("crypto")
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
  return signature === expectedSignature
}
