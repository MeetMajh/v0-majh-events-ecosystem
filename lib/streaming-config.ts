"use server"

/**
 * Streaming Infrastructure Configuration
 * 
 * Architecture:
 * MAJH Studio → API Layer → Mux (default) OR Self-Hosted RTMP (optional toggle)
 * 
 * Mux is always the default. Self-hosted RTMP can be enabled when:
 * 1. RTMP_ENABLED=true is set in environment
 * 2. RTMP_SERVER_URL is configured
 * 3. RTMP_PLAYBACK_URL is configured
 */

export type StreamingProvider = "mux" | "rtmp"

export interface StreamingConfig {
  provider: StreamingProvider
  mux: {
    enabled: boolean
    rtmpUrl: string
  }
  rtmp: {
    enabled: boolean
    ingestUrl: string | null
    playbackUrl: string | null
  }
}

/**
 * Get the current streaming configuration
 * Mux is always available; RTMP is optional based on env vars
 */
export async function getStreamingConfig(): Promise<StreamingConfig> {
  const rtmpEnabled = process.env.RTMP_ENABLED === "true"
  const rtmpIngestUrl = process.env.RTMP_SERVER_URL || null
  const rtmpPlaybackUrl = process.env.RTMP_PLAYBACK_URL || null
  
  // RTMP is only enabled if all required vars are set
  const rtmpFullyConfigured = rtmpEnabled && rtmpIngestUrl && rtmpPlaybackUrl

  return {
    // Default to Mux unless RTMP is explicitly enabled and configured
    provider: rtmpFullyConfigured ? "rtmp" : "mux",
    mux: {
      enabled: true, // Mux is always available as fallback
      rtmpUrl: "rtmps://global-live.mux.com:443/app",
    },
    rtmp: {
      enabled: rtmpFullyConfigured,
      ingestUrl: rtmpIngestUrl,
      playbackUrl: rtmpPlaybackUrl,
    },
  }
}

/**
 * Get the active streaming provider details
 */
export async function getActiveStreamingProvider() {
  const config = await getStreamingConfig()
  
  if (config.provider === "rtmp" && config.rtmp.enabled) {
    return {
      provider: "rtmp" as const,
      name: "MAJH Live (Self-Hosted)",
      rtmpUrl: config.rtmp.ingestUrl!,
      playbackBaseUrl: config.rtmp.playbackUrl!,
    }
  }
  
  return {
    provider: "mux" as const,
    name: "Mux",
    rtmpUrl: config.mux.rtmpUrl,
    playbackBaseUrl: "https://stream.mux.com",
  }
}

/**
 * Check if self-hosted RTMP is available
 */
export async function isRtmpAvailable(): Promise<boolean> {
  const config = await getStreamingConfig()
  return config.rtmp.enabled
}

/**
 * Get playback URL for a stream
 */
export async function getPlaybackUrl(playbackId: string, provider?: StreamingProvider): Promise<string> {
  const config = await getStreamingConfig()
  const activeProvider = provider || config.provider
  
  if (activeProvider === "rtmp" && config.rtmp.playbackUrl) {
    // Self-hosted HLS playback
    return `${config.rtmp.playbackUrl}/${playbackId}/index.m3u8`
  }
  
  // Mux HLS playback
  return `https://stream.mux.com/${playbackId}.m3u8`
}
